FROM node:20-slim

WORKDIR /workspace/services/booking-service

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY services/booking-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

COPY services/booking-service .
COPY shared/dist /workspace/shared/dist

RUN npm run build

EXPOSE 3008

CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else echo 'No prisma/migrations found; running prisma db push for dev startup' && npx prisma db push; fi && node dist/index.js"]
