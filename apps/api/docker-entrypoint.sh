#!/bin/sh
# Applies DB schema then starts the API.
# - If prisma/migrations exists -> `migrate deploy` (production-grade).
# - Otherwise -> `db push` (first run / early development, no migrations yet).
set -e
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[entrypoint] Applying migrations..."
  npx prisma migrate deploy
else
  echo "[entrypoint] No migrations found, syncing schema with db push..."
  npx prisma db push --skip-generate
fi
exec node dist/src/main.js
