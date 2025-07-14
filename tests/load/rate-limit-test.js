/**
 * Load Testing Script for Rate Limiting and Error Handling
 * 
 * This script tests the API rate limiting system under various load conditions
 * Run with: node tests/load/rate-limit-test.js
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.concurrency = options.concurrency || 10;
    this.duration = options.duration || 60000; // 60 seconds
    this.endpoints = options.endpoints || ['/api/products', '/api/health'];
    this.userTiers = options.userTiers || ['basic', 'premium', 'enterprise'];
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      rateLimited: 0,
      responseTimeSum: 0,
      responseTimeMin: Infinity,
      responseTimeMax: 0,
      statusCodes: {},
      errorTypes: {},
      rateLimitTiers: {}
    };
    this.isRunning = false;
  }

  /**
   * Make HTTP request with metrics tracking
   */
  async makeRequest(endpoint, userTier = 'basic', apiKey = null) {
    return new Promise((resolve) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': `LoadTester/1.0 (tier=${userTier})`,
          'X-API-Version': 'v1',
          'Accept': 'application/json'
        }
      };

      if (apiKey) {
        options.headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (userTier !== 'basic') {
        options.headers['X-User-Tier'] = userTier;
      }

      const startTime = performance.now();
      this.metrics.requests++;

      const req = client.request(options, (res) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          this.metrics.responses++;
          this.metrics.responseTimeSum += responseTime;
          this.metrics.responseTimeMin = Math.min(this.metrics.responseTimeMin, responseTime);
          this.metrics.responseTimeMax = Math.max(this.metrics.responseTimeMax, responseTime);
          
          // Track status codes
          const statusCode = res.statusCode;
          this.metrics.statusCodes[statusCode] = (this.metrics.statusCodes[statusCode] || 0) + 1;
          
          // Track rate limiting
          if (statusCode === 429) {
            this.metrics.rateLimited++;
            this.metrics.rateLimitTiers[userTier] = (this.metrics.rateLimitTiers[userTier] || 0) + 1;
          }
          
          // Track errors
          if (statusCode >= 400) {
            this.metrics.errors++;
            
            try {
              const errorData = JSON.parse(body);
              const errorType = errorData.error?.type || 'Unknown';
              this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;
            } catch (e) {
              this.metrics.errorTypes['ParseError'] = (this.metrics.errorTypes['ParseError'] || 0) + 1;
            }
          }
          
          resolve({
            statusCode,
            responseTime,
            headers: res.headers,
            body: body.substring(0, 200), // First 200 chars for debugging
            userTier,
            endpoint
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.metrics.responses++;
        this.metrics.errors++;
        this.metrics.errorTypes['NetworkError'] = (this.metrics.errorTypes['NetworkError'] || 0) + 1;
        
        resolve({
          error: error.message,
          responseTime,
          userTier,
          endpoint
        });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        this.metrics.errorTypes['Timeout'] = (this.metrics.errorTypes['Timeout'] || 0) + 1;
      });

      req.end();
    });
  }

  /**
   * Generate concurrent load for specified duration
   */
  async runLoadTest() {
    console.log(`Starting load test...`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}ms`);
    console.log(`Endpoints: ${this.endpoints.join(', ')}`);
    console.log(`User Tiers: ${this.userTiers.join(', ')}`);
    console.log('---');

    this.isRunning = true;
    const startTime = Date.now();
    
    // Start concurrent workers
    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker(i));
    }

    // Stop after duration
    setTimeout(() => {
      this.isRunning = false;
    }, this.duration);

    // Wait for all workers to complete
    await Promise.all(workers);

    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    this.printResults(actualDuration);
  }

  /**
   * Worker function that continuously makes requests
   */
  async worker(workerId) {
    while (this.isRunning) {
      try {
        // Random endpoint and user tier
        const endpoint = this.endpoints[Math.floor(Math.random() * this.endpoints.length)];
        const userTier = this.userTiers[Math.floor(Math.random() * this.userTiers.length)];
        
        const result = await this.makeRequest(endpoint, userTier);
        
        // Log rate limiting events
        if (result.statusCode === 429) {
          console.log(`[RATE LIMITED] Worker ${workerId}: ${userTier} tier hit rate limit on ${endpoint}`);
        }
        
        // Log critical errors
        if (result.statusCode >= 500) {
          console.log(`[ERROR] Worker ${workerId}: ${result.statusCode} on ${endpoint}`);
        }
        
        // Small delay to prevent overwhelming
        await this.sleep(Math.random() * 100); // 0-100ms random delay
        
      } catch (error) {
        console.error(`Worker ${workerId} error:`, error.message);
        await this.sleep(1000); // Wait longer on error
      }
    }
  }

  /**
   * Print comprehensive test results
   */
  printResults(duration) {
    console.log('\n=== LOAD TEST RESULTS ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Requests: ${this.metrics.requests}`);
    console.log(`Total Responses: ${this.metrics.responses}`);
    console.log(`Success Rate: ${((this.metrics.responses - this.metrics.errors) / this.metrics.responses * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(this.metrics.errors / this.metrics.responses * 100).toFixed(2)}%`);
    console.log(`Rate Limited: ${this.metrics.rateLimited} (${(this.metrics.rateLimited / this.metrics.responses * 100).toFixed(2)}%)`);
    console.log(`Requests/sec: ${(this.metrics.requests / (duration / 1000)).toFixed(2)}`);
    
    // Response time statistics
    const avgResponseTime = this.metrics.responseTimeSum / this.metrics.responses;
    console.log('\n--- Response Time ---');
    console.log(`Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min: ${this.metrics.responseTimeMin.toFixed(2)}ms`);
    console.log(`Max: ${this.metrics.responseTimeMax.toFixed(2)}ms`);
    
    // Status code breakdown
    console.log('\n--- Status Codes ---');
    Object.entries(this.metrics.statusCodes)
      .sort(([a], [b]) => a - b)
      .forEach(([code, count]) => {
        const percentage = (count / this.metrics.responses * 100).toFixed(2);
        console.log(`${code}: ${count} (${percentage}%)`);
      });
    
    // Error type breakdown
    if (Object.keys(this.metrics.errorTypes).length > 0) {
      console.log('\n--- Error Types ---');
      Object.entries(this.metrics.errorTypes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = (count / this.metrics.errors * 100).toFixed(2);
          console.log(`${type}: ${count} (${percentage}%)`);
        });
    }
    
    // Rate limit by tier
    if (Object.keys(this.metrics.rateLimitTiers).length > 0) {
      console.log('\n--- Rate Limits by Tier ---');
      Object.entries(this.metrics.rateLimitTiers)
        .sort(([,a], [,b]) => b - a)
        .forEach(([tier, count]) => {
          console.log(`${tier}: ${count} rate limits`);
        });
    }
  }

  /**
   * Test rate limiting thresholds for different user tiers
   */
  async testRateLimitThresholds() {
    console.log('\n=== TESTING RATE LIMIT THRESHOLDS ===');
    
    for (const tier of this.userTiers) {
      console.log(`\nTesting ${tier} tier...`);
      
      const requests = [];
      const maxRequests = 150; // Exceed all tier limits
      
      for (let i = 0; i < maxRequests; i++) {
        requests.push(this.makeRequest('/api/health', tier));
      }
      
      const results = await Promise.all(requests);
      
      const successCount = results.filter(r => r.statusCode === 200).length;
      const rateLimitCount = results.filter(r => r.statusCode === 429).length;
      
      console.log(`${tier} tier results:`);
      console.log(`  Successful requests: ${successCount}`);
      console.log(`  Rate limited: ${rateLimitCount}`);
      console.log(`  Rate limit threshold: ~${successCount}`);
      
      // Wait before testing next tier
      await this.sleep(2000);
    }
  }

  /**
   * Test circuit breaker functionality
   */
  async testCircuitBreaker() {
    console.log('\n=== TESTING CIRCUIT BREAKER ===');
    
    // Make requests to an endpoint that might trigger circuit breaker
    const results = [];
    for (let i = 0; i < 20; i++) {
      const result = await this.makeRequest('/api/health/database');
      results.push(result);
      
      if (result.statusCode === 503) {
        console.log(`Circuit breaker opened after ${i + 1} requests`);
        break;
      }
      
      // Small delay
      await this.sleep(100);
    }
    
    const serviceUnavailable = results.filter(r => r.statusCode === 503).length;
    console.log(`Service unavailable responses: ${serviceUnavailable}`);
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Test configurations
const testConfigs = {
  light: {
    concurrency: 5,
    duration: 30000, // 30 seconds
    userTiers: ['basic', 'premium']
  },
  
  moderate: {
    concurrency: 10,
    duration: 60000, // 60 seconds
    userTiers: ['basic', 'premium', 'enterprise']
  },
  
  heavy: {
    concurrency: 25,
    duration: 120000, // 2 minutes
    userTiers: ['basic', 'premium', 'enterprise']
  },
  
  stress: {
    concurrency: 50,
    duration: 300000, // 5 minutes
    userTiers: ['basic', 'premium', 'enterprise']
  }
};

// Main execution
async function main() {
  const testType = process.argv[2] || 'moderate';
  const baseUrl = process.argv[3] || 'http://localhost:3000';
  
  if (!testConfigs[testType]) {
    console.error(`Unknown test type: ${testType}`);
    console.error(`Available types: ${Object.keys(testConfigs).join(', ')}`);
    process.exit(1);
  }
  
  const config = {
    baseUrl,
    endpoints: [
      '/api/health',
      '/api/products',
      '/api/categories',
      '/api/health/performance'
    ],
    ...testConfigs[testType]
  };
  
  const tester = new LoadTester(config);
  
  try {
    console.log(`Running ${testType} load test against ${baseUrl}`);
    
    // Run main load test
    await tester.runLoadTest();
    
    // Additional specific tests
    console.log('\nRunning additional tests...');
    await tester.testRateLimitThresholds();
    await tester.testCircuitBreaker();
    
    console.log('\n=== ALL TESTS COMPLETED ===');
    
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LoadTester };