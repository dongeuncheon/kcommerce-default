import { AnalyticsRepository } from './analytics.repository';
import { LoggerService } from '../../core/services/logger.service';
import {
  AlertType,
  AlertSeverity,
  AlertData
} from './analytics.types';
import { AlertConfigEntity, AlertHistoryEntity } from './analytics.entity';

export interface AlertConfig {
  id?: string;
  alertType: AlertType;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: AlertSeverity;
  enabled: boolean;
  recipients: string[];
  cooldownPeriod: number; // minutes
  conditions?: AlertCondition[];
  actions?: AlertAction[];
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt';
  value: any;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'sms';
  config: Record<string, any>;
}

export interface AlertTrigger {
  configId: string;
  value: number;
  threshold: number;
  message: string;
  metadata?: Record<string, any>;
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  alertsByType: Record<AlertType, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  averageResolutionTime: number;
  topAlerts: Array<{
    type: AlertType;
    count: number;
    lastTriggered: Date;
  }>;
}

export class AlertService {
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  private readonly DEFAULT_COOLDOWN = 15; // 15 minutes

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly logger: LoggerService
  ) {}

  // ================== ALERT CONFIGURATION ==================

  async configureAlert(config: Omit<AlertConfig, 'id'>): Promise<string> {
    try {
      const alertConfig: AlertConfigEntity = {
        id: this.generateId(),
        alertType: config.alertType,
        metric: config.metric,
        threshold: config.threshold,
        operator: config.operator,
        severity: config.severity,
        enabled: config.enabled,
        recipients: config.recipients,
        cooldownPeriod: config.cooldownPeriod || this.DEFAULT_COOLDOWN,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // In real implementation, save to database
      // await this.repository.createAlertConfig(alertConfig);
      
      this.logger.info('Alert configured', { 
        id: alertConfig.id, 
        type: config.alertType,
        metric: config.metric 
      });

      return alertConfig.id;
      
    } catch (error) {
      this.logger.error('Failed to configure alert', { error, config });
      throw error;
    }
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    try {
      // In real implementation, update in database
      // await this.repository.updateAlertConfig(id, updates);
      
      this.logger.info('Alert config updated', { id, updates });
      
    } catch (error) {
      this.logger.error('Failed to update alert config', { error, id, updates });
      throw error;
    }
  }

  async deleteAlertConfig(id: string): Promise<void> {
    try {
      // In real implementation, delete from database
      // await this.repository.deleteAlertConfig(id);
      
      this.logger.info('Alert config deleted', { id });
      
    } catch (error) {
      this.logger.error('Failed to delete alert config', { error, id });
      throw error;
    }
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    try {
      // Mock alert configurations
      const configs: AlertConfig[] = [
        {
          id: 'alert_1',
          alertType: AlertType.LOW_INVENTORY,
          metric: 'inventory_level',
          threshold: 10,
          operator: 'lt',
          severity: AlertSeverity.MEDIUM,
          enabled: true,
          recipients: ['admin@example.com', 'inventory@example.com'],
          cooldownPeriod: 30
        },
        {
          id: 'alert_2',
          alertType: AlertType.HIGH_CART_ABANDONMENT,
          metric: 'cart_abandonment_rate',
          threshold: 0.75,
          operator: 'gt',
          severity: AlertSeverity.HIGH,
          enabled: true,
          recipients: ['marketing@example.com'],
          cooldownPeriod: 60
        },
        {
          id: 'alert_3',
          alertType: AlertType.PAYMENT_FAILURES,
          metric: 'payment_failure_rate',
          threshold: 0.1,
          operator: 'gt',
          severity: AlertSeverity.CRITICAL,
          enabled: true,
          recipients: ['tech@example.com', 'ceo@example.com'],
          cooldownPeriod: 15
        },
        {
          id: 'alert_4',
          alertType: AlertType.UNUSUAL_ACTIVITY,
          metric: 'hourly_order_count',
          threshold: 1000,
          operator: 'gt',
          severity: AlertSeverity.MEDIUM,
          enabled: true,
          recipients: ['security@example.com'],
          cooldownPeriod: 30
        }
      ];

      return configs.filter(config => config.enabled);
      
    } catch (error) {
      this.logger.error('Failed to get alert configs', { error });
      throw error;
    }
  }

  // ================== ALERT MONITORING ==================

  async startMonitoring(): Promise<void> {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }

      this.monitoringInterval = setInterval(async () => {
        try {
          await this.checkAllAlerts();
        } catch (error) {
          this.logger.error('Alert monitoring error', { error });
        }
      }, this.MONITORING_INTERVAL);

      this.logger.info('Alert monitoring started', { 
        interval: this.MONITORING_INTERVAL 
      });
      
    } catch (error) {
      this.logger.error('Failed to start alert monitoring', { error });
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.logger.info('Alert monitoring stopped');
      
    } catch (error) {
      this.logger.error('Failed to stop alert monitoring', { error });
    }
  }

  async checkAllAlerts(): Promise<void> {
    try {
      const configs = await this.getAlertConfigs();
      
      for (const config of configs) {
        try {
          await this.checkAlert(config);
        } catch (error) {
          this.logger.error('Failed to check individual alert', { 
            error, 
            alertId: config.id 
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to check all alerts', { error });
    }
  }

  async checkAlert(config: AlertConfig): Promise<void> {
    try {
      // Check cooldown period
      if (await this.isInCooldown(config.id!)) {
        return;
      }

      // Get current metric value
      const currentValue = await this.getMetricValue(config.metric);
      
      // Check if alert should trigger
      const shouldTrigger = this.evaluateAlertCondition(
        currentValue, 
        config.threshold, 
        config.operator
      );

      if (shouldTrigger) {
        await this.triggerAlert({
          configId: config.id!,
          value: currentValue,
          threshold: config.threshold,
          message: this.generateAlertMessage(config, currentValue)
        });
      }
      
    } catch (error) {
      this.logger.error('Failed to check alert', { error, config });
    }
  }

  // ================== ALERT TRIGGERING ==================

  async triggerAlert(trigger: AlertTrigger): Promise<string> {
    try {
      const config = await this.getAlertConfig(trigger.configId);
      if (!config) {
        throw new Error(`Alert config not found: ${trigger.configId}`);
      }

      const alertId = this.generateId();
      
      const alertHistory: AlertHistoryEntity = {
        id: alertId,
        alertConfigId: trigger.configId,
        alertType: config.alertType,
        severity: config.severity,
        message: trigger.message,
        triggeredAt: new Date(),
        value: trigger.value,
        threshold: trigger.threshold,
        metadata: trigger.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save alert to history
      // await this.repository.createAlertHistory(alertHistory);

      // Send notifications
      await this.sendAlertNotifications(config, alertHistory);

      // Update last triggered time
      await this.updateLastTriggered(trigger.configId);

      this.logger.warn('Alert triggered', {
        alertId,
        type: config.alertType,
        severity: config.severity,
        value: trigger.value,
        threshold: trigger.threshold
      });

      return alertId;
      
    } catch (error) {
      this.logger.error('Failed to trigger alert', { error, trigger });
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, userId?: string): Promise<void> {
    try {
      // In real implementation, update alert history
      // await this.repository.acknowledgeAlert(alertId, userId);
      
      this.logger.info('Alert acknowledged', { alertId, userId });
      
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { error, alertId, userId });
      throw error;
    }
  }

  async resolveAlert(alertId: string, userId?: string, resolution?: string): Promise<void> {
    try {
      // In real implementation, update alert history
      // await this.repository.resolveAlert(alertId, userId, resolution);
      
      this.logger.info('Alert resolved', { alertId, userId, resolution });
      
    } catch (error) {
      this.logger.error('Failed to resolve alert', { error, alertId, userId });
      throw error;
    }
  }

  // ================== ALERT RETRIEVAL ==================

  async getActiveAlerts(): Promise<AlertData[]> {
    try {
      // Mock active alerts
      const alerts: AlertData[] = [
        {
          id: 'alert_hist_1',
          type: AlertType.LOW_INVENTORY,
          severity: AlertSeverity.MEDIUM,
          message: '재고 부족 상품 5개 발견 (임계값: 10개 미만)',
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
          acknowledged: false
        },
        {
          id: 'alert_hist_2',
          type: AlertType.HIGH_CART_ABANDONMENT,
          severity: AlertSeverity.HIGH,
          message: '장바구니 이탈률 78% (임계값: 75% 초과)',
          timestamp: new Date(Date.now() - 600000), // 10 minutes ago
          acknowledged: false
        },
        {
          id: 'alert_hist_3',
          type: AlertType.PAYMENT_FAILURES,
          severity: AlertSeverity.CRITICAL,
          message: '결제 실패율 12% (임계값: 10% 초과)',
          timestamp: new Date(Date.now() - 900000), // 15 minutes ago
          acknowledged: true
        }
      ];

      return alerts;
      
    } catch (error) {
      this.logger.error('Failed to get active alerts', { error });
      throw error;
    }
  }

  async getAlertHistory(limit: number = 100, offset: number = 0): Promise<AlertData[]> {
    try {
      // In real implementation, fetch from database
      const alerts = await this.getActiveAlerts();
      
      // Add some historical alerts
      const historicalAlerts: AlertData[] = [
        {
          id: 'alert_hist_4',
          type: AlertType.UNUSUAL_ACTIVITY,
          severity: AlertSeverity.LOW,
          message: '비정상적인 트래픽 증가 감지',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          acknowledged: true
        },
        {
          id: 'alert_hist_5',
          type: AlertType.PERFORMANCE_ISSUE,
          severity: AlertSeverity.MEDIUM,
          message: 'API 응답 시간 지연',
          timestamp: new Date(Date.now() - 7200000), // 2 hours ago
          acknowledged: true
        }
      ];

      return [...alerts, ...historicalAlerts]
        .slice(offset, offset + limit);
      
    } catch (error) {
      this.logger.error('Failed to get alert history', { error, limit, offset });
      throw error;
    }
  }

  async getAlertStats(): Promise<AlertStats> {
    try {
      const alerts = await this.getAlertHistory(1000);
      
      const stats: AlertStats = {
        totalAlerts: alerts.length,
        activeAlerts: alerts.filter(a => !a.acknowledged).length,
        alertsByType: this.groupAlertsByType(alerts),
        alertsBySeverity: this.groupAlertsBySeverity(alerts),
        averageResolutionTime: 25.5, // minutes
        topAlerts: [
          { type: AlertType.LOW_INVENTORY, count: 12, lastTriggered: new Date() },
          { type: AlertType.HIGH_CART_ABANDONMENT, count: 8, lastTriggered: new Date() },
          { type: AlertType.PAYMENT_FAILURES, count: 5, lastTriggered: new Date() }
        ]
      };

      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get alert stats', { error });
      throw error;
    }
  }

  // ================== KOREAN E-COMMERCE SPECIFIC ALERTS ==================

  async setupKoreanEcommerceAlerts(): Promise<void> {
    try {
      const koreanAlerts: Omit<AlertConfig, 'id'>[] = [
        {
          alertType: AlertType.UNUSUAL_ACTIVITY,
          metric: 'lunch_time_sales_spike',
          threshold: 3.0, // 3x normal sales during lunch (12-1PM)
          operator: 'gt',
          severity: AlertSeverity.LOW,
          enabled: true,
          recipients: ['marketing@example.com'],
          cooldownPeriod: 60
        },
        {
          alertType: AlertType.PAYMENT_FAILURES,
          metric: 'kakaopay_failure_rate',
          threshold: 0.05, // 5% failure rate for KakaoPay
          operator: 'gt',
          severity: AlertSeverity.HIGH,
          enabled: true,
          recipients: ['tech@example.com'],
          cooldownPeriod: 30
        },
        {
          alertType: AlertType.UNUSUAL_ACTIVITY,
          metric: 'chuseok_sales_drop',
          threshold: 0.5, // 50% drop during Chuseok holiday
          operator: 'lt',
          severity: AlertSeverity.MEDIUM,
          enabled: true,
          recipients: ['business@example.com'],
          cooldownPeriod: 120
        },
        {
          alertType: AlertType.PERFORMANCE_ISSUE,
          metric: 'mobile_conversion_rate',
          threshold: 0.02, // Mobile conversion below 2%
          operator: 'lt',
          severity: AlertSeverity.HIGH,
          enabled: true,
          recipients: ['mobile@example.com'],
          cooldownPeriod: 45
        }
      ];

      for (const alertConfig of koreanAlerts) {
        await this.configureAlert(alertConfig);
      }

      this.logger.info('Korean e-commerce alerts configured', { 
        count: koreanAlerts.length 
      });
      
    } catch (error) {
      this.logger.error('Failed to setup Korean e-commerce alerts', { error });
      throw error;
    }
  }

  // ================== NOTIFICATION SYSTEM ==================

  async sendAlertNotifications(config: AlertConfig, alert: AlertHistoryEntity): Promise<void> {
    try {
      for (const recipient of config.recipients) {
        await this.sendNotification(recipient, config, alert);
      }
      
      // Send to additional channels based on severity
      if (config.severity === AlertSeverity.CRITICAL) {
        await this.sendSlackNotification(config, alert);
        await this.sendSMSNotification(config, alert);
      }
      
    } catch (error) {
      this.logger.error('Failed to send alert notifications', { error, config, alert });
    }
  }

  private async sendNotification(
    recipient: string, 
    config: AlertConfig, 
    alert: AlertHistoryEntity
  ): Promise<void> {
    try {
      // Mock email notification
      this.logger.info('Alert email sent', { 
        recipient,
        alertType: config.alertType,
        severity: config.severity,
        message: alert.message
      });
      
    } catch (error) {
      this.logger.error('Failed to send notification', { error, recipient });
    }
  }

  private async sendSlackNotification(config: AlertConfig, alert: AlertHistoryEntity): Promise<void> {
    try {
      // Mock Slack notification
      this.logger.info('Alert Slack notification sent', { 
        alertType: config.alertType,
        severity: config.severity
      });
      
    } catch (error) {
      this.logger.error('Failed to send Slack notification', { error });
    }
  }

  private async sendSMSNotification(config: AlertConfig, alert: AlertHistoryEntity): Promise<void> {
    try {
      // Mock SMS notification
      this.logger.info('Alert SMS sent', { 
        alertType: config.alertType,
        severity: config.severity
      });
      
    } catch (error) {
      this.logger.error('Failed to send SMS notification', { error });
    }
  }

  // ================== CLEANUP ==================

  async destroy(): Promise<void> {
    try {
      await this.stopMonitoring();
      this.logger.info('Alert service destroyed');
      
    } catch (error) {
      this.logger.error('Failed to destroy alert service', { error });
    }
  }

  // ================== PRIVATE METHODS ==================

  private async getAlertConfig(id: string): Promise<AlertConfig | null> {
    const configs = await this.getAlertConfigs();
    return configs.find(config => config.id === id) || null;
  }

  private async isInCooldown(alertId: string): Promise<boolean> {
    // In real implementation, check last triggered time from database
    return false;
  }

  private async getMetricValue(metric: string): Promise<number> {
    // Mock metric values
    const mockValues: Record<string, number> = {
      'inventory_level': Math.random() * 20,
      'cart_abandonment_rate': 0.6 + Math.random() * 0.3,
      'payment_failure_rate': Math.random() * 0.15,
      'hourly_order_count': Math.random() * 1500,
      'lunch_time_sales_spike': 1.5 + Math.random() * 2,
      'kakaopay_failure_rate': Math.random() * 0.08,
      'mobile_conversion_rate': 0.015 + Math.random() * 0.02
    };

    return mockValues[metric] || 0;
  }

  private evaluateAlertCondition(
    value: number, 
    threshold: number, 
    operator: string
  ): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private generateAlertMessage(config: AlertConfig, value: number): string {
    const metricNames: Record<string, string> = {
      'inventory_level': '재고 수준',
      'cart_abandonment_rate': '장바구니 이탈률',
      'payment_failure_rate': '결제 실패율',
      'hourly_order_count': '시간당 주문 수',
      'lunch_time_sales_spike': '점심시간 매출 급증',
      'kakaopay_failure_rate': '카카오페이 실패율',
      'mobile_conversion_rate': '모바일 전환율'
    };

    const metricName = metricNames[config.metric] || config.metric;
    const formattedValue = this.formatMetricValue(config.metric, value);
    const formattedThreshold = this.formatMetricValue(config.metric, config.threshold);

    return `${metricName} ${formattedValue} (임계값: ${formattedThreshold} ${this.getOperatorText(config.operator)})`;
  }

  private formatMetricValue(metric: string, value: number): string {
    if (metric.includes('rate') || metric.includes('conversion')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    
    if (metric.includes('level') || metric.includes('count')) {
      return Math.round(value).toString();
    }
    
    if (metric.includes('spike')) {
      return `${value.toFixed(1)}x`;
    }

    return value.toFixed(2);
  }

  private getOperatorText(operator: string): string {
    const operatorTexts = {
      'gt': '초과',
      'gte': '이상',
      'lt': '미만',
      'lte': '이하',
      'eq': '동일'
    };

    return operatorTexts[operator as keyof typeof operatorTexts] || operator;
  }

  private async updateLastTriggered(configId: string): Promise<void> {
    // In real implementation, update database
    this.logger.debug('Updated last triggered time', { configId });
  }

  private groupAlertsByType(alerts: AlertData[]): Record<AlertType, number> {
    const grouped = {} as Record<AlertType, number>;
    
    for (const alertType of Object.values(AlertType)) {
      grouped[alertType] = alerts.filter(a => a.type === alertType).length;
    }
    
    return grouped;
  }

  private groupAlertsBySeverity(alerts: AlertData[]): Record<AlertSeverity, number> {
    const grouped = {} as Record<AlertSeverity, number>;
    
    for (const severity of Object.values(AlertSeverity)) {
      grouped[severity] = alerts.filter(a => a.severity === severity).length;
    }
    
    return grouped;
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}