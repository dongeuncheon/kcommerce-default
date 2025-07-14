#!/bin/bash

# ==================================================
# Monitoring Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MONITOR_INTERVAL="${MONITOR_INTERVAL:-60}" # seconds
LOG_FILE="/var/log/commerce-core/monitoring.log"
ALERT_LOG_FILE="/var/log/commerce-core/alerts.log"
PROJECT_DIR="/var/www/commerce-core"

# Thresholds (Korean business optimized)
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
RESPONSE_TIME_THRESHOLD=2000 # milliseconds
ERROR_RATE_THRESHOLD=5 # percentage

# Korean business hours (KST)
PEAK_HOURS_START=12 # 12:00 PM
PEAK_HOURS_END=13   # 1:00 PM
EVENING_HOURS_START=20 # 8:00 PM  
EVENING_HOURS_END=22   # 10:00 PM

# Function to print colored output with timestamp
log() {
    local color=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to log alerts
alert() {
    local severity=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S KST")
    echo "[${timestamp}] [$severity] $message" >> "$ALERT_LOG_FILE"
    log $RED "🚨 ALERT [$severity]: $message"
}

# Function to check if it's peak hours
is_peak_hours() {
    local current_hour=$(date +%H)
    local current_hour_int=$((10#$current_hour))
    
    if [ $current_hour_int -ge $PEAK_HOURS_START ] && [ $current_hour_int -le $PEAK_HOURS_END ]; then
        return 0 # Peak lunch hours
    elif [ $current_hour_int -ge $EVENING_HOURS_START ] && [ $current_hour_int -le $EVENING_HOURS_END ]; then
        return 0 # Peak evening hours
    else
        return 1 # Off-peak hours
    fi
}

# Function to get Korean business context
get_business_context() {
    local hour=$(date +%H)
    local day_of_week=$(date +%u) # 1=Monday, 7=Sunday
    
    if [ $day_of_week -eq 6 ] || [ $day_of_week -eq 7 ]; then
        echo "weekend"
    elif is_peak_hours; then
        echo "peak"
    elif [ $hour -ge 9 ] && [ $hour -le 18 ]; then
        echo "business"
    else
        echo "off-hours"
    fi
}

# Function to check system resources
check_system_resources() {
    local context=$(get_business_context)
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*} # Remove decimals
    
    # Adjust threshold based on business context
    local cpu_limit=$CPU_THRESHOLD
    if [ "$context" = "peak" ]; then
        cpu_limit=90 # Allow higher CPU during peak
    elif [ "$context" = "off-hours" ]; then
        cpu_limit=70 # Lower threshold during off-hours
    fi
    
    if [ "$cpu_usage" -gt "$cpu_limit" ]; then
        alert "HIGH" "High CPU usage: ${cpu_usage}% (threshold: ${cpu_limit}%, context: $context)"
    fi
    
    # Memory usage
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local memory_usage=$((used_mem * 100 / total_mem))
    
    if [ "$memory_usage" -gt "$MEMORY_THRESHOLD" ]; then
        alert "HIGH" "High memory usage: ${memory_usage}% (threshold: $MEMORY_THRESHOLD%)"
    fi
    
    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        alert "CRITICAL" "High disk usage: ${disk_usage}% (threshold: $DISK_THRESHOLD%)"
    fi
    
    log $GREEN "✓ System resources: CPU:${cpu_usage}% MEM:${memory_usage}% DISK:${disk_usage}% (Context: $context)"
}

# Function to check application health
check_application_health() {
    local health_url="http://localhost:3000/health"
    local start_time=$(date +%s%3N)
    
    # Check if application responds
    if curl -f -s --max-time 10 "$health_url" > /dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        if [ "$response_time" -gt "$RESPONSE_TIME_THRESHOLD" ]; then
            alert "MEDIUM" "Slow response time: ${response_time}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)"
        fi
        
        log $GREEN "✓ Application health: OK (${response_time}ms)"
    else
        alert "CRITICAL" "Application health check failed"
    fi
}

# Function to check PM2 processes
check_pm2_processes() {
    local pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")
    local total_processes=$(echo "$pm2_status" | jq length 2>/dev/null || echo "0")
    local online_processes=$(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "online")] | length' 2>/dev/null || echo "0")
    local errored_processes=$(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "errored")] | length' 2>/dev/null || echo "0")
    
    if [ "$errored_processes" -gt 0 ]; then
        alert "HIGH" "PM2 processes in error state: $errored_processes"
    fi
    
    if [ "$online_processes" -eq 0 ] && [ "$total_processes" -gt 0 ]; then
        alert "CRITICAL" "No PM2 processes online"
    fi
    
    # Check for excessive restarts
    local restart_count=$(echo "$pm2_status" | jq '[.[] | .pm2_env.restart_time] | add' 2>/dev/null || echo "0")
    if [ "$restart_count" -gt 50 ]; then
        alert "MEDIUM" "High restart count detected: $restart_count total restarts"
    fi
    
    log $GREEN "✓ PM2 processes: $online_processes/$total_processes online, $errored_processes errored"
}

