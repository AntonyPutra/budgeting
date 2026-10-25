# 🤖 FinBot AI Engine (Personal Production - Tonyy)

FinBot adalah core financial AI engine personal berbasis WhatsApp yang dirancang khusus untuk ekosistem server homelab Tonyy (**ThinkCentre Tiny / Proxmox VE**, Semarang / WIB). Menggunakan **PostgreSQL**, **Node.js/TypeScript**, **Google Gemini AI**, dan **Evolution API** di dalam jaringan terisolasi `budget_net`.

---

## 🏗️ Arsitektur Server Homelab (Zero Laptop Storage)

Semua layanan berjalan di server homelab sehingga laptop Anda bebas dari beban runtime dan penyimpanan:

```text
[ WhatsApp User: Tonyy ]
          │
          ▼
[ Evolution API Gateway ] (Port 8080)
          │ Webhook
          ▼
[ FinBot Backend Engine ] (Port 3000) ─── Google Gemini 2.5 Flash
          │
          ▼
[ PostgreSQL Database ] (/opt/finbot/data/postgres)
```

- **Jaringan Terisolasi**: Semua container terhubung di dalam Docker bridge network `budget_net`.
- **Persistensi Data Host**: Database PostgreSQL dimount ke `/opt/finbot/data/postgres` pada host ThinkCentre agar mudah di-backup (misal via `pg_dump` atau snapshot Proxmox).
- **Lokasi & Zona Waktu**: Semarang, Jawa Tengah (UTC+7 / WIB).

---

## 🏷️ Taksonomi Kategori Personal

1. `F&B`: Makan harian, warteg, resto, camilan, air galon.
2. `Transportasi`: Bensin motor, servis/tambal ban, ojol, parkir, tiket kereta/travel.
3. `Infrastruktur & Tech`: Pembayaran domain, server, VPS, cloud, perlengkapan homelab/elektronik.
4. `Kebutuhan Harian`: Belanja bulanan dapur, sabun/odol, perlengkapan kamar/rumah.
5. `Tagihan & Langganan`: Wifi, token listrik, pulsa data, SaaS.
6. `Hiburan & Wants`: Nongkrong cafe, kopi kekinian, game, belanja non-primer.
7. `Kesehatan & Pet`: Obat, suplemen, kebutuhan/perawatan hewan peliharaan.
8. `Lain-lain`: Pengeluaran tak terduga di luar kategori di atas.

---

## 🚀 Panduan Deploy di Homelab (Docker Compose)

### 1. Buat Direktori Data di Server Host
Di terminal ThinkCentre Tiny / Proxmox CT:
```bash
sudo mkdir -p /opt/finbot/data/postgres
sudo chown -R 1000:1000 /opt/finbot/data/postgres
```

### 2. Konfigurasi Environment (`.env`)
Salin file `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan nilainya:
```env
PORT=3000
NODE_ENV=production
TZ=Asia/Jakarta

# API Key Google Gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

# Database PostgreSQL
POSTGRES_USER=finbot
POSTGRES_PASSWORD=password_rahasia_homelab
POSTGRES_DB=monthlybudget

# Evolution API (WhatsApp Gateway Homelab)
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=your_evolution_api_key
EVOLUTION_INSTANCE_NAME=finbot
TONYY_WHATSAPP_NUMBER=6281234567890
```

### 3. Jalankan Docker Compose
```bash
docker compose up -d --build
```
Semua container (`finbot-app`, `postgres`, `budget_net`) akan aktif di background.

---

## ⏰ Cronjob Evaluasi Rekap Bulanan Otomatis

Setiap tanggal 1 pukul 08:00 WIB, server akan:
1. Menghitung total cashflow, rasio *Needs* vs *Wants*, dan akumulasi *bocor halus*.
2. Meminta Gemini membuat 3 evaluasi konkret & tajam.
3. Mengirimkan pesan rekap ke WhatsApp Tonyy via Evolution API.

Tambahkan jadwal berikut ke crontab host server (`crontab -e`):
```cron
# Rekap FinBot setiap tanggal 1 jam 08:00 WIB
0 8 1 * * docker exec finbot-app npm run recap >> /var/log/finbot_recap.log 2>&1
```

*Untuk menguji rekap bulan berjalan langsung:*
```bash
npm run recap -- --current
# atau via Docker:
docker exec finbot-app npm run recap -- --current
```

---

## 💬 Contoh Format Pesan WhatsApp Native

```text
✅ *Transaksi Berhasil Dicatat:*
• Bensin motor Pertalite: *Rp30.000* (Transportasi - Needs)
• Es Kopi Susu: *Rp25.000* (Hiburan & Wants)

_💡 Radar Bocor Halus: Jajan kecil ini masuk pantauan ya!_
```
