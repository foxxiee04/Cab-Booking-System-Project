# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/driver-app/package*.json ./
RUN npm install

COPY frontend/driver-app .
COPY shared ./shared
ARG NEXT_PUBLIC_TRACKASIA_KEY
ENV NEXT_PUBLIC_TRACKASIA_KEY=$NEXT_PUBLIC_TRACKASIA_KEY
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY frontend/driver-app/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./

EXPOSE 4001

ENV PORT=4001
ENV NODE_ENV=production
ENV NEXT_PUBLIC_TRACKASIA_KEY=$NEXT_PUBLIC_TRACKASIA_KEY

CMD ["npm", "start"]
