import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  WEBHOOK_SECRET: z.string().optional(),

  // Evolution API Config (WhatsApp Homelab Gateway)
  EVOLUTION_API_URL: z.string().optional().default('http://evolution-api:8080'),
  EVOLUTION_API_KEY: z.string().optional().default(''),
  EVOLUTION_INSTANCE_NAME: z.string().optional().default('finbot'),
  TONYY_WHATSAPP_NUMBER: z.string().optional().default('6281234567890'),
});

export const env = envSchema.parse(process.env);
