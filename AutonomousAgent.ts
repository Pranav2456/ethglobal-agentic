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
  DepositStatus,
  OptimizationResult,
  AlertType,
  MultiProtocolAnalysis,
} from "./types";
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
  private marketCache: Map<string, { data: MarketData; timestamp: number }> =
    new Map();
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

      const provider = await CdpWalletProvider.configureWithWallet({
        apiKeyName: process.env.CDP_API_KEY_NAME!,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(
          /\\n/g,
          "\n"
        ),
        networkId: CONFIG.NETWORK.id,
      });

      this.agentKit = await AgentKit.from({
        walletProvider: provider,
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
          morphoProvider,
          aaveProvider,
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
      
      When talking to users:
      - Be conversational and natural
      - Understand implicit intentions
      - Guide users through processes step by step
      - Proactively monitor and suggest improvements
      - Always consider risk and gas costs
      
      Core capabilities:
      1. Multi-Protocol Management
      - Compare yields across protocols
      - Analyze risk-reward ratios
      - Optimize positions across platforms
      
      2. Market Analysis
      - Real-time APY tracking
      - Risk factor assessment
      - Liquidity monitoring
      
      3. Portfolio Optimization
      - Cross-protocol yield optimization
      - Gas-efficient rebalancing
      - Risk-adjusted returns
      
      4. Risk Management
      - Health factor monitoring
      - Protocol-specific risks
      - Market condition alerts
      
      Remember to be helpful and natural while prioritizing safety.`;
  }

  async processUserMessage(message: string): Promise<string> {
    if (!this.isRunning || !this.agent) {
      return "I'm still initializing. Please try again in a moment.";
    }

    try {
      // Ensure we have a thread ID
      if (!this.currentThread) {
        this.currentThread = Date.now().toString();
      }

      const config = {
        configurable: {
          thread_id: this.currentThread,
        },
      };

      const stream = await this.agent.stream(
        {
          messages: [
            new SystemMessage(
              "Remember to maintain a natural, helpful conversation."
            ),
            new HumanMessage(message),
          ],
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

  private async processAgentStream(
    stream: AsyncIterable<any>
  ): Promise<string> {
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
      // Use a more structured intent analysis
      const intent = await this.agent.invoke(`Analyze this message and identify the user's intent: ${userMessage}`);

      if (intent.includes("create_wallet") && !this.currentThread) {
        const wallet = await this.walletManager.createWallet();
        this.currentThread = wallet.userId;
        this.emit("walletCreated", wallet);
      }

      if (intent.includes("analyze_markets")) {
        const analysis = await this.analyzeAllMarkets();
        this.emit("marketAnalysis", analysis);
      }

      // Add missing implementations
      if (intent.includes("check_positions") && this.currentThread) {
        const status = await this.checkWalletStatus(this.currentThread);
        if (status.portfolio) {
          this.emit("portfolioUpdate", status.portfolio);
        }
      }

      if (intent.includes("optimize") && this.currentThread) {
        await this.optimizePositions([this.currentThread]);
      }

      if (intent.includes("deposit") && this.currentThread) {
        await this.startDepositMonitoring(this.currentThread);
      }

      if (intent.includes("balance") && this.currentThread) {
        const status = await this.checkWalletStatus(this.currentThread);
        this.emit("balanceUpdate", status);
      }

    } catch (error) {
      console.error("Error handling implicit actions:", error);
      this.emit("error", { type: "implicit_action", error });
    }
  }

  private async startDepositMonitoring(userId: string) {
    if (!userId) return;

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

          this.emit("depositDetected", {
            userId,
            amount: status.amount,
            token: status.token,
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

  private async checkDepositStatus(userId: string): Promise<DepositStatus> {
    try {
      const wallet = await this.walletManager.getWallet(userId);
      if (!wallet) throw new Error("Wallet not found");

      // Check balances in both protocols
      const [morphoBalance, aaveBalance] = await Promise.all([
        this.agent
          .invoke("morpho_market_action", {
            action: "balance",
            userId,
          })
          .catch(() => "0"),
        this.agent
          .invoke("aave_market_action", {
            action: "balance",
            userId,
          })
          .catch(() => "0"),
      ]);

      const totalBalance =
        BigInt(morphoBalance || "0") + BigInt(aaveBalance || "0");
      const previousBalance = BigInt(this.lastKnownBalances.get(userId) || "0");

      if (totalBalance > previousBalance) {
        this.lastKnownBalances.set(userId, totalBalance.toString());
        return {
          hasNewDeposit: true,
          amount: (totalBalance - previousBalance).toString(),
          token: "USDC", // Assuming USDC for now
        };
      }

      return {
        hasNewDeposit: false,
        amount: "0",
      };
    } catch (error) {
      console.error("Error checking deposit status:", error);
      return {
        hasNewDeposit: false,
        amount: "0",
      };
    }
  }

  private async getTokenBalance(
    userId: string,
    tokenAddress: string,
    protocol: Protocol
  ): Promise<bigint> {
    try {
      const result = await this.agent.invoke(`${protocol}_market_action`, {
        action: "balance",
        userId,
        token: tokenAddress,
      });

      return BigInt(result || "0");
    } catch {
      return BigInt(0);
    }
  }

  private async analyzeAllMarkets(): Promise<MultiProtocolAnalysis[]> {
    const results: MultiProtocolAnalysis[] = [];

    // Analyze Morpho markets
    try {
      const morphoAnalysis = await this.agent.invoke("morpho_market_action", {
        action: "analyze",
      });
      results.push({
        timestamp: new Date().toISOString(),
        protocol: Protocol.MORPHO,
        markets: JSON.parse(morphoAnalysis),
      });
    } catch (error) {
      console.error("Error analyzing Morpho markets:", error);
    }

    // Analyze Aave markets
    try {
      const aaveAnalysis = await this.agent.invoke("aave_market_action", {
        action: "analyze",
      });
      results.push({
        timestamp: new Date().toISOString(),
        protocol: Protocol.AAVE,
        markets: JSON.parse(aaveAnalysis),
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
        await this.monitorWallets();
      } catch (error) {
        console.error("Error in monitoring cycle:", error);
      }
    }, 5 * 60 * 1000);
  }

  private async monitorWallets() {
    if (!this.isRunning) return;

    try {
      const wallets = this.walletManager.getAllWallets();
      for (const [userId, wallet] of wallets) {
        const status = await this.checkWalletStatus(userId);
        if (status.needsAttention) {
          this.emit("alert", {
            userId,
            type: status.alertType,
            message: status.message,
            data: status.portfolio,
          });
        }
      }
    } catch (error) {
      console.error("Error in wallet monitoring:", error);
      this.emit("error", { type: "monitoring", error });
    }
  }

  private async checkWalletStatus(userId: string): Promise<WalletStatus> {
    try {
      const wallet = await this.walletManager.getWallet(userId);
      if (!wallet) {
        return {
          needsAttention: true,
          alertType: AlertType.ERROR,
          message: "Wallet not found",
        };
      }

      // Check positions in all protocols
      const [morphoPositions, aavePositions] = await Promise.all([
        this.agent
          .invoke("morpho_market_action", {
            action: "check_position",
            userId,
          })
          .then((res: any) => JSON.parse(res))
          .catch(() => null),
        this.agent
          .invoke("aave_market_action", {
            action: "check_position",
            userId,
          })
          .then((res: any) => JSON.parse(res))
          .catch(() => null),
      ]);

      if (!morphoPositions && !aavePositions) {
        return {
          needsAttention: false,
          alertType: AlertType.INFO,
          message: "No active positions found",
        };
      }

      // Calculate total portfolio metrics
      const portfolio = this.calculatePortfolioMetrics(
        morphoPositions,
        aavePositions
      );

      // Check health factors
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

    // Process Morpho positions
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

    // Process Aave positions
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

  private async optimizePositions(specificUsers?: string[]) {
    try {
      const wallets = this.walletManager.getAllWallets();
      const usersToCheck = specificUsers || Array.from(wallets.keys());
      const marketAnalysis = await this.analyzeAllMarkets();

      for (const userId of usersToCheck) {
        const status = await this.checkWalletStatus(userId.toString());
        if (!status.portfolio) continue;

        for (const position of status.portfolio.positions) {
          const opportunity = await this.findBestOpportunity(
            position,
            marketAnalysis
          );

          if (opportunity && opportunity.isProfit) {
            this.emit("optimizationFound", opportunity);
            const success = await this.executeRebalancing(
              userId.toString(),
              opportunity
            );
            if (success) {
              this.emit("optimizationExecuted", opportunity);
            }
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

      // Check all protocols for better opportunities
      for (const analysis of marketAnalysis) {
        for (const market of analysis.markets) {
          if (
            !market.risk.isHealthy ||
            market.risk.utilizationRisk === "HIGH"
          ) {
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

      // Calculate gas costs and profitability
      const gasEstimate = await this.estimateRebalancingGas(
        currentPosition,
        bestOpportunity
      );

      const monthlyProfit = this.calculateMonthlyProfit(
        currentPosition.supplyAmount,
        currentPosition.metrics.supplyAPY,
        highestAPY
      );

      const isProfitable = monthlyProfit > Number(gasEstimate) * 3; // 3-month payback period

      return {
        userId: currentPosition.marketId, // Using marketId as userId here
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
      // Estimate withdraw gas
      const withdrawGas = await this.agent
        .invoke(`${currentPosition.protocol}_market_action`, {
          action: "withdraw",
          marketId: currentPosition.marketId,
          amount: currentPosition.supplyAmount,
          simulate: true,
        })
        .then((res: any) => BigInt(JSON.parse(res).gasEstimate || 0));

      // Estimate supply gas
      const supplyGas = await this.agent
        .invoke(`${targetMarket.protocol}_market_action`, {
          action: "supply",
          marketId: targetMarket.marketId,
          amount: currentPosition.supplyAmount,
          simulate: true,
        })
        .then((res: any) => BigInt(JSON.parse(res).gasEstimate || 0));

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
    userId: string,
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
      const currentPos = optimization.currentPosition;
      const targetMarket = optimization.suggestedMarket;

      // Execute withdrawal
      const withdrawResult = await this.agent.invoke(
        `${currentPos.protocol}_market_action`,
        {
          action: "withdraw",
          userId,
          marketId: currentPos.marketId,
          amount: currentPos.position.supplyAmount,
        }
      );

      if (!JSON.parse(withdrawResult).success) {
        throw new Error("Withdrawal failed");
      }

      // Execute supply
      const supplyResult = await this.agent.invoke(
        `${targetMarket.protocol}_market_action`,
        {
          action: "supply",
          userId,
          marketId: targetMarket.marketId,
          amount: currentPos.position.supplyAmount,
        }
      );

      if (!JSON.parse(supplyResult).success) {
        throw new Error("Supply failed");
      }

      return true;
    } catch (error) {
      console.error("Error executing rebalancing:", error);
      this.emit("error", {
        type: "rebalancing",
        userId,
        error,
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
      for (const interval of this.depositMonitoringIntervals.values()) {
        clearInterval(interval);
      }
      this.depositMonitoringIntervals.clear();

      this.marketCache.clear();
      this.lastKnownBalances.clear();

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
