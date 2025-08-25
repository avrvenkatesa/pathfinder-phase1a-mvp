import express from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from './storage';
import { sendSuccess, sendError, sendPaginated, asyncHandler } from '../../../shared/utils/response-helpers';
import { validateBody, validateQuery, validateParams } from '../../../shared/utils/validation';
import { z } from 'zod';

// Rate limiting
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write requests, please try again later.',
  },
});

// Validation schemas
const workflowFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional().transform(val => val?.split(',')),
  category: z.string().optional(),
  isTemplate: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '20')),
});

const templateFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '20')),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  definitionJson: z.record(z.any()),
  bpmnXml: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  version: z.string().optional(),
  isTemplate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  workflowDefinition: z.record(z.any()),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Middleware to extract user ID from headers (will be set by API Gateway)
const extractUserId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return sendError(res, 401, 'MISSING_USER_ID', 'User ID not found in request headers');
  }
  (req as any).userId = userId;
  next();
};

export function setupRoutes(app: express.Express) {
  const workflowRouter = express.Router();
  const templateRouter = express.Router();

  // Apply user ID extraction middleware to all routes
  workflowRouter.use(extractUserId);
  templateRouter.use(extractUserId);

  // ===================
  // WORKFLOW ROUTES
  // ===================

  /**
   * @swagger
   * /api/workflows:
   *   get:
   *     summary: Get workflows list
   *     tags: [Workflows]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Workflow statuses (comma-separated)
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Category filter
   *       - in: query
   *         name: isTemplate
   *         schema:
   *           type: boolean
   *         description: Template filter
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Workflows list
   */
  workflowRouter.get('/', readLimiter, validateQuery(workflowFiltersSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const filters = req.query;
      const { page = 1, limit = 20, ...workflowFilters } = filters;
      
      const workflows = await storage.getWorkflows(userId, workflowFilters);
      
      // Simple pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedWorkflows = workflows.slice(startIndex, endIndex);
      
      return sendPaginated(res, paginatedWorkflows, page, limit, workflows.length);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch workflows');
    }
  }));

  /**
   * @swagger
   * /api/workflows/{id}:
   *   get:
   *     summary: Get workflow by ID
   *     tags: [Workflows]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Workflow details
   *       404:
   *         description: Workflow not found
   */
  workflowRouter.get('/:id', readLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const workflow = await storage.getWorkflowById(req.params.id, userId);
      
      if (!workflow) {
        return sendError(res, 404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
      }
      
      return sendSuccess(res, workflow);
    } catch (error) {
      console.error("Error fetching workflow:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch workflow');
    }
  }));

  /**
   * @swagger
   * /api/workflows:
   *   post:
   *     summary: Create new workflow
   *     tags: [Workflows]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateWorkflowRequest'
   *     responses:
   *       201:
   *         description: Workflow created
   */
  workflowRouter.post('/', writeLimiter, validateBody(createWorkflowSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const workflow = await storage.createWorkflow(req.body, userId);
      return res.status(201).json({
        success: true,
        data: workflow,
        message: 'Workflow created successfully',
      });
    } catch (error) {
      console.error("Error creating workflow:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create workflow');
    }
  }));

  /**
   * @swagger
   * /api/workflows/{id}:
   *   put:
   *     summary: Update workflow
   *     tags: [Workflows]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateWorkflowRequest'
   *     responses:
   *       200:
   *         description: Workflow updated
   *       404:
   *         description: Workflow not found
   */
  workflowRouter.put('/:id', writeLimiter, validateParams(idParamsSchema), validateBody(updateWorkflowSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const workflow = await storage.updateWorkflow(req.params.id, req.body, userId);
      
      if (!workflow) {
        return sendError(res, 404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
      }
      
      return sendSuccess(res, workflow, 'Workflow updated successfully');
    } catch (error) {
      console.error("Error updating workflow:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update workflow');
    }
  }));

  /**
   * @swagger
   * /api/workflows/{id}:
   *   delete:
   *     summary: Delete workflow
   *     tags: [Workflows]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Workflow deleted
   *       404:
   *         description: Workflow not found
   */
  workflowRouter.delete('/:id', writeLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const deleted = await storage.deleteWorkflow(req.params.id, userId);
      
      if (!deleted) {
        return sendError(res, 404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
      }
      
      return sendSuccess(res, { deleted: true }, 'Workflow deleted successfully');
    } catch (error) {
      console.error("Error deleting workflow:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to delete workflow');
    }
  }));

  /**
   * @swagger
   * /api/workflows/{id}/duplicate:
   *   post:
   *     summary: Duplicate workflow
   *     tags: [Workflows]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       201:
   *         description: Workflow duplicated
   *       404:
   *         description: Workflow not found
   */
  workflowRouter.post('/:id/duplicate', writeLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const duplicatedWorkflow = await storage.duplicateWorkflow(req.params.id, userId);
      
      if (!duplicatedWorkflow) {
        return sendError(res, 404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
      }
      
      return res.status(201).json({
        success: true,
        data: duplicatedWorkflow,
        message: 'Workflow duplicated successfully',
      });
    } catch (error) {
      console.error("Error duplicating workflow:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to duplicate workflow');
    }
  }));

  // ===================
  // WORKFLOW TEMPLATE ROUTES
  // ===================

  /**
   * @swagger
   * /api/workflow-templates:
   *   get:
   *     summary: Get workflow templates list
   *     tags: [Templates]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Category filter
   *       - in: query
   *         name: isPublic
   *         schema:
   *           type: boolean
   *         description: Public filter
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Templates list
   */
  templateRouter.get('/', readLimiter, validateQuery(templateFiltersSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const filters = req.query;
      const { page = 1, limit = 20, ...templateFilters } = filters;
      
      const templates = await storage.getWorkflowTemplates(userId, templateFilters);
      
      // Simple pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTemplates = templates.slice(startIndex, endIndex);
      
      return sendPaginated(res, paginatedTemplates, page, limit, templates.length);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch workflow templates');
    }
  }));

  /**
   * @swagger
   * /api/workflow-templates:
   *   post:
   *     summary: Create new workflow template
   *     tags: [Templates]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateTemplateRequest'
   *     responses:
   *       201:
   *         description: Template created
   */
  templateRouter.post('/', writeLimiter, validateBody(createTemplateSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const template = await storage.createWorkflowTemplate(req.body, userId);
      return res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      console.error("Error creating workflow template:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create workflow template');
    }
  }));

  /**
   * @swagger
   * /api/workflow-templates/{id}/use:
   *   post:
   *     summary: Create workflow from template
   *     tags: [Templates]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       201:
   *         description: Workflow created from template
   *       404:
   *         description: Template not found
   */
  templateRouter.post('/:id/use', writeLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const workflow = await storage.useWorkflowTemplate(req.params.id, userId);
      return res.status(201).json({
        success: true,
        data: workflow,
        message: 'Workflow created from template successfully',
      });
    } catch (error) {
      console.error("Error using workflow template:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to use workflow template');
    }
  }));

  // Mount routers
  app.use('/api/workflows', workflowRouter);
  app.use('/api/workflow-templates', templateRouter);
}