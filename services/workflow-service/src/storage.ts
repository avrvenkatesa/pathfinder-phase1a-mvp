import {
  workflows,
  workflowTemplates,
  workflowInstances,
  workflowTasks,
  type Workflow,
  type InsertWorkflow,
  type UpdateWorkflow,
  type WorkflowTemplate,
  type InsertWorkflowTemplate,
  type WorkflowInstance,
  type InsertWorkflowInstance,
  type WorkflowTask,
  type InsertWorkflowTask,
} from "../../../shared/types/schema";
import { db } from "./db";
import { eq, and, or, ilike, inArray } from "drizzle-orm";

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

export interface IWorkflowStorage {
  // Workflow operations
  getWorkflows(userId: string, filters?: WorkflowFilters): Promise<Workflow[]>;
  getWorkflowById(id: string, userId: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow, userId: string): Promise<Workflow>;
  updateWorkflow(id: string, workflow: UpdateWorkflow, userId: string): Promise<Workflow | undefined>;
  deleteWorkflow(id: string, userId: string): Promise<boolean>;
  duplicateWorkflow(id: string, userId: string): Promise<Workflow | undefined>;
  
  // Workflow execution operations
  createWorkflowInstance(workflowId: string, data: Partial<InsertWorkflowInstance>, userId: string): Promise<WorkflowInstance>;
  getWorkflowInstance(id: string, userId: string): Promise<WorkflowInstance | undefined>;
  updateWorkflowInstance(id: string, data: any, userId: string): Promise<WorkflowInstance | undefined>;
  getWorkflowInstancesByWorkflow(workflowId: string, userId: string): Promise<WorkflowInstance[]>;
  
  // Workflow task operations
  createWorkflowTask(task: InsertWorkflowTask): Promise<WorkflowTask>;
  updateWorkflowTask(id: string, task: any): Promise<WorkflowTask | undefined>;
  getWorkflowTasksByInstance(instanceId: string): Promise<WorkflowTask[]>;
  
  // Workflow template operations
  getWorkflowTemplates(userId: string, filters?: TemplateFilters): Promise<WorkflowTemplate[]>;
  createWorkflowTemplate(template: InsertWorkflowTemplate, userId: string): Promise<WorkflowTemplate>;
  useWorkflowTemplate(templateId: string, userId: string): Promise<Workflow>;
}

export class WorkflowStorage implements IWorkflowStorage {
  // Workflow operations
  async getWorkflows(userId: string, filters?: WorkflowFilters): Promise<Workflow[]> {
    const conditions = [eq(workflows.userId, userId)];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(workflows.name, `%${filters.search}%`),
          ilike(workflows.description, `%${filters.search}%`)
        )!
      );
    }
    
    if (filters?.status && filters.status.length > 0) {
      conditions.push(inArray(workflows.status, filters.status as any));
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
      .orderBy(workflows.updatedAt);
  }

  async getWorkflowById(id: string, userId: string): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));
    return workflow;
  }

  async createWorkflow(workflow: InsertWorkflow, userId: string): Promise<Workflow> {
    const [newWorkflow] = await db
      .insert(workflows)
      .values({ ...workflow, userId, createdBy: userId })
      .returning();
    return newWorkflow;
  }

  async updateWorkflow(id: string, workflow: UpdateWorkflow, userId: string): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await db
      .update(workflows)
      .set({ ...workflow, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
      .returning();
    return updatedWorkflow;
  }

  async deleteWorkflow(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async duplicateWorkflow(id: string, userId: string): Promise<Workflow | undefined> {
    const original = await this.getWorkflowById(id, userId);
    if (!original) return undefined;

    const duplicated = await this.createWorkflow({
      name: `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      definitionJson: original.definitionJson as any,
      bpmnXml: original.bpmnXml,
      status: 'draft',
      version: '1.0',
      isTemplate: false,
      isPublic: false,
    }, userId);

    return duplicated;
  }

  // Workflow execution operations
  async createWorkflowInstance(workflowId: string, data: Partial<InsertWorkflowInstance>, userId: string): Promise<WorkflowInstance> {
    const [instance] = await db
      .insert(workflowInstances)
      .values({
        workflowId,
        name: data.name,
        status: data.status || 'pending',
        variables: data.variables || {},
        createdBy: userId,
        userId,
        ...data,
      })
      .returning();
    return instance;
  }

  async getWorkflowInstance(id: string, userId: string): Promise<WorkflowInstance | undefined> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(and(eq(workflowInstances.id, id), eq(workflowInstances.userId, userId)));
    return instance;
  }

  async updateWorkflowInstance(id: string, data: any, userId: string): Promise<WorkflowInstance | undefined> {
    const [updated] = await db
      .update(workflowInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workflowInstances.id, id), eq(workflowInstances.userId, userId)))
      .returning();
    return updated;
  }

  async getWorkflowInstancesByWorkflow(workflowId: string, userId: string): Promise<WorkflowInstance[]> {
    return await db
      .select()
      .from(workflowInstances)
      .where(and(eq(workflowInstances.workflowId, workflowId), eq(workflowInstances.userId, userId)))
      .orderBy(workflowInstances.createdAt);
  }

  // Workflow task operations
  async createWorkflowTask(task: InsertWorkflowTask): Promise<WorkflowTask> {
    const [newTask] = await db
      .insert(workflowTasks)
      .values(task)
      .returning();
    return newTask;
  }

  async updateWorkflowTask(id: string, task: any): Promise<WorkflowTask | undefined> {
    const [updated] = await db
      .update(workflowTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(workflowTasks.id, id))
      .returning();
    return updated;
  }

  async getWorkflowTasksByInstance(instanceId: string): Promise<WorkflowTask[]> {
    return await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.instanceId, instanceId))
      .orderBy(workflowTasks.createdAt);
  }

  // Workflow template operations
  async getWorkflowTemplates(userId: string, filters?: TemplateFilters): Promise<WorkflowTemplate[]> {
    const conditions = [
      or(
        eq(workflowTemplates.userId, userId),
        eq(workflowTemplates.isPublic, true)
      )!
    ];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(workflowTemplates.name, `%${filters.search}%`),
          ilike(workflowTemplates.description, `%${filters.search}%`)
        )!
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
      .orderBy(workflowTemplates.updatedAt);
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate, userId: string): Promise<WorkflowTemplate> {
    const [newTemplate] = await db
      .insert(workflowTemplates)
      .values({ ...template, userId, createdBy: userId })
      .returning();
    return newTemplate;
  }

  async useWorkflowTemplate(templateId: string, userId: string): Promise<Workflow> {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId));
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Increment usage count
    await db
      .update(workflowTemplates)
      .set({ usageCount: String(parseInt(template.usageCount || '0') + 1) })
      .where(eq(workflowTemplates.id, templateId));

    // Create workflow from template
    const workflow = await this.createWorkflow({
      name: template.name,
      description: template.description,
      category: template.category,
      definitionJson: template.workflowDefinition as any,
      status: 'draft',
      version: '1.0',
      isTemplate: false,
      isPublic: false,
    }, userId);

    return workflow;
  }
}

export const storage = new WorkflowStorage();