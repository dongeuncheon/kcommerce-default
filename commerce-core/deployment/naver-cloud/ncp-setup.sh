#!/bin/bash

# ==================================================
# Naver Cloud Platform Setup Script
# Korean E-commerce Core Deployment
# ==================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NCP_REGION="${NCP_REGION:-kr-central-1}"
NCP_ZONE="${NCP_ZONE:-kr-central-1a}"
CLUSTER_NAME="${CLUSTER_NAME:-korean-ecommerce-cluster}"
PROJECT_NAME="${PROJECT_NAME:-korean-ecommerce}"

# Function to print colored output
log() {
    local color=$1
    local message=$2
    local timestamp=$(TZ=Asia/Seoul date "+%Y-%m-%d %H:%M:%S KST")
    echo -e "${color}[${timestamp}] ${message}${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "Checking prerequisites for NCP deployment..."
    
    # Check if ncloud CLI is installed
    if ! command -v ncloud &> /dev/null; then
        log $RED "✗ Naver Cloud CLI not found"
        log $BLUE "Please install: https://guide.ncloud-docs.com/docs/cli-install"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log $RED "✗ kubectl not found"
        exit 1
    fi
    
    # Check if required environment variables are set
    local required_vars=("NCP_ACCESS_KEY" "NCP_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log $RED "✗ Environment variable $var is not set"
            exit 1
        fi
    done
    
    log $GREEN "✓ Prerequisites check completed"
}

# Function to configure NCP credentials
configure_ncp_credentials() {
    log $BLUE "Configuring Naver Cloud Platform credentials..."
    
    # Configure ncloud CLI
    ncloud configure set --region "$NCP_REGION"
    ncloud configure set --access-key-id "$NCP_ACCESS_KEY"
    ncloud configure set --secret-access-key "$NCP_SECRET_KEY"
    
    log $GREEN "✓ NCP credentials configured"
}

# Function to create VPC for Korean market
create_korean_vpc() {
    log $BLUE "Creating VPC for Korean market..."
    
    # Create VPC with Korean naming convention
    local vpc_name="korean-ecommerce-vpc"
    local vpc_cidr="10.0.0.0/16"
    
    # Check if VPC already exists
    if ncloud vpc getVpcList --vpcName "$vpc_name" --region "$NCP_REGION" | grep -q "$vpc_name"; then
        log $YELLOW "⚠ VPC $vpc_name already exists"
        VPC_ID=$(ncloud vpc getVpcList --vpcName "$vpc_name" --region "$NCP_REGION" --output json | jq -r '.vpcList[0].vpcNo')
    else
        log $BLUE "Creating new VPC: $vpc_name"
        VPC_ID=$(ncloud vpc createVpc --vpcName "$vpc_name" --ipv4CidrBlock "$vpc_cidr" --region "$NCP_REGION" --output json | jq -r '.vpcList[0].vpcNo')
    fi
    
    log $GREEN "✓ VPC created/found: $VPC_ID"
    
    # Create subnets for Korean availability zones
    create_korean_subnets "$VPC_ID"
}

# Function to create subnets optimized for Korean traffic
create_korean_subnets() {
    local vpc_id=$1
    
    log $BLUE "Creating subnets for Korean market..."
    
    # Public subnet for load balancers
    local public_subnet_name="korean-ecommerce-public-subnet"
    local public_subnet_cidr="10.0.1.0/24"
    
    if ! ncloud vpc getSubnetList --vpcNo "$vpc_id" --subnetName "$public_subnet_name" --region "$NCP_REGION" | grep -q "$public_subnet_name"; then
        ncloud vpc createSubnet \
            --vpcNo "$vpc_id" \
            --subnetName "$public_subnet_name" \
            --subnet "$public_subnet_cidr" \
            --zoneCode "$NCP_ZONE" \
            --networkAclNo "$(get_default_nacl "$vpc_id")" \
            --subnetTypeCode "PUBLIC" \
            --region "$NCP_REGION"
        log $GREEN "✓ Public subnet created: $public_subnet_name"
    else
        log $YELLOW "⚠ Public subnet already exists: $public_subnet_name"
    fi
    
    # Private subnet for application servers
    local private_subnet_name="korean-ecommerce-private-subnet"
    local private_subnet_cidr="10.0.2.0/24"
    
    if ! ncloud vpc getSubnetList --vpcNo "$vpc_id" --subnetName "$private_subnet_name" --region "$NCP_REGION" | grep -q "$private_subnet_name"; then
        ncloud vpc createSubnet \
            --vpcNo "$vpc_id" \
            --subnetName "$private_subnet_name" \
            --subnet "$private_subnet_cidr" \
            --zoneCode "$NCP_ZONE" \
            --networkAclNo "$(get_default_nacl "$vpc_id")" \
            --subnetTypeCode "PRIVATE" \
            --region "$NCP_REGION"
        log $GREEN "✓ Private subnet created: $private_subnet_name"
    else
        log $YELLOW "⚠ Private subnet already exists: $private_subnet_name"
    fi
}

# Function to get default NACL
get_default_nacl() {
    local vpc_id=$1
    ncloud vpc getNetworkAclList --vpcNo "$vpc_id" --region "$NCP_REGION" --output json | jq -r '.networkAclList[0].networkAclNo'
}

# Function to create NKS cluster for Korean market
create_korean_nks_cluster() {
    log $BLUE "Creating NKS cluster for Korean market..."
    
    # Check if cluster already exists
    if ncloud nks getClusters --region "$NCP_REGION" | grep -q "$CLUSTER_NAME"; then
        log $YELLOW "⚠ NKS cluster $CLUSTER_NAME already exists"
        return 0
    fi
    
    # Get subnet information
    local private_subnet_no=$(ncloud vpc getSubnetList --vpcNo "$VPC_ID" --subnetName "korean-ecommerce-private-subnet" --region "$NCP_REGION" --output json | jq -r '.subnetList[0].subnetNo')
    local public_subnet_no=$(ncloud vpc getSubnetList --vpcNo "$VPC_ID" --subnetName "korean-ecommerce-public-subnet" --region "$NCP_REGION" --output json | jq -r '.subnetList[0].subnetNo')
    
    # Create NKS cluster
    log $BLUE "Creating NKS cluster: $CLUSTER_NAME"
    ncloud nks createCluster \
        --name "$CLUSTER_NAME" \
        --clusterType "SVR.VNKS.STAND.C002.M008.NET.HDD.B050.G002" \
        --k8sVersion "1.27.3" \
        --loginKeyName "korean-ecommerce-key" \
        --vpcNo "$VPC_ID" \
        --subnetNoList "$private_subnet_no" \
        --lbPrivateSubnetNo "$private_subnet_no" \
        --lbPublicSubnetNo "$public_subnet_no" \
        --region "$NCP_REGION"
    
    log $BLUE "Waiting for cluster to be ready..."
    
    # Wait for cluster to be ready (can take 10-15 minutes)
    local timeout=1800  # 30 minutes
    local interval=30
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(ncloud nks getClusters --region "$NCP_REGION" --output json | jq -r ".clusters[] | select(.name==\"$CLUSTER_NAME\") | .status")
        
        if [ "$status" = "RUNNING" ]; then
            log $GREEN "✓ NKS cluster is ready: $CLUSTER_NAME"
            break
        elif [ "$status" = "ERROR" ]; then
            log $RED "✗ NKS cluster creation failed"
            exit 1
        else
            log $BLUE "Cluster status: $status (waiting...)"
            sleep $interval
            elapsed=$((elapsed + interval))
        fi
    done
    
    if [ $elapsed -ge $timeout ]; then
        log $RED "✗ Timeout waiting for cluster to be ready"
        exit 1
    fi
}

# Function to configure kubectl for Korean cluster
configure_kubectl_korean() {
    log $BLUE "Configuring kubectl for Korean cluster..."
    
    # Get cluster credentials
    ncloud nks getKubeConfig --uuid "$(get_cluster_uuid)" --region "$NCP_REGION" > ~/.kube/config-korean
    
    # Merge with existing kubeconfig or create new one
    export KUBECONFIG=~/.kube/config:~/.kube/config-korean
    kubectl config view --flatten > ~/.kube/merged-config
    mv ~/.kube/merged-config ~/.kube/config
    
    # Set current context to Korean cluster
    kubectl config use-context "nks-${CLUSTER_NAME}"
    
    # Verify connection
    if kubectl cluster-info | grep -q "Kubernetes control plane"; then
        log $GREEN "✓ kubectl configured for Korean cluster"
    else
        log $RED "✗ Failed to configure kubectl"
        exit 1
    fi
}

# Function to get cluster UUID
get_cluster_uuid() {
    ncloud nks getClusters --region "$NCP_REGION" --output json | jq -r ".clusters[] | select(.name==\"$CLUSTER_NAME\") | .uuid"
}

# Function to create Korean node pool
create_korean_node_pool() {
    log $BLUE "Creating node pool optimized for Korean traffic..."
    
    local cluster_uuid=$(get_cluster_uuid)
    local node_pool_name="korean-workers"
    
    # Check if node pool already exists
    if ncloud nks getNodePools --clusterUuid "$cluster_uuid" --region "$NCP_REGION" | grep -q "$node_pool_name"; then
        log $YELLOW "⚠ Node pool $node_pool_name already exists"
        return 0
    fi
    
    # Create node pool with Korean business hour considerations
    ncloud nks createNodePool \
        --clusterUuid "$cluster_uuid" \
        --nodePoolName "$node_pool_name" \
        --nodeCount 3 \
        --productCode "SVR.VSVR.HICPU.C004.M016.NET.HDD.B050.G003" \
        --autoscale \
        --minNodeCount 2 \
        --maxNodeCount 10 \
        --region "$NCP_REGION"
    
    log $BLUE "Waiting for node pool to be ready..."
    
    # Wait for node pool to be ready
    local timeout=900  # 15 minutes
    local interval=30
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(ncloud nks getNodePools --clusterUuid "$cluster_uuid" --region "$NCP_REGION" --output json | jq -r ".nodePools[] | select(.name==\"$node_pool_name\") | .status")
        
        if [ "$status" = "RUNNING" ]; then
            log $GREEN "✓ Node pool is ready: $node_pool_name"
            break
        else
            log $BLUE "Node pool status: $status (waiting...)"
            sleep $interval
            elapsed=$((elapsed + interval))
        fi
    done
}

# Function to setup Korean monitoring
setup_korean_monitoring() {
    log $BLUE "Setting up monitoring for Korean market..."
    
    # Install Prometheus with Korean timezone
    kubectl create namespace monitoring || true
    
    # Create Korean monitoring configuration
    cat > /tmp/korean-monitoring-values.yaml << EOF
prometheus:
  server:
    timezone: "Asia/Seoul"
    configMapOverrides:
      korean-business-hours: |
        groups:
        - name: korean-business-hours
          rules:
          - alert: HighTrafficDuringLunchHour
            expr: increase(http_requests_total[5m]) > 1000
            for: 2m
            labels:
              severity: warning
              business_context: korean_lunch_hour
            annotations:
              summary: "High traffic during Korean lunch hour (12-13 PM KST)"
          - alert: HighTrafficDuringEveningRush
            expr: increase(http_requests_total[5m]) > 2000
            for: 2m
            labels:
              severity: warning
              business_context: korean_evening_rush
            annotations:
              summary: "High traffic during Korean evening rush (20-22 PM KST)"

grafana:
  timezone: "Asia/Seoul"
  defaultDashboards:
    korean-ecommerce: true
EOF
    
    # Install monitoring stack
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    helm install korean-monitoring prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values /tmp/korean-monitoring-values.yaml
    
    log $GREEN "✓ Korean monitoring setup completed"
}

# Function to deploy Korean e-commerce application
deploy_korean_ecommerce() {
    log $BLUE "Deploying Korean e-commerce application..."
    
    # Apply Korean namespace and configurations
    kubectl apply -f ./deployment/naver-cloud/ncp-deployment.yml
    
    # Wait for deployment to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/korean-ecommerce-core -n korean-ecommerce
    
    # Get service external IP
    local external_ip=""
    local timeout=300
    local interval=10
    local elapsed=0
    
    log $BLUE "Waiting for LoadBalancer external IP..."
    
    while [ $elapsed -lt $timeout ]; do
        external_ip=$(kubectl get service korean-ecommerce-service -n korean-ecommerce -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        
        if [ -n "$external_ip" ] && [ "$external_ip" != "null" ]; then
            log $GREEN "✓ LoadBalancer external IP: $external_ip"
            break
        else
            log $BLUE "Waiting for external IP..."
            sleep $interval
            elapsed=$((elapsed + interval))
        fi
    done
    
    if [ -z "$external_ip" ] || [ "$external_ip" = "null" ]; then
        log $YELLOW "⚠ External IP not assigned yet, check manually later"
    fi
    
    log $GREEN "✓ Korean e-commerce application deployed"
}

# Function to setup Korean SSL certificate
setup_korean_ssl() {
    log $BLUE "Setting up SSL certificate for Korean domain..."
    
    # Install cert-manager
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    
    # Create Korean domain certificate issuer
    cat > /tmp/korean-ssl-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: korean-letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.kr
    privateKeySecretRef:
      name: korean-letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    kubectl apply -f /tmp/korean-ssl-issuer.yaml
    
    log $GREEN "✓ SSL certificate issuer configured"
}

# Function to create Korean ingress
create_korean_ingress() {
    log $BLUE "Creating ingress for Korean domain..."
    
    cat > /tmp/korean-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: korean-ecommerce-ingress
  namespace: korean-ecommerce
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "korean-letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - shop.yourdomain.kr
    - api.yourdomain.kr
    secretName: korean-ecommerce-tls
  rules:
  - host: shop.yourdomain.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: korean-ecommerce-service
            port:
              number: 80
  - host: api.yourdomain.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: korean-ecommerce-service
            port:
              number: 80
EOF
    
    kubectl apply -f /tmp/korean-ingress.yaml
    
    log $GREEN "✓ Korean ingress created"
}

# Function to run health checks
run_korean_health_checks() {
    log $BLUE "Running Korean market health checks..."
    
    # Get service endpoint
    local service_ip=$(kubectl get service korean-ecommerce-service -n korean-ecommerce -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -n "$service_ip" ] && [ "$service_ip" != "null" ]; then
        # Test health endpoint
        if curl -f -s "http://$service_ip/health" >/dev/null; then
            log $GREEN "✓ Health check passed"
        else
            log $RED "✗ Health check failed"
        fi
        
        # Test Korean API
        if curl -f -s -H "Accept-Language: ko-KR" "http://$service_ip/api/health" >/dev/null; then
            log $GREEN "✓ Korean API health check passed"
        else
            log $RED "✗ Korean API health check failed"
        fi
    else
        log $YELLOW "⚠ Service IP not available, skipping external health checks"
    fi
    
    # Check pod status
    local ready_pods=$(kubectl get pods -n korean-ecommerce -l app=korean-ecommerce-core --field-selector=status.phase=Running --no-headers | wc -l)
    log $GREEN "✓ Running pods: $ready_pods"
}

# Function to display deployment summary
display_deployment_summary() {
    log $BLUE "=== Korean E-commerce Deployment Summary ==="
    echo ""
    
    # Cluster information
    echo "🇰🇷 Korean NKS Cluster: $CLUSTER_NAME"
    echo "📍 Region: $NCP_REGION"
    echo "🌐 VPC ID: $VPC_ID"
    echo ""
    
    # Service information
    local service_ip=$(kubectl get service korean-ecommerce-service -n korean-ecommerce -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    echo "🔗 Service IP: $service_ip"
    
    if [ "$service_ip" != "Pending" ] && [ "$service_ip" != "null" ]; then
        echo "🌍 Health Check: http://$service_ip/health"
        echo "🇰🇷 Korean API: http://$service_ip/api/health"
    fi
    
    echo ""
    echo "📊 Monitoring:"
    echo "   Grafana: kubectl port-forward svc/korean-monitoring-grafana 3000:80 -n monitoring"
    echo "   Prometheus: kubectl port-forward svc/korean-monitoring-prometheus-server 9090:80 -n monitoring"
    echo ""
    
    echo "🔧 Management Commands:"
    echo "   View pods: kubectl get pods -n korean-ecommerce"
    echo "   View logs: kubectl logs -l app=korean-ecommerce-core -n korean-ecommerce"
    echo "   Scale app: kubectl scale deployment korean-ecommerce-core --replicas=5 -n korean-ecommerce"
    echo ""
    
    log $GREEN "🎉 Korean e-commerce deployment completed successfully!"
}

# Main execution function
main() {
    log $BLUE "🇰🇷 Starting Korean E-commerce Core deployment to Naver Cloud Platform"
    log $BLUE "Deployment time: $(TZ=Asia/Seoul date)"
    
    check_prerequisites
    configure_ncp_credentials
    create_korean_vpc
    create_korean_nks_cluster
    configure_kubectl_korean
    create_korean_node_pool
    setup_korean_monitoring
    deploy_korean_ecommerce
    setup_korean_ssl
    create_korean_ingress
    run_korean_health_checks
    display_deployment_summary
}

# Execute main function
main "$@"