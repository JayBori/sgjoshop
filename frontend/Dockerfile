FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM caddy:2-alpine AS runner
WORKDIR /srv

COPY --from=builder /app/.next/standalone /srv/
COPY --from=builder /app/.next/static /srv/.next/static
COPY --from=builder /app/public /srv/public

COPY caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443

ENV NODE_ENV=production
CMD sh -c "node /srv/server.js & caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"
