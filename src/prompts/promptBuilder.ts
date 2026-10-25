import { FINBOT_SYSTEM_PROMPT_TEMPLATE } from './systemPrompt.js';
import { ContextInjectionData } from '../types/finbot.js';

/**
 * Mendapatkan string timestamp saat ini dalam zona waktu Asia/Jakarta (WIB)
 */
export function getCurrentWibTimestamp(): string {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format: YYYY-MM-DD HH:mm:ss WIB
  const parts = formatter.formatToParts(new Date());
  const mapping: Record<string, string> = {};
  for (const p of parts) {
    mapping[p.type] = p.value;
  }

  return `${mapping.year}-${mapping.month}-${mapping.day} ${mapping.hour}:${mapping.minute}:${mapping.second} WIB`;
}

/**
 * Mengisi template prompt dengan runtime context dinamis user
 */
export function buildFinbotPrompt(context: ContextInjectionData): string {
  const formattedTransactions =
    context.recentTransactions && context.recentTransactions.length > 0
      ? JSON.stringify(context.recentTransactions, null, 2)
      : '[] (Belum ada riwayat transaksi)';

  const formattedRules =
    context.userCustomRules && context.userCustomRules.length > 0
      ? context.userCustomRules.map((rule) => `- ${rule}`).join('\n')
      : '- Belum ada aturan preferensi khusus dari user.';

  const formattedMonthlySummary =
    context.monthlyBudgetSummary && context.monthlyBudgetSummary.trim()
      ? context.monthlyBudgetSummary.trim()
      : '- Belum ada transaksi tercatat di bulan berjalan.';

  let prompt = FINBOT_SYSTEM_PROMPT_TEMPLATE;
  prompt = prompt.replace('{{CURRENT_TIMESTAMP}}', context.currentTimestamp);
  prompt = prompt.replace('{{RECENT_TRANSACTIONS_JSON}}', formattedTransactions);
  prompt = prompt.replace('{{MONTHLY_BUDGET_SUMMARY}}', formattedMonthlySummary);
  prompt = prompt.replace('{{USER_CUSTOM_RULES}}', formattedRules);

  return prompt;
}
