import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
  boolean,
  integer,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  password: varchar("password"), // Optional for OAuth users
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  role: varchar("role"),
  isActive: boolean("is_active").default(true),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact type enum
export const contactTypeEnum = pgEnum("contact_type", ["company", "division", "person"]);

// Availability status enum
export const availabilityStatusEnum = pgEnum("availability_status", ["available", "busy", "partially_available", "unavailable"]);

// Role preference enum
export const rolePreferenceEnum = pgEnum("role_preference", ["leader", "contributor", "specialist", "advisor", "any"]);

// Workflow role enum
export const workflowRoleEnum = pgEnum("workflow_role", ["approver", "executor", "reviewer", "observer"]);

// Skill proficiency level enum
export const proficiencyLevelEnum = pgEnum("proficiency_level", ["beginner", "intermediate", "advanced", "expert"]);

// Main contacts table with hierarchical structure
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Basic Information
  firstName: varchar("first_name"),
  lastName: varchar("last_name"), 
  name: text("name").notNull(), // Full name or company/division name
  type: contactTypeEnum("type").notNull(),
  jobTitle: varchar("job_title"), // Job title for persons
  department: varchar("department"), // Department for persons
  title: varchar("title"), // Legacy field for backward compatibility
  description: text("description"), // Company/division description
  
  // Contact Details
  email: varchar("email"),
  phone: varchar("phone"),
  secondaryPhone: varchar("secondary_phone"),
  address: text("address"),
  website: varchar("website"),
  
  // Organizational Hierarchy
  parentId: varchar("parent_id"),
  userId: varchar("user_id").notNull(), // Owner of the contact
  
  // Skills & Availability
  skills: text("skills").array().default([]),
  availabilityStatus: availabilityStatusEnum("availability_status").default("available"),
  preferredWorkHours: varchar("preferred_work_hours"), // Legacy field, kept for compatibility
  workStartTime: varchar("work_start_time"), // e.g., "09:00"
  workEndTime: varchar("work_end_time"), // e.g., "17:00"  
  workTimezone: varchar("work_timezone").default("UTC"), // Timezone for work hours
  
  // Workflow Preferences
  rolePreference: rolePreferenceEnum("role_preference").default("any"),
  projectTypes: text("project_types").array().default([]),
  assignmentCapacity: varchar("assignment_capacity").default("normal"), // low, normal, high
  
  // Enhanced Workflow Fields
  workflowRole: workflowRoleEnum("workflow_role"),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
  costPerHour: decimal("cost_per_hour", { precision: 10, scale: 2 }),
  timezone: varchar("timezone").default("UTC"),
  languages: text("languages").array().default(["English"]),
  currentWorkload: integer("current_workload").default(0),
  skillProficiency: jsonb("skill_proficiency"), // JSON object mapping skills to proficiency levels
  certifications: jsonb("certifications"), // Array of certification objects
  
  // Legacy/General
  tags: text("tags").array().default([]),
  notes: text("notes"), // Contact-specific notes
  isActive: boolean("is_active").default(true),
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow assignments table for tracking contact workflow history
export const workflowAssignments = pgTable("workflow_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  workflowName: varchar("workflow_name").notNull(),
  status: varchar("status").notNull().default("active"), // active, completed, cancelled
  assignedAt: timestamp("assigned_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

// Contact activity log for tracking interactions and updates
export const contactActivities = pgTable("contact_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  activityType: varchar("activity_type").notNull(), // created, updated, assigned, contacted, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // JSON data for additional context
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id").notNull(),
});

// Contact skills with proficiency levels
export const contactSkills = pgTable("contact_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  skillName: varchar("skill_name").notNull(),
  proficiencyLevel: proficiencyLevelEnum("proficiency_level").notNull().default("intermediate"),
  yearsExperience: integer("years_experience"),
  isCertified: boolean("is_certified").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact certifications
export const contactCertifications = pgTable("contact_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  name: varchar("name").notNull(),
  issuer: varchar("issuer").notNull(),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  credentialId: varchar("credential_id"),
  verificationUrl: varchar("verification_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact weekly availability schedule
export const contactAvailability = pgTable("contact_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: varchar("start_time").notNull(), // "09:00"
  endTime: varchar("end_time").notNull(), // "17:00"
  isAvailable: boolean("is_available").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relationship types enum
export const relationshipTypeEnum = pgEnum("relationship_type", [
  "reports_to", "works_with", "supervises", "collaborates", "manages", "peers"
]);

// Contact relationships table for advanced relationship management
export const contactRelationships = pgTable("contact_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromContactId: varchar("from_contact_id").notNull(),
  toContactId: varchar("to_contact_id").notNull(),
  relationshipType: relationshipTypeEnum("relationship_type").notNull(),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: varchar("user_id").notNull(),
});

// Hierarchy change history for tracking organization moves
export const hierarchyChanges = pgTable("hierarchy_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  oldParentId: varchar("old_parent_id"),
  newParentId: varchar("new_parent_id"),
  changeReason: text("change_reason"),
  changedAt: timestamp("changed_at").defaultNow(),
  userId: varchar("user_id").notNull(),
});

// Relations
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  parent: one(contacts, {
    fields: [contacts.parentId],
    references: [contacts.id],
    relationName: "parent_child",
  }),
  children: many(contacts, {
    relationName: "parent_child",
  }),
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  workflowAssignments: many(workflowAssignments),
  activities: many(contactActivities),
  relationshipsFrom: many(contactRelationships, { relationName: "from_relationship" }),
  relationshipsTo: many(contactRelationships, { relationName: "to_relationship" }),
  hierarchyChanges: many(hierarchyChanges),
  skills: many(contactSkills),
  certifications: many(contactCertifications),
  availability: many(contactAvailability),
}));

