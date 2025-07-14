# CI/CD Pipeline Documentation

## Overview

This document describes the comprehensive CI/CD pipeline implemented for the Commerce Plugin project using GitHub Actions.

## Pipeline Architecture

### Continuous Integration (CI)

The CI pipeline runs on every push and pull request to ensure code quality and functionality.

#### Workflows

1. **CI Pipeline** (`ci.yml`)
   - Linting (ESLint, Prettier)
   - Type checking (TypeScript)
   - Unit tests
   - Integration tests
   - E2E tests
   - Code coverage reporting
   - Build verification
   - Docker image building

2. **Security Scanning** (`security.yml`)
   - Dependency vulnerability scanning (npm audit, Snyk)
   - Code security scanning (CodeQL, Semgrep)
   - Secret scanning (TruffleHog, Gitleaks)
   - Container scanning (Trivy, Grype)
   - SAST (Bearer)
   - License compliance checking

3. **PR Checks** (`pr-checks.yml`)
   - PR validation (title, branch naming)
   - Size checking
   - Auto-assignment of reviewers
   - Danger JS checks
   - Documentation requirements
   - Test coverage verification
   - API breaking changes detection
   - Performance impact analysis

### Continuous Deployment (CD)

The CD pipeline handles automated deployments to different environments.

#### Environments

1. **Staging** (`cd-staging.yml`)
   - Triggered on push to `develop` branch
   - Deploys to staging environment
   - Runs smoke tests
   - Sends deployment notifications

2. **Production** (`cd-production.yml`)
   - Triggered on push to `main` branch
   - Requires manual approval
   - Creates database backup
   - Blue-green deployment
   - Multi-region deployment
   - Automatic rollback on failure

#### Deployment Targets

The pipeline supports multiple deployment targets:

- **AWS ECS**: Container orchestration on AWS
- **Heroku**: Platform-as-a-Service deployment
- **Docker Swarm**: Self-hosted container orchestration

### Release Management

The release workflow (`release.yml`) handles:

- Semantic versioning
- Changelog generation
- Multi-platform builds
- NPM package publishing
- Docker image publishing
- Documentation updates
- Release notifications

## Setup Instructions

### Prerequisites

1. GitHub repository with Actions enabled
2. Required secrets configured (see Environment Secrets)
3. Docker Hub account
4. Cloud provider accounts (AWS/Heroku)

### Initial Setup

1. **Configure Repository Secrets**
   ```bash
   # Required secrets
   DOCKER_USERNAME
   DOCKER_PASSWORD
   NPM_TOKEN
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   SLACK_WEBHOOK_URL
   ```

2. **Set Up Environments**
   - Create `staging`, `production`, and `production-approval` environments
   - Configure environment protection rules
   - Add required reviewers for production

3. **Configure Branch Protection**
   ```bash
   # Main branch
   - Require PR reviews
   - Require status checks to pass
   - Require branches to be up to date
   
   # Develop branch
   - Require PR reviews
   - Require status checks to pass
   ```

### Environment Secrets

#### Global Secrets

```yaml
# Docker Registry
DOCKER_USERNAME: Your Docker Hub username
DOCKER_PASSWORD: Your Docker Hub password or access token

# NPM Registry
NPM_TOKEN: NPM automation token

# Code Quality
CODECOV_TOKEN: Codecov upload token
SNYK_TOKEN: Snyk authentication token

# Notifications
SLACK_WEBHOOK_URL: Slack incoming webhook URL
PAGERDUTY_TOKEN: PagerDuty integration key

# Security Scanning
BEARER_TOKEN: Bearer security token
```

#### Staging Environment

```yaml
# Database
STAGING_DATABASE_URL: PostgreSQL connection string

# AWS (if using AWS deployment)
AWS_ACCESS_KEY_ID: AWS access key
AWS_SECRET_ACCESS_KEY: AWS secret key
AWS_REGION: AWS region (e.g., us-east-1)

# Heroku (if using Heroku deployment)
HEROKU_API_KEY: Heroku API key
HEROKU_APP_NAME_STAGING: Heroku app name
HEROKU_EMAIL: Heroku account email

# Application
JWT_SECRET: JWT signing secret
CORS_ORIGINS: Allowed CORS origins
```

#### Production Environment

