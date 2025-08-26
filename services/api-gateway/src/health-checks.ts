import express from 'express';
import { HttpClient } from '../../../shared/utils/http-client';

const services = [
  {
    name: 'auth-service',
    url: `http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}/health`,
  },
  {
    name: 'contact-service',
    url: `http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}/health`,
  },
  {
    name: 'workflow-service',
    url: `http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}/health`,
  },
];

export function setupHealthChecks(app: express.Express) {
  app.get('/health/detailed', async (req, res) => {
    const healthChecks: Record<string, any> = {
      'api-gateway': {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    };

    // Check each service
    for (const service of services) {
      try {
        const client = new HttpClient({
          baseUrl: service.url.replace('/health', ''),
          timeout: 3000,
        });
        
        const response = await client.get('/health');
        healthChecks[service.name] = {
          status: response.status || 'healthy',
          ...response,
        };
      } catch (error) {
        healthChecks[service.name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Determine overall health
    const allHealthy = Object.values(healthChecks).every(
      (health: any) => health.status === 'healthy'
    );

    const overallStatus = allHealthy ? 'healthy' : 'degraded';
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: healthChecks,
    });
  });

  app.get('/health/ready', async (req, res) => {
    // Check if critical services are available
    const criticalServices = ['auth-service', 'contact-service'];
    const healthyServices: string[] = [];
    const unhealthyServices: string[] = [];

    for (const service of services.filter(s => criticalServices.includes(s.name))) {
      try {
        const client = new HttpClient({
          baseUrl: service.url.replace('/health', ''),
          timeout: 2000,
        });
        
        await client.get('/health');
        healthyServices.push(service.name);
      } catch (error) {
        unhealthyServices.push(service.name);
      }
    }

    const isReady = unhealthyServices.length === 0;
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      healthy: healthyServices,
      unhealthy: unhealthyServices,
    });
  });

  app.get('/health/live', (req, res) => {
    // Simple liveness check
    res.json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  console.log('✅ Health check endpoints configured:');
  console.log('   /health - Basic health check');
  console.log('   /health/detailed - Detailed health check with all services');
  console.log('   /health/ready - Readiness check for critical services');
  console.log('   /health/live - Liveness check');
}