export const contactSkillsRelations = relations(contactSkills, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactSkills.contactId],
    references: [contacts.id],
  }),
}));

export const contactCertificationsRelations = relations(contactCertifications, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactCertifications.contactId],
    references: [contacts.id],
  }),
}));

export const contactAvailabilityRelations = relations(contactAvailability, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactAvailability.contactId],
    references: [contacts.id],
  }),
}));

export const contactRelationshipsRelations = relations(contactRelationships, ({ one }) => ({
  fromContact: one(contacts, {
    fields: [contactRelationships.fromContactId],
    references: [contacts.id],
    relationName: "from_relationship",
  }),
  toContact: one(contacts, {
    fields: [contactRelationships.toContactId],
    references: [contacts.id],
    relationName: "to_relationship",
  }),
  user: one(users, {
    fields: [contactRelationships.userId],
    references: [users.id],
  }),
}));

export const hierarchyChangesRelations = relations(hierarchyChanges, ({ one }) => ({
  contact: one(contacts, {
    fields: [hierarchyChanges.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [hierarchyChanges.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  activities: many(contactActivities),
}));

export const workflowAssignmentsRelations = relations(workflowAssignments, ({ one }) => ({
  contact: one(contacts, {
    fields: [workflowAssignments.contactId],
    references: [contacts.id],
  }),
}));

export const contactActivitiesRelations = relations(contactActivities, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactActivities.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [contactActivities.userId],
    references: [users.id],
  }),
}));

// Enhanced schemas with validation
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  // Enhanced validation rules
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().regex(/^[\+]?[\d\s\-\(\)\.]+$/, "Invalid phone format").optional().or(z.literal("")),
  secondaryPhone: z.string().regex(/^[\+]?[\d\s\-\(\)\.]+$/, "Invalid phone format").optional().or(z.literal("")),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  skills: z.array(z.string()).default([]),
  projectTypes: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(["English"]),
  // Work schedule validation
  workStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional().or(z.literal("")),
  workEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional().or(z.literal("")),
  workTimezone: z.string().default("UTC"),
  // Workflow field validations  
  maxConcurrentTasks: z.number().min(1).max(50).default(5),
  costPerHour: z.number().positive().optional(),
  timezone: z.string().default("UTC"), // Primary contact timezone for scheduling
  currentWorkload: z.number().min(0).default(0),
  // Skill proficiency validation
  skillProficiency: z.record(z.enum(["beginner", "intermediate", "advanced", "expert"])).optional(),
  // Certifications validation
  certifications: z.array(z.object({
    name: z.string().min(1, "Certification name is required"),
    issuer: z.string().min(1, "Certification issuer is required"),
    expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional()
  })).optional(),
});

export const updateContactSchema = insertContactSchema.partial();

// Workflow assignment schemas  
export const insertWorkflowAssignmentSchema = createInsertSchema(workflowAssignments).omit({
  id: true,
  assignedAt: true,
});

// Contact skills schemas
export const insertContactSkillSchema = createInsertSchema(contactSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateContactSkillSchema = insertContactSkillSchema.partial();

// Contact certification schemas
export const insertContactCertificationSchema = createInsertSchema(contactCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expiryDate: z.date().optional(),
  issueDate: z.date().optional(),
});

export const updateContactCertificationSchema = insertContactCertificationSchema.partial();

// Contact availability schemas
export const insertContactAvailabilitySchema = createInsertSchema(contactAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
});

