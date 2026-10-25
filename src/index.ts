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
    bot: 'FinBot',
    time: getCurrentWibTimestamp(),
    env: env.NODE_ENV,
  });
});

// API Routes
app.use('/api', routes);

const port = env.PORT || 3000;

app.listen(port, () => {
  console.log(`
==================================================
🤖 FinBot - WhatsApp Personal Finance AI Assistant
==================================================
🚀 Server running at: http://localhost:${port}
🕒 Server Time: ${getCurrentWibTimestamp()}
📡 Webhook URL: http://localhost:${port}/api/webhook/whatsapp
💬 Test Chat:   POST http://localhost:${port}/api/chat
==================================================
  `);
});

export default app;
