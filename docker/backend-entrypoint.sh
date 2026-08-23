#!/bin/sh
set -eu

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  echo "[backend] provisioning superuser ${PB_SUPERUSER_EMAIL}"
  pocketbase superuser upsert --dir=/pb/pb_data "${PB_SUPERUSER_EMAIL}" "${PB_SUPERUSER_PASSWORD}"
else
  echo "[backend] PB_SUPERUSER_EMAIL/PASSWORD not set; skipping superuser provisioning"
fi

exec pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks --migrationsDir=/pb/pb_migrations
