import { 
    customActionProvider, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { z } from "zod";
import { ethers } from 'ethers';
import { Market } from "@morpho-org/blue-sdk-ethers/lib/augment/Market";
import { MarketParams } from "@morpho-org/blue-sdk-ethers/lib/augment/MarketParams";
import { CONFIG, MARKET_RISK_LEVELS } from '../config';
import { Time } from "@morpho-org/morpho-ts";

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)'
] as const;

function wadToPercentage(wadValue: bigint): number {
    return Number(wadValue) / 1e18 * 100;
}

export const morphoActionProvider = customActionProvider<CdpWalletProvider>({
    name: "morpho_market_action",
    description: "Analyzes and interacts with Morpho markets for yield optimization",
    schema: z.object({
        action: z.enum(['analyze', 'supply', 'withdraw', 'balance']),
        userId: z.string().optional(),
        strategy: z.string().optional(),
        token: z.string().optional(),
        amount: z.string().optional()
    }),
    invoke: async (walletProvider, args) => {
        try {
            const provider = new ethers.JsonRpcProvider(process.env.BASE_MAINNET_RPC_URL);

            if (args.action === 'balance') {
                const address = await walletProvider.getAddress();
                const balances = await Promise.all(
                    Object.entries(CONFIG.TOKENS).map(async ([symbol, token]) => {
                        const balance: any = await walletProvider.readContract({
                            address: token.address as `0x${string}`,
                            //@ts-ignore
                            abi: ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [address as `0x${string}`]
                        });
                        return {
                            token: symbol,
                            balance: ethers.formatUnits(balance, token.decimals)
                        };
                    })
                );
                return JSON.stringify(balances);
            }

            if (args.action === 'analyze') {
                const marketAnalyses = await Promise.all(
                    Object.entries(CONFIG.MORPHO.markets).map(async ([name, market]) => {
                        const marketParams = await MarketParams.fetch(market.id as any, provider);
                        const marketData = await Market.fetchFromConfig(marketParams, provider);
                        const accruedMarket = marketData.accrueInterest(Time.timestamp());

                        const utilization = wadToPercentage(accruedMarket.utilization);

                        return {
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
                                collateralToken: CONFIG.TOKENS[market.collateralToken as keyof typeof CONFIG.TOKENS].address,
                                loanToken: CONFIG.TOKENS[market.loanToken as keyof typeof CONFIG.TOKENS].address
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
                    })
                );
                return JSON.stringify(marketAnalyses);
            }

            if (!args.strategy || !args.token || !args.amount) {
                throw new Error("strategy, token, and amount are required for supply/withdraw actions");
            }

            const amountBigInt = BigInt(args.amount);
            const iface = new ethers.Interface([
                "function deposit(address _strategy, address[] calldata _tokens, uint256[] calldata _amounts, bytes calldata _additionalData, address _for) external",
                "function withdraw(address _strategy, address[] calldata _tokens, uint256[] calldata _amounts, bytes calldata _additionalData, address _to) external"
            ]);

            const txData = iface.encodeFunctionData(
                args.action === "supply" ? "deposit" : "withdraw",
                [
                    args.strategy,
                    [args.token],
                    [amountBigInt],
                    "0x",
                    await walletProvider.getAddress()
                ]
            );

            const tx = await walletProvider.sendTransaction({
                to: CONFIG.MORPHO.address as `0x${string}`,
                //@ts-ignore
                data: txData,
                value: BigInt(0)
            });

            const receipt = await walletProvider.waitForTransactionReceipt(tx);

            return JSON.stringify({
                success: true,
                action: args.action,
                strategy: args.strategy,
                token: args.token,
                amount: args.amount,
                transactionHash: receipt.transactionHash
            });
        } catch (error: any) {
            console.error('Morpho action failed:', error);
            return JSON.stringify({
                success: false,
                error: error?.message || 'Unknown error occurred'
            });
        }
    }
});
