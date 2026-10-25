import { prisma } from '../lib/prisma.js';
import { TransactionService } from './transaction.service.js';
import { RuleService } from './rule.service.js';
import { GeminiService } from './gemini.service.js';
import { buildFinbotPrompt, getCurrentWibTimestamp } from '../prompts/promptBuilder.js';
import { FinbotResponse } from '../types/finbot.js';

export interface ProcessMessageResult {
  replyMessage: string;
  finbotResponse: FinbotResponse;
  executionDetails?: any;
}

export class FinbotService {
  /**
   * Memproses satu pesan masuk dari user WhatsApp
   */
  static async processUserMessage(
    phoneNumber: string,
    messageText: string,
    userName?: string
  ): Promise<ProcessMessageResult> {
    // 1. Dapatkan atau buat user di database
    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: { name: userName || undefined },
      create: {
        phoneNumber,
        name: userName || 'User',
      },
    });

    // 2. Ambil konteks dinamis:
    //    - Histori 5 transaksi terakhir
    //    - Ringkasan status keuangan bulan berjalan
    //    - Preferensi dan aturan khusus user
    const recentTransactions = await TransactionService.getRecentTransactions(user.id, 5);
    const userCustomRules = await RuleService.getActiveRules(user.id);
    const monthlySummaryData = await TransactionService.getMonthlySummary(user.id);
    const monthlyBudgetSummary = TransactionService.formatMonthlySummaryText(monthlySummaryData);
    const currentTimestamp = getCurrentWibTimestamp();

    // 3. Bangun prompt dengan Context Injection otomatis
    const systemPrompt = buildFinbotPrompt({
      currentTimestamp,
      recentTransactions,
      monthlyBudgetSummary,
      userCustomRules,
    });

    // 4. Panggil Gemini AI Engine
    const finbotResponse = await GeminiService.generateFinbotResponse(
      systemPrompt,
      messageText
    );

    // 5. Eksekusi database side-effects berdasarkan intent
    let executionDetails: any = null;

    switch (finbotResponse.intent) {
      case 'CREATE': {
        if (finbotResponse.payload.transactions?.length > 0) {
          executionDetails = await TransactionService.createTransactions(
            user.id,
            finbotResponse.payload.transactions
          );
        }
        break;
      }

      case 'UPDATE': {
        const itemToUpdate = finbotResponse.payload.transactions?.[0];
        if (itemToUpdate && itemToUpdate.target_id) {
          executionDetails = await TransactionService.updateTransaction(
            user.id,
            itemToUpdate.target_id,
            itemToUpdate
          );
        }
        break;
      }

      case 'DELETE': {
        const itemToDelete = finbotResponse.payload.transactions?.[0];
        if (itemToDelete && itemToDelete.target_id) {
          executionDetails = await TransactionService.deleteTransaction(
            user.id,
            itemToDelete.target_id
          );
        }
        break;
      }

      case 'LEARN_RULE': {
        if (finbotResponse.payload.new_rule) {
          executionDetails = await RuleService.addRule(
            user.id,
            finbotResponse.payload.new_rule
          );
        }
        break;
      }

      case 'QUERY':
      case 'CHAT_GENERAL': {
        // Query & obrolan santai tidak mengubah data di database
        executionDetails = { type: finbotResponse.intent };
        break;
      }
    }

    return {
      replyMessage: finbotResponse.reply_message,
      finbotResponse,
      executionDetails,
    };
  }
}
