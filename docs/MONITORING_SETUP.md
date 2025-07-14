# Comprehensive Monitoring and Alerting Setup

This document provides a complete guide to the monitoring and alerting infrastructure for the Commerce Plugin.

## Overview

The monitoring stack includes:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **AlertManager** - Alert routing and notifications
- **Loki** - Log aggregation
- **Jaeger** - Distributed tracing
- **Multiple Exporters** - System, database, and Redis metrics

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
npm run monitoring:start

# View logs
npm run monitoring:logs

# Stop monitoring services
npm run monitoring:stop
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Jaeger**: http://localhost:16686

### 3. Application Metrics

- **All Metrics**: http://localhost:8000/metrics
- **Business Metrics**: http://localhost:8000/metrics/business
- **Health Check**: http://localhost:8000/metrics/health

## Architecture

### Metrics Collection Flow

```
Application → Prometheus → Grafana
     ↓
AlertManager → Notifications (Email/Slack/Webhooks)
```

### Components

#### Prometheus (Port 9090)
- Scrapes metrics from application and exporters
- Stores time-series data
- Evaluates alerting rules
- Retention: 30 days

#### Grafana (Port 3000)
- Visualizes metrics with dashboards
- Supports alerting and annotations
- Pre-configured dashboards:
  - Application Overview
  - Business Metrics
  - System Resources
  - Database Performance

#### AlertManager (Port 9093)
- Routes alerts to appropriate channels
- Groups and deduplicates alerts
- Supports email, Slack, and webhook notifications

#### Exporters
- **Node Exporter** (Port 9100): System metrics
- **Redis Exporter** (Port 9121): Redis performance
- **Postgres Exporter** (Port 9187): Database metrics
- **Blackbox Exporter** (Port 9115): External endpoint monitoring

## Metrics

### Application Metrics

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests by method, path, status
- `http_request_duration_seconds` - Request duration histogram
- `api_errors_total` - API errors by endpoint and type

#### Business Metrics
- `orders_completed_total` - Completed orders counter
- `orders_created_total` - Created orders counter
- `revenue_total` - Total revenue counter
- `cart_created_total` - Cart creation counter
- `cart_abandoned_total` - Cart abandonment counter
- `payment_attempts_total` - Payment attempts by gateway
- `payment_success_total` - Successful payments
- `payment_failures_total` - Failed payments with error codes

#### System Metrics
- `active_users_total` - Currently active users
- `database_connections_active` - Active database connections
- `redis_connections_active` - Active Redis connections
- `product_inventory_level` - Product stock levels

#### Cache Metrics
- `cache_hits_total` - Cache hits by type
- `cache_misses_total` - Cache misses by type

### Custom Business KPIs

#### Conversion Metrics
- Order conversion rate: `orders_completed / cart_created`
- Cart abandonment rate: `cart_abandoned / cart_created`
- Payment success rate: `payment_success / payment_attempts`

#### Revenue Metrics
- Average order value: `revenue_total / orders_completed`
- Revenue per user: `revenue_total / user_registrations`
- Daily/weekly/monthly revenue trends

## Alerting Rules

### Critical Alerts (5-minute repeat)

#### Application Down
```yaml
expr: up{job="commerce-app"} == 0
for: 1m
```

#### High Error Rate
```yaml
expr: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.01
for: 2m
```

#### Database Connection Failure
```yaml
expr: up{job="postgres-exporter"} == 0
for: 1m
```

#### Payment Failure Rate
```yaml
expr: (rate(payment_failures_total[5m]) / rate(payment_attempts_total[5m])) > 0.05
for: 3m
```

### Warning Alerts (30-minute repeat)

#### Slow API Response
```yaml
expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path=~"/api/products.*"}[5m])) > 0.1
for: 2m
```

#### High CPU Usage
```yaml
expr: 100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
for: 5m
```

#### Low Cache Hit Rate
```yaml
expr: redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total) < 0.8
for: 5m
```

#### Low Conversion Rate
```yaml
expr: (rate(orders_completed_total[1h]) / rate(cart_created_total[1h])) < 0.05
for: 10m
```

## Dashboard Configurations

### Application Overview Dashboard

Panels include:
- HTTP request rate and error rate
- Response time percentiles
- Active users and system resources
- Database connections and performance

### Business Metrics Dashboard

Panels include:
- Revenue and order metrics
- Conversion rates and trends
- Payment success rates
- Top products by revenue
- User activity metrics

### System Resources Dashboard

Panels include:
- CPU, memory, and disk usage
- Network traffic
- Container metrics
- Database and Redis performance

## Notification Channels

### Email Notifications
Configure SMTP settings in `monitoring/alertmanager/alertmanager.yml`:

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@commerce-app.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'
```

### Slack Integration
Add Slack webhook URL to AlertManager configuration:

```yaml
slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts-critical'
    title: 'Critical Alert: {{ .GroupLabels.alertname }}'
```

### Webhook Notifications
The application includes webhook endpoints for custom integrations:

- `/webhooks/alerts` - General alert notifications
- `/webhooks/alerts/critical` - Critical alert handling
- `/webhooks/payment` - Payment gateway notifications

## SLA Monitoring

### Performance SLAs
- API response time < 100ms (95th percentile)
- Error rate < 1% for critical paths
- Uptime > 99.9%

### Business SLAs
- Payment success rate > 95%
- Order conversion rate > 2%
- Cart abandonment rate < 70%

### Monitoring Targets

#### Response Time Targets
- Product API: < 100ms (95th percentile)
- Search API: < 200ms (95th percentile)
- Cart operations: < 50ms (95th percentile)
- Checkout flow: < 500ms (95th percentile)

#### Error Rate Targets
- Critical paths: < 0.5%
- Non-critical paths: < 1%
- Payment processing: < 1%

## Health Checks

### Application Health
The `/metrics/health` endpoint provides comprehensive health information:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 52428800,
    "total": 67108864,
    "percentage": 78.125
  },
  "database": {
    "status": "connected",
    "connectionCount": 5
  },
  "redis": {
    "status": "connected",
    "connectionCount": 2
  }
}
```

