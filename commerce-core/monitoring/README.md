# 🇰🇷 Korean E-commerce Monitoring Infrastructure

Complete monitoring and logging infrastructure optimized for Korean business patterns and e-commerce operations.

## 📊 Overview

This monitoring stack provides comprehensive observability for Korean e-commerce platforms with:
- **Korean business hours optimization** (9 AM - 6 PM KST, lunch hour 12-1 PM)
- **Peak shopping time monitoring** (8 PM - 10 PM KST)
- **Korean payment gateway monitoring** (KakaoPay, NaverPay, TossPay, NicePay)
- **Korean compliance features** (PIPA data protection)
- **Korean localization** (timezone, language, business patterns)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│    Filebeat     │────│      Loki       │
│     Logs        │    │   (Log Shipper) │    │  (Log Storage)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐             │
│  Application    │────│   Prometheus    │             │
│   Metrics       │    │   (Metrics)     │             │
└─────────────────┘    └─────────────────┘             │
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Alertmanager   │    │     Grafana     │
                       │   (Alerting)    │    │  (Dashboards)   │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Check status
docker-compose -f monitoring/docker-compose.monitoring.yml ps

# View logs
docker-compose -f monitoring/docker-compose.monitoring.yml logs -f
```

### 2. Access Monitoring Interfaces

| Service | URL | Purpose |
|---------|-----|---------|
| 🔥 Prometheus | http://localhost:9090 | Metrics collection and querying |
| 📊 Grafana | http://localhost:3001 | Korean e-commerce dashboards |
| 🚨 Alertmanager | http://localhost:9093 | Korean business hours alerting |
| 🔍 Elasticsearch | http://localhost:9200 | Log analytics and search |
| 📝 Loki | http://localhost:3100 | Log aggregation |

### 3. Default Credentials

- **Grafana**: admin / korean-admin-2023
- **Elasticsearch**: No authentication (configure for production)

## 📈 Korean Business Dashboards

### Main Korean E-commerce Dashboard

Access at: http://localhost:3001/d/korean-ecommerce

**Key Metrics:**
- 🇰🇷 Korean Business Overview (총 요청/초, 주문 완료/초, 한국 결제 건수)
- ⏰ Korean Business Hours Traffic Pattern
- 💳 Korean Payment Gateways Health (카카오페이, 네이버페이, 토스페이, 나이스페이)
- 🛒 Korean E-commerce Conversion Funnel
- 📱 Mobile vs Desktop Traffic (Korea)
- 💰 Korean Payment Methods Distribution
- 🌍 Korean Region Response Times (서울, 부산)
- 🔥 Korean Business Hours Heatmap
- 📊 Error Rate by Korean Payment Gateway
- 🚚 Korean Shipping Providers Status

## 🔔 Korean Business Hours Alerting

### Alert Categories

1. **Critical Alerts** (즉시 대응)
   - Payment gateway failures
   - Security incidents
   - System outages

2. **Business Hours Alerts** (업무시간: 9-18시)
   - High traffic warnings
   - Performance degradation
   - Resource utilization

3. **Lunch Hour Alerts** (점심시간: 12-13시)
   - Traffic spike management
   - Reduced priority notifications

4. **Peak Shopping Alerts** (피크 쇼핑: 20-22시)
   - High-priority performance monitoring
   - Capacity scaling alerts

5. **Weekend/Holiday Alerts** (주말/공휴일)
   - Lower priority
   - Different escalation paths

### Korean Alert Receivers

Configure in `monitoring/alertmanager/alertmanager.yml`:

```yaml
receivers:
  - name: 'korean-critical-business-hours'
    email_configs:
      - to: 'korean-ops@yourdomain.kr'
        subject: '🚨 [긴급] 한국 이커머스 시스템 장애'
    slack_configs:
      - channel: '#korean-emergency'
        title: '🚨 [긴급] 한국 이커머스 시스템 장애'
