// src/actions/aaveProvider.ts
import { 
    customActionProvider, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { z } from "zod";
import { ethers } from 'ethers';
import {
    UiPoolDataProvider,
    UiIncentiveDataProvider,
    ChainId,
} from '@aave/contract-helpers';
import * as markets from '@bgd-labs/aave-address-book';
import { formatReservesAndIncentives, formatUserSummaryAndIncentives } from '@aave/math-utils';
import dayjs from 'dayjs';

class AaveProvider {
    private poolDataProvider: UiPoolDataProvider;
    private incentiveDataProvider: UiIncentiveDataProvider;
    private marketCache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(provider: ethers.providers.Provider) {
        // Initialize Aave data providers
        this.poolDataProvider = new UiPoolDataProvider({
            uiPoolDataProviderAddress: markets.AaveV3Base.UI_POOL_DATA_PROVIDER,
            provider,
            chainId: ChainId.base,
        });

        this.incentiveDataProvider = new UiIncentiveDataProvider({
            uiIncentiveDataProviderAddress: markets.AaveV3Base.UI_INCENTIVE_DATA_PROVIDER,
            provider,
            chainId: ChainId.base,
        });
    }

    public createProvider() {
        return customActionProvider<CdpWalletProvider>({
            name: "aave_market_action",
            description: "Manages Aave market interactions for yield optimization",
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
                            return await this.checkPosition(userAddress);
                        default:
                            throw new Error('Invalid action');
                    }
                } catch (error: any) {
                    console.error('Aave action failed:', error);
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
            // Check cache first
            const now = Date.now();
            const cachedData = Array.from(this.marketCache.values())
                .filter(entry => (now - entry.timestamp) < this.CACHE_TTL);
            
            if (cachedData.length > 0) {
                return JSON.stringify(cachedData.map(entry => entry.data));
            }

            // Fetch fresh data
            const reserves = await this.poolDataProvider.getReservesHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
            });

            const reserveIncentives = await this.incentiveDataProvider.getReservesIncentivesDataHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
            });

            // Format the data
            const formattedReserves = formatReservesAndIncentives({
                reserves: reserves.reservesData,
                currentTimestamp: dayjs().unix(),
                marketReferenceCurrencyDecimals: reserves.baseCurrencyData.marketReferenceCurrencyDecimals,
                marketReferencePriceInUsd: reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
                reserveIncentives,
            });

            // Convert to our standard MarketResult format
            const marketResults = formattedReserves.map(reserve => ({
                timestamp: new Date().toISOString(),
                market: reserve.symbol,
                data: {
                    supplyAPY: Number(reserve.supplyAPY),
                    borrowAPY: Number(reserve.variableBorrowAPY),
                    utilization: Number(reserve.totalLiquidity) / Number(reserve.totalDebt) * 100,
                    totalSupplyAssets: reserve.totalLiquidity,
                    totalBorrowAssets: reserve.totalDebt,
                    liquidity: reserve.availableLiquidity,
                    lltv: Number(reserve.baseLTVasCollateral),
                    collateralToken: reserve.underlyingAsset,
                    loanToken: reserve.underlyingAsset,
                },
                riskMetrics: {
                    isHealthy: Number(reserve.totalLiquidity) / Number(reserve.totalDebt) < 0.95,
                    utilizationRisk: {
                        current: Number(reserve.totalLiquidity) / Number(reserve.totalDebt) * 100,
                        status: Number(reserve.totalLiquidity) / Number(reserve.totalDebt) > 0.8 ? 'HIGH' :
                                Number(reserve.totalLiquidity) / Number(reserve.totalDebt) > 0.5 ? 'MEDIUM' : 'LOW'
                    }
                }
            }));

            // Update cache
            marketResults.forEach(market => {
                this.marketCache.set(market.market, {
                    data: market,
                    timestamp: now
                });
            });

            return JSON.stringify(marketResults);
        } catch (error) {
            console.error('Error analyzing Aave markets:', error);
            throw error;
        }
    }

    private async checkPosition(userAddress: string): Promise<string> {
        try {
            const reserves = await this.poolDataProvider.getReservesHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
            });

            const userReserves = await this.poolDataProvider.getUserReservesHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
                user: userAddress,
            });

            const reserveIncentives = await this.incentiveDataProvider.getReservesIncentivesDataHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
            });

            const userIncentives = await this.incentiveDataProvider.getUserReservesIncentivesDataHumanized({
                lendingPoolAddressProvider: markets.AaveV3Base.POOL_ADDRESSES_PROVIDER,
                user: userAddress,
            });

            const formattedReserves = formatReservesAndIncentives({
                reserves: reserves.reservesData,
                currentTimestamp: dayjs().unix(),
                marketReferenceCurrencyDecimals: reserves.baseCurrencyData.marketReferenceCurrencyDecimals,
                marketReferencePriceInUsd: reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
                reserveIncentives,
            });

            const userSummary = formatUserSummaryAndIncentives({
                currentTimestamp: dayjs().unix(),
                marketReferencePriceInUsd: reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
                marketReferenceCurrencyDecimals: reserves.baseCurrencyData.marketReferenceCurrencyDecimals,
                userReserves: userReserves.userReserves,
                formattedReserves,
                userEmodeCategoryId: userReserves.userEmodeCategoryId,
                reserveIncentives,
                userIncentives,
            });

            return JSON.stringify({
                summary: {
                    healthFactor: userSummary.healthFactor,
                    totalLiquidityUSD: userSummary.totalLiquidityUSD,
                    totalCollateralUSD: userSummary.totalCollateralUSD,
                    totalBorrowsUSD: userSummary.totalBorrowsUSD,
                    availableBorrowsUSD: userSummary.availableBorrowsUSD,
                    currentLoanToValue: userSummary.currentLoanToValue,
                },
                positions: userSummary.userReservesData.map(reserve => ({
                    token: reserve.reserve.symbol,
                    supplyBalance: reserve.underlyingBalance,
                    borrowBalance: reserve.totalBorrows,
                    supplyAPY: reserve.reserve.supplyAPY,
                    borrowAPY: reserve.reserve.variableBorrowAPY,
                    isCollateral: reserve.usageAsCollateralEnabledOnUser,
                }))
            });
        } catch (error) {
            console.error('Error checking Aave position:', error);
            throw error;
        }
    }

    private async handleSupply(userAddress: string, args: any): Promise<string> {
        // TODO: Implement supply logic
        throw new Error('Not implemented yet');
    }

    private async handleWithdraw(userAddress: string, args: any): Promise<string> {
        // TODO: Implement withdraw logic
        throw new Error('Not implemented yet');
    }
}

// Create and export provider instance
export const aaveProvider = new AaveProvider(new ethers.providers.JsonRpcProvider(
    "https://base-mainnet.g.alchemy.com/v2/Y8rMH9-oKPNkA0yWyZG6xnZsF4MqLIQl"
)).createProvider();