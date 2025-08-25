import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Workflow Service API',
      version: '1.0.0',
      description: 'Pathfinder Workflow Service - Handles workflow and template management',
    },
    servers: [
      {
        url: `http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}`,
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Workflow: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            definitionJson: { type: 'object' },
            bpmnXml: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'active', 'inactive', 'archived'] },
            version: { type: 'string' },
            isTemplate: { type: 'boolean' },
            isPublic: { type: 'boolean' },
            createdBy: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateWorkflowRequest: {
          type: 'object',
          required: ['name', 'definitionJson'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            definitionJson: { type: 'object' },
            bpmnXml: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'active', 'inactive', 'archived'] },
            version: { type: 'string' },
            isTemplate: { type: 'boolean' },
            isPublic: { type: 'boolean' },
          },
        },
        UpdateWorkflowRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            definitionJson: { type: 'object' },
            bpmnXml: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'active', 'inactive', 'archived'] },
            version: { type: 'string' },
            isTemplate: { type: 'boolean' },
            isPublic: { type: 'boolean' },
          },
        },
        WorkflowTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            workflowDefinition: { type: 'object' },
            isPublic: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
            usageCount: { type: 'string' },
            rating: { type: 'number' },
            createdBy: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateTemplateRequest: {
          type: 'object',
          required: ['name', 'workflowDefinition'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            workflowDefinition: { type: 'object' },
            isPublic: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        WorkflowInstance: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflowId: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
            currentStepId: { type: 'string' },
            variables: { type: 'object' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            pausedAt: { type: 'string', format: 'date-time' },
            errorMessage: { type: 'string' },
            executionLog: { type: 'array', items: { type: 'object' } },
            createdBy: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowTask: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            instanceId: { type: 'string' },
            elementId: { type: 'string' },
            taskName: { type: 'string' },
            taskType: { type: 'string' },
            assignedContactId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'skipped'] },
            input: { type: 'object' },
            output: { type: 'object' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            dueDate: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes.ts'],
};

const specs = swaggerJsdoc(options);

export function setupDocs(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Workflow Service API Documentation',
  }));
}