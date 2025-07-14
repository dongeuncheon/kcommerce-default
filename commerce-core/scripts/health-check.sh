#!/bin/bash

# ==================================================
# Health Check Script for Korean E-commerce
# ==================================================

set -e

# Configuration
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/health}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-5}"
MAX_RETRIES="${HEALTH_CHECK_RETRIES:-3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check application health
check_app_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        # Check if the application responds
        if curl --silent --fail --max-time $TIMEOUT "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            return 0
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            sleep 1
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Function to check database connectivity
check_database() {
    if [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_PORT" ]; then
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" >/dev/null 2>&1; then
                return 0
            fi
        else
            # Fallback to netcat if pg_isready is not available
            if nc -z "$DATABASE_HOST" "$DATABASE_PORT" >/dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    
    return 1
}

# Function to check Redis connectivity
check_redis() {
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        if command -v redis-cli >/dev/null 2>&1; then
            if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
                return 0
            fi
        else
            # Fallback to netcat if redis-cli is not available
            if nc -z "$REDIS_HOST" "$REDIS_PORT" >/dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    
    return 1
}

# Function to check memory usage
check_memory() {
    local memory_usage
    local memory_limit=90 # 90% threshold
    
    if command -v free >/dev/null 2>&1; then
        memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
        
        if [ "$memory_usage" -lt "$memory_limit" ]; then
            return 0
        fi
    else
        # If 'free' command is not available, assume memory is OK
        return 0
    fi
    
    return 1
}

# Function to check disk space
check_disk_space() {
    local disk_usage
    local disk_limit=90 # 90% threshold
    
    if command -v df >/dev/null 2>&1; then
        disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
        
        if [ "$disk_usage" -lt "$disk_limit" ]; then
            return 0
        fi
    else
        # If 'df' command is not available, assume disk space is OK
        return 0
    fi
    
    return 1
}

# Function to perform comprehensive health check
comprehensive_health_check() {
    local exit_code=0
    local checks_passed=0
    local total_checks=5
    
    echo "Performing comprehensive health check..."
    echo "Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Timezone: $(date +"%Z %z")"
    echo "---"
    
    # Check application health
    if check_app_health; then
        print_status $GREEN "✓ Application health check passed"
        checks_passed=$((checks_passed + 1))
    else
        print_status $RED "✗ Application health check failed"
        exit_code=1
    fi
    
    # Check database connectivity
    if check_database; then
        print_status $GREEN "✓ Database connectivity check passed"
        checks_passed=$((checks_passed + 1))
    else
        print_status $RED "✗ Database connectivity check failed"
        exit_code=1
    fi
    
    # Check Redis connectivity
    if check_redis; then
        print_status $GREEN "✓ Redis connectivity check passed"
        checks_passed=$((checks_passed + 1))
    else
        print_status $RED "✗ Redis connectivity check failed"
        exit_code=1
    fi
    
    # Check memory usage
    if check_memory; then
        print_status $GREEN "✓ Memory usage check passed"
        checks_passed=$((checks_passed + 1))
    else
        print_status $YELLOW "⚠ Memory usage check warning"
        # Don't fail on memory warning
        checks_passed=$((checks_passed + 1))
    fi
    
    # Check disk space
    if check_disk_space; then
        print_status $GREEN "✓ Disk space check passed"
        checks_passed=$((checks_passed + 1))
    else
        print_status $YELLOW "⚠ Disk space check warning"
        # Don't fail on disk space warning
        checks_passed=$((checks_passed + 1))
    fi
    
    echo "---"
    echo "Health check summary: $checks_passed/$total_checks checks passed"
    
    if [ $exit_code -eq 0 ]; then
        print_status $GREEN "✓ Overall health check: HEALTHY"
    else
        print_status $RED "✗ Overall health check: UNHEALTHY"
    fi
    
    return $exit_code
}

# Function to perform quick health check (for Docker)
quick_health_check() {
    if check_app_health; then
        echo "healthy"
        return 0
    else
        echo "unhealthy"
        return 1
    fi
}

# Main execution
case "${1:-quick}" in
    "quick")
        quick_health_check
        ;;
    "comprehensive")
        comprehensive_health_check
        ;;
    "app")
        if check_app_health; then
            echo "Application is healthy"
            exit 0
        else
            echo "Application is unhealthy"
            exit 1
        fi
        ;;
    "database")
        if check_database; then
            echo "Database is healthy"
            exit 0
        else
            echo "Database is unhealthy"
            exit 1
        fi
        ;;
    "redis")
        if check_redis; then
            echo "Redis is healthy"
            exit 0
        else
            echo "Redis is unhealthy"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [quick|comprehensive|app|database|redis]"
        echo "  quick        - Quick health check (default, for Docker)"
        echo "  comprehensive - Detailed health check with all components"
        echo "  app          - Check application health only"
        echo "  database     - Check database connectivity only"
        echo "  redis        - Check Redis connectivity only"
        exit 1
        ;;
esac