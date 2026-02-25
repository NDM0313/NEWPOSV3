# Stage 1: Build web
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; else npm install; fi

COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_DISABLE_REALTIME
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_DISABLE_REALTIME=$VITE_DISABLE_REALTIME
RUN npm run build

# Stage 2: Build mobile PWA
FROM node:20-alpine AS mobile-builder
WORKDIR /app
COPY erp-mobile-app/package.json erp-mobile-app/package-lock.json* ./
RUN npm ci
# CACHEBUST forces fresh copy on every deploy (no stale mobile build)
ARG CACHEBUST=
COPY erp-mobile-app/ .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build:mobile:pwa

# Stage 3: Serve
FROM nginx:alpine
RUN apk add --no-cache wget
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=mobile-builder /app/dist /usr/share/nginx/html/m
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
