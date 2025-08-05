import {
  contacts,
  users,
  workflows,
  workflowInstances,
  workflowTasks,
  workflowTemplates,
  workflowElements,
  workflowExecutionHistory,
  type Contact,
  type InsertContact,
  type UpdateContact,
  type User,
  type UpsertUser,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, or, ilike, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Contact operations
  getContacts(userId: string, filters?: ContactFilters): Promise<Contact[]>;
  getContactById(id: string, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, userId: string): Promise<Contact>;
  updateContact(id: string, contact: UpdateContact, userId: string): Promise<Contact | undefined>;
  deleteContact(id: string, userId: string): Promise<boolean>;
  getContactHierarchy(userId: string): Promise<Contact[]>;
  getContactStats(userId: string): Promise<ContactStats>;
  
  // Advanced hierarchy operations
  getContactRelationships(userId: string): Promise<any[]>;
  createContactRelationship(relationshipData: any): Promise<any>;
  updateContactRelationship(id: string, relationshipData: any, userId: string): Promise<any>;
  deleteContactRelationship(id: string, userId: string): Promise<boolean>;
  bulkUpdateRelationships(relationshipIds: string[], operation: string, userId: string): Promise<number>;
  getHierarchyChanges(userId: string, contactId?: string): Promise<any[]>;
  createHierarchyChange(changeData: any): Promise<any>;
  getWorkflowAssignments(userId: string, filters?: any): Promise<any[]>;
  createWorkflowAssignment(assignmentData: any): Promise<any>;

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

export interface ContactFilters {
  search?: string;
  type?: string[];
  tags?: string[];
  location?: string;
  isActive?: boolean;
}

export interface ContactStats {
  totalCompanies: number;
  totalDivisions: number;
  totalPeople: number;
}

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

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Contact operations
  async getContacts(userId: string, filters?: ContactFilters): Promise<Contact[]> {
    const conditions = [eq(contacts.userId, userId)];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(contacts.name, `%${filters.search}%`),
          ilike(contacts.email, `%${filters.search}%`),
          ilike(contacts.description, `%${filters.search}%`)
        )!
      );
    }
    
    if (filters?.type && filters.type.length > 0) {
      conditions.push(inArray(contacts.type, filters.type as ("company" | "division" | "person")[]));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(contacts.isActive, filters.isActive));
    }

    return await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(contacts.createdAt);
  }

  async getContactById(id: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return contact;
  }

  async createContact(contact: InsertContact, userId: string): Promise<Contact> {
    const [newContact] = await db
      .insert(contacts)
      .values({ ...contact, userId })
      .returning();
    return newContact;
  }

  async updateContact(id: string, contact: UpdateContact, userId: string): Promise<Contact | undefined> {
    const [updatedContact] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    return updatedContact;
  }

  async deleteContact(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getContactHierarchy(userId: string): Promise<Contact[]> {
    // Get all contacts for the user
    const allContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.isActive, true)))
      .orderBy(contacts.name);

    // Build hierarchy
    const contactMap = new Map<string, Contact>();
    const rootContacts: Contact[] = [];

    // First pass: create contact map
    allContacts.forEach(contact => {
      contactMap.set(contact.id, { ...contact, children: [] });
    });

    // Second pass: build hierarchy (without circular references)
    allContacts.forEach(contact => {
      const contactWithChildren = contactMap.get(contact.id)!;
      
      if (contact.parentId) {
        const parent = contactMap.get(contact.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(contactWithChildren);
          // Don't set parent reference to avoid circular JSON
        }
      } else {
        rootContacts.push(contactWithChildren);
      }
    });

    return rootContacts;
  }

  async getContactStats(userId: string): Promise<ContactStats> {
    const allContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.isActive, true)));

    const stats = {
      totalCompanies: 0,
      totalDivisions: 0,
      totalPeople: 0,
    };

    allContacts.forEach(contact => {
      switch (contact.type) {
        case 'company':
          stats.totalCompanies++;
          break;
        case 'division':
          stats.totalDivisions++;
          break;
        case 'person':
          stats.totalPeople++;
          break;
      }
    });

    return stats;
  }

  // Advanced hierarchy operations
  async getContactRelationships(userId: string): Promise<any[]> {
    const relationships = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId));
    return [];
  }

  async createContactRelationship(relationshipData: any): Promise<any> {
    return {};
  }

  async updateContactRelationship(id: string, relationshipData: any, userId: string): Promise<any> {
    return {};
  }

  async deleteContactRelationship(id: string, userId: string): Promise<boolean> {
    return true;
  }

  async bulkUpdateRelationships(relationshipIds: string[], operation: string, userId: string): Promise<number> {
    return 0;
  }

  async getHierarchyChanges(userId: string, contactId?: string): Promise<any[]> {
    return [];
  }

  async createHierarchyChange(changeData: any): Promise<any> {
    return {};
  }

  async getWorkflowAssignments(userId: string, filters?: any): Promise<any[]> {
    return [];
  }

  async createWorkflowAssignment(assignmentData: any): Promise<any> {
    return {};
  }

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
      definitionJson: original.definitionJson,
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
      .set({ usageCount: String(parseInt(template.usageCount) + 1) })
      .where(eq(workflowTemplates.id, templateId));

    // Create workflow from template
    const workflow = await this.createWorkflow({
      name: template.name,
      description: template.description,
      category: template.category,
      definitionJson: template.workflowDefinition,
      status: 'draft',
      version: '1.0',
      isTemplate: false,
      isPublic: false,
    }, userId);

    return workflow;
  }
}

export const storage = new DatabaseStorage();
