import { Request, Response } from 'express';
import { FinbotService } from '../services/finbot.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { RuleService } from '../services/rule.service.js';
import { env } from '../config/env.js';

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

        // Abaikan pesan broadcast status
        if (remoteJid.includes('status@broadcast')) {
          return res.status(200).json({ status: 'ignored_status_broadcast' });
        }

        const isGroup = remoteJid.endsWith('@g.us');
        // Jika dari grup, cari participant pengirim aslinya
        const rawParticipant = msgData.key?.participant || msgData.participant || remoteJid;
        const senderPhone = rawParticipant.replace(/@.*$/, '');
        const replyTarget = remoteJid; // kirim balik ke grup jika dari grup, atau ke nomor jika DM

        const messageText =
          msgData.message?.conversation ||
          msgData.message?.extendedTextMessage?.text ||
          '';

        if (!messageText.trim()) {
          return res.status(200).json({ status: 'ignored_empty_message' });
        }

        // Identifikasi Nama Pengirim (Tonyy vs Pacar)
        const tonyyNumber = env.TONYY_WHATSAPP_NUMBER?.replace(/\D/g, '') || '';
        const girlfriendNumber = env.GIRLFRIEND_WHATSAPP_NUMBER?.replace(/\D/g, '') || '';
        const cleanedSender = senderPhone.replace(/\D/g, '');

        let senderName = 'Tonyy';
        if (girlfriendNumber && cleanedSender.endsWith(girlfriendNumber.slice(-8))) {
          senderName = env.GIRLFRIEND_NAME || 'Pacar';
        } else if (tonyyNumber && cleanedSender.endsWith(tonyyNumber.slice(-8))) {
          senderName = 'Tonyy';
        } else if (msgData.pushName) {
          senderName = msgData.pushName;
        }

        // Whitelist Security: Hanya izinkan Tonyy & Pacar jika nomor dikonfigurasi
        const allowedList = [
          tonyyNumber,
          girlfriendNumber,
          ...(env.ALLOWED_NUMBERS ? env.ALLOWED_NUMBERS.split(',').map((s) => s.trim().replace(/\D/g, '')) : []),
        ].filter(Boolean);

        if (allowedList.length > 0) {
          const isAllowed = allowedList.some((num) => cleanedSender.endsWith(num.slice(-8)));
          if (!isAllowed) {
            console.log(`[Security] Mengabaikan pesan dari pengirim tak terdaftar: ${senderPhone}`);
            return res.status(200).json({ status: 'ignored_unauthorized_sender' });
          }
        }

        console.log(`[Evolution Webhook] [${senderName} (${senderPhone})] ${isGroup ? '[Grup]' : '[DM]'}: "${messageText}"`);

        // Sisipkan konteks nama pengirim jika belum ada di chat agar AI paham
        const contextualMessage = `[Pengirim: ${senderName}] ${messageText}`;

        // Proses FinBot dan kirim balik via Evolution API ke replyTarget (DM atau Grup)
        const result = await FinbotService.processUserMessage(
          senderPhone,
          contextualMessage,
          true,
          senderName,
          replyTarget
        );

        return res.status(200).json({
          success: true,
          sender: senderName,
          reply: result.replyMessage,
          data: result.finbotResponse,
        });
      }

      // 2. Tangani Generic Payload: { from/senderPhone: "...", message: "...", name/userName?: "..." }
      let phoneNumber = body.from || body.sender || body.senderPhone || '';
      let messageText = body.message || body.text || '';
      let senderName = body.name || body.userName || 'Tonyy';

      if (phoneNumber && messageText.trim()) {
        const result = await FinbotService.processUserMessage(
          String(phoneNumber),
          String(messageText),
          body.sendWhatsApp !== false,
          senderName
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
      const recent = await TransactionService.getRecentTransactions(15);

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
