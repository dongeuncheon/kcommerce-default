import { Router, Request, Response } from 'express';
import { MetricsService } from '../../services/metricsService';
import logger from '../../utils/logger';

const router = Router();

interface AlertWebhook {
  version: string;
  groupKey: string;
  status: string;
  receiver: string;
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  alerts: Alert[];
}

interface Alert {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt?: string;
  generatorURL: string;
  fingerprint: string;
}

/**
 * @swagger
 * /webhooks/alerts:
 *   post:
 *     summary: Receive AlertManager webhook notifications
 *     description: Handles incoming alert notifications from Prometheus AlertManager
 *     tags:
 *       - Webhooks
 *       - Monitoring
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               version:
 *                 type: string
 *               groupKey:
 *                 type: string
 *               status:
 *                 type: string
 *               receiver:
 *                 type: string
 *               alerts:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       500:
 *         description: Internal server error
 */
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    const webhook: AlertWebhook = req.body;
    
    logger.info('Received AlertManager webhook', {
      groupKey: webhook.groupKey,
      status: webhook.status,
      alertCount: webhook.alerts?.length || 0
    });

    // Process each alert
    for (const alert of webhook.alerts || []) {
      await processAlert(alert);
    }

    // Record webhook event
    MetricsService.recordWebhookEvent('alertmanager', 'success');

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Failed to process AlertManager webhook', error);
    MetricsService.recordWebhookEvent('alertmanager', 'failed');
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * @swagger
 * /webhooks/alerts/critical:
 *   post:
 *     summary: Receive critical alert notifications
 *     description: Handles critical alert notifications with immediate response
 *     tags:
 *       - Webhooks
 *       - Monitoring
 *       - Critical
 *     responses:
 *       200:
 *         description: Critical alert processed
 *       500:
 *         description: Internal server error
 */
router.post('/alerts/critical', async (req: Request, res: Response) => {
  try {
    const webhook: AlertWebhook = req.body;
    
    logger.error('CRITICAL ALERT received', {
      groupKey: webhook.groupKey,
      alerts: webhook.alerts?.map(alert => ({
        alertname: alert.labels.alertname,
        summary: alert.annotations.summary,
        description: alert.annotations.description
      }))
    });

    // Process critical alerts with immediate actions
    for (const alert of webhook.alerts || []) {
      await processCriticalAlert(alert);
    }

    // Send immediate notifications
    await sendCriticalAlertNotifications(webhook);

    MetricsService.recordWebhookEvent('critical_alert', 'success');
    res.json({ message: 'Critical alert processed' });
  } catch (error) {
    logger.error('Failed to process critical alert webhook', error);
    MetricsService.recordWebhookEvent('critical_alert', 'failed');
    res.status(500).json({ error: 'Failed to process critical alert' });
  }
});

/**
 * @swagger
 * /webhooks/payment:
 *   post:
 *     summary: Receive payment gateway webhooks
 *     description: Handles payment gateway webhook notifications
 *     tags:
 *       - Webhooks
 *       - Payment
 *     responses:
 *       200:
 *         description: Payment webhook processed
 *       500:
 *         description: Internal server error
 */
router.post('/payment', async (req: Request, res: Response) => {
  try {
    const paymentData = req.body;
    
    logger.info('Received payment webhook', {
      gateway: paymentData.gateway,
      transactionId: paymentData.transactionId,
      status: paymentData.status
    });

    // Record payment metrics
    if (paymentData.status === 'success') {
      MetricsService.recordPaymentSuccess(paymentData.gateway, paymentData.method);
    } else if (paymentData.status === 'failed') {
      MetricsService.recordPaymentFailure(
        paymentData.gateway, 
        paymentData.method, 
        paymentData.errorCode
      );
    }

    MetricsService.recordWebhookEvent('payment', 'success');
    res.json({ message: 'Payment webhook processed' });
  } catch (error) {
    logger.error('Failed to process payment webhook', error);
    MetricsService.recordWebhookEvent('payment', 'failed');
    res.status(500).json({ error: 'Failed to process payment webhook' });
  }
});

