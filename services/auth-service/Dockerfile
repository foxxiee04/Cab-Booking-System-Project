FROM public.ecr.aws/docker/library/node:20-alpine

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

# migrate deploy chỉ khi có migration/*/migration.sql — không kích hoạt chỉ vì có migration_lock.toml.
# Dev Compose thường dùng db push; migrate một phần (vd. chỉ ALTER) trên DB trống sẽ làm container thoát.
CMD ["sh", "-c", "set -e; if find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print -quit 2>/dev/null | grep -q .; then echo '[auth-service] prisma migrate deploy'; npx prisma migrate deploy; else echo '[auth-service] prisma db push (no numbered migrations)'; npx prisma db push; fi && npx prisma generate && rm -rf dist/generated && cp -r src/generated dist/generated && exec node dist/index.js"]
