import { CdpWalletProvider } from "@coinbase/agentkit";
import { CONFIG } from "../config";
import * as fs from "fs";

const WALLET_DATA_FILE = "wallet_data.txt";

export class WalletManager {
  private wallet: CdpWalletProvider | null = null;

  // Create (and store) wallet using AgentKit's CDP wallet provider.
  async createWallet(): Promise<{ address: string }> {
    let walletDataStr: string | null = null;
    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
      }
    }
    
    this.wallet = await CdpWalletProvider.configureWithWallet({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: CONFIG.NETWORK.id
    });
    
    const address = await this.wallet.getAddress();
  
    // Persist wallet data if not already available
    if (!walletDataStr) {
      try {
        const exportedData = await this.wallet.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedData));
        console.log("Wallet data persisted to", WALLET_DATA_FILE);
      } catch (error) {
        console.error("Error saving wallet data:", error);
      }
    }
  
    return { address };
  }
  
  // Return the stored wallet. If it doesn’t exist, throw an error.
  async getWallet(): Promise<CdpWalletProvider> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    return this.wallet;
  }

  async stop() {
    // Cleanup if necessary
  }
}
