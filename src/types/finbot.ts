export type Intent =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'QUERY'
  | 'LEARN_RULE'
  | 'CHAT_GENERAL';

export type TransactionType = 'EXPENSE' | 'INCOME';

export type BudgetCategory =
  | 'F&B'
  | 'Transportasi'
  | 'Infrastruktur & Tech'
  | 'Kebutuhan Harian'
  | 'Tagihan & Langganan'
  | 'Hiburan & Wants'
  | 'Kesehatan & Pet'
  | 'Lain-lain';

export type BudgetClass = 'Needs' | 'Wants';

export interface FinbotTransactionItem {
  target_id: number | null;
  type: TransactionType;
  amount: number;
  category: BudgetCategory | string;
  class: BudgetClass;
  description: string;
  is_micro_leak: boolean;
}

export interface FinbotPayload {
  transactions: FinbotTransactionItem[];
  new_rule: string | null;
}

export interface FinbotResponse {
  intent: Intent;
  reply_message: string;
  payload: FinbotPayload;
}

export interface RecentTransactionContext {
  id: number;
  type: string;
  amount: number;
  category: string;
  class: string;
  desc: string;
  created_at: string; // YYYY-MM-DD HH:mm:ss (WIB)
}

export interface ContextInjectionData {
  currentTimestamp: string;
  recentTransactions: RecentTransactionContext[];
  monthlyBudgetSummary?: string;
  userCustomRules: string[];
}