export const updateContactAvailabilitySchema = insertContactAvailabilitySchema.partial();

export const insertContactActivitySchema = createInsertSchema(contactActivities).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type ContactSkill = typeof contactSkills.$inferSelect;
export type InsertContactSkill = typeof contactSkills.$inferInsert;

export type ContactCertification = typeof contactCertifications.$inferSelect;
export type InsertContactCertification = typeof contactCertifications.$inferInsert;

export type ContactAvailability = typeof contactAvailability.$inferSelect;
export type InsertContactAvailability = typeof contactAvailability.$inferInsert;
export type Contact = typeof contacts.$inferSelect & {
  parent?: Contact | null;
  children?: Contact[];
  workflowAssignments?: WorkflowAssignment[];
  activities?: ContactActivity[];
  relationshipsFrom?: ContactRelationship[];
  relationshipsTo?: ContactRelationship[];
};
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type WorkflowAssignment = typeof workflowAssignments.$inferSelect;
export type ContactActivity = typeof contactActivities.$inferSelect;
export type InsertWorkflowAssignment = z.infer<typeof insertWorkflowAssignmentSchema>;
export type InsertContactActivity = z.infer<typeof insertContactActivitySchema>;
export type ContactRelationship = typeof contactRelationships.$inferSelect & {
  fromContact?: Contact;
  toContact?: Contact;
};
export type InsertContactRelationship = typeof contactRelationships.$inferInsert;
export type HierarchyChange = typeof hierarchyChanges.$inferSelect;
export type InsertHierarchyChange = typeof hierarchyChanges.$inferInsert;

export interface ContactStats {
  totalCompanies: number;
  totalDivisions: number;
  totalPeople: number;
}

// Predefined skills for validation and autocomplete
export const PREDEFINED_SKILLS = [
  "Project Management", "Leadership", "Communication", "Technical Writing",
  "Software Development", "Web Development", "Mobile Development", "Database Design",
  "DevOps", "Cloud Computing", "Data Analysis", "Machine Learning", "AI",
  "UI/UX Design", "Graphic Design", "Marketing", "Sales", "Customer Support",
  "Quality Assurance", "Testing", "Research", "Training", "Consulting"
] as const;

// Project types for workflow matching
export const PROJECT_TYPES = [
  "Software Development", "Web Application", "Mobile App", "Data Analysis",
  "Machine Learning", "AI Project", "Research", "Consulting", "Training",
  "Marketing Campaign", "Product Launch", "System Integration", "Migration",
  "Optimization", "Maintenance", "Support"
] as const;

// Workflow type exports
export type Workflow = typeof workflows.$inferSelect & {
  createdByUser?: User;
  instances?: WorkflowInstance[];
  elements?: WorkflowElement[];
};
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>;

export type WorkflowInstance = typeof workflowInstances.$inferSelect & {
  workflow?: Workflow;
  createdByUser?: User;
  tasks?: WorkflowTask[];
  executionHistory?: WorkflowExecutionHistory[];
};
export type InsertWorkflowInstance = z.infer<typeof insertWorkflowInstanceSchema>;

export type WorkflowTask = typeof workflowTasks.$inferSelect & {
  instance?: WorkflowInstance;
  assignedContact?: Contact;
};
export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect & {
  createdByUser?: User;
};
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;

export type WorkflowElement = typeof workflowElements.$inferSelect & {
  workflow?: Workflow;
};
export type InsertWorkflowElement = z.infer<typeof insertWorkflowElementSchema>;

export type WorkflowExecutionHistory = typeof workflowExecutionHistory.$inferSelect & {
  instance?: WorkflowInstance;
};

// BPMN 2.0 interfaces for workflow definitions
export interface BpmnElement {
  id: string;
  type: 'start_event' | 'end_event' | 'user_task' | 'system_task' | 'decision_gateway' | 'sequence_flow';
  name: string;
  position: { x: number; y: number };
  properties?: Record<string, any>;
}

export interface BpmnConnection {
  id: string;
  type: 'sequence_flow';
  sourceId: string;
  targetId: string;
  name?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  elements: BpmnElement[];
  connections: BpmnConnection[];
  variables?: Record<string, any>;
  version: string;
  metadata?: Record<string, any>;
}

// Workflow execution interfaces
export interface TaskExecution {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  input?: Record<string, any>;
  output?: Record<string, any>;
  notes?: string;
}

export interface WorkflowExecution {
  instanceId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  variables: Record<string, any>;
  tasks: TaskExecution[];
  history: Array<{
    timestamp: Date;
    action: string;
    details: Record<string, any>;
  }>;
}

