FROM node:20-alpine

WORKDIR /workspace/services/pricing-service

COPY services/pricing-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

COPY services/pricing-service .
COPY shared/dist /workspace/shared/dist
RUN npm run build

EXPOSE 3009

CMD ["node", "dist/index.js"]
