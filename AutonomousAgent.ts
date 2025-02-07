import {
  AgentKit,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  CdpWalletProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { WalletManager } from "./services/WalletManager";
import { morphoProvider } from "./actions/morphoProvider";
import { CONFIG } from "./config";
import { WalletStatus, DepositStatus, MarketAnalysis, OptimizationResult } from "./agent.types"
import EventEmitter from "events";

export class AutonomousAgent extends EventEmitter {
  private walletManager: WalletManager;
  private agentKit: AgentKit | null = null;
  private agent: any;
  private isRunning: boolean = false;
  private currentThread: string | null = null;
  private memory: MemorySaver;
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private depositMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastKnownBalances: Map<string, string> = new Map();
  private marketCache: Map<string, { data: MarketAnalysis; timestamp: number }> = new Map();
  private readonly MARKET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
      super();
      this.walletManager = new WalletManager();
      this.memory = new MemorySaver();
  }

  async initialize() {
      try {
          const llm = new ChatOpenAI({
              modelName: "gpt-4-turbo-preview",
              temperature: 0.7,
          });

          // Initialize CDP Wallet Provider
          const provider = await CdpWalletProvider.configureWithWallet({
              apiKeyName: process.env.CDP_API_KEY_NAME!,
              apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
              networkId: CONFIG.NETWORK.id,
          });

          // Initialize AgentKit with all providers
          this.agentKit = await AgentKit.from({
              walletProvider: provider,
              actionProviders: [
                  walletActionProvider(),
                  erc20ActionProvider(),
                  cdpApiActionProvider({
                      apiKeyName: process.env.CDP_API_KEY_NAME!,
                      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
                  }),
                  morphoProvider,
              ],
          });

          const tools = await getLangChainTools(this.agentKit);

          this.agent = createReactAgent({
              llm,
              tools,
              checkpointSaver: this.memory,
              messageModifier: this.getAgentPrompt(),
          });

          this.isRunning = true;
          await this.startMonitoring();
          await this.startOptimization();
          
          this.emit('initialized');
          return true;
      } catch (error) {
          console.error("Failed to initialize agent:", error);
          this.emit('error', error);
          return false;
      }
  }

  private getAgentPrompt(): string {
      return `You are a helpful DeFi assistant specializing in yield optimization on Morpho markets.
      Your goal is to help users maximize their returns while maintaining safety.
      
      When talking to users:
      - Be conversational and natural
      - Understand implicit intentions
      - Guide users through processes step by step
      - Proactively monitor and suggest improvements
      - Always consider risk and gas costs
      
      Core capabilities:
      1. Wallet Management
      - Help users set up and manage wallets
      - Guide through deposit process
      - Monitor balances and positions
      
      2. Market Analysis
      - Analyze Morpho markets for best yields
      - Consider risk factors (utilization, health factor)
      - Calculate potential returns including gas costs
      
      3. Strategy Optimization
      - Automatically suggest better positions
      - Consider minimum APY difference (0.5%)
      - Factor in gas costs vs returns
      
      4. Risk Management
      - Monitor market health
      - Track position health factors
      - Alert users to potential risks
      
      Remember to be helpful and natural in conversation while maintaining professionalism.`;
  }

  async processUserMessage(message: string): Promise<string> {
      if (!this.isRunning || !this.agent) {
          return "I'm still initializing. Please try again in a moment.";
      }

      try {
          if (!this.currentThread) {
              this.currentThread = Date.now().toString();
          }

          const config = {
              configurable: {
                  thread_id: this.currentThread
              }
          };

          const stream = await this.agent.stream(
              {
                  messages: [
                      new SystemMessage("Remember to maintain a natural, helpful conversation."),
                      new HumanMessage(message)
                  ]
              },
              config
          );

          const response = await this.processAgentStream(stream);
          await this.handleImplicitActions(message, response);
          return response;

      } catch (error: any) {
          console.error("Error processing message:", error);
          return "I apologize, but I encountered an error. Could you please rephrase your request?";
      }
  }

  private async processAgentStream(stream: AsyncIterable<any>): Promise<string> {
      let response = "";
      try {
          for await (const chunk of stream) {
              if ("agent" in chunk) {
                  response += chunk.agent.messages[0].content + "\n";
              } else if ("tools" in chunk) {
                  response += chunk.tools.messages[0].content + "\n";
              }
          }
          return response.trim();
      } catch (error) {
          console.error("Error processing stream:", error);
          throw error;
      }
  }

  private async handleImplicitActions(userMessage: string, agentResponse: string) {
      try {
          const intent = await this.agent.invoke(
              `Analyze this message and identify the user's intent: ${userMessage}`
          );

          if (intent.includes('create_wallet') && !this.currentThread) {
              const wallet = await this.walletManager.createWallet();
              this.currentThread = wallet.userId;
              this.emit('walletCreated', wallet);
          }

          if (intent.includes('deposit')) {
              await this.startDepositMonitoring(this.currentThread!);
          }

          if (intent.includes('analyze_markets')) {
              const analysis = await this.analyzeMarkets();
              this.emit('marketAnalysis', analysis);
          }

          if (intent.includes('check_position') || intent.includes('balance')) {
              const status = await this.checkWalletStatus(this.currentThread!);
              this.emit('walletStatus', status);
          }
      } catch (error) {
          console.error("Error handling implicit actions:", error);
      }
  }

  private async startMonitoring() {
      // Clear any existing intervals
      if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
      }

      this.monitoringInterval = setInterval(
          async () => {
              try {
                  await this.monitorWallets();
              } catch (error) {
                  console.error("Error in monitoring cycle:", error);
              }
          },
          5 * 60 * 1000
      );
  }

  private async startOptimization() {
      if (this.optimizationInterval) {
          clearInterval(this.optimizationInterval);
      }

      this.optimizationInterval = setInterval(
          async () => {
              try {
                  await this.optimizePositions();
              } catch (error) {
                  console.error("Error in optimization cycle:", error);
              }
          },
          10 * 60 * 1000
      );
  }

  private async startDepositMonitoring(userId: string) {
      // Clear existing monitoring for this user
      if (this.depositMonitoringIntervals.has(userId)) {
          clearInterval(this.depositMonitoringIntervals.get(userId));
      }

      const interval = setInterval(async () => {
          try {
              const status = await this.checkDepositStatus(userId);
              if (status.hasNewDeposit) {
                  clearInterval(interval);
                  this.depositMonitoringIntervals.delete(userId);
                  this.emit('depositDetected', {
                      userId,
                      amount: status.amount,
                      token: status.token
                  });
                  
                  // Start optimization for the new deposit
                  await this.optimizePositions([userId]);
              }
          } catch (error) {
              console.error("Error checking deposits:", error);
          }
      }, 30000); // Check every 30 seconds

      this.depositMonitoringIntervals.set(userId, interval);
  }

  private async monitorWallets() {
      if (!this.isRunning) return;

      try {
          const wallets = this.walletManager.getAllWallets();
          for (const [userId, wallet] of wallets) {
              const status = await this.checkWalletStatus(userId);
              if (status.needsAttention) {
                  this.emit('alert', {
                      userId,
                      type: status.alertType,
                      message: status.message
                  });
              }
          }
      } catch (error) {
          console.error("Error in wallet monitoring:", error);
          this.emit('error', {
              type: 'monitoring',
              error
          });
      }
  }

  private async checkWalletStatus(userId: string): Promise<WalletStatus> {
      try {
          const wallet = await this.walletManager.getWallet(userId);
          if (!wallet) {
              return {
                  needsAttention: true,
                  alertType: 'error',
                  message: 'Wallet not found'
              };
          }

          const position = await this.agent.invoke("check_position", { userId });
          const status: WalletStatus = {
              needsAttention: false,
              alertType: 'info',
              message: 'Wallet healthy',
              position: position
          };

          // Check health factor
          if (position && position.healthFactor < 1.05) {
              status.needsAttention = true;
              status.alertType = 'warning';
              status.message = `Low health factor: ${position.healthFactor}`;
          }

          return status;
      } catch (error) {
          console.error("Error checking wallet status:", error);
          return {
              needsAttention: true,
              alertType: 'error',
              message: 'Error checking wallet status'
          };
      }
  }

  private async checkDepositStatus(userId: string): Promise<DepositStatus> {
      try {
          const wallet = await this.walletManager.getWallet(userId);
          if (!wallet) throw new Error("Wallet not found");

          const balance = await this.agent.invoke("get_balance", { userId });
          const previousBalance = this.lastKnownBalances.get(userId) || '0';

          if (BigInt(balance) > BigInt(previousBalance)) {
              this.lastKnownBalances.set(userId, balance);
              return {
                  hasNewDeposit: true,
                  amount: (BigInt(balance) - BigInt(previousBalance)).toString(),
                  token: 'USDC' // Assuming USDC for now
              };
          }

          return {
              hasNewDeposit: false,
              amount: '0'
          };
      } catch (error) {
          console.error("Error checking deposit status:", error);
          return {
              hasNewDeposit: false,
              amount: '0'
          };
      }
  }

  private async analyzeMarkets(): Promise<MarketAnalysis[]> {
      try {
          // Check cache first
          const now = Date.now();
          const cachedAnalysis = Array.from(this.marketCache.values())
              .filter(entry => (now - entry.timestamp) < this.MARKET_CACHE_TTL)
              .map(entry => entry.data);

          if (cachedAnalysis.length > 0) {
              return cachedAnalysis;
          }

          // If no cache, fetch new data
          const markets = await this.agent.invoke("analyze_markets");
          
          // Update cache
          markets.forEach((market: MarketAnalysis) => {
              this.marketCache.set(market.marketId, {
                  data: market,
                  timestamp: now
              });
          });

          return markets;
      } catch (error) {
          console.error("Error analyzing markets:", error);
          throw error;
      }
  }

  private async optimizePositions(specificUsers?: string[]) {
      try {
          const wallets = this.walletManager.getAllWallets();
          const usersToCheck = specificUsers || Array.from(wallets.keys());

          for (const userId of usersToCheck) {
              const result = await this.optimizeUserPosition(userId.toString());
              if (result.isProfit) {
                  this.emit('optimizationFound', result);
              }
          }
      } catch (error) {
          console.error("Error in optimization:", error);
      }
  }

  private async optimizeUserPosition(userId: string): Promise<OptimizationResult> {
    try {
        const currentPosition = await this.agent.invoke("check_position", { userId });
        if (!currentPosition || !currentPosition.position) {
            return {
                userId,
                isProfit: false,
                potentialApy: 0,
                gasCost: '0'
            };
        }

        // Get all market data
        const markets = await this.analyzeMarkets();
        
        // Find current market data
        const currentMarket = markets.find(m => m.marketId === currentPosition.position.marketId);
        if (!currentMarket) {
            throw new Error('Current market not found');
        }

        // Find best market
        const bestMarket = markets.reduce((best, market) => {
            if (market.marketId === currentMarket.marketId) return best;
            if (!market.isHealthy || market.riskLevel === 'HIGH') return best;
            if (market.apy <= best.apy) return best;
            return market;
        }, currentMarket);

        // Calculate potential profit
        const apyDifference = bestMarket.apy - currentMarket.apy;
        if (apyDifference < CONFIG.YIELD_MANAGER.minimumAPYDifference) {
            return {
                userId,
                currentMarket: currentMarket.marketId,
                suggestedMarket: bestMarket.marketId,
                potentialApy: apyDifference,
                isProfit: false,
                gasCost: '0'
            };
        }

        // Simulate rebalancing to calculate gas costs
        const simulation = await this.agent.invoke("simulate_rebalance", {
            userId,
            currentMarketId: currentPosition.position.marketId,
            suggestedMarketId: bestMarket.marketId,
            supplyAmount: currentPosition.position.supplyAmount
        });

        // Calculate if profitable considering gas costs
        const positionValue = BigInt(currentPosition.position.supplyAmount);
        const yearlyProfit = (positionValue * BigInt(Math.floor(apyDifference * 100))) / BigInt(10000);
        const monthlyProfit = yearlyProfit / BigInt(12);
        const gasCostBigInt = BigInt(simulation.gasCost || 0);

        const isProfitable = monthlyProfit > gasCostBigInt * BigInt(3); // 3-month payback period

        return {
            userId,
            currentMarket: currentMarket.marketId,
            suggestedMarket: bestMarket.marketId,
            potentialApy: apyDifference,
            isProfit: isProfitable,
            gasCost: simulation.gasCost
        };
    } catch (error) {
        console.error('Error optimizing position:', error);
        return {
            userId,
            isProfit: false,
            potentialApy: 0,
            gasCost: '0'
        };
    }
}

