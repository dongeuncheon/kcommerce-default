#!/bin/bash

# Monitoring Stack Management Script
# Usage: ./scripts/monitoring.sh [start|stop|restart|logs|status|backup|restore]

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.monitoring.yml"
BACKUP_DIR="$PROJECT_DIR/backups/monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_blue() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    log_info "Creating monitoring directories..."
    
    mkdir -p "$PROJECT_DIR/monitoring/prometheus/rules"
    mkdir -p "$PROJECT_DIR/monitoring/grafana/datasources"
    mkdir -p "$PROJECT_DIR/monitoring/grafana/dashboards"
    mkdir -p "$PROJECT_DIR/monitoring/grafana/dashboard-configs"
    mkdir -p "$PROJECT_DIR/monitoring/alertmanager"
    mkdir -p "$PROJECT_DIR/monitoring/blackbox"
    mkdir -p "$PROJECT_DIR/monitoring/loki"
    mkdir -p "$PROJECT_DIR/monitoring/promtail"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    
    log_info "Directories created successfully"
}

# Start monitoring stack
start_monitoring() {
    log_info "Starting monitoring stack..."
    
    check_dependencies
    create_directories
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Waiting for services to start..."
    sleep 10
    
    log_info "Checking service status..."
    docker-compose -f "$COMPOSE_FILE" ps
    
    log_info "Monitoring stack started successfully!"
    log_blue "Access URLs:"
    log_blue "  Grafana:       http://localhost:3000 (admin/admin123)"
    log_blue "  Prometheus:    http://localhost:9090"
    log_blue "  AlertManager:  http://localhost:9093"
    log_blue "  Jaeger:        http://localhost:16686"
    log_blue "  Application:   http://localhost:8000/metrics"
}

# Stop monitoring stack
stop_monitoring() {
    log_info "Stopping monitoring stack..."
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    
    log_info "Monitoring stack stopped successfully!"
}

# Restart monitoring stack
restart_monitoring() {
    log_info "Restarting monitoring stack..."
    stop_monitoring
    sleep 5
    start_monitoring
}

# Show logs
show_logs() {
    log_info "Showing monitoring stack logs..."
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f "$@"
}

# Show status
show_status() {
    log_info "Checking monitoring stack status..."
    
    cd "$PROJECT_DIR"
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_info "Monitoring stack is running"
        docker-compose -f "$COMPOSE_FILE" ps
        
        log_blue "\nService Health Checks:"
        
        # Check Prometheus
        if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
            log_info "✓ Prometheus is healthy"
        else
            log_warn "✗ Prometheus is not responding"
        fi
        
        # Check Grafana
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_info "✓ Grafana is healthy"
        else
            log_warn "✗ Grafana is not responding"
        fi
        
        # Check AlertManager
        if curl -s http://localhost:9093/-/healthy > /dev/null 2>&1; then
            log_info "✓ AlertManager is healthy"
        else
            log_warn "✗ AlertManager is not responding"
        fi
        
        # Check application metrics
        if curl -s http://localhost:8000/metrics > /dev/null 2>&1; then
            log_info "✓ Application metrics are available"
        else
            log_warn "✗ Application metrics are not available"
        fi
        
    else
        log_warn "Monitoring stack is not running"
    fi
}

# Backup monitoring data
backup_monitoring() {
    log_info "Creating backup of monitoring data..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/monitoring_backup_$TIMESTAMP.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    cd "$PROJECT_DIR"
    
    # Create backup
    docker run --rm \
        -v $(docker volume ls -q | grep prometheus):/prometheus:ro \
        -v $(docker volume ls -q | grep grafana):/grafana:ro \
        -v $(docker volume ls -q | grep alertmanager):/alertmanager:ro \
        -v $(docker volume ls -q | grep loki):/loki:ro \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf "/backup/monitoring_backup_$TIMESTAMP.tar.gz" \
        /prometheus /grafana /alertmanager /loki
    
    log_info "Backup created: $BACKUP_FILE"
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/monitoring_backup_*.tar.gz | tail -n +6 | xargs -r rm
    
    log_info "Backup completed successfully"
}

