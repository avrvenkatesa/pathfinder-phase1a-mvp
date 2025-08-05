-- Enhanced database schema with performance optimizations and audit trails
-- This migration adds indexes, constraints, and additional fields for production readiness

-- Add missing indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_type ON contacts(type) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_parent_id ON contacts(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_department ON contacts(department) WHERE deleted_at IS NULL AND department IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_availability ON contacts(availability_status) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_skills ON contacts USING GIN(skills) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_created_at ON contacts(created_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at) WHERE deleted_at IS NULL;

-- Relationships indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_source_id ON relationships(source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_target_id ON relationships(target_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationships_created_at ON relationships(created_at);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_type_department ON contacts(type, department) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_type_availability ON contacts(type, availability_status) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_parent_type ON contacts(parent_id, type) WHERE deleted_at IS NULL;

-- Full-text search index for contact names and content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_search ON contacts USING GIN(
  to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(job_title, '') || ' ' || 
    COALESCE(department, '') || ' ' || 
    COALESCE(notes, '')
  )
) WHERE deleted_at IS NULL;

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_timestamp ON audit_log(user_id, timestamp);

-- Add check constraints for data integrity
ALTER TABLE contacts ADD CONSTRAINT chk_contacts_email_format 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE contacts ADD CONSTRAINT chk_contacts_type_values 
  CHECK (type IN ('company', 'division', 'person'));

ALTER TABLE contacts ADD CONSTRAINT chk_contacts_availability_values 
  CHECK (availability_status IS NULL OR availability_status IN ('available', 'busy', 'partially_available', 'unavailable'));

ALTER TABLE relationships ADD CONSTRAINT chk_relationships_type_values 
  CHECK (relationship_type IN ('reports_to', 'works_with', 'supervises', 'collaborates'));

ALTER TABLE relationships ADD CONSTRAINT chk_relationships_no_self_reference 
  CHECK (source_id != target_id);

ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action_values 
  CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE'));

-- Add foreign key constraints with proper cascade behavior
ALTER TABLE contacts 
  ADD CONSTRAINT fk_contacts_parent_id 
  FOREIGN KEY (parent_id) REFERENCES contacts(id) 
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE relationships 
  ADD CONSTRAINT fk_relationships_source_id 
  FOREIGN KEY (source_id) REFERENCES contacts(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE relationships 
  ADD CONSTRAINT fk_relationships_target_id 
  FOREIGN KEY (target_id) REFERENCES contacts(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Create materialized view for analytics performance
CREATE MATERIALIZED VIEW IF NOT EXISTS contact_analytics_mv AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  type,
  department,
  availability_status,
  COUNT(*) as contact_count,
  COUNT(DISTINCT parent_id) as unique_parents,
  AVG(ARRAY_LENGTH(skills, 1)) as avg_skills_count
FROM contacts 
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', created_at), type, department, availability_status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_analytics_mv_unique 
  ON contact_analytics_mv(month, type, COALESCE(department, ''), COALESCE(availability_status, ''));

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_contact_analytics() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY contact_analytics_mv;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at 
  BEFORE UPDATE ON contacts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for hierarchical queries
CREATE OR REPLACE FUNCTION get_contact_hierarchy(contact_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  type contact_type,
  parent_id UUID,
  level INTEGER,
  path TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Base case: the contact itself
    SELECT 
      c.id,
      c.name,
      c.type,
      c.parent_id,
      0 as level,
      ARRAY[c.name] as path
    FROM contacts c
    WHERE c.id = contact_id AND c.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: children
    SELECT 
      c.id,
      c.name,
      c.type,
      c.parent_id,
      h.level + 1,
      h.path || c.name
    FROM contacts c
    JOIN hierarchy h ON c.parent_id = h.id
    WHERE c.deleted_at IS NULL
  )
  SELECT h.id, h.name, h.type, h.parent_id, h.level, h.path FROM hierarchy h;
END;
$$ LANGUAGE plpgsql;

-- Create function for contact search with ranking
CREATE OR REPLACE FUNCTION search_contacts(
  search_query TEXT,
  contact_types contact_type[] DEFAULT NULL,
  departments TEXT[] DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  type contact_type,
  department TEXT,
  job_title TEXT,
  skills TEXT[],
  availability_status availability_status,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.type,
    c.department,
    c.job_title,
    c.skills,
    c.availability_status,
    ts_rank(
      to_tsvector('english', 
        COALESCE(c.name, '') || ' ' || 
        COALESCE(c.email, '') || ' ' || 
        COALESCE(c.job_title, '') || ' ' || 
        COALESCE(c.department, '') || ' ' || 
        COALESCE(c.notes, '')
      ),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM contacts c
  WHERE 
    c.deleted_at IS NULL
    AND to_tsvector('english', 
      COALESCE(c.name, '') || ' ' || 
      COALESCE(c.email, '') || ' ' || 
      COALESCE(c.job_title, '') || ' ' || 
      COALESCE(c.department, '') || ' ' || 
      COALESCE(c.notes, '')
    ) @@ plainto_tsquery('english', search_query)
    AND (contact_types IS NULL OR c.type = ANY(contact_types))
    AND (departments IS NULL OR c.department = ANY(departments))
  ORDER BY rank DESC, c.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for bulk operations with validation
CREATE OR REPLACE FUNCTION validate_contact_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent circular references in hierarchy
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if the new parent would create a cycle
    IF EXISTS (
      WITH RECURSIVE hierarchy_check AS (
        SELECT id, parent_id, 1 as depth
        FROM contacts 
        WHERE id = NEW.parent_id AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT c.id, c.parent_id, hc.depth + 1
        FROM contacts c
        JOIN hierarchy_check hc ON c.id = hc.parent_id
        WHERE c.deleted_at IS NULL AND hc.depth < 10 -- Prevent infinite recursion
      )
      SELECT 1 FROM hierarchy_check WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot create circular reference in contact hierarchy';
    END IF;
    
    -- Validate parent exists and is not deleted
    IF NOT EXISTS (
      SELECT 1 FROM contacts 
      WHERE id = NEW.parent_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Parent contact does not exist or is deleted';
    END IF;
    
    -- Validate hierarchy rules (e.g., person can't be parent of company)
    IF NEW.type = 'company' AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE id = NEW.parent_id AND type = 'person' AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'A company cannot have a person as parent';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_contact_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_contact_hierarchy();

-- Create statistics for query optimizer
ANALYZE contacts;
ANALYZE relationships;
ANALYZE audit_log;

-- Create partial indexes for soft-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at, id) WHERE deleted_at IS NOT NULL;

-- Create expression indexes for common JSON operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_skills_count ON contacts((ARRAY_LENGTH(skills, 1))) WHERE deleted_at IS NULL AND skills IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE contacts IS 'Main contacts table storing companies, divisions, and people in a hierarchical structure';
COMMENT ON COLUMN contacts.type IS 'Type of contact: company (root), division (branch), or person (leaf)';
COMMENT ON COLUMN contacts.parent_id IS 'Reference to parent contact for hierarchical relationships';
COMMENT ON COLUMN contacts.skills IS 'Array of skills/competencies for person-type contacts';
COMMENT ON COLUMN contacts.availability_status IS 'Current availability status for workflow assignment';
COMMENT ON COLUMN contacts.deleted_at IS 'Soft delete timestamp - NULL means active record';

COMMENT ON TABLE relationships IS 'Relationships between contacts beyond hierarchical parent-child';
COMMENT ON COLUMN relationships.relationship_type IS 'Type of relationship: reports_to, works_with, supervises, collaborates';

COMMENT ON TABLE audit_log IS 'Audit trail for all contact and relationship changes';
COMMENT ON COLUMN audit_log.changes IS 'JSON object containing the changes made to the resource';

-- Create view for active contacts (frequently used)
CREATE VIEW active_contacts AS
SELECT * FROM contacts WHERE deleted_at IS NULL;

-- Create view for contact hierarchy with levels
CREATE VIEW contact_hierarchy AS
WITH RECURSIVE hierarchy AS (
  -- Root contacts (no parent)
  SELECT 
    id,
    name,
    type,
    parent_id,
    email,
    department,
    job_title,
    skills,
    availability_status,
    0 as level,
    ARRAY[name] as path,
    id::text as root_id
  FROM contacts
  WHERE parent_id IS NULL AND deleted_at IS NULL
  
  UNION ALL
  
  -- Child contacts
  SELECT 
    c.id,
    c.name,
    c.type,
    c.parent_id,
    c.email,
    c.department,
    c.job_title,
    c.skills,
    c.availability_status,
    h.level + 1,
    h.path || c.name,
    h.root_id
  FROM contacts c
  JOIN hierarchy h ON c.parent_id = h.id
  WHERE c.deleted_at IS NULL
)
SELECT * FROM hierarchy;

COMMENT ON VIEW contact_hierarchy IS 'Hierarchical view of all active contacts with their level and path from root';