#!/bin/bash
# Raspberry Pi Setup Script for Universal Mapping Engine
# This script prepares a Raspberry Pi for running the mapping engine

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root (use sudo)"
        exit 1
    fi
}

# Function to detect Raspberry Pi model
detect_pi_model() {
    if [ -f /proc/device-tree/model ]; then
        MODEL=$(tr -d '\0' < /proc/device-tree/model)
        print_info "Detected: $MODEL"
    else
        print_info "Could not detect Raspberry Pi model"
    fi
}

# Function to update system
update_system() {
    print_header "Updating System"
    apt update && apt upgrade -y
    print_success "System updated"
}

# Function to install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    # Install basic utilities
    apt install -y \
        curl \
        wget \
        git \
        python3 \
        python3-pip \
        python3-requests \
        net-tools \
        htop \
        vim
    
    print_success "Dependencies installed"
}

# Function to install Docker
install_docker() {
    print_header "Installing Docker"
    
    if command -v docker &> /dev/null; then
        print_info "Docker is already installed"
        docker --version
    else
        print_info "Installing Docker..."
        curl -sSL https://get.docker.com | sh
        usermod -aG docker pi
        
        print_success "Docker installed"
        docker --version
    fi
}

# Function to check Docker Compose (plugin or standalone)
install_docker_compose() {
    print_header "Checking Docker Compose"
    
    if docker compose version &> /dev/null; then
        print_success "Docker Compose plugin is available"
        docker compose version
    elif command -v docker-compose &> /dev/null; then
        print_info "Legacy docker-compose found; upgrading to the compose plugin..."
        apt install -y docker-compose-plugin || \
            curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" \
                -o /usr/local/bin/docker-compose \
            && chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose available"
        docker compose version
    else
        print_info "Installing Docker Compose plugin..."
        apt install -y docker-compose-plugin
        print_success "Docker Compose plugin installed"
        docker compose version
    fi
}

# Function to configure system settings
configure_system() {
    print_header "Configuring System Settings"
    
    # Set timezone to Mexico City
    timedatectl set-timezone America/Merida
    print_success "Timezone set to America/Merida"
    
    # Disable screen blanking
    if [ -f /etc/lightdm/lightdm.conf ]; then
        sed -i 's/#xserver-command=X -s 0 -dpms/xserver-command=X -s 0 -dpms/' /etc/lightdm/lightdm.conf
        print_success "Screen blanking disabled"
    fi
    
    # Set GPU memory split (for Raspberry Pi)
    if [ -f /boot/config.txt ]; then
        if ! grep -q "gpu_mem" /boot/config.txt; then
            echo "gpu_mem=128" >> /boot/config.txt
            print_success "GPU memory configured"
        fi
    fi
    
    # Enable SSH if not already enabled
    if ! command -v systemctl &> /dev/null || ! systemctl is-active --quiet ssh; then
        systemctl enable ssh
        systemctl start ssh
        print_success "SSH enabled"
    fi
}

# Function to setup project directory
setup_project() {
    print_header "Setting Up Project Directory"
    
    PROJECT_DIR="/home/pi/universal-mapping-engine"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_info "Project directory already exists"
    else
        mkdir -p "$PROJECT_DIR"
        chown pi:pi "$PROJECT_DIR"
        print_success "Project directory created"
    fi
}

# Function to setup auto-start
setup_autostart() {
    print_header "Setting Up Auto-Start"
    
    SCRIPT_DIR="/home/pi/universal-mapping-engine/scripts/raspberry-pi"
    INIT_SCRIPT="/etc/init.d/mapping-engine"
    
    if [ -f "$SCRIPT_DIR/auto-start.sh" ]; then
        cp "$SCRIPT_DIR/auto-start.sh" "$INIT_SCRIPT"
        chmod +x "$INIT_SCRIPT"
        
        # Enable auto-start
        update-rc.d mapping-engine defaults
        
        print_success "Auto-start configured"
    else
        print_error "Auto-start script not found: $SCRIPT_DIR/auto-start.sh"
    fi
}

