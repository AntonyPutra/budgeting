import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PostgreSQL initial data untuk Tonyy (Personal Production)...');

  // Bersihkan data lama jika ada
  await prisma.transaction.deleteMany({});
  await prisma.userRule.deleteMany({});

  // Aturan awal sesuai preferensi Tonyy
  const rules = [
    'Pengeluaran bensin, servis motor, dan parkir dikelompokkan ke kategori Transportasi',
    'Kopi kekinian / cafe selalu dikelompokkan ke kategori Hiburan & Wants',
    'Pengeluaran langganan domain, VPS, cloud, alat lab masuk ke "Infrastruktur & Tech"',
    'Pengeluaran impulsif atau jajan receh non-esensial <= Rp30.000 tandai is_micro_leak = true',
  ];

  for (const rule of rules) {
    await prisma.userRule.create({
      data: {
        ruleText: rule,
        isActive: true,
      },
    });
  }

  // 2 Transaksi awal sebagai histori
  const now = new Date();
  await prisma.transaction.createMany({
    data: [
      {
        type: 'EXPENSE',
        amount: 25000,
        category: 'F&B',
        class: 'Wants',
        description: 'Es Kopi Susu',
        isMicroLeak: true,
        rawMessage: 'kopi susu 25k',
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000), // 2 jam lalu
      },
      {
        type: 'EXPENSE',
        amount: 30000,
        category: 'Transportasi',
        class: 'Needs',
        description: 'Bensin motor Pertalite',
        isMicroLeak: false,
        rawMessage: 'bensin 30rb',
        createdAt: new Date(now.getTime() - 1 * 3600 * 1000), // 1 jam lalu
      },
    ],
  });

  console.log('Seeding PostgreSQL selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
