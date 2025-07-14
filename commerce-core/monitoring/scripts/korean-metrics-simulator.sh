#!/bin/sh

# ==================================================
# Korean E-commerce Metrics Simulator
# Generates realistic Korean business pattern metrics
# ==================================================

# Install required tools
apk add --no-cache curl jq

# Korean business hours configuration
SEOUL_TZ="Asia/Seoul"
export TZ=$SEOUL_TZ

# Korean business metrics endpoints
METRICS_ENDPOINT="http://korean-ecommerce-app:3000/metrics"
PUSHGATEWAY_ENDPOINT="http://prometheus:9091/metrics/job/korean-business-simulator"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S KST')] $1"
}

# Function to get current Korean time info
get_korean_time_info() {
    local hour=$(date +%H)
    local dow=$(date +%u)  # 1=Monday, 7=Sunday
    local minute=$(date +%M)
    
    # Korean business hours (9-18, Mon-Fri)
    is_business_hours=0
    if [ $dow -ge 1 ] && [ $dow -le 5 ] && [ $hour -ge 9 ] && [ $hour -lt 18 ]; then
        is_business_hours=1
    fi
    
    # Korean lunch hour (12-13)
    is_lunch_hour=0
    if [ $hour -eq 12 ]; then
        is_lunch_hour=1
    fi
    
    # Korean peak shopping (20-22)
    is_peak_shopping=0
    if [ $hour -ge 20 ] && [ $hour -lt 22 ]; then
        is_peak_shopping=1
    fi
    
    # Weekend
    is_weekend=0
    if [ $dow -eq 6 ] || [ $dow -eq 7 ]; then
        is_weekend=1
    fi
    
    echo "$hour $dow $minute $is_business_hours $is_lunch_hour $is_peak_shopping $is_weekend"
}

# Function to generate Korean payment gateway metrics
generate_payment_metrics() {
    local time_info=$(get_korean_time_info)
    local hour=$(echo $time_info | cut -d' ' -f1)
    local is_business_hours=$(echo $time_info | cut -d' ' -f4)
    local is_peak_shopping=$(echo $time_info | cut -d' ' -f6)
    
    # Base traffic multiplier based on Korean business patterns
    local base_traffic=100
    if [ $is_business_hours -eq 1 ]; then
        base_traffic=300
    fi
    if [ $is_peak_shopping -eq 1 ]; then
        base_traffic=500
    fi
    
    # Generate metrics for Korean payment gateways
    local gateways="kakao_pay naver_pay toss_pay nice_pay"
    
    for gateway in $gateways; do
        # Payment requests (varies by gateway popularity)
        local requests=$base_traffic
        case $gateway in
            "kakao_pay") requests=$((base_traffic * 4 / 10)) ;;  # 40% market share
            "naver_pay") requests=$((base_traffic * 3 / 10)) ;;  # 30% market share
            "toss_pay") requests=$((base_traffic * 2 / 10)) ;;   # 20% market share
            "nice_pay") requests=$((base_traffic * 1 / 10)) ;;   # 10% market share
        esac
        
        # Add some randomness
        requests=$((requests + $RANDOM % 50 - 25))
        
        # Generate error rate (higher during peak times)
        local error_rate=2
        if [ $is_peak_shopping -eq 1 ]; then
            error_rate=5
        fi
        
        local errors=$((requests * error_rate / 100))
        local successes=$((requests - errors))
        
        # Response time (higher during peak)
        local response_time=500
        if [ $is_peak_shopping -eq 1 ]; then
            response_time=800
        fi
        response_time=$((response_time + $RANDOM % 200))
        
        cat << EOF
# HELP payment_gateway_requests_total Total payment gateway requests
# TYPE payment_gateway_requests_total counter
payment_gateway_requests_total{gateway="$gateway"} $requests

# HELP payment_gateway_errors_total Total payment gateway errors
# TYPE payment_gateway_errors_total counter
payment_gateway_errors_total{gateway="$gateway"} $errors

# HELP payment_gateway_successes_total Total payment gateway successes
# TYPE payment_gateway_successes_total counter
payment_gateway_successes_total{gateway="$gateway"} $successes

# HELP payment_gateway_response_time_ms Payment gateway response time in milliseconds
# TYPE payment_gateway_response_time_ms gauge
payment_gateway_response_time_ms{gateway="$gateway"} $response_time

EOF
    done
}

