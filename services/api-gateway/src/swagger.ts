import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pathfinder Platform API Gateway',
      version: '1.0.0',
      description: 'API Gateway for Pathfinder Platform Microservices Architecture',
    },
    servers: [
      {
        url: `http://localhost:${process.env.API_GATEWAY_PORT || 3000}`,
        description: 'Development API Gateway',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
            service: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            dependencies: {
              type: 'object',
              additionalProperties: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
              },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Basic health check',
          tags: ['Health'],
          responses: {
            200: {
              description: 'API Gateway is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/health/detailed': {
        get: {
          summary: 'Detailed health check with all services',
          tags: ['Health'],
          responses: {
            200: {
              description: 'All services are healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['healthy', 'degraded'] },
                      timestamp: { type: 'string', format: 'date-time' },
                      services: {
                        type: 'object',
                        additionalProperties: { $ref: '#/components/schemas/HealthResponse' },
                      },
                    },
                  },
                },
              },
            },
            503: {
              description: 'One or more services are unhealthy',
            },
          },
        },
      },
      '/health/ready': {
        get: {
          summary: 'Readiness check for critical services',
          tags: ['Health'],
          responses: {
            200: {
              description: 'Critical services are ready',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ready: { type: 'boolean' },
                      timestamp: { type: 'string', format: 'date-time' },
                      healthy: { type: 'array', items: { type: 'string' } },
                      unhealthy: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            503: {
              description: 'Critical services are not ready',
            },
          },
        },
      },
      '/health/live': {
        get: {
          summary: 'Liveness check',
          tags: ['Health'],
          responses: {
            200: {
              description: 'API Gateway is alive',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      alive: { type: 'boolean' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [], // No additional route files needed for gateway
};

const specs = swaggerJsdoc(options);

export function setupDocs(app: Express) {
  // Enhance the specs with service documentation links
  const enhancedSpecs = {
    ...specs,
    info: {
      ...specs.info,
      description: specs.info?.description + `

## Service Documentation

This API Gateway routes requests to the following microservices:

- **Auth Service**: [http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}/api-docs](http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}/api-docs)
- **Contact Service**: [http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}/api-docs](http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}/api-docs)
- **Workflow Service**: [http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}/api-docs](http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}/api-docs)

## API Endpoints

All API requests should be made through this gateway:

- **Authentication**: \`/api/auth/*\` → Auth Service
- **Contacts**: \`/api/contacts/*\` → Contact Service  
- **Workflows**: \`/api/workflows/*\` → Workflow Service
- **Templates**: \`/api/workflow-templates/*\` → Workflow Service

## Rate Limiting

- General: 1000 requests per 15 minutes
- Auth: 20 requests per 15 minutes
- Write operations: 200 requests per 15 minutes
- Bulk operations: 20 requests per 15 minutes

## Authentication

Most endpoints require authentication. The gateway handles authentication verification and forwards user context to downstream services.
`,
    },
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(enhancedSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Pathfinder API Gateway Documentation',
  }));
}