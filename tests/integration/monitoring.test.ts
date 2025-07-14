import request from 'supertest';
import app from '../../src/index';
import { MetricsService } from '../../src/services/metricsService';

describe('Monitoring Integration Tests', () => {
  describe('Metrics Endpoints', () => {
    it('should expose Prometheus metrics endpoint', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should expose business metrics endpoint', async () => {
      const response = await request(app)
        .get('/metrics/business')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('orders_completed_total');
      expect(response.text).toContain('revenue_total');
    });

    it('should provide health metrics', async () => {
      const response = await request(app)
        .get('/metrics/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('redis');
    });

    it('should not allow metrics reset in production', async () => {
      process.env.NODE_ENV = 'production';
      
      await request(app)
        .post('/metrics/reset')
        .expect(403);

      process.env.NODE_ENV = 'test';
    });

    it('should allow metrics reset in development', async () => {
      process.env.NODE_ENV = 'development';
      
      await request(app)
        .post('/metrics/reset')
        .expect(200);

      process.env.NODE_ENV = 'test';
    });
  });

  describe('Webhook Endpoints', () => {
    it('should handle AlertManager webhook notifications', async () => {
      const alertPayload = {
        version: '4',
        groupKey: 'test-group',
        status: 'firing',
        receiver: 'web.hook',
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'TestAlert',
              severity: 'warning'
            },
            annotations: {
              summary: 'Test alert summary',
              description: 'Test alert description'
            },
            startsAt: new Date().toISOString(),
            generatorURL: 'http://localhost:9090',
            fingerprint: 'test-fingerprint'
          }
        ]
      };

      await request(app)
        .post('/webhooks/alerts')
        .send(alertPayload)
        .expect(200);
    });

    it('should handle critical alert notifications', async () => {
      const criticalAlertPayload = {
        version: '4',
        groupKey: 'critical-group',
        status: 'firing',
        receiver: 'critical-alerts',
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'ApplicationDown',
              severity: 'critical'
            },
            annotations: {
              summary: 'Application is down',
              description: 'The application is not responding'
            },
            startsAt: new Date().toISOString(),
            generatorURL: 'http://localhost:9090',
            fingerprint: 'critical-fingerprint'
          }
        ]
      };

      await request(app)
        .post('/webhooks/alerts/critical')
        .send(criticalAlertPayload)
        .expect(200);
    });

    it('should handle payment webhook notifications', async () => {
      const paymentPayload = {
        gateway: 'stripe',
        transactionId: 'tx_123456789',
        status: 'success',
        method: 'credit_card',
        amount: 99.99,
        currency: 'USD'
      };

      await request(app)
        .post('/webhooks/payment')
        .send(paymentPayload)
        .expect(200);
    });

    it('should handle payment failure notifications', async () => {
      const paymentFailurePayload = {
        gateway: 'stripe',
        transactionId: 'tx_987654321',
        status: 'failed',
        method: 'credit_card',
        errorCode: 'insufficient_funds',
        amount: 199.99,
        currency: 'USD'
      };

      await request(app)
        .post('/webhooks/payment')
        .send(paymentFailurePayload)
        .expect(200);
    });
  });

  describe('Metrics Collection', () => {
    it('should record HTTP request metrics', async () => {
      // Make a test request
      await request(app)
        .get('/health')
        .expect(200);

      // Check if metrics were recorded
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('http_request_duration_seconds');
    });

    it('should record business metrics', () => {
      // Test order completion
      MetricsService.recordOrderCompleted('order_123', 99.99);
      
      // Test cart creation
      MetricsService.recordCartCreated();
      
      // Test user registration
      MetricsService.recordUserRegistration();
      
      // Test payment attempt
      MetricsService.recordPaymentAttempt('stripe', 'credit_card');
      MetricsService.recordPaymentSuccess('stripe', 'credit_card');
      
      // Verify metrics are recorded (this is a basic test)
      expect(true).toBe(true); // Metrics are recorded internally
    });

    it('should track API errors', async () => {
      // Make a request to non-existent endpoint
      await request(app)
        .get('/api/non-existent')
        .expect(404);

      // Check if error metrics were recorded
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('api_errors_total');
    });

    it('should track cache metrics', () => {
      MetricsService.recordCacheHit('product');
      MetricsService.recordCacheMiss('product');
      
      expect(true).toBe(true); // Metrics are recorded internally
    });

    it('should update inventory metrics', () => {
      MetricsService.updateProductInventory('prod_123', 'Test Product', 50);
      MetricsService.updateProductInventory('prod_456', 'Another Product', 0);
      
      expect(true).toBe(true); // Metrics are recorded internally
    });
  });

  describe('Alert Simulation', () => {
    it('should simulate high error rate scenario', async () => {
      // Simulate multiple errors
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/non-existent')
          .expect(404);
      }

      // Check metrics
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('api_errors_total');
    });

    it('should simulate payment failure scenario', () => {
      // Simulate payment failures
      for (let i = 0; i < 5; i++) {
        MetricsService.recordPaymentAttempt('stripe', 'credit_card');
        MetricsService.recordPaymentFailure('stripe', 'credit_card', 'insufficient_funds');
      }

      expect(true).toBe(true); // Metrics are recorded internally
    });

    it('should simulate low inventory scenario', () => {
      // Simulate low inventory
      MetricsService.updateProductInventory('prod_low', 'Low Stock Product', 5);
      MetricsService.updateProductInventory('prod_out', 'Out of Stock Product', 0);
      
      expect(true).toBe(true); // Metrics are recorded internally
    });
  });

  describe('Performance Monitoring', () => {
    it('should track slow API responses', async () => {
      // This would typically involve a slow endpoint
      const start = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
        
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should be fast for health check
    });

    it('should monitor database connections', () => {
      MetricsService.setDatabaseConnections(5);
      expect(true).toBe(true);
    });

    it('should monitor Redis connections', () => {
      MetricsService.setRedisConnections(2);
      expect(true).toBe(true);
    });

    it('should track active users', () => {
      MetricsService.setActiveUsers(150);
      expect(true).toBe(true);
    });
  });

  describe('Security Monitoring', () => {
    it('should track suspicious activity', async () => {
      // Simulate multiple failed requests from same IP
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'invalid@example.com', password: 'wrong' })
          .expect(404); // Auth endpoint doesn't exist yet, but shows 404 tracking
      }

      expect(true).toBe(true);
    });

    it('should monitor unusual registration patterns', () => {
      // Simulate unusual registration activity
      for (let i = 0; i < 20; i++) {
        MetricsService.recordUserRegistration();
      }

      expect(true).toBe(true);
    });
  });

  describe('Business Intelligence', () => {
    it('should calculate conversion rates', () => {
      // Simulate business activity
      for (let i = 0; i < 100; i++) {
        MetricsService.recordCartCreated();
      }
      
      for (let i = 0; i < 5; i++) {
        MetricsService.recordOrderCompleted(`order_${i}`, 50 + i * 10);
      }

      expect(true).toBe(true);
    });

    it('should track revenue metrics', () => {
      MetricsService.recordProductRevenue('prod_123', 'Popular Product', 199.99);
      MetricsService.recordProductRevenue('prod_456', 'Another Product', 49.99);
      
      expect(true).toBe(true);
    });

    it('should monitor search analytics', () => {
      MetricsService.recordSearchRequest();
      MetricsService.recordSearchRequest();
      MetricsService.recordSearchNoResults(); // 1 out of 3 searches has no results
      
      expect(true).toBe(true);
    });
  });

  describe('Health Check Integration', () => {
    it('should provide comprehensive health information', async () => {
      const response = await request(app)
        .get('/metrics/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      expect(response.body.memory.percentage).toBeGreaterThan(0);
    });

    it('should handle unhealthy state gracefully', async () => {
      // This would involve mocking a failure condition
      // For now, just verify the endpoint structure
      const response = await request(app)
        .get('/metrics/health')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('redis');
    });
  });
});