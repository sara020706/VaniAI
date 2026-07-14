# syntax=docker/dockerfile:1
# VaniAI frontend — Vite/React build served by nginx.

# ---------- Build stage ----------
FROM node:22-alpine AS build

WORKDIR /app

# Dependency layer first for caching. The lockfile glob keeps the build
# working before package-lock.json has been generated/committed (npm ci is
# the reproducible path and is used whenever the lockfile exists).
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
        npm ci --no-audit --no-fund; \
    else \
        npm install --no-audit --no-fund; \
    fi

# Copy only build inputs explicitly (never the host's node_modules).
COPY index.html vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js postcss.config.js ./
COPY src ./src

RUN npm run build

# ---------- Serve stage ----------
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
