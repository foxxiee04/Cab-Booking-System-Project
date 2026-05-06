FROM public.ecr.aws/docker/library/node:20-slim

WORKDIR /workspace/services/ride-service

# Prisma needs OpenSSL at runtime
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY services/ride-service/package*.json ./
RUN npm ci

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

# Copy service source and shared build artifacts
COPY services/ride-service .
COPY shared/dist /workspace/shared/dist

# Build TypeScript
RUN npx prisma generate && npm run build && cp -r src/generated dist/

EXPOSE 3002

CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else echo 'No prisma/migrations found; running prisma db push for dev startup' && npx prisma db push; fi && npx prisma generate && rm -rf dist/generated && cp -r src/generated dist/generated && node dist/index.js"]
