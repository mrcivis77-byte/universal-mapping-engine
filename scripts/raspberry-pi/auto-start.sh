#!/bin/bash
# Universal Mapping Engine Auto-Start Script for Raspberry Pi
# This script automatically starts all services on system boot
# Place in /etc/init.d/ and enable with: sudo update-rc.d mapping-engine defaults

### BEGIN INIT INFO
# Provides:          mapping-engine
# Required-Start:    $network $local_fs $remote_fs
# Required-Stop:     $network $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Universal Mapping Engine Services
# Description:       Auto-start script for Docker-based mapping engine
### END INIT INFO

# Configuration
PROJECT_DIR="/home/pi/universal-mapping-engine"
USER="pi"
LOG_FILE="/var/log/mapping-engine.log"
PID_FILE="/var/run/mapping-engine.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    log_message "INFO" "$1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    log_message "ERROR" "$1"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
    log_message "INFO" "$1"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root"
        exit 1
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running"
        return 1
    fi
    return 0
}

# Function to check if project directory exists
check_project_dir() {
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        return 1
    fi
    return 0
}

# Function to start services
start_services() {
    print_info "Starting Universal Mapping Engine services..."
    
    # Check prerequisites
    check_root
    check_docker || exit 1
    check_project_dir || exit 1
    
    # Change to project directory
    cd "$PROJECT_DIR" || exit 1
    
    # Start Docker Compose services (heartbeat and tunnel run as containers)
    print_info "Starting Docker containers..."
    sudo -u "$USER" docker compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Docker containers started successfully"
        
        # Wait for services to be ready
        print_info "Waiting for services to be ready..."
        sleep 10
        
        # Check if services are running
        if sudo -u "$USER" docker compose ps | grep -q "Up"; then
            print_success "All services are running"
            
            # Create PID file
            echo $$ > "$PID_FILE"
            print_success "Mapping Engine started successfully"
            return 0
        else
            print_error "Some services failed to start"
            sudo -u "$USER" docker compose ps
            return 1
        fi
    else
        print_error "Failed to start Docker containers"
        return 1
    fi
}

# Function to stop services
stop_services() {
    print_info "Stopping Universal Mapping Engine services..."
    
    # Check if PID file exists
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi
    
    # Stop Docker Compose services
    cd "$PROJECT_DIR" || exit 1
    sudo -u "$USER" docker compose down
    
    if [ $? -eq 0 ]; then
        print_success "Docker containers stopped successfully"
        return 0
    else
        print_error "Failed to stop Docker containers"
        return 1
    fi
}

# Function to restart services
restart_services() {
    print_info "Restarting Universal Mapping Engine services..."
    stop_services
    sleep 5
    start_services
}

# Function to check service status
status_services() {
    print_info "Checking Universal Mapping Engine status..."
    
    cd "$PROJECT_DIR" || exit 1
    
    print_info "Docker containers status:"
    sudo -u "$USER" docker compose ps
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        status_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

exit $?
