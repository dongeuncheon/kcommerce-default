#!/bin/bash

# ==================================================
# PostgreSQL Database Backup Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Configuration
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-commerce_core}"
DB_USER="${DATABASE_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo "Starting database backup..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"

# Create database backup
PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --verbose \
    --clean \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file="$BACKUP_FILE"

# Compress backup file
echo "Compressing backup file..."
gzip "$BACKUP_FILE"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "$COMPRESSED_FILE" "s3://$S3_BUCKET/database-backups/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    if [ $? -eq 0 ]; then
        echo "Backup successfully uploaded to S3"
    else
        echo "Failed to upload backup to S3"
        exit 1
    fi
fi

# Create backup metadata
cat > "$BACKUP_DIR/backup_${TIMESTAMP}.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "backup_file": "$(basename "$COMPRESSED_FILE")",
  "file_size": $(stat -c%s "$COMPRESSED_FILE" 2>/dev/null || stat -f%z "$COMPRESSED_FILE"),
  "created_at": "$(date -Iseconds)",
  "s3_uploaded": $([ -n "$S3_BUCKET" ] && echo "true" || echo "false")
}
EOF

# Clean up old backups
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "backup_*.json" -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [ -n "$S3_BUCKET" ]; then
    # Note: This requires awscli and proper IAM permissions
    OLD_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    aws s3 ls "s3://$S3_BUCKET/database-backups/" | \
        awk '$1 < "'$OLD_DATE'" {print $4}' | \
        while read file; do
            if [ -n "$file" ]; then
                aws s3 rm "s3://$S3_BUCKET/database-backups/$file"
                echo "Deleted old S3 backup: $file"
            fi
        done
fi

echo "Database backup completed successfully!"
echo "Backup file: $COMPRESSED_FILE"
echo "Backup size: $(du -h "$COMPRESSED_FILE" | cut -f1)"

# Send notification (if configured)
if [ -n "${BACKUP_NOTIFICATION_URL:-}" ]; then
    curl -X POST "$BACKUP_NOTIFICATION_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"Database backup completed\", \"database\": \"$DB_NAME\", \"timestamp\": \"$TIMESTAMP\"}" \
        2>/dev/null || echo "Failed to send notification"
fi

exit 0