import { 
    createPublicClient, 
    http, 
    type PublicClient 
  } from 'viem';
  import { base } from 'viem/chains';
  import { YIELD_MANAGER_ABI, ERC20_ABI } from '../contracts/abis';
  import { type SimulationResult, type TransactionRequest } from '../types';
  import { encodeAbiParameters } from 'viem';
  
  // Initialize viem client
  export const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_MAINNET_RPC_URL)
  });
  
  /**
   * Simulates an approval transaction for an ERC20 token.
   */
  export async function simulateApproval(
    client: PublicClient,
    userAddress: `0x${string}`,
    token: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint
  ): Promise<SimulationResult> {
    try {
      // Simulate the approval call
      const simulation = await client.simulateContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
        account: userAddress
      });
  
      return {
        success: true,
        gasEstimate: simulation.request.gas, // estimated gas for the call
        //@ts-ignore
        data: simulation.request.data
      };
    } catch (error: any) {
      console.error('Approval simulation failed:', error);
      return {
        success: false,
        error: error?.message || 'Approval simulation failed'
      };
    }
  }
  
  /**
   * Simulates a strategy interaction (either supply or withdraw).
   */
  export async function simulateStrategy(
    client: PublicClient,
    userAddress: `0x${string}`,
    request: TransactionRequest,
    yieldManagerAddress: `0x${string}`,
    strategyAddress: `0x${string}`
  ): Promise<SimulationResult> {
    try {
      // Prepare additionalData based on the action type.
      let additionalData: `0x${string}`;
      if (request.action === 'withdraw' && request.shares) {
        additionalData = encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'uint256' }],
          [request.marketId as `0x${string}`, request.shares]
        );
      } else {
        additionalData = encodeAbiParameters(
          [{ type: 'bytes32' }],
          [request.marketId as `0x${string}`]
        );
      }
  
      // Simulate the deposit or withdraw call
      const simulation = await client.simulateContract({
        address: yieldManagerAddress,
        abi: YIELD_MANAGER_ABI,
        functionName: request.action === 'supply' ? 'deposit' : 'withdraw',
        args: [
          strategyAddress,
          [request.token],
          [request.amount],
          additionalData,
          userAddress
        ],
        account: userAddress
      });
  
      return {
        success: true,
        gasEstimate: simulation.request.gas,
        // @ts-ignore
        data: simulation.request.data
      };
    } catch (error: any) {
      console.error('Strategy simulation failed:', error);
      return {
        success: false,
        error: error?.message || 'Strategy simulation failed'
      };
    }
  }
  
  /**
   * Estimates gas costs based on the estimated gas and current gas price.
   */
  export async function estimateGasCosts(
    client: PublicClient,
    gasEstimate: bigint
  ): Promise<{ gasCost: bigint; gasPrice: bigint }> {
    const gasPrice = await client.getGasPrice();
    const gasCost = gasEstimate * gasPrice;
    return { gasCost, gasPrice };
  }
  