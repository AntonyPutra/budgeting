import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/webhook.routes.js';
import { getCurrentWibTimestamp } from './prompts/promptBuilder.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'FinBot (Personal Production)',
    serverTime: getCurrentWibTimestamp(),
    port: env.PORT,
    env: env.NODE_ENV,
  });
});

// Register routes
app.use(routes);

const port = env.PORT || 8000;

app.listen(port, () => {
  console.log(`
==================================================
🤖 FinBot AI Engine - Personal Production (Tonyy)
==================================================
🚀 Server running on port: ${port}
🕒 Server Time: ${getCurrentWibTimestamp()} (Semarang/WIB)
📡 Webhook Evolution API: http://finbot-backend:${port}/webhook/wa
💬 Test Endpoint: POST http://localhost:${port}/api/chat
==================================================
  `);
});

export default app;
