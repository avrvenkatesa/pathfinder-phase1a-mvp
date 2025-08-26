import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pathfinder Workflow Service API',
      version: '1.0.0',
      description: 'Workflow and template management service for the Pathfinder platform',
    },
    servers: [
      {
        url: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3002',
        description: 'Workflow Service',
      },
    ],
    components: {
      securitySchemes: {
        ApiGateway: {
          type: 'apiKey',
          in: 'header',
          name: 'x-user-id',
          description: 'User ID forwarded by API Gateway',
        },
      },
      schemas: {
        Workflow: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            definitionJson: { type: 'object' },
            bpmnXml: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'paused', 'completed', 'archived']
            },
            version: { type: 'string' },
            isTemplate: { type: 'boolean' },
            isPublic: { type: 'boolean' },
            createdBy: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowInstance: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            workflowId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
            },
            currentStepId: { type: 'string' },
            variables: { type: 'object' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            pausedAt: { type: 'string', format: 'date-time' },
            errorMessage: { type: 'string' },
            executionLog: { type: 'array' },
            createdBy: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            workflowDefinition: { type: 'object' },
            isPublic: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
            usageCount: { type: 'string' },
            createdBy: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        ApiGateway: [],
      },
    ],
  },
  apis: ['./src/routes.ts'], // Path to the API files
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

  // JSON endpoint for the spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}
