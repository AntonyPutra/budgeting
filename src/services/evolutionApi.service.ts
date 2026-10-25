import { env } from '../config/env.js';

export class EvolutionApiService {
  /**
   * Normalisasi nomor telepon WhatsApp (misal 0812... -> 62812...)
   */
  static formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * Mengirim pesan teks WhatsApp via Evolution API
   */
  static async sendTextMessage(phoneNumber: string, text: string): Promise<boolean> {
    const baseUrl = env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = env.EVOLUTION_API_KEY;
    const instance = env.EVOLUTION_INSTANCE_NAME;

    if (!baseUrl || !apiKey || !instance) {
      console.warn(
        '[Evolution API] Konfigurasi EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE_NAME belum lengkap. Melewati pengiriman WhatsApp.'
      );
      return false;
    }

    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    const url = `${baseUrl}/message/sendText/${instance}`;

    // Payload Evolution API v1 / v2 compatible
    const body = {
      number: formattedNumber,
      textMessage: {
        text,
      },
      options: {
        delay: 1000,
        presence: 'composing',
        linkPreview: false,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Evolution API Error] Gagal mengirim pesan ke ${formattedNumber} (${response.status}):`,
          errorText
        );
        return false;
      }

      console.log(`[Evolution API] Berhasil mengirim pesan WhatsApp ke ${formattedNumber}`);
      return true;
    } catch (err: any) {
      console.error('[Evolution API Exception] Error saat menghubungi Evolution API:', err.message);
      return false;
    }
  }
}
