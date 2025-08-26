import {
  workflows,
  workflowInstances,
  workflowTasks,
  workflowTemplates,
  workflowElements,
  workflowExecutionHistory,
  type Workflow,
  type InsertWorkflow,
  type UpdateWorkflow,
  type WorkflowInstance,
  type InsertWorkflowInstance,
  type WorkflowTask,
  type InsertWorkflowTask,
  type WorkflowTemplate,
  type InsertWorkflowTemplate,
  type WorkflowElement,
  type InsertWorkflowElement,
  type WorkflowDefinition,
  type BpmnElement,
  type BpmnConnection,
} from "../../../shared/types/schema";
import { db } from "./db";
import {
  eq,
  and,
  isNull,
  or,
  ilike,
  inArray,
  desc,
  sql,
  count,
} from "drizzle-orm";

export interface WorkflowFilters {
  search?: string;
  status?: string[];
  category?: string;
  isTemplate?: boolean;
}

export interface TemplateFilters {
  search?: string;
  category?: string;
  isPublic?: boolean;
}

export interface WorkflowStats {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  runningInstances: number;
  templates: number;
  recentActivity: any[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  elementCount: number;
  connectionCount: number;
}

export interface IWorkflowStorage {
  // Workflow operations
  getWorkflows(userId: string, filters?: WorkflowFilters): Promise<Workflow[]>;
  getWorkflowById(id: string, userId: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow, userId: string): Promise<Workflow>;
  updateWorkflow(
    id: string,
    workflow: UpdateWorkflow,
    userId: string,
  ): Promise<Workflow | undefined>;
  deleteWorkflow(id: string, userId: string): Promise<boolean>;
  duplicateWorkflow(
    id: string,
    userId: string,
    newName?: string,
  ): Promise<Workflow | undefined>;

  // Workflow execution
  executeWorkflow(
    workflowId: string,
    userId: string,
    options: { variables?: any; name?: string },
  ): Promise<WorkflowInstance>;
  getWorkflowInstances(
    workflowId: string,
    userId: string,
  ): Promise<WorkflowInstance[]>;
  getAllWorkflowInstances(userId: string): Promise<WorkflowInstance[]>;
  getWorkflowInstanceById(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance | undefined>;

  // Task management
  completeWorkflowTask(
    instanceId: string,
    taskId: string,
    data: { output?: any; notes?: string; assignedContactId?: string },
    userId: string,
  ): Promise<any>;
  pauseWorkflowInstance(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance>;
  resumeWorkflowInstance(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance>;

  // Templates
  getWorkflowTemplates(
    userId: string,
    filters?: TemplateFilters,
  ): Promise<WorkflowTemplate[]>;
  createWorkflowTemplate(
    template: InsertWorkflowTemplate,
    userId: string,
  ): Promise<WorkflowTemplate>;
  useWorkflowTemplate(
    templateId: string,
    userId: string,
    options?: { name?: string; customizations?: any },
  ): Promise<Workflow>;
  getTemplateCategories(): Promise<string[]>;

  // Analytics and validation
  getWorkflowStats(userId: string): Promise<WorkflowStats>;
  validateWorkflowDefinition(
    definition: WorkflowDefinition,
  ): Promise<ValidationResult>;
}

export class WorkflowStorage implements IWorkflowStorage {
  // ===================
  // WORKFLOW OPERATIONS
  // ===================

  async getWorkflows(
    userId: string,
    filters?: WorkflowFilters,
  ): Promise<Workflow[]> {
    const conditions = [eq(workflows.userId, userId)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(workflows.name, `%${filters.search}%`),
          ilike(workflows.description, `%${filters.search}%`),
          ilike(workflows.category, `%${filters.search}%`),
        )!,
      );
    }

    if (filters?.status && filters.status.length > 0) {
      conditions.push(inArray(workflows.status, filters.status as any[]));
    }

    if (filters?.category) {
      conditions.push(eq(workflows.category, filters.category));
    }

    if (filters?.isTemplate !== undefined) {
      conditions.push(eq(workflows.isTemplate, filters.isTemplate));
    }

    return await db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt));
  }

  async getWorkflowById(
    id: string,
    userId: string,
  ): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

    if (!workflow) return undefined;