# Function to check database connectivity
check_database() {
    if [ -n "${DATABASE_HOST:-}" ] && [ -n "${DATABASE_PORT:-}" ]; then
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" >/dev/null 2>&1; then
                # Check connection pool
                local active_connections=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs || echo "0")
                
                if [ "$active_connections" -gt 15 ]; then
                    alert "MEDIUM" "High database connections: $active_connections active"
                fi
                
                log $GREEN "✓ Database: OK ($active_connections active connections)"
            else
                alert "CRITICAL" "Database connection failed"
            fi
        else
            alert "MEDIUM" "pg_isready not available, skipping database check"
        fi
    fi
}

# Function to check Redis
check_redis() {
    if [ -n "${REDIS_HOST:-}" ] && [ -n "${REDIS_PORT:-}" ]; then
        if command -v redis-cli >/dev/null 2>&1; then
            local redis_info=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info memory 2>/dev/null || echo "")
            
            if [ -n "$redis_info" ]; then
                local used_memory=$(echo "$redis_info" | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
                local memory_usage=$(echo "$redis_info" | grep "used_memory_rss_human" | cut -d: -f2 | tr -d '\r')
                
                log $GREEN "✓ Redis: OK (Memory: $used_memory, RSS: $memory_usage)"
            else
                alert "CRITICAL" "Redis connection failed"
            fi
        else
            alert "MEDIUM" "redis-cli not available, skipping Redis check"
        fi
    fi
}

# Function to check error rates
check_error_rates() {
    local nginx_log="/var/log/nginx/access.log"
    local app_log="/app/logs/pm2-error.log"
    
    # Check recent HTTP errors (last 5 minutes)
    if [ -f "$nginx_log" ]; then
        local recent_time=$(date -d '5 minutes ago' '+%d/%b/%Y:%H:%M')
        local total_requests=$(grep "$recent_time" "$nginx_log" 2>/dev/null | wc -l || echo "0")
        local error_requests=$(grep "$recent_time" "$nginx_log" 2>/dev/null | grep -E " (4[0-9][0-9]|5[0-9][0-9]) " | wc -l || echo "0")
        
        if [ "$total_requests" -gt 0 ]; then
            local error_rate=$((error_requests * 100 / total_requests))
            
            if [ "$error_rate" -gt "$ERROR_RATE_THRESHOLD" ]; then
                alert "HIGH" "High error rate: ${error_rate}% (${error_requests}/${total_requests} requests)"
            fi
            
            log $GREEN "✓ Error rate: ${error_rate}% (${error_requests}/${total_requests} requests in last 5min)"
        fi
    fi
    
    # Check application errors
    if [ -f "$app_log" ]; then
        local recent_errors=$(tail -100 "$app_log" 2>/dev/null | grep "$(date '+%Y-%m-%d %H:')" | wc -l || echo "0")
        
        if [ "$recent_errors" -gt 10 ]; then
            alert "MEDIUM" "High application error count: $recent_errors in last hour"
        fi
    fi
}

# Function to check Korean-specific metrics
check_korean_metrics() {
    local context=$(get_business_context)
    local current_time=$(date '+%H:%M')
    
    # Check payment gateway status (Korean payment methods)
    if [ "$context" = "peak" ] || [ "$context" = "business" ]; then
        # Simulate payment gateway health checks
        # In real implementation, you would check actual payment gateways
        log $BLUE "ℹ Korean payment gateways status check (context: $context)"
        
        # Check if payment processing is responding
        local payment_health_url="http://localhost:3000/api/payment/health"
        if curl -f -s --max-time 5 "$payment_health_url" > /dev/null 2>&1; then
            log $GREEN "✓ Payment gateways: OK"
        else
            alert "HIGH" "Payment gateway health check failed during $context hours"
        fi
    fi
    
    # Monitor cart abandonment during peak hours
    if [ "$context" = "peak" ]; then
        log $BLUE "ℹ Peak hour monitoring active (Korean business hours)"
        
        # Check cart service health
        local cart_health_url="http://localhost:3000/api/cart/health"
        if ! curl -f -s --max-time 5 "$cart_health_url" > /dev/null 2>&1; then
            alert "HIGH" "Cart service health check failed during peak hours"
        fi
    fi
}

