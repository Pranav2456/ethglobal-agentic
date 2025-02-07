// src/types/agent.types.ts
export interface WalletStatus {
    needsAttention: boolean;
    alertType: 'info' | 'warning' | 'error';
    message: string;
    balance?: string;
    position?: {
        marketId: string;
        supplyAmount: string;
        healthFactor: number;
    };
}

export interface DepositStatus {
    hasNewDeposit: boolean;
    amount: string;
    token?: string;
}

export interface MarketAnalysis {
    marketId: string;
    apy: number;
    utilization: number;
    liquidity: string;
    isHealthy: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OptimizationResult {
    userId: string;
    currentMarket?: string;
    suggestedMarket?: string;
    potentialApy: number;
    gasCost: string;
    isProfit: boolean;
}