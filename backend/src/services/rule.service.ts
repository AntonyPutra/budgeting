import { prisma } from '../lib/prisma.js';

export class RuleService {
  /**
   * Mendapatkan daftar aturan aktif dalam bentuk array string
   */
  static async getActiveRules(): Promise<string[]> {
    const rules = await prisma.userRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((r) => r.ruleText);
  }

  /**
   * Menyimpan aturan baru yang dipelajari FinBot dari percakapan (intent: LEARN_RULE)
   */
  static async addRule(ruleText: string) {
    return prisma.userRule.create({
      data: {
        ruleText: ruleText.trim(),
        isActive: true,
      },
    });
  }

  /**
   * Menonaktifkan aturan tertentu
   */
  static async deactivateRule(ruleId: number) {
    return prisma.userRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }
}