# Function to check disk space for logs
check_log_disk_space() {
    local log_dir="/var/log/commerce-core"
    local log_size=$(du -s "$log_dir" 2>/dev/null | cut -f1 || echo "0")
    local log_size_mb=$((log_size / 1024))
    
    if [ "$log_size_mb" -gt 1000 ]; then # More than 1GB
        alert "MEDIUM" "Log directory size is large: ${log_size_mb}MB"
        
        # Suggest log rotation
        log $YELLOW "⚠ Consider running log rotation"
    fi
}

# Function to send alerts to notification systems
send_alert_notification() {
    local alert_message="$1"
    
    # Send to Slack if configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Commerce Core Alert\\n$alert_message\\n$(date)\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # Send to email if configured
    if [ -n "${ALERT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
        echo "$alert_message" | mail -s "Commerce Core Alert" "$ALERT_EMAIL" || true
    fi
    
    # Send to Korean SMS service if configured
    if [ -n "${ALERT_SMS_NUMBER:-}" ] && [ -n "${COOLSMS_API_KEY:-}" ]; then
        # This would integrate with Korean SMS service like CoolSMS
        log $BLUE "SMS alert would be sent to: $ALERT_SMS_NUMBER"
    fi
}

# Function to generate monitoring report
generate_report() {
    local report_file="/tmp/commerce-monitoring-report-$(date +%Y%m%d-%H%M).txt"
    
    cat > "$report_file" << EOF
Korean E-commerce Monitoring Report
Generated: $(date)
Business Context: $(get_business_context)

System Resources:
- CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
- Memory Usage: $(free -h | grep Mem | awk '{print $3"/"$2}')
- Disk Usage: $(df -h / | tail -1 | awk '{print $5" ("$3"/"$2")"}')

Application Status:
- PM2 Processes: $(pm2 list --no-color 2>/dev/null | grep -c "online" || echo "0") online
- Health Check: $(curl -f -s http://localhost:3000/health >/dev/null && echo "OK" || echo "FAILED")

Recent Alerts (last 24 hours):
$(tail -100 "$ALERT_LOG_FILE" 2>/dev/null | grep "$(date -d '1 day ago' '+%Y-%m-%d')" || echo "No alerts")

EOF
    
    log $BLUE "Monitoring report generated: $report_file"
    
    # Email report if configured
    if [ -n "${REPORT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
        mail -s "Korean E-commerce Monitoring Report" "$REPORT_EMAIL" < "$report_file" || true
    fi
}

# Function to cleanup old logs
cleanup_logs() {
    # Clean monitoring logs older than 30 days
    find /var/log/commerce-core -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Clean old monitoring reports
    find /tmp -name "commerce-monitoring-report-*" -mtime +7 -delete 2>/dev/null || true
}

# Main monitoring function
main() {
    local mode="${1:-continuous}"
    
    case "$mode" in
        "once")
            log $BLUE "Running single monitoring check..."
            mkdir -p "$(dirname "$LOG_FILE")"
            mkdir -p "$(dirname "$ALERT_LOG_FILE")"
            
            check_system_resources
            check_application_health
            check_pm2_processes
            check_database
            check_redis
            check_error_rates
            check_korean_metrics
            check_log_disk_space
            
            log $GREEN "✓ Monitoring check completed"
            ;;
            
        "continuous")
            log $BLUE "Starting continuous monitoring (interval: ${MONITOR_INTERVAL}s)..."
            mkdir -p "$(dirname "$LOG_FILE")"
            mkdir -p "$(dirname "$ALERT_LOG_FILE")"
            
            while true; do
                check_system_resources
                check_application_health
                check_pm2_processes
                check_database
                check_redis
                check_error_rates
                check_korean_metrics
                check_log_disk_space
                
                # Cleanup logs once per day (at 3 AM)
                if [ "$(date +%H:%M)" = "03:00" ]; then
                    cleanup_logs
                fi
                
                # Generate daily report (at 9 AM KST)
                if [ "$(date +%H:%M)" = "09:00" ]; then
                    generate_report
                fi
                
                sleep "$MONITOR_INTERVAL"
            done
            ;;
            
        "report")
            generate_report
            ;;
            
        "alerts")
            log $BLUE "Recent alerts:"
            tail -50 "$ALERT_LOG_FILE" 2>/dev/null || echo "No alerts found"
            ;;
            
        *)
            echo "Usage: $0 [once|continuous|report|alerts]"
            echo "  once       - Run monitoring checks once"
            echo "  continuous - Run continuous monitoring (default)"
            echo "  report     - Generate monitoring report"
            echo "  alerts     - Show recent alerts"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"