// src/types.ts
import { WalletData } from "@coinbase/coinbase-sdk";
import { type Address } from 'viem';

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

export interface SimulationResult {
    success: boolean;
    gasEstimate?: bigint;
    data?: `0x${string}`;
    error?: string;
}

export interface TransactionRequest {
    action: 'supply' | 'withdraw';
    marketId: string;
    token: Address;
    amount: bigint;
    shares?: bigint;
}

export interface StrategySimulation {
    approval?: SimulationResult;
    transaction: SimulationResult;
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
        collateralToken: Address;
        loanToken: Address;
    };
    riskMetrics: RiskMetrics;
}