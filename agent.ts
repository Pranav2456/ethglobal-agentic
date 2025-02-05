import { AutonomousAgent } from './AutonomousAgent';
import * as dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'CDP_API_KEY_NAME',
  'CDP_API_KEY_PRIVATE_KEY',
  'OPENAI_API_KEY',
  'BASE_MAINNET_RPC_URL'
];

// Validate environment
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Start agent
const agent = new AutonomousAgent();

if (require.main === module) {
  agent.start().catch(error => {
    console.error('Fatal error starting agent:', error);
    process.exit(1);
  });
}

export default agent;