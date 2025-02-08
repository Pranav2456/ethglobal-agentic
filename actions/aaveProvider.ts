// src/actions/aaveProvider.ts
import { 
    customActionProvider, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { Wallet, readContract } from "@coinbase/coinbase-sdk";
import { z } from "zod";
import { ethers, Transaction } from 'ethers';
import {
    UiPoolDataProvider,
    UiIncentiveDataProvider,
    ChainId,
} from '@aave/contract-helpers';
import * as markets from '@bgd-labs/aave-address-book';
import { formatReservesAndIncentives, formatUserSummaryAndIncentives } from '@aave/math-utils';
import dayjs from 'dayjs';
import { encodeAbiParameters, parseUnits } from 'viem';
import { CONFIG } from '../config';
import { YIELD_MANAGER_ABI, ERC20_ABI } from '../contracts/abis';

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
                token: z.string().optional(),
                amount: z.string().optional(),
                marketId: z.string().optional(),
            }),
            invoke: async (walletProvider, args) => {
                try {
                    const userAddress = await walletProvider.getAddress() as `0x${string}`;

                    switch(args.action) {
                        case 'analyze':
                            return await this.analyzeMarkets();
                        case 'supply':
                            if (!args.amount || !args.token) {
                                throw new Error("Supply requires both amount and token parameters");
                            }
                            return await this.handleSupply(userAddress, {
                                amount: args.amount,
                                token: args.token
                            }, walletProvider);
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

    private async handleSupply(
        userAddress: `0x${string}`,
        args: { amount: string; token: string },
        walletProvider: CdpWalletProvider
      ): Promise<string> {
        if (!args.amount || !args.token) {
          throw new Error("Amount and token required");
        }
        
        try {
          // --- Step 1: Export wallet data from your wallet provider ---
          const walletData = await walletProvider.exportWallet();
          console.log("Exported wallet data:", walletData);
          
          // --- Step 2: Import the wallet data into a Coinbase SDK Wallet instance ---
          const sdkWallet = await Wallet.import(walletData);
          
          // Verify that the imported wallet's default address is valid.
          const sdkAddress = await sdkWallet.getDefaultAddress();
          console.log("Imported SDK Wallet Address:", sdkAddress.toString());
          if (sdkAddress.toString() === "0x0000000000000000000000000000000000000000") {
            throw new Error("Imported wallet address is zero—check your wallet data.");
          }
          
          // --- Step 3: Prepare token parameters ---
          const tokenSymbol = args.token.toUpperCase();
          const tokenConfig = CONFIG.TOKENS[tokenSymbol as keyof typeof CONFIG.TOKENS];
          if (!tokenConfig) {
            throw new Error(`Token ${tokenSymbol} not found in config`);
          }
          const tokenAddress = tokenConfig.address as `0x${string}`;
          const amountBigInt = parseUnits(args.amount, tokenConfig.decimals);
          
          // --- Step 4: Check current allowance ---
          const currentAllowance: bigint = await readContract({
            networkId: CONFIG.NETWORK.id, // e.g., "base-mainnet"
            abi: ERC20_ABI,
            contractAddress: tokenAddress,
            method: "allowance",
            //@ts-ignore
            args: { owner: walletProvider.getAddress() as `0x${string}`, spender: CONFIG.YIELD_MANAGER.address as `0x${string}` },
          });
          console.log("Current allowance:", currentAllowance.toString());
          
          // If the current allowance is insufficient, perform the approval transaction.
          if (currentAllowance < amountBigInt) {
            console.log("Allowance insufficient. Sending approval transaction.");
            const approveArgs = {
              spender: CONFIG.YIELD_MANAGER.address as `0x${string}`,
              value: amountBigInt.toString(),
            };
            const approveInvocation = await sdkWallet.invokeContract({
              contractAddress: tokenAddress,
              method: "approve",
              args: approveArgs,
              abi: ERC20_ABI,
            });
            await approveInvocation.wait();
            console.log("Approval confirmed.");
          } else {
            console.log("Sufficient allowance available. Skipping approval.");
          }
          
          // --- Step 5: Execute the deposit ---
          // For AAVE deposits, encode additionalData as abi.encode(uint16(0)) per Foundry tests.
          const depositAdditionalData = encodeAbiParameters([{ type: "bytes32" }], ["0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`]);
          const depositArgs = {
            _strategy: CONFIG.STRATEGIES.AAVE.address as `0x${string}`,
            _tokens: [tokenAddress],
            _amounts: [parseUnits(args.amount, tokenConfig.decimals).toString()], // Convert to proper units
            _additionalData: depositAdditionalData,
            _for: userAddress,
          };
          const depositInvocation = await sdkWallet.invokeContract({
            contractAddress: CONFIG.YIELD_MANAGER.address as `0x${string}`,
            method: "deposit",
            args: depositArgs,
            abi: YIELD_MANAGER_ABI,
          });
          await depositInvocation.wait();
          console.log("Deposit confirmed.");
          
          return JSON.stringify({
            success: true,
            message: "Supply (approval and deposit) successful",
          });
        } catch (error: any) {
          console.error("Supply failed:", error);
          throw error;
        }
      }
    private async handleWithdraw(userAddress: string, args: any): Promise<string> {
        // TODO: Implement withdraw logic
        return JSON.stringify({
            success: true,
            message: 'Withdrawal not implemented'
        });
    }
}

// Create and export provider instance
export const aaveProvider = new AaveProvider(new ethers.providers.JsonRpcProvider(
    "https://base-mainnet.g.alchemy.com/v2/Y8rMH9-oKPNkA0yWyZG6xnZsF4MqLIQl"
)).createProvider();