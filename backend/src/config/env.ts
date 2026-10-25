import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('8000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  TZ: z.string().default('Asia/Jakarta'),

  // Google Gemini API
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // PostgreSQL Database
  DATABASE_URL: z
    .string()
    .default(
      'postgresql://finbot_user:supersecretfinbot2026@finbot-db:5432/finbot_db?schema=public'
    ),

  // Evolution API (WhatsApp Gateway Homelab)
  WA_GATEWAY_URL: z.string().optional().default('http://finbot-wa:8080'),
  WA_GATEWAY_API_KEY: z.string().optional().default('finbotsecretkey2026'),
  EVOLUTION_INSTANCE_NAME: z.string().optional().default('finbot'),
  TONYY_WHATSAPP_NUMBER: z.string().optional().default('6281234567890'),
  GIRLFRIEND_WHATSAPP_NUMBER: z.string().optional().default(''),
  GIRLFRIEND_NAME: z.string().optional().default('Pacar'),
  ALLOWED_NUMBERS: z.string().optional().default(''), // e.g. "6281234567890,6289876543210"

  // Legacy/Fallback Webhook Secret
  WEBHOOK_SECRET: z.string().optional().default('finbotsecretkey2026'),
});

export const env = envSchema.parse(process.env);
