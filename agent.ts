// src/index.ts
import { 
    AgentKit, 
    CdpWalletProvider,
    walletActionProvider,
    erc20ActionProvider,
    cdpApiActionProvider,
    customActionProvider
  } from "@coinbase/agentkit";
  import { getLangChainTools } from "@coinbase/agentkit-langchain";
  import { HumanMessage } from "@langchain/core/messages";
  import { MemorySaver } from "@langchain/langgraph";
  import { createReactAgent } from "@langchain/langgraph/prebuilt";
  import { ChatOpenAI } from "@langchain/openai";
  import { z } from "zod";
  import { ethers } from 'ethers';
  import { Time } from "@morpho-org/morpho-ts";
  import { MarketId } from "@morpho-org/blue-sdk";
  import "@morpho-org/blue-sdk-ethers/lib/augment/Market";
  import "@morpho-org/blue-sdk-ethers/lib/augment/MarketParams";
  import { Market } from "@morpho-org/blue-sdk-ethers/lib/augment/Market";
  import { MarketParams } from "@morpho-org/blue-sdk-ethers/lib/augment/MarketParams";
  import * as dotenv from "dotenv";
  import * as fs from "fs";
  import * as readline from "readline";
  
  dotenv.config();
  
  // Morpho Base Sepolia Configuration
  const MORPHO_CONFIG = {
    address: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    markets: {
      'WETH-USDC': {
        id: '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
        collateralToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
        loanToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',      // USDC on Base Sepolia
        oracle: '0xFEa2D58cEfCb9fcb597723c6bAE66fFE4193aFE4',
        irm: '0x46415998764C29aB2a25CbeA6254146D50D22687'
      },
    //   'cbBTC-USDC': {
    //     id: '0x9113b329c9ac5a9d068db0c26ff478a643c58f7d63cf5fbe0ec89fd33b0ff0a0',
    //     collateralToken: '0xcbB7C0006F23900c38EB856149F799620fcb8A4a', // cbBTC on Base Sepolia
    //     loanToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',      // USDC on Base Sepolia
    //     oracle: '0x88Be3c4Ee1e7a05D3FE8E74e13704235dB2de686',
    //     irm: '0x46415998764C29aB2a25CbeA6254146D50D22687'
    //   }
    }
  };

  function validateEnvironment(): void {
    const missingVars: string[] = [];
  
    // Check required variables
    const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    });
  
    // Exit if any required variables are missing
    if (missingVars.length > 0) {
      console.error("Error: Required environment variables are not set");
      missingVars.forEach(varName => {
        console.error(`${varName}=your_${varName.toLowerCase()}_here`);
      });
      process.exit(1);
    }
  
    // Warn about optional NETWORK_ID
    if (!process.env.NETWORK_ID) {
      console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
    }
  }
  
  // Add this right after imports and before any other code
  validateEnvironment();

  const WALLET_DATA_FILE = "wallet_data.txt";
  
  // Helper function to convert WAD to percentage
