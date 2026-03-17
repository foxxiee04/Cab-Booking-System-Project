FROM node:20-alpine

WORKDIR /workspace/services/user-service

RUN apk add --no-cache openssl

COPY services/user-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

COPY services/user-service .
COPY shared/dist /workspace/shared/dist

RUN npm run build

EXPOSE 3007

CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else echo 'No prisma/migrations found; running prisma db push for dev startup' && npx prisma db push; fi && node dist/index.js"]
