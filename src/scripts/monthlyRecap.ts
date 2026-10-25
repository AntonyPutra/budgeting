import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { TransactionService } from '../services/transaction.service.js';
import { EvolutionApiService } from '../services/evolutionApi.service.js';

/**
 * Script Evaluasi Rekap Bulanan Otomatis
 * Dijalankan via cronjob server setiap tanggal 1 pukul 08:00 WIB
 */
async function generateAndSendMonthlyRecap(targetPhoneNumber?: string) {
  const recipientPhone = targetPhoneNumber || env.TONYY_WHATSAPP_NUMBER;
  console.log(`[Cron Recap] Menjalankan evaluasi bulanan untuk: ${recipientPhone}...`);

  const user = await prisma.user.findFirst({
    where: { phoneNumber: recipientPhone },
  });

  if (!user) {
    console.warn(`[Cron Recap] User dengan nomor ${recipientPhone} tidak ditemukan di database.`);
    return;
  }

  // Tentukan bulan yang dievaluasi (default: bulan lalu, atau bulan berjalan jika ada argumen --current)
  const isCurrentMonth = process.argv.includes('--current');
  const now = new Date();
  let prevMonth = isCurrentMonth ? now.getMonth() + 1 : now.getMonth();
  let prevYear = now.getFullYear();
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = monthNames[prevMonth - 1];

  console.log(`[Cron Recap] Mengagregasi data untuk periode: ${monthName} ${prevYear}`);
  const summary = await TransactionService.getMonthlySummary(user.id, prevMonth, prevYear);

  if (summary.totalExpense === 0 && summary.totalIncome === 0) {
    console.log(`[Cron Recap] Tidak ada transaksi pada periode ${monthName} ${prevYear}.`);
    return;
  }

  // Hitung rasio Needs vs Wants
  const totalExpense = summary.totalExpense || 1; // cegah pembagian nol
  const needsRatio = Math.round((summary.needsTotal / totalExpense) * 100);
  const wantsRatio = Math.round((summary.wantsTotal / totalExpense) * 100);

  // Minta Gemini membuat 3 evaluasi tajam & to-the-point
  let aiEvaluations = '1. Pertahankan rasio kebutuhan pokok.\n2. Awasi transaksi jajan kecil.\n3. Alokasikan sisa cashflow ke tabungan.';

  if (env.GEMINI_API_KEY) {
    try {
      const prompt = `Kamu adalah FinBot, asisten keuangan pribadi Tonyy di Semarang (server homelab ThinkCentre).
Berikut agregasi keuangan bulan ${monthName} ${prevYear}:
- Total Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp${summary.totalExpense.toLocaleString('id-ID')}
- Rasio Needs: ${needsRatio}% (Rp${summary.needsTotal.toLocaleString('id-ID')})
- Rasio Wants: ${wantsRatio}% (Rp${summary.wantsTotal.toLocaleString('id-ID')})
- Dana Bocor Halus: Rp${summary.microLeakTotal.toLocaleString('id-ID')} (${summary.microLeakCount} transaksi)
- Top Kategori: ${Object.entries(summary.categoryBreakdown)
        .map(([k, v]) => `${k}: Rp${v.toLocaleString('id-ID')}`)
        .join(', ')}

Tugasmu: Buat TEPAT 3 butir evaluasi finansial konkret, tajam, dan santai tanpa basa-basi untuk WhatsApp. Berikan insight actionable atas pengeluaran atau bocor halusnya. Gunakan bullet point (•) dan bold (*). Output teks saja tanpa pembungkus json.`;

      const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        aiEvaluations = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || aiEvaluations;
      }
    } catch (err: any) {
      console.error('[Cron Recap] Gagal memanggil Gemini untuk saran:', err.message);
    }
  }

  // Susun template pesan WhatsApp native
  const message = `📊 *REKAPITULASI KEUANGAN - ${monthName.toUpperCase()} ${prevYear}*
Halo Tonyy! Berikut ringkasan cashflow dan audit pengeluaran bulan lalu dari homelab:

💵 *Cashflow:*
• Total Pemasukan: *Rp${summary.totalIncome.toLocaleString('id-ID')}*
• Total Pengeluaran: *Rp${summary.totalExpense.toLocaleString('id-ID')}*
• Selisih / Tabungan: *Rp${summary.netSavings.toLocaleString('id-ID')}*

⚖️ *Rasio Pengeluaran:*
• Needs (Esensial): *${needsRatio}%* (Rp${summary.needsTotal.toLocaleString('id-ID')})
• Wants (Keinginan): *${wantsRatio}%* (Rp${summary.wantsTotal.toLocaleString('id-ID')})

⚠️ *Audit Bocor Halus:*
• Total Dana Hilang: *Rp${summary.microLeakTotal.toLocaleString('id-ID')}*
• Frekuensi: *${summary.microLeakCount} kali transaksi kecil*

💡 *3 Evaluasi & Rekomendasi FinBot:*
${aiEvaluations}

_Data diproses otomatis dari PostgreSQL server homelab (Semarang/WIB)._`;

  console.log('\n--- [PREVIEW PESAN REKAP BULANAN] ---');
  console.log(message);
  console.log('-------------------------------------\n');

  // Kirim ke WhatsApp via Evolution API
  const sent = await EvolutionApiService.sendTextMessage(recipientPhone, message);
  if (sent) {
    console.log(`[Cron Recap] Rekapitulasi bulanan sukses terkirim ke WhatsApp ${recipientPhone}`);
  } else {
    console.log(`[Cron Recap] Rekapitulasi dicetak lokal (Evolution API offline/belum dikonfigurasi).`);
  }
}

// Eksekusi jika dijalankan langsung via CLI / crontab
generateAndSendMonthlyRecap()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
