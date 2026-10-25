import { prisma } from '../lib/prisma.js';
import { FinbotTransactionItem, RecentTransactionContext } from '../types/finbot.js';

export class TransactionService {
  /**
   * Mengambil 5 transaksi terakhir untuk disuntikkan ke prompt
   */
  static async getRecentTransactions(limit = 5): Promise<RecentTransactionContext[]> {
    const records = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

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

    return records.map((r) => {
      const parts = formatter.formatToParts(r.createdAt);
      const mapping: Record<string, string> = {};
      for (const p of parts) mapping[p.type] = p.value;
      const formattedTime = `${mapping.year}-${mapping.month}-${mapping.day} ${mapping.hour}:${mapping.minute}:${mapping.second}`;

      return {
        id: Number(r.id),
        type: r.type,
        amount: Number(r.amount),
        category: r.category,
        class: r.class,
        desc: r.description || '',
        created_at: formattedTime,
      };
    });
  }

  /**
   * Menyimpan 1 atau beberapa transaksi baru (CREATE)
   */
  static async createTransactions(
    items: FinbotTransactionItem[],
    rawMessage?: string
  ) {
    const createdList = [];
    for (const item of items) {
      const tx = await prisma.transaction.create({
        data: {
          type: item.type,
          amount: Math.round(item.amount),
          category: item.category,
          class: item.class,
          description: item.description,
          isMicroLeak: item.is_micro_leak,
          rawMessage: rawMessage || null,
          createdAt: new Date(),
        },
      });
      createdList.push({
        ...tx,
        id: Number(tx.id),
        amount: Number(tx.amount),
      });
    }
    return createdList;
  }

  /**
   * Mengoreksi transaksi sebelumnya (UPDATE)
   */
  static async updateTransaction(
    targetId: number,
    item: FinbotTransactionItem
  ) {
    const existing = await prisma.transaction.findUnique({
      where: { id: BigInt(targetId) },
    });

    if (!existing) {
      throw new Error(`Transaksi dengan ID #${targetId} tidak ditemukan.`);
    }

    const updated = await prisma.transaction.update({
      where: { id: BigInt(targetId) },
      data: {
        type: item.type ?? existing.type,
        amount: item.amount ? Math.round(item.amount) : existing.amount,
        category: item.category || existing.category,
        class: item.class || existing.class,
        description: item.description || existing.description,
        isMicroLeak:
          typeof item.is_micro_leak === 'boolean'
            ? item.is_micro_leak
            : existing.isMicroLeak,
      },
    });

    return {
      old: { ...existing, id: Number(existing.id), amount: Number(existing.amount) },
      updated: { ...updated, id: Number(updated.id), amount: Number(updated.amount) },
    };
  }

  /**
   * Menghapus transaksi (DELETE)
   */
  static async deleteTransaction(targetId: number) {
    const existing = await prisma.transaction.findUnique({
      where: { id: BigInt(targetId) },
    });

    if (!existing) {
      throw new Error(`Transaksi dengan ID #${targetId} tidak ditemukan.`);
    }

    await prisma.transaction.delete({
      where: { id: BigInt(targetId) },
    });

    return { ...existing, id: Number(existing.id), amount: Number(existing.amount) };
  }

  /**
   * Menghitung rekapitulasi cashflow bulan berjalan
   */
  static async getMonthlySummary(month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalExpense = 0;
    let totalIncome = 0;
    let needsTotal = 0;
    let wantsTotal = 0;
    let microLeakTotal = 0;
    let microLeakCount = 0;

    const categoryBreakdown: Record<string, number> = {};

    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.type === 'EXPENSE') {
        totalExpense += amt;
        if (t.class === 'Needs') needsTotal += amt;
        if (t.class === 'Wants') wantsTotal += amt;
        if (t.isMicroLeak) {
          microLeakTotal += amt;
          microLeakCount += 1;
        }

        categoryBreakdown[t.category] =
          (categoryBreakdown[t.category] || 0) + amt;
      } else if (t.type === 'INCOME') {
        totalIncome += amt;
      }
    }

    return {
      month: targetMonth,
      year: targetYear,
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      needsTotal,
      wantsTotal,
      microLeakTotal,
      microLeakCount,
      categoryBreakdown,
      transactionCount: transactions.length,
      transactions: transactions.map((t) => ({
        ...t,
        id: Number(t.id),
        amount: Number(t.amount),
      })),
    };
  }

  /**
   * Memformat ringkasan keuangan ke dalam format teks bullet
   */
  static formatMonthlySummaryText(summary: {
    totalIncome: number;
    totalExpense: number;
    needsTotal: number;
    wantsTotal: number;
    microLeakTotal: number;
    microLeakCount: number;
    categoryBreakdown: Record<string, number>;
  }): string {
    const lines = [
      `- Total Masuk: Rp${summary.totalIncome.toLocaleString('id-ID')}`,
      `- Total Keluar: Rp${summary.totalExpense.toLocaleString('id-ID')}`,
      `- Needs (Esensial): Rp${summary.needsTotal.toLocaleString('id-ID')} | Wants: Rp${summary.wantsTotal.toLocaleString('id-ID')}`,
    ];

    if (summary.microLeakTotal > 0) {
      lines.push(
        `- Total Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} transaksi)`
      );
    }

    const categories = Object.entries(summary.categoryBreakdown);
    if (categories.length > 0) {
      const topCategories = categories
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, amt]) => `${cat}: Rp${amt.toLocaleString('id-ID')}`)
        .join(', ');
      lines.push(`- Kategori Terbesar: ${topCategories}`);
    }

    return lines.join('\n');
  }
}
