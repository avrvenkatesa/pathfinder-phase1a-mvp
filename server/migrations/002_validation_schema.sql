-- Migration: 002_validation_schema.sql
-- Description: Add validation framework tables

CREATE TABLE IF NOT EXISTS validation_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(100) NOT NULL, -- 'contact', 'workflow', 'cross-system'
    rule_type VARCHAR(100) NOT NULL, -- 'sync', 'async', 'batch'
    rule_definition JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_results (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    rule_id INTEGER REFERENCES validation_rules(id),
    is_valid BOOLEAN NOT NULL,
    error_message TEXT,
    severity VARCHAR(20) DEFAULT 'error', -- 'error', 'warning', 'info'
    validated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_rules_domain_type ON validation_rules(domain, rule_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON validation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_validation_results_entity ON validation_results(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_validated_at ON validation_results(validated_at);
CREATE INDEX IF NOT EXISTS idx_validation_results_severity ON validation_results(severity);

-- Insert default validation rules for contact domain
INSERT INTO validation_rules (name, domain, rule_type, rule_definition) VALUES
-- Contact sync rules
('contact_required_fields', 'contact', 'sync', '{
  "type": "joi",
  "schema": {
    "name": {"type": "string", "min": 1, "required": true},
    "type": {"type": "string", "valid": ["company", "division", "person"], "required": true},
    "email": {"type": "string", "email": true, "when": {"type": {"is": "person", "then": {"required": true}}}}
  }
}'),

('contact_phone_format', 'contact', 'sync', '{
  "type": "joi",
  "schema": {
    "phone": {"type": "string", "pattern": "^[+]?[1-9]?[0-9]{7,15}$", "optional": true},
    "secondaryPhone": {"type": "string", "pattern": "^[+]?[1-9]?[0-9]{7,15}$", "optional": true}
  }
}'),

('contact_hierarchy_integrity', 'contact', 'sync', '{
  "type": "custom",
  "customType": "circular_dependency"
}'),

-- Contact async rules
('contact_email_uniqueness', 'contact', 'async', '{
  "type": "custom",
  "customType": "email_uniqueness"
}'),

('contact_skill_consistency', 'contact', 'async', '{
  "type": "custom", 
  "customType": "skill_consistency"
}'),

-- Workflow sync rules
('workflow_step_dependencies', 'workflow', 'sync', '{
  "type": "joi",
  "schema": {
    "steps": {"type": "array", "items": {
      "id": {"type": "string", "required": true},
      "name": {"type": "string", "required": true},
      "dependencies": {"type": "array", "items": {"type": "string"}}
    }}
  }
}'),

-- Workflow async rules
('workflow_contact_availability', 'workflow', 'async', '{
  "type": "database",
  "query": "SELECT COUNT(*) as conflict_count FROM workflow_assignments wa JOIN contacts c ON wa.contact_id = c.id WHERE c.id = $1 AND wa.status = ''active'' AND wa.end_date > NOW()",
  "params": ["contactId"],
  "expectedResult": {"type": "count", "value": 0},
  "field": "contactId",
  "errorMessage": "Contact has conflicting workflow assignments",
  "errorCode": "CONTACT_AVAILABILITY_CONFLICT"
}'),

('workflow_skill_matching', 'workflow', 'async', '{
  "type": "database",
  "query": "SELECT COUNT(*) as missing_skills FROM (SELECT unnest($1::text[]) as required_skill EXCEPT SELECT unnest(c.skills) FROM contacts c WHERE c.id = $2) as missing",
  "params": ["requiredSkills", "contactId"],
  "expectedResult": {"type": "count", "value": 0},
  "field": "skills",
  "errorMessage": "Contact does not have all required skills",
  "errorCode": "INSUFFICIENT_SKILLS"
}'),

-- Cross-system rules
('cross_system_capacity_check', 'cross-system', 'async', '{
  "type": "database",
  "query": "SELECT c.\"assignmentCapacity\", COUNT(wa.id) as current_assignments FROM contacts c LEFT JOIN workflow_assignments wa ON c.id = wa.contact_id WHERE c.id = $1 AND (wa.status = ''active'' OR wa.status IS NULL) GROUP BY c.\"assignmentCapacity\"",
  "params": ["contactId"],
  "field": "assignmentCapacity",
  "errorMessage": "Contact assignment capacity exceeded",
  "errorCode": "CAPACITY_EXCEEDED"
}');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for validation_rules table
CREATE TRIGGER update_validation_rules_updated_at 
    BEFORE UPDATE ON validation_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();