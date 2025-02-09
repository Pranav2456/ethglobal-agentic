import express from "express";
import { setupAgent, setupProcessHandlers } from "./agent";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json());

  let lastInitTime = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes

  let agentInterface = await setupAgent();
  setupProcessHandlers(agentInterface);
  await agentInterface.start();

  
  app.get("/heartbeat", async (req, res) => {
    const currentTime = Date.now();
    if (currentTime - lastInitTime > TIMEOUT) {
      agentInterface = await setupAgent();
      await agentInterface.start();
      lastInitTime = currentTime;
    }
    res.json({ status: "ok" });
  });

  // Single message endpoint for all interactions
  app.post("/message", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({
          error: "Message is required",
        });
      }

      const response = await agentInterface.processMessage(message);
      res.json({
        text: response,
      });
    } catch (error: any) {
      console.error("Error processing message:", error);
      res.status(500).json({
        text: error.message || "Internal server error",
      });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
