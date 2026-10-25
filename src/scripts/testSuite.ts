import { prisma } from '../lib/prisma.js';
import { getCurrentWibTimestamp, buildFinbotPrompt } from '../prompts/promptBuilder.js';
import { TransactionService } from '../services/transaction.service.js';
import { RuleService } from '../services/rule.service.js';
import { FinbotResponseSchema } from '../schemas/finbotSchema.js';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PENGUJIAN FINBOT ENGINE - TONYY PERSONAL PRODUCTION');
  console.log('🧪 (Semarang / WIB - Homelab Docker / PostgreSQL Ready)');
  console.log('🧪 ========================================================\n');

  // Test 1: WIB Timestamp
  console.log('1. Menguji Format Timestamp Asia/Jakarta (WIB)...');
  const wibTime = getCurrentWibTimestamp();
  console.log(`   ✅ Current WIB Time: "${wibTime}"`);
  if (!wibTime.includes('WIB')) throw new Error('Timestamp harus menyertakan zona waktu WIB');

  // Dapatkan user seeded
  const user = await prisma.user.findFirst({
    where: { phoneNumber: '6281234567890' },
  });
  if (!user) throw new Error('User test belum di-seed.');

  // Test 2: Context Injection & Prompt Builder
  console.log('\n2. Menguji Dynamic Context Injection ke Master Prompt Tonyy...');
  const recentTxs = await TransactionService.getRecentTransactions(user.id, 5);
  const rules = await RuleService.getActiveRules(user.id);
  const summaryData = await TransactionService.getMonthlySummary(user.id);
  const monthlySummaryText = TransactionService.formatMonthlySummaryText(summaryData);

  const builtPrompt = buildFinbotPrompt({
    currentTimestamp: wibTime,
    recentTransactions: recentTxs,
    monthlyBudgetSummary: monthlySummaryText,
    userCustomRules: rules,
  });

  if (!builtPrompt.includes(wibTime)) throw new Error('WIB time gagal di-inject');
  if (!builtPrompt.includes('created_at')) throw new Error('Format created_at histori transaksi gagal di-inject');
  if (!builtPrompt.includes('Total Pengeluaran:')) throw new Error('Monthly Budget Summary gagal di-inject');
  if (!builtPrompt.includes('Infrastruktur & Tech')) throw new Error('User rules gagal di-inject');
  console.log('   ✅ Prompt Builder berhasil menginjeksi:');
  console.log('      • Timestamp WIB (Semarang)');
  console.log('      • Histori 5 transaksi terakhir');
  console.log('      • Ringkasan cashflow bulan berjalan');
  console.log('      • Aturan khusus & preferensi Tonyy (Infrastruktur & Tech, Transportasi, Wants)');

  // Test 3: Output JSON Validation (Multi-item & Kategori Homelab)
  console.log('\n3. Menguji Validasi Zod Schema untuk Format JSON FinBot...');

  // 3a. Intent CREATE (Bensin motor + Jajan + Server)
  const sampleCreateJson = {
    intent: 'CREATE',
    reply_message: '✅ *Transaksi Berhasil Dicatat:*\n• Bensin motor: *Rp30.000* (Transportasi - Needs)\n• Perpanjang domain: *150.000* (Infrastruktur & Tech - Needs)\n• Es kopi susu: *Rp22.000* (Hiburan & Wants)\n\n_💡 Radar Bocor Halus: Jajan kecil ini masuk pantauan ya!_',
    payload: {
      transactions: [
        {
          target_id: null,
          type: 'EXPENSE',
          amount: 30000,
          category: 'Transportasi',
          class: 'Needs',
          description: 'Bensin motor Pertalite',
          is_micro_leak: false,
        },
        {
          target_id: null,
          type: 'EXPENSE',
          amount: 150000,
          category: 'Infrastruktur & Tech',
          class: 'Needs',
          description: 'Perpanjang domain homelab',
          is_micro_leak: false,
        },
        {
          target_id: null,
          type: 'EXPENSE',
          amount: 22000,
          category: 'Hiburan & Wants',
          class: 'Wants',
          description: 'Es kopi susu',
          is_micro_leak: true,
        },
      ],
      new_rule: null,
    },
  };
  const validatedCreate = FinbotResponseSchema.parse(sampleCreateJson);
  console.log(`   ✅ CREATE Multi-item: Valid (${validatedCreate.payload.transactions.length} transaksi)`);

  // 3b. Intent CHAT_GENERAL
  const sampleChatGeneralJson = {
    intent: 'CHAT_GENERAL',
    reply_message: 'Halo Tonyy! FinBot siap mencatat pengeluaran atau cek status budget homelab.',
    payload: {
      transactions: [],
      new_rule: null,
    },
  };
  const validatedChat = FinbotResponseSchema.parse(sampleChatGeneralJson);
  console.log(`   ✅ CHAT_GENERAL: Valid ("${validatedChat.reply_message}")`);

  // Test 4: Database Transaction CRUD
  console.log('\n4. Menguji Database Transaction CRUD...');
  const created = await TransactionService.createTransactions(user.id, [
    {
      target_id: null,
      type: 'EXPENSE',
      amount: 12000,
      category: 'Infrastruktur & Tech',
      class: 'Needs',
      description: 'Kabel LAN Cat6 patch homelab',
      is_micro_leak: false,
    },
  ]);
  const newTxId = created[0].id;
  console.log(`   ✅ CREATE Transaksi Berhasil: ID #${newTxId} (${created[0].category})`);

  // Test Update
  const { updated } = await TransactionService.updateTransaction(user.id, newTxId, {
    target_id: newTxId,
    type: 'EXPENSE',
    amount: 15000,
    category: 'Infrastruktur & Tech',
    class: 'Needs',
    description: 'Kabel LAN Cat6 patch 2 meter',
    is_micro_leak: false,
  });
  console.log(`   ✅ UPDATE Transaksi Berhasil: Nominal diubah menjadi Rp${updated.amount.toLocaleString('id-ID')}`);

  // Test 5: Monthly Summary Calculation
  console.log('\n5. Menguji Kalkulasi Rekapitulasi Cashflow...');
  const summary = await TransactionService.getMonthlySummary(user.id);
  console.log(`   ✅ Total Pengeluaran: Rp${summary.totalExpense.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Needs: Rp${summary.needsTotal.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Wants: Rp${summary.wantsTotal.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} item)`);

  // Test 6: Learn Rule
  console.log('\n6. Menguji Rule Learning (LEARN_RULE)...');
  const newRule = await RuleService.addRule(
    user.id,
    'Mulai sekarang kalau beli snack di minimarket masukin Wants ya'
  );
  console.log(`   ✅ Rule Baru Tersimpan: "${newRule.ruleText}"`);

  // Cleanup test item
  await TransactionService.deleteTransaction(user.id, newTxId);
  console.log(`   ✅ DELETE Transaksi Berhasil: ID #${newTxId} dihapus.`);

  console.log('\n🎉 ========================================================');
  console.log('🎉 SEMUA PENGUJIAN TONYY PRODUCTION LULUS 100%!');
  console.log('🎉 ========================================================\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Error dalam pengujian:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
