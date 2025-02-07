import { 
    customActionProvider, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { z } from "zod";
import { Time } from "@morpho-org/morpho-ts";
import { MarketId } from "@morpho-org/blue-sdk";
import { Market } from "@morpho-org/blue-sdk-viem/lib/augment/Market";
import { AccrualPosition } from "@morpho-org/blue-sdk-viem/lib/augment/Position";
import { CONFIG, MARKET_RISK_LEVELS } from '../config';
import { 
    Protocol,
    MarketData,
    Position,
    SimulationResult,
    TransactionRequest
} from "../types";
import { 
    publicClient, 
    simulateApproval, 
    simulateStrategy, 
    estimateGasCosts 
} from "../utils/viem";
import { formatUnits, parseUnits } from "viem";
import EventEmitter from "events";
import { PublicClient } from "viem";

// Add type guard for token names
type TokenName = keyof typeof CONFIG.TOKENS;

class MorphoProvider extends EventEmitter {
    private marketCache: Map<string, { data: MarketData; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        super();
    }

    private wadToPercentage(wadValue: bigint): number {
        return Number(wadValue) / 1e18 * 100;
    }

    private async getMarketData(marketId: string): Promise<MarketData> {
        const cached = this.marketCache.get(marketId);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
            return cached.data;
        }

        const market = await Market.fetch(marketId as MarketId, publicClient);
        const accruedMarket = market.accrueInterest(Time.timestamp());
        
        const config = Object.entries(CONFIG.MORPHO.markets)
            .find(([_, m]) => m.id === marketId);

        if (!config) throw new Error('Market configuration not found');
        const [name, marketConfig] = config;

        // In the getMarketData method, add type assertion
        const collateralToken = marketConfig.collateralToken as TokenName;
        const loanToken = marketConfig.loanToken as TokenName;

        const utilization = this.wadToPercentage(accruedMarket.utilization);
        const marketData: MarketData = {
            protocol: Protocol.MORPHO,
            name,
            marketId,
            apy: {
                supply: this.wadToPercentage(accruedMarket.supplyApy),
                borrow: this.wadToPercentage(accruedMarket.borrowApy)
            },
            metrics: {
                utilization,
                totalSupply: accruedMarket.totalSupplyAssets.toString(),
                totalBorrow: accruedMarket.totalBorrowAssets.toString(),
                liquidity: accruedMarket.liquidity.toString(),
                lltv: marketConfig.lltv
            },
            tokens: {
                collateral: CONFIG.TOKENS[collateralToken].address as `0x${string}`,
                loan: CONFIG.TOKENS[loanToken].address as `0x${string}`
            },
            risk: {
                isHealthy: accruedMarket.totalBorrowAssets <= accruedMarket.totalSupplyAssets,
                utilizationRisk: utilization > MARKET_RISK_LEVELS.HIGH_UTILIZATION ? 'HIGH' :
                               utilization > MARKET_RISK_LEVELS.MEDIUM_UTILIZATION ? 'MEDIUM' : 'LOW'
            }
        };

        this.marketCache.set(marketId, { data: marketData, timestamp: now });
        return marketData;
    }

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
                Object.entries(CONFIG.MORPHO.markets)
                    .map(async ([_, market]) => this.getMarketData(market.id))
            );

            return JSON.stringify(markets);
        } catch (error) {
            console.error('Error analyzing markets:', error);
            throw error;
        }
    }

    private async checkPosition(
        userAddress: `0x${string}`,
        marketId?: string
    ): Promise<string> {
        try {
            const positions: Position[] = [];

            const marketsToCheck = marketId 
                ? [{ id: marketId }]
                : Object.values(CONFIG.MORPHO.markets);

            for (const market of marketsToCheck) {
                try {
                    const position = await AccrualPosition.fetch(
                        userAddress,
                        market.id as MarketId,
                        publicClient
                    );

                    const accruedPosition = position.accrueInterest(Time.timestamp());
                    const marketData = await this.getMarketData(market.id);

                    if (accruedPosition.supplyAssets > BigInt(0) || accruedPosition.borrowAssets > BigInt(0)) {
                        positions.push({
                            protocol: Protocol.MORPHO,
                            marketId: market.id,
                            token: marketData.name,
                            supplyAmount: accruedPosition.supplyAssets.toString(),
                            borrowAmount: accruedPosition.borrowAssets.toString(),
                            healthFactor: Number(accruedPosition.ltv || 0),
                            collateralEnabled: true,
                            metrics: {
                                supplyAPY: marketData.apy.supply,
                                borrowAPY: marketData.apy.borrow
                            }
                        });
                    }
                } catch (error) {
                    console.warn(`Error fetching position for market ${market.id}:`, error);
                }
            }

            return JSON.stringify(positions);
        } catch (error) {
            console.error('Error checking positions:', error);
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
            const marketData = await this.getMarketData(args.marketId);
            if (!marketData.risk.isHealthy) {
                throw new Error('Market conditions unsafe for supply');
            }

            const amount = parseUnits(args.amount, CONFIG.TOKENS[marketData.name as TokenName].decimals);

            // Simulate approval
            const approvalSim = await simulateApproval(
                publicClient as PublicClient,
                userAddress,
                marketData.tokens.loan,
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                amount
            );

            if (!approvalSim.success) {
                throw new Error(`Approval simulation failed: ${approvalSim.error}`);
            }

            // Simulate supply
            const supplySim = await simulateStrategy(
                publicClient as PublicClient,
                userAddress,
                {
                    protocol: Protocol.MORPHO,
                    action: 'supply',
                    marketId: args.marketId,
                    token: marketData.tokens.loan,
                    amount
                },
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                CONFIG.MORPHO.address as `0x${string}`
            );

            if (!supplySim.success) {
                throw new Error(`Supply simulation failed: ${supplySim.error}`);
            }

            const totalGas = (approvalSim.gasEstimate || BigInt(0)) + 
                           (supplySim.gasEstimate || BigInt(0));
            
            const { gasCost, gasPrice } = await estimateGasCosts(publicClient as PublicClient, totalGas);

            return JSON.stringify({
                success: true,
                simulations: { approval: approvalSim, supply: supplySim },
                estimates: {
                    totalGas: totalGas.toString(),
                    gasCost: gasCost.toString(),
                    gasPrice: gasPrice.toString()
                }
            });
        } catch (error: any) {
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
            const marketData = await this.getMarketData(args.marketId);
            const amount = parseUnits(args.amount, CONFIG.TOKENS[marketData.name as TokenName].decimals);

            const withdrawSim = await simulateStrategy(
                publicClient as PublicClient,
                userAddress,
                {
                    protocol: Protocol.MORPHO,
                    action: 'withdraw',
                    marketId: args.marketId,
                    token: marketData.tokens.loan,
                    amount,
                    shares: args.shares ? BigInt(args.shares) : undefined
                },
                CONFIG.YIELD_MANAGER.address as `0x${string}`,
                CONFIG.MORPHO.address as `0x${string}`
            );

            if (!withdrawSim.success) {
                throw new Error(`Withdraw simulation failed: ${withdrawSim.error}`);
            }

            const { gasCost, gasPrice } = await estimateGasCosts(
                publicClient as PublicClient,
                withdrawSim.gasEstimate || BigInt(0)
            );

            return JSON.stringify({
                success: true,
                simulation: withdrawSim,
                estimates: {
                    gas: withdrawSim.gasEstimate?.toString(),
                    gasCost: gasCost.toString(),
                    gasPrice: gasPrice.toString()
                }
            });
        } catch (error: any) {
            throw error;
        }
    }
}

// Export singleton instance
export const morphoProvider = new MorphoProvider().createProvider();