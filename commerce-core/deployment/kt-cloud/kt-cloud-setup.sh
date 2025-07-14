#!/bin/bash

# ==================================================
# KT Cloud Setup Script for Korean E-commerce
# ==================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
KT_REGION="${KT_REGION:-kr-central-1}"
KT_ZONE="${KT_ZONE:-kr-central-1a}"
PROJECT_NAME="${PROJECT_NAME:-korean-ecommerce}"
VPC_NAME="${VPC_NAME:-korean-ecommerce-vpc}"

# Function to print colored output
log() {
    local color=$1
    local message=$2
    local timestamp=$(TZ=Asia/Seoul date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "Checking KT Cloud prerequisites..."
    
    # Check if KT Cloud CLI is installed
    if ! command -v ktcloud &> /dev/null; then
        log $RED "✗ KT Cloud CLI not found"
        log $BLUE "Please install from: https://cloud.kt.com/docs/open-api-guide/cli/"
        exit 1
    fi
    
    # Check if required environment variables are set
    local required_vars=("KT_ACCESS_KEY" "KT_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log $RED "✗ Environment variable $var is not set"
            exit 1
        fi
    done
    
    log $GREEN "✓ Prerequisites check completed"
}

# Function to configure KT Cloud credentials
configure_kt_credentials() {
    log $BLUE "Configuring KT Cloud credentials..."
    
    # Configure KT Cloud CLI
    ktcloud configure set --region "$KT_REGION"
    ktcloud configure set --access-key "$KT_ACCESS_KEY"
    ktcloud configure set --secret-key "$KT_SECRET_KEY"
    
    # Test connection
    if ktcloud vpc list-vpcs --region "$KT_REGION" >/dev/null 2>&1; then
        log $GREEN "✓ KT Cloud credentials configured and tested"
    else
        log $RED "✗ Failed to authenticate with KT Cloud"
        exit 1
    fi
}

# Function to create KT Cloud VPC
create_kt_vpc() {
    log $BLUE "Creating KT Cloud VPC for Korean market..."
    
    # Check if VPC already exists
    if ktcloud vpc list-vpcs --region "$KT_REGION" --query "Vpcs[?VpcName=='$VPC_NAME']" | grep -q "$VPC_NAME"; then
        log $YELLOW "⚠ VPC $VPC_NAME already exists"
        VPC_ID=$(ktcloud vpc list-vpcs --region "$KT_REGION" --query "Vpcs[?VpcName=='$VPC_NAME'].VpcId" --output text)
    else
        log $BLUE "Creating new VPC: $VPC_NAME"
        VPC_ID=$(ktcloud vpc create-vpc \
            --vpc-name "$VPC_NAME" \
            --cidr-block "10.0.0.0/16" \
            --region "$KT_REGION" \
            --description "Korean E-commerce VPC" \
            --query "Vpc.VpcId" \
            --output text)
    fi
    
    log $GREEN "✓ VPC ID: $VPC_ID"
    
    # Wait for VPC to be available
    log $BLUE "Waiting for VPC to be available..."
    while true; do
        local state=$(ktcloud vpc describe-vpcs --vpc-ids "$VPC_ID" --region "$KT_REGION" --query "Vpcs[0].State" --output text)
        if [ "$state" = "available" ]; then
            log $GREEN "✓ VPC is available"
            break
        else
            log $BLUE "VPC state: $state (waiting...)"
            sleep 10
        fi
    done
}

# Function to create subnets
create_kt_subnets() {
    log $BLUE "Creating subnets for Korean e-commerce..."
    
    # Public subnet for load balancers
    local public_subnet_name="korean-public-subnet"
    log $BLUE "Creating public subnet: $public_subnet_name"
    
    PUBLIC_SUBNET_ID=$(ktcloud vpc create-subnet \
        --vpc-id "$VPC_ID" \
        --subnet-name "$public_subnet_name" \
        --cidr-block "10.0.1.0/24" \
        --availability-zone "$KT_ZONE" \
        --subnet-type "public" \
        --region "$KT_REGION" \
        --query "Subnet.SubnetId" \
        --output text)
    
    log $GREEN "✓ Public subnet created: $PUBLIC_SUBNET_ID"
    
    # Private subnet for application servers
    local private_subnet_name="korean-private-subnet"
    log $BLUE "Creating private subnet: $private_subnet_name"
    
    PRIVATE_SUBNET_ID=$(ktcloud vpc create-subnet \
        --vpc-id "$VPC_ID" \
        --subnet-name "$private_subnet_name" \
        --cidr-block "10.0.2.0/24" \
        --availability-zone "$KT_ZONE" \
        --subnet-type "private" \
        --region "$KT_REGION" \
        --query "Subnet.SubnetId" \
        --output text)
    
    log $GREEN "✓ Private subnet created: $PRIVATE_SUBNET_ID"
    
    # Database subnet
    local db_subnet_name="korean-db-subnet"
    log $BLUE "Creating database subnet: $db_subnet_name"
    
    DB_SUBNET_ID=$(ktcloud vpc create-subnet \
        --vpc-id "$VPC_ID" \
        --subnet-name "$db_subnet_name" \
        --cidr-block "10.0.3.0/24" \
        --availability-zone "$KT_ZONE" \
        --subnet-type "private" \
        --region "$KT_REGION" \
        --query "Subnet.SubnetId" \
        --output text)
    
    log $GREEN "✓ Database subnet created: $DB_SUBNET_ID"
}

# Function to create security groups
create_security_groups() {
    log $BLUE "Creating security groups for Korean e-commerce..."
    
    # Web server security group
    log $BLUE "Creating web server security group..."
    WEB_SG_ID=$(ktcloud vpc create-security-group \
        --group-name "korean-web-sg" \
        --group-description "Korean E-commerce Web Servers" \
        --vpc-id "$VPC_ID" \
        --region "$KT_REGION" \
        --query "SecurityGroup.GroupId" \
        --output text)
    
    # Add rules for web servers
    ktcloud vpc add-security-group-rule \
        --group-id "$WEB_SG_ID" \
        --direction "ingress" \
        --protocol "tcp" \
        --port-range "80-80" \
        --cidr-block "0.0.0.0/0" \
        --region "$KT_REGION"
    
    ktcloud vpc add-security-group-rule \
        --group-id "$WEB_SG_ID" \
        --direction "ingress" \
        --protocol "tcp" \
        --port-range "443-443" \
        --cidr-block "0.0.0.0/0" \
        --region "$KT_REGION"
    
    ktcloud vpc add-security-group-rule \
        --group-id "$WEB_SG_ID" \
        --direction "ingress" \
        --protocol "tcp" \
        --port-range "22-22" \
        --cidr-block "10.0.0.0/16" \
        --region "$KT_REGION"
    
    log $GREEN "✓ Web security group created: $WEB_SG_ID"
    
    # Database security group
    log $BLUE "Creating database security group..."
    DB_SG_ID=$(ktcloud vpc create-security-group \
        --group-name "korean-db-sg" \
        --group-description "Korean E-commerce Database" \
        --vpc-id "$VPC_ID" \
        --region "$KT_REGION" \
        --query "SecurityGroup.GroupId" \
        --output text)
    
    # Add rules for database
    ktcloud vpc add-security-group-rule \
        --group-id "$DB_SG_ID" \
        --direction "ingress" \
        --protocol "tcp" \
        --port-range "5432-5432" \
        --source-group-id "$WEB_SG_ID" \
        --region "$KT_REGION"
    
    ktcloud vpc add-security-group-rule \
        --group-id "$DB_SG_ID" \
        --direction "ingress" \
        --protocol "tcp" \
        --port-range "6379-6379" \
        --source-group-id "$WEB_SG_ID" \
        --region "$KT_REGION"
    
    log $GREEN "✓ Database security group created: $DB_SG_ID"
}

# Function to create Korean-optimized instances
create_korean_instances() {
    log $BLUE "Creating Korean e-commerce application instances..."
    
    # Create key pair if not exists
    local key_name="korean-ecommerce-key"
    if ! ktcloud compute describe-key-pairs --key-names "$key_name" --region "$KT_REGION" >/dev/null 2>&1; then
        log $BLUE "Creating key pair: $key_name"
        ktcloud compute create-key-pair \
            --key-name "$key_name" \
            --region "$KT_REGION" \
            --query "KeyMaterial" \
            --output text > "${key_name}.pem"
        chmod 400 "${key_name}.pem"
        log $GREEN "✓ Key pair created and saved to ${key_name}.pem"
    fi
    
    # User data for Korean localization
    cat > /tmp/korean-userdata.sh << 'EOF'
#!/bin/bash
# Korean E-commerce Server Setup

# Set Korean timezone
timedatectl set-timezone Asia/Seoul

# Set Korean locale
localectl set-locale LANG=ko_KR.UTF-8

# Install Docker
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker

# Install Node.js (for Korean e-commerce)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Create application directory
mkdir -p /var/www/korean-ecommerce
chown ubuntu:ubuntu /var/www/korean-ecommerce

# Set up monitoring agent
cat > /etc/systemd/system/korean-monitoring.service << 'MONITOR_EOF'
[Unit]
Description=Korean E-commerce Monitoring Agent
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/node /var/www/korean-ecommerce/monitoring/agent.js
Restart=always
RestartSec=10
Environment=TZ=Asia/Seoul
Environment=LOCALE=ko-KR

[Install]
WantedBy=multi-user.target
MONITOR_EOF

systemctl enable korean-monitoring

# Korean business hours cron jobs
cat > /tmp/korean-crontab << 'CRON_EOF'
# Korean business hours optimization
0 8 * * 1-5 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=3
0 18 * * 1-5 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=2
0 12 * * 1-5 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=5
0 13 * * 1-5 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=3

# Weekend traffic optimization
0 10 * * 6-7 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=4
0 20 * * 6-7 /usr/local/bin/docker-compose -f /var/www/korean-ecommerce/docker-compose.yml scale app=2

# Daily maintenance at 3 AM KST
0 3 * * * /var/www/korean-ecommerce/scripts/maintenance/maintenance.sh korean-business
CRON_EOF

crontab -u ubuntu /tmp/korean-crontab

# Log setup complete
echo "$(date): Korean E-commerce server setup completed" >> /var/log/setup.log
EOF
    
    # Launch application instances
    local instance_count=3
    INSTANCE_IDS=()
    
    for i in $(seq 1 $instance_count); do
        log $BLUE "Launching instance $i/$instance_count..."
        
        local instance_id=$(ktcloud compute run-instances \
            --image-id "ami-0c02fb55956c7d316" \
            --instance-type "m5.large" \
            --key-name "$key_name" \
            --security-group-ids "$WEB_SG_ID" \
            --subnet-id "$PRIVATE_SUBNET_ID" \
            --user-data file:///tmp/korean-userdata.sh \
            --region "$KT_REGION" \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=korean-ecommerce-app-$i},{Key=Environment,Value=production},{Key=Market,Value=korean}]" \
            --query "Instances[0].InstanceId" \
            --output text)
        
        INSTANCE_IDS+=("$instance_id")
        log $GREEN "✓ Instance $i launched: $instance_id"
    done
    
    # Wait for instances to be running
    log $BLUE "Waiting for instances to be running..."
    for instance_id in "${INSTANCE_IDS[@]}"; do
        ktcloud compute wait instance-running --instance-ids "$instance_id" --region "$KT_REGION"
        log $GREEN "✓ Instance running: $instance_id"
    done
}

# Function to create Korean database cluster
create_korean_database() {
    log $BLUE "Creating Korean e-commerce database cluster..."
    
    # Create DB subnet group
    local db_subnet_group="korean-db-subnet-group"
    
    ktcloud rds create-db-subnet-group \
        --db-subnet-group-name "$db_subnet_group" \
        --db-subnet-group-description "Korean E-commerce DB Subnet Group" \
        --subnet-ids "$DB_SUBNET_ID" \
        --region "$KT_REGION"
    
    log $GREEN "✓ DB subnet group created: $db_subnet_group"
    
    # Create PostgreSQL instance for Korean e-commerce
    local db_instance_id="korean-ecommerce-db"
    
    ktcloud rds create-db-instance \
        --db-instance-identifier "$db_instance_id" \
        --db-instance-class "db.t3.medium" \
        --engine "postgres" \
        --engine-version "15.3" \
        --master-username "commerce_admin" \
        --master-user-password "$(openssl rand -base64 32)" \
        --allocated-storage 100 \
        --storage-type "gp2" \
        --storage-encrypted \
        --vpc-security-group-ids "$DB_SG_ID" \
        --db-subnet-group-name "$db_subnet_group" \
        --backup-retention-period 7 \
        --preferred-backup-window "03:00-04:00" \
        --preferred-maintenance-window "sun:04:00-sun:05:00" \
        --region "$KT_REGION" \
        --tags "Key=Name,Value=korean-ecommerce-db" "Key=Environment,Value=production" "Key=Market,Value=korean"
    
    log $BLUE "Waiting for database to be available..."
    ktcloud rds wait db-instance-available --db-instance-identifier "$db_instance_id" --region "$KT_REGION"
    log $GREEN "✓ PostgreSQL database created: $db_instance_id"
    
    # Create Redis cluster
    local redis_cluster_id="korean-ecommerce-redis"
    
    ktcloud elasticache create-cache-cluster \
        --cache-cluster-id "$redis_cluster_id" \
        --cache-node-type "cache.t3.medium" \
        --engine "redis" \
        --engine-version "7.0" \
        --num-cache-nodes 1 \
        --cache-subnet-group-name "$db_subnet_group" \
        --security-group-ids "$DB_SG_ID" \
        --region "$KT_REGION" \
        --tags "Key=Name,Value=korean-ecommerce-redis" "Key=Environment,Value=production" "Key=Market,Value=korean"
    
    log $GREEN "✓ Redis cluster created: $redis_cluster_id"
}

# Function to create load balancer
create_korean_load_balancer() {
    log $BLUE "Creating load balancer for Korean traffic..."
    
    local lb_name="korean-ecommerce-alb"
    
    # Create Application Load Balancer
    LB_ARN=$(ktcloud elbv2 create-load-balancer \
        --name "$lb_name" \
        --scheme "internet-facing" \
        --type "application" \
        --subnets "$PUBLIC_SUBNET_ID" \
        --security-groups "$WEB_SG_ID" \
        --region "$KT_REGION" \
        --tags "Key=Name,Value=$lb_name" "Key=Environment,Value=production" "Key=Market,Value=korean" \
        --query "LoadBalancers[0].LoadBalancerArn" \
        --output text)
    
    log $GREEN "✓ Load balancer created: $LB_ARN"
    
    # Create target group
    local tg_name="korean-ecommerce-tg"
    
    TG_ARN=$(ktcloud elbv2 create-target-group \
        --name "$tg_name" \
        --protocol "HTTP" \
        --port 3000 \
        --vpc-id "$VPC_ID" \
        --target-type "instance" \
        --health-check-path "/health" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 10 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --region "$KT_REGION" \
        --query "TargetGroups[0].TargetGroupArn" \
        --output text)
    
    log $GREEN "✓ Target group created: $TG_ARN"
    
    # Register instances with target group
    for instance_id in "${INSTANCE_IDS[@]}"; do
        ktcloud elbv2 register-targets \
            --target-group-arn "$TG_ARN" \
            --targets "Id=$instance_id,Port=3000" \
            --region "$KT_REGION"
    done
    
    log $GREEN "✓ Instances registered with target group"
    
    # Create listener
    ktcloud elbv2 create-listener \
        --load-balancer-arn "$LB_ARN" \
        --protocol "HTTP" \
        --port 80 \
        --default-actions "Type=forward,TargetGroupArn=$TG_ARN" \
        --region "$KT_REGION"
    
    log $GREEN "✓ HTTP listener created"
    
    # Get load balancer DNS name
    LB_DNS=$(ktcloud elbv2 describe-load-balancers \
        --load-balancer-arns "$LB_ARN" \
        --region "$KT_REGION" \
        --query "LoadBalancers[0].DNSName" \
        --output text)
    
    log $GREEN "✓ Load balancer DNS: $LB_DNS"
}

# Function to setup Korean monitoring
setup_korean_monitoring() {
    log $BLUE "Setting up Korean market monitoring..."
    
    # Create CloudWatch dashboard for Korean metrics
    cat > /tmp/korean-dashboard.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "$lb_name"],
          [".", "TargetResponseTime", ".", "."],
          [".", "HTTPCode_Target_2XX_Count", ".", "."],
          [".", "HTTPCode_Target_4XX_Count", ".", "."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "$KT_REGION",
        "title": "Korean E-commerce Load Balancer Metrics",
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/EC2", "CPUUtilization", "InstanceId", "${INSTANCE_IDS[0]}"],
          [".", ".", ".", "${INSTANCE_IDS[1]}"],
          [".", ".", ".", "${INSTANCE_IDS[2]}"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "$KT_REGION",
        "title": "Korean E-commerce Instance CPU Utilization"
      }
    }
  ]
}
EOF
    
    ktcloud cloudwatch put-dashboard \
        --dashboard-name "Korean-Ecommerce-Dashboard" \
        --dashboard-body file:///tmp/korean-dashboard.json \
        --region "$KT_REGION"
    
    log $GREEN "✓ Korean monitoring dashboard created"
    
    # Create Korean business hours alarms
    ktcloud cloudwatch put-metric-alarm \
        --alarm-name "Korean-Peak-Hour-High-CPU" \
        --alarm-description "High CPU during Korean peak hours" \
        --actions-enabled \
        --metric-name "CPUUtilization" \
        --namespace "AWS/EC2" \
        --statistic "Average" \
        --dimensions "Name=InstanceId,Value=${INSTANCE_IDS[0]}" \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 80.0 \
        --comparison-operator "GreaterThanThreshold" \
        --region "$KT_REGION"
    
    log $GREEN "✓ Korean business hours alarms created"
}

