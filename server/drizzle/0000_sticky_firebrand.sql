CREATE TYPE "public"."dependency_type" AS ENUM('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish');--> statement-breakpoint
CREATE TYPE "public"."instance_status" AS ENUM('pending', 'running', 'completed', 'cancelled', 'failed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'ready', 'in_progress', 'blocked', 'completed', 'cancelled', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."step_type" AS ENUM('task', 'approval', 'notification', 'conditional', 'timer');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "step_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"predecessor_step_id" uuid NOT NULL,
	"successor_step_id" uuid NOT NULL,
	"dependency_type" "dependency_type" DEFAULT 'finish_to_start' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(200),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" varchar(2000),
	"version" integer DEFAULT 1 NOT NULL,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"status" "instance_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "step_type" NOT NULL,
	"assignee" varchar(200),
	"duration_minutes" integer,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "step_dependencies" ADD CONSTRAINT "step_dependencies_predecessor_step_id_workflow_steps_id_fk" FOREIGN KEY ("predecessor_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "step_dependencies" ADD CONSTRAINT "step_dependencies_successor_step_id_workflow_steps_id_fk" FOREIGN KEY ("successor_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "udx_step_dependencies_edge" ON "step_dependencies" USING btree ("predecessor_step_id","successor_step_id");--> statement-breakpoint
CREATE INDEX "idx_step_dependencies_successor" ON "step_dependencies" USING btree ("successor_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "udx_step_instances_instance_step" ON "step_instances" USING btree ("workflow_instance_id","step_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_instance" ON "step_instances" USING btree ("workflow_instance_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_step" ON "step_instances" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_status" ON "step_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_step_instances_started" ON "step_instances" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "udx_workflow_definitions_name_version" ON "workflow_definitions" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "idx_workflow_definitions_status" ON "workflow_definitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_definition" ON "workflow_instances" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_status" ON "workflow_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_started" ON "workflow_instances" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "udx_workflow_steps_definition_sequence" ON "workflow_steps" USING btree ("workflow_definition_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_workflow_steps_definition" ON "workflow_steps" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_steps_type" ON "workflow_steps" USING btree ("type");