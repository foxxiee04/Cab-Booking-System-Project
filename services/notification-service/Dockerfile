FROM node:20-alpine

WORKDIR /workspace/services/notification-service

COPY services/notification-service/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

COPY services/notification-service .
COPY shared/dist /workspace/shared/dist

RUN npm run build

EXPOSE 3005

CMD ["node", "dist/index.js"]
