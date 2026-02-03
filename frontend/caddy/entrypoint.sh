#!/bin/sh
set -e

node /srv/server.js &

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
