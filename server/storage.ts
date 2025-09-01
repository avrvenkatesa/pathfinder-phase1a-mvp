import {
  contacts,
  contactSkills,
  contactCertifications,
  contactAvailability,
  workflowAssignments,
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
  type ContactSkill,
  type InsertContactSkill,
  type ContactCertification,
  type InsertContactCertification,
  type ContactAvailability,
  type InsertContactAvailability,
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
  checkContactAssignments(contactId: string, userId: string): Promise<any[]>;
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

  // Contact Skills operations
  getContactSkills(contactId: string): Promise<ContactSkill[]>;
  createContactSkill(skill: InsertContactSkill): Promise<ContactSkill>;
  updateContactSkill(id: string, skill: Partial<InsertContactSkill>): Promise<ContactSkill | undefined>;
  deleteContactSkill(id: string): Promise<boolean>;

  // Contact Certifications operations
  getContactCertifications(contactId: string): Promise<ContactCertification[]>;
  createContactCertification(certification: InsertContactCertification): Promise<ContactCertification>;
  updateContactCertification(id: string, certification: Partial<InsertContactCertification>): Promise<ContactCertification | undefined>;
  deleteContactCertification(id: string): Promise<boolean>;

  // Contact Availability operations
  getContactAvailability(contactId: string): Promise<ContactAvailability[]>;
  createContactAvailability(availability: InsertContactAvailability): Promise<ContactAvailability>;
  updateContactAvailability(id: string, availability: Partial<InsertContactAvailability>): Promise<ContactAvailability | undefined>;
  deleteContactAvailability(id: string): Promise<boolean>;
  
  // Enhanced contact operations for workflow matching
  getContactsBySkills(skillNames: string[], userId: string): Promise<Contact[]>;
  getAvailableContacts(userId: string, workloadThreshold?: number): Promise<Contact[]>;
  calculateContactCapacity(contactId: string): Promise<{ currentCapacity: number; maxCapacity: number; availabilityScore: number }>;
  getContactsForAssignment(requiredSkills: string[], userId: string): Promise<Contact[]>;

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
    // Convert numeric fields properly for database insertion
    const contactData = {
      ...contact,
      userId,
      costPerHour: contact.costPerHour ? String(contact.costPerHour) : undefined,
    };
    
    const [newContact] = await db
      .insert(contacts)
      .values(contactData)
      .returning();
    return newContact;
  }

  async updateContact(id: string, contact: UpdateContact, userId: string): Promise<Contact | undefined> {
    // Convert numeric fields properly for database update
    const updateData = {
      ...contact,
      updatedAt: new Date(),
      costPerHour: contact.costPerHour !== undefined ? String(contact.costPerHour) : undefined,
    };
    
    const [updatedContact] = await db
      .update(contacts)
      .set(updateData)
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

  async checkContactAssignments(contactId: string, userId: string): Promise<any[]> {
    // Check for active workflow assignments
    const assignments = await db
      .select({
        id: workflowAssignments.id,
        workflowName: workflowAssignments.workflowName,
        status: workflowAssignments.status,
        assignedAt: workflowAssignments.assignedAt,
        notes: workflowAssignments.notes,
      })
      .from(workflowAssignments)
      .where(and(
        eq(workflowAssignments.contactId, contactId),
        eq(workflowAssignments.status, "active")
      ));
    
    return assignments;
  }

  async getContactHierarchy(userId: string): Promise<Contact[]> {
    // Get all contacts for the user
    const allContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
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
      .where(eq(contacts.userId, userId));

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
  // Contact Skills operations
  async getContactSkills(contactId: string): Promise<ContactSkill[]> {
    return await db
      .select()
      .from(contactSkills)
      .where(eq(contactSkills.contactId, contactId))
      .orderBy(contactSkills.skillName);
  }

  async createContactSkill(skill: InsertContactSkill): Promise<ContactSkill> {
    const [newSkill] = await db
      .insert(contactSkills)
      .values(skill)
      .returning();
    return newSkill;
  }

  async updateContactSkill(id: string, skill: Partial<InsertContactSkill>): Promise<ContactSkill | undefined> {
    const [updatedSkill] = await db
      .update(contactSkills)
      .set({ ...skill, updatedAt: new Date() })
      .where(eq(contactSkills.id, id))
      .returning();
    return updatedSkill;
  }

  async deleteContactSkill(id: string): Promise<boolean> {
    const result = await db
      .delete(contactSkills)
      .where(eq(contactSkills.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Contact Certifications operations
  async getContactCertifications(contactId: string): Promise<ContactCertification[]> {
    return await db
      .select()
      .from(contactCertifications)
      .where(eq(contactCertifications.contactId, contactId))
      .orderBy(contactCertifications.name);
  }

  async createContactCertification(certification: InsertContactCertification): Promise<ContactCertification> {
    const [newCertification] = await db
      .insert(contactCertifications)
      .values(certification)
      .returning();
    return newCertification;
  }

  async updateContactCertification(id: string, certification: Partial<InsertContactCertification>): Promise<ContactCertification | undefined> {
    const [updatedCertification] = await db
      .update(contactCertifications)
      .set({ ...certification, updatedAt: new Date() })
      .where(eq(contactCertifications.id, id))
      .returning();
    return updatedCertification;
  }

  async deleteContactCertification(id: string): Promise<boolean> {
    const result = await db
      .delete(contactCertifications)
      .where(eq(contactCertifications.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Contact Availability operations
  async getContactAvailability(contactId: string): Promise<ContactAvailability[]> {
    return await db
      .select()
      .from(contactAvailability)
      .where(eq(contactAvailability.contactId, contactId))
      .orderBy(contactAvailability.dayOfWeek, contactAvailability.startTime);
  }

  async createContactAvailability(availability: InsertContactAvailability): Promise<ContactAvailability> {
    const [newAvailability] = await db
      .insert(contactAvailability)
      .values(availability)
      .returning();
    return newAvailability;
  }

  async updateContactAvailability(id: string, availability: Partial<InsertContactAvailability>): Promise<ContactAvailability | undefined> {
    const [updatedAvailability] = await db
      .update(contactAvailability)
      .set({ ...availability, updatedAt: new Date() })
      .where(eq(contactAvailability.id, id))
      .returning();
    return updatedAvailability;
  }

  async deleteContactAvailability(id: string): Promise<boolean> {
    const result = await db
      .delete(contactAvailability)
      .where(eq(contactAvailability.id, id));
    return (result.rowCount || 0) > 0;
  }
  
  // Enhanced contact operations for workflow matching
  async getContactsBySkills(skillNames: string[], userId: string): Promise<Contact[]> {
    // Get contacts that have any of the specified skills
    const contactsWithSkills = await db
      .select({
        contact: contacts,
      })
      .from(contacts)
      .leftJoin(contactSkills, eq(contacts.id, contactSkills.contactId))
      .where(and(
        eq(contacts.userId, userId),
        eq(contacts.isActive, true),
        eq(contacts.type, 'person'),
        inArray(contactSkills.skillName, skillNames)
      ))
      .groupBy(contacts.id);

    return contactsWithSkills.map(row => row.contact);
  }

  async getAvailableContacts(userId: string, workloadThreshold: number = 80): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        eq(contacts.isActive, true),
        eq(contacts.type, 'person'),
        eq(contacts.availabilityStatus, 'available')
      ))
      .orderBy(contacts.currentWorkload);
  }

  async calculateContactCapacity(contactId: string): Promise<{ currentCapacity: number; maxCapacity: number; availabilityScore: number }> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    if (!contact) {
      return { currentCapacity: 0, maxCapacity: 0, availabilityScore: 0 };
    }

    const currentCapacity = contact.currentWorkload || 0;
    const maxCapacity = contact.maxConcurrentTasks || 5;
    const availabilityScore = Math.max(0, (maxCapacity - currentCapacity) / maxCapacity * 100);

    return {
      currentCapacity,
      maxCapacity,
      availabilityScore: Math.round(availabilityScore)
    };
  }

  async getContactsForAssignment(requiredSkills: string[], userId: string): Promise<Contact[]> {
    // Get contacts with matching skills and calculate their suitability
    const contactsWithSkills = await db
      .select({
        contact: contacts,
        skill: contactSkills,
      })
      .from(contacts)
      .leftJoin(contactSkills, eq(contacts.id, contactSkills.contactId))
      .where(and(
        eq(contacts.userId, userId),
        eq(contacts.isActive, true),
        eq(contacts.type, 'person'),
        or(
          inArray(contactSkills.skillName, requiredSkills),
          isNull(contactSkills.skillName) // Include contacts without specific skills
        )
      ));

    // Group by contact and calculate skill match score
    const contactMap = new Map<string, Contact>();
    const skillMatchMap = new Map<string, number>();

    contactsWithSkills.forEach(row => {
      const contact = row.contact;
      contactMap.set(contact.id, contact);
      
      if (row.skill && requiredSkills.includes(row.skill.skillName)) {
        const currentScore = skillMatchMap.get(contact.id) || 0;
        skillMatchMap.set(contact.id, currentScore + 1);
      }
    });

    // Convert to array and sort by skill match score and availability
    const result = Array.from(contactMap.values())
      .map(contact => ({
        ...contact,
        skillMatchScore: skillMatchMap.get(contact.id) || 0,
      }))
      .sort((a, b) => {
        // Sort by skill match first, then by current workload (lower is better)
        if (a.skillMatchScore !== b.skillMatchScore) {
          return b.skillMatchScore - a.skillMatchScore;
        }
        return (a.currentWorkload || 0) - (b.currentWorkload || 0);
      });

    return result;
  }
}

export const storage = new DatabaseStorage();
