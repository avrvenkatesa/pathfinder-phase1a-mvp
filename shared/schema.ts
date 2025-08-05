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
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
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
  preferredWorkHours: varchar("preferred_work_hours"), // e.g., "9am-5pm EST"
  
  // Workflow Preferences
  rolePreference: rolePreferenceEnum("role_preference").default("any"),
  projectTypes: text("project_types").array().default([]),
  assignmentCapacity: varchar("assignment_capacity").default("normal"), // low, normal, high
  
  // Legacy/General
  tags: text("tags").array().default([]),
  notes: text("notes"), // Contact-specific notes
  isActive: boolean("is_active").default(true),
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
});

export const updateContactSchema = insertContactSchema.partial();

// Workflow assignment schemas  
export const insertWorkflowAssignmentSchema = createInsertSchema(workflowAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertContactActivitySchema = createInsertSchema(contactActivities).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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
