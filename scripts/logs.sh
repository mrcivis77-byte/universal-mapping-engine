#!/bin/sh
# Tail logs for one or all services.
# Usage: ./scripts/logs.sh [backend|frontend|setup|heartbeat|tunnel]
set -eu
cd "$(dirname "$0")"

if [ "$#" -gt 0 ]; then
  docker compose logs -f --tail=100 "$1"
else
  docker compose logs -f --tail=100
fi