```yaml
# Database
PRODUCTION_DATABASE_URL: PostgreSQL connection string

# AWS
AWS_ACCESS_KEY_ID: AWS access key
AWS_SECRET_ACCESS_KEY: AWS secret key
TARGET_GROUP_ARN_us-east-1: ALB target group ARN
TARGET_GROUP_ARN_eu-west-1: ALB target group ARN
TARGET_GROUP_ARN_ap-southeast-1: ALB target group ARN

# CDN
CLOUDFRONT_DISTRIBUTION_ID: CloudFront distribution ID

# Monitoring
SENTRY_DSN: Sentry error tracking DSN
NEW_RELIC_LICENSE_KEY: New Relic license key
GRAFANA_ADMIN_PASSWORD: Grafana admin password

# Payment Providers
STRIPE_SECRET_KEY: Stripe secret key
STRIPE_WEBHOOK_SECRET: Stripe webhook secret
PAYPAL_CLIENT_ID: PayPal client ID
PAYPAL_CLIENT_SECRET: PayPal client secret
```

## Deployment Process

### Staging Deployment

1. Developer pushes code to `develop` branch
2. CI pipeline runs all tests
3. On success, CD pipeline triggers
4. Docker image is built and pushed
5. Application deploys to staging
6. Database migrations run
7. Health checks verify deployment
8. Smoke tests run
9. Notification sent to Slack

### Production Deployment

1. Code merged to `main` branch
2. Pre-deployment checks run
3. Manual approval required
4. Database backup created
5. Blue-green deployment starts
6. Deploy to multiple regions in parallel
7. Database migrations run
8. Cache warm-up
9. Health checks and production tests
10. CDN cache invalidation
11. Update monitoring systems
12. Send notifications

### Rollback Process

Automatic rollback triggers if:
- Health checks fail
- Production tests fail
- Error rate exceeds threshold

Manual rollback:
```bash
# Trigger rollback workflow
gh workflow run rollback.yml -f environment=production -f snapshot-id=<snapshot-id>
```

## Monitoring and Alerts

### Build Status Badges

Add to README:
```markdown
![CI](https://github.com/your-org/commerce-plugin/workflows/CI%20Pipeline/badge.svg)
![Security](https://github.com/your-org/commerce-plugin/workflows/Security%20Scanning/badge.svg)
![Deploy Staging](https://github.com/your-org/commerce-plugin/workflows/CD%20-%20Deploy%20to%20Staging/badge.svg)
![Deploy Production](https://github.com/your-org/commerce-plugin/workflows/CD%20-%20Deploy%20to%20Production/badge.svg)
```

### Notifications

Notifications are sent for:
- Build failures
- Security vulnerabilities
- Deployment status
- Release publications

### Performance Metrics

The pipeline tracks:
- Build times
- Test execution times
- Deployment duration
- Bundle size changes
- Lighthouse scores

## Best Practices

### Commit Messages

Follow conventional commits:
```
feat: add new payment provider
fix: resolve cart calculation issue
docs: update API documentation
chore: update dependencies
```

### Branch Naming

Use consistent branch names:
```
feature/add-payment-provider
bugfix/cart-calculation
hotfix/security-patch
release/v1.2.0
```

### PR Guidelines

1. Keep PRs small and focused
2. Include meaningful description
3. Update tests and documentation
4. Ensure all checks pass
5. Request reviews from appropriate team members

### Security

1. Never commit secrets
2. Use environment variables
3. Rotate credentials regularly
4. Review security scan results
5. Keep dependencies updated

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check error logs in Actions tab
   - Verify all secrets are configured
   - Ensure dependencies are locked

2. **Deployment Failures**
   - Check environment configuration
   - Verify cloud provider credentials
   - Review deployment logs

3. **Test Failures**
   - Run tests locally first
   - Check for timing issues
   - Verify test database setup

### Debug Mode

Enable debug logging:
```yaml
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review and merge Dependabot PRs
   - Check security scan results
   - Monitor build times

2. **Monthly**
   - Update GitHub Actions versions
   - Review and optimize workflows
   - Clean up old artifacts

3. **Quarterly**
   - Rotate credentials
   - Review deployment strategy
   - Update documentation

## Support

For issues or questions:
1. Check GitHub Actions documentation
2. Review workflow logs
3. Contact DevOps team
4. Create issue in repository