// Workflow status enum
export const workflowStatusEnum = pgEnum("workflow_status", ["draft", "active", "paused", "completed", "archived"]);

// Workflow execution status enum
export const workflowExecutionStatusEnum = pgEnum("workflow_execution_status", ["pending", "running", "completed", "failed", "cancelled"]);

// Task status enum
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "skipped", "failed"]);

// BPMN element types enum
export const bpmnElementTypeEnum = pgEnum("bpmn_element_type", [
  "start_event", "end_event", "user_task", "system_task", "decision_gateway", "sequence_flow"
]);

// Main workflows table
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").default("general"),
  definitionJson: jsonb("definition_json").notNull(),
  bpmnXml: text("bpmn_xml"),
  status: workflowStatusEnum("status").default("draft"),
  version: varchar("version").default("1.0"),
  isTemplate: boolean("is_template").default(false),
  isPublic: boolean("is_public").default(false),
  createdBy: varchar("created_by").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow instances table for execution tracking
export const workflowInstances = pgTable("workflow_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  name: varchar("name"),
  status: workflowExecutionStatusEnum("status").default("pending"),
  currentStepId: varchar("current_step_id"),
  variables: jsonb("variables").default('{}'),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"),
  errorMessage: text("error_message"),
  executionLog: jsonb("execution_log").default('[]'),
  createdBy: varchar("created_by").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow tasks table for individual task execution
export const workflowTasks = pgTable("workflow_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  elementId: varchar("element_id").notNull(),
  taskName: varchar("task_name").notNull(),
  taskType: bpmnElementTypeEnum("task_type").notNull(),
  assignedContactId: varchar("assigned_contact_id"),
  status: taskStatusEnum("status").default("pending"),
  input: jsonb("input").default('{}'),
  output: jsonb("output").default('{}'),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow templates table
export const workflowTemplates = pgTable("workflow_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  workflowDefinition: jsonb("workflow_definition").notNull(),
  isPublic: boolean("is_public").default(false),
  tags: text("tags").array().default([]),
  usageCount: varchar("usage_count").default("0"),
  createdBy: varchar("created_by").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow element definitions for BPMN compliance
export const workflowElements = pgTable("workflow_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  elementId: varchar("element_id").notNull(), // BPMN element ID
  elementType: bpmnElementTypeEnum("element_type").notNull(),
  name: varchar("name").notNull(),
  properties: jsonb("properties").default('{}'),
  position: jsonb("position").notNull(), // {x, y} coordinates
  connections: jsonb("connections").default('[]'), // Array of connected element IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow execution history for monitoring
export const workflowExecutionHistory = pgTable("workflow_execution_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  stepId: varchar("step_id"),
  action: varchar("action").notNull(), // started, completed, failed, skipped
  details: jsonb("details").default('{}'),
  executedAt: timestamp("executed_at").defaultNow(),
  executedBy: varchar("executed_by"),
});

// Relations for workflow tables
export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  instances: many(workflowInstances),
  elements: many(workflowElements),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowInstances.workflowId],
    references: [workflows.id],
  }),
  createdByUser: one(users, {
    fields: [workflowInstances.createdBy],
    references: [users.id],
  }),
  tasks: many(workflowTasks),
  executionHistory: many(workflowExecutionHistory),
}));

export const workflowTasksRelations = relations(workflowTasks, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [workflowTasks.instanceId],
    references: [workflowInstances.id],
  }),
  assignedContact: one(contacts, {
    fields: [workflowTasks.assignedContactId],
    references: [contacts.id],
  }),
}));

export const workflowTemplatesRelations = relations(workflowTemplates, ({ one }) => ({
  createdByUser: one(users, {
    fields: [workflowTemplates.createdBy],
    references: [users.id],
  }),
}));

export const workflowElementsRelations = relations(workflowElements, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowElements.workflowId],
    references: [workflows.id],
  }),
}));

export const workflowExecutionHistoryRelations = relations(workflowExecutionHistory, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [workflowExecutionHistory.instanceId],
    references: [workflowInstances.id],
  }),
}));

// Export relationships and auditLog for workflow controller
export const relationships = contactRelationships;
export const auditLog = contactActivities;

// Workflow validation schemas
export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  userId: true,
});

export const updateWorkflowSchema = insertWorkflowSchema.partial();

export const insertWorkflowInstanceSchema = createInsertSchema(workflowInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  userId: true,
});

export const insertWorkflowTaskSchema = createInsertSchema(workflowTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  userId: true,
  usageCount: true,
});

export const insertWorkflowElementSchema = createInsertSchema(workflowElements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
