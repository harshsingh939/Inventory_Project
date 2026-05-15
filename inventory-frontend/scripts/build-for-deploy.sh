#!/usr/bin/env bash
# Rocky Linux / RHEL: production build with BACKEND_ORIGIN from .env
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "WARN: inventory-frontend/.env missing — copy .env.example and set BACKEND_ORIGIN to your API URL."
fi

node scripts/load-dotenv.cjs
npm run build -- --configuration=production
node scripts/patch-api-origin.cjs

echo "Build OK. Start with: pm2 start ecosystem.config.cjs"
