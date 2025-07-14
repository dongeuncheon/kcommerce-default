#!/bin/bash

# ==================================================
# Maintenance Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/commerce-core"
LOG_FILE="/var/log/commerce-core/maintenance.log"
MAINTENANCE_MODE_FILE="/tmp/commerce-maintenance-mode"

# Function to print colored output with timestamp
log() {
    local color=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  enable-maintenance    Enable maintenance mode"
    echo "  disable-maintenance   Disable maintenance mode"
    echo "  status               Show maintenance status"
    echo "  cleanup              Run system cleanup"
    echo "  optimize             Optimize database and cache"
    echo "  backup               Create full system backup"
    echo "  log-rotation         Rotate application logs"
    echo "  health-full          Full system health check"
    echo "  korean-business      Korean business hours maintenance"
    echo ""
    echo "Options:"
    echo "  -f, --force          Force operation without confirmation"
    echo "  -q, --quiet          Quiet mode (minimal output)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 enable-maintenance"
    echo "  $0 cleanup -f"
    echo "  $0 korean-business"
    echo ""
    exit 1
}

# Function to check if maintenance mode is enabled
is_maintenance_mode() {
    [ -f "$MAINTENANCE_MODE_FILE" ]
}

# Function to enable maintenance mode
enable_maintenance_mode() {
    local message="${1:-Scheduled maintenance in progress}"
    local duration="${2:-30 minutes}"
    
    log $YELLOW "Enabling maintenance mode..."
    
    # Create maintenance mode file with information
    cat > "$MAINTENANCE_MODE_FILE" << EOF
{
    "enabled": true,
    "message": "$message",
    "duration": "$duration",
    "start_time": "$(date -Iseconds)",
    "contact": "support@yourdomain.com"
}
EOF
    
    # Update nginx configuration to show maintenance page
    if [ -f "/etc/nginx/sites-available/commerce-maintenance" ]; then
        ln -sf /etc/nginx/sites-available/commerce-maintenance /etc/nginx/sites-enabled/default
        nginx -s reload
        log $GREEN "✓ Nginx configured for maintenance mode"
    fi
    
    # Scale down PM2 processes (but keep them ready)
    pm2 stop ecosystem.config.js 2>/dev/null || true
    
    log $YELLOW "🚧 Maintenance mode enabled"
    log $BLUE "Message: $message"
    log $BLUE "Expected duration: $duration"
}

# Function to disable maintenance mode
disable_maintenance_mode() {
    log $BLUE "Disabling maintenance mode..."
    
    # Remove maintenance mode file
    rm -f "$MAINTENANCE_MODE_FILE"
    
    # Restore normal nginx configuration
    if [ -f "/etc/nginx/sites-available/commerce-production" ]; then
        ln -sf /etc/nginx/sites-available/commerce-production /etc/nginx/sites-enabled/default
        nginx -s reload
        log $GREEN "✓ Nginx configuration restored"
    fi
    
    # Start PM2 processes
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js --env korean_production
    
    # Wait for application to stabilize
    sleep 10
    
    # Verify application is running
    if curl -f -s "http://localhost:3000/health" > /dev/null; then
        log $GREEN "✓ Application is running normally"
    else
        log $RED "✗ Application health check failed after maintenance"
    fi
    
    log $GREEN "✅ Maintenance mode disabled"
}

# Function to show maintenance status
show_maintenance_status() {
    if is_maintenance_mode; then
        log $YELLOW "🚧 Maintenance mode is ENABLED"
        
        if [ -f "$MAINTENANCE_MODE_FILE" ]; then
            log $BLUE "Maintenance details:"
            cat "$MAINTENANCE_MODE_FILE" | jq -r '. | "Message: \(.message)\nDuration: \(.duration)\nStart time: \(.start_time)"' 2>/dev/null || cat "$MAINTENANCE_MODE_FILE"
        fi
    else
        log $GREEN "✅ Maintenance mode is DISABLED"
        
        # Show application status
        local pm2_status=$(pm2 list | grep -c "online" || echo "0")
        log $BLUE "PM2 processes online: $pm2_status"
        
        # Quick health check
        if curl -f -s "http://localhost:3000/health" > /dev/null; then
            log $GREEN "Application health: OK"
        else
            log $RED "Application health: FAILED"
        fi
    fi
}