# Function to generate Korean e-commerce business metrics
generate_business_metrics() {
    local time_info=$(get_korean_time_info)
    local hour=$(echo $time_info | cut -d' ' -f1)
    local is_business_hours=$(echo $time_info | cut -d' ' -f4)
    local is_lunch_hour=$(echo $time_info | cut -d' ' -f5)
    local is_peak_shopping=$(echo $time_info | cut -d' ' -f6)
    local is_weekend=$(echo $time_info | cut -d' ' -f7)
    
    # Base user activity
    local active_users=1000
    if [ $is_business_hours -eq 1 ]; then
        active_users=3000
    fi
    if [ $is_lunch_hour -eq 1 ]; then
        active_users=5000  # Lunch hour shopping spike
    fi
    if [ $is_peak_shopping -eq 1 ]; then
        active_users=7000  # Evening shopping peak
    fi
    if [ $is_weekend -eq 1 ]; then
        active_users=4000  # Weekend activity
    fi
    
    # Mobile vs Desktop ratio (Korea has high mobile usage ~80%)
    local mobile_users=$((active_users * 80 / 100))
    local desktop_users=$((active_users * 20 / 100))
    
    # Page views
    local page_views=$((active_users * 3))
    page_views=$((page_views + $RANDOM % 500))
    
    # Cart operations
    local carts_created=$((active_users / 5))
    local carts_abandoned=$((carts_created * 70 / 100))  # 70% abandonment rate
    
    # Orders
    local orders_initiated=$((carts_created - carts_abandoned))
    local orders_completed=$((orders_initiated * 85 / 100))  # 85% completion rate
    
    # Search operations (popular during business hours)
    local searches=$((active_users / 2))
    if [ $is_business_hours -eq 1 ]; then
        searches=$((searches * 2))
    fi
    
    cat << EOF
# HELP korean_active_users Current active users
# TYPE korean_active_users gauge
korean_active_users{market="korea"} $active_users

# HELP korean_mobile_users Active mobile users
# TYPE korean_mobile_users gauge
korean_mobile_users{market="korea",device="mobile"} $mobile_users

# HELP korean_desktop_users Active desktop users
# TYPE korean_desktop_users gauge
korean_desktop_users{market="korea",device="desktop"} $desktop_users

# HELP page_views_total Total page views
# TYPE page_views_total counter
page_views_total{market="korea"} $page_views

# HELP cart_created_total Total carts created
# TYPE cart_created_total counter
cart_created_total{market="korea"} $carts_created

# HELP cart_abandoned_total Total carts abandoned
# TYPE cart_abandoned_total counter
cart_abandoned_total{market="korea"} $carts_abandoned

# HELP orders_initiated_total Total orders initiated
# TYPE orders_initiated_total counter
orders_initiated_total{market="korea"} $orders_initiated

# HELP orders_completed_total Total orders completed
# TYPE orders_completed_total counter
orders_completed_total{market="korea"} $orders_completed

# HELP product_searches_total Total product searches
# TYPE product_searches_total counter
product_searches_total{market="korea",language="ko"} $searches

# HELP korean_business_hours Current business hours indicator
# TYPE korean_business_hours gauge
korean_business_hours $is_business_hours

# HELP korean_lunch_hour Current lunch hour indicator
# TYPE korean_lunch_hour gauge
korean_lunch_hour $is_lunch_hour

# HELP korean_peak_shopping Current peak shopping indicator
# TYPE korean_peak_shopping gauge
korean_peak_shopping $is_peak_shopping

# HELP korean_weekend Current weekend indicator
# TYPE korean_weekend gauge
korean_weekend $is_weekend

EOF
}

# Function to generate Korean shipping metrics
generate_shipping_metrics() {
    local time_info=$(get_korean_time_info)
    local is_business_hours=$(echo $time_info | cut -d' ' -f4)
    
    # Korean shipping providers
    local providers="korea_post cj_logistics hanjin_express lotte_global_logistics"
    
    for provider in $providers; do
        # Different delivery volumes by provider
        local deliveries=50
        case $provider in
            "cj_logistics") deliveries=120 ;;      # Largest logistics company
            "korea_post") deliveries=80 ;;         # Government postal service
            "hanjin_express") deliveries=60 ;;     # Major express service
            "lotte_global_logistics") deliveries=40 ;; # Retail logistics
        esac
        
        # Business hours affect delivery operations
        if [ $is_business_hours -eq 1 ]; then
            deliveries=$((deliveries * 3 / 2))
        fi
        
        # Random variation
        deliveries=$((deliveries + $RANDOM % 20 - 10))
        
        # Delivery success rate (varies by provider)
        local success_rate=95
        case $provider in
            "korea_post") success_rate=98 ;;
            "cj_logistics") success_rate=97 ;;
            "hanjin_express") success_rate=95 ;;
            "lotte_global_logistics") success_rate=93 ;;
        esac
        
        local successful_deliveries=$((deliveries * success_rate / 100))
        local failed_deliveries=$((deliveries - successful_deliveries))
        
        cat << EOF
