import { Request, Response } from 'express';
import { FinbotService } from '../services/finbot.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { prisma } from '../lib/prisma.js';

export class WebhookController {
  /**
   * GET /api/webhook/whatsapp
   * Verifikasi Webhook Meta WhatsApp Cloud API
   */
  static async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WEBHOOK_SECRET || 'finbot_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook WhatsApp berhasil diverifikasi.');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verifikasi webhook gagal' });
  }

  /**
   * POST /api/webhook/whatsapp
   * Menangani pesan masuk dari WhatsApp Gateway (Meta API, Fonnte, Wablas, atau custom bot)
   */
  static async handleIncomingMessage(req: Request, res: Response) {
    try {
      const body = req.body;

      // Ekstraksi nomor telepon dan isi pesan dari berbagai format gateway
      let phoneNumber = '';
      let messageText = '';
      let senderName = 'WhatsApp User';

      // 1. Format Meta WhatsApp Cloud API
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        const contact = body.entry[0].changes[0].value.contacts?.[0];
        phoneNumber = msg.from;
        messageText = msg.text?.body || '';
        senderName = contact?.profile?.name || senderName;
      }
      // 2. Format Fonnte / Wablas
      else if (body.sender && (body.message || body.text)) {
        phoneNumber = String(body.sender);
        messageText = body.message || body.text || '';
        senderName = body.name || senderName;
      }
      // 3. Format Generic API Payload: { from: "...", message: "...", name?: "..." }
      else if (body.from && (body.message || body.text)) {
        phoneNumber = String(body.from);
        messageText = body.message || body.text || '';
        senderName = body.name || senderName;
      }

      if (!phoneNumber || !messageText.trim()) {
        return res.status(400).json({
          error:
            'Format request tidak dikenal. Pastikan menyertakan nomor (from/sender) dan isi pesan (message/text).',
        });
      }

      console.log(`[Pesan Masuk] Dari: ${phoneNumber} (${senderName}): "${messageText}"`);

      // Proses melalui FinBot
      const result = await FinbotService.processUserMessage(
        phoneNumber,
        messageText,
        senderName
      );

      return res.status(200).json({
        success: true,
        reply: result.replyMessage,
        data: result.finbotResponse,
        details: result.executionDetails,
      });
    } catch (error: any) {
      console.error('Error saat memproses webhook:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Terjadi kesalahan internal pada FinBot.',
      });
    }
  }

  /**
   * GET /api/finbot/summary/:phone
   * Melihat rekapitulasi keuangan user bulan ini
   */
  static async getUserSummary(req: Request, res: Response) {
    try {
      const { phone } = req.params;
      const user = await prisma.user.findUnique({
        where: { phoneNumber: phone },
      });

      if (!user) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
      }

      const summary = await TransactionService.getMonthlySummary(user.id);
      return res.json({ user, summary });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
