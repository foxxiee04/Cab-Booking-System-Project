# public.ecr.aws = Docker Hub official mirror — avoids GitHub Actions Docker Hub pull rate limits (429)
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /workspace/services/api-gateway

# Install dependencies
COPY services/api-gateway/package*.json ./
RUN npm install

COPY shared/package*.json /workspace/shared/
RUN npm install --prefix /workspace/shared --omit=dev

# Copy service source and shared build artifacts
COPY services/api-gateway .
COPY shared/dist /workspace/shared/dist
COPY assets/vehicle-images /workspace/assets/vehicle-images

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
