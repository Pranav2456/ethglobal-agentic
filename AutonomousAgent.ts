// src/AutonomousAgent.ts
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
import { aaveProvider } from "./actions/aaveProvider";
import { CONFIG } from "./config";
import {
  Protocol,
  MarketData,
  Position,
  WalletStatus,
  OptimizationResult,
  AlertType,
  MultiProtocolAnalysis,
} from "./types";
import EventEmitter from "events";

export class AutonomousAgent extends EventEmitter {
  private walletManager: WalletManager;
  private agentKit: AgentKit | null = null;
  private agent: any;
  private agentConfig: any;
  private isRunning: boolean = false;
  private memory: MemorySaver;
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private marketCache = new Map<string, any>();
  private readonly THREAD_ID: string = Date.now().toString();

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

      // Attempt to load the wallet; if not present, create one.
      let wallet = await this.walletManager.getWallet().catch(() => null);
      if (!wallet) {
        const created = await this.walletManager.createWallet();
        console.log("Wallet created:", created.address);
        wallet = await this.walletManager.getWallet();
      }

      this.agentKit = await AgentKit.from({
        walletProvider: wallet,
        actionProviders: [
          walletActionProvider(),
          erc20ActionProvider(),
          cdpApiActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME!,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
          morphoProvider,
          aaveProvider,
        ],
      });

      const tools = await getLangChainTools(this.agentKit);
      this.agentConfig = {
        configurable: {
          thread_id: this.THREAD_ID,
        },
      };

