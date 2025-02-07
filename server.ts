import express from 'express';
import { setupAgent, setupProcessHandlers } from './agent';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
    const app = express();
    app.use(express.json());

    const agentInterface = await setupAgent();
    setupProcessHandlers(agentInterface);
    await agentInterface.start();

    // Single message endpoint for all interactions
    app.post('/message', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({ 
                    error: 'Message is required' 
                });
            }

            const response = await agentInterface.processMessage(message);
            res.json({ 
                text: response 
            });

        } catch (error: any) {
            console.error('Error processing message:', error);
            res.status(500).json({ 
                text: error.message || 'Internal server error' 
            });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer().catch(console.error); 