# HELP shipping_deliveries_total Total shipping deliveries
# TYPE shipping_deliveries_total counter
shipping_deliveries_total{provider="$provider",market="korea"} $deliveries

# HELP shipping_successful_deliveries_total Successful deliveries
# TYPE shipping_successful_deliveries_total counter
shipping_successful_deliveries_total{provider="$provider",market="korea"} $successful_deliveries

# HELP shipping_failed_deliveries_total Failed deliveries
# TYPE shipping_failed_deliveries_total counter
shipping_failed_deliveries_total{provider="$provider",market="korea"} $failed_deliveries

EOF
    done
}

# Function to generate Korean customer satisfaction metrics
generate_satisfaction_metrics() {
    local time_info=$(get_korean_time_info)
    local is_peak_shopping=$(echo $time_info | cut -d' ' -f6)
    
    # Customer satisfaction tends to be lower during peak times
    local satisfaction_score=85
    if [ $is_peak_shopping -eq 1 ]; then
        satisfaction_score=78  # Lower during peak due to slower response times
    fi
    
    # NPS (Net Promoter Score) for Korean market
    local nps_score=45
    if [ $is_peak_shopping -eq 1 ]; then
        nps_score=38
    fi
    
    # App store ratings (out of 5)
    local app_rating=42  # 4.2 out of 5
    app_rating=$((app_rating + $RANDOM % 6 - 3))  # ±0.3 variation
    
    cat << EOF
# HELP customer_satisfaction_score Customer satisfaction score (0-100)
# TYPE customer_satisfaction_score gauge
customer_satisfaction_score{market="korea"} $satisfaction_score

# HELP nps_score Net Promoter Score
# TYPE nps_score gauge
nps_score{market="korea"} $nps_score

# HELP app_store_rating Mobile app store rating (0-50, divide by 10 for actual rating)
# TYPE app_store_rating gauge
app_store_rating{market="korea",platform="android"} $app_rating
app_store_rating{market="korea",platform="ios"} $((app_rating + 2))

EOF
}

# Main simulation loop
main() {
    log "🇰🇷 Starting Korean E-commerce Metrics Simulator"
    log "Korean Time Zone: $TZ"
    
    while true; do
        local current_time=$(date '+%Y-%m-%d %H:%M:%S KST')
        local time_info=$(get_korean_time_info)
        local hour=$(echo $time_info | cut -d' ' -f1)
        local is_business_hours=$(echo $time_info | cut -d' ' -f4)
        local is_lunch_hour=$(echo $time_info | cut -d' ' -f5)
        local is_peak_shopping=$(echo $time_info | cut -d' ' -f6)
        local is_weekend=$(echo $time_info | cut -d' ' -f7)
        
        # Log current Korean business context
        local context="Regular Hours"
        if [ $is_business_hours -eq 1 ]; then
            context="Business Hours"
        fi
        if [ $is_lunch_hour -eq 1 ]; then
            context="Lunch Hour"
        fi
        if [ $is_peak_shopping -eq 1 ]; then
            context="Peak Shopping"
        fi
        if [ $is_weekend -eq 1 ]; then
            context="Weekend"
        fi
        
        log "⏰ $current_time - Korean Context: $context"
        
        # Generate and write metrics to temporary file
        local metrics_file="/tmp/korean_metrics_$(date +%s).txt"
        
        {
            echo "# Korean E-commerce Business Metrics"
            echo "# Generated at: $current_time"
            echo "# Business Context: $context"
            echo ""
            
            generate_payment_metrics
            generate_business_metrics
            generate_shipping_metrics
            generate_satisfaction_metrics
        } > "$metrics_file"
        
        # Send metrics to Prometheus via pushgateway if available
        if curl -s -f "$PUSHGATEWAY_ENDPOINT" >/dev/null 2>&1; then
            curl -X POST --data-binary "@$metrics_file" "$PUSHGATEWAY_ENDPOINT" >/dev/null 2>&1
            log "📊 Metrics pushed to Prometheus"
        fi
        
        # Log some key metrics
        local active_users=$(grep "korean_active_users" "$metrics_file" | awk '{print $2}')
        local orders=$(grep "orders_completed_total" "$metrics_file" | awk '{print $2}')
        log "👥 Active Users: $active_users | 🛒 Orders: $orders"
        
        # Clean up
        rm -f "$metrics_file"
        
        # Sleep for 30 seconds (realistic metric collection interval)
        sleep 30
    done
}

# Handle shutdown gracefully
trap 'log "🛑 Korean Metrics Simulator stopping..."; exit 0' TERM INT

# Start the simulator
main