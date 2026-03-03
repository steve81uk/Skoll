# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the Vite frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY package*.json ./
RUN npm ci --loglevel=warn

# Copy source and build
COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Serve the built Vite app with Nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS frontend

# Remove default static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx config — SPA fallback + WebSocket proxy
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — ML / WebSocket server
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS ml-server

WORKDIR /app

# Production deps only
COPY package*.json ./
RUN npm ci --omit=dev --loglevel=warn

# Application source
COPY server.js         ./
COPY src/ml/           ./src/ml/
COPY public/models/    ./public/models/
COPY .env.example      ./.env.example

# Create log directory
RUN mkdir -p /app/logs

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health-check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
