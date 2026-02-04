# 1) Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Next standalone ì¶œë ¥(í•„ìˆ˜)
RUN npm run build

# 2) Runtime (node + caddy)
FROM node:20-alpine AS runner
WORKDIR /srv

# caddy ì„¤ì¹˜
RUN apk add --no-cache caddy
ENV XDG_DATA_HOME=/data

# Next standalone ë³µì‚¬
COPY --from=builder /app/.next/standalone /srv/
COPY --from=builder /app/.next/static /srv/.next/static
# public í´ë”ê°€ ì—†ì„ ìˆ˜ë„ ìžˆìœ¼ë‹ˆ ì•ˆì „í•˜ê²Œ(ì—†ìœ¼ë©´ ì—ëŸ¬ë‚˜ì§€ ì•Šê²Œ) - ê¶Œìž¥: public/.gitkeep ë§Œë“¤ê¸°
COPY --from=builder /app/public /srv/public

# Caddyfile
COPY caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443

# node ì„œë²„ + caddy ê°™ì´ ì‹¤í–‰
COPY caddy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]

