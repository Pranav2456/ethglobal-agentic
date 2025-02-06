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
  import { MarketResult, SimulationResult } from "../types";
  import { publicClient, simulateApproval, simulateStrategy, estimateGasCosts } from "../utils/viem";
  import { ERC20_ABI } from "../contracts/abis";
import { PublicClient } from "viem";
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second
  
  async function withRetry<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return withRetry(operation, retries - 1);
      }
      throw error;
    }
  }
  
  /**
   * Helper to convert wad values to percentages.
   */
  function wadToPercentage(wadValue: bigint): number {
    return Number(wadValue) / 1e18 * 100;
  }
  
  export const morphoActionProvider = customActionProvider<CdpWalletProvider>({
    name: "morpho_market_action",
    description: "Analyzes and simulates interactions with Morpho markets for yield optimization",
    schema: z.object({
      action: z.enum(['analyze', 'supply', 'withdraw', 'balance', 'check_position']),
      marketId: z.string().optional(),
      token: z.string().optional(),
      amount: z.string().optional(),
      shares: z.string().optional()
    }),
    invoke: async (walletProvider, args) => {
      try {
        const userAddress = await walletProvider.getAddress() as `0x${string}`;
  
        switch(args.action) {
          case 'analyze':
            return await handleMarketAnalysis();
          
          case 'balance':
            return await handleBalanceCheck(userAddress);
          
          case 'supply':
            return await handleSupply(userAddress, args);
          
          case 'withdraw':
            return await handleWithdraw(userAddress, args);
          
          case 'check_position':
            return await handlePositionCheck(userAddress, args.marketId);
          
          default:
            throw new Error('Invalid action');
        }
      } catch (error: any) {
        console.error('Morpho action simulation failed:', error);
        return JSON.stringify({
          success: false,
          error: error?.message || 'Unknown error occurred'
        });
      }
    }
  });
  
  async function handleMarketAnalysis(): Promise<string> {
    return withRetry(async () => {
      try {
        const marketAnalyses = await Promise.all(
          Object.entries(CONFIG.MORPHO.markets).map(async ([name, market]) => {
            const marketParams = await MarketParams.fetch(market.id as MarketId, publicClient);
            const marketData = await Market.fetch(market.id as MarketId, publicClient);
            const accruedMarket = marketData.accrueInterest(Time.timestamp());
  
            const utilization = wadToPercentage(accruedMarket.utilization);
  
            const result: MarketResult = {
              timestamp: new Date().toISOString(),
              market: name,
              data: {
                supplyAPY: wadToPercentage(accruedMarket.supplyApy),
                borrowAPY: wadToPercentage(accruedMarket.borrowApy),
                utilization,
                totalSupplyAssets: accruedMarket.totalSupplyAssets.toString(),
                totalBorrowAssets: accruedMarket.totalBorrowAssets.toString(),
                liquidity: accruedMarket.liquidity.toString(),
                lltv: market.lltv,
                collateralToken: CONFIG.TOKENS[market.collateralToken as keyof typeof CONFIG.TOKENS].address as `0x${string}`,
                loanToken: CONFIG.TOKENS[market.loanToken as keyof typeof CONFIG.TOKENS].address as `0x${string}`
              },
              riskMetrics: {
                isHealthy: accruedMarket.totalBorrowAssets <= accruedMarket.totalSupplyAssets,
                utilizationRisk: {
                  current: utilization,
                  status: utilization > MARKET_RISK_LEVELS.HIGH_UTILIZATION ? 'HIGH' : 
                          utilization > MARKET_RISK_LEVELS.MEDIUM_UTILIZATION ? 'MEDIUM' : 'LOW'
                }
              }
            };
            return result;
          })
        );
        return JSON.stringify(marketAnalyses);
      } catch (error: any) {
        throw new Error(`Market analysis failed: ${error.message}`);
      }
    });
  }
  
  async function handleBalanceCheck(userAddress: `0x${string}`): Promise<string> {
    try {
      const balances = await Promise.all(
        Object.entries(CONFIG.TOKENS).map(async ([symbol, token]) => {
          const result = await publicClient.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [userAddress]
          });
  
          return {
            token: symbol,
            balance: result.toString(),
            decimals: token.decimals
          };
        })
      );
      return JSON.stringify(balances);
    } catch (error: any) {
      throw new Error(`Balance simulation failed: ${error.message}`);
    }
  }
  
  async function handleSupply(
    userAddress: `0x${string}`, 
    args: { marketId?: string; token?: string; amount?: string }
  ): Promise<string> {
    if (!args.marketId || !args.token || !args.amount) {
      throw new Error("marketId, token and amount are required for supply simulation");
    }
  
    try {
      // Simulate approval first.
      const approvalSimulation: SimulationResult = await simulateApproval(
        publicClient as PublicClient,
        userAddress,
        args.token as `0x${string}`,
        CONFIG.YIELD_MANAGER.address as `0x${string}`,
        BigInt(args.amount)
      );
  
      if (!approvalSimulation.success) {
        throw new Error(`Approval simulation failed: ${approvalSimulation.error}`);
      }
  
      // Simulate the deposit call.
      const supplySimulation: SimulationResult = await simulateStrategy(
        publicClient as PublicClient,
        userAddress,
        {
          action: 'supply',
          marketId: args.marketId,
          token: args.token as `0x${string}`,
          amount: BigInt(args.amount)
        },
        CONFIG.YIELD_MANAGER.address as `0x${string}`,
        CONFIG.MORPHO.address as `0x${string}`
      );
  
      if (!supplySimulation.success) {
        throw new Error(`Supply simulation failed: ${supplySimulation.error}`);
      }
  
      // Estimate combined gas cost for both simulation calls.
      const totalGasEstimate = (approvalSimulation.gasEstimate || BigInt(0)) + 
                              (supplySimulation.gasEstimate || BigInt(0));
      const { gasCost, gasPrice } = await estimateGasCosts(
        publicClient as PublicClient, 
        totalGasEstimate
      );
  
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
      throw new Error(`Supply simulation failed: ${error.message}`);
    }
  }
  
  async function handleWithdraw(
    userAddress: `0x${string}`,
    args: { marketId?: string; token?: string; amount?: string; shares?: string }
  ): Promise<string> {
    if (!args.marketId || !args.token || !args.amount) {
      throw new Error("marketId, token and amount are required for withdraw simulation");
    }
  
    try {
      // Simulate the withdraw call.
      const withdrawSimulation: SimulationResult = await simulateStrategy(
        publicClient as PublicClient,
        userAddress,
        {
          action: 'withdraw',
          marketId: args.marketId,
          token: args.token as `0x${string}`,
          amount: BigInt(args.amount),
          shares: args.shares ? BigInt(args.shares) : undefined
        },
        CONFIG.YIELD_MANAGER.address as `0x${string}`,
        CONFIG.MORPHO.address as `0x${string}`
      );
  
      if (!withdrawSimulation.success) {
        throw new Error(`Withdraw simulation failed: ${withdrawSimulation.error}`);
      }
  
      // Estimate gas costs for the simulation.
      const { gasCost, gasPrice } = await estimateGasCosts(
        publicClient as PublicClient,
        withdrawSimulation.gasEstimate || BigInt(0)
      );
  
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
      throw new Error(`Withdraw simulation failed: ${error.message}`);
    }
  }
  
  async function handlePositionCheck(
    userAddress: `0x${string}`,
    marketId?: string
  ): Promise<string> {
    try {
      if (marketId) {
        // Simulate check for a specific market position.
        const market = Object.values(CONFIG.MORPHO.markets).find(m => m.id === marketId);
        if (!market) {
          throw new Error('Market not found');
        }
  
        const marketParams = await MarketParams.fetch(marketId as MarketId, publicClient);
        const marketData = await Market.fetch(market.id as MarketId, publicClient);
        const accruedMarket = marketData.accrueInterest(Time.timestamp());
  
        // Get the simulated market position for the user.
        const position = await getMarketPosition(
          userAddress,
          marketId as `0x${string}`,
          accruedMarket
        );
  
        return JSON.stringify({
          marketId,
          position,
          marketData: {
            supplyAPY: wadToPercentage(accruedMarket.supplyApy),
            borrowAPY: wadToPercentage(accruedMarket.borrowApy),
            utilization: wadToPercentage(accruedMarket.utilization)
          }
        });
      } else {
        // Simulate check for all market positions.
        const positions = await Promise.all(
          Object.entries(CONFIG.MORPHO.markets).map(async ([name, market]) => {
            const marketParams = await MarketParams.fetch(market.id as MarketId, publicClient);
            const marketData = await Market.fetch(market.id as MarketId, publicClient);
            const accruedMarket = marketData.accrueInterest(Time.timestamp());
  
            const position = await getMarketPosition(
              userAddress,
              market.id as `0x${string}`,
              accruedMarket
            );
  
            return {
              market: name,
              marketId: market.id,
              position,
              marketData: {
                supplyAPY: wadToPercentage(accruedMarket.supplyApy),
                borrowAPY: wadToPercentage(accruedMarket.borrowApy),
                utilization: wadToPercentage(accruedMarket.utilization)
              }
            };
          })
        );
  
        return JSON.stringify(positions);
      }
    } catch (error: any) {
      throw new Error(`Position simulation failed: ${error.message}`);
    }
  }
  
  /**
   * Helper function to simulate fetching the user's market position.
   */
  async function getMarketPosition(
    userAddress: `0x${string}`,
    marketId: `0x${string}`,
    accruedMarket: Market
  ) {
    try {
      // Read user's supply shares.
      const supplyShares: bigint = await publicClient.readContract({
        address: CONFIG.MORPHO.address as `0x${string}`,
        abi: [
          {
            name: 'supplyShares',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'marketId', type: 'bytes32' },
              { name: 'user', type: 'address' }
            ],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'supplyShares',
        args: [marketId, userAddress]
      });
  
      // Read user's borrow shares.
      const borrowShares: bigint = await publicClient.readContract({
        address: CONFIG.MORPHO.address as `0x${string}`,
        abi: [
          {
            name: 'borrowShares',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'marketId', type: 'bytes32' },
              { name: 'user', type: 'address' }
            ],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'borrowShares',
        args: [marketId, userAddress]
      });
  
      // Convert shares to underlying assets.
      const supplyAssets: bigint = accruedMarket.toSupplyAssets(supplyShares);
      const borrowAssets: bigint = accruedMarket.toBorrowAssets(borrowShares);
  
      const healthFactor = supplyAssets > BigInt(0) ? 
        Number(supplyAssets * BigInt(100) / (borrowAssets || BigInt(1))) / 100 : 0;
  
      return {
        supplyShares: supplyShares.toString(),
        borrowShares: borrowShares.toString(),
        supplyAssets: supplyAssets.toString(),
        borrowAssets: borrowAssets.toString(),
        healthFactor: healthFactor
      };
    } catch (error: any) {
      throw new Error(`Failed to simulate market position: ${error.message}`);
    }
  }
  