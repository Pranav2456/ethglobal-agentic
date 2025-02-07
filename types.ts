// src/types.ts
import { WalletData } from "@coinbase/coinbase-sdk";
import { type Address } from 'viem';

export enum Protocol {
    MORPHO = 'morpho',
    AAVE = 'aave'
}

export enum AlertType {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface StoredWalletData {
    userId: string;
    address: string;
    data: WalletData;
}

export interface MarketData {
    protocol: Protocol;
    name: string;
    marketId: string;
    apy: {
        supply: number;
        borrow: number;
        rewards?: number;
    };
    metrics: {
        utilization: number;
        totalSupply: string;
        totalBorrow: string;
        liquidity: string;
        lltv: number;
    };
    tokens: {
        collateral: Address;
        loan: Address;
    };
    risk: {
        healthFactor?: number;
        isHealthy: boolean;
        utilizationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
}

export interface SimulationResult {
    success: boolean;
    gasEstimate?: bigint;
    data?: `0x${string}`;
    error?: string;
}

export interface TransactionRequest {
    protocol: Protocol;
    action: 'supply' | 'withdraw';
    marketId: string;
    token: Address;
    amount: bigint;
    shares?: bigint;
}

export interface Position {
    protocol: Protocol;
    marketId: string;
    token: string;
    supplyAmount: string;
    borrowAmount: string;
    healthFactor: number;
    collateralEnabled: boolean;
    metrics: {
        supplyAPY: number;
        borrowAPY: number;
        rewardsAPY?: number;
    };
}

export interface PortfolioStatus {
    totalSupplyUSD: string;
    totalBorrowUSD: string;
    healthFactor: number;
    netAPY: number;
    positions: Position[];
}

export interface ProtocolPosition {
    protocol: Protocol;
    marketId: string;
    position: Position;
    healthFactor: number;
}

export interface OptimizationResult {
    userId: string;
    currentPosition?: ProtocolPosition;
    suggestedMarket?: MarketData;
    potentialApy: number;
    gasCost: string;
    isProfit: boolean;
}

export interface WalletStatus {
    needsAttention: boolean;
    alertType: AlertType;
    message: string;
    portfolio?: PortfolioStatus;
}

export interface DepositStatus {
    hasNewDeposit: boolean;
    amount: string;
    token?: string;
}

export interface MultiProtocolAnalysis {
    timestamp: string;
    protocol: Protocol;
    markets: MarketData[];
    totalValueLocked?: string;
    totalBorrowed?: string;
}