# Restore monitoring data
restore_monitoring() {
    if [ -z "$2" ]; then
        log_error "Please specify backup file to restore"
        log_info "Usage: $0 restore <backup_file>"
        log_info "Available backups:"
        ls -la "$BACKUP_DIR"/monitoring_backup_*.tar.gz 2>/dev/null || log_warn "No backups found"
        exit 1
    fi
    
    BACKUP_FILE="$2"
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Restoring monitoring data from: $BACKUP_FILE"
    
    # Stop services
    stop_monitoring
    
    # Restore data
    docker run --rm \
        -v $(docker volume ls -q | grep prometheus):/prometheus \
        -v $(docker volume ls -q | grep grafana):/grafana \
        -v $(docker volume ls -q | grep alertmanager):/alertmanager \
        -v $(docker volume ls -q | grep loki):/loki \
        -v "$(dirname "$BACKUP_FILE")":/backup \
        alpine tar xzf "/backup/$(basename "$BACKUP_FILE")" -C /
    
    # Start services
    start_monitoring
    
    log_info "Restore completed successfully"
}

# Clean up old data
cleanup_monitoring() {
    log_info "Cleaning up monitoring data..."
    
    cd "$PROJECT_DIR"
    
    # Stop services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Remove volumes
    docker volume rm $(docker volume ls -q | grep -E "(prometheus|grafana|alertmanager|loki)") 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Update monitoring configuration
update_config() {
    log_info "Updating monitoring configuration..."
    
    cd "$PROJECT_DIR"
    
    # Restart services to pick up new configuration
    docker-compose -f "$COMPOSE_FILE" restart prometheus alertmanager grafana
    
    log_info "Configuration updated"
}

# Test alerts
test_alerts() {
    log_info "Testing alert configuration..."
    
    # Send test alert to AlertManager
    curl -XPOST http://localhost:9093/api/v1/alerts \
        -H "Content-Type: application/json" \
        -d '[{
            "labels": {
                "alertname": "TestAlert",
                "service": "monitoring-test",
                "severity": "warning"
            },
            "annotations": {
                "summary": "This is a test alert",
                "description": "Testing the monitoring stack alert functionality"
            },
            "generatorURL": "http://localhost:9090/graph?g0.expr=up&g0.tab=1"
        }]'
    
    log_info "Test alert sent to AlertManager"
    log_blue "Check AlertManager UI: http://localhost:9093"
}

# Show help
show_help() {
    echo "Monitoring Stack Management Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start        Start the monitoring stack"
    echo "  stop         Stop the monitoring stack"
    echo "  restart      Restart the monitoring stack"
    echo "  logs [service]  Show logs (optionally for specific service)"
    echo "  status       Show stack status and health checks"
    echo "  backup       Create backup of monitoring data"
    echo "  restore <file>  Restore monitoring data from backup"
    echo "  cleanup      Remove all monitoring data and volumes"
    echo "  update       Update configuration and restart services"
    echo "  test-alerts  Send test alert to AlertManager"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs prometheus"
    echo "  $0 backup"
    echo "  $0 restore backups/monitoring/monitoring_backup_20240101_120000.tar.gz"
}

# Main script logic
case "$1" in
    start)
        start_monitoring
        ;;
    stop)
        stop_monitoring
        ;;
    restart)
        restart_monitoring
        ;;
    logs)
        shift
        show_logs "$@"
        ;;
    status)
        show_status
        ;;
    backup)
        backup_monitoring
        ;;
    restore)
        restore_monitoring "$@"
        ;;
    cleanup)
        cleanup_monitoring
        ;;
    update)
        update_config
        ;;
    test-alerts)
        test_alerts
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac