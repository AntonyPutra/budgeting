import { Request, Response } from 'express';
import { FinbotService } from '../services/finbot.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { RuleService } from '../services/rule.service.js';

export class WebhookController {
  /**
   * POST /webhook/wa atau POST /api/webhook/whatsapp
   * Menerima Webhook Event dari Evolution API
   */
  static async handleIncomingMessage(req: Request, res: Response) {
    try {
      const body = req.body;

      // 1. Tangani Webhook format Evolution API
      if (body.event === 'messages.upsert' && body.data) {
        const msgData = body.data;

        // Abaikan pesan yang dikirim oleh bot itu sendiri
        if (msgData.key?.fromMe) {
          return res.status(200).json({ status: 'ignored_self_message' });
        }

        const remoteJid = msgData.key?.remoteJid || '';
        // Bersihkan remoteJid (misal: "6281234567890@s.whatsapp.net" -> "6281234567890")
        const phoneNumber = remoteJid.replace(/@.*$/, '');

        // Abaikan pesan broadcast status / grup jika diinginkan
        if (remoteJid.includes('status@broadcast')) {
          return res.status(200).json({ status: 'ignored_status_broadcast' });
        }

        const messageText =
          msgData.message?.conversation ||
          msgData.message?.extendedTextMessage?.text ||
          '';

        if (!messageText.trim()) {
          return res.status(200).json({ status: 'ignored_empty_message' });
        }

        console.log(`[Evolution Webhook] Pesan dari ${phoneNumber}: "${messageText}"`);

        // Proses FinBot dan kirim balik via Evolution API
        const result = await FinbotService.processUserMessage(
          phoneNumber,
          messageText,
          true
        );

        return res.status(200).json({
          success: true,
          reply: result.replyMessage,
          data: result.finbotResponse,
        });
      }

      // 2. Tangani Generic Payload: { from: "...", message: "..." }
      let phoneNumber = body.from || body.sender || '';
      let messageText = body.message || body.text || '';

      if (phoneNumber && messageText.trim()) {
        const result = await FinbotService.processUserMessage(
          String(phoneNumber),
          String(messageText),
          body.sendWhatsApp !== false // default true jika tidak dispesifikasikan false
        );

        return res.status(200).json({
          success: true,
          reply: result.replyMessage,
          data: result.finbotResponse,
        });
      }

      return res.status(400).json({
        error: 'Payload tidak dikenali sebagai format Evolution API atau generic message.',
      });
    } catch (error: any) {
      console.error('[Webhook Error]:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Terjadi kesalahan internal FinBot.',
      });
    }
  }

  /**
   * GET /api/dashboard/stats
   * Digunakan oleh Web Dashboard untuk menampilkan statistik keuangan real-time
   */
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const summary = await TransactionService.getMonthlySummary();
      const rules = await RuleService.getActiveRules();
      const recent = await TransactionService.getRecentTransactions(10);

      return res.json({
        success: true,
        summary,
        rules,
        recent,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
