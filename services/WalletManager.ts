// src/services/WalletManager.ts
import { 
    AgentKit, 
    CdpWalletProvider 
} from "@coinbase/agentkit";
import { Wallet, WalletData } from "@coinbase/coinbase-sdk";
import { TimeoutError } from '@coinbase/coinbase-sdk';
import fs from "fs";

interface StoredWalletData {
    address: string;
    data: WalletData;
}

export class WalletManager {
    private wallets: Map<string, StoredWalletData> = new Map();
    private readonly WALLET_DATA_FILE = "wallet_data.json";

    constructor() {
        this.loadWallets();
    }

    private loadWallets() {
        try {
            if (fs.existsSync(this.WALLET_DATA_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.WALLET_DATA_FILE, 'utf8'));
                this.wallets = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Error loading wallets:', error);
        }
    }

    private saveWallets() {
        try {
            fs.writeFileSync(
                this.WALLET_DATA_FILE,
                JSON.stringify(Object.fromEntries(this.wallets))
            );
        } catch (error) {
            console.error('Error saving wallets:', error);
        }
    }

    async createUserWallet(userId: string): Promise<string> {
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid user ID provided');
        }

        try {
            // Add validation for existing wallet
            const existing = this.wallets.get(userId);
            if (existing) {
                // Verify wallet is still valid
                const provider = await this.getWallet(userId);
                if (provider) {
                    return existing.address;
                }
                // If not valid, remove it
                this.wallets.delete(userId);
            }

            // Create new wallet with CDP
            const wallet = await Wallet.create({
                networkId: "base-mainnet"
            });

            // Export wallet data
            const walletData = await wallet.export();
            
            // Store wallet information
            const storedData: StoredWalletData = {
                address: (await wallet.getDefaultAddress()).toString(),
                data: walletData
            };
            
            this.wallets.set(userId, storedData);
            this.saveWallets();

            return storedData.address;
        } catch (error) {
            // Improved error handling
            if (error instanceof TimeoutError) {
                throw new Error(`Wallet creation timed out for user ${userId}`);
            }
            throw error;
        }
    }

    async getWallet(userId: string): Promise<CdpWalletProvider | null> {
        const storedData = this.wallets.get(userId);
        if (!storedData) return null;

        try {
            return await CdpWalletProvider.configureWithWallet({
                apiKeyName: process.env.CDP_API_KEY_NAME!,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                networkId: "base-mainnet",
                cdpWalletData: JSON.stringify(storedData.data)
            });
        } catch (error) {
            console.error('Error configuring wallet provider:', error);
            return null;
        }
    }

    getAllWallets(): [string, StoredWalletData][] {
        return Array.from(this.wallets.entries());
    }

    async getWalletByAddress(address: string): Promise<[string, CdpWalletProvider] | null> {
        for (const [userId, walletData] of this.wallets.entries()) {
            if (walletData.address.toLowerCase() === address.toLowerCase()) {
                const provider = await this.getWallet(userId);
                if (provider) {
                    return [userId, provider];
                }
            }
        }
        return null;
    }
}