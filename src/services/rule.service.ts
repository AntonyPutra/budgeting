import { prisma } from '../lib/prisma.js';

export class RuleService {
  /**
   * Mendapatkan daftar aturan aktif milik user dalam bentuk array string
   */
  static async getActiveRules(userId: number): Promise<string[]> {
    const rules = await prisma.userRule.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((r) => r.ruleText);
  }

  /**
   * Menyimpan aturan baru yang dipelajari FinBot dari percakapan (intent: LEARN_RULE)
   */
  static async addRule(userId: number, ruleText: string) {
    return prisma.userRule.create({
      data: {
        userId,
        ruleText: ruleText.trim(),
        isActive: true,
      },
    });
  }

  /**
   * Menonaktifkan aturan tertentu
   */
  static async deactivateRule(userId: number, ruleId: number) {
    return prisma.userRule.updateMany({
      where: { id: ruleId, userId },
      data: { isActive: false },
    });
  }
}
