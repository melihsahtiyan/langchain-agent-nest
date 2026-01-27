# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN cp -R node_modules prod_node_modules
RUN npm ci && npm cache clean --force

# Stage 2: Build TypeScript
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# HuggingFace cache will be mounted from shared volume
ENV HF_HOME=/root/.cache/huggingface

COPY --from=deps /app/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 3000

CMD ["node", "dist/main.js"]
