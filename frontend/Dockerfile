# 1) Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Next standalone 출력(필수)
RUN npm run build

# 2) Runtime (node + caddy)
FROM node:20-alpine AS runner
WORKDIR /srv

# caddy 설치
RUN apk add --no-cache caddy
ENV XDG_DATA_HOME=/data

# Next standalone 복사
COPY --from=builder /app/.next/standalone /srv/
COPY --from=builder /app/.next/static /srv/.next/static
# public 폴더가 없을 수도 있으니 안전하게(없으면 에러나지 않게) - 권장: public/.gitkeep 만들기
COPY --from=builder /app/public /srv/public

# Caddyfile
COPY caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443

# node 서버 + caddy 같이 실행
COPY caddy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
