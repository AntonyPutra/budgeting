import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();

// Webhook WhatsApp (Meta Cloud API / Fonnte / Wablas)
router.get('/webhook/whatsapp', WebhookController.verifyWebhook);
router.post('/webhook/whatsapp', WebhookController.handleIncomingMessage);

// Endpoint internal untuk simulasi atau integrasi REST API
router.post('/chat', WebhookController.handleIncomingMessage);

// Rekapitulasi keuangan user
router.get('/summary/:phone', WebhookController.getUserSummary);

export default router;
