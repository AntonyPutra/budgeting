import { z } from 'zod';

export const FinbotTransactionItemSchema = z.object({
  target_id: z.number().nullable().optional().default(null),
  type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
  amount: z.number().nonnegative().default(0),
  category: z.string().default('Lain-lain'),
  class: z.enum(['Needs', 'Wants']).default('Needs'),
  description: z.string().default(''),
  is_micro_leak: z.boolean().default(false),
});

export const FinbotPayloadSchema = z.object({
  transactions: z.array(FinbotTransactionItemSchema).default([]),
  new_rule: z.string().nullable().optional().default(null),
});

export const FinbotResponseSchema = z.object({
  intent: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'QUERY',
    'LEARN_RULE',
    'CHAT_GENERAL',
  ]),
  reply_message: z.string(),
  payload: FinbotPayloadSchema,
});

export type ValidatedFinbotResponse = z.infer<typeof FinbotResponseSchema>;
