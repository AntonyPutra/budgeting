#!/bin/bash
set -e

echo "=================================================="
echo "🚀 DEPLOYING FINBOT TO HOMELAB SERVER (SEMARANG)"
echo "=================================================="

# Pastikan file .env ada
if [ ! -f .env ]; then
  echo "⚠️  File .env tidak ditemukan. Menyalin dari .env.example..."
  cp .env.example .env
  echo "ℹ️  Silakan lengkapi GEMINI_API_KEY di file .env sebelum melanjutkan."
fi

# Build and start all services
echo "📦 Building & starting Docker containers..."
docker compose up -d --build

echo ""
echo "✅ DEPLOYMENT BERHASIL!"
echo "=================================================="
echo "🌐 Evolution API:      http://100.73.16.92:8081"
echo "📊 Web Dashboard:      http://100.73.16.92:3002"
echo "📡 Backend API:        http://100.73.16.92:8001"
echo "🗄️  PostgreSQL (Mac):   100.73.16.92:5434 (DB: finbot_db, User: finbot_user)"
echo "🔗 Webhook URL di WA:  http://finbot-backend:8000/webhook/wa"
echo "=================================================="
