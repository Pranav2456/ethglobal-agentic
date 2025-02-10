# 🤖 YieldMax.AI - Intelligent DeFi Yield Optimizer

Your AI-powered companion for maximizing DeFi yields on Base, built during ETHGlobal Agentic Hackathon 2025.

## 🎯 Project Overview

YieldMax.AI revolutionizes DeFi yield optimization by combining artificial intelligence with blockchain technology. Our autonomous agent analyzes market conditions, identifies opportunities, and executes optimal strategies while maintaining rigorous risk management.

## 🌟 Key Features

### 🧠 Intelligent Market Analysis
* Real-time protocol comparison (Aave & Morpho)
* Advanced risk assessment
* APY and liquidity tracking
* Gas-cost optimization

### 🔄 Automated Strategy Execution
* Smart rebalancing across protocols
* Risk-aware position management
* Gas-optimized transactions
* Health factor monitoring

### 💬 Natural Language Interface
* Chat with your AI financial advisor
* Plain English commands for complex DeFi operations
* Real-time market insights
* Educational explanations

## 🛠️ Technology Stack

### Base
* Primary deployment infrastructure
* Low-cost, high-speed transactions
* Optimal DeFi protocol environment

### Coinbase Developer Platform (CDP)
* Secure wallet infrastructure
* Blockchain interaction SDK
* Transaction management

### AgentKit
* AI agent framework
* Blockchain interaction tools
* Intelligent decision-making

### Autonome
* Agent deployment platform
* Reliable API infrastructure
* Secure hosting environment

## 🚀 Try It Out

### Live Demo
https://yieldmax-ai.vercel.app/

## ⚠️ Important Note on Query Processing

### Deployment Constraints
The frontend is deployed on Vercel's Hobby (free) plan, which enforces a 60-second timeout limit on API routes. While our AI agent is capable of processing complex DeFi analysis queries successfully, the hosting platform automatically terminates requests exceeding this duration.

### Types of Affected Queries
Complex operations that might exceed the timeout include:
- Multi-protocol market analysis
- Comprehensive yield comparisons
- Detailed risk assessments across protocols
- Advanced portfolio optimization calculations

### Recommended Usage
For optimal experience:
- Break down complex analyses into smaller queries
- Use focused, specific questions for quick market checks
- Allow brief intervals between complex operations

### Solution for Production
For production environments requiring comprehensive market analysis:
- Upgrade to Vercel Pro plan for extended timeouts
- Consider self-hosting the API for custom timeout configurations
- Implement request chunking for complex operations

*Note: This limitation is purely hosting-related and does not affect the agent's analytical capabilities or accuracy of responses.*

### Contract Addresses
YieldStrategyManager: https://basescan.org/address/0x90Cae48cEC3595Cd1A6a9D806679EEE50F364979
MorphoBaseStrategy: https://basescan.org/address/0x9bBF97fE8CF3faE8d58915878c9C1eb1892C46F2
AaveBaseStrategy: https://basescan.org/address/0x9C80FE3Abc89d865Fe307707047D3d57414cD395

### Autonome Deployment
https://autonome.alt.technology/yieldmax-yilblw

### Local Setup
```bash
# Clone the repository
git clone https://github.com/Pranav2456/yieldmax-ai

# Install dependencies
cd frontend
npm install

# Set up environment variables
cp .env.example .env

# Start the application
npm run dev