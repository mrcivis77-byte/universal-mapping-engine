#!/bin/bash
# 🌊 Beach Sandbox - Quick Setup by IP
# This script configures everything for direct IP access

echo "🏖️ Beach Sandbox - Direct IP Setup"
echo "====================================="
echo ""

# Detect your current IP
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo "🔍 Detected IP: $CURRENT_IP"
echo ""

# Read target IP from user or use current
if [ -z "$1" ]; then
    TARGET_IP=$CURRENT_IP
else
    TARGET_IP=$1
fi

echo "🎯 Target IP: $TARGET_IP"
echo ""

# Update nginx configuration
echo "1️⃣ Updating nginx configuration..."
sed -i "s|server_name .*;|server_name $TARGET_IP;|g" config/nginx/default.conf

# Update local hosts file for domain
echo "2️⃣ Setting up local domain resolution..."
HOSTS_ENTRY="$TARGET_IP beach.yucatanmx.com"

if command -v sudo &> /dev/null; then
    if ! grep -q "beach.yucatanmx.com" /etc/hosts 2>/dev/null; then
        echo "$HOSTS_ENTRY" | sudo tee -a /etc/hosts > /dev/null 2>&1 && \
            echo "   ✓ Added to /etc/hosts" || \
            echo "   ⚠ Could not update /etc/hosts (may need root)"
    else
        echo "   ✓ Domain already in /etc/hosts"
    fi
else
    echo "   ⚠ sudo not available, skipping /etc/hosts update"
fi

# Update config.env with new IP
echo "3️⃣ Updating config.env..."
sed -i "s/PUBLIC_URL=.*/PUBLIC_URL=\"https:\/\/$TARGET_IP\"/g" config.env
sed -i "s/API_BASE_URL=.*/API_BASE_URL=\"https:\/\/$TARGET_IP\"/g" config.env
sed -i "s/CENTRAL_REGISTRY_URL=.*/CENTRAL_REGISTRY_URL=\"https:\/\/$TARGET_IP\"/g" config.env

# Regenerate config.json
echo "4️⃣ Regenerating config.json..."
sh scripts/generate-config.sh config.env > pb_public/config.json

# Update HTML links
echo "5️⃣ Updating HTML links..."
sed -i "s|http://localhost:80|https://$TARGET_IP|g" deploy/status.html 2>/dev/null || true
sed -i "s|http://127.0.0.1|https://$TARGET_IP|g" deploy/status.html 2>/dev/null || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Access your app at:"
echo "   http://$TARGET_IP"
echo ""
echo "📱 Or use the domain: https://beach.yucatanmx.com"
echo ""
echo "🚀 To start the app:"
echo "   docker-compose up -d"
echo ""
echo "🔧 To change IP later:"
echo "   ./scripts/setup-by-ip.sh [NEW_IP]"