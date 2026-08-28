#!/bin/bash
# 🏖️ Beach Sandbox Deployment Script for Mini PC
# Run this on your mini PC after copying the project

set -e

echo "🏖️ Deploying Beach Sandbox to Mini PC..."
echo ""

# Get mini PC IP
MINI_PC_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Mini PC IP: $MINI_PC_IP"

# Navigate to project directory
PROJECT_DIR="/home/mrc77/Desktop/Backup Projects/universal-mapping-engine"
cd "$PROJECT_DIR"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found at $PROJECT_DIR"
    echo "Please copy the project to this location first."
    exit 1
fi

# Update docker-compose.yml with correct ports
echo "🔧 Configuring ports..."
sed -i 's/"80:80"/"8080:80"/g' docker-compose.yml 2>/dev/null || true
sed -i 's/"8090:8090"/"8090:8090"/g' docker-compose.yml

# Update nginx config to use mini PC IP
echo "🔧 Updating nginx configuration..."
if [ -f "config/nginx/default.conf" ]; then
    sed -i "s/server_name .*/server_name $MINI_PC_IP;/g" config/nginx/default.conf
fi

# Create environment file for PocketBase
echo "🔧 Creating environment file..."
cat > config.env << EOF
PB_PORT=8090
PB_ADMIN_EMAIL=admin@thebeach.com
PB_ADMIN_PASSWORD=change-me-in-production
TOWN_ID=default-town
MAX_BOUNDS_ARRAY=[-88.5,20.5,-87.0,21.0]
EOF

echo "✅ Configuration complete!"
echo ""
echo "🚀 To start your app run:"
echo "   cd $PROJECT_DIR"
echo "   docker-compose up -d"
echo ""
echo "🌐 Access your app at: http://$MINI_PC_IP:8080"
echo "📊 API endpoint: http://$MINI_PC_IP:8090/api"
echo ""
echo "👨‍💻 Admin access: http://$MINI_PC_IP:8090/_panel"
echo "   Username: admin@thebeach.com"
echo "   Password: change-me-in-production"