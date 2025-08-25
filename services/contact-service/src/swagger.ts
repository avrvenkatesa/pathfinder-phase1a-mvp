import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Contact Service API',
      version: '1.0.0',
      description: 'Pathfinder Contact Service - Handles contact management and hierarchy operations',
    },
    servers: [
      {
        url: `http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}`,
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['company', 'division', 'person'] },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            jobTitle: { type: 'string' },
            department: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            secondaryPhone: { type: 'string' },
            address: { type: 'string' },
            website: { type: 'string' },
            parentId: { type: 'string' },
            userId: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            children: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
          },
        },
        CreateContactRequest: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['company', 'division', 'person'] },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            jobTitle: { type: 'string' },
            department: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            secondaryPhone: { type: 'string' },
            address: { type: 'string' },
            website: { type: 'string' },
            parentId: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
        UpdateContactRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            jobTitle: { type: 'string' },
            department: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            secondaryPhone: { type: 'string' },
            address: { type: 'string' },
            website: { type: 'string' },
            parentId: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        ContactStats: {
          type: 'object',
          properties: {
            totalCompanies: { type: 'number' },
            totalDivisions: { type: 'number' },
            totalPeople: { type: 'number' },
          },
        },
        PaginatedContactsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
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
    customSiteTitle: 'Contact Service API Documentation',
  }));
}