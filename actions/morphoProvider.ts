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
import { Wallet, readContract } from "@coinbase/coinbase-sdk";
import { 
    publicClient, 
    simulateApproval, 
    simulateStrategy, 
    estimateGasCosts 
} from "../utils/viem";
import { formatUnits, parseUnits, encodeAbiParameters } from "viem";
import EventEmitter from "events";
import { PublicClient } from "viem";
import { ERC20_ABI, YIELD_MANAGER_ABI } from "../contracts/abis";
import { encodeFunctionData } from "viem";
import { ethers } from "ethers";

// Add type guard for token names
type TokenName = keyof typeof CONFIG.TOKENS;

// Add at the top with other types
type TokenSymbol = keyof typeof CONFIG.TOKENS;

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
                action: z.enum(['analyze', 'supply', 'withdraw', 'balance', 'check_position', 'check_token_balances']),
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
                            return await this.handleSupply(userAddress, args, walletProvider);
                        case 'withdraw':
                            return await this.handleWithdraw(userAddress, args);
                        case 'check_position':
                            return await this.checkPosition(userAddress, args.marketId);
                        case 'balance':
                            return await this.checkBalance(userAddress);
                        case 'check_token_balances':
                            return await this.checkAllTokenBalances(userAddress);
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
    
            // Fix: Use proper market IDs from config
            let marketsToCheck;
            if (marketId) {
                // If specific market requested, find it in config
                const marketConfig = Object.values(CONFIG.MORPHO.markets).find(
                    market => market.id.toLowerCase() === marketId.toLowerCase()
                );
                marketsToCheck = marketConfig ? [marketConfig] : [];
            } else {
                // Otherwise check all markets
                marketsToCheck = Object.values(CONFIG.MORPHO.markets);
            }
    
            for (const market of marketsToCheck) {
                try {
                    if (!market.id || typeof market.id !== 'string') {
                        console.warn('Invalid market configuration');
                        continue;
                    }
    
                    const position = await AccrualPosition.fetch(
                        userAddress,
                        market.id as `0x${string}` as MarketId,
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
        args: { marketId: string; amount: string; token: string },
        walletProvider: CdpWalletProvider
      ): Promise<string> {
        if (!args.amount || !args.token || !args.marketId) {
          throw new Error("Amount, token, and marketId required");
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
            // Pass args as an object if supported; adjust as needed.
            args: { owner: sdkAddress.toString(), spender: CONFIG.YIELD_MANAGER.address as `0x${string}` },
          });
          console.log("Current allowance:", currentAllowance.toString());
          
          // If current allowance is insufficient, perform the approval transaction.
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
          // For MORPHO deposits, the tests require _additionalData = abi.encode(marketId).
          // Ensure args.marketId is a properly formatted bytes32 string.
          const depositAdditionalData = encodeAbiParameters(
            [{ type: "bytes32" }],
            [args.marketId as `0x${string}`]
          );
          
          const depositArgs = {
            _strategy: CONFIG.STRATEGIES.MORPHO.address as `0x${string}`,
            _tokens: [tokenAddress],
            _amounts: [amountBigInt.toString()], // Convert to string for serialization
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
          // get the tx hash
          const txHash = depositInvocation.getTransactionHash();
          console.log("Deposit confirmed.");
          
          return JSON.stringify({
            success: true,
            message: `Supply (approval and deposit) successful - ${txHash}`,
          });
        } catch (error: any) {
          console.error("Supply failed:", error);
          throw error;
        }
      }

    private async handleWithdraw(
        userAddress: `0x${string}`,
        args: { marketId?: string; amount?: string; shares?: string }
    ): Promise<string> {
       // TODO: Implement withdraw
       return JSON.stringify({
        success: true,
        message: 'Withdrawal not implemented'
       });
    }

    private async checkBalance(userAddress: `0x${string}`): Promise<string> {
        try {
            // Get ETH balance
            const ethBalance = await publicClient.getBalance({ address: userAddress });
            
            // Get token balances
            const tokenBalances = await Promise.all(
                Object.entries(CONFIG.TOKENS).map(async ([symbol, token]) => ({
                    symbol,
                    balance: await publicClient.readContract({
                        address: token.address as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [userAddress]
                    })
                }))
            );

            return JSON.stringify({
                eth: ethBalance.toString(),
                tokens: Object.fromEntries(
                    tokenBalances.map(({ symbol, balance }) => [symbol, balance.toString()])
                )
            });
        } catch (error) {
            console.error('Error checking balances:', error);
            throw error;
        }
    }

    private async checkAllTokenBalances(userAddress: `0x${string}`): Promise<string> {
        try {
            const balances = await Promise.all(
                Object.entries(CONFIG.TOKENS).map(async ([symbol, token]) => ({
                    symbol: symbol as TokenSymbol,
                    address: token.address,
                    balance: formatUnits(
                        await publicClient.readContract({
                            address: token.address as `0x${string}`,
                            abi: ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [userAddress]
                        }),
                        token.decimals || 18
                    )
                }))
            );

            return JSON.stringify({
                tokens: Object.fromEntries(
                    balances.map(({ symbol, balance }) => [symbol, balance])
                )
            });
        } catch (error) {
            console.error('Error checking token balances:', error);
            throw error;
        }
    }
}



// Export singleton instance
export const morphoProvider = new MorphoProvider().createProvider();