```

## 📝 Log Management

### Korean Log Categories

1. **Application Logs** (`/var/log/korean-ecommerce/app.log`)
   - Business logic
   - User interactions
   - API requests

2. **Payment Logs** (`/var/log/korean-ecommerce/payment-*.log`)
   - Korean payment gateway transactions
   - PIPA compliance logging

3. **Security Logs** (`/var/log/korean-ecommerce/security.log`)
   - Authentication events
   - Fraud detection
   - PIPA audit trails

4. **Mobile App Logs** (`/var/log/korean-ecommerce/mobile-*.log`)
   - Mobile app crashes
   - Performance metrics
   - User experience data

### Log Retention Policy

- **Application Logs**: 7 days in hot storage, 30 days total
- **Payment Logs**: 5 years (Korean compliance requirement)
- **Security Logs**: 3 years (PIPA requirement)
- **Performance Logs**: 30 days

## 🔍 Korean Text Search Configuration

Elasticsearch is configured with Korean text analysis:

```yaml
analysis:
  analyzer:
    korean_analyzer:
      type: custom
      tokenizer: korean_tokenizer
      filter:
        - lowercase
        - korean_filter
        - stop_korean
```

### Korean Payment Gateway Synonyms

```yaml
synonyms:
  - "카카오페이,카카오 페이,kakao pay"
  - "네이버페이,네이버 페이,naver pay"
  - "토스페이,토스 페이,toss pay"
```

## 🇰🇷 Korean Business Metrics

### Custom Metrics for Korean Market

```prometheus
# Korean business hours indicator
korean_business_hours{} 1

# Korean lunch hour traffic
korean_lunch_hour{} 1

# Korean peak shopping time
korean_peak_shopping{} 1

# Korean payment gateway health
payment_gateway_up{gateway="kakao_pay"} 1
payment_gateway_up{gateway="naver_pay"} 1
payment_gateway_up{gateway="toss_pay"} 1

# Korean mobile app metrics
mobile_app_sessions_total{market="korea",platform="android"} 1000
mobile_app_sessions_total{market="korea",platform="ios"} 800

# Korean shipping providers
shipping_deliveries_total{provider="cj_logistics",market="korea"} 150
shipping_deliveries_total{provider="korea_post",market="korea"} 100
```

## 🛠️ Configuration

### Environment Variables

Set in your application environment:

```bash
# Korean timezone
TZ=Asia/Seoul

# Korean locale
LANG=ko_KR.UTF-8
LC_ALL=ko_KR.UTF-8

# Korean business configuration
KOREAN_BUSINESS_HOURS_START=09
KOREAN_BUSINESS_HOURS_END=18
KOREAN_LUNCH_HOUR_START=12
KOREAN_LUNCH_HOUR_END=13
KOREAN_PEAK_SHOPPING_START=20
KOREAN_PEAK_SHOPPING_END=22

# Korean payment gateways
KAKAO_PAY_ENABLED=true
NAVER_PAY_ENABLED=true
TOSS_PAY_ENABLED=true
NICE_PAY_ENABLED=true
```

### Korean Business Rules

Located in `monitoring/prometheus/korean_business_rules.yml`:

- Business hours traffic alerts
- Payment gateway monitoring
- Mobile app performance
- Security incident detection
- PIPA compliance monitoring

## 📊 Health Checks

### Automated Health Monitoring

```bash
# Run health check manually
docker exec korean-monitoring-health /usr/local/bin/health-check.sh

