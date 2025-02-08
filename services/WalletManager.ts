// src/services/WalletManager.ts
import { 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { 
    Wallet, 
    WalletData,
    TimeoutError
} from "@coinbase/coinbase-sdk";
import { CONFIG } from "../config";
import { StoredWalletData } from "../types";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";

export class WalletManager extends EventEmitter {
    private wallets: Map<string, StoredWalletData> = new Map();
    private readonly WALLET_DIR = "data";
    private readonly WALLET_FILE = "wallets.json";

    constructor() {
        super();
        this.initializeStorage();
        this.loadWallets();
    }

    private initializeStorage() {
        try {
            if (!fs.existsSync(this.WALLET_DIR)) {
                fs.mkdirSync(this.WALLET_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('Error initializing storage:', error);
            throw new Error('Failed to initialize wallet storage');
        }
    }

    private get walletPath() {
        return path.join(this.WALLET_DIR, this.WALLET_FILE);
    }

    private loadWallets() {
        try {
            if (fs.existsSync(this.walletPath)) {
                const data = JSON.parse(fs.readFileSync(this.walletPath, 'utf8'));
                this.wallets = new Map(Object.entries(data));
                this.emit('walletsLoaded', this.wallets.size);
            }
        } catch (error) {
            console.error('Error loading wallets:', error);
            if (fs.existsSync(this.walletPath)) {
                const backup = `${this.walletPath}.backup.${Date.now()}`;
                fs.copyFileSync(this.walletPath, backup);
                this.emit('backupCreated', backup);
            }
        }
    }

    private async saveWallets() {
        try {
            const tempFile = `${this.walletPath}.temp`;
            const data = Object.fromEntries(this.wallets);
            
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
            fs.renameSync(tempFile, this.walletPath);
            
            this.emit('walletsSaved', this.wallets.size);
        } catch (error) {
            console.error('Error saving wallets:', error);
            this.emit('error', { type: 'saveFailed', error });
            throw error;
        }
    }

    async createWallet(): Promise<{ userId: string; address: string }> {
        try {
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create CDP wallet provider for initial setup
            const provider = await CdpWalletProvider.configureWithWallet({
                apiKeyName: process.env.CDP_API_KEY_NAME!,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
                networkId: CONFIG.NETWORK.id,
            });

            // Get wallet address and export data
            const address = await provider.getAddress();
            const exportedData = await provider.exportWallet();

            // Store wallet data
            const walletData: StoredWalletData = {
                userId,
                address,
                data: {
                    walletId: userId,
                    networkId: CONFIG.NETWORK.id,
                    exportedData
                }
            };

            this.wallets.set(userId, walletData);
            await this.saveWallets();

            this.emit('walletCreated', { userId, address });
            return { userId, address };
        } catch (error) {
            console.error('Error creating wallet:', error);
            this.emit('error', { type: 'creation', error });
            throw error;
        }
    }

    async getWallet(userId: string): Promise<CdpWalletProvider | null> {
        try {
            const storedData = this.wallets.get(userId);
            if (!storedData) {
                throw new Error('Wallet not found');
            }

            // Create provider with stored data
            const provider = await CdpWalletProvider.configureWithWallet({
                apiKeyName: process.env.CDP_API_KEY_NAME!,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
                networkId: storedData.data.networkId,
                cdpWalletData: JSON.stringify(storedData.data.exportedData)
            });

            // Verify provider
            const address = await provider.getAddress();
            if (address.toLowerCase() !== storedData.address.toLowerCase()) {
                throw new Error('Wallet address mismatch');
            }

            return provider;
        } catch (error) {
            console.error('Error getting wallet:', error);
            this.emit('error', { type: 'provider', userId, error });
            return null;
        }
    }

    getAllWallets(): Map<string, StoredWalletData> {
        return new Map(this.wallets);
    }

    async stop() {
        // Cleanup if needed
    }
}