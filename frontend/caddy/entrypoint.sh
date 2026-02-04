#!/bin/sh
set -e

# Prepare runtime config for client-side
API_BASE_VALUE="${NEXT_PUBLIC_API_BASE:-/api}"
echo "window.__RUNTIME_CONFIG__ = { API_BASE: \"$API_BASE_VALUE\" };" > /srv/public/runtime-config.js

# Start Next.js standalone server
node /srv/server.js &

# Run Caddy
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
