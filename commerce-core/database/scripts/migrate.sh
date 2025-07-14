#!/bin/bash

# ==================================================
# Database Migration Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Configuration
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-commerce_core}"
DB_USER="${DATABASE_USER:-postgres}"
MIGRATION_DIR="${MIGRATION_DIR:-./database/migrations}"
SEED_DIR="${SEED_DIR:-./database/seeds}"

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
    echo -e "${color}${message}${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  up          Run all pending migrations"
    echo "  down        Rollback last migration"
    echo "  reset       Reset database (drop and recreate)"
    echo "  seed        Run seed data"
    echo "  status      Show migration status"
    echo "  create      Create new migration file"
    echo ""
    echo "Options:"
    echo "  -h, --help  Show this help message"
    echo "  -f, --file  Specific migration file to run"
    echo "  -v, --verbose Enable verbose output"
    echo ""
    echo "Examples:"
    echo "  $0 up"
    echo "  $0 down"
    echo "  $0 seed"
    echo "  $0 create add_new_table"
    exit 1
}

# Function to check database connection
check_connection() {
    print_status $BLUE "Checking database connection..."
    
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --command="SELECT version();" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_status $GREEN "✓ Database connection successful"
    else
        print_status $RED "✗ Database connection failed"
        exit 1
    fi
}

# Function to create migration tracking table
create_migration_table() {
    print_status $BLUE "Creating migration tracking table..."
    
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --command="
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            execution_time_ms INTEGER,
            checksum VARCHAR(64)
        );" > /dev/null
    
    print_status $GREEN "✓ Migration table ready"
}

# Function to calculate file checksum
calculate_checksum() {
    local file="$1"
    if command -v md5sum &> /dev/null; then
        md5sum "$file" | cut -d' ' -f1
    elif command -v md5 &> /dev/null; then
        md5 -q "$file"
    else
        echo "unknown"
    fi
}

# Function to run migration file
run_migration() {
    local file="$1"
    local filename=$(basename "$file")
    
    print_status $BLUE "Running migration: $filename"
    
    # Check if already executed
    local executed=$(PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --tuples-only \
        --no-align \
        --command="SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';")
    
    if [ "$executed" -gt 0 ]; then
        print_status $YELLOW "⚠ Migration already executed: $filename"
        return 0
    fi
    
    # Calculate checksum
    local checksum=$(calculate_checksum "$file")
    
    # Execute migration
    local start_time=$(date +%s%3N)
    
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --file="$file"
    
    if [ $? -eq 0 ]; then
        local end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))
        
        # Record migration
        PGPASSWORD="$DATABASE_PASSWORD" psql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="$DB_NAME" \
            --command="INSERT INTO schema_migrations (filename, execution_time_ms, checksum) VALUES ('$filename', $execution_time, '$checksum');" > /dev/null
        
        print_status $GREEN "✓ Migration completed: $filename (${execution_time}ms)"
    else
        print_status $RED "✗ Migration failed: $filename"
        exit 1
    fi
}