# View health check logs
docker logs korean-monitoring-health
```

### Health Check Components

1. **Service Health**: All monitoring services status
2. **Korean Business Logic**: Business hours detection
3. **Resource Monitoring**: Disk, memory, CPU usage
4. **Data Ingestion**: Metrics and logs collection
5. **Alert Configuration**: Korean alert receivers

## 🔒 Security and Compliance

### PIPA Compliance Features

1. **Personal Data Protection**
   - Sensitive field filtering in logs
   - Audit trail logging
   - Data retention policies

2. **Access Logging**
   - All personal data access logged
   - Korean timezone timestamps
   - Admin action tracking

3. **Data Encryption**
   - Logs encrypted in transit (TLS)
   - Sensitive metrics scrubbing
   - Secure credential management

### Security Alerts

- Suspicious IP activity from Korea
- Failed authentication attempts
- Unusual payment patterns
- Data access violations

## 📱 Korean Mobile Monitoring

### Mobile App Metrics

- Crash rate monitoring
- Performance tracking
- User experience metrics
- Korean market specific features

### Mobile Payment Monitoring

- Mobile payment completion rates
- App store ratings
- Regional performance differences
- Device-specific issues

## 🚚 Korean Shipping Integration

### Supported Providers

1. **CJ대한통운** (CJ Logistics)
2. **우체국택배** (Korea Post)
3. **한진택배** (Hanjin Express)
4. **롯데글로벌로지스** (Lotte Global Logistics)

### Shipping Metrics

- Delivery success rates
- Regional delivery times
- Provider performance comparison
- Customer satisfaction tracking

## 🎯 Performance Optimization

### Korean Business Hours Optimization

- **Peak Hours** (20-22시): High-frequency monitoring
- **Business Hours** (9-18시): Standard monitoring
- **Lunch Hour** (12-13시): Traffic spike handling
- **Off Hours**: Resource conservation

### Resource Scaling

```yaml
# Auto-scaling based on Korean business patterns
business_hours_scaling:
  monday_friday_9_18: 3x_capacity
  lunch_hour_12_13: 5x_capacity
  peak_shopping_20_22: 7x_capacity
  weekend: 2x_capacity
  off_hours: 1x_capacity
```

## 📚 Troubleshooting

### Common Issues

1. **Korean Text Not Searchable**
   ```bash
   # Check Korean analyzer
   curl -X GET "elasticsearch:9200/_analyze" -H 'Content-Type: application/json' -d'
   {
     "analyzer": "korean_analyzer",
     "text": "카카오페이 결제 오류"
   }'
   ```

2. **Business Hours Logic Not Working**
   ```bash
   # Check timezone
   docker exec korean-prometheus date
   # Should show: Asia/Seoul timezone
   ```

3. **Alerts Not in Korean**
   ```bash
   # Check alert templates
   docker exec korean-alertmanager cat /etc/alertmanager/templates/korean.tmpl
   ```

4. **Payment Gateway Metrics Missing**
   ```bash
   # Check payment exporter
   curl http://localhost:3000/metrics/payment
   ```

### Log Locations

- **Application Logs**: `/var/log/korean-ecommerce/`
- **Monitoring Logs**: Docker container logs
- **Health Check Logs**: `korean-monitoring-health` container

### Debug Commands

```bash
# Check Korean metrics
curl -s http://localhost:9090/api/v1/query?query=korean_business_hours

# Check Korean logs
curl -s "http://localhost:3100/loki/api/v1/query_range?query={market=\"korean\"}"

# Check Korean alerts
curl -s http://localhost:9093/api/v1/alerts

# Korean business context
docker exec korean-metrics-simulator date +"%H %u"  # Hour and day of week
```

## 🔄 Maintenance

### Daily Tasks

- Monitor disk space usage
- Check alert receiver health
- Verify Korean business logic
- Review payment gateway metrics

### Weekly Tasks

- Rotate log files
- Update Korean holiday calendar
- Review alert thresholds
- Check security compliance

### Monthly Tasks

- Update Korean business patterns
- Review performance trends
- Optimize resource allocation
- Security audit

## 📞 Support

For Korean e-commerce monitoring support:

- **Technical Issues**: Check health monitoring dashboard
- **Korean Business Logic**: Review business rules configuration
- **Payment Gateway Issues**: Check payment provider documentation
- **PIPA Compliance**: Review security logs and audit trails

## 🔗 Related Documentation

- [Korean E-commerce API Documentation](../docs/api/)
- [Payment Gateway Integration](../docs/payments/)
- [Security and Compliance](../docs/security/)
- [Korean Business Requirements](../docs/business/)

---

*This monitoring infrastructure is optimized for Korean e-commerce operations and compliance requirements. All timestamps use Asia/Seoul timezone and business logic follows Korean commercial patterns.*