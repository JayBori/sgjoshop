#!/bin/sh
set -e

# Next standalone 서버를 0.0.0.0로 바인딩 강제
export HOSTNAME=0.0.0.0
export PORT=3000

node /srv/server.js &

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
