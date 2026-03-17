FROM node:20-alpine

WORKDIR /workspace/services/review-service

COPY services/review-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

COPY services/review-service .
COPY shared/dist /workspace/shared/dist

RUN npm run build

EXPOSE 3010

CMD ["node", "dist/index.js"]
