# ==========================================
# Multi-stage Dockerfile for FinBot Backend
# Optimized for Homelab (Docker / Proxmox VE)
# ==========================================

# 1. Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

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
ENV PORT=8000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/index.js"]