# Function to setup log rotation
setup_log_rotation() {
    print_header "Setting Up Log Rotation"
    
    cat > /etc/logrotate.d/mapping-engine <<EOF
/var/log/mapping-engine.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 root root
}
EOF
    
    print_success "Log rotation configured"
}

# Function to create monitoring script
setup_monitoring() {
    print_header "Setting Up Monitoring"
    
    cat > /usr/local/bin/check-mapping-engine.sh <<'EOF'
#!/bin/bash
# Monitoring script for Mapping Engine

LOG_FILE="/var/log/mapping-engine-monitor.log"
PROJECT_DIR="/home/pi/universal-mapping-engine"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "$(date): Docker is not running, restarting..." >> $LOG_FILE
    systemctl restart docker
fi

# Check if containers are running
cd $PROJECT_DIR
if ! docker compose ps | grep -q "Up"; then
    echo "$(date): Containers are not running, restarting..." >> $LOG_FILE
    sudo -u pi docker compose up -d
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Warning: Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if [ $(echo "$MEM_USAGE > 80" | bc -l) -eq 1 ]; then
    echo "$(date): Warning: Memory usage is ${MEM_USAGE}%" >> $LOG_FILE
fi
EOF
    
    chmod +x /usr/local/bin/check-mapping-engine.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-mapping-engine.sh") | crontab -
    
    print_success "Monitoring configured"
}

# Function to setup firewall
setup_firewall() {
    print_header "Setting Up Firewall"
    
    if command -v ufw &> /dev/null; then
        # Allow SSH
        ufw allow 22/tcp
        
        # Allow HTTP/HTTPS
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        # Allow PocketBase (internal)
        ufw allow from 127.0.0.1 to any port 8090
        
        # Enable firewall
        ufw --force enable
        
        print_success "Firewall configured"
    else
        print_info "UFW not installed, skipping firewall setup"
    fi
}

# Function to create setup summary
create_summary() {
    print_header "Setup Summary"
    
    cat > /home/pi/SETUP_SUMMARY.txt <<EOF
Universal Mapping Engine Setup Summary
======================================

Setup completed: $(date)

System Information:
- Raspberry Pi Model: $(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo "Unknown")
- OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- Docker: $(docker --version 2>/dev/null || echo "Not installed")
- Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "Not installed")

Important Files:
- Project Directory: /home/pi/universal-mapping-engine
- Configuration: /home/pi/universal-mapping-engine/config.env
- Logs: /var/log/mapping-engine.log
- Auto-start Script: /etc/init.d/mapping-engine

Next Steps:
1. Copy your project files to /home/pi/universal-mapping-engine
2. Edit config.env with your town's information
3. Run: sudo /etc/init.d/mapping-engine start
4. Check status: sudo /etc/init.d/mapping-engine status

Useful Commands:
- Start services: sudo /etc/init.d/mapping-engine start
- Stop services: sudo /etc/init.d/mapping-engine stop
- Restart services: sudo /etc/init.d/mapping-engine restart
- Check status: sudo /etc/init.d/mapping-engine status
- View logs: tail -f /var/log/mapping-engine.log

Web Access:
- Local: http://localhost
- After Cloudflare setup: https://your-town.yourdomain.com

For issues, check the logs in /var/log/mapping-engine.log
EOF
    
    chown pi:pi /home/pi/SETUP_SUMMARY.txt
    print_success "Setup summary created: /home/pi/SETUP_SUMMARY.txt"
}

# Main setup function
main() {
    print_header "Universal Mapping Engine Raspberry Pi Setup"
    echo ""
    
    check_root
    detect_pi_model
    
    # Ask for confirmation
    print_info "This script will install and configure the mapping engine on your Raspberry Pi."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled"
        exit 0
    fi
    
    echo ""
    
    # Run setup steps
    update_system
    install_dependencies
    install_docker
    install_docker_compose
    configure_system
    setup_project
    setup_autostart
    setup_log_rotation
    setup_monitoring
    setup_firewall
    create_summary
    
    echo ""
    print_header "Setup Complete!"
    print_success "Your Raspberry Pi is ready for the Universal Mapping Engine"
    print_info "Please review /home/pi/SETUP_SUMMARY.txt for next steps"
    print_info "Reboot recommended: sudo reboot"
}

# Run main function
main "$@"
