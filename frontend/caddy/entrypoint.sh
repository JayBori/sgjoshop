#!/bin/sh
set -e

# Next standalone ì„œë²„ë¥¼ 0.0.0.0ë¡œ ë°”ì¸ë”© ê°•ì œ
export HOSTNAME=0.0.0.0
export PORT=3000

API_BASE_VALUE=${NEXT_PUBLIC_API_BASE:-}
echo "window.__RUNTIME_CONFIG__ = { API_BASE: \"$API_BASE_VALUE\" };" > /srv/public/runtime-config.js
node /srv/server.js &

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

