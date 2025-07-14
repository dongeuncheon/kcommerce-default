#!/bin/sh

# ==================================================
# Korean E-commerce Monitoring Stack Health Check
# Comprehensive health monitoring for all services
# ==================================================

# Install required tools
apk add --no-cache curl jq

# Korean timezone
export TZ="Asia/Seoul"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service endpoints
PROMETHEUS_URL="http://prometheus:9090"
GRAFANA_URL="http://grafana:3000"
ALERTMANAGER_URL="http://alertmanager:9093"
ELASTICSEARCH_URL="http://elasticsearch:9200"
LOKI_URL="http://loki:3100"

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S KST')
    
    case $level in
        "INFO") echo -e "${BLUE}[INFO]${NC} [$timestamp] $message" ;;
        "WARN") echo -e "${YELLOW}[WARN]${NC} [$timestamp] $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} [$timestamp] $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} [$timestamp] $message" ;;
    esac
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    local expected_status=${3:-200}
    local timeout=${4:-10}
    
    log "INFO" "🔍 Checking $service_name health..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time $timeout "$health_url" 2>/dev/null)
    local http_code=$?
    
    if [ $http_code -eq 0 ] && [ "$response" = "$expected_status" ]; then
        log "SUCCESS" "✅ $service_name is healthy"
        return 0
    else
        log "ERROR" "❌ $service_name is unhealthy (HTTP: $response, Curl: $http_code)"
        return 1
    fi
}

