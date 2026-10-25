import { prisma } from '../lib/prisma.js';
import { getCurrentWibTimestamp, buildFinbotPrompt } from '../prompts/promptBuilder.js';
import { TransactionService } from '../services/transaction.service.js';
import { RuleService } from '../services/rule.service.js';
import { FinbotResponseSchema } from '../schemas/finbotSchema.js';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PENGUJIAN FINBOT ENGINE - TONYY HOMELAB POSTGRESQL');
  console.log('🧪 ========================================================\n');

  // Test 1: WIB Timestamp
  console.log('1. Menguji Format Timestamp Asia/Jakarta (WIB)...');
  const wibTime = getCurrentWibTimestamp();
  console.log(`   ✅ Current WIB Time: "${wibTime}"`);
  if (!wibTime.includes('WIB')) throw new Error('Timestamp harus menyertakan zona waktu WIB');

  // Test 2: Context Injection & Prompt Builder
  console.log('\n2. Menguji Dynamic Context Injection ke Master Prompt Tonyy...');
  const recentTxs = await TransactionService.getRecentTransactions(5);
  const rules = await RuleService.getActiveRules();
  const summaryData = await TransactionService.getMonthlySummary();
  const monthlySummaryText = TransactionService.formatMonthlySummaryText(summaryData);

  const builtPrompt = buildFinbotPrompt({
    currentTimestamp: wibTime,
    recentTransactions: recentTxs,
    monthlyBudgetSummary: monthlySummaryText,
    userCustomRules: rules,
  });

  if (!builtPrompt.includes(wibTime)) throw new Error('WIB time gagal di-inject');
  if (!builtPrompt.includes('created_at')) throw new Error('Format created_at histori transaksi gagal di-inject');
  if (!builtPrompt.includes('Total Keluar:')) throw new Error('Monthly Budget Summary gagal di-inject');
  console.log('   ✅ Prompt Builder berhasil menginjeksi konteks dinamis runtime!');

  // Test 3: Output JSON Validation (Multi-item & Kategori Homelab)
  console.log('\n3. Menguji Validasi Zod Schema untuk Format JSON FinBot...');

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

  // Test 4: Database Transaction CRUD
  console.log('\n4. Menguji Database Transaction CRUD...');
  const created = await TransactionService.createTransactions([
    {
      target_id: null,
      type: 'EXPENSE',
      amount: 12000,
      category: 'Infrastruktur & Tech',
      class: 'Needs',
      description: 'Kabel LAN Cat6 patch homelab',
      is_micro_leak: false,
    },
  ], 'beli kabel lan 12k');
  const newTxId = created[0].id;
  console.log(`   ✅ CREATE Transaksi Berhasil: ID #${newTxId} (${created[0].category})`);

  // Test Update
  const { updated } = await TransactionService.updateTransaction(newTxId, {
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
  const summary = await TransactionService.getMonthlySummary();
  console.log(`   ✅ Total Pengeluaran: Rp${summary.totalExpense.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Needs: Rp${summary.needsTotal.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Wants: Rp${summary.wantsTotal.toLocaleString('id-ID')}`);
  console.log(`   ✅ Total Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} item)`);

  // Test 6: Learn Rule
  console.log('\n6. Menguji Rule Learning (LEARN_RULE)...');
  const newRule = await RuleService.addRule(
    'Mulai sekarang kalau beli snack di minimarket masukin Wants ya'
  );
  console.log(`   ✅ Rule Baru Tersimpan: "${newRule.ruleText}"`);

  // Cleanup test item
  await TransactionService.deleteTransaction(newTxId);
  console.log(`   ✅ DELETE Transaksi Berhasil: ID #${newTxId} dihapus.`);

  console.log('\n🎉 ========================================================');
  console.log('🎉 SEMUA PENGUJIAN BACKEND LULUS 100%!');
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
