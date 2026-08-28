#!/bin/bash
# Live reload script for Beach Sandbox
# Restarts containers when config or code files change

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "👀 Watching for changes in $PROJECT_DIR..."
echo "🔄 Will restart containers when files change"
echo ""

# Use inotifywait if available, otherwise fall back to polling
if command -v inotifywait &> /dev/null; then
    echo "Using inotify for fast file watching..."
    inotifywait -m -r -e modify,create,delete,move \
        --exclude '\.git|node_modules|\.DS_Store' \
        "$PROJECT_DIR" \
        --format '%w%f %e' |
    while read file event; do
        echo "$(date '+%H:%M:%S') - Change detected: $file ($event)"
        
        # Restart affected containers
        if [[ "$file" == *"pb_public"* ]]; then
            echo "   → Restarting frontend..."
            docker compose restart frontend
        elif [[ "$file" == *"pb_data"* ]] || [[ "$file" == *"pb_hooks"* ]]; then
            echo "   → Restarting backend..."
            docker compose restart backend
        elif [[ "$file" == *"config.env"* ]] || [[ "$file" == *"docker-compose.yml"* ]]; then
            echo "   → Restarting all services..."
            docker compose restart
        else
            echo "   → No specific restart needed"
        fi
        echo ""
    done
else
    echo "inotifywait not found. Building simple watch..."
    # Fallback: check for changes every few seconds
    LAST_CHECK=$(date +%s)
    while true; do
        sleep 5
        CURRENT_CHECK=$(date +%s)
        # Simple checksum-based detection could go here
        echo "_checked_$CURRENT_CHECK"
    done
fi
