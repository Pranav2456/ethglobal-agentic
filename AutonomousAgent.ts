import {
  AgentKit,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  CdpWalletProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { WalletManager } from "./services/WalletManager";
import { morphoActionProvider } from "./actions/morphoProvider";
import { CONFIG } from "./config";
import readline from "readline";

export class AutonomousAgent {
  private walletManager: WalletManager;
  private agentKit: AgentKit | null;
  private agent: any;
  private isRunning: boolean;
  private rl: readline.Interface;

  constructor() {
    this.walletManager = new WalletManager();
    this.agentKit = null;
    this.isRunning = false;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async initialize() {
    try {
      // Initialize base CDP wallet provider
      const walletProvider = await CdpWalletProvider.configureWithWallet({
        apiKeyName: process.env.CDP_API_KEY_NAME!,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(
          /\\n/g,
          "\n"
        ),
        networkId: "base-mainnet",
      });

      // Initialize AgentKit with all required providers
      this.agentKit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          walletActionProvider(),
          erc20ActionProvider(),
          cdpApiActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME!,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(
              /\\n/g,
              "\n"
            ),
          }),
          morphoActionProvider,
        ],
      });

      // Initialize LangChain agent
      const llm = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 1500,
      });

      const tools = await getLangChainTools(this.agentKit);
      const memory = new MemorySaver();

      this.agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: `
                    You are a yield optimization agent for Morpho markets on Base.
                    
                    Available Commands:
                    1. Wallet Management:
                        - create wallet: Create a new agent wallet
                        - deposit: Get instructions for depositing funds
                        - withdraw [amount]: Withdraw funds from your wallet
                        - balance: Check your wallet balance
                    
                    2. Market Analysis:
                        - analyze markets: Show current yields and risks
                        - analyze position: Check your current position
                    
                    3. Settings:
                        - help: Show available commands
                        - status: Check agent status
                        - exit: Exit the application

                    For automated optimization:
                    1. Market Analysis:
                        - Check all supported Morpho markets
                        - Compare supply APYs
                        - Verify market health metrics

                    2. Risk Assessment:
                        - Verify market liquidity (minimum 100k)
                        - Check utilization rates (avoid > 80%)
                        - Consider gas costs vs returns

                    3. Strategy Execution:
                        - Only execute if new APY > current APY + 0.5%
                        - Ensure gas costs < 5% of expected returns
                        - Verify transaction success

                    Never execute if:
                    - Market health is questionable
                    - Utilization rate > 80%
                    - Gas costs too high
                    - Insufficient liquidity
                `,
      });

      this.isRunning = true;
      console.log("Agent initialized successfully");
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      this.isRunning = false;
      throw error;
    }
  }

  async handleUserCommand(command: string, userId?: string): Promise<string> {
    try {
        const lowerCommand = command.toLowerCase();

        if (lowerCommand === "help") {
            return this.getHelpMessage();
        }

        if (lowerCommand === "create wallet") {
            const newUserId = Date.now().toString();
            const address = await this.createUserWallet(newUserId);
            return `Created new wallet with address: ${address}\nYour user ID is: ${newUserId}\nPlease save this ID for future operations.`;
        }

        if (!userId && !["help", "create wallet"].includes(lowerCommand)) {
            return "Please provide your user ID or create a new wallet first.";
        }

        // Add configuration object with thread_id
        const agentConfig = {
            configurable: {
                thread_id: userId || 'default-thread'
            }
        };

        if (lowerCommand === "analyze markets") {
            const stream = await this.agent.stream(
                {
                    messages: [
                        new HumanMessage(
                            "Analyze all Morpho markets and show current yields and risks"
                        ),
                    ],
                },
                agentConfig  // Add the config here
            );
            return this.processAgentStream(stream);
        }

        // Process other commands through agent
        return this.processAgentStream(
            await this.agent.stream(
                {
                    messages: [new HumanMessage(`${command} for user ${userId}`)],
                },
                agentConfig  // Add the config here
            )
        );
    } catch (error: any) {
        console.error("Error handling command:", error);
        return `Error: ${error.message}`;
    }
}

  private async processAgentStream(stream: any): Promise<string> {
    let response = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content + "\n";
      } else if ("tools" in chunk) {
        response += chunk.tools.messages[0].content + "\n";
      }
    }
    return response;
  }

  private getHelpMessage(): string {
    return `
Available Commands:
- create wallet : Create a new agent wallet
- deposit : Get deposit instructions
- withdraw [amount] : Withdraw funds
- balance : Check wallet balance
- analyze markets : Show market analysis
- analyze position : Check your position
- help : Show this message
- exit : Exit application
        `;
  }

  async createUserWallet(userId: string): Promise<string> {
    if (!this.agentKit) {
      throw new Error("AgentKit not initialized");
    }
    return await this.walletManager.createUserWallet(userId);
  }

  async checkAndOptimize() {
    if (!this.isRunning || !this.agentKit) {
        console.error("Agent not running or not initialized");
        return;
    }

    try {
        const wallets = this.walletManager.getAllWallets();
        console.log(`Checking ${wallets.length} wallets for optimization`);

        for (const [userId, walletData] of wallets) {
            const walletProvider = await this.walletManager.getWallet(userId);
            if (!walletProvider) {
                console.error(`Failed to get wallet provider for user ${userId}`);
                continue;
            }

            console.log(`Analyzing markets for wallet ${walletData.address}`);

            // Add configuration object with thread_id
            const stream = await this.agent.stream(
                {
                    messages: [
                        new HumanMessage(`
                            Analyze Morpho markets for wallet ${walletData.address}:
                            1. Get current position and APY
                            2. Compare with all market APYs
                            3. Calculate potential gains after gas
                            4. Execute if profitable
                            Current timestamp: ${Date.now()}
                        `),
                    ],
                },
                {
                    configurable: {
                        thread_id: `${userId}-${Date.now()}`
                    }
                }
            );

            for await (const chunk of stream) {
                if ("tools" in chunk) {
                    console.log(`Action for wallet ${walletData.address}:`, {
                        timestamp: new Date().toISOString(),
                        action: chunk.tools.messages[0].content,
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error in optimization cycle:", error);
    }
}
  private automatedCheckInterval: NodeJS.Timeout | null = null;

  async start() {
    try {
      await this.initialize();

      if (!this.isRunning) {
        throw new Error("Agent failed to initialize");
      }

      console.log("\nWelcome to Morpho Yield Maximizer!");
      console.log('Type "help" to see available commands');

      // Start autonomous checking
      this.automatedCheckInterval = setInterval(async () => {
        if (this.isRunning && this.walletManager.getAllWallets().length > 0) {
          console.log("\nRunning automated yield check...");
          await this.checkAndOptimize();
        }
      }, CONFIG.YIELD_MANAGER.checkInterval);

      // Interactive mode
      while (this.isRunning) {
        const input = await new Promise<string>((resolve) =>
          this.rl.question('\nEnter command (or "help"): ', resolve)
        );

        if (input.toLowerCase() === "exit") {
          break;
        }

        let userId = await new Promise<string>((resolve) =>
          this.rl.question(
            "Enter your user ID (or press enter if creating new wallet): ",
            resolve
          )
        );

        const response = await this.handleUserCommand(
          input,
          userId || undefined
        );
        console.log(response);
      }

      this.stop();
    } catch (error) {
      console.error("Fatal error starting agent:", error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.automatedCheckInterval) {
      clearInterval(this.automatedCheckInterval);
      this.automatedCheckInterval = null;
    }
    this.rl.close();
    console.log("Agent stopped");
  }
}
