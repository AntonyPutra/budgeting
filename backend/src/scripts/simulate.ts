import readline from 'readline';
import { FinbotService } from '../services/finbot.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { RuleService } from '../services/rule.service.js';
import { prisma } from '../lib/prisma.js';

const DEMO_PHONE = '6281234567890';

async function printStatus() {
  const recentTxs = await TransactionService.getRecentTransactions(5);
  const rules = await RuleService.getActiveRules();
  const summary = await TransactionService.getMonthlySummary();

  console.log('\n------------------ [STATUS DATA HOMELAB] ------------------');
  console.log(`👤 User: Tonyy (${DEMO_PHONE})`);
  console.log(`💰 Pengeluaran Bulan Ini: Rp${summary.totalExpense.toLocaleString('id-ID')}`);
  console.log(`   • Needs: Rp${summary.needsTotal.toLocaleString('id-ID')}`);
  console.log(`   • Wants: Rp${summary.wantsTotal.toLocaleString('id-ID')}`);
  console.log(
    `   • Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} transaksi)`
  );

  console.log('\n📜 Aturan Khusus (User Rules):');
  if (rules.length === 0) {
    console.log('   (Belum ada aturan)');
  } else {
    rules.forEach((r, idx) => console.log(`   ${idx + 1}. ${r}`));
  }

  console.log('\n🧾 5 Transaksi Terakhir:');
  if (recentTxs.length === 0) {
    console.log('   (Belum ada transaksi)');
  } else {
    recentTxs.forEach((t) => {
      console.log(
        `   [#${t.id}] ${t.created_at} | ${t.type} | Rp${t.amount.toLocaleString(
          'id-ID'
        )} | ${t.category} (${t.class}) | "${t.desc}"`
      );
    });
  }
  console.log('-----------------------------------------------------------\n');
}

async function startSimulation() {
  console.log(`
==================================================
🤖 FINBOT INTERACTIVE SIMULATOR (HOMELAB CLI)
==================================================
Ketik pesan WhatsApp seolah-olah kamu adalah Tonyy.
Contoh pesan:
  • "Bensin motor 30k sama bayar domain 150rb"
  • "Kopi susu 25rb" (akan dideteksi bocor halus)
  • "salah, tadi kopi 20rb bukan 25rb" (koreksi update)
  • "batalin yang barusan" (delete transaksi)
  • "Mulai sekarang beli snack di minimarket masukin Wants" (learn rule)
  • "status" (melihat database transaksi saat ini)
  • "exit" / "quit" (keluar)
==================================================
  `);

  await printStatus();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('💬 Tonyy: ', async (input) => {
      const text = input.trim();

      if (!text) {
        promptUser();
        return;
      }

      if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
        console.log('Keluar dari simulator.');
        rl.close();
        await prisma.$disconnect();
        process.exit(0);
      }

      if (text.toLowerCase() === 'status') {
        await printStatus();
        promptUser();
        return;
      }

      try {
        console.log('⏳ FinBot sedang memproses...');
        const result = await FinbotService.processUserMessage(
          DEMO_PHONE,
          text,
          false // jangan dispatch ke WA riil saat mode CLI simulasi
        );

        console.log('\n--- [AI RAW PARSED PAYLOAD] ---');
        console.log(JSON.stringify(result.finbotResponse, null, 2));
        console.log('------------------------------');

        console.log('\n📱 [BALASAN WHATSAPP USER]:');
        console.log(result.replyMessage);
        console.log('-----------------------------------------------------------\n');
      } catch (err: any) {
        console.error('❌ Terjadi kesalahan:', err.message);
      }

      promptUser();
    });
  };

  promptUser();
}

startSimulation().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
