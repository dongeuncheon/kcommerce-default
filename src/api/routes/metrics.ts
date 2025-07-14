import { Router, Request, Response } from 'express';
import { MetricsService, register } from '../../services/metricsService';

const router = Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     description: Returns all application metrics in Prometheus format
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: Metrics data in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /metrics/business:
 *   get:
 *     summary: Get business metrics
 *     description: Returns business-specific metrics in Prometheus format
 *     tags:
 *       - Monitoring
 *       - Business
 *     responses:
 *       200:
 *         description: Business metrics data in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 */
router.get('/business', async (_req: Request, res: Response) => {
  try {
    const businessMetrics = await MetricsService.getBusinessMetrics();
    res.set('Content-Type', register.contentType);
    res.end(businessMetrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get business metrics' });
  }
});

/**
 * @swagger
 * /metrics/health:
 *   get:
 *     summary: Get health metrics
 *     description: Returns application health metrics
 *     tags:
 *       - Monitoring
 *       - Health
 *     responses:
 *       200:
 *         description: Health metrics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Application uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                     percentage:
 *                       type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     connectionCount:
 *                       type: number
 *                 redis:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     connectionCount:
 *                       type: number
 *       500:
 *         description: Internal server error
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      },
      database: {
        status: 'connected', // This should be checked from actual DB connection
        connectionCount: 0   // This should be retrieved from connection pool
      },
      redis: {
        status: 'connected', // This should be checked from actual Redis connection
        connectionCount: 0   // This should be retrieved from Redis client
      }
    };

    res.json(healthData);
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Failed to get health metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /metrics/reset:
 *   post:
 *     summary: Reset metrics (development only)
 *     description: Resets all metrics counters and gauges
 *     tags:
 *       - Monitoring
 *       - Development
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Metrics reset successfully
 *       403:
 *         description: Not allowed in production
 *       500:
 *         description: Internal server error
 */
router.post('/reset', async (_req: Request, res: Response) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Metrics reset not allowed in production' });
    }

    register.clear();
    return res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

export default router;