import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import os from 'os';
import { EventEmitter } from 'events';

// Metrics collector
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, any[]> = new Map();
  private counters: Map<string, number> = new Map();

  recordMetric(name: string, value: any) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metrics = this.metrics.get(name)!;
    metrics.push({
      value,
      timestamp: Date.now(),
    });

    // Keep only last 1000 metrics per type
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.emit('metric', { name, value, timestamp: Date.now() });
  }

  incrementCounter(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    this.emit('counter', { name, value: current + value });
  }

  getMetrics(name: string) {
    return this.metrics.get(name) || [];
  }

  getCounter(name: string) {
    return this.counters.get(name) || 0;
  }

  getAllMetrics() {
    const result: any = {
      metrics: {},
      counters: {},
    };

    this.metrics.forEach((values, key) => {
      const recentValues = values.slice(-100); // Last 100 values
      result.metrics[key] = {
        count: values.length,
        recent: recentValues,
        average: recentValues.reduce((sum, m) => sum + m.value, 0) / recentValues.length,
        min: Math.min(...recentValues.map(m => m.value)),
        max: Math.max(...recentValues.map(m => m.value)),
      };
    });

    this.counters.forEach((value, key) => {
      result.counters[key] = value;
    });

    return result;
  }

  reset() {
    this.metrics.clear();
    this.counters.clear();
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  const requestId = (req as any).requestId || 'unknown';

  // Log request
  const requestLog = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    referer: req.get('referer'),
  };

  console.log('Incoming request:', JSON.stringify(requestLog));

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    const duration = performance.now() - start;
    const responseLog = {
      timestamp: new Date().toISOString(),
      requestId,
      statusCode: res.statusCode,
      duration: Math.round(duration * 100) / 100,
      contentLength: res.get('content-length'),
    };

    // Record metrics
    metrics.recordMetric('response_time', duration);
    metrics.incrementCounter(`status_${res.statusCode}`);
    metrics.incrementCounter('total_requests');

    // Log slow requests
    if (duration > 1000) {
      console.warn('Slow request detected:', {
        ...requestLog,
        ...responseLog,
      });
    }

    console.log('Request completed:', JSON.stringify(responseLog));

    return res.send(data);
  };

  next();
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const route = req.route?.path || req.path;
  const method = req.method;
  const key = `${method} ${route}`;

  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    metrics.recordMetric(`route_${key}`, duration);

    // Check for performance degradation
    const recentMetrics = metrics.getMetrics(`route_${key}`).slice(-100);
    if (recentMetrics.length >= 10) {
      const average = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
      if (duration > average * 2) {
        console.warn(`Performance degradation detected for ${key}: ${duration}ms (avg: ${average}ms)`);
      }
    }
  });

  next();
};

// System health monitoring
export class HealthMonitor {
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();

  registerHealthCheck(name: string, check: () => Promise<boolean>) {
    this.healthChecks.set(name, check);
  }

  async checkHealth() {
    const results: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      system: {
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: process.memoryUsage(),
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
        },
      },
    };

    // Run all health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const isHealthy = await check();
        const duration = Date.now() - startTime;

        results.checks[name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          duration,
        };

        if (!isHealthy) {
          results.status = 'unhealthy';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.status = 'unhealthy';
      }
    }

    return results;
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

// Memory usage monitoring
export const memoryMonitor = () => {
  setInterval(() => {
    const usage = process.memoryUsage();
    metrics.recordMetric('memory_heap_used', usage.heapUsed);
    metrics.recordMetric('memory_heap_total', usage.heapTotal);
    metrics.recordMetric('memory_rss', usage.rss);

    // Check for memory leaks
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)} MB`);
    }
  }, 30000); // Every 30 seconds
};

// Database query monitoring
export const queryMonitor = {
  recordQuery: (query: string, duration: number, success: boolean) => {
    metrics.recordMetric('db_query_duration', duration);
    metrics.incrementCounter(success ? 'db_queries_success' : 'db_queries_failed');

    if (duration > 1000) {
      console.warn('Slow database query:', {
        query: query.substring(0, 200),
        duration,
      });
    }
  },

  recordConnectionPoolMetrics: (active: number, idle: number, waiting: number) => {
    metrics.recordMetric('db_pool_active', active);
    metrics.recordMetric('db_pool_idle', idle);
    metrics.recordMetric('db_pool_waiting', waiting);
  },
};

// API endpoint monitoring
export const endpointMonitor = (req: Request, res: Response, next: NextFunction) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  metrics.incrementCounter(`endpoint_${endpoint}`);
  next();
};

// Error tracking
export const errorTracker = (error: Error, context?: any) => {
  metrics.incrementCounter('errors_total');
  metrics.incrementCounter(`errors_${error.name || 'unknown'}`);

  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  };

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry, Rollbar, etc.
    console.error('Production error:', JSON.stringify(errorLog));
  } else {
    console.error('Error tracked:', errorLog);
  }
};

// Custom metrics endpoint
export const metricsEndpoint = (req: Request, res: Response) => {
  const allMetrics = metrics.getAllMetrics();
  const systemMetrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
  };

  res.json({
    success: true,
    data: {
      application: allMetrics,
      system: systemMetrics,
      timestamp: new Date().toISOString(),
    },
  });
};

// Initialize monitoring
export const initializeMonitoring = () => {
  // Start memory monitoring
  memoryMonitor();

  // Register default health checks
  healthMonitor.registerHealthCheck('database', async () => {
    // TODO: Implement actual database health check
    return true;
  });

  healthMonitor.registerHealthCheck('memory', async () => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    return heapUsedMB < 800; // Fail if using more than 800MB
  });

  console.log('Monitoring initialized');
};