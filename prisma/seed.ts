import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data untuk Tonyy (Personal Production)...');

  const phoneNumber = '6281234567890';
  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: {},
    create: {
      phoneNumber,
      name: 'Tonyy',
    },
  });

  // Bersihkan data lama
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.userRule.deleteMany({ where: { userId: user.id } });

  // Aturan khusus user Tonyy
  const rules = [
    'Pengeluaran bensin, servis motor, parkir masuk ke "Transportasi".',
    'Pengeluaran langganan domain, VPS, cloud, alat lab masuk ke "Infrastruktur & Tech".',
    'Kopi cafe/kekinian selalu masuk "Hiburan & Wants".',
  ];

  for (const rule of rules) {
    await prisma.userRule.create({
      data: {
        userId: user.id,
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
        userId: user.id,
        type: 'EXPENSE',
        amount: 25000,
        category: 'F&B',
        class: 'Wants',
        description: 'Es Kopi Susu',
        isMicroLeak: true,
        timestamp: new Date(now.getTime() - 2 * 3600 * 1000), // 2 jam lalu
      },
      {
        userId: user.id,
        type: 'EXPENSE',
        amount: 30000,
        category: 'Transportasi',
        class: 'Needs',
        description: 'Bensin motor Pertalite',
        isMicroLeak: false,
        timestamp: new Date(now.getTime() - 1 * 3600 * 1000), // 1 jam lalu
      },
    ],
  });

  console.log(`Seeding selesai! User ID: ${user.id} (${user.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
