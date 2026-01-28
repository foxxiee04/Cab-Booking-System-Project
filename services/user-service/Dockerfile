FROM node:20-slim

WORKDIR /app

# Prisma needs OpenSSL at runtime
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build && cp -r src/generated dist/ 2>/dev/null || true

EXPOSE 3007

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
