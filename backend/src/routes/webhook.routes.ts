import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();

// Webhook endpoint sesuai URL di Docker Compose: http://finbot-backend:8000/webhook/wa
router.post('/webhook/wa', WebhookController.handleIncomingMessage);
router.post('/api/webhook/whatsapp', WebhookController.handleIncomingMessage);

// REST endpoint untuk web dashboard atau testing
router.post('/api/chat', WebhookController.handleIncomingMessage);
router.get('/api/dashboard/stats', WebhookController.getDashboardStats);

export default router;
