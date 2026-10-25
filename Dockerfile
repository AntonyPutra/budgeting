# ==========================================
# Multi-stage Dockerfile for FinBot Engine
# Optimized for Homelab (Docker / Proxmox VE)
# ==========================================

# 1. Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src/
RUN npm run build
RUN npx prisma generate

# 2. Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl tzdata libc6-compat

# Set Timezone to Asia/Jakarta (WIB)
ENV TZ=Asia/Jakarta
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

# Create volume mount point for SQLite (if not using Postgres)
RUN mkdir -p /app/data

EXPOSE 3000

# Entrypoint script to run migrations and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