      this.agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: this.memory,
        messageModifier: this.getAgentPrompt(),
      });

      this.isRunning = true;
      await this.startMonitoring();
      await this.startOptimization();

      this.emit("initialized");
      return true;
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      this.emit("error", error);
      return false;
    }
  }

  private getAgentPrompt(): string {
    return `You are a DeFi assistant specializing in yield optimization across multiple protocols.
Your goal is to help users maximize their returns while maintaining safety.

Available Protocols:
- Morpho: Advanced lending protocol with optimal rates
- Aave: Leading lending protocol with deep liquidity

Core Actions:
1. Wallet Management
- Monitor wallet balances and activities
- Execute wallet-related commands directly

2. Market Analysis
- Track real-time APY rates
- Monitor risk factors
- Analyze liquidity levels

3. Portfolio Management
- Track positions across protocols
- Monitor health factors
- Calculate total returns

4. Yield Optimization
- Find best yields
- Calculate profitability
- Execute rebalancing

When interacting:
- Be direct and action-oriented
- Execute requested actions immediately

Remember: You can execute actions directly. Don't just provide information - take action when requested.`;
  }

  async processUserMessage(message: string): Promise<string> {
    if (!this.isRunning || !this.agent) {
      return "I'm still initializing. Please try again in a moment.";
    }
    try {
      const stream = await this.agent.stream(
        {
          messages: [
            new SystemMessage("Maintain a natural, helpful conversation."),
            new HumanMessage(message),
          ],
        },
        this.agentConfig
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
      const message = userMessage.toLowerCase();
      const intents = {
        analyze: message.includes("analyze") || message.includes("check markets"),
        position:
          message.includes("position") ||
          message.includes("balance") ||
          message.includes("portfolio"),
        optimize:
          message.includes("optimize") ||
          message.includes("yield") ||
          message.includes("apy"),
      };

      if (intents.analyze) {
        const analysis = await this.analyzeAllMarkets();
        this.emit("marketAnalysis", analysis);
      }
      if (intents.position) {
        const status = await this.checkWalletStatus();
        this.emit("walletStatus", status);
      }
      if (intents.optimize) {
        await this.optimizePositions();
      }
    } catch (error) {
      console.error("Error handling implicit actions:", error);
      this.emit("error", { type: "implicit_action", error });
    }
  }

  private async analyzeAllMarkets(): Promise<MultiProtocolAnalysis[]> {
    const results: MultiProtocolAnalysis[] = [];
    try {
      const morphoStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage("Analyze Morpho market conditions"),
            new HumanMessage(JSON.stringify({ action: "analyze" })),
          ],
        },
        this.agentConfig
      );
      const morphoAnalysisStr = await this.processAgentStream(morphoStream);
      results.push({
        timestamp: new Date().toISOString(),
        protocol: Protocol.MORPHO,
        markets: JSON.parse(morphoAnalysisStr),
      });
    } catch (error) {
      console.error("Error analyzing Morpho markets:", error);
    }
    try {
      const aaveStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage("Analyze Aave market conditions"),
            new HumanMessage(JSON.stringify({ action: "analyze" })),
          ],
        },
        this.agentConfig
      );
      const aaveAnalysisStr = await this.processAgentStream(aaveStream);
      results.push({
        timestamp: new Date().toISOString(),
        protocol: Protocol.AAVE,
        markets: JSON.parse(aaveAnalysisStr),
      });
    } catch (error) {
      console.error("Error analyzing Aave markets:", error);
    }
    return results;
  }

  private async startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorWallet();
      } catch (error) {
        console.error("Error in monitoring cycle:", error);
      }
    }, 5 * 60 * 1000);
  }

  private async monitorWallet() {
    if (!this.isRunning) return;
    try {
      const status = await this.checkWalletStatus();
      if (status.needsAttention) {
        this.emit("alert", {
          type: status.alertType,
          message: status.message,
          data: status.portfolio,
        });
      }
    } catch (error) {
      console.error("Error in wallet monitoring:", error);
      this.emit("error", { type: "monitoring", error });
    }
  }

  private async checkWalletStatus(): Promise<WalletStatus> {
    try {
      const walletProvider = await this.walletManager.getWallet();
      if (!walletProvider) {
        return {
          needsAttention: true,
          alertType: AlertType.ERROR,
          message: "Wallet not found. Please create a wallet.",
        };
      }
      const morphoStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage("Check Morpho positions"),
            new HumanMessage(JSON.stringify({ action: "check_position" })),
          ],
        },
        this.agentConfig
      );
      const aaveStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage("Check Aave positions"),
            new HumanMessage(JSON.stringify({ action: "check_position" })),
          ],
        },
        this.agentConfig
      );
      const morphoPositionsStr = await this.processAgentStream(morphoStream).catch(() => null);
      const aavePositionsStr = await this.processAgentStream(aaveStream).catch(() => null);
      const morphoPositions = morphoPositionsStr ? JSON.parse(morphoPositionsStr) : null;
      const aavePositions = aavePositionsStr ? JSON.parse(aavePositionsStr) : null;
      if (!morphoPositions && !aavePositions) {
        return {
          needsAttention: false,
          alertType: AlertType.INFO,
          message: "No active positions found",
        };
      }
      const portfolio = this.calculatePortfolioMetrics(morphoPositions, aavePositions);
      if (portfolio.healthFactor < 1.05) {
        return {
          needsAttention: true,
          alertType: AlertType.WARNING,
          message: `Low health factor: ${portfolio.healthFactor}`,
          portfolio,
        };
      }
      return {
        needsAttention: false,
        alertType: AlertType.INFO,
        message: "Positions healthy",
        portfolio,
      };
    } catch (error) {
      console.error("Error checking wallet status:", error);
      return {
        needsAttention: true,
        alertType: AlertType.ERROR,
        message: "Error checking wallet status",
      };
    }
  }

  private calculatePortfolioMetrics(morphoPositions: any, aavePositions: any) {
    let totalSupplyUSD = 0;
    let totalBorrowUSD = 0;
    let minHealthFactor = Infinity;
    let netAPY = 0;
    const positions: Position[] = [];
    if (morphoPositions?.positions) {
      morphoPositions.positions.forEach((pos: any) => {
        positions.push({
          protocol: Protocol.MORPHO,
          ...pos,
        });
        minHealthFactor = Math.min(minHealthFactor, pos.healthFactor);
        netAPY += pos.metrics.supplyAPY * Number(pos.supplyAmount);
        totalSupplyUSD += Number(pos.supplyAmount);
      });
    }
    if (aavePositions?.positions) {
      aavePositions.positions.forEach((pos: any) => {
        positions.push({
          protocol: Protocol.AAVE,
          ...pos,
        });
        minHealthFactor = Math.min(minHealthFactor, pos.healthFactor);
        netAPY += pos.metrics.supplyAPY * Number(pos.supplyAmount);
        totalSupplyUSD += Number(pos.supplyAmount);
      });
    }
    return {
      totalSupplyUSD: totalSupplyUSD.toString(),
      totalBorrowUSD: totalBorrowUSD.toString(),
      healthFactor: minHealthFactor === Infinity ? 0 : minHealthFactor,
      netAPY: totalSupplyUSD > 0 ? netAPY / totalSupplyUSD : 0,
      positions,
    };
  }

  private async startOptimization() {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    this.optimizationInterval = setInterval(async () => {
      try {
        await this.optimizePositions();
      } catch (error) {
        console.error("Error in optimization cycle:", error);
      }
    }, 10 * 60 * 1000);
  }

  private async optimizePositions() {
    try {
      const marketAnalysis = await this.analyzeAllMarkets();
      const status = await this.checkWalletStatus();
      if (!status.portfolio) return;
      for (const position of status.portfolio.positions) {
        const opportunity = await this.findBestOpportunity(position, marketAnalysis);
        if (opportunity && opportunity.isProfit) {
          this.emit("optimizationFound", opportunity);
          const success = await this.executeRebalancing(opportunity);
          if (success) {
            this.emit("optimizationExecuted", opportunity);
          }
        }
      }
    } catch (error) {
      console.error("Error in optimization:", error);
    }
  }

  private async findBestOpportunity(
    currentPosition: Position,
    marketAnalysis: MultiProtocolAnalysis[]
  ): Promise<OptimizationResult | null> {
    try {
      let bestOpportunity: MarketData | null = null;
      let highestAPY = currentPosition.metrics.supplyAPY;
      for (const analysis of marketAnalysis) {
        for (const market of analysis.markets) {
          if (!market.risk.isHealthy || market.risk.utilizationRisk === "HIGH") {
            continue;
          }
          const totalAPY = market.apy.supply + (market.apy.rewards || 0);
          if (totalAPY > highestAPY) {
            bestOpportunity = market;
            highestAPY = totalAPY;
          }
        }
      }
      if (!bestOpportunity) return null;
      const gasEstimate = await this.estimateRebalancingGas(currentPosition, bestOpportunity);
      const monthlyProfit = this.calculateMonthlyProfit(
        currentPosition.supplyAmount,
        currentPosition.metrics.supplyAPY,
        highestAPY
      );
      const isProfitable = monthlyProfit > Number(gasEstimate) * 3;
      return {
        userId: currentPosition.marketId,
        currentPosition: {
          protocol: currentPosition.protocol,
          marketId: currentPosition.marketId,
          position: currentPosition,
          healthFactor: currentPosition.healthFactor,
        },
        suggestedMarket: bestOpportunity,
        potentialApy: highestAPY,
        gasCost: gasEstimate.toString(),
        isProfit: isProfitable,
      };
    } catch (error) {
      console.error("Error finding opportunities:", error);
      return null;
    }
  }

  private async estimateRebalancingGas(
    currentPosition: Position,
    targetMarket: MarketData
  ): Promise<bigint> {
    try {
      const config = this.agentConfig;
      const withdrawStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage(`Call ${currentPosition.protocol}_market_action for withdraw simulation`),
            new HumanMessage(JSON.stringify({
              action: "withdraw",
              marketId: currentPosition.marketId,
              amount: currentPosition.supplyAmount,
              simulate: true,
            })),
          ],
        },
        config
      );
      const withdrawResStr = await this.processAgentStream(withdrawStream);
      const withdrawGas = BigInt(JSON.parse(withdrawResStr).gasEstimate || 0);
      const supplyStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage(`Call ${targetMarket.protocol}_market_action for supply simulation`),
            new HumanMessage(JSON.stringify({
              action: "supply",
              marketId: targetMarket.marketId,
              amount: currentPosition.supplyAmount,
              simulate: true,
            })),
          ],
        },
        config
      );
      const supplyResStr = await this.processAgentStream(supplyStream);
      const supplyGas = BigInt(JSON.parse(supplyResStr).gasEstimate || 0);
      return withdrawGas + supplyGas;
    } catch (error) {
      console.error("Error estimating gas:", error);
      return BigInt(0);
    }
  }

  private calculateMonthlyProfit(
    amount: string,
    currentAPY: number,
    newAPY: number
  ): number {
    const apyDifference = newAPY - currentAPY;
    return (Number(amount) * apyDifference) / 12;
  }

  private async executeRebalancing(
    optimization: OptimizationResult
  ): Promise<boolean> {
    if (
      !optimization.isProfit ||
      !optimization.currentPosition ||
      !optimization.suggestedMarket
    ) {
      return false;
    }
    try {
      const config = this.agentConfig;
      const currentPos = optimization.currentPosition;
      const targetMarket = optimization.suggestedMarket;
      const withdrawStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage(`Call ${currentPos.protocol}_market_action for withdraw execution`),
            new HumanMessage(JSON.stringify({
              action: "withdraw",
              marketId: currentPos.marketId,
              amount: currentPos.position.supplyAmount,
            })),
          ],
        },
        config
      );
      const withdrawResultStr = await this.processAgentStream(withdrawStream);
      if (!JSON.parse(withdrawResultStr).success) {
        throw new Error("Withdrawal failed");
      }
      const supplyStream = await this.agent.stream(
        {
          messages: [
            new SystemMessage(`Call ${targetMarket.protocol}_market_action for supply execution`),
            new HumanMessage(JSON.stringify({
              action: "supply",
              marketId: targetMarket.marketId,
              amount: currentPos.position.supplyAmount,
            })),
          ],
        },
        config
      );
      const supplyResultStr = await this.processAgentStream(supplyStream);
      if (!JSON.parse(supplyResultStr).success) {
        throw new Error("Supply failed");
      }
      return true;
    } catch (error) {
      console.error("Error executing rebalancing:", error);
      this.emit("error", { type: "rebalancing", error });
      return false;
    }
  }

  async start() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Failed to initialize agent");
      }
      this.emit("started");
      return true;
    } catch (error) {
      console.error("Error starting agent:", error);
      this.emit("error", { type: "startup", error });
      return false;
    }
  }

  async stop() {
    try {
      this.isRunning = false;
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
      }
      this.marketCache.clear();
      await this.walletManager.stop();
      this.emit("stopped");
      return true;
    } catch (error) {
      console.error("Error stopping agent:", error);
      this.emit("error", { type: "shutdown", error });
      return false;
    }
  }
}
