#!/bin/bash

# ==================================================
# Production Deployment Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOYMENT_ENV="${1:-production}"
PROJECT_DIR="/var/www/commerce-core"
BACKUP_DIR="/var/backups/commerce-core"
LOG_FILE="/var/log/commerce-core/deployment.log"
ROLLBACK_POINTS=5

# Function to print colored output with timestamp
log() {
    local color=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "Checking deployment prerequisites..."
    
    # Check if running as correct user
    if [ "$USER" != "deploy" ] && [ "$USER" != "root" ]; then
        log $RED "✗ Must run as deploy user or root"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("node" "npm" "pm2" "git" "rsync")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log $RED "✗ Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check disk space
    local disk_usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        log $RED "✗ Insufficient disk space: ${disk_usage}% used"
        exit 1
    fi
    
    # Check memory
    local memory_available=$(free -m | awk 'NR==2{printf "%.0f", $7*100/$2}')
    if [ "$memory_available" -lt 20 ]; then
        log $YELLOW "⚠ Low memory available: ${memory_available}%"
    fi
    
    log $GREEN "✓ Prerequisites check passed"
}

# Function to create deployment backup
create_backup() {
    log $BLUE "Creating deployment backup..."
    
    local backup_timestamp=$(date "+%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/deployment_$backup_timestamp"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current deployment
    if [ -d "$PROJECT_DIR" ]; then
        rsync -av --exclude 'node_modules' --exclude 'logs' --exclude '.git' \
            "$PROJECT_DIR/" "$backup_path/"
        log $GREEN "✓ Application backup created: $backup_path"
    fi
    
    # Backup database
    if [ -f "$PROJECT_DIR/database/scripts/backup.sh" ]; then
        cd "$PROJECT_DIR"
        ./database/scripts/backup.sh
        log $GREEN "✓ Database backup created"
    fi
    
    # Cleanup old backups
    find "$BACKUP_DIR" -name "deployment_*" -mtime +7 -exec rm -rf {} \;
    log $GREEN "✓ Old backups cleaned up"
}

# Function to stop services gracefully
stop_services() {
    log $BLUE "Stopping services gracefully..."
    
    # Stop PM2 processes
    if pm2 list | grep -q "commerce-core"; then
        pm2 stop ecosystem.config.js
        log $GREEN "✓ PM2 processes stopped"
    fi
    
    # Wait for connections to close
    sleep 5
    
    # Check if any processes are still running
    local running_processes=$(pgrep -f "commerce-core" || echo "")
    if [ ! -z "$running_processes" ]; then
        log $YELLOW "⚠ Force killing remaining processes"
        pkill -f "commerce-core" || true
    fi
    
    log $GREEN "✓ Services stopped"
}

# Function to deploy application
deploy_application() {
    log $BLUE "Deploying application..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest code
    git fetch origin
    git reset --hard origin/main
    log $GREEN "✓ Code updated from repository"
    
    # Install dependencies
    npm ci --production --silent
    log $GREEN "✓ Dependencies installed"
    
    # Build application
    npm run build
    log $GREEN "✓ Application built"
    
    # Set proper permissions
    chown -R deploy:deploy "$PROJECT_DIR"
    chmod +x "$PROJECT_DIR/scripts/"*.sh
    chmod +x "$PROJECT_DIR/database/scripts/"*.sh
    log $GREEN "✓ Permissions set"
}

# Function to run database migrations
run_migrations() {
    log $BLUE "Running database migrations..."
    
    cd "$PROJECT_DIR"
    
    if [ -f "./database/scripts/migrate.sh" ]; then
        ./database/scripts/migrate.sh up
        log $GREEN "✓ Database migrations completed"
    else
        log $YELLOW "⚠ Migration script not found, skipping"
    fi
}

# Function to start services
start_services() {
    log $BLUE "Starting services..."
    
    cd "$PROJECT_DIR"
    
    # Start PM2 processes
    pm2 start ecosystem.config.js --env korean_production
    
    # Wait for services to stabilize
    sleep 10
    
    # Check if all processes are running
    local running_apps=$(pm2 list | grep -c "online" || echo "0")
    if [ "$running_apps" -gt 0 ]; then
        log $GREEN "✓ Services started ($running_apps processes online)"
    else
        log $RED "✗ Failed to start services"
        exit 1
    fi
}

# Function to run health checks
run_health_checks() {
    log $BLUE "Running post-deployment health checks..."
    
    cd "$PROJECT_DIR"
    
    # Wait for application to fully start
    sleep 15
    
    # Run comprehensive health check
    if [ -f "./scripts/health-check.sh" ]; then
        if ./scripts/health-check.sh comprehensive; then
            log $GREEN "✓ Health checks passed"
        else
            log $RED "✗ Health checks failed"
            return 1
        fi
    else
        # Basic health check
        if curl -f -s "http://localhost:3000/health" > /dev/null; then
            log $GREEN "✓ Basic health check passed"
        else
            log $RED "✗ Basic health check failed"
            return 1
        fi
    fi
    
    # Check PM2 process status
    pm2 show commerce-core | grep -q "online"
    if [ $? -eq 0 ]; then
        log $GREEN "✓ Main process is online"
    else
        log $RED "✗ Main process is not online"
        return 1
    fi
    
    return 0
}

# Function to rollback deployment
rollback_deployment() {
    log $YELLOW "Rolling back deployment..."
    
    # Stop current services
    pm2 stop ecosystem.config.js || true
    
    # Find latest backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/deployment_* | head -1)
    
    if [ -n "$latest_backup" ] && [ -d "$latest_backup" ]; then
        log $BLUE "Restoring from backup: $latest_backup"
        
        # Remove current deployment
        rm -rf "$PROJECT_DIR.failed"
        mv "$PROJECT_DIR" "$PROJECT_DIR.failed"
        
        # Restore backup
        cp -r "$latest_backup" "$PROJECT_DIR"
        chown -R deploy:deploy "$PROJECT_DIR"
        
        # Restart services
        cd "$PROJECT_DIR"
        pm2 start ecosystem.config.js --env korean_production
        
        log $GREEN "✓ Rollback completed"
    else
        log $RED "✗ No backup found for rollback"
        exit 1
    fi
}

# Function to setup monitoring
setup_monitoring() {
    log $BLUE "Setting up monitoring..."
    
    # Setup log rotation
    cat > /etc/logrotate.d/commerce-core << EOF
/var/log/commerce-core/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        pm2 reload ecosystem.config.js > /dev/null 2>&1 || true
    endscript
}
EOF
    
    # Setup PM2 monitoring
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 30
    pm2 set pm2-logrotate:compress true
    
    # Save PM2 configuration
    pm2 save
    pm2 startup
    
    log $GREEN "✓ Monitoring setup completed"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Korean E-commerce Deployment\\n**Status:** $status\\n**Environment:** $DEPLOYMENT_ENV\\n**Message:** $message\\n**Time:** $(date)\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    if [ -n "${TEAMS_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Korean E-commerce Deployment - $status: $message (Environment: $DEPLOYMENT_ENV, Time: $(date))\"}" \
            "$TEAMS_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
}

# Function to cleanup temporary files
cleanup() {
    log $BLUE "Cleaning up temporary files..."
    
    # Clean npm cache
    npm cache clean --force > /dev/null 2>&1 || true
    
    # Clean temporary files
    find /tmp -name "*commerce*" -mtime +1 -delete 2>/dev/null || true
    
    # Clean old logs
    find /var/log/commerce-core -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
    
    log $GREEN "✓ Cleanup completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log $BLUE "Starting Korean E-commerce deployment..."
    log $BLUE "Environment: $DEPLOYMENT_ENV"
    log $BLUE "Timestamp: $(date)"
    log $BLUE "User: $USER"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Trap to handle failures
    trap 'log $RED "Deployment failed! Check logs for details."; send_notification "FAILED" "Deployment failed"; exit 1' ERR
    
    # Main deployment steps
    check_prerequisites
    create_backup
    stop_services
    deploy_application
    run_migrations
    start_services
    
    # Health checks with rollback on failure
    if ! run_health_checks; then
        log $RED "Health checks failed, initiating rollback..."
        rollback_deployment
        send_notification "ROLLED_BACK" "Deployment failed health checks and was rolled back"
        exit 1
    fi
    
    setup_monitoring
    cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log $GREEN "✓ Deployment completed successfully!"
    log $GREEN "Total deployment time: ${duration} seconds"
    
    # Send success notification
    send_notification "SUCCESS" "Deployment completed successfully in ${duration} seconds"
    
    # Display final status
    log $BLUE "=== Deployment Summary ==="
    log $BLUE "Environment: $DEPLOYMENT_ENV"
    log $BLUE "Duration: ${duration} seconds"
    log $BLUE "PM2 Status:"
    pm2 list
    log $BLUE "=========================="
}

# Execute main function
main "$@"