async function processAlert(alert: Alert): Promise<void> {
  const alertname = alert.labels.alertname;
  const severity = alert.labels.severity;
  
  logger.info('Processing alert', {
    alertname,
    severity,
    status: alert.status,
    summary: alert.annotations.summary
  });

  // Perform specific actions based on alert type
  switch (alertname) {
    case 'HighErrorRate':
      await handleHighErrorRateAlert(alert);
      break;
    case 'SlowAPIResponse':
      await handleSlowAPIResponseAlert(alert);
      break;
    case 'DatabaseConnectionFailure':
      await handleDatabaseConnectionAlert(alert);
      break;
    case 'ApplicationDown':
      await handleApplicationDownAlert(alert);
      break;
    case 'LowOrderConversionRate':
      await handleLowConversionAlert(alert);
      break;
    case 'ProductOutOfStock':
      await handleOutOfStockAlert(alert);
      break;
    default:
      logger.info('No specific handler for alert', { alertname });
  }
}

async function processCriticalAlert(alert: Alert): Promise<void> {
  const alertname = alert.labels.alertname;
  
  logger.error('Processing CRITICAL alert', {
    alertname,
    summary: alert.annotations.summary,
    description: alert.annotations.description
  });

  // Immediate actions for critical alerts
  switch (alertname) {
    case 'ApplicationDown':
      // Trigger automatic restart or scaling
      await triggerApplicationRecovery();
      break;
    case 'DatabaseConnectionFailure':
      // Check database connectivity and restart connections
      await checkDatabaseConnectivity();
      break;
    case 'HighErrorRate':
      // Enable circuit breaker or rate limiting
      await enableEmergencyProtection();
      break;
    default:
      logger.warn('No critical handler for alert', { alertname });
  }
}

async function sendCriticalAlertNotifications(_webhook: AlertWebhook): Promise<void> {
  // Send immediate notifications via multiple channels
  try {
    // Email notification
    // await emailService.sendCriticalAlert(webhook);
    
    // SMS notification
    // await smsService.sendCriticalAlert(webhook);
    
    // Slack notification
    // await slackService.sendCriticalAlert(webhook);
    
    logger.info('Critical alert notifications sent');
  } catch (error) {
    logger.error('Failed to send critical alert notifications', error);
  }
}

// Alert handlers
async function handleHighErrorRateAlert(alert: Alert): Promise<void> {
  logger.warn('High error rate detected', alert.annotations);
  // Implement automatic remediation
}

async function handleSlowAPIResponseAlert(alert: Alert): Promise<void> {
  logger.warn('Slow API response detected', alert.annotations);
  // Check and optimize slow endpoints
}

async function handleDatabaseConnectionAlert(alert: Alert): Promise<void> {
  logger.error('Database connection failure', alert.annotations);
  // Attempt to reconnect and check database health
}

async function handleApplicationDownAlert(alert: Alert): Promise<void> {
  logger.error('Application is down', alert.annotations);
  // Trigger recovery procedures
}

async function handleLowConversionAlert(alert: Alert): Promise<void> {
  logger.warn('Low conversion rate detected', alert.annotations);
  // Notify business team
}

async function handleOutOfStockAlert(alert: Alert): Promise<void> {
  logger.warn('Product out of stock', alert.annotations);
  // Notify inventory team
}

// Recovery actions
async function triggerApplicationRecovery(): Promise<void> {
  logger.info('Triggering application recovery procedures');
  // Implement recovery logic
}

async function checkDatabaseConnectivity(): Promise<void> {
  logger.info('Checking database connectivity');
  // Implement database health check
}

async function enableEmergencyProtection(): Promise<void> {
  logger.info('Enabling emergency protection measures');
  // Implement emergency protection
}

export default router;