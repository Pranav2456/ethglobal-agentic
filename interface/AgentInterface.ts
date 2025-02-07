// src/interface/AgentInterface.ts
import { AutonomousAgent } from '../AutonomousAgent';
import { EventEmitter } from 'events';
import readline from 'readline';
import chalk from 'chalk';

export class AgentInterface extends EventEmitter {
    private agent: AutonomousAgent;
    private rl: readline.Interface;
    private isActive: boolean = false;

    constructor(agent: AutonomousAgent) {
        super();
        this.agent = agent;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Set up agent event listeners
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.agent.on('initialized', () => {
            this.displayMessage('system', 'Agent initialized and ready to help!');
        });

        this.agent.on('walletCreated', ({ userId, address }) => {
            this.displayMessage('success', `Created new wallet with address: ${address}`);
            this.displayMessage('info', `Your user ID is: ${userId}. Please save this for future reference.`);
        });

        this.agent.on('error', (error) => {
            this.displayMessage('error', `Error: ${error.message}`);
        });

        this.agent.on('alert', (alert) => {
            this.displayMessage('alert', `⚠️ ${alert.message}`);
        });
    }

    private displayMessage(type: 'system' | 'user' | 'agent' | 'error' | 'success' | 'info' | 'alert', message: string) {
        const timestamp = new Date().toLocaleTimeString();
        let formattedMessage: string;

        switch (type) {
            case 'system':
                formattedMessage = chalk.blue(`[${timestamp}] ${message}`);
                break;
            case 'user':
                formattedMessage = chalk.green(`You: ${message}`);
                break;
            case 'agent':
                formattedMessage = chalk.cyan(`Agent: ${message}`);
                break;
            case 'error':
                formattedMessage = chalk.red(`❌ ${message}`);
                break;
            case 'success':
                formattedMessage = chalk.green(`✅ ${message}`);
                break;
            case 'info':
                formattedMessage = chalk.yellow(`ℹ️  ${message}`);
                break;
            case 'alert':
                formattedMessage = chalk.yellow(message);
                break;
            default:
                formattedMessage = message;
        }

        console.log(formattedMessage);
    }

    private displayWelcomeMessage() {
        console.clear();
        console.log(chalk.blue.bold('\n🤖 Welcome to Morpho Yield Maximizer!\n'));
        console.log(chalk.yellow('I\'m your personal DeFi assistant. I can help you:'));
        console.log('1. Set up and manage your wallet');
        console.log('2. Find the best yields in Morpho markets');
        console.log('3. Automatically optimize your positions');
        console.log('4. Monitor market conditions and risks\n');
        console.log(chalk.gray('Just tell me what you\'d like to do in natural language.'));
        console.log(chalk.gray('Type "exit" to quit at any time.\n'));
    }

    private async processUserInput(input: string) {
        if (input.toLowerCase() === 'exit') {
            await this.stop();
            return;
        }

        this.displayMessage('user', input);
        
        try {
            const response = await this.agent.processUserMessage(input);
            
            // Split response into paragraphs for better readability
            response.split('\n').forEach(paragraph => {
                if (paragraph.trim()) {
                    this.displayMessage('agent', paragraph.trim());
                }
            });
        } catch (error: any) {
            this.displayMessage('error', error.message);
        }
    }

    public async start() {
        try {
            this.isActive = true;
            await this.agent.start();
            this.displayWelcomeMessage();

            // Start input loop
            while (this.isActive) {
                const input = await new Promise<string>(resolve => {
                    this.rl.question(chalk.green('\n> '), resolve);
                });

                await this.processUserInput(input);
            }
        } catch (error: any) {
            this.displayMessage('error', `Fatal error: ${error.message}`);
            await this.stop();
        }
    }

    public async stop() {
        this.isActive = false;
        await this.agent.stop();
        this.rl.close();
        this.displayMessage('system', 'Agent stopped. Goodbye!');
        process.exit(0);
    }
}