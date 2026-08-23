#!/bin/sh
# Stop the RTM stack (keeps pb_data volume intact).
set -eu
cd "$(dirname "$0")"

docker compose down
