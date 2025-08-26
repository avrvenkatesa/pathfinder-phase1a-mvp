import express from "express";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  sendSuccess,
  sendError,
  sendPaginated,
  asyncHandler,
} from "../../../shared/utils/response-helpers";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/utils/validation";
import { z } from "zod";

// Rate limiting
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later.",
  },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many write requests, please try again later.",
  },
});

// Validation schemas
const workflowFiltersSchema = z.object({
  search: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(",")),
  category: z.string().optional(),
  isTemplate: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "1")),
  limit: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "20")),
});

const templateFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isPublic: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "1")),
  limit: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "20")),
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
  status: z
    .enum(["draft", "active", "paused", "completed", "archived"])
    .optional(),
  version: z.string().optional(),
  isTemplate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  workflowDefinition: z.record(z.any()),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const createInstanceSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().optional(),
  variables: z.record(z.any()).optional(),
});

const executeTaskSchema = z.object({
  taskId: z.string().uuid(),
  output: z.record(z.any()).optional(),
  notes: z.string().optional(),
  assignedContactId: z.string().uuid().optional(),
});

const bpmnElementSchema = z.object({
  id: z.string(),
  type: z.enum([
    "start_event",
    "end_event",
    "user_task",
    "system_task",
    "decision_gateway",
    "sequence_flow",
  ]),
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  properties: z.record(z.any()).optional(),
});

const workflowDefinitionSchema = z.object({
  elements: z.array(bpmnElementSchema),
  connections: z.array(
    z.object({
      id: z.string(),
      type: z.literal("sequence_flow"),
      sourceId: z.string(),
      targetId: z.string(),
      name: z.string().optional(),
      condition: z.string().optional(),
    }),
  ),
  variables: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Middleware to extract user ID from headers (will be set by API Gateway)
const extractUserId = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return sendError(
      res,
      401,
      "MISSING_USER_ID",
      "User ID not found in request headers",
    );
  }
  (req as any).userId = userId;
  next();
};

