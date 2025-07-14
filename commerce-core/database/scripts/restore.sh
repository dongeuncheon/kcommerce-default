#!/bin/bash

# ==================================================
# PostgreSQL Database Restore Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Configuration
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-commerce_core}"
DB_USER="${DATABASE_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] BACKUP_FILE"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -f, --force         Drop and recreate database without confirmation"
    echo "  -s, --s3            Download backup from S3 bucket"
    echo "  -l, --list          List available backups"
    echo ""
    echo "Examples:"
    echo "  $0 backup_20231201_140000.sql.gz"
    echo "  $0 -s commerce_core_backup_20231201_140000.sql.gz"
    echo "  $0 -l"
    exit 1
}

# Function to list available backups
list_backups() {
    echo "Available local backups:"
    ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print $9, $5, $6, $7, $8}' || echo "No backups found"
    
    if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
        echo ""
        echo "Available S3 backups:"
        aws s3 ls "s3://$BACKUP_S3_BUCKET/database-backups/" 2>/dev/null || echo "Cannot access S3 bucket"
    fi
    exit 0
}

# Function to download from S3
download_from_s3() {
    local s3_file="$1"
    local local_file="$BACKUP_DIR/$(basename "$s3_file")"
    
    echo "Downloading $s3_file from S3..."
    aws s3 cp "s3://$BACKUP_S3_BUCKET/database-backups/$s3_file" "$local_file"
    
    if [ $? -eq 0 ]; then
        echo "Downloaded to $local_file"
        echo "$local_file"
    else
        echo "Failed to download from S3"
        exit 1
    fi
}

# Function to drop and recreate database
recreate_database() {
    echo "Dropping existing database..."
    PGPASSWORD="$DATABASE_PASSWORD" dropdb \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --if-exists \
        "$DB_NAME"
    
    echo "Creating new database..."
    PGPASSWORD="$DATABASE_PASSWORD" createdb \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --encoding=UTF8 \
        --locale=ko_KR.UTF-8 \
        "$DB_NAME"
}

# Parse command line arguments
FORCE=false
FROM_S3=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -s|--s3)
            FROM_S3=true
            shift
            ;;
        -l|--list)
            list_backups
            ;;
        -*)
            echo "Unknown option $1"
            show_usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo "Error: Backup file not specified"
    show_usage
fi

# Download from S3 if needed
if [ "$FROM_S3" = true ]; then
    if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
        echo "Error: S3 bucket not configured (BACKUP_S3_BUCKET)"
        exit 1
    fi
    BACKUP_FILE=$(download_from_s3 "$BACKUP_FILE")
else
    # Check if local backup file exists
    if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        echo "Error: Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
        exit 1
    fi
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

echo "Starting database restore..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"

# Confirm if not forced
if [ "$FORCE" = false ]; then
    echo ""
    echo "WARNING: This will completely replace the existing database!"
    echo "Database: $DB_NAME"
    echo "All current data will be lost!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

# Create backup of current database before restore
echo "Creating backup of current database before restore..."
CURRENT_BACKUP="$BACKUP_DIR/${DB_NAME}_pre_restore_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --file="$CURRENT_BACKUP" 2>/dev/null || echo "Warning: Could not create pre-restore backup"

# Drop and recreate database
recreate_database

# Restore from backup
echo "Restoring database from backup..."

# Check if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing and restoring..."
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DATABASE_PASSWORD" pg_restore \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges
else
    PGPASSWORD="$DATABASE_PASSWORD" pg_restore \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges \
        "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "Database restore completed successfully!"
    
    # Run post-restore checks
    echo "Running post-restore checks..."
    PGPASSWORD="$DATABASE_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --command="SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
    
    echo "Restore verification completed."
    
    # Send notification (if configured)
    if [ -n "${BACKUP_NOTIFICATION_URL:-}" ]; then
        curl -X POST "$BACKUP_NOTIFICATION_URL" \
            -H "Content-Type: application/json" \
            -d "{\"message\": \"Database restore completed\", \"database\": \"$DB_NAME\", \"backup_file\": \"$(basename "$BACKUP_FILE")\"}" \
            2>/dev/null || echo "Failed to send notification"
    fi
else
    echo "Database restore failed!"
    
    # Attempt to restore from pre-restore backup
    if [ -f "$CURRENT_BACKUP" ]; then
        echo "Attempting to restore from pre-restore backup..."
        recreate_database
        PGPASSWORD="$DATABASE_PASSWORD" pg_restore \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="$DB_NAME" \
            --verbose \
            --clean \
            --no-owner \
            --no-privileges \
            "$CURRENT_BACKUP"
        
        if [ $? -eq 0 ]; then
            echo "Successfully restored from pre-restore backup"
        else
            echo "Failed to restore from pre-restore backup!"
            echo "Database may be in an inconsistent state!"
        fi
    fi
    
    exit 1
fi

exit 0