# Function to check Prometheus health and targets
check_prometheus() {
    log "INFO" "🔍 Checking Prometheus..."
    
    # Check basic health
    if ! check_service_health "Prometheus" "$PROMETHEUS_URL/-/healthy"; then
        return 1
    fi
    
    # Check targets
    local targets_url="$PROMETHEUS_URL/api/v1/targets"
    local targets_response=$(curl -s "$targets_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local up_targets=$(echo "$targets_response" | jq -r '.data.activeTargets[] | select(.health=="up") | .scrapeUrl' 2>/dev/null | wc -l)
        local total_targets=$(echo "$targets_response" | jq -r '.data.activeTargets[] | .scrapeUrl' 2>/dev/null | wc -l)
        
        log "INFO" "📊 Prometheus targets: $up_targets/$total_targets healthy"
        
        if [ "$up_targets" -lt "$total_targets" ]; then
            log "WARN" "⚠️ Some Prometheus targets are down"
            # List down targets
            echo "$targets_response" | jq -r '.data.activeTargets[] | select(.health!="up") | "  - " + .scrapeUrl + " (" + .health + ")"' 2>/dev/null
        fi
    fi
    
    # Check Korean business rules
    local rules_url="$PROMETHEUS_URL/api/v1/rules"
    local rules_response=$(curl -s "$rules_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local korean_rules=$(echo "$rules_response" | jq -r '.data.groups[] | select(.name | contains("korean")) | .name' 2>/dev/null | wc -l)
        log "INFO" "🇰🇷 Korean business rules loaded: $korean_rules"
    fi
}

# Function to check Grafana health and dashboards
check_grafana() {
    log "INFO" "🔍 Checking Grafana..."
    
    # Check basic health
    if ! check_service_health "Grafana" "$GRAFANA_URL/api/health"; then
        return 1
    fi
    
    # Check Korean dashboard
    local dashboards_url="$GRAFANA_URL/api/search?query=korean"
    local dashboard_response=$(curl -s -u admin:korean-admin-2023 "$dashboards_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local korean_dashboards=$(echo "$dashboard_response" | jq '. | length' 2>/dev/null)
        log "INFO" "🇰🇷 Korean dashboards available: $korean_dashboards"
    fi
}

# Function to check Alertmanager health and configuration
check_alertmanager() {
    log "INFO" "🔍 Checking Alertmanager..."
    
    # Check basic health
    if ! check_service_health "Alertmanager" "$ALERTMANAGER_URL/-/healthy"; then
        return 1
    fi
    
    # Check configuration
    local config_url="$ALERTMANAGER_URL/api/v1/status"
    local config_response=$(curl -s "$config_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local config_status=$(echo "$config_response" | jq -r '.status' 2>/dev/null)
        log "INFO" "📋 Alertmanager config status: $config_status"
    fi
    
    # Check Korean receivers
    local receivers_url="$ALERTMANAGER_URL/api/v1/receivers"
    local receivers_response=$(curl -s "$receivers_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local korean_receivers=$(echo "$receivers_response" | jq -r '.[] | select(.name | contains("korean")) | .name' 2>/dev/null | wc -l)
        log "INFO" "🇰🇷 Korean alert receivers configured: $korean_receivers"
    fi
}

# Function to check Elasticsearch health and Korean indices
check_elasticsearch() {
    log "INFO" "🔍 Checking Elasticsearch..."
    
    # Check cluster health
    local health_url="$ELASTICSEARCH_URL/_cluster/health"
    local health_response=$(curl -s "$health_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local cluster_status=$(echo "$health_response" | jq -r '.status' 2>/dev/null)
        local active_shards=$(echo "$health_response" | jq -r '.active_shards' 2>/dev/null)
        
        case $cluster_status in
            "green") log "SUCCESS" "✅ Elasticsearch cluster is green ($active_shards shards)" ;;
            "yellow") log "WARN" "⚠️ Elasticsearch cluster is yellow ($active_shards shards)" ;;
            "red") log "ERROR" "❌ Elasticsearch cluster is red ($active_shards shards)" ;;
        esac
    else
        log "ERROR" "❌ Elasticsearch is unreachable"
        return 1
    fi
    
    # Check Korean indices
    local indices_url="$ELASTICSEARCH_URL/_cat/indices/korean-*?format=json"
    local indices_response=$(curl -s "$indices_url" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$indices_response" != "[]" ]; then
        local korean_indices=$(echo "$indices_response" | jq '. | length' 2>/dev/null)
        log "INFO" "🇰🇷 Korean indices: $korean_indices"
        
        # Show index sizes
        echo "$indices_response" | jq -r '.[] | "  - " + .index + " (" + .status + ", " + (.["docs.count"] // "0") + " docs, " + (.["store.size"] // "0b") + ")"' 2>/dev/null
    else
        log "WARN" "⚠️ No Korean indices found in Elasticsearch"
    fi
}

# Function to check Loki health and Korean log streams
check_loki() {
    log "INFO" "🔍 Checking Loki..."
    
    # Check readiness
    if ! check_service_health "Loki" "$LOKI_URL/ready"; then
        return 1
    fi
    
    # Check Korean label values
    local labels_url="$LOKI_URL/loki/api/v1/label/market/values"
    local labels_response=$(curl -s "$labels_url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local has_korean=$(echo "$labels_response" | jq -r '.data[] | select(. == "korean")' 2>/dev/null)
        if [ -n "$has_korean" ]; then
            log "SUCCESS" "🇰🇷 Korean logs are being ingested into Loki"
        else
            log "WARN" "⚠️ No Korean market logs found in Loki"
        fi
    fi
    
    # Check recent log entries
    local query_url="$LOKI_URL/loki/api/v1/query_range"
    local end_time=$(date +%s)000000000  # nanoseconds
    local start_time=$((end_time - 3600000000000))  # 1 hour ago
    
    local recent_logs=$(curl -s "$query_url?query={market=\"korean\"}&start=$start_time&end=$end_time&limit=1" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local log_count=$(echo "$recent_logs" | jq -r '.data.result | length' 2>/dev/null)
        log "INFO" "📝 Korean log streams in last hour: $log_count"
    fi
}

# Function to check disk space and performance
check_system_resources() {
    log "INFO" "🔍 Checking system resources..."
    
    # Check disk space for monitoring volumes
    local volumes="/var/lib/docker/volumes"
    if [ -d "$volumes" ]; then
        local disk_usage=$(df -h "$volumes" 2>/dev/null | tail -1)
        if [ -n "$disk_usage" ]; then
            local usage_percent=$(echo "$disk_usage" | awk '{print $5}' | sed 's/%//')
            local available=$(echo "$disk_usage" | awk '{print $4}')
            
            if [ "$usage_percent" -gt 80 ]; then
                log "WARN" "⚠️ Disk usage high: ${usage_percent}% (${available} available)"
            else
                log "INFO" "💾 Disk usage: ${usage_percent}% (${available} available)"
            fi
        fi
    fi
    
    # Check memory if available
    if [ -f /proc/meminfo ]; then
        local mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        local mem_used_percent=$(( (mem_total - mem_available) * 100 / mem_total ))
        
        if [ "$mem_used_percent" -gt 85 ]; then
            log "WARN" "⚠️ Memory usage high: ${mem_used_percent}%"
        else
            log "INFO" "🧠 Memory usage: ${mem_used_percent}%"
        fi
    fi
}

# Function to test Korean business hours logic
check_korean_business_logic() {
    log "INFO" "🔍 Checking Korean business hours logic..."
    
    local hour=$(date +%H)
    local dow=$(date +%u)  # 1=Monday, 7=Sunday
    
    # Determine current Korean business context
    local business_context="Regular Hours"
    
    # Business hours (9-18, Mon-Fri)
    if [ $dow -ge 1 ] && [ $dow -le 5 ] && [ $hour -ge 9 ] && [ $hour -lt 18 ]; then
        business_context="Business Hours"
    fi
    
    # Lunch hour (12-13)
    if [ $hour -eq 12 ]; then
        business_context="Lunch Hour"
    fi
    
    # Peak shopping (20-22)
    if [ $hour -ge 20 ] && [ $hour -lt 22 ]; then
        business_context="Peak Shopping"
    fi
    
    # Weekend
    if [ $dow -eq 6 ] || [ $dow -eq 7 ]; then
        business_context="Weekend"
    fi
    
    log "INFO" "🇰🇷 Current Korean business context: $business_context"
    
    # Check if monitoring is configured for current context
    case $business_context in
        "Business Hours")
            log "INFO" "⏰ Monitoring should be in high-alert mode"
            ;;
        "Lunch Hour")
            log "INFO" "🍚 Monitoring should account for lunch hour traffic spike"
            ;;
        "Peak Shopping")
            log "INFO" "🛒 Monitoring should be in peak performance mode"
            ;;
        "Weekend")
            log "INFO" "📅 Monitoring should be in weekend mode"
            ;;
        *)
            log "INFO" "🌙 Monitoring should be in regular mode"
            ;;
    esac
}

# Function to generate health report
generate_health_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S KST')
    local report_file="/tmp/korean_monitoring_health_$(date +%s).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "korean_ecommerce_monitoring_health": {
    "overall_status": "checking",
    "services": {
      "prometheus": "unknown",
      "grafana": "unknown",
      "alertmanager": "unknown",
      "elasticsearch": "unknown",
      "loki": "unknown"
    },
    "korean_business_context": {
      "current_hour": $(date +%H),
      "day_of_week": $(date +%u),
      "timezone": "Asia/Seoul"
    }
  }
}
EOF
    
    log "INFO" "📊 Health report saved to $report_file"
}