    // Get related elements and instances
    const [elements, instances] = await Promise.all([
      db
        .select()
        .from(workflowElements)
        .where(eq(workflowElements.workflowId, id)),
      db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.workflowId, id))
        .limit(5),
    ]);

    return {
      ...workflow,
      elements,
      instances,
    };
  }

  async createWorkflow(
    workflow: InsertWorkflow,
    userId: string,
  ): Promise<Workflow> {
    const workflowData = {
      ...workflow,
      userId,
      createdBy: userId,
      status: workflow.status || "draft",
      version: workflow.version || "1.0",
    };

    const [newWorkflow] = await db
      .insert(workflows)
      .values(workflowData)
      .returning();

    // Create workflow elements if definition includes elements
    if (workflow.definitionJson && workflow.definitionJson.elements) {
      const elements = workflow.definitionJson.elements.map((element: any) => ({
        workflowId: newWorkflow.id,
        elementId: element.id,
        elementType: element.type,
        name: element.name,
        properties: element.properties || {},
        position: element.position,
        connections: element.connections || [],
      }));

      await db.insert(workflowElements).values(elements);
    }

    return newWorkflow;
  }

  async updateWorkflow(
    id: string,
    workflow: UpdateWorkflow,
    userId: string,
  ): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await db
      .update(workflows)
      .set({ ...workflow, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
      .returning();

    if (!updatedWorkflow) return undefined;

    // Update workflow elements if definition changed
    if (workflow.definitionJson && workflow.definitionJson.elements) {
      // Delete existing elements
      await db
        .delete(workflowElements)
        .where(eq(workflowElements.workflowId, id));

      // Insert new elements
      const elements = workflow.definitionJson.elements.map((element: any) => ({
        workflowId: id,
        elementId: element.id,
        elementType: element.type,
        name: element.name,
        properties: element.properties || {},
        position: element.position,
        connections: element.connections || [],
      }));

      await db.insert(workflowElements).values(elements);
    }

    return updatedWorkflow;
  }

  async deleteWorkflow(id: string, userId: string): Promise<boolean> {
    // Check for running instances
    const runningInstances = await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.workflowId, id),
          inArray(workflowInstances.status, ["pending", "running"]),
        ),
      );

    if (runningInstances.length > 0) {
      throw new Error("Cannot delete workflow with running instances");
    }

    // Delete related data
    await db
      .delete(workflowElements)
      .where(eq(workflowElements.workflowId, id));

    // Delete the workflow
    const result = await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

    return (result.rowCount || 0) > 0;
  }

  async duplicateWorkflow(
    id: string,
    userId: string,
    newName?: string,
  ): Promise<Workflow | undefined> {
    const original = await this.getWorkflowById(id, userId);
    if (!original) return undefined;

    const duplicateData = {
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      definitionJson: original.definitionJson,
      bpmnXml: original.bpmnXml,
      status: "draft" as const,
      version: "1.0",
      isTemplate: false,
      isPublic: false,
    };

    return await this.createWorkflow(duplicateData, userId);
  }

  // ===================
  // WORKFLOW EXECUTION
  // ===================

  async executeWorkflow(
    workflowId: string,
    userId: string,
    options: { variables?: any; name?: string },
  ): Promise<WorkflowInstance> {
    const workflow = await this.getWorkflowById(workflowId, userId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    const instanceData = {
      workflowId,
      name: options.name || `${workflow.name} - ${new Date().toISOString()}`,
      status: "pending" as const,
      variables: options.variables || {},
      createdBy: userId,
      userId,
      startedAt: new Date(),
    };

    const [instance] = await db
      .insert(workflowInstances)
      .values(instanceData)
      .returning();

    // Create initial tasks from workflow definition
    if (workflow.definitionJson && workflow.definitionJson.elements) {
      const startEvents = workflow.definitionJson.elements.filter(
        (el: BpmnElement) => el.type === "start_event",
      );

      for (const startEvent of startEvents) {
        await db.insert(workflowTasks).values({
          instanceId: instance.id,
          elementId: startEvent.id,
          taskName: startEvent.name,
          taskType: startEvent.type,
          status: "pending",
          input: {},
          output: {},
        });
      }
    }

    // Log execution start
    await db.insert(workflowExecutionHistory).values({
      instanceId: instance.id,
      action: "started",
      details: { variables: options.variables },
      executedBy: userId,
    });

    return instance;
  }

  async getWorkflowInstances(
    workflowId: string,
    userId: string,
  ): Promise<WorkflowInstance[]> {
    return await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.workflowId, workflowId),
          eq(workflowInstances.userId, userId),
        ),
      )
      .orderBy(desc(workflowInstances.createdAt));
  }

  async getAllWorkflowInstances(userId: string): Promise<WorkflowInstance[]> {
    return await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.userId, userId))
      .orderBy(desc(workflowInstances.createdAt));
  }

  async getWorkflowInstanceById(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance | undefined> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.id, instanceId),
          eq(workflowInstances.userId, userId),
        ),
      );

    if (!instance) return undefined;

    // Get related tasks and execution history
    const [tasks, history] = await Promise.all([
      db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.instanceId, instanceId)),
      db
        .select()
        .from(workflowExecutionHistory)
        .where(eq(workflowExecutionHistory.instanceId, instanceId))
        .orderBy(desc(workflowExecutionHistory.executedAt)),
    ]);

    return {
      ...instance,
      tasks,
      executionHistory: history,
    };
  }

  async completeWorkflowTask(
    instanceId: string,
    taskId: string,
    data: { output?: any; notes?: string; assignedContactId?: string },
    userId: string,
  ): Promise<any> {
    // Update task status
    const [updatedTask] = await db
      .update(workflowTasks)
      .set({
        status: "completed",
        output: data.output || {},
        notes: data.notes,
        assignedContactId: data.assignedContactId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowTasks.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new Error("Task not found");
    }

    // Log task completion
    await db.insert(workflowExecutionHistory).values({
      instanceId,
      stepId: updatedTask.elementId,
      action: "task_completed",
      details: { taskId, output: data.output },
      executedBy: userId,
    });

    // Check if workflow instance is complete
    const incompleteTasks = await db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.instanceId, instanceId),
          inArray(workflowTasks.status, ["pending", "in_progress"]),
        ),
      );

    if (incompleteTasks.length === 0) {
      // Mark instance as completed
      await db
        .update(workflowInstances)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowInstances.id, instanceId));
    }

    return updatedTask;
  }

  async pauseWorkflowInstance(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance> {
    const [pausedInstance] = await db
      .update(workflowInstances)
      .set({
        status: "paused" as any,
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflowInstances.id, instanceId),
          eq(workflowInstances.userId, userId),
        ),
      )
      .returning();

    if (!pausedInstance) {
      throw new Error("Workflow instance not found");
    }

    // Log pause action
    await db.insert(workflowExecutionHistory).values({
      instanceId,
      action: "paused",
      details: {},
      executedBy: userId,
    });

    return pausedInstance;
  }

  async resumeWorkflowInstance(
    instanceId: string,
    userId: string,
  ): Promise<WorkflowInstance> {
    const [resumedInstance] = await db
      .update(workflowInstances)
      .set({
        status: "running",
        pausedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflowInstances.id, instanceId),
          eq(workflowInstances.userId, userId),
        ),
      )
      .returning();

    if (!resumedInstance) {
      throw new Error("Workflow instance not found");
    }

    // Log resume action
    await db.insert(workflowExecutionHistory).values({
      instanceId,
      action: "resumed",
      details: {},
      executedBy: userId,
    });

    return resumedInstance;
  }

  // ===================
  // TEMPLATE OPERATIONS
  // ===================

  async getWorkflowTemplates(
    userId: string,
    filters?: TemplateFilters,
  ): Promise<WorkflowTemplate[]> {
    const conditions = [];

    // User can see their own templates and public templates
    conditions.push(
      or(
        eq(workflowTemplates.userId, userId),
        eq(workflowTemplates.isPublic, true),
      )!,
    );

    if (filters?.search) {
      conditions.push(
        or(
          ilike(workflowTemplates.name, `%${filters.search}%`),
          ilike(workflowTemplates.description, `%${filters.search}%`),
        )!,
      );
    }

    if (filters?.category) {
      conditions.push(eq(workflowTemplates.category, filters.category));
    }

    if (filters?.isPublic !== undefined) {
      conditions.push(eq(workflowTemplates.isPublic, filters.isPublic));
    }

    return await db
      .select()
      .from(workflowTemplates)
      .where(and(...conditions))
      .orderBy(desc(workflowTemplates.updatedAt));
  }

  async createWorkflowTemplate(
    template: InsertWorkflowTemplate,
    userId: string,
  ): Promise<WorkflowTemplate> {
    const templateData = {
      ...template,
      userId,
      createdBy: userId,
      usageCount: "0",
    };

    const [newTemplate] = await db
      .insert(workflowTemplates)
      .values(templateData)
      .returning();

    return newTemplate;
  }

  async useWorkflowTemplate(
    templateId: string,
    userId: string,
    options?: { name?: string; customizations?: any },
  ): Promise<Workflow> {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(
        and(
          eq(workflowTemplates.id, templateId),
          or(
            eq(workflowTemplates.userId, userId),
            eq(workflowTemplates.isPublic, true),
          ),
        ),
      );

    if (!template) {
      throw new Error("Template not found or not accessible");
    }

    // Increment usage count
    const currentUsage = parseInt(template.usageCount) + 1;
    await db
      .update(workflowTemplates)
      .set({ usageCount: currentUsage.toString() })
      .where(eq(workflowTemplates.id, templateId));

    // Create workflow from template
    const workflowData = {
      name: options?.name || `${template.name} - ${new Date().toISOString()}`,
      description: template.description,
      category: template.category,
      definitionJson: options?.customizations
        ? { ...template.workflowDefinition, ...options.customizations }
        : template.workflowDefinition,
      status: "draft" as const,
      version: "1.0",
      isTemplate: false,
      isPublic: false,
    };

    return await this.createWorkflow(workflowData, userId);
  }

  async getTemplateCategories(): Promise<string[]> {
    const result = await db
      .selectDistinct({ category: workflowTemplates.category })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.isPublic, true));

    return result.map((r) => r.category).filter(Boolean);
  }

  // ===================
  // ANALYTICS & VALIDATION
  // ===================

  async getWorkflowStats(userId: string): Promise<WorkflowStats> {
    const [
      totalWorkflows,
      activeWorkflows,
      completedWorkflows,
      runningInstances,
      templates,
      recentActivity,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(workflows)
        .where(eq(workflows.userId, userId)),
      db
        .select({ count: count() })
        .from(workflows)
        .where(
          and(eq(workflows.userId, userId), eq(workflows.status, "active")),
        ),
      db
        .select({ count: count() })
        .from(workflowInstances)
        .where(
          and(
            eq(workflowInstances.userId, userId),
            eq(workflowInstances.status, "completed"),
          ),
        ),
      db
        .select({ count: count() })
        .from(workflowInstances)
        .where(
          and(
            eq(workflowInstances.userId, userId),
            eq(workflowInstances.status, "running"),
          ),
        ),
      db
        .select({ count: count() })
        .from(workflowTemplates)
        .where(eq(workflowTemplates.userId, userId)),
      db
        .select()
        .from(workflowExecutionHistory)
        .limit(10)
        .orderBy(desc(workflowExecutionHistory.executedAt)),
    ]);

    return {
      totalWorkflows: totalWorkflows[0].count,
      activeWorkflows: activeWorkflows[0].count,
      completedWorkflows: completedWorkflows[0].count,
      runningInstances: runningInstances[0].count,
      templates: templates[0].count,
      recentActivity,
    };
  }

  async validateWorkflowDefinition(
    definition: WorkflowDefinition,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!definition.elements || definition.elements.length === 0) {
      errors.push("Workflow must contain at least one element");
    }

    if (!definition.connections || definition.connections.length === 0) {
      warnings.push("Workflow has no connections between elements");
    }

    // Check for start and end events
    const startEvents = definition.elements.filter(
      (el) => el.type === "start_event",
    );
    const endEvents = definition.elements.filter(
      (el) => el.type === "end_event",
    );

    if (startEvents.length === 0) {
      errors.push("Workflow must have at least one start event");
    }

    if (endEvents.length === 0) {
      warnings.push("Workflow should have at least one end event");
    }

    // Validate connections
    const elementIds = new Set(definition.elements.map((el) => el.id));
    for (const connection of definition.connections) {
      if (!elementIds.has(connection.sourceId)) {
        errors.push(`Connection source '${connection.sourceId}' not found`);
      }
      if (!elementIds.has(connection.targetId)) {
        errors.push(`Connection target '${connection.targetId}' not found`);
      }
    }

    // Check for orphaned elements
    const connectedElements = new Set([
      ...definition.connections.map((c) => c.sourceId),
      ...definition.connections.map((c) => c.targetId),
    ]);

    const orphanedElements = definition.elements.filter(
      (el) => !connectedElements.has(el.id) && el.type !== "start_event",
    );

    if (orphanedElements.length > 0) {
      warnings.push(
        `${orphanedElements.length} element(s) are not connected to the workflow`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      elementCount: definition.elements.length,
      connectionCount: definition.connections.length,
    };
  }
}

export const storage = new WorkflowStorage();
