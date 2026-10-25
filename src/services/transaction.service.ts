import { prisma } from '../lib/prisma.js';
import { FinbotTransactionItem, RecentTransactionContext } from '../types/finbot.js';

export class TransactionService {
  /**
   * Mengambil 5 transaksi terakhir user untuk disuntikkan ke prompt
   */
  static async getRecentTransactions(
    userId: number,
    limit = 5
  ): Promise<RecentTransactionContext[]> {
    const records = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
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
      const parts = formatter.formatToParts(r.timestamp);
      const mapping: Record<string, string> = {};
      for (const p of parts) mapping[p.type] = p.value;
      const formattedTime = `${mapping.year}-${mapping.month}-${mapping.day} ${mapping.hour}:${mapping.minute}:${mapping.second}`;

      return {
        id: r.id,
        type: r.type,
        amount: r.amount,
        category: r.category,
        class: r.class,
        desc: r.description,
        created_at: formattedTime,
      };
    });
  }

  /**
   * Menyimpan 1 atau lebih transaksi baru (CREATE)
   */
  static async createTransactions(userId: number, items: FinbotTransactionItem[]) {
    const createdList = [];
    for (const item of items) {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          type: item.type,
          amount: Math.round(item.amount),
          category: item.category,
          class: item.class,
          description: item.description,
          isMicroLeak: item.is_micro_leak,
          timestamp: new Date(),
        },
      });
      createdList.push(tx);
    }
    return createdList;
  }

  /**
   * Mengoreksi transaksi sebelumnya (UPDATE)
   */
  static async updateTransaction(
    userId: number,
    targetId: number,
    item: FinbotTransactionItem
  ) {
    const existing = await prisma.transaction.findFirst({
      where: { id: targetId, userId },
    });

    if (!existing) {
      throw new Error(`Transaksi dengan ID #${targetId} tidak ditemukan.`);
    }

    const updated = await prisma.transaction.update({
      where: { id: targetId },
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

    return { old: existing, updated };
  }

  /**
   * Menghapus transaksi (DELETE)
   */
  static async deleteTransaction(userId: number, targetId: number) {
    const existing = await prisma.transaction.findFirst({
      where: { id: targetId, userId },
    });

    if (!existing) {
      throw new Error(`Transaksi dengan ID #${targetId} tidak ditemukan.`);
    }

    await prisma.transaction.delete({
      where: { id: targetId },
    });

    return existing;
  }

  /**
   * Menghitung rekapitulasi keuangan bulan berjalan
   */
  static async getMonthlySummary(userId: number, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let totalExpense = 0;
    let totalIncome = 0;
    let needsTotal = 0;
    let wantsTotal = 0;
    let microLeakTotal = 0;
    let microLeakCount = 0;

    const categoryBreakdown: Record<string, number> = {};

    for (const t of transactions) {
      if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
        if (t.class === 'Needs') needsTotal += t.amount;
        if (t.class === 'Wants') wantsTotal += t.amount;
        if (t.isMicroLeak) {
          microLeakTotal += t.amount;
          microLeakCount += 1;
        }

        categoryBreakdown[t.category] =
          (categoryBreakdown[t.category] || 0) + t.amount;
      } else if (t.type === 'INCOME') {
        totalIncome += t.amount;
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
    };
  }

  /**
   * Memformat ringkasan keuangan bulanan ke dalam teks bullet untuk di-inject ke prompt
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
      `- Total Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}`,
      `- Total Pengeluaran: Rp${summary.totalExpense.toLocaleString('id-ID')}`,
      `- Kebutuhan (Needs): Rp${summary.needsTotal.toLocaleString('id-ID')} | Keinginan (Wants): Rp${summary.wantsTotal.toLocaleString('id-ID')}`,
    ];

    if (summary.microLeakTotal > 0) {
      lines.push(
        `- Radar Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} transaksi)`
      );
    }

    const categories = Object.entries(summary.categoryBreakdown);
    if (categories.length > 0) {
      const topCategories = categories
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, amt]) => `${cat}: Rp${amt.toLocaleString('id-ID')}`)
        .join(', ');
      lines.push(`- Pengeluaran Terbesar: ${topCategories}`);
    }

    return lines.join('\n');
  }
}
