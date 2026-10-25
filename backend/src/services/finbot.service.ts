import { TransactionService } from './transaction.service.js';
import { RuleService } from './rule.service.js';
import { GeminiService } from './gemini.service.js';
import { EvolutionApiService } from './evolutionApi.service.js';
import { buildFinbotPrompt, getCurrentWibTimestamp } from '../prompts/promptBuilder.js';
import { FinbotResponse } from '../types/finbot.js';

export interface ProcessMessageResult {
  replyMessage: string;
  finbotResponse: FinbotResponse;
  executionDetails?: any;
}

export class FinbotService {
  /**
   * Memproses pesan masuk dari WhatsApp Tonyy
   */
  static async processUserMessage(
    senderPhone: string,
    messageText: string,
    sendWhatsAppReply = true,
    userName = 'Tonyy',
    recipientTargetPhone?: string
  ): Promise<ProcessMessageResult> {
    // 1. Ambil runtime context dinamis dari PostgreSQL
    const recentTransactions = await TransactionService.getRecentTransactions(5);
    const userCustomRules = await RuleService.getActiveRules();
    const monthlySummaryData = await TransactionService.getMonthlySummary();
    const monthlyBudgetSummary = TransactionService.formatMonthlySummaryText(monthlySummaryData);
    const currentTimestamp = getCurrentWibTimestamp();

    // 2. Susun system prompt dengan injeksi context
    const systemPrompt = buildFinbotPrompt({
      currentTimestamp,
      recentTransactions,
      monthlyBudgetSummary,
      userCustomRules,
    });

    // 3. Panggil Gemini AI Engine
    const finbotResponse = await GeminiService.generateFinbotResponse(
      systemPrompt,
      messageText
    );

    // 4. Eksekusi database side-effects berdasarkan intent
    let executionDetails: any = null;

    switch (finbotResponse.intent) {
      case 'CREATE': {
        if (finbotResponse.payload.transactions?.length > 0) {
          executionDetails = await TransactionService.createTransactions(
            finbotResponse.payload.transactions,
            messageText,
            userName,
            senderPhone
          );
        }
        break;
      }

      case 'UPDATE': {
        const itemToUpdate = finbotResponse.payload.transactions?.[0];
        if (itemToUpdate && itemToUpdate.target_id) {
          executionDetails = await TransactionService.updateTransaction(
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
            itemToDelete.target_id
          );
        }
        break;
      }

      case 'LEARN_RULE': {
        if (finbotResponse.payload.new_rule) {
          executionDetails = await RuleService.addRule(
            finbotResponse.payload.new_rule
          );
        }
        break;
      }

      case 'QUERY':
      case 'CHAT_GENERAL': {
        executionDetails = { type: finbotResponse.intent };
        break;
      }
    }

    // 5. Kirim balasan WhatsApp langsung ke target (DM pengirim atau Grup) via Evolution API
    const target = recipientTargetPhone || senderPhone;
    if (sendWhatsAppReply && target) {
      await EvolutionApiService.sendTextMessage(target, finbotResponse.reply_message);
    }

    return {
      replyMessage: finbotResponse.reply_message,
      finbotResponse,
      executionDetails,
    };
  }
}
