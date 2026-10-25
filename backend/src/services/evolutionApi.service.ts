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
   * Mengirim pesan teks WhatsApp via Evolution API (finbot-wa:8080)
   */
  static async sendTextMessage(phoneNumber: string, text: string): Promise<boolean> {
    const baseUrl = (env.WA_GATEWAY_URL || 'http://finbot-wa:8080').replace(/\/$/, '');
    const apiKey = env.WA_GATEWAY_API_KEY || 'finbotsecretkey2026';
    const instance = env.EVOLUTION_INSTANCE_NAME || 'finbot';

    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    const url = `${baseUrl}/message/sendText/${instance}`;

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
      console.error('[Evolution API Exception] Error menghubungi WhatsApp Gateway:', err.message);
      return false;
    }
  }
}
