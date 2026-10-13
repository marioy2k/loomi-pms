#!/bin/sh
set -eu
cd /opt/loomi
install -d -m 700 /var/backups/loomi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T loomi node tools/backup.mjs /app/data/backup.sqlite
target="/var/backups/loomi/loomi-$stamp.sqlite"
docker compose cp loomi:/app/data/backup.sqlite "$target.tmp"
chmod 600 "$target.tmp"
mv "$target.tmp" "$target"