# Function to run system cleanup
run_cleanup() {
    local force_cleanup=${1:-false}
    
    log $BLUE "Running system cleanup..."
    
    if [ "$force_cleanup" = false ]; then
        read -p "This will clean temporary files, logs, and cache. Continue? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            log $BLUE "Cleanup cancelled"
            return 0
        fi
    fi
    
    # Clean temporary files
    log $BLUE "Cleaning temporary files..."
    find /tmp -name "*commerce*" -mtime +1 -delete 2>/dev/null || true
    find /var/tmp -name "*commerce*" -mtime +1 -delete 2>/dev/null || true
    
    # Clean old logs
    log $BLUE "Cleaning old logs..."
    find /var/log/commerce-core -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
    find "$PROJECT_DIR/logs" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
    
    # Clean npm cache
    log $BLUE "Cleaning npm cache..."
    npm cache clean --force > /dev/null 2>&1 || true
    
    # Clean PM2 logs
    log $BLUE "Cleaning PM2 logs..."
    pm2 flush || true
    
    # Clean old Docker images if Docker is available
    if command -v docker >/dev/null 2>&1; then
        log $BLUE "Cleaning old Docker images..."
        docker image prune -f > /dev/null 2>&1 || true
    fi
    
    # Clean old backups (keep last 10)
    log $BLUE "Cleaning old backups..."
    find /var/backups/commerce-core -name "deployment_*" -type d | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
    
    log $GREEN "✓ System cleanup completed"
}

# Function to optimize database and cache
optimize_system() {
    log $BLUE "Optimizing system performance..."
    
    # Database optimization
    if [ -n "${DATABASE_HOST:-}" ]; then
        log $BLUE "Optimizing database..."
        
        # Run VACUUM and ANALYZE on PostgreSQL
        PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "VACUUM ANALYZE;" 2>/dev/null || log $YELLOW "Database optimization skipped"
        
        # Update table statistics
        PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "UPDATE pg_stat_user_tables SET n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0;" 2>/dev/null || true
    fi
    
    # Redis optimization
    if [ -n "${REDIS_HOST:-}" ] && command -v redis-cli >/dev/null 2>&1; then
        log $BLUE "Optimizing Redis cache..."
        
        # Get Redis info
        local redis_memory=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        log $BLUE "Redis memory usage: $redis_memory"
        
        # Clean expired keys
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern "*expired*" | xargs -r redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" del 2>/dev/null || true
    fi
    
    # File system optimization
    log $BLUE "Optimizing file system..."
    sync
    
    log $GREEN "✓ System optimization completed"
}

# Function to create full system backup
create_full_backup() {
    log $BLUE "Creating full system backup..."
    
    cd "$PROJECT_DIR"
    
    # Application backup
    if [ -f "./database/scripts/backup.sh" ]; then
        ./database/scripts/backup.sh
        log $GREEN "✓ Database backup completed"
    fi
    
    # Configuration backup
    local config_backup_dir="/var/backups/commerce-core/config_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$config_backup_dir"
    
    # Backup configuration files
    cp -r "$PROJECT_DIR/config" "$config_backup_dir/" 2>/dev/null || true
    cp "$PROJECT_DIR/ecosystem.config.js" "$config_backup_dir/" 2>/dev/null || true
    cp -r "/etc/nginx/sites-available" "$config_backup_dir/nginx/" 2>/dev/null || true
    
    log $GREEN "✓ Configuration backup completed: $config_backup_dir"
    
    # System backup summary
    log $BLUE "Backup summary:"
    log $BLUE "- Database: Latest backup in database/backup/"
    log $BLUE "- Configuration: $config_backup_dir"
    log $BLUE "- Application: Use deployment backup system"
}

# Function to rotate logs
rotate_logs() {
    log $BLUE "Rotating application logs..."
    
    # Rotate PM2 logs
    pm2 flush
    pm2 reloadLogs
    
    # Rotate nginx logs
    if command -v logrotate >/dev/null 2>&1; then
        logrotate -f /etc/logrotate.d/nginx
    fi
    
    # Rotate application logs
    local log_dir="/var/log/commerce-core"
    if [ -d "$log_dir" ]; then
        find "$log_dir" -name "*.log" -size +100M -exec gzip {} \; 2>/dev/null || true
    fi
    
    log $GREEN "✓ Log rotation completed"
}

