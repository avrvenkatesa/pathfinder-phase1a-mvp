import { Pool } from 'pg';
import { EventEmitter } from 'events';
import cron from 'node-cron';

export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageResponseTime: number;
  errorRate: number;
  topFailingRules: Array<{ ruleName: string; failureCount: number }>;
  dataQualityScore: number;
}

export interface ValidationAlert {
  id: string;
  type: 'error_rate' | 'performance' | 'data_quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: Date;
  acknowledged: boolean;
}

export class ValidationMonitor extends EventEmitter {
  private db: Pool;
  private metrics: ValidationMetrics;
  private alerts: ValidationAlert[] = [];
  private isMonitoring: boolean = false;
  
  // Configuration thresholds
  private config = {
    errorRateThreshold: 10, // 10% error rate triggers alert
    performanceThreshold: 5000, // 5 seconds response time threshold
    dataQualityThreshold: 80, // 80% minimum data quality score
    alertCheckInterval: '*/5 * * * *', // Every 5 minutes
    metricsCalculationInterval: '*/1 * * * *', // Every minute
  };

  constructor(db: Pool) {
    super();
    this.db = db;
    this.metrics = this.getDefaultMetrics();
  }

  /**
   * Start monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('Validation monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting validation monitoring system...');

    // Schedule metrics calculation
    cron.schedule(this.config.metricsCalculationInterval, async () => {
      await this.calculateMetrics();
    });

    // Schedule alert checking
    cron.schedule(this.config.alertCheckInterval, async () => {
      await this.checkAlerts();
    });

    // Generate daily reports
    cron.schedule('0 9 * * *', async () => { // 9 AM daily
      await this.generateDailyReport();
    });

    // Weekly report
    cron.schedule('0 9 * * 1', async () => { // 9 AM Monday
      await this.generateWeeklyReport();
    });

    console.log('✅ Validation monitoring system started');
    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Validation monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Calculate current validation metrics
   */
  private async calculateMetrics(): Promise<void> {
    try {
      const timeWindow = new Date();
      timeWindow.setHours(timeWindow.getHours() - 24); // Last 24 hours

      // Get validation counts
      const countResult = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as successful,
          COUNT(CASE WHEN is_valid = false THEN 1 END) as failed
        FROM validation_results 
        WHERE validated_at >= $1
      `, [timeWindow]);

      const counts = countResult.rows[0];
      
      // Get top failing rules
      const failingRulesResult = await this.db.query(`
        SELECT 
          vr.name as rule_name,
          COUNT(vrs.id) as failure_count
        FROM validation_results vrs
        JOIN validation_rules vr ON vrs.rule_id = vr.id
        WHERE vrs.is_valid = false AND vrs.validated_at >= $1
        GROUP BY vr.name
        ORDER BY failure_count DESC
        LIMIT 10
      `, [timeWindow]);

      // Calculate data quality score
      const totalValidations = parseInt(counts.total) || 0;
      const successfulValidations = parseInt(counts.successful) || 0;
      const dataQualityScore = totalValidations > 0 ? 
        (successfulValidations / totalValidations) * 100 : 100;

      this.metrics = {
        totalValidations,
        successfulValidations,
        failedValidations: parseInt(counts.failed) || 0,
        averageResponseTime: 0, // Would need timing data
        errorRate: totalValidations > 0 ? 
          ((parseInt(counts.failed) || 0) / totalValidations) * 100 : 0,
        topFailingRules: failingRulesResult.rows.map(row => ({
          ruleName: row.rule_name,
          failureCount: parseInt(row.failure_count)
        })),
        dataQualityScore
      };

      this.emit('metrics:updated', this.metrics);
    } catch (error) {
      console.error('Error calculating validation metrics:', error);
      this.emit('metrics:error', error);
    }
  }

  /**
   * Check for alerts based on current metrics
   */
  private async checkAlerts(): Promise<void> {
    const newAlerts: ValidationAlert[] = [];

    // Error rate alert
    if (this.metrics.errorRate > this.config.errorRateThreshold) {
      newAlerts.push({
        id: `error_rate_${Date.now()}`,
        type: 'error_rate',
        severity: this.metrics.errorRate > 25 ? 'critical' : 'high',
        message: `Validation error rate is ${this.metrics.errorRate.toFixed(2)}% (threshold: ${this.config.errorRateThreshold}%)`,
        threshold: this.config.errorRateThreshold,
        actualValue: this.metrics.errorRate,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Data quality alert
    if (this.metrics.dataQualityScore < this.config.dataQualityThreshold) {
      newAlerts.push({
        id: `data_quality_${Date.now()}`,
        type: 'data_quality',
        severity: this.metrics.dataQualityScore < 60 ? 'critical' : 'high',
        message: `Data quality score is ${this.metrics.dataQualityScore.toFixed(2)}% (threshold: ${this.config.dataQualityThreshold}%)`,
        threshold: this.config.dataQualityThreshold,
        actualValue: this.metrics.dataQualityScore,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Performance alert (placeholder - would need actual timing data)
    if (this.metrics.averageResponseTime > this.config.performanceThreshold) {
      newAlerts.push({
        id: `performance_${Date.now()}`,
        type: 'performance',
        severity: 'medium',
        message: `Average validation response time is ${this.metrics.averageResponseTime}ms (threshold: ${this.config.performanceThreshold}ms)`,
        threshold: this.config.performanceThreshold,
        actualValue: this.metrics.averageResponseTime,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Add new alerts
    if (newAlerts.length > 0) {
      this.alerts.push(...newAlerts);
      this.emit('alerts:new', newAlerts);
      
      // Log critical alerts
      newAlerts.forEach(alert => {
        if (alert.severity === 'critical') {
          console.error(`🚨 CRITICAL VALIDATION ALERT: ${alert.message}`);
        }
      });
    }

    // Clean up old acknowledged alerts (older than 7 days)
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - 7);
    this.alerts = this.alerts.filter(alert => 
      !alert.acknowledged || alert.timestamp > cleanupDate
    );
  }

  /**
   * Generate daily validation report
   */
  private async generateDailyReport(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      const reportResult = await this.db.query(`
        SELECT 
          entity_type,
          COUNT(*) as total_validations,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as successful,
          COUNT(CASE WHEN is_valid = false THEN 1 END) as failed,
          ROUND(AVG(CASE WHEN is_valid = true THEN 100.0 ELSE 0.0 END), 2) as success_rate
        FROM validation_results 
        WHERE validated_at >= $1 AND validated_at < $2
        GROUP BY entity_type
        ORDER BY total_validations DESC
      `, [yesterday, today]);

      const report = {
        date: yesterday.toISOString().split('T')[0],
        summary: reportResult.rows,
        metrics: { ...this.metrics },
        alerts: this.alerts.filter(alert => 
          alert.timestamp >= yesterday && alert.timestamp < today
        )
      };

      console.log('📊 Daily Validation Report Generated:', {
        date: report.date,
        totalValidations: report.summary.reduce((sum, row) => sum + parseInt(row.total_validations), 0),
        overallSuccessRate: this.metrics.dataQualityScore.toFixed(2) + '%',
        alertsGenerated: report.alerts.length
      });

      this.emit('report:daily', report);
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  /**
   * Generate weekly validation report
   */
  private async generateWeeklyReport(): Promise<void> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const trendResult = await this.db.query(`
        SELECT 
          DATE_TRUNC('day', validated_at) as day,
          COUNT(*) as total_validations,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as successful,
          ROUND(AVG(CASE WHEN is_valid = true THEN 100.0 ELSE 0.0 END), 2) as success_rate
        FROM validation_results 
        WHERE validated_at >= $1
        GROUP BY DATE_TRUNC('day', validated_at)
        ORDER BY day
      `, [oneWeekAgo]);

      const weeklyReport = {
        weekStarting: oneWeekAgo.toISOString().split('T')[0],
        trends: trendResult.rows,
        totalValidations: this.metrics.totalValidations,
        averageSuccessRate: this.metrics.dataQualityScore,
        topFailingRules: this.metrics.topFailingRules.slice(0, 5),
        alertsSummary: {
          total: this.alerts.length,
          critical: this.alerts.filter(a => a.severity === 'critical').length,
          high: this.alerts.filter(a => a.severity === 'high').length
        }
      };

      console.log('📈 Weekly Validation Report Generated:', {
        weekStarting: weeklyReport.weekStarting,
        totalValidations: weeklyReport.totalValidations,
        averageSuccessRate: weeklyReport.averageSuccessRate.toFixed(2) + '%',
        totalAlerts: weeklyReport.alertsSummary.total
      });

      this.emit('report:weekly', weeklyReport);
    } catch (error) {
      console.error('Error generating weekly report:', error);
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current alerts
   */
  public getAlerts(unacknowledgedOnly: boolean = false): ValidationAlert[] {
    if (unacknowledgedOnly) {
      return this.alerts.filter(alert => !alert.acknowledged);
    }
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Validation monitor configuration updated:', newConfig);
    this.emit('config:updated', this.config);
  }

  /**
   * Get monitoring status
   */
  public getStatus(): {
    isMonitoring: boolean;
    config: typeof this.config;
    lastMetricsUpdate: Date;
    alertCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      config: this.config,
      lastMetricsUpdate: new Date(), // Would track actual last update
      alertCount: this.alerts.length
    };
  }

  /**
   * Default metrics structure
   */
  private getDefaultMetrics(): ValidationMetrics {
    return {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageResponseTime: 0,
      errorRate: 0,
      topFailingRules: [],
      dataQualityScore: 100
    };
  }
}