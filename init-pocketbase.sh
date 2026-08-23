#!/bin/sh
# Wrapper around the PocketBase setup service.
# Creates superuser + collections via scripts/setup-pocketbase.mjs.
set -eu
cd "$(dirname "$0")/.."

docker compose run --rm setup
