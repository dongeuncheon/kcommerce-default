/**
 * ==================================================
 * PM2 Ecosystem Configuration for Korean E-commerce
 * ==================================================
 */

module.exports = {
  apps: [
    {
      // Main application
      name: 'commerce-core',
      script: './dist/index.js',
      cwd: '/app',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'Asia/Seoul',
        UV_THREADPOOL_SIZE: 128, // Increase thread pool for I/O operations
      },
      
      // Restart conditions
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      
      // Memory management
      max_memory_restart: '1G',
      
      // Logging
      log_file: '/app/logs/pm2-combined.log',
      out_file: '/app/logs/pm2-out.log',
      error_file: '/app/logs/pm2-error.log',
      log_type: 'json',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Monitoring
      monitoring: true,
      pmx: true,
      
      // Advanced PM2 features
      listen_timeout: 10000,
      kill_timeout: 5000,
      shutdown_with_message: true,
      
      // Health check
      health_check_grace_period: 3000,
      
      // Korean business hours optimization
      cron_restart: '0 3 * * *', // Restart at 3 AM KST daily
      
      // Process management
      vizion: false, // Disable git metadata collection for performance
      automation: false,
      
      // Source map support for production debugging
      source_map_support: true,
      
      // Instance variables for load balancing
      instance_var: 'INSTANCE_ID',
      
      // Advanced memory management
      node_args: [
        '--max-old-space-size=1024',
        '--max-semi-space-size=128',
        '--optimize-for-size'
      ],
      
      // Error handling
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Korean-specific environment
      env_korean_production: {
        NODE_ENV: 'production',
        LOCALE: 'ko-KR',
        TIMEZONE: 'Asia/Seoul',
        CURRENCY: 'KRW',
        BUSINESS_HOURS_START: '09:00',
        BUSINESS_HOURS_END: '18:00'
      }
    },
    
    // Worker process for background jobs
    {
      name: 'commerce-worker',
      script: './dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
        TZ: 'Asia/Seoul'
      },
      
      autorestart: true,
      restart_delay: 10000,
      max_restarts: 5,
      min_uptime: '1m',
      max_memory_restart: '512M',
      
      log_file: '/app/logs/worker-combined.log',
      out_file: '/app/logs/worker-out.log',
      error_file: '/app/logs/worker-error.log',
      
      // Worker-specific cron for Korean business patterns
      cron_restart: '0 2 * * *', // Restart at 2 AM KST
      
      node_args: [
        '--max-old-space-size=512'
      ]
    },
    
    // Payment processing service
    {
      name: 'commerce-payment',
      script: './dist/services/payment-service.js',
      instances: 1, // Single instance for payment consistency
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'payment',
        TZ: 'Asia/Seoul'
      },
      
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 3,
      min_uptime: '30s',
      max_memory_restart: '256M',
      
      log_file: '/app/logs/payment-combined.log',
      out_file: '/app/logs/payment-out.log',
      error_file: '/app/logs/payment-error.log',
      
      // Critical service - immediate restart
      wait_ready: true,
      listen_timeout: 15000,
      
      // Security for payment service
      node_args: [
        '--max-old-space-size=256',
        '--expose-gc'
      ]
    },
    
    // Real-time notification service
    {
      name: 'commerce-notifications',
      script: './dist/services/notification-service.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'notifications',
        TZ: 'Asia/Seoul'
      },
      
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '20s',
      max_memory_restart: '256M',
      
      log_file: '/app/logs/notifications-combined.log',
      out_file: '/app/logs/notifications-out.log',
      error_file: '/app/logs/notifications-error.log'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server-1', 'production-server-2'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/commerce-core.git',
      path: '/var/www/commerce-core',
      
      // Pre-deployment
      'pre-setup': 'mkdir -p /var/www/commerce-core',
      'pre-deploy-local': 'echo "Pre-deployment checks..."',
      'pre-deploy': 'git reset --hard && git clean -fd',
      
      // Post-deployment
      'post-deploy': [
        'npm ci --production',
        'npm run build',
        './database/scripts/migrate.sh up',
        'pm2 reload ecosystem.config.js --env korean_production',
        './scripts/post-deploy-health-check.sh'
      ].join(' && '),
      
      // Post-setup (first deployment)
      'post-setup': [
        'npm ci --production',
        'npm run build',
        './database/scripts/migrate.sh up',
        'pm2 start ecosystem.config.js --env korean_production'
      ].join(' && '),
      
      // Environment
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Seoul'
      }
    },
    
    staging: {
      user: 'deploy',
      host: 'staging-server',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/commerce-core.git',
      path: '/var/www/commerce-core-staging',
      
      'pre-deploy': 'git reset --hard && git clean -fd',
      'post-deploy': [
        'npm ci',
        'npm run build',
        './database/scripts/migrate.sh up',
        'pm2 reload ecosystem.config.js --env staging'
      ].join(' && '),
      
      env: {
        NODE_ENV: 'staging',
        TZ: 'Asia/Seoul'
      }
    }
  }
};