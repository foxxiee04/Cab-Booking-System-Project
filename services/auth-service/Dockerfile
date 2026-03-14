FROM node:20-alpine

WORKDIR /workspace/services/auth-service

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install dependencies
COPY services/auth-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

# Copy service source and shared build artifacts
COPY services/auth-service .
COPY shared/dist /workspace/shared/dist

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else echo 'No prisma/migrations found; running prisma db push for dev startup' && npx prisma db push; fi && node dist/index.js"]
