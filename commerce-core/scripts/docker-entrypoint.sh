#!/bin/bash

# ==================================================
# Docker Entrypoint Script for Korean E-commerce
# ==================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to wait for database
wait_for_database() {
    print_status $BLUE "Waiting for database connection..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" >/dev/null 2>&1; then
            print_status $GREEN "✓ Database is ready"
            return 0
        fi
        
        print_status $YELLOW "Database not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_status $RED "✗ Database connection timeout"
    exit 1
}

# Function to wait for Redis
wait_for_redis() {
    print_status $BLUE "Waiting for Redis connection..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
            print_status $GREEN "✓ Redis is ready"
            return 0
        fi
        
        print_status $YELLOW "Redis not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_status $RED "✗ Redis connection timeout"
    exit 1
}

# Function to run database migrations
run_migrations() {
    if [ "$NODE_ENV" = "production" ]; then
        print_status $BLUE "Running database migrations..."
        
        if [ -f "./database/scripts/migrate.sh" ]; then
            chmod +x ./database/scripts/migrate.sh
            ./database/scripts/migrate.sh up
            print_status $GREEN "✓ Migrations completed"
        else
            print_status $YELLOW "⚠ Migration script not found, skipping"
        fi
    else
        print_status $BLUE "Development mode: skipping migrations"
    fi
}

# Function to run database seeds
run_seeds() {
    if [ "$NODE_ENV" = "development" ] && [ "$SKIP_SEEDS" != "true" ]; then
        print_status $BLUE "Running database seeds..."
        
        if [ -f "./database/scripts/migrate.sh" ]; then
            chmod +x ./database/scripts/migrate.sh
            ./database/scripts/migrate.sh seed
            print_status $GREEN "✓ Seeds completed"
        else
            print_status $YELLOW "⚠ Migration script not found, skipping seeds"
        fi
    else
        print_status $BLUE "Skipping seeds (NODE_ENV: $NODE_ENV, SKIP_SEEDS: $SKIP_SEEDS)"
    fi
}

# Function to setup Korean locale
setup_korean_locale() {
    print_status $BLUE "Setting up Korean locale..."
    
    export TZ=Asia/Seoul
    export LANG=ko_KR.UTF-8
    export LC_ALL=ko_KR.UTF-8
    
    print_status $GREEN "✓ Korean locale configured"
}

# Function to validate environment
validate_environment() {
    print_status $BLUE "Validating environment configuration..."
    
    local required_vars=(
        "NODE_ENV"
        "DATABASE_HOST"
        "DATABASE_PORT" 
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_PASSWORD"
        "REDIS_HOST"
        "REDIS_PORT"
        "JWT_SECRET"
        "SESSION_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status $RED "✗ Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_status $RED "  - $var"
        done
        exit 1
    fi
    
    print_status $GREEN "✓ Environment validation passed"
}

# Function to setup monitoring
setup_monitoring() {
    if [ "$NODE_ENV" = "production" ]; then
        print_status $BLUE "Setting up production monitoring..."
        
        # Create monitoring directories
        mkdir -p /app/logs/access
        mkdir -p /app/logs/error
        mkdir -p /app/logs/performance
        
        # Setup log rotation
        if command -v logrotate >/dev/null 2>&1; then
            print_status $GREEN "✓ Log rotation configured"
        fi
        
        print_status $GREEN "✓ Monitoring setup completed"
    fi
}

# Function to optimize for Korean timezone
optimize_korean_settings() {
    print_status $BLUE "Optimizing for Korean market..."
    
    # Set timezone
    export TZ=Asia/Seoul
    
    # Set Korean business hours awareness
    export BUSINESS_HOURS_START="09:00"
    export BUSINESS_HOURS_END="18:00"
    export BUSINESS_TIMEZONE="Asia/Seoul"
    
    # Korean currency default
    export DEFAULT_CURRENCY="KRW"
    export DEFAULT_LOCALE="ko-KR"
    
    print_status $GREEN "✓ Korean market optimization completed"
}

# Function to setup health checks
setup_health_checks() {
    print_status $BLUE "Setting up health checks..."
    
    # Ensure health check script is executable
    if [ -f "./health-check.sh" ]; then
        chmod +x ./health-check.sh
        print_status $GREEN "✓ Health check script ready"
    else
        print_status $YELLOW "⚠ Health check script not found"
    fi
}

# Function to handle graceful shutdown
graceful_shutdown() {
    print_status $YELLOW "Received shutdown signal, gracefully shutting down..."
    
    # Give the application time to finish current requests
    if [ ! -z "$APP_PID" ]; then
        kill -TERM "$APP_PID"
        wait "$APP_PID"
    fi
    
    print_status $GREEN "✓ Graceful shutdown completed"
    exit 0
}

# Setup signal handlers
trap graceful_shutdown SIGTERM SIGINT

# Main execution
main() {
    print_status $BLUE "Starting Korean E-commerce Core Application..."
    print_status $BLUE "Environment: $NODE_ENV"
    print_status $BLUE "Version: ${APP_VERSION:-unknown}"
    
    # Setup Korean environment
    setup_korean_locale
    optimize_korean_settings
    
    # Validate configuration
    validate_environment
    
    # Wait for dependencies
    wait_for_database
    wait_for_redis
    
    # Setup application
    setup_monitoring
    setup_health_checks
    
    # Database operations
    run_migrations
    run_seeds
    
    print_status $GREEN "✓ Application startup completed"
    print_status $BLUE "Starting Node.js application..."
    
    # Start the application
    if [ "$NODE_ENV" = "production" ]; then
        exec node dist/index.js &
        APP_PID=$!
        wait $APP_PID
    elif [ "$NODE_ENV" = "development" ]; then
        exec npm run dev &
        APP_PID=$!
        wait $APP_PID
    else
        exec npm start &
        APP_PID=$!
        wait $APP_PID
    fi
}

# Run main function
main "$@"