function wadToPercentage(wadValue: bigint): number {
    return Number(wadValue) / 1e18 * 100;
  }

  
  
  // Custom action for Morpho yield analysis using SDK
  const morphoYieldAnalyzer = customActionProvider<CdpWalletProvider>({
    name: "analyze_morpho_yields",
    description: "Analyzes lending yields across Morpho markets on Base Sepolia using Morpho Blue SDK",
    schema: z.object({
      market: z.string().describe("The market to analyze (WETH-USDC or cbBTC-USDC)"),
    }),
    invoke: async (walletProvider, args: any) => {
      try {
        const market = MORPHO_CONFIG.markets[args.market as keyof typeof MORPHO_CONFIG.markets];
        
        if (!market) {
          return `Unsupported market. Please use one of: ${Object.keys(MORPHO_CONFIG.markets).join(', ')}`;
        }
  
        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  
        // Fetch market configuration
        const marketParams = await MarketParams.fetch(
          market.id as MarketId,
          provider
        );
  
        // Fetch current market state
        const marketData = await Market.fetchFromConfig(
          marketParams,
          provider
        );
  
        // Accrue interest to current timestamp
        const accruedMarket = marketData.accrueInterest(Time.timestamp());
  
        const result = {
          timestamp: new Date().toISOString(),
          market: args.market,
          data: {
            // Market rates and utilization
            supplyAPY: wadToPercentage(accruedMarket.supplyApy),
            borrowAPY: wadToPercentage(accruedMarket.borrowApy),
            utilization: wadToPercentage(accruedMarket.utilization),
            
            // Market metrics
            totalSupplyAssets: accruedMarket.totalSupplyAssets.toString(),
            totalBorrowAssets: accruedMarket.totalBorrowAssets.toString(),
            liquidity: accruedMarket.liquidity.toString(),
            
            // Market configuration
            lltv: wadToPercentage(marketParams.lltv),
            collateralToken: marketParams.collateralToken,
            loanToken: marketParams.loanToken
          },
          riskMetrics: {
            isHealthy: accruedMarket.totalBorrowAssets <= accruedMarket.totalSupplyAssets,
            utilizationRisk: {
              current: wadToPercentage(accruedMarket.utilization),
              status: wadToPercentage(accruedMarket.utilization) > 80 ? 'HIGH' : 
                     wadToPercentage(accruedMarket.utilization) > 50 ? 'MEDIUM' : 'LOW'
            }
          }
        };
  
        return JSON.stringify(result, null, 2);
      } catch (error) {
        console.error('Error analyzing Morpho yields:', error);
        return 'Failed to analyze Morpho yields';
      }
    }
  });
  
  // Initialize agent
  async function initializeAgent() {
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'CDP_API_KEY_NAME',
      'CDP_API_KEY_PRIVATE_KEY',
      'BASE_SEPOLIA_RPC_URL'
    ];
  
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  
    try {
      const llm = new ChatOpenAI({
        model: "gpt-4o-mini",
      });

      let walletDataStr: string | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
        // Continue without wallet data
      }
    }
  
       // Configure CDP Wallet Provider
    const config = {
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        cdpWalletData: walletDataStr || undefined,
        networkId: process.env.NETWORK_ID || "base-sepolia",
      };
  
      const walletProvider = await CdpWalletProvider.configureWithWallet(config);
  
      const agentKit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          walletActionProvider(),
          erc20ActionProvider(),
          cdpApiActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME!,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
          }),
          morphoYieldAnalyzer
        ],
      });
  
      const tools = await getLangChainTools(agentKit);
      const memory = new MemorySaver();
  
      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: `
          You are a yield analysis agent for Morpho on Base Sepolia.
          You can analyze yields and metrics for WETH-USDC and cbBTC-USDC markets using the Morpho Blue SDK.
          
          When asked about yields:
          1. Ask which market they want to analyze
          2. Use analyze_morpho_yields to fetch current data
          3. Explain the:
             - Supply and Borrow APYs
             - Market utilization
             - Market liquidity
             - Risk metrics
          4. Highlight any concerning metrics or risks
          
          Always present APY and utilization as percentages with two decimal places.
          If you encounter any errors, explain them clearly to the user.
        `
      });
  
      return { agent };
    } catch (error) {
      console.error("Agent initialization failed:", error);
      throw error;
    }
  }
  
  // Main function to run the agent
  async function runAgent() {
    const { agent } = await initializeAgent();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    console.log("Morpho Blue Yield Analyzer started. Type 'exit' to quit.");
    console.log("Available markets: WETH-USDC, cbBTC-USDC");
  
    while (true) {
      const input = await new Promise<string>(resolve => 
        rl.question("\nEnter command: ", resolve)
      );
  
      if (input.toLowerCase() === 'exit') break;
  
      try {
        const stream = await agent.stream(
          { messages: [new HumanMessage(input)] },
          { configurable: { thread_id: "morpho-analyzer" } }
        );
  
        for await (const chunk of stream) {
          if ("agent" in chunk) {
            console.log(chunk.agent.messages[0].content);
          } else if ("tools" in chunk) {
            console.log(chunk.tools.messages[0].content);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
  
    rl.close();
  }
  
  // Start the agent
  if (require.main === module) {
    runAgent().catch(console.error);
  }