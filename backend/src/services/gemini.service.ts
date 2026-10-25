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

    let model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
      model = 'gemini-3.5-flash-lite';
    }

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

    const callApi = async (targetModel: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    };

    let response = await callApi(model);

    // Fallback jika model utama sedang busy atau deprecated
    if (!response.ok && (response.status === 404 || response.status === 503)) {
      const fallbackModel = model === 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite';
      console.warn(`[GeminiService] Model ${model} returned ${response.status}. Retrying with ${fallbackModel}...`);
      const fallbackResponse = await callApi(fallbackModel);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p && typeof p.text === 'string');
    const rawText = textPart?.text?.trim() || '';

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