# Function to run all migrations
run_migrations() {
    print_status $BLUE "Running database migrations..."
    
    if [ ! -d "$MIGRATION_DIR" ]; then
        print_status $RED "Migration directory not found: $MIGRATION_DIR"
        exit 1
    fi
    
    # Sort migration files by name
    for file in $(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
        run_migration "$file"
    done
    
    print_status $GREEN "✓ All migrations completed"
}

# Function to rollback last migration
rollback_migration() {
    print_status $BLUE "Rolling back last migration..."
    
    local last_migration=$(PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --tuples-only \
        --no-align \
        --command="SELECT filename FROM schema_migrations ORDER BY executed_at DESC LIMIT 1;")
    
    if [ -z "$last_migration" ]; then
        print_status $YELLOW "No migrations to rollback"
        return 0
    fi
    
    # Look for rollback file
    local rollback_file="$MIGRATION_DIR/rollback_$(echo "$last_migration" | sed 's/\.sql$//')"
    
    if [ -f "$rollback_file.sql" ]; then
        print_status $BLUE "Running rollback: $rollback_file.sql"
        
        PGPASSWORD="$DATABASE_PASSWORD" psql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="$DB_NAME" \
            --file="$rollback_file.sql"
        
        if [ $? -eq 0 ]; then
            # Remove migration record
            PGPASSWORD="$DATABASE_PASSWORD" psql \
                --host="$DB_HOST" \
                --port="$DB_PORT" \
                --username="$DB_USER" \
                --dbname="$DB_NAME" \
                --command="DELETE FROM schema_migrations WHERE filename = '$last_migration';" > /dev/null
            
            print_status $GREEN "✓ Rollback completed: $last_migration"
        else
            print_status $RED "✗ Rollback failed"
            exit 1
        fi
    else
        print_status $RED "✗ Rollback file not found: $rollback_file.sql"
        exit 1
    fi
}

# Function to reset database
reset_database() {
    print_status $YELLOW "⚠ This will completely reset the database!"
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_status $BLUE "Database reset cancelled"
        return 0
    fi
    
    print_status $BLUE "Resetting database..."
    
    # Drop all tables
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null
    
    print_status $GREEN "✓ Database reset completed"
    
    # Run migrations again
    create_migration_table
    run_migrations
}

# Function to run seed data
run_seeds() {
    print_status $BLUE "Running seed data..."
    
    if [ ! -d "$SEED_DIR" ]; then
        print_status $RED "Seed directory not found: $SEED_DIR"
        exit 1
    fi
    
    # Sort seed files by name
    for file in $(ls "$SEED_DIR"/*.sql 2>/dev/null | sort); do
        local filename=$(basename "$file")
        print_status $BLUE "Running seed: $filename"
        
        PGPASSWORD="$DATABASE_PASSWORD" psql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="$DB_NAME" \
            --file="$file"
        
        if [ $? -eq 0 ]; then
            print_status $GREEN "✓ Seed completed: $filename"
        else
            print_status $RED "✗ Seed failed: $filename"
            exit 1
        fi
    done
    
    print_status $GREEN "✓ All seeds completed"
}

# Function to show migration status
show_status() {
    print_status $BLUE "Migration Status:"
    echo ""
    
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --command="
        SELECT 
            filename,
            executed_at,
            execution_time_ms || 'ms' as execution_time
        FROM schema_migrations 
        ORDER BY executed_at;" 2>/dev/null || print_status $YELLOW "Migration table not found"
}

# Function to create new migration file
create_migration() {
    local name="$1"
    if [ -z "$name" ]; then
        print_status $RED "Migration name required"
        exit 1
    fi
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local filename="${timestamp}_${name}.sql"
    local filepath="$MIGRATION_DIR/$filename"
    
    mkdir -p "$MIGRATION_DIR"
    
    cat > "$filepath" << EOF
-- ==================================================
-- Migration: $name
-- Created: $(date)
-- ==================================================

-- Add your migration SQL here

EOF
    
    print_status $GREEN "✓ Migration file created: $filepath"
}

# Main script logic
COMMAND=""
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        up|down|reset|seed|status|create)
            COMMAND="$1"
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -*)
            echo "Unknown option $1"
            show_usage
            ;;
        *)
            # For create command, this is the migration name
            if [ "$COMMAND" = "create" ]; then
                MIGRATION_NAME="$1"
            fi
            shift
            ;;
    esac
done

# Check if command is provided
if [ -z "$COMMAND" ]; then
    show_usage
fi

# Main execution
case "$COMMAND" in
    up)
        check_connection
        create_migration_table
        run_migrations
        ;;
    down)
        check_connection
        rollback_migration
        ;;
    reset)
        check_connection
        reset_database
        ;;
    seed)
        check_connection
        run_seeds
        ;;
    status)
        check_connection
        show_status
        ;;
    create)
        create_migration "${MIGRATION_NAME:-}"
        ;;
    *)
        print_status $RED "Unknown command: $COMMAND"
        show_usage
        ;;
esac

exit 0