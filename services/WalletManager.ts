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
    private backupInterval?: NodeJS.Timeout;

    constructor() {
        super();
        this.initializeStorage();
        this.loadWallets();
        this.startBackups();
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
            // Create backup of corrupted file
            if (fs.existsSync(this.walletPath)) {
                const backup = `${this.walletPath}.backup.${Date.now()}`;
                fs.copyFileSync(this.walletPath, backup);
                this.emit('backupCreated', backup);
            }
        }
    }

    private saveWallets() {
        try {
            const tempFile = `${this.walletPath}.temp`;
            const data = Object.fromEntries(this.wallets);
            
            // Write to temporary file first
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
            
            // Rename temp file to actual file (atomic operation)
            fs.renameSync(tempFile, this.walletPath);
            
            this.emit('walletsSaved', this.wallets.size);
        } catch (error) {
            console.error('Error saving wallets:', error);
            this.emit('error', { type: 'saveFailed', error });
            throw error;
        }
    }

    private startBackups() {
        // Create periodic backups
        this.backupInterval = setInterval(() => {
            const backup = `${this.walletPath}.backup.${Date.now()}`;
            try {
                if (fs.existsSync(this.walletPath)) {
                    fs.copyFileSync(this.walletPath, backup);
                    this.emit('backupCreated', backup);
                }
            } catch (error) {
                console.error('Backup creation failed:', error);
                this.emit('error', { type: 'backupFailed', error });
            }
        }, 24 * 60 * 60 * 1000); // Daily backups
    }

    async createWallet(): Promise<{ userId: string; address: string }> {
        try {
            // Create a unique user ID
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create CDP wallet
            const provider = await CdpWalletProvider.configureWithWallet({
                apiKeyName: process.env.CDP_API_KEY_NAME!,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
                networkId: CONFIG.NETWORK.id,
            });

            // Get wallet address
            const address = await provider.getAddress();

            // Store wallet data
            const walletData: StoredWalletData = {
                userId,
                address,
                data: {
                    walletId: userId,
                    networkId: CONFIG.NETWORK.id,
                    seed: await this.generateSecureSeed()
                }
            };

            this.wallets.set(userId, walletData);
            await this.saveWallets();

            this.emit('walletCreated', { userId, address });
            return { userId, address };
        } catch (error) {
            if (error instanceof TimeoutError) {
                this.emit('error', { type: 'timeout', error });
                throw new Error('Wallet creation timed out. Please try again.');
            }
            // Generic error handling
            this.emit('error', { type: 'creation', error });
            throw error;
        }
    }

    private async generateSecureSeed(): Promise<string> {
        // Generate secure random bytes for wallet seed
        const crypto = await import('crypto');
        return crypto.randomBytes(32).toString('hex');
    }

    async getWallet(userId: string): Promise<CdpWalletProvider | null> {
        const storedData = this.wallets.get(userId);
        if (!storedData) return null;

        try {
            // Create provider with stored data
            const provider = await CdpWalletProvider.configureWithWallet({
                apiKeyName: process.env.CDP_API_KEY_NAME!,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
                networkId: storedData.data.networkId,
                cdpWalletData: JSON.stringify(storedData.data)
            });

            // Verify provider is working
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

    async getWalletByAddress(address: string): Promise<{ userId: string; provider: CdpWalletProvider } | null> {
        for (const [userId, walletData] of this.wallets.entries()) {
            if (walletData.address.toLowerCase() === address.toLowerCase()) {
                const provider = await this.getWallet(userId);
                if (provider) {
                    return { userId, provider };
                }
            }
        }
        return null;
    }

    async validateWallet(userId: string): Promise<boolean> {
        try {
            const provider = await this.getWallet(userId);
            if (!provider) return false;

            // Check provider functionality
            const address = await provider.getAddress();

            return !!address;
        } catch {
            return false;
        }
    }

    getAllWallets(): [string, StoredWalletData][] {
        return Array.from(this.wallets.entries());
    }

    async deleteWallet(userId: string): Promise<boolean> {
        const wallet = this.wallets.get(userId);
        if (!wallet) return false;

        this.wallets.delete(userId);
        await this.saveWallets();
        this.emit('walletDeleted', userId);
        return true;
    }

    stop() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }
    }
}