# Function to run full health check
run_full_health_check() {
    log $BLUE "Running comprehensive health check..."
    
    cd "$PROJECT_DIR"
    
    # Run application health check
    if [ -f "./scripts/health-check.sh" ]; then
        ./scripts/health-check.sh comprehensive
    else
        log $YELLOW "Health check script not found"
    fi
    
    # Check Korean business metrics
    local current_hour=$(date +%H)
    if [ "$current_hour" -ge 9 ] && [ "$current_hour" -le 18 ]; then
        log $BLUE "Checking Korean business hours metrics..."
        
        # Check payment gateways
        local payment_health="http://localhost:3000/api/payment/health"
        if curl -f -s --max-time 10 "$payment_health" > /dev/null; then
            log $GREEN "✓ Payment gateways: OK"
        else
            log $RED "✗ Payment gateways: FAILED"
        fi
        
        # Check cart service
        local cart_health="http://localhost:3000/api/cart/health"
        if curl -f -s --max-time 10 "$cart_health" > /dev/null; then
            log $GREEN "✓ Cart service: OK"
        else
            log $RED "✗ Cart service: FAILED"
        fi
    fi
    
    log $GREEN "✓ Full health check completed"
}

# Function to run Korean business hours maintenance
korean_business_maintenance() {
    local current_hour=$(date +%H)
    local current_day=$(date +%u) # 1=Monday, 7=Sunday
    
    log $BLUE "Korean business hours maintenance routine..."
    log $BLUE "Current time: $(date) (Hour: $current_hour, Day: $current_day)"
    
    # Early morning maintenance (3-4 AM KST)
    if [ "$current_hour" -eq 3 ]; then
        log $BLUE "Running early morning maintenance (3 AM KST)..."
        
        # Database maintenance
        optimize_system
        
        # Log rotation
        rotate_logs
        
        # Restart PM2 processes for fresh start
        pm2 restart ecosystem.config.js
        
        log $GREEN "✓ Early morning maintenance completed"
        
    # Pre-business maintenance (8 AM KST)
    elif [ "$current_hour" -eq 8 ]; then
        log $BLUE "Running pre-business maintenance (8 AM KST)..."
        
        # Health check before business hours
        run_full_health_check
        
        # Cache warming for Korean business hours
        if curl -f -s "http://localhost:3000/api/cache/warm" > /dev/null; then
            log $GREEN "✓ Cache warmed for business hours"
        fi
        
        log $GREEN "✓ Pre-business maintenance completed"
        
    # Peak hour monitoring (12-13 PM, 20-22 PM KST)
    elif ([ "$current_hour" -ge 12 ] && [ "$current_hour" -le 13 ]) || ([ "$current_hour" -ge 20 ] && [ "$current_hour" -le 22 ]); then
        log $BLUE "Peak hour monitoring active..."
        
        # Monitor system resources during peak
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
        local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        log $BLUE "Peak hour metrics - CPU: ${cpu_usage}% Memory: ${memory_usage}%"
        
        # Alert if resources are high during peak
        if [ "${cpu_usage%.*}" -gt 85 ]; then
            log $YELLOW "⚠ High CPU usage during peak hours: ${cpu_usage}%"
        fi
        
    # Weekend maintenance (Saturday 2 AM KST)
    elif [ "$current_day" -eq 6 ] && [ "$current_hour" -eq 2 ]; then
        log $BLUE "Running weekend maintenance (Saturday 2 AM KST)..."
        
        # Full system maintenance
        enable_maintenance_mode "Weekend maintenance" "2 hours"
        
        # Comprehensive cleanup
        run_cleanup true
        
        # Full backup
        create_full_backup
        
        # System optimization
        optimize_system
        
        disable_maintenance_mode
        
        log $GREEN "✓ Weekend maintenance completed"
        
    else
        log $BLUE "No scheduled maintenance for current time"
        
        # Always run basic health check
        if curl -f -s "http://localhost:3000/health" > /dev/null; then
            log $GREEN "✓ Basic health check: OK"
        else
            log $RED "✗ Basic health check: FAILED"
        fi
    fi
}

# Main function
main() {
    local command=""
    local force=false
    local quiet=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            enable-maintenance|disable-maintenance|status|cleanup|optimize|backup|log-rotation|health-full|korean-business)
                command="$1"
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -q|--quiet)
                quiet=true
                shift
                ;;
            -h|--help)
                show_usage
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                ;;
        esac
    done
    
    if [ -z "$command" ]; then
        show_usage
    fi
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Execute command
    case "$command" in
        "enable-maintenance")
            enable_maintenance_mode
            ;;
        "disable-maintenance")
            disable_maintenance_mode
            ;;
        "status")
            show_maintenance_status
            ;;
        "cleanup")
            run_cleanup "$force"
            ;;
        "optimize")
            optimize_system
            ;;
        "backup")
            create_full_backup
            ;;
        "log-rotation")
            rotate_logs
            ;;
        "health-full")
            run_full_health_check
            ;;
        "korean-business")
            korean_business_maintenance
            ;;
    esac
}

# Execute main function
main "$@"