# ==========================================
# 1. Build Stage
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps
RUN npx prisma generate

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ==========================================
# 2. Production Stage
# ==========================================
FROM node:20-slim

WORKDIR /app

# 🌟 ติดตั้งแค่ openssl สำหรับ Prisma ก็พอแล้ว ไม่ต้องแบก LibreOffice อีกต่อไป!
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p public

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "echo '🔍 Checking file structure...'; if [ -f dist/main.js ]; then node dist/main.js; elif [ -f dist/src/main.js ]; then node dist/src/main.js; else echo '❌ FATAL: main.js NOT FOUND!'; ls -R dist; exit 1; fi"]