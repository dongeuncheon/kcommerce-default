module.exports = {
  apps: [
    {
      name: 'commerce-api',
      script: './dist/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Instance-specific environment variables
      instance_var: 'INSTANCE_ID',
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      
      // Process management
      max_memory_restart: '1G',
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Monitoring
      max_restarts: 10,
      restart_delay: 5000,
      
      // Graceful reload
      wait_ready: true,
      stop_exit_codes: [0],
      
      // Auto restart
      autorestart: true,
      watch: false,
      
      // Node.js arguments
      node_args: '--max-old-space-size=2048',
      
      // Cluster mode specific
      instances_var: 'INSTANCE_ID',
      
      // Health check
      health_check: {
        interval: 30000,
        path: '/health',
        port: 3000,
      },
    },
    {
      name: 'commerce-worker',
      script: './dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
      },
      
      // Separate logs for workers
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      
      // Different memory limit for workers
      max_memory_restart: '512M',
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com', 'server3.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/commerce-plugin.git',
      path: '/var/www/commerce',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up deployment environment..."',
      env: {
        NODE_ENV: 'production',
      },
    },
    staging: {
      user: 'deploy',
      host: 'staging.example.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/commerce-plugin.git',
      path: '/var/www/commerce-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
}