#!/bin/bash

# ==================================================
# Rollback Script for Korean E-commerce
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
BACKUP_DIR="/var/backups/commerce-core"
LOG_FILE="/var/log/commerce-core/rollback.log"

# Function to print colored output with timestamp
log() {
    local color=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [BACKUP_IDENTIFIER]"
    echo ""
    echo "Options:"
    echo "  -l, --list         List available backups"
    echo "  -f, --force        Force rollback without confirmation"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -l                           # List available backups"
    echo "  $0 20231201_140000              # Rollback to specific backup"
    echo "  $0 -f latest                    # Force rollback to latest backup"
    echo ""
    exit 1
}

# Function to list available backups
list_backups() {
    log $BLUE "Available backups:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log $YELLOW "No backup directory found"
        return 1
    fi
    
    local backups=($(ls -t "$BACKUP_DIR"/deployment_* 2>/dev/null || echo ""))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log $YELLOW "No backups found"
        return 1
    fi
    
    echo "ID    Date                 Size     Type"
    echo "----------------------------------------"
    
    local i=1
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local backup_date=$(echo "$backup_name" | sed 's/deployment_//' | sed 's/_/ /')
        local backup_size=$(du -sh "$backup" 2>/dev/null | cut -f1 || echo "Unknown")
        local backup_type="Application"
        
        printf "%-4s %-18s %-8s %-10s\n" "$i" "$backup_date" "$backup_size" "$backup_type"
        i=$((i + 1))
    done
    
    echo ""
    log $BLUE "Database backups:"
    if [ -d "$PROJECT_DIR/database/backup" ]; then
        ls -la "$PROJECT_DIR/database/backup"/*.sql.gz 2>/dev/null || log $YELLOW "No database backups found"
    fi
}

# Function to validate backup
validate_backup() {
    local backup_path="$1"
    
    log $BLUE "Validating backup: $backup_path"
    
    if [ ! -d "$backup_path" ]; then
        log $RED "✗ Backup directory not found: $backup_path"
        return 1
    fi
    
    # Check essential files
    local essential_files=("package.json" "ecosystem.config.js")
    for file in "${essential_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            log $RED "✗ Essential file missing: $file"
            return 1
        fi
    done
    
    # Check if backup is corrupted
    local backup_size=$(du -s "$backup_path" | cut -f1)
    if [ "$backup_size" -lt 1000 ]; then # Less than 1MB
        log $RED "✗ Backup appears corrupted (too small: ${backup_size}KB)"
        return 1
    fi
    
    log $GREEN "✓ Backup validation passed"
    return 0
}

# Function to get backup path
get_backup_path() {
    local backup_identifier="$1"
    
    if [ "$backup_identifier" = "latest" ]; then
        # Get the most recent backup
        local latest_backup=$(ls -t "$BACKUP_DIR"/deployment_* 2>/dev/null | head -1)
        if [ -n "$latest_backup" ]; then
            echo "$latest_backup"
        else
            return 1
        fi
    elif [[ "$backup_identifier" =~ ^[0-9]+$ ]]; then
        # Backup by index number
        local backups=($(ls -t "$BACKUP_DIR"/deployment_* 2>/dev/null || echo ""))
        local index=$((backup_identifier - 1))
        if [ $index -ge 0 ] && [ $index -lt ${#backups[@]} ]; then
            echo "${backups[$index]}"
        else
            return 1
        fi
    else
        # Backup by timestamp
        local backup_path="$BACKUP_DIR/deployment_$backup_identifier"
        if [ -d "$backup_path" ]; then
            echo "$backup_path"
        else
            return 1
        fi
    fi
}

# Function to stop services
stop_services() {
    log $BLUE "Stopping current services..."
    
    # Stop PM2 processes gracefully
    if pm2 list | grep -q "commerce-core"; then
        pm2 stop ecosystem.config.js
        log $GREEN "✓ PM2 processes stopped"
    fi
    
    # Wait for graceful shutdown
    sleep 5
    
    # Force kill if necessary
    local remaining_processes=$(pgrep -f "commerce-core" || echo "")
    if [ ! -z "$remaining_processes" ]; then
        log $YELLOW "⚠ Force killing remaining processes"
        pkill -f "commerce-core" || true
        sleep 2
    fi
    
    log $GREEN "✓ Services stopped"
}

# Function to backup current state
backup_current_state() {
    log $BLUE "Backing up current state before rollback..."
    
    local current_backup_dir="$BACKUP_DIR/pre_rollback_$(date "+%Y%m%d_%H%M%S")"
    
    if [ -d "$PROJECT_DIR" ]; then
        mkdir -p "$current_backup_dir"
        rsync -av --exclude 'node_modules' --exclude 'logs' --exclude '.git' \
            "$PROJECT_DIR/" "$current_backup_dir/"
        log $GREEN "✓ Current state backed up to: $current_backup_dir"
    fi
}

# Function to restore application
restore_application() {
    local backup_path="$1"
    
    log $BLUE "Restoring application from: $backup_path"
    
    # Move current directory
    if [ -d "$PROJECT_DIR" ]; then
        local failed_dir="$PROJECT_DIR.failed.$(date "+%Y%m%d_%H%M%S")"
        mv "$PROJECT_DIR" "$failed_dir"
        log $GREEN "✓ Current deployment moved to: $failed_dir"
    fi
    
    # Restore from backup
    cp -r "$backup_path" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # Set proper permissions
    chown -R deploy:deploy "$PROJECT_DIR"
    chmod +x "$PROJECT_DIR/scripts/"*.sh 2>/dev/null || true
    chmod +x "$PROJECT_DIR/database/scripts/"*.sh 2>/dev/null || true
    
    log $GREEN "✓ Application restored from backup"
}

# Function to restore dependencies
restore_dependencies() {
    log $BLUE "Restoring dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Install dependencies
    if [ -f "package-lock.json" ]; then
        npm ci --production --silent
    else
        npm install --production --silent
    fi
    
    log $GREEN "✓ Dependencies restored"
}

# Function to restore database
restore_database() {
    log $BLUE "Database rollback options:"
    echo "1. Keep current database (recommended for minor rollbacks)"
    echo "2. Restore from latest database backup"
    echo "3. Skip database restoration"
    
    read -p "Choose option (1-3) [default: 1]: " db_option
    db_option=${db_option:-1}
    
    case $db_option in
        1)
            log $GREEN "✓ Keeping current database"
            ;;
        2)
            log $BLUE "Restoring database from backup..."
            if [ -f "$PROJECT_DIR/database/scripts/restore.sh" ]; then
                cd "$PROJECT_DIR"
                local latest_db_backup=$(ls -t database/backup/*.sql.gz 2>/dev/null | head -1 || echo "")
                if [ -n "$latest_db_backup" ]; then
                    ./database/scripts/restore.sh "$latest_db_backup"
                    log $GREEN "✓ Database restored from backup"
                else
                    log $YELLOW "⚠ No database backup found, keeping current database"
                fi
            else
                log $YELLOW "⚠ Database restore script not found"
            fi
            ;;
        3)
            log $BLUE "Skipping database restoration"
            ;;
        *)
            log $YELLOW "Invalid option, keeping current database"
            ;;
    esac
}

# Function to start services
start_services() {
    log $BLUE "Starting services..."
    
    cd "$PROJECT_DIR"
    
    # Start PM2 processes
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env korean_production
        sleep 10
        
        # Check if services started successfully
        local running_apps=$(pm2 list | grep -c "online" || echo "0")
        if [ "$running_apps" -gt 0 ]; then
            log $GREEN "✓ Services started ($running_apps processes online)"
        else
            log $RED "✗ Failed to start services"
            return 1
        fi
    else
        log $RED "✗ PM2 configuration not found"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    log $BLUE "Running post-rollback health checks..."
    
    # Wait for application to stabilize
    sleep 15
    
    cd "$PROJECT_DIR"
    
    # Run health check if available
    if [ -f "./scripts/health-check.sh" ]; then
        if ./scripts/health-check.sh comprehensive; then
            log $GREEN "✓ Health checks passed"
            return 0
        else
            log $RED "✗ Health checks failed"
            return 1
        fi
    else
        # Basic health check
        if curl -f -s "http://localhost:3000/health" > /dev/null; then
            log $GREEN "✓ Basic health check passed"
            return 0
        else
            log $RED "✗ Basic health check failed"
            return 1
        fi
    fi
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Korean E-commerce Rollback\\n**Status:** $status\\n**Message:** $message\\n**Time:** $(date)\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
}

# Main rollback function
main() {
    local start_time=$(date +%s)
    local backup_identifier=""
    local force_rollback=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--list)
                list_backups
                exit 0
                ;;
            -f|--force)
                force_rollback=true
                shift
                ;;
            -h|--help)
                show_usage
                ;;
            -*)
                echo "Unknown option $1"
                show_usage
                ;;
            *)
                backup_identifier="$1"
                shift
                ;;
        esac
    done
    
    # Check if backup identifier is provided
    if [ -z "$backup_identifier" ]; then
        log $RED "Error: Backup identifier not specified"
        echo ""
        list_backups
        echo ""
        show_usage
    fi
    
    log $BLUE "Starting Korean E-commerce rollback..."
    log $BLUE "Backup identifier: $backup_identifier"
    log $BLUE "Timestamp: $(date)"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Get backup path
    local backup_path
    if ! backup_path=$(get_backup_path "$backup_identifier"); then
        log $RED "✗ Backup not found: $backup_identifier"
        echo ""
        list_backups
        exit 1
    fi
    
    log $BLUE "Using backup: $backup_path"
    
    # Validate backup
    if ! validate_backup "$backup_path"; then
        log $RED "✗ Backup validation failed"
        exit 1
    fi
    
    # Confirmation (unless forced)
    if [ "$force_rollback" = false ]; then
        echo ""
        log $YELLOW "⚠ WARNING: This will rollback the application to a previous state!"
        log $YELLOW "Current deployment will be backed up before rollback."
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirmation
        
        if [ "$confirmation" != "yes" ]; then
            log $BLUE "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Execute rollback
    trap 'log $RED "Rollback failed! Manual intervention may be required."; exit 1' ERR
    
    backup_current_state
    stop_services
    restore_application "$backup_path"
    restore_dependencies
    restore_database
    start_services
    
    # Health checks
    if ! run_health_checks; then
        log $RED "✗ Post-rollback health checks failed"
        send_notification "FAILED" "Rollback completed but health checks failed"
        exit 1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log $GREEN "✓ Rollback completed successfully!"
    log $GREEN "Total rollback time: ${duration} seconds"
    
    # Send success notification
    send_notification "SUCCESS" "Rollback completed successfully in ${duration} seconds"
    
    # Display final status
    log $BLUE "=== Rollback Summary ==="
    log $BLUE "Backup used: $backup_path"
    log $BLUE "Duration: ${duration} seconds"
    log $BLUE "PM2 Status:"
    pm2 list
    log $BLUE "======================="
}

# Execute main function
main "$@"