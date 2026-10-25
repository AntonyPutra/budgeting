import { env } from '../config/env.js';
import { FinbotResponse } from '../types/finbot.js';
import { FinbotResponseSchema } from '../schemas/finbotSchema.js';

export class GeminiService {
  /**
   * Mengirim pesan user dan system prompt ke Gemini API, lalu memvalidasi output JSON
   */
  static async generateFinbotResponse(
    systemPrompt: string,
    userMessage: string
  ): Promise<FinbotResponse> {
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY belum diset. Silakan atur GEMINI_API_KEY di file .env Anda.'
      );
    }

    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2, // Rendah agar konsisten dan akurat
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!rawText) {
      throw new Error('Gemini API mengembalikan respons kosong.');
    }

    // Bersihkan pembungkus markdown jika ada
    let cleanedJson = rawText;
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleanedJson);
      const validated = FinbotResponseSchema.parse(parsed);
      return validated as FinbotResponse;
    } catch (parseError: any) {
      console.error('Failed to parse Gemini output:', rawText);
      throw new Error(`Format JSON FinBot tidak valid: ${parseError.message}`);
    }
  }
}