# Main health check function
main() {
    log "INFO" "🇰🇷 Starting Korean E-commerce Monitoring Health Check"
    log "INFO" "⏰ Current time: $(date '+%Y-%m-%d %H:%M:%S KST')"
    
    # Generate initial report
    generate_health_report
    
    # Track overall health status
    local overall_status=0
    
    # Check all services
    echo ""
    log "INFO" "📋 Checking monitoring services..."
    
    if ! check_prometheus; then overall_status=1; fi
    echo ""
    
    if ! check_grafana; then overall_status=1; fi
    echo ""
    
    if ! check_alertmanager; then overall_status=1; fi
    echo ""
    
    if ! check_elasticsearch; then overall_status=1; fi
    echo ""
    
    if ! check_loki; then overall_status=1; fi
    echo ""
    
    # Check system resources
    check_system_resources
    echo ""
    
    # Check Korean business logic
    check_korean_business_logic
    echo ""
    
    # Final status
    if [ $overall_status -eq 0 ]; then
        log "SUCCESS" "🎉 All Korean e-commerce monitoring services are healthy!"
    else
        log "ERROR" "⚠️ Some monitoring services need attention"
    fi
    
    log "INFO" "📈 Health check completed at $(date '+%Y-%m-%d %H:%M:%S KST')"
    echo ""
    echo "===================="
    echo ""
}

# Execute health check
main "$@"