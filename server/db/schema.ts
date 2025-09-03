import {
  pgTable, uuid, varchar, integer, timestamp, jsonb, index, uniqueIndex,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ===== Enums =====
export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft", "active", "paused", "completed", "archived",
]);

export const stepTypeEnum = pgEnum("step_type", [
  "task", "approval", "notification", "conditional", "timer",
]);

export const dependencyTypeEnum = pgEnum("dependency_type", [
  "finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish",
]);

export const instanceStatusEnum = pgEnum("instance_status", [
  "pending", "running", "completed", "cancelled", "failed", "paused",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending", "ready", "in_progress", "blocked",
  "completed", "cancelled", "failed", "skipped",
]);

// ===== Tables =====

export const workflowDefinitions = pgTable("workflow_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: varchar("description", { length: 2000 }),
  version: integer("version").notNull().default(1),
  status: workflowStatusEnum("status").notNull().default("draft"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameVersionUnique: uniqueIndex("udx_workflow_definitions_name_version").on(t.name, t.version),
  statusIdx: index("idx_workflow_definitions_status").on(t.status),
}));

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowDefinitionId: uuid("workflow_definition_id").notNull()
    .references(() => workflowDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),

  sequence: integer("sequence").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  type: stepTypeEnum("type").notNull(),
  assignee: varchar("assignee", { length: 200 }),
  durationMinutes: integer("duration_minutes"),
  properties: jsonb("properties"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  defSeqUnique: uniqueIndex("udx_workflow_steps_definition_sequence").on(t.workflowDefinitionId, t.sequence),
  defIdx: index("idx_workflow_steps_definition").on(t.workflowDefinitionId),
  typeIdx: index("idx_workflow_steps_type").on(t.type),
}));

export const stepDependencies = pgTable("step_dependencies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  predecessorStepId: uuid("predecessor_step_id").notNull()
    .references(() => workflowSteps.id, { onDelete: "cascade", onUpdate: "cascade" }),

  successorStepId: uuid("successor_step_id").notNull()
    .references(() => workflowSteps.id, { onDelete: "cascade", onUpdate: "cascade" }),

  dependencyType: dependencyTypeEnum("dependency_type").notNull().default("finish_to_start"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  edgeUnique: uniqueIndex("udx_step_dependencies_edge").on(t.predecessorStepId, t.successorStepId),
  succIdx: index("idx_step_dependencies_successor").on(t.successorStepId),
}));

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowDefinitionId: uuid("workflow_definition_id").notNull()
    .references(() => workflowDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),

  status: instanceStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  defIdx: index("idx_workflow_instances_definition").on(t.workflowDefinitionId),
  statusIdx: index("idx_workflow_instances_status").on(t.status),
  startedIdx: index("idx_workflow_instances_started").on(t.startedAt),
}));

export const stepInstances = pgTable("step_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  workflowInstanceId: uuid("workflow_instance_id").notNull()
    .references(() => workflowInstances.id, { onDelete: "cascade", onUpdate: "cascade" }),

  stepId: uuid("step_id").notNull()
    .references(() => workflowSteps.id, { onDelete: "restrict", onUpdate: "cascade" }),

  status: stepStatusEnum("status").notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  payload: jsonb("payload"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  instanceStepUnique: uniqueIndex("udx_step_instances_instance_step").on(t.workflowInstanceId, t.stepId),
  instIdx: index("idx_step_instances_instance").on(t.workflowInstanceId),
  stepIdx: index("idx_step_instances_step").on(t.stepId),
  statusIdx: index("idx_step_instances_status").on(t.status),
  startedIdx: index("idx_step_instances_started").on(t.startedAt),
}));

// ===== Relations =====
export const workflowDefinitionRelations = relations(workflowDefinitions, ({ many }) => ({
  steps: many(workflowSteps),
  instances: many(workflowInstances),
}));

export const workflowStepRelations = relations(workflowSteps, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowSteps.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
  outgoingDeps: many(stepDependencies, { relationName: "outgoing" }),
  incomingDeps: many(stepDependencies, { relationName: "incoming" }),
  instances: many(stepInstances),
}));

export const stepDependencyRelations = relations(stepDependencies, ({ one }) => ({
  predecessor: one(workflowSteps, {
    fields: [stepDependencies.predecessorStepId],
    references: [workflowSteps.id],
    relationName: "outgoing",
  }),
  successor: one(workflowSteps, {
    fields: [stepDependencies.successorStepId],
    references: [workflowSteps.id],
    relationName: "incoming",
  }),
}));

export const workflowInstanceRelations = relations(workflowInstances, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowInstances.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
  steps: many(stepInstances),
}));

export const stepInstanceRelations = relations(stepInstances, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [stepInstances.workflowInstanceId],
    references: [workflowInstances.id],
  }),
  step: one(workflowSteps, {
    fields: [stepInstances.stepId],
    references: [workflowSteps.id],
  }),
}));
