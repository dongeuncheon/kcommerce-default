import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'

export interface NotificationTemplate {
  id: string
  type: NotificationType
  subject: string
  bodyTemplate: string
  isActive: boolean
}

export type NotificationType =
  | 'LOW_STOCK_ALERT'
  | 'OUT_OF_STOCK_ALERT'
  | 'CRITICAL_STOCK_ALERT'
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT_SUCCESS'
  | 'INVENTORY_ADJUSTMENT'

export interface NotificationData {
  type: NotificationType
  recipients: string[]
  data: Record<string, any>
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  channel: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'IN_APP'
}

export interface LowStockAlertData {
  productId: string
  productName: string
  productSku: string
  currentQuantity: number
  lowStockThreshold: number
  categoryName?: string
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL_STOCK'
}

export class NotificationService {
  private templates: Map<NotificationType, NotificationTemplate> = new Map()

  constructor() {
    this.initializeDefaultTemplates()
  }

  // Initialize default notification templates
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'low-stock-alert',
        type: 'LOW_STOCK_ALERT',
        subject: 'Low Stock Alert: {{productName}}',
        bodyTemplate: `
          <h2>Low Stock Alert</h2>
          <p>Product <strong>{{productName}}</strong> (SKU: {{productSku}}) is running low on stock.</p>
          <ul>
            <li>Current Quantity: {{currentQuantity}}</li>
            <li>Low Stock Threshold: {{lowStockThreshold}}</li>
            <li>Category: {{categoryName}}</li>
          </ul>
          <p>Please consider restocking this item to avoid stockouts.</p>
        `,
        isActive: true,
      },
      {
        id: 'out-of-stock-alert',
        type: 'OUT_OF_STOCK_ALERT',
        subject: 'URGENT: Out of Stock - {{productName}}',
        bodyTemplate: `
          <h2>🚨 Out of Stock Alert</h2>
          <p>Product <strong>{{productName}}</strong> (SKU: {{productSku}}) is completely out of stock.</p>
          <ul>
            <li>Current Quantity: 0</li>
            <li>Category: {{categoryName}}</li>
          </ul>
          <p><strong>Immediate action required:</strong> This product needs to be restocked immediately to prevent lost sales.</p>
        `,
        isActive: true,
      },
      {
        id: 'critical-stock-alert',
        type: 'CRITICAL_STOCK_ALERT',
        subject: 'CRITICAL: Very Low Stock - {{productName}}',
        bodyTemplate: `
          <h2>⚠️ Critical Stock Alert</h2>
          <p>Product <strong>{{productName}}</strong> (SKU: {{productSku}}) has critically low stock levels.</p>
          <ul>
            <li>Current Quantity: {{currentQuantity}}</li>
            <li>Low Stock Threshold: {{lowStockThreshold}}</li>
            <li>Category: {{categoryName}}</li>
          </ul>
          <p><strong>Urgent action needed:</strong> Stock level is below 50% of the low stock threshold.</p>
        `,
        isActive: true,
      },
    ]

    defaultTemplates.forEach(template => {
      this.templates.set(template.type, template)
    })
  }

  // Send low stock alert notification
  async sendLowStockAlert(alertData: LowStockAlertData): Promise<void> {
    try {
      const notificationType = this.mapAlertTypeToNotification(alertData.alertType)
      const priority = this.mapAlertTypeToPriority(alertData.alertType)

      // Get admin users who should receive inventory alerts
      const adminRecipients = await this.getAdminRecipients('INVENTORY_ALERTS')

      if (adminRecipients.length === 0) {
        logger.warn('No admin recipients configured for inventory alerts')
        return
      }

      const notificationData: NotificationData = {
        type: notificationType,
        recipients: adminRecipients,
        data: {
          ...alertData,
          categoryName: alertData.categoryName || 'Uncategorized',
        },
        priority,
        channel: 'EMAIL',
      }

      await this.sendNotification(notificationData)

      logger.info(`Low stock alert sent for product ${alertData.productSku}: ${alertData.alertType}`)
    } catch (error) {
      logger.error('Failed to send low stock alert:', error)
      // Don't throw error to avoid breaking the main inventory operation
    }
  }

  // Send general notification
  async sendNotification(notification: NotificationData): Promise<void> {
    try {
      const template = this.templates.get(notification.type)

      if (!template || !template.isActive) {
        logger.warn(`No active template found for notification type: ${notification.type}`)
        return
      }

      const processedSubject = this.processTemplate(template.subject, notification.data)
      const processedBody = this.processTemplate(template.bodyTemplate, notification.data)

      // Send notification based on channel
      switch (notification.channel) {
      case 'EMAIL':
        await this.sendEmailNotification({
          recipients: notification.recipients,
          subject: processedSubject,
          body: processedBody,
          priority: notification.priority,
        })
        break
      case 'SMS':
        await this.sendSMSNotification({
          recipients: notification.recipients,
          message: processedSubject, // Use subject as SMS message
          priority: notification.priority,
        })
        break
      case 'WEBHOOK':
        await this.sendWebhookNotification({
          data: notification.data,
          type: notification.type,
          priority: notification.priority,
        })
        break
      case 'IN_APP':
        await this.createInAppNotification({
          recipients: notification.recipients,
          title: processedSubject,
          message: processedBody,
          type: notification.type,
          priority: notification.priority,
        })
        break
      default:
        logger.warn(`Unsupported notification channel: ${notification.channel}`)
      }

      logger.info(`Notification sent: ${notification.type} to ${notification.recipients.length} recipients`)
    } catch (error) {
      logger.error('Failed to send notification:', error)
      throw new AppError('Failed to send notification', 500)
    }
  }

  // Process template with data substitution
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template

    // Replace template variables like {{variableName}}
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`
      const value = data[key]?.toString() || ''
      processed = processed.replace(new RegExp(placeholder, 'g'), value)
    })

    return processed
  }

  // Send email notification (placeholder implementation)
  private async sendEmailNotification(emailData: {
    recipients: string[]
    subject: string
    body: string
    priority: string
  }): Promise<void> {
    try {
      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      logger.info('Email notification would be sent:', {
        to: emailData.recipients,
        subject: emailData.subject,
        priority: emailData.priority,
      })

      // Placeholder for actual email sending
      // await emailService.send({
      //   to: emailData.recipients,
      //   subject: emailData.subject,
      //   html: emailData.body,
      //   priority: emailData.priority
      // })

    } catch (error) {
      logger.error('Failed to send email notification:', error)
      throw error
    }
  }

  // Send SMS notification (placeholder implementation)
  private async sendSMSNotification(smsData: {
    recipients: string[]
    message: string
    priority: string
  }): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      logger.info('SMS notification would be sent:', {
        to: smsData.recipients,
        message: smsData.message,
        priority: smsData.priority,
      })

    } catch (error) {
      logger.error('Failed to send SMS notification:', error)
      throw error
    }
  }

  // Send webhook notification
  private async sendWebhookNotification(webhookData: {
    data: Record<string, any>
    type: NotificationType
    priority: string
  }): Promise<void> {
    try {
      const webhookUrl = process.env.INVENTORY_WEBHOOK_URL

      if (!webhookUrl) {
        logger.warn('No webhook URL configured for inventory notifications')
        return
      }

      // TODO: Make HTTP request to webhook URL
      logger.info('Webhook notification would be sent:', {
        url: webhookUrl,
        type: webhookData.type,
        priority: webhookData.priority,
      })

    } catch (error) {
      logger.error('Failed to send webhook notification:', error)
      throw error
    }
  }

  // Create in-app notification (placeholder implementation)
  private async createInAppNotification(notificationData: {
    recipients: string[]
    title: string
    message: string
    type: NotificationType
    priority: string
  }): Promise<void> {
    try {
      // TODO: Store in database for in-app notifications
      logger.info('In-app notification would be created:', {
        recipients: notificationData.recipients,
        title: notificationData.title,
        type: notificationData.type,
      })

    } catch (error) {
      logger.error('Failed to create in-app notification:', error)
      throw error
    }
  }

  // Get admin recipients for specific notification type
  private async getAdminRecipients(_alertType: string): Promise<string[]> {
    try {
      // TODO: Query database for admin users with inventory alert preferences
      // This is a placeholder implementation
      const adminEmails = process.env.ADMIN_EMAIL_ADDRESSES?.split(',') || []

      if (adminEmails.length === 0) {
        logger.warn('No admin email addresses configured')
      }

      return adminEmails.filter(email => email.trim())
    } catch (error) {
      logger.error('Failed to get admin recipients:', error)
      return []
    }
  }

  // Map alert type to notification type
  private mapAlertTypeToNotification(alertType: string): NotificationType {
    switch (alertType) {
    case 'LOW_STOCK':
      return 'LOW_STOCK_ALERT'
    case 'OUT_OF_STOCK':
      return 'OUT_OF_STOCK_ALERT'
    case 'CRITICAL_STOCK':
      return 'CRITICAL_STOCK_ALERT'
    default:
      return 'LOW_STOCK_ALERT'
    }
  }

  // Map alert type to priority
  private mapAlertTypeToPriority(alertType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (alertType) {
    case 'LOW_STOCK':
      return 'MEDIUM'
    case 'OUT_OF_STOCK':
      return 'CRITICAL'
    case 'CRITICAL_STOCK':
      return 'HIGH'
    default:
      return 'MEDIUM'
    }
  }

  // Test notification system
  async testNotification(type: NotificationType, testEmail: string): Promise<void> {
    const testData: NotificationData = {
      type,
      recipients: [testEmail],
      data: {
        productName: 'Test Product',
        productSku: 'TEST-001',
        currentQuantity: 2,
        lowStockThreshold: 10,
        categoryName: 'Test Category',
      },
      priority: 'LOW',
      channel: 'EMAIL',
    }

    await this.sendNotification(testData)
    logger.info(`Test notification sent to ${testEmail}`)
  }
}

export const notificationService = new NotificationService()
