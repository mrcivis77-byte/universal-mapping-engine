# Raspberry Pi Setup Guide

This directory contains scripts for deploying the Universal Mapping Engine on Raspberry Pi devices.

## Files

- `setup.sh` - Automated setup script for initial Raspberry Pi configuration
- `auto-start.sh` - System service script for auto-starting services on boot

## Quick Start

### 1. Initial Setup

Run the setup script on a fresh Raspberry Pi installation:

```bash
# Download and run setup script
cd /home/pi
wget https://your-repo/scripts/raspberry-pi/setup.sh
chmod +x setup.sh
sudo ./setup.sh
```

The setup script will:
- Update system packages
- Install Docker (with the Compose plugin)
- Configure system settings (timezone, SSH, etc.)
- Set up auto-start services
- Configure monitoring and log rotation
- Set up basic firewall rules

> Note: Cloudflare Tunnel and the heartbeat no longer run as host processes.
> They run as Docker containers, so no host `cloudflared` install is needed.

### 2. Deploy Application

After setup completes:

```bash
# Copy your project files
cd /home/pi
git clone <your-repo-url> universal-mapping-engine
cd universal-mapping-engine

# Edit configuration
nano config.env

# Start services
sudo /etc/init.d/mapping-engine start
```

### 3. Cloudflare Tunnel (Optional)

The tunnel runs as a Docker container. The simplest path:

```bash
# On any machine with cloudflared: login, create a tunnel, get a token
cloudflared tunnel login

# Put the token in config.env
nano config.env
CLOUDFLARE_TUNNEL_TOKEN="your-token-here"
```

Then restart the stack and the tunnel container exposes the app automatically.
A named-tunnel `config.yml` template is available at
`config/cloudflare/config.yml` (used when you prefer tunnel credentials over a
token; the compose file passes `CLOUDFLARE_TUNNEL_ID`).

## Service Management

### Start/Stop Services

```bash
# Start all services
sudo /etc/init.d/mapping-engine start

# Stop all services
sudo /etc/init.d/mapping-engine stop

# Restart services
sudo /etc/init.d/mapping-engine restart

# Check status
sudo /etc/init.d/mapping-engine status
```

### Manual Docker Management

```bash
cd /home/pi/universal-mapping-engine

# Build and start everything (regenerates config.json from config.env)
./scripts/start.sh

# Stop containers
docker compose down

# View logs
./scripts/logs.sh
docker compose logs -f

# Restart specific service
docker compose restart backend
docker compose restart frontend
```

## Monitoring

### View Logs

```bash
# Main application logs
tail -f /var/log/mapping-engine.log

# Docker logs
docker compose logs -f

# Monitor logs
tail -f /var/log/mapping-engine-monitor.log
```

### System Monitoring

The setup includes automatic monitoring that checks every 5 minutes:
- Docker service status
- Container status
- Disk space usage
- Memory usage

Alerts are logged to `/var/log/mapping-engine-monitor.log`

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
sudo systemctl status docker

# Check container logs
cd /home/pi/universal-mapping-engine
docker compose logs

# Restart Docker
sudo systemctl restart docker
```

### High Memory Usage

Edit `config.env` to reduce update intervals:
```env
GPS_UPDATE_INTERVAL=10000
MAP_SYNC_INTERVAL=5000
```

### SD Card Issues

Monitor disk space:
```bash
df -h
```

Clean up Docker logs:
```bash
docker system prune -a
```

## Performance Optimization

### Reduce CPU Usage

1. Increase GPS update intervals in `config.env`
2. Reduce maximum markers displayed
3. Disable unused features (proximity alerts, etc.)

### Improve Network Performance

1. Use Ethernet instead of WiFi
2. Configure static IP address
3. Use local DNS caching

## Hardware Recommendations

### Minimum Requirements
- Raspberry Pi 4 (2GB RAM)
- 16GB microSD card (Class 10)
- 5V 3A power supply

### Recommended Requirements
- Raspberry Pi 4 (4GB+ RAM)
- 32GB+ microSD card (Class 10)
- 5V 3A official power supply
- Ethernet connection
- Case with cooling

## Security

### Change Default Passwords

1. Change Raspberry Pi user password
2. Update `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` in config.env
3. Use SSH keys instead of password authentication

### Firewall Configuration

The setup script configures UFW with:
- Allow SSH (port 22)
- Allow HTTP (port 80)
- Allow HTTPS (port 443)
- Allow PocketBase (port 8090) from localhost only

To modify rules:
```bash
sudo ufw status
sudo ufw allow <port>
sudo ufw enable
```

## Backup and Recovery

### Backup Data

```bash
# Create backup script
cat > /home/pi/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# Backup PocketBase data
cd /home/pi/universal-mapping-engine
tar -czf $BACKUP_DIR/pb_data_$DATE.tar.gz pb_data/

# Backup configuration
cp config.env $BACKUP_DIR/config.env_$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/pi/backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /home/pi/backup.sh") | crontab -
```

### Restore Data

```bash
# Stop services
sudo /etc/init.d/mapping-engine stop

# Restore data
cd /home/pi/universal-mapping-engine
tar -xzf /home/pi/backups/pb_data_20240813.tar.gz

# Start services
sudo /etc/init.d/mapping-engine start
```

## Updates

### Update Application

```bash
cd /home/pi/universal-mapping-engine
git pull
./scripts/stop.sh
./scripts/start.sh
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

## Additional Resources

- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [Docker Documentation](https://docs.docker.com/)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## Support

For issues specific to Raspberry Pi deployment:
1. Check `/var/log/mapping-engine.log`
2. Verify Docker services are running
3. Test with minimal configuration
4. Check system resources (`htop`, `df -h`)
