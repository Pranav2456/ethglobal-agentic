// src/types.ts
import { WalletData } from "@coinbase/coinbase-sdk";

export interface StoredWalletData {
    userId: string;
    address: string;
    data: WalletData;
}

export interface MarketAnalysis {
    name: string;
    marketId: string;
    supplyAPY: number;
    borrowAPY: number;
    utilization: number;
    liquidity: string;
    totalSupplyAssets: string;
    totalBorrowAssets: string;
    isHealthy: boolean;
    lltv: number;
}

export interface TransactionResult {
    success: boolean;
    action?: string;
    marketId?: string;
    amount?: string;
    transactionHash?: string;
    error?: string;
}

export interface RiskMetrics {
    isHealthy: boolean;
    utilizationRisk: {
      current: number;
      status: 'HIGH' | 'MEDIUM' | 'LOW';
    }
}
  
export interface MarketResult {
    timestamp: string;
    market: string;
    data: {
      supplyAPY: number;
      borrowAPY: number;
      utilization: number;
      totalSupplyAssets: string;
      totalBorrowAssets: string;
      liquidity: string;
      lltv: number;
      collateralToken: string;
      loanToken: string;
    };
    riskMetrics: RiskMetrics;
}