// src/agent.ts
import { AutonomousAgent } from './AutonomousAgent';
import { AgentInterface } from './interface/AgentInterface';
import * as dotenv from 'dotenv';

dotenv.config();

// Required environment variables
const requiredEnvVars = [
    'CDP_API_KEY_NAME',
    'CDP_API_KEY_PRIVATE_KEY',
    'OPENAI_API_KEY',
    'BASE_MAINNET_RPC_URL'
];

// Validate environment and setup
async function setupAgent() {
    try {
        // Check environment variables
        const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Validate RPC URL format
        try {
            new URL(process.env.BASE_MAINNET_RPC_URL!);
        } catch {
            throw new Error('Invalid BASE_MAINNET_RPC_URL format');
        }

        // Create agent and interface
        const agent = new AutonomousAgent();
        const agentInterface = new AgentInterface(agent, false);

        return agentInterface;
    } catch (error: any) {
        console.error('Setup failed:', error.message);
        process.exit(1);
    }
}

// Handle process signals
function setupProcessHandlers(agentInterface: AgentInterface) {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT. Shutting down gracefully...');
        await agentInterface.stop();
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM. Shutting down gracefully...');
        await agentInterface.stop();
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await agentInterface.stop();
    });

    process.on('unhandledRejection', async (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        await agentInterface.stop();
    });
}

// Start the agent
async function startAgent() {
    try {
        const agentInterface = await setupAgent();
        setupProcessHandlers(agentInterface);
        await agentInterface.start();
    } catch (error: any) {
        console.error('Fatal error starting agent:', error);
        process.exit(1);
    }
}

// Only start if running directly (not imported as a module)
if (require.main === module) {
    startAgent();
}

// Export for testing and module usage
export { setupAgent, startAgent, setupProcessHandlers };