### External Service Health
Blackbox exporter monitors external endpoints:
- Application endpoints
- Payment gateway APIs
- Email service endpoints

## Log Aggregation

### Loki Configuration
Centralized log collection from:
- Application logs
- Error logs
- Access logs
- System logs

### Promtail Setup
Automatically ships logs with structured metadata:
- Application logs parsed as JSON
- Error logs with stack traces
- Access logs with request details

### Log Retention
- Application logs: 30 days
- Error logs: 90 days
- Access logs: 7 days

## Security Monitoring

### Security Events
Tracks security-related events:
- Failed authentication attempts
- Suspicious user activity
- Payment fraud attempts
- API abuse patterns

### Security Alerts
- Multiple failed login attempts
- Unusual traffic patterns
- High error rates from specific IPs
- Anomalous user registration patterns

## Deployment

### Production Deployment

1. **Update Configuration**
   ```bash
   # Update email settings in alertmanager.yml
   # Configure Slack webhooks
   # Set proper retention policies
   ```

2. **Deploy Monitoring Stack**
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

3. **Verify Setup**
   ```bash
   # Check all services are running
   docker-compose -f docker-compose.monitoring.yml ps
   
   # Verify metrics collection
   curl http://localhost:8000/metrics
   
   # Check Prometheus targets
   curl http://localhost:9090/api/v1/targets
   ```

### Backup and Recovery

#### Prometheus Data
```bash
# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Restore Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus-backup.tar.gz -C /
```

#### Grafana Dashboards
```bash
# Export dashboards
curl -X GET http://admin:admin123@localhost:3000/api/dashboards/home

# Import dashboards via API or web interface
```

## Troubleshooting

### Common Issues

#### Metrics Not Appearing
1. Check application is exposing metrics: `curl http://localhost:8000/metrics`
2. Verify Prometheus is scraping: Check targets page
3. Check network connectivity between containers

#### Alerts Not Firing
1. Verify alert rules syntax in Prometheus
2. Check AlertManager configuration
3. Test notification channels manually

#### High Memory Usage
1. Adjust Prometheus retention settings
2. Reduce scrape intervals for high-cardinality metrics
3. Optimize dashboard queries

### Performance Optimization

#### Prometheus
- Adjust retention period based on storage
- Use recording rules for complex queries
- Configure appropriate scrape intervals

#### Grafana
- Use query caching
- Optimize dashboard queries
- Set appropriate refresh intervals

## Best Practices

### Metric Naming
- Use consistent prefixes (e.g., `commerce_`, `payment_`)
- Include units in metric names
- Use labels for dimensions, not metric names

### Alert Design
- Set appropriate thresholds based on historical data
- Use different severity levels
- Include runbook links in alert annotations

### Dashboard Design
- Group related metrics
- Use consistent time ranges
- Include context and documentation

### Monitoring Hygiene
- Regular review of alert effectiveness
- Clean up unused metrics and dashboards
- Monitor monitoring system performance

## Sample Alert Scenarios

### Scenario 1: High Error Rate
```yaml
Alert: HighErrorRate
Condition: Error rate > 1% for 2 minutes
Actions:
  - Page on-call engineer
  - Create incident ticket
  - Enable circuit breaker if needed
```

### Scenario 2: Payment Failures
```yaml
Alert: HighPaymentFailureRate
Condition: Payment failure rate > 5% for 3 minutes
Actions:
  - Notify payment team
  - Check payment gateway status
  - Review recent changes
```

### Scenario 3: Low Conversion Rate
```yaml
Alert: LowOrderConversionRate
Condition: Conversion rate < 5% for 10 minutes
Actions:
  - Notify business team
  - Check user experience issues
  - Review recent product changes
```

## API Endpoints

### Metrics Endpoints
- `GET /metrics` - All Prometheus metrics
- `GET /metrics/business` - Business-specific metrics
- `GET /metrics/health` - Application health status
- `POST /metrics/reset` - Reset metrics (development only)

### Webhook Endpoints
- `POST /webhooks/alerts` - AlertManager webhook notifications
- `POST /webhooks/alerts/critical` - Critical alert handling
- `POST /webhooks/payment` - Payment gateway notifications

## Configuration Files

### Key Configuration Files
- `docker-compose.monitoring.yml` - Monitoring stack deployment
- `monitoring/prometheus/prometheus.yml` - Prometheus configuration
- `monitoring/prometheus/rules/` - Alert rule definitions
- `monitoring/alertmanager/alertmanager.yml` - AlertManager configuration
- `monitoring/grafana/` - Grafana provisioning and dashboards

### Environment Variables
```bash
# Application
PROMETHEUS_ENABLED=true
METRICS_PORT=8000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/commerce

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Monitoring
GRAFANA_ADMIN_PASSWORD=admin123
ALERTMANAGER_WEB_EXTERNAL_URL=http://localhost:9093
```

This comprehensive monitoring setup provides production-ready observability for the Commerce Plugin with real-time metrics, alerting, and business intelligence capabilities.