private async executeOptimization(optimization: OptimizationResult) {
    if (!optimization.isProfit || !optimization.currentMarket || !optimization.suggestedMarket) {
        return false;
    }

    try {
        // Get current position
        const position = await this.agent.invoke("check_position", { userId: optimization.userId });
        if (!position || !position.position) {
            throw new Error('Position not found');
        }

        // Execute withdrawal
        const withdrawResult = await this.agent.invoke("execute_withdraw", {
            userId: optimization.userId,
            marketId: optimization.currentMarket,
            amount: position.position.supplyAmount
        });

        if (!withdrawResult.success) {
            throw new Error('Withdrawal failed: ' + withdrawResult.error);
        }

        // Execute supply to new market
        const supplyResult = await this.agent.invoke("execute_supply", {
            userId: optimization.userId,
            marketId: optimization.suggestedMarket,
            amount: position.position.supplyAmount
        });

        if (!supplyResult.success) {
            throw new Error('Supply failed: ' + supplyResult.error);
        }

        this.emit('optimizationExecuted', {
            userId: optimization.userId,
            from: optimization.currentMarket,
            to: optimization.suggestedMarket,
            amount: position.position.supplyAmount,
            apyImprovement: optimization.potentialApy
        });

        return true;
    } catch (error) {
        console.error('Error executing optimization:', error);
        this.emit('error', {
            type: 'optimization',
            userId: optimization.userId,
            error
        });
        return false;
    }
}

async start() {
    try {
        const initialized = await this.initialize();
        if (!initialized) {
            throw new Error("Failed to initialize agent");
        }

        this.emit('started');
        return true;
    } catch (error) {
        console.error("Error starting agent:", error);
        this.emit('error', { type: 'startup', error });
        return false;
    }
}

async stop() {
    try {
        this.isRunning = false;

        // Clear all intervals
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
        }
        for (const interval of this.depositMonitoringIntervals.values()) {
            clearInterval(interval);
        }
        this.depositMonitoringIntervals.clear();

        // Clear caches
        this.marketCache.clear();
        this.lastKnownBalances.clear();

        // Stop wallet manager
        await this.walletManager.stop();

        this.emit('stopped');
        return true;
    } catch (error) {
        console.error("Error stopping agent:", error);
        this.emit('error', { type: 'shutdown', error });
        return false;
    }
}
}