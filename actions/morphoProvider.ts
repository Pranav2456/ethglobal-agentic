import { 
    customActionProvider, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { z } from "zod";
import { Time } from "@morpho-org/morpho-ts";
import { MarketId } from "@morpho-org/blue-sdk";
import { Market } from "@morpho-org/blue-sdk-viem/lib/augment/Market";
import { MarketParams } from "@morpho-org/blue-sdk-viem/lib/augment/MarketParams";
import { CONFIG, MARKET_RISK_LEVELS } from '../config';
import { 
    MarketResult, 
    SimulationResult,
    RiskMetrics 
} from "../types";
import { 
    publicClient, 
    simulateApproval, 
    simulateStrategy, 
    estimateGasCosts 
} from "../utils/viem";
import { formatUnits, parseUnits } from "ethers";
import { EventEmitter } from "events";
import { PublicClient } from "viem";
import { AccrualPosition } from "@morpho-org/blue-sdk-viem/lib/augment/Position";

class MorphoProvider extends EventEmitter {
    private lastMarketUpdate: Map<string, { timestamp: number; data: MarketResult }> = new Map();
    private readonly UPDATE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    constructor() {
        super();
    }

    // Convert wad values to percentages
    private wadToPercentage(wadValue: bigint): number {
        return Number(wadValue) / 1e18 * 100;
    }

    // Calculate risk metrics for a market
    private calculateRiskMetrics(market: Market): RiskMetrics {
        const utilization = this.wadToPercentage(market.utilization);
        
        return {
            isHealthy: market.totalBorrowAssets <= market.totalSupplyAssets,
            utilizationRisk: {
                current: utilization,
                status: utilization > MARKET_RISK_LEVELS.HIGH_UTILIZATION ? 'HIGH' :
                        utilization > MARKET_RISK_LEVELS.MEDIUM_UTILIZATION ? 'MEDIUM' : 'LOW'
            }
        };
    }

    // Get cached market data or fetch new
    private async getMarketData(marketId: string): Promise<MarketResult> {
        const cached = this.lastMarketUpdate.get(marketId);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.UPDATE_THRESHOLD) {
            return cached.data;
        }

        const marketData = await Market.fetch(marketId as MarketId, publicClient);
        const accruedMarket = marketData.accrueInterest(Time.timestamp());
        
        const result = await this.formatMarketData(marketId, accruedMarket);
        this.lastMarketUpdate.set(marketId, { timestamp: now, data: result });
        
        return result;
    }

    // Format market data into standard structure
    private async formatMarketData(marketId: string, market: Market): Promise<MarketResult> {
        const marketConfig = Object.entries(CONFIG.MORPHO.markets)
            .find(([_, m]) => m.id === marketId);

        if (!marketConfig) {
            throw new Error('Market configuration not found');
        }

        const [name, config] = marketConfig;
        const utilization = this.wadToPercentage(market.utilization);

        return {
            timestamp: new Date().toISOString(),
            market: name,
            data: {
                supplyAPY: this.wadToPercentage(market.supplyApy),
                borrowAPY: this.wadToPercentage(market.borrowApy),
                utilization,
                totalSupplyAssets: market.totalSupplyAssets.toString(),
                totalBorrowAssets: market.totalBorrowAssets.toString(),
                liquidity: market.liquidity.toString(),
                lltv: config.lltv,
                collateralToken: CONFIG.TOKENS[config.collateralToken as keyof typeof CONFIG.TOKENS].address as `0x${string}`,
                loanToken: CONFIG.TOKENS[config.loanToken as keyof typeof CONFIG.TOKENS].address as `0x${string}`
            },
            riskMetrics: this.calculateRiskMetrics(market)
        };
    }

    // Create action provider
    public createProvider() {
        return customActionProvider<CdpWalletProvider>({
            name: "morpho_market_action",
            description: "Manages Morpho market interactions for yield optimization",
            schema: z.object({
                action: z.enum(['analyze', 'supply', 'withdraw', 'balance', 'check_position']),
                marketId: z.string().optional(),
                amount: z.string().optional(),
                shares: z.string().optional()
            }),
            invoke: async (walletProvider, args) => {
                try {
                    const userAddress = await walletProvider.getAddress() as `0x${string}`;

                    switch(args.action) {
                        case 'analyze':
                            return await this.analyzeMarkets();
                        case 'supply':
                            return await this.handleSupply(userAddress, args);
                        case 'withdraw':
                            return await this.handleWithdraw(userAddress, args);
                        case 'check_position':
                            return await this.checkPosition(userAddress, args.marketId);
                        default:
                            throw new Error('Invalid action');
                    }
                } catch (error: any) {
                    console.error('Morpho action failed:', error);
                    this.emit('error', error);
                    return JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            }
        });
    }

    private async analyzeMarkets(): Promise<string> {
        try {
            const markets = await Promise.all(
                Object.entries(CONFIG.MORPHO.markets).map(async ([_, market]) => {
                    return await this.getMarketData(market.id);
                })
            );

            this.emit('marketsAnalyzed', markets);
            return JSON.stringify(markets);
        } catch (error) {
            this.emit('error', { type: 'analysis', error });
            throw error;
        }
    }

    private async handleSupply(
        userAddress: `0x${string}`,
        args: { marketId?: string; amount?: string }
    ): Promise<string> {
        if (!args.marketId || !args.amount) {
            throw new Error("Market ID and amount required");
        }

        try {
            // Verify market health first
            const marketData = await this.getMarketData(args.marketId);
            if (!marketData.riskMetrics.isHealthy) {
                throw new Error('Market conditions unsafe for supply');
            }

            // Get token info
            const token = CONFIG.TOKENS[marketData.data.loanToken as keyof typeof CONFIG.TOKENS];
            if (!token) {
                throw new Error('Token configuration not found');
            }

            // Parse amount with proper decimals
            const amount = parseUnits(args.amount, token.decimals);

            // Simulate approval
            const approvalSimulation = await simulateApproval(
                publicClient as PublicClient,
                userAddress,
                token.address as `0x${string}`,
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                amount
            );

            if (!approvalSimulation.success) {
                throw new Error(`Approval simulation failed: ${approvalSimulation.error}`);
            }

            // Simulate supply
            const supplySimulation = await simulateStrategy(
                publicClient as PublicClient,
                userAddress,
                {
                    action: 'supply',
                    marketId: args.marketId,
                    token: token.address as `0x${string}`,
                    amount
                },
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                CONFIG.MORPHO.address as `0x${string}`
            );

            if (!supplySimulation.success) {
                throw new Error(`Supply simulation failed: ${supplySimulation.error}`);
            }

            // Calculate gas costs
            const totalGasEstimate = (approvalSimulation.gasEstimate || BigInt(0)) + 
                                   (supplySimulation.gasEstimate || BigInt(0));
            
            const { gasCost, gasPrice } = await estimateGasCosts(publicClient as PublicClient, totalGasEstimate);

            // Check if gas cost is reasonable compared to amount
            const gasCostPercentage = Number(gasCost) / Number(amount) * 100;
            if (gasCostPercentage > CONFIG.TRANSACTIONS.MAX_GAS_COST_PERCENTAGE) {
                throw new Error('Gas cost too high relative to supply amount');
            }

            this.emit('supplySimulated', {
                userAddress,
                marketId: args.marketId,
                amount: args.amount,
                gasCost: formatUnits(gasCost, 'gwei')
            });

            return JSON.stringify({
                success: true,
                simulations: {
                    approval: approvalSimulation,
                    supply: supplySimulation
                },
                estimates: {
                    totalGas: totalGasEstimate.toString(),
                    gasCost: gasCost.toString(),
                    gasPrice: gasPrice.toString()
                }
            });
        } catch (error: any) {
            this.emit('error', { type: 'supply', error });
            throw error;
        }
    }

    private async handleWithdraw(
        userAddress: `0x${string}`,
        args: { marketId?: string; amount?: string; shares?: string }
    ): Promise<string> {
        if (!args.marketId || !args.amount) {
            throw new Error("Market ID and amount required");
        }

        try {
            // Get market data and verify
            const marketData = await this.getMarketData(args.marketId);
            const token = CONFIG.TOKENS[marketData.data.loanToken as keyof typeof CONFIG.TOKENS];
            
            if (!token) {
                throw new Error('Token configuration not found');
            }

            // Parse amount
            const amount = parseUnits(args.amount, token.decimals);

            // Simulate withdrawal
            const withdrawSimulation = await simulateStrategy(
                publicClient as PublicClient,
                userAddress,
                {
                    action: 'withdraw',
                    marketId: args.marketId,
                    token: token.address as `0x${string}`,
                    amount,
                    shares: args.shares ? BigInt(args.shares) : undefined
                },
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                CONFIG.MORPHO.address as `0x${string}`
            );

            if (!withdrawSimulation.success) {
                throw new Error(`Withdraw simulation failed: ${withdrawSimulation.error}`);
            }

            // Calculate gas costs
            const { gasCost, gasPrice } = await estimateGasCosts(
                publicClient as PublicClient,
                withdrawSimulation.gasEstimate || BigInt(0)
            );

            this.emit('withdrawSimulated', {
                userAddress,
                marketId: args.marketId,
                amount: args.amount,
                gasCost: formatUnits(gasCost, 'gwei')
            });

            return JSON.stringify({
                success: true,
                simulation: withdrawSimulation,
                estimates: {
                    gas: withdrawSimulation.gasEstimate?.toString(),
                    gasCost: gasCost.toString(),
                    gasPrice: gasPrice.toString()
                }
            });
        } catch (error: any) {
            this.emit('error', { type: 'withdraw', error });
            throw error;
        }
    }

    private async checkPosition(
        userAddress: `0x${string}`,
        marketId?: string
    ): Promise<string> {
        try {
            if (marketId) {
                // Check single market position
                const market = await this.getMarketData(marketId);
                const position = await this.getMarketPosition(userAddress, marketId, market);

                return JSON.stringify({
                    marketId,
                    position,
                    marketData: {
                        supplyAPY: market.data.supplyAPY,
                        borrowAPY: market.data.borrowAPY,
                        utilization: market.data.utilization
                    }
                });
            } else {
                // Check all market positions
                const positions = await Promise.all(
                    Object.entries(CONFIG.MORPHO.markets).map(async ([name, market]) => {
                        const marketData = await this.getMarketData(market.id);
                        const position = await this.getMarketPosition(userAddress, market.id, marketData);

                        return {
                            market: name,
                            marketId: market.id,
                            position,
                            marketData: {
                                supplyAPY: marketData.data.supplyAPY,
                                borrowAPY: marketData.data.borrowAPY,
                                utilization: marketData.data.utilization
                            }
                        };
                    })
                );

                return JSON.stringify(positions);
            }
        } catch (error: any) {
            this.emit('error', { type: 'position_check', error });
            throw error;
        }
    }

    private async getMarketPosition(
    userAddress: `0x${string}`,
    marketId: string,
    marketData: MarketResult
) {
    try {
        // Fetch position using Morpho SDK
        const position = await AccrualPosition.fetch(
            userAddress,
            marketId as MarketId,
            publicClient
        );

        // Accrue interest to the latest timestamp
        const accruedPosition = position.accrueInterest(Time.timestamp());

        // Get market for additional calculations
        const market = await Market.fetch(marketId as MarketId, publicClient);
        const accruedMarket = market.accrueInterest(Time.timestamp());

        // Calculate health factor (using SDK's built-in values)
        const healthFactor = accruedPosition.supplyAssets > BigInt(0) ? 
            Number(accruedPosition.supplyAssets * BigInt(100) / (accruedPosition.borrowAssets || BigInt(1))) / 100 : 0;

        return {
            supplyShares: accruedPosition.supplyShares.toString(),
            borrowShares: accruedPosition.borrowShares.toString(),
            supplyAssets: accruedPosition.supplyAssets.toString(),
            borrowAssets: accruedPosition.borrowAssets.toString(),
            healthFactor,
            isHealthy: accruedPosition.isHealthy,
            maxBorrowable: accruedPosition.maxBorrowableAssets?.toString(),
            // Additional data from SDK
            ltv: accruedPosition.ltv,
            collateralValue: accruedPosition.collateralValue?.toString()
        };
    } catch (error) {
        console.error('Error getting market position:', error);
        throw error;
        }
    }
}

// Export singleton instance
export const morphoProvider = new MorphoProvider().createProvider();