export function setupRoutes(app: express.Express) {
  const workflowRouter = express.Router();
  const templateRouter = express.Router();
  const instanceRouter = express.Router();

  // Apply user ID extraction middleware to all routes
  workflowRouter.use(extractUserId);
  templateRouter.use(extractUserId);
  instanceRouter.use(extractUserId);

  // ===================
  // WORKFLOW ROUTES
  // ===================

  /**
   * @swagger
   * /api/workflows:
   *   get:
   *     summary: Get workflows list with enhanced filtering
   *     tags: [Workflows]
   */
  workflowRouter.get(
    "/",
    readLimiter,
    validateQuery(workflowFiltersSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const filters = req.query;
        const { page = 1, limit = 20, ...workflowFilters } = filters;

        const workflows = await storage.getWorkflows(userId, workflowFilters);

        // Simple pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedWorkflows = workflows.slice(startIndex, endIndex);

        return sendPaginated(
          res,
          paginatedWorkflows,
          page,
          limit,
          workflows.length,
        );
      } catch (error) {
        console.error("Error fetching workflows:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflows",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/stats:
   *   get:
   *     summary: Get workflow statistics and analytics
   *     tags: [Workflows]
   */
  workflowRouter.get(
    "/stats",
    readLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const stats = await storage.getWorkflowStats(userId);
        return sendSuccess(res, stats);
      } catch (error) {
        console.error("Error fetching workflow stats:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow statistics",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/validate-definition:
   *   post:
   *     summary: Validate workflow definition structure
   *     tags: [Workflows]
   */
  workflowRouter.post(
    "/validate-definition",
    readLimiter,
    validateBody(workflowDefinitionSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const validation = await storage.validateWorkflowDefinition(req.body);
        return sendSuccess(res, validation);
      } catch (error) {
        console.error("Error validating workflow definition:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to validate workflow definition",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}:
   *   get:
   *     summary: Get workflow by ID with execution history
   *     tags: [Workflows]
   */
  workflowRouter.get(
    "/:id",
    readLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const workflow = await storage.getWorkflowById(req.params.id, userId);

        if (!workflow) {
          return sendError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            "Workflow not found",
          );
        }

        return sendSuccess(res, workflow);
      } catch (error) {
        console.error("Error fetching workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}/instances:
   *   get:
   *     summary: Get workflow execution instances
   *     tags: [Workflows]
   */
  workflowRouter.get(
    "/:id/instances",
    readLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const instances = await storage.getWorkflowInstances(
          req.params.id,
          userId,
        );
        return sendSuccess(res, instances);
      } catch (error) {
        console.error("Error fetching workflow instances:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow instances",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}/execute:
   *   post:
   *     summary: Execute workflow (create new instance)
   *     tags: [Workflows]
   */
  workflowRouter.post(
    "/:id/execute",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const { variables = {}, name } = req.body;

        const instance = await storage.executeWorkflow(req.params.id, userId, {
          variables,
          name,
        });

        return res.status(201).json({
          success: true,
          data: instance,
          message: "Workflow execution started successfully",
        });
      } catch (error) {
        console.error("Error executing workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to execute workflow",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows:
   *   post:
   *     summary: Create new workflow with BPMN support
   *     tags: [Workflows]
   */
  workflowRouter.post(
    "/",
    writeLimiter,
    validateBody(createWorkflowSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const workflow = await storage.createWorkflow(req.body, userId);
        return res.status(201).json({
          success: true,
          data: workflow,
          message: "Workflow created successfully",
        });
      } catch (error) {
        console.error("Error creating workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to create workflow",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}:
   *   put:
   *     summary: Update workflow with validation
   *     tags: [Workflows]
   */
  workflowRouter.put(
    "/:id",
    writeLimiter,
    validateParams(idParamsSchema),
    validateBody(updateWorkflowSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const workflow = await storage.updateWorkflow(
          req.params.id,
          req.body,
          userId,
        );

        if (!workflow) {
          return sendError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            "Workflow not found",
          );
        }

        return sendSuccess(res, workflow, "Workflow updated successfully");
      } catch (error) {
        console.error("Error updating workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to update workflow",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}:
   *   delete:
   *     summary: Delete workflow with dependency checking
   *     tags: [Workflows]
   */
  workflowRouter.delete(
    "/:id",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const deleted = await storage.deleteWorkflow(req.params.id, userId);

        if (!deleted) {
          return sendError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            "Workflow not found",
          );
        }

        return sendSuccess(
          res,
          { deleted: true },
          "Workflow deleted successfully",
        );
      } catch (error) {
        console.error("Error deleting workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to delete workflow",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflows/{id}/duplicate:
   *   post:
   *     summary: Duplicate workflow with new name
   *     tags: [Workflows]
   */
  workflowRouter.post(
    "/:id/duplicate",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const { name } = req.body;
        const duplicatedWorkflow = await storage.duplicateWorkflow(
          req.params.id,
          userId,
          name,
        );

        if (!duplicatedWorkflow) {
          return sendError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            "Workflow not found",
          );
        }

        return res.status(201).json({
          success: true,
          data: duplicatedWorkflow,
          message: "Workflow duplicated successfully",
        });
      } catch (error) {
        console.error("Error duplicating workflow:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to duplicate workflow",
        );
      }
    }),
  );

  // ===================
  // WORKFLOW INSTANCE ROUTES
  // ===================

  /**
   * @swagger
   * /api/workflow-instances:
   *   get:
   *     summary: Get all workflow instances for user
   *     tags: [Instances]
   */
  instanceRouter.get(
    "/",
    readLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const instances = await storage.getAllWorkflowInstances(userId);
        return sendSuccess(res, instances);
      } catch (error) {
        console.error("Error fetching workflow instances:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow instances",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-instances/{id}:
   *   get:
   *     summary: Get specific workflow instance with tasks
   *     tags: [Instances]
   */
  instanceRouter.get(
    "/:id",
    readLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const instance = await storage.getWorkflowInstanceById(
          req.params.id,
          userId,
        );

        if (!instance) {
          return sendError(
            res,
            404,
            "INSTANCE_NOT_FOUND",
            "Workflow instance not found",
          );
        }

        return sendSuccess(res, instance);
      } catch (error) {
        console.error("Error fetching workflow instance:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow instance",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-instances/{id}/tasks/{taskId}/complete:
   *   post:
   *     summary: Complete a workflow task
   *     tags: [Instances]
   */
  instanceRouter.post(
    "/:id/tasks/:taskId/complete",
    writeLimiter,
    validateBody(executeTaskSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const { output, notes, assignedContactId } = req.body;

        const result = await storage.completeWorkflowTask(
          req.params.id,
          req.params.taskId,
          { output, notes, assignedContactId },
          userId,
        );

        return sendSuccess(res, result, "Task completed successfully");
      } catch (error) {
        console.error("Error completing workflow task:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to complete workflow task",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-instances/{id}/pause:
   *   post:
   *     summary: Pause workflow instance
   *     tags: [Instances]
   */
  instanceRouter.post(
    "/:id/pause",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const instance = await storage.pauseWorkflowInstance(
          req.params.id,
          userId,
        );
        return sendSuccess(
          res,
          instance,
          "Workflow instance paused successfully",
        );
      } catch (error) {
        console.error("Error pausing workflow instance:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to pause workflow instance",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-instances/{id}/resume:
   *   post:
   *     summary: Resume workflow instance
   *     tags: [Instances]
   */
  instanceRouter.post(
    "/:id/resume",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const instance = await storage.resumeWorkflowInstance(
          req.params.id,
          userId,
        );
        return sendSuccess(
          res,
          instance,
          "Workflow instance resumed successfully",
        );
      } catch (error) {
        console.error("Error resuming workflow instance:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to resume workflow instance",
        );
      }
    }),
  );

  // ===================
  // WORKFLOW TEMPLATE ROUTES
  // ===================

  /**
   * @swagger
   * /api/workflow-templates:
   *   get:
   *     summary: Get workflow templates with categories
   *     tags: [Templates]
   */
  templateRouter.get(
    "/",
    readLimiter,
    validateQuery(templateFiltersSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const filters = req.query;
        const { page = 1, limit = 20, ...templateFilters } = filters;

        const templates = await storage.getWorkflowTemplates(
          userId,
          templateFilters,
        );

        // Simple pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTemplates = templates.slice(startIndex, endIndex);

        return sendPaginated(
          res,
          paginatedTemplates,
          page,
          limit,
          templates.length,
        );
      } catch (error) {
        console.error("Error fetching workflow templates:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch workflow templates",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-templates/categories:
   *   get:
   *     summary: Get available template categories
   *     tags: [Templates]
   */
  templateRouter.get(
    "/categories",
    readLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const categories = await storage.getTemplateCategories();
        return sendSuccess(res, categories);
      } catch (error) {
        console.error("Error fetching template categories:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to fetch template categories",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-templates:
   *   post:
   *     summary: Create new workflow template
   *     tags: [Templates]
   */
  templateRouter.post(
    "/",
    writeLimiter,
    validateBody(createTemplateSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const template = await storage.createWorkflowTemplate(req.body, userId);
        return res.status(201).json({
          success: true,
          data: template,
          message: "Template created successfully",
        });
      } catch (error) {
        console.error("Error creating workflow template:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to create workflow template",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/workflow-templates/{id}/use:
   *   post:
   *     summary: Create workflow from template with customization
   *     tags: [Templates]
   */
  templateRouter.post(
    "/:id/use",
    writeLimiter,
    validateParams(idParamsSchema),
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.userId;
        const { name, customizations } = req.body;
        const workflow = await storage.useWorkflowTemplate(
          req.params.id,
          userId,
          { name, customizations },
        );
        return res.status(201).json({
          success: true,
          data: workflow,
          message: "Workflow created from template successfully",
        });
      } catch (error) {
        console.error("Error using workflow template:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to use workflow template",
        );
      }
    }),
  );

  // Mount routers
  app.use("/api/workflows", workflowRouter);
  app.use("/api/workflow-templates", templateRouter);
  app.use("/api/workflow-instances", instanceRouter);
}
