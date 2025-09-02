#!/bin/bash

# Database Backup Scheduler for RIS Performance Dashboard
# This script runs automated database backups

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="postgres"
DB_PORT="5432"
DB_NAME="${POSTGRES_DB:-ris_dashboard}"
DB_USER="${POSTGRES_USER:-ris_user}"
SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/backup.log"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to perform backup
perform_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/ris_dashboard_${timestamp}.sql"
    local compressed_file="${backup_file}.gz"
    
    log "Starting database backup..."
    
    # Create SQL dump
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --no-password --format=plain --no-owner --no-privileges \
        > "$backup_file" 2>>"$BACKUP_DIR/backup.log"; then
        
        log "Database dump completed: $backup_file"
        
        # Compress the backup
        if gzip -$COMPRESSION_LEVEL "$backup_file"; then
            log "Backup compressed: $compressed_file"
            
            # Verify the compressed backup
            if gunzip -t "$compressed_file" 2>/dev/null; then
                log "Backup verification successful"
                
                # Calculate file size
                local file_size=$(du -h "$compressed_file" | cut -f1)
                log "Backup size: $file_size"
                
                # Record backup metadata
                cat >> "$BACKUP_DIR/backup_metadata.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "filename": "$(basename "$compressed_file")",
  "size": "$file_size",
  "database": "$DB_NAME",
  "status": "success"
},
EOF
                
            else
                log "ERROR: Backup verification failed"
                rm -f "$compressed_file"
                return 1
            fi
        else
            log "ERROR: Backup compression failed"
            rm -f "$backup_file"
            return 1
        fi
    else
        log "ERROR: Database dump failed"
        return 1
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Find and delete old backups
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
        log "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "ris_dashboard_*.sql.gz" -type f -mtime +$RETENTION_DAYS -print0)
    
    log "Cleanup completed. Deleted $deleted_count old backups."
}

# Function to create backup manifest
create_manifest() {
    local manifest_file="$BACKUP_DIR/backup_manifest.txt"
    
    {
        echo "# RIS Dashboard Backup Manifest"
        echo "# Generated on: $(date)"
        echo "# Database: $DB_NAME"
        echo "# Retention: $RETENTION_DAYS days"
        echo ""
        
        find "$BACKUP_DIR" -name "ris_dashboard_*.sql.gz" -type f -printf "%T+ %s %p\n" | sort -r
    } > "$manifest_file"
    
    log "Backup manifest updated: $manifest_file"
}

# Function to send backup notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Database Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "RIS Dashboard Backup $status" "$EMAIL_RECIPIENT" || true
    fi
}

# Function to restore database from backup
restore_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    log "Starting database restore from: $backup_file"
    
    # Check if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        if gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            > "$BACKUP_DIR/restore.log" 2>&1; then
            log "Database restore completed successfully"
            return 0
        else
            log "ERROR: Database restore failed. Check restore.log for details."
            return 1
        fi
    else
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$backup_file" \
            > "$BACKUP_DIR/restore.log" 2>&1; then
            log "Database restore completed successfully"
            return 0
        else
            log "ERROR: Database restore failed. Check restore.log for details."
            return 1
        fi
    fi
}

# Function to install crontab
install_cron() {
    log "Installing cron job with schedule: $SCHEDULE"
    
    # Create cron entry
    echo "$SCHEDULE /scripts/backup-scheduler.sh backup >> $BACKUP_DIR/cron.log 2>&1" > /tmp/crontab
    
    # Install crontab
    crontab /tmp/crontab
    
    log "Cron job installed successfully"
}

# Function to run as daemon
run_daemon() {
    log "Starting backup scheduler daemon..."
    
    # Install cron job
    install_cron
    
    # Start cron daemon
    crond -f -l 2 &
    CRON_PID=$!
    
    # Trap signals to clean shutdown
    trap "kill $CRON_PID; exit" SIGTERM SIGINT
    
    # Keep the container running
    while true; do
        sleep 3600  # Sleep for 1 hour
        
        # Check if cron is still running
        if ! kill -0 $CRON_PID 2>/dev/null; then
            log "Cron daemon died, restarting..."
            crond -f -l 2 &
            CRON_PID=$!
        fi
    done
}

# Main execution
case "${1:-daemon}" in
    "backup")
        if perform_backup; then
            cleanup_old_backups
            create_manifest
            send_notification "SUCCESS" "Database backup completed successfully"
            log "Backup operation completed successfully"
        else
            send_notification "FAILED" "Database backup failed. Check logs for details."
            log "Backup operation failed"
            exit 1
        fi
        ;;
    "restore")
        if [ -z "$2" ]; then
            log "Usage: $0 restore <backup_file>"
            exit 1
        fi
        restore_backup "$2"
        ;;
    "cleanup")
        cleanup_old_backups
        create_manifest
        ;;
    "list")
        log "Available backups:"
        find "$BACKUP_DIR" -name "ris_dashboard_*.sql.gz" -type f -printf "%T+ %s %p\n" | sort -r
        ;;
    "daemon")
        run_daemon
        ;;
    *)
        echo "Usage: $0 [backup|restore <file>|cleanup|list|daemon]"
        echo "  backup  - Perform a one-time backup"
        echo "  restore - Restore from a backup file"
        echo "  cleanup - Clean up old backups"
        echo "  list    - List available backups"
        echo "  daemon  - Run as a scheduled backup daemon (default)"
        exit 1
        ;;
esac