FROM public.ecr.aws/docker/library/node:20-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

RUN npm run build && cp -r src/generated dist/

EXPOSE 3006

CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else echo 'No migrations found; running prisma db push' && npx prisma db push; fi && npx prisma generate && rm -rf dist/generated && cp -r src/generated dist/generated && node dist/index.js"]