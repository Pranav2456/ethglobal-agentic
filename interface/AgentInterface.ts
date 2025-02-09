import { AutonomousAgent } from '../AutonomousAgent';
import { EventEmitter } from 'events';
import readline from 'readline';
import chalk from 'chalk';

export class AgentInterface extends EventEmitter {
    private agent: AutonomousAgent;
    private isActive: boolean = false;
    private isCLIMode: boolean = false;

    constructor(agent: AutonomousAgent) {
        super();
        this.agent = agent;
        
        // Set up agent event listeners
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.agent.on('initialized', () => {
            console.log('Agent initialized and ready to help!');
        });

        this.agent.on('walletCreated', ({ userId, address }) => {
            console.log(`Created new wallet with address: ${address}`);
            console.log(`User ID: ${userId}`);
        });

        this.agent.on('error', (error) => {
            console.error(`Error: ${error.message}`);
        });

        this.agent.on('alert', (alert) => {
            console.warn(`⚠️ ${alert.message}`);
        });
    }

    public async start() {
        try {
            this.isActive = true;
            await this.agent.start();
            console.log('Agent started successfully in server mode');
        } catch (error: any) {
            console.error(`Fatal error: ${error.message}`);
            await this.stop();
        }
    }

    public async stop() {
        this.isActive = false;
        await this.agent.stop();
        console.log('Agent stopped');
    }

    public async processMessage(message: string): Promise<string> {
        try {
            const response = await this.agent.processUserMessage(message);
            
            // Filter out raw JSON if present
            const cleanResponse = response.replace(/^\[.*\]\s*/s, '');
            return cleanResponse;
        } catch (error: any) {
            console.error('Error processing message:', error);
            throw new Error(error.message || 'Failed to process message');
        }
    }
}