# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/admin-dashboard/package*.json ./
RUN npm install

COPY frontend/admin-dashboard .
COPY shared ./shared
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY frontend/admin-dashboard/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./

EXPOSE 4002

ENV PORT=4002
ENV NODE_ENV=production

CMD ["npm", "start"]