# Function to run health checks
run_korean_health_checks() {
    log $BLUE "Running Korean market health checks..."
    
    # Test load balancer
    if curl -f -s "http://$LB_DNS/health" >/dev/null; then
        log $GREEN "✓ Load balancer health check passed"
    else
        log $YELLOW "⚠ Load balancer health check failed (may need time to warm up)"
    fi
    
    # Test Korean localization
    if curl -f -s -H "Accept-Language: ko-KR" "http://$LB_DNS/api/health" >/dev/null; then
        log $GREEN "✓ Korean localization health check passed"
    else
        log $YELLOW "⚠ Korean localization health check failed"
    fi
    
    # Check instance health
    local healthy_instances=0
    for instance_id in "${INSTANCE_IDS[@]}"; do
        local instance_state=$(ktcloud ec2 describe-instances \
            --instance-ids "$instance_id" \
            --region "$KT_REGION" \
            --query "Reservations[0].Instances[0].State.Name" \
            --output text)
        
        if [ "$instance_state" = "running" ]; then
            healthy_instances=$((healthy_instances + 1))
        fi
    done
    
    log $GREEN "✓ Healthy instances: $healthy_instances/${#INSTANCE_IDS[@]}"
}

# Function to display deployment summary
display_korean_summary() {
    log $BLUE "=== Korean E-commerce KT Cloud Deployment Summary ==="
    echo ""
    
    echo "🇰🇷 Korean Market Deployment Complete!"
    echo "📍 Region: $KT_REGION"
    echo "🌐 VPC ID: $VPC_ID"
    echo "🔗 Load Balancer: $LB_DNS"
    echo ""
    
    echo "💻 Instance IDs:"
    for i, instance_id in "${!INSTANCE_IDS[@]}"; do
        echo "   App Server $((i+1)): $instance_id"
    done
    echo ""
    
    echo "🗄️ Database:"
    echo "   PostgreSQL: korean-ecommerce-db"
    echo "   Redis: korean-ecommerce-redis"
    echo ""
    
    echo "🔒 Security Groups:"
    echo "   Web Servers: $WEB_SG_ID"
    echo "   Database: $DB_SG_ID"
    echo ""
    
    echo "🇰🇷 Korean Business Features:"
    echo "   ✓ Korean timezone (Asia/Seoul)"
    echo "   ✓ Korean locale (ko-KR)"
    echo "   ✓ Business hours optimization"
    echo "   ✓ Peak traffic scaling"
    echo "   ✓ Korean monitoring dashboard"
    echo ""
    
    echo "🌍 Access URLs:"
    echo "   Main Site: http://$LB_DNS"
    echo "   Health Check: http://$LB_DNS/health"
    echo "   Korean API: http://$LB_DNS/api/health"
    echo ""
    
    echo "📊 Monitoring:"
    echo "   CloudWatch Dashboard: Korean-Ecommerce-Dashboard"
    echo "   Logs: /var/log/korean-ecommerce/"
    echo ""
    
    echo "🔧 Management Commands:"
    echo "   SSH to instances: ssh -i korean-ecommerce-key.pem ubuntu@<instance-ip>"
    echo "   View logs: tail -f /var/log/korean-ecommerce/app.log"
    echo "   Scale instances: modify Auto Scaling Group"
    echo ""
    
    log $GREEN "🎉 Korean e-commerce deployment on KT Cloud completed successfully!"
}

# Main execution function
main() {
    log $BLUE "🇰🇷 Starting Korean E-commerce deployment on KT Cloud"
    log $BLUE "Deployment time: $(TZ=Asia/Seoul date)"
    
    check_prerequisites
    configure_kt_credentials
    create_kt_vpc
    create_kt_subnets
    create_security_groups
    create_korean_instances
    create_korean_database
    create_korean_load_balancer
    setup_korean_monitoring
    
    # Wait for services to stabilize
    log $BLUE "Waiting for services to stabilize..."
    sleep 60
    
    run_korean_health_checks
    display_korean_summary
}

# Execute main function
main "$@"