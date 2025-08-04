-- Pathfinder Phase 1A Database Schema

-- Contact Types Table
CREATE TABLE IF NOT EXISTS contact_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    type_id BIGINT REFERENCES contact_types(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    parent_id BIGINT REFERENCES contacts(id),
    level INTEGER DEFAULT 0,
    path VARCHAR(1000),
    active BOOLEAN DEFAULT true,
    skills JSONB DEFAULT '[]',
    availability JSONB DEFAULT '{}',
    department VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- Users Table for Authentication
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact Relationships Table
CREATE TABLE IF NOT EXISTS contact_relationships (
    id BIGSERIAL PRIMARY KEY,
    from_contact_id BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
    to_contact_id BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    UNIQUE(from_contact_id, to_contact_id, relationship_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_type_id ON contacts(type_id);
CREATE INDEX IF NOT EXISTS idx_contacts_parent_id ON contacts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts(active);
CREATE INDEX IF NOT EXISTS idx_contacts_path ON contacts USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_from ON contact_relationships(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_to ON contact_relationships(to_contact_id);

-- Insert default contact types
INSERT INTO contact_types (name, description, icon, color) VALUES 
('COMPANY', 'Corporate entity or organization', 'business', '#1976d2'),
('DIVISION', 'Division or department within a company', 'account_tree', '#388e3c'),
('PERSON', 'Individual contact person', 'person', '#f57c00')
ON CONFLICT (name) DO NOTHING;
