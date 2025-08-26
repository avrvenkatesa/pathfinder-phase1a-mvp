-- Enhanced Contacts and Workflows Migration
-- This migration adds the enhanced features for contact hierarchy,
-- advanced search, and workflow management

-- Add location field to contacts table for better search
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Create contact relationships table if it doesn't exist
CREATE TABLE IF NOT EXISTS contact_relationships (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    child_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    relationship_type VARCHAR NOT NULL CHECK (relationship_type IN (
        'parent_child', 'manager_direct_report', 'department_member',
        'team_member', 'reports_to', 'works_with', 'supervises',
        'collaborates', 'manages', 'peers'
    )),
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR NOT NULL,
    UNIQUE(parent_id, child_id, relationship_type)
);

-- Create indexes for contact relationships
CREATE INDEX IF NOT EXISTS idx_contact_relationships_parent ON contact_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_child ON contact_relationships(child_id);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_type ON contact_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_user ON contact_relationships(user_id);

-- Create hierarchy changes table for audit trail
CREATE TABLE IF NOT EXISTS hierarchy_changes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    old_parent_id VARCHAR,
    new_parent_id VARCHAR,
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR NOT NULL
);

-- Create workflow tables
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR DEFAULT 'general',
    definition_json JSONB NOT NULL,
    bpmn_xml TEXT,
    status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    version VARCHAR DEFAULT '1.0',
    is_template BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_by VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create workflow instances table
CREATE TABLE IF NOT EXISTS workflow_instances (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name VARCHAR,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    current_step_id VARCHAR,
    variables JSONB DEFAULT '{}',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    paused_at TIMESTAMP,
    error_message TEXT,
    execution_log JSONB DEFAULT '[]',
    created_by VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create workflow tasks table
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    element_id VARCHAR NOT NULL,
    task_name VARCHAR NOT NULL,
    task_type VARCHAR NOT NULL CHECK (task_type IN ('start_event', 'end_event', 'user_task', 'system_task', 'decision_gateway', 'sequence_flow')),
    assigned_contact_id VARCHAR,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    due_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR NOT NULL,
    workflow_definition JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    usage_count VARCHAR DEFAULT '0',
    created_by VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create workflow elements table
CREATE TABLE IF NOT EXISTS workflow_elements (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    element_id VARCHAR NOT NULL,
    element_type VARCHAR NOT NULL CHECK (element_type IN ('start_event', 'end_event', 'user_task', 'system_task', 'decision_gateway', 'sequence_flow')),
    name VARCHAR NOT NULL,
    properties JSONB DEFAULT '{}',
    position JSONB NOT NULL,
    connections JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create workflow execution history table
CREATE TABLE IF NOT EXISTS workflow_execution_history (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id VARCHAR,
    action VARCHAR NOT NULL,
    details JSONB DEFAULT '{}',
    executed_at TIMESTAMP DEFAULT NOW(),
    executed_by VARCHAR
);

-- Create indexes for better performance

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);

-- Workflow instances indexes
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_user ON workflow_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);

-- Workflow tasks indexes
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_instance ON workflow_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assigned ON workflow_tasks(assigned_contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);

-- Workflow templates indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_user ON workflow_templates(user_id);

-- Workflow elements indexes
CREATE INDEX IF NOT EXISTS idx_workflow_elements_workflow ON workflow_elements(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_elements_element ON workflow_elements(element_id);

-- Contact search indexes
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')));
CREATE INDEX IF NOT EXISTS idx_contacts_location ON contacts(location);
CREATE INDEX IF NOT EXISTS idx_contacts_skills ON contacts USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);

-- Update existing data to ensure consistency
UPDATE contacts SET location = address WHERE location IS NULL AND address IS NOT NULL;

-- Insert some default workflow templates
INSERT INTO workflow_templates (name, description, category, workflow_definition, is_public, tags, created_by, user_id)
VALUES
    ('Simple Approval', 'A basic approval workflow with sequential steps', 'approval',
     '{"elements":[{"id":"start","type":"start_event","name":"Start","position":{"x":100,"y":100}},{"id":"review","type":"user_task","name":"Review","position":{"x":200,"y":100}},{"id":
"approve","type":"user_task","name":"Approve","position":{"x":300,"y":100}},{"id":"end","type":"end_event","name":"End","position":{"x":400,"y":100}}],"connections":[{"id":"c1","type":"
sequence_flow","sourceId":"start","targetId":"review"},{"id":"c2","type":"sequence_flow","sourceId":"review","targetId":"approve"},{    "id":"c3","type":"sequence_flow","sourceId":"approve"
,"targetId":"end"}]}',
     true, ARRAY['approval', 'basic'], 'system', 'system')
ON CONFLICT DO NOTHING;

-- Add comment for migration tracking
COMMENT ON TABLE contact_relationships IS 'Enhanced contact relationship management for hierarchical structures';
COMMENT ON TABLE workflows IS 'Core workflow definitions with BPMN support';
COMMENT ON TABLE workflow_instances IS 'Runtime instances of workflows with execution state';
COMMENT ON TABLE workflow_tasks IS 'Individual tasks within workflow instances';
COMMENT ON TABLE workflow_templates IS 'Reusable workflow templates';

-- Migration completed
INSERT INTO schema_migrations (version, executed_at)
VALUES ('002_enhanced_contacts_and_workflows', NOW())
ON CONFLICT (version) DO UPDATE SET executed_at = NOW();
