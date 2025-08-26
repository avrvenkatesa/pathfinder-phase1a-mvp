/**
 * 🚀 PATHFINDER DEMO - ONE-CLICK SETUP FOR REPLIT
 * 
 * INSTRUCTIONS:
 * 1. Create a new file called "setupDemo.js" in your Replit project
 * 2. Copy this entire script into that file
 * 3. Run in Shell: npm install pg
 * 4. Run in Shell: node setupDemo.js
 * 5. Your demo is ready! 🎉
 */

const { Client } = require('pg');

// Use Replit's database URL automatically
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database found! Please enable PostgreSQL in your Replit project:');
  console.error('   1. Click the "Database" icon in the left sidebar');
  console.error('   2. Click "Create Database" or "Connect"');
  console.error('   3. Run this script again');
  process.exit(1);
}

// Console colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupDemo() {
  log('\n🚀 PATHFINDER DEMO SETUP - STARTING...', 'bright');
  log('=====================================\n', 'blue');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    log('📡 Connecting to Replit database...', 'cyan');
    await client.connect();
    log('✅ Connected successfully!\n', 'green');

    // Step 1: Create schema
    log('📋 Step 1: Creating database schema...', 'yellow');
    await createSchema(client);
    log('✅ Schema created!\n', 'green');

    // Step 2: Load companies
    log('🏢 Step 2: Creating companies...', 'yellow');
    await createCompanies(client);
    log('✅ Companies created!\n', 'green');

    // Step 3: Load key demo contacts
    log('👤 Step 3: Creating demo contacts...', 'yellow');
    await createDemoContacts(client);
    log('✅ Demo contacts created!\n', 'green');

    // Step 4: Generate additional contacts
    log('👥 Step 4: Generating additional contacts...', 'yellow');
    await generateBulkContacts(client);
    log('✅ Bulk contacts created!\n', 'green');

    // Step 5: Create skills (if needed)
    log('⚡ Step 5: Setting up skills...', 'yellow');
    await createSkills(client);
    log('✅ Skills configured!\n', 'green');

    // Step 6: Create workflows
    log('🔄 Step 6: Creating workflow templates...', 'yellow');
    await createWorkflows(client);
    log('✅ Workflows created!\n', 'green');

    // Step 7: Create test users
    log('🔐 Step 7: Creating test user accounts...', 'yellow');
    await createTestUsers(client);
    log('✅ Test users created!\n', 'green');

    // Verify and display results
    await verifyAndDisplayResults(client);

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await client.end();
  }
}

async function createSchema(client) {
  // First, check what tables exist and their structure
  const checkExisting = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('contacts', 'companies', 'divisions', 'skills', 'workflows', 'users')
  `);

  const existingTables = checkExisting.rows.map(row => row.table_name);

  if (existingTables.includes('contacts')) {
    // Check the data type of contacts.id
    const checkContactsId = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'id'
    `);

    if (checkContactsId.rows[0] && checkContactsId.rows[0].data_type === 'character varying') {
      log('⚠️  Detected existing contacts table with VARCHAR id. Dropping and recreating...', 'yellow');

      // Drop all dependent tables first
      await client.query(`
        DROP TABLE IF EXISTS assignments CASCADE;
        DROP TABLE IF EXISTS workflow_stages CASCADE;
        DROP TABLE IF EXISTS workflows CASCADE;
        DROP TABLE IF EXISTS contact_skills CASCADE;
        DROP TABLE IF EXISTS contacts CASCADE;
        DROP TABLE IF EXISTS divisions CASCADE;
        DROP TABLE IF EXISTS companies CASCADE;
        DROP TABLE IF EXISTS skills CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
      `);
    }
  }

  // Create tables with consistent data types
  const createTables = `
    -- Companies table
    CREATE TABLE IF NOT EXISTS companies (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50),
      description TEXT,
      website VARCHAR(255),
      industry VARCHAR(100),
      size VARCHAR(50),
      is_vendor BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Divisions table
    CREATE TABLE IF NOT EXISTS divisions (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name VARCHAR(255) NOT NULL,
      company_id VARCHAR(255) REFERENCES companies(id),
      department VARCHAR(100),
      headcount INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Contacts table
    CREATE TABLE IF NOT EXISTS contacts (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      type VARCHAR(50) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      title VARCHAR(100),
      department VARCHAR(100),
      company VARCHAR(255),
      division_id VARCHAR(255) REFERENCES divisions(id),
      is_vendor BOOLEAN DEFAULT false,
      availability VARCHAR(50) DEFAULT 'Available',
      current_workload INTEGER DEFAULT 0,
      max_capacity INTEGER DEFAULT 40,
      hourly_rate DECIMAL(10,2),
      timezone VARCHAR(50),
      skills JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Skills table
    CREATE TABLE IF NOT EXISTS skills (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name VARCHAR(100) UNIQUE NOT NULL,
      category VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Contact Skills junction
    CREATE TABLE IF NOT EXISTS contact_skills (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      contact_id VARCHAR(255) REFERENCES contacts(id),
      skill_id VARCHAR(255) REFERENCES skills(id),
      level VARCHAR(50),
      years_experience INTEGER,
      UNIQUE(contact_id, skill_id)
    );

    -- Workflows table
    CREATE TABLE IF NOT EXISTS workflows (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50),
      category VARCHAR(100),
      is_template BOOLEAN DEFAULT true,
      stages JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Workflow stages table
    CREATE TABLE IF NOT EXISTS workflow_stages (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workflow_id VARCHAR(255) REFERENCES workflows(id),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50),
      sequence_order INTEGER,
      estimated_hours INTEGER,
      required_skills JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Assignments table
    CREATE TABLE IF NOT EXISTS assignments (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      contact_id VARCHAR(255) REFERENCES contacts(id),
      workflow_id VARCHAR(255) REFERENCES workflows(id),
      stage_name VARCHAR(255),
      status VARCHAR(50),
      assigned_date TIMESTAMP,
      due_date TIMESTAMP,
      hours_allocated INTEGER,
      hours_completed INTEGER,
      priority VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Users table for authentication
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_availability ON contacts(availability);
    CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
  `;

  await client.query(createTables);
}

async function createCompanies(client) {
  const companies = `
    INSERT INTO companies (name, type, description, website, industry, size, is_vendor)
    VALUES 
      ('S4 Carlisle', 'Company', 'Primary organization - Publishing Services', 'https://s4carlisle.com', 'Publishing', '500-1000', false),
      ('TechContent Partners', 'Company', 'Technical documentation vendor', 'https://techcontentpartners.com', 'Professional Services', '50-100', true),
      ('Creative Studio Inc', 'Company', 'Design and multimedia vendor', 'https://creativestudio.com', 'Creative Services', '20-50', true),
      ('GlobalTranslate Services', 'Company', 'Translation and localization vendor', 'https://globaltranslate.com', 'Language Services', '100-200', true),
      ('Freelance Professionals', 'Company', 'Independent contractors collective', NULL, 'Freelance', '1-10', true)
    ON CONFLICT (name) DO NOTHING;
  `;

  await client.query(companies);

  // Create divisions for S4 Carlisle
  const divisions = `
    INSERT INTO divisions (name, company_id, department, headcount)
    SELECT 
      division_name,
      (SELECT id FROM companies WHERE name = 'S4 Carlisle'),
      department,
      headcount
    FROM (VALUES
      ('Editorial Division', 'Editorial', 12),
      ('Design Division', 'Design', 8),
      ('Engineering Division', 'Engineering', 15)
    ) AS divs(division_name, department, headcount)
    WHERE EXISTS (SELECT 1 FROM companies WHERE name = 'S4 Carlisle')
    ON CONFLICT DO NOTHING;
  `;

  await client.query(divisions);
}

async function createDemoContacts(client) {
  const keyContacts = `
    INSERT INTO contacts (
      type, first_name, last_name, email, phone, title, department, 
      company, is_vendor, availability, current_workload, max_capacity, 
      hourly_rate, timezone, skills
    ) VALUES 
      -- Alexandra Martinez (Featured in demo)
      ('Freelancer', 'Alexandra', 'Martinez', 'alex.martinez@freelance.com', 
       '+1-555-0199', 'Senior Technical Editor', 'Editorial',
       'Freelance Professionals', true, 'Available', 20, 40, 125.00, 'EST',
       '{"Technical Writing": "Expert", "API Documentation": "Expert", "JavaScript": "Intermediate", "Content Management": "Advanced"}'::jsonb),

      -- John Smith (Featured in demo)
      ('Employee', 'John', 'Smith', 'john.smith@s4carlisle.com', 
       '+1-555-0123', 'Senior Developer', 'Engineering',
       'S4 Carlisle', false, 'Available', 60, 40, NULL, 'EST',
       '{"JavaScript": "Expert", "React": "Intermediate", "MySQL": "Intermediate"}'::jsonb),

      -- Sarah Johnson (Featured in demo)
      ('Employee', 'Sarah', 'Johnson', 'sarah.johnson@s4carlisle.com', 
       '+1-555-0124', 'Graphic Designer', 'Design',
       'S4 Carlisle', false, 'Busy', 80, 40, NULL, 'EST',
       '{"Graphic Design": "Advanced", "UI/UX Design": "Intermediate"}'::jsonb),

      -- Additional key contacts
      ('Employee', 'Mike', 'Chen', 'mike.chen@s4carlisle.com',
       '+1-555-0125', 'Junior Editor', 'Editorial',
       'S4 Carlisle', false, 'Available', 40, 40, NULL, 'EST',
       '{"Technical Writing": "Intermediate", "Editing": "Advanced"}'::jsonb),

      ('Employee', 'Lisa', 'Anderson', 'lisa.anderson@s4carlisle.com',
       '+1-555-0126', 'Lead Designer', 'Design',
       'S4 Carlisle', false, 'Available', 50, 40, NULL, 'PST',
       '{"UI/UX Design": "Expert", "Figma": "Expert", "Adobe Creative Suite": "Advanced"}'::jsonb),

      ('Employee', 'Tom', 'Wilson', 'tom.wilson@s4carlisle.com',
       '+1-555-0127', 'Designer', 'Design',
       'S4 Carlisle', false, 'Busy', 70, 40, NULL, 'EST',
       '{"Graphic Design": "Intermediate", "Blockchain": "Beginner"}'::jsonb),

      ('Employee', 'Emily', 'Davis', 'emily.davis@s4carlisle.com',
       '+1-555-0128', 'Developer', 'Engineering',
       'S4 Carlisle', false, 'Available', 30, 40, NULL, 'CST',
       '{"Python": "Expert", "Django": "Advanced", "PostgreSQL": "Intermediate"}'::jsonb),

      ('Employee', 'Robert', 'Lee', 'robert.lee@s4carlisle.com',
       '+1-555-0129', 'Tech Lead', 'Engineering',
       'S4 Carlisle', false, 'Available', 85, 40, NULL, 'EST',
       '{"JavaScript": "Expert", "Node.js": "Expert", "AWS": "Advanced", "Docker": "Intermediate"}'::jsonb)
    ON CONFLICT (email) DO NOTHING;
  `;

  await client.query(keyContacts);
}

async function generateBulkContacts(client) {
  // Generate diverse contacts for realistic demo
  const bulkContacts = `
    INSERT INTO contacts (
      type, first_name, last_name, email, phone, title, 
      department, company, is_vendor, availability, 
      current_workload, max_capacity
    )
    SELECT 
      CASE 
        WHEN num % 5 = 0 THEN 'Freelancer'
        WHEN num % 7 = 0 THEN 'Vendor'
        ELSE 'Employee'
      END,
      first_names.name,
      last_names.name,
      LOWER(first_names.name || '.' || last_names.name || num || '@' || 
        CASE 
          WHEN num % 5 = 0 THEN 'freelance.com'
          WHEN num % 7 = 0 THEN 'vendor.com'
          ELSE 's4carlisle.com'
        END),
      '+1-555-' || LPAD((2000 + num)::text, 4, '0'),
      titles.title,
      departments.dept,
      CASE 
        WHEN num % 5 = 0 THEN 'Freelance Professionals'
        WHEN num % 7 = 0 THEN 'TechContent Partners'
        ELSE 'S4 Carlisle'
      END,
      CASE WHEN num % 5 = 0 OR num % 7 = 0 THEN true ELSE false END,
      availability.status,
      FLOOR(RANDOM() * 100),
      40
    FROM generate_series(1, 1200) AS num
    CROSS JOIN LATERAL (
      SELECT name FROM (VALUES 
        ('James'), ('Mary'), ('Patricia'), ('Jennifer'), ('Linda'),
        ('Elizabeth'), ('Barbara'), ('Susan'), ('Jessica'), ('Karen'),
        ('Nancy'), ('Betty'), ('Margaret'), ('Sandra'), ('Ashley'),
        ('Kimberly'), ('Emily'), ('Donna'), ('Michelle'), ('Carol'),
        ('David'), ('Richard'), ('Joseph'), ('Thomas'), ('Christopher'),
        ('Charles'), ('Daniel'), ('Matthew'), ('Anthony'), ('Mark'),
        ('Donald'), ('Steven'), ('Kenneth'), ('Andrew'), ('Joshua'),
        ('Kevin'), ('Brian'), ('George'), ('Ronald'), ('Edward')
      ) AS f(name) ORDER BY RANDOM() LIMIT 1
    ) AS first_names
    CROSS JOIN LATERAL (
      SELECT name FROM (VALUES 
        ('Smith'), ('Johnson'), ('Williams'), ('Brown'), ('Jones'),
        ('Garcia'), ('Miller'), ('Davis'), ('Rodriguez'), ('Martinez'),
        ('Hernandez'), ('Lopez'), ('Gonzalez'), ('Wilson'), ('Anderson'),
        ('Thomas'), ('Taylor'), ('Moore'), ('Jackson'), ('Martin'),
        ('Lee'), ('Perez'), ('Thompson'), ('White'), ('Harris'),
        ('Sanchez'), ('Clark'), ('Ramirez'), ('Lewis'), ('Robinson')
      ) AS l(name) ORDER BY RANDOM() LIMIT 1
    ) AS last_names
    CROSS JOIN LATERAL (
      SELECT title FROM (VALUES 
        ('Senior Editor'), ('Editor'), ('Junior Editor'), ('Copy Editor'),
        ('Senior Developer'), ('Developer'), ('Junior Developer'), ('Tech Lead'),
        ('Senior Designer'), ('Designer'), ('UI/UX Designer'), ('Visual Designer'),
        ('Project Manager'), ('Account Manager'), ('Technical Writer'), ('Content Specialist'),
        ('Quality Analyst'), ('Business Analyst'), ('Marketing Specialist'), ('Sales Representative')
      ) AS t(title) ORDER BY RANDOM() LIMIT 1
    ) AS titles
    CROSS JOIN LATERAL (
      SELECT dept FROM (VALUES 
        ('Editorial'), ('Engineering'), ('Design'), ('Marketing'), 
        ('Sales'), ('Operations'), ('Quality Assurance'), ('Finance')
      ) AS d(dept) ORDER BY RANDOM() LIMIT 1
    ) AS departments
    CROSS JOIN LATERAL (
      SELECT status FROM (VALUES 
        ('Available'), ('Available'), ('Available'), ('Available'), ('Available'),
        ('Available'), ('Available'), ('Busy'), ('Busy'), ('Unavailable')
      ) AS a(status) ORDER BY RANDOM() LIMIT 1
    ) AS availability
    ON CONFLICT (email) DO NOTHING;
  `;

  await client.query(bulkContacts);
}

async function createSkills(client) {
  const skills = `
    INSERT INTO skills (name, category, description)
    VALUES 
      -- Technical Skills
      ('JavaScript', 'Technical', 'JavaScript programming language'),
      ('TypeScript', 'Technical', 'TypeScript programming language'),
      ('React', 'Technical', 'React.js framework'),
      ('Node.js', 'Technical', 'Node.js runtime'),
      ('Python', 'Technical', 'Python programming language'),
      ('Java', 'Technical', 'Java programming language'),
      ('MySQL', 'Technical', 'MySQL database'),
      ('PostgreSQL', 'Technical', 'PostgreSQL database'),
      ('Docker', 'Technical', 'Docker containerization'),
      ('AWS', 'Technical', 'Amazon Web Services'),
      ('Git', 'Technical', 'Git version control'),
      ('REST APIs', 'Technical', 'RESTful API development'),
      ('GraphQL', 'Technical', 'GraphQL API development'),
      ('Blockchain', 'Technical', 'Blockchain development'),

      -- Creative Skills
      ('Technical Writing', 'Creative', 'Technical documentation writing'),
      ('Content Creation', 'Creative', 'General content creation'),
      ('API Documentation', 'Creative', 'API documentation writing'),
      ('Graphic Design', 'Creative', 'Visual and graphic design'),
      ('UI/UX Design', 'Creative', 'User interface and experience design'),
      ('Video Editing', 'Creative', 'Video production and editing'),
      ('Content Management', 'Creative', 'Content management systems'),

      -- Business Skills
      ('Project Management', 'Business', 'Project planning and management'),
      ('Business Analysis', 'Business', 'Business requirements analysis'),
      ('Agile/Scrum', 'Business', 'Agile and Scrum methodologies'),
      ('Client Relations', 'Business', 'Client relationship management'),
      ('Quality Assurance', 'Business', 'Quality assurance and testing')
    ON CONFLICT (name) DO NOTHING;
  `;

  await client.query(skills);
}

async function createWorkflows(client) {
  const workflows = `
    INSERT INTO workflows (name, description, type, category, stages)
    VALUES 
      ('Content Production Workflow', 
       'Standard workflow for content creation and publishing', 
       'BPMN', 'Editorial',
       '[
         {"name": "Content Creation", "type": "User Task", "hours": 40, "skills": ["Technical Writing", "API Documentation"]},
         {"name": "Technical Review", "type": "User Task", "hours": 8, "skills": ["Technical Writing", "Quality Assurance"]},
         {"name": "Quality Check", "type": "System Task", "hours": 2},
         {"name": "Final Approval", "type": "Manual Task", "hours": 4, "skills": ["Project Management"]}
       ]'::jsonb),

      ('Design Review Process', 
       'Creative review and approval workflow', 
       'BPMN', 'Design',
       '[
         {"name": "Initial Design", "type": "User Task", "hours": 24, "skills": ["Graphic Design", "UI/UX Design"]},
         {"name": "Peer Review", "type": "User Task", "hours": 4, "skills": ["Graphic Design"]},
         {"name": "Client Review", "type": "User Task", "hours": 8, "skills": ["Client Relations"]}
       ]'::jsonb),

      ('Software Development Sprint', 
       'Agile development workflow', 
       'BPMN', 'Engineering',
       '[
         {"name": "Sprint Planning", "type": "User Task", "hours": 4, "skills": ["Agile/Scrum", "Project Management"]},
         {"name": "Development", "type": "User Task", "hours": 60, "skills": ["JavaScript", "React", "Node.js"]},
         {"name": "Code Review", "type": "User Task", "hours": 8, "skills": ["JavaScript", "Git"]},
         {"name": "Testing", "type": "User Task", "hours": 16, "skills": ["Quality Assurance"]},
         {"name": "Deployment", "type": "User Task", "hours": 4, "skills": ["Docker", "AWS"]}
       ]'::jsonb)
    ON CONFLICT DO NOTHING;
  `;

  await client.query(workflows);

  // Create workflow stages
  const stages = `
    INSERT INTO workflow_stages (workflow_id, name, type, sequence_order, estimated_hours, required_skills)
    SELECT 
      w.id,
      stage->>'name',
      stage->>'type',
      row_number() OVER (PARTITION BY w.id ORDER BY ordinality),
      (stage->>'hours')::INTEGER,
      stage->'skills'
    FROM workflows w,
    LATERAL jsonb_array_elements(w.stages) WITH ORDINALITY AS stage
    ON CONFLICT DO NOTHING;
  `;

  await client.query(stages);
}

async function createTestUsers(client) {
  // Simple password for demo (in real app, this would be hashed)
  const users = `
    INSERT INTO users (email, password, first_name, last_name, role, is_active)
    VALUES 
      ('admin@s4carlisle.com', 'Demo2024!', 'Admin', 'User', 'admin', true),
      ('manager@s4carlisle.com', 'Demo2024!', 'Manager', 'User', 'manager', true),
      ('user@s4carlisle.com', 'Demo2024!', 'Regular', 'User', 'user', true)
    ON CONFLICT (email) DO NOTHING;
  `;

  await client.query(users);
}

async function verifyAndDisplayResults(client) {
  // Get statistics
  const stats = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM contacts) as total_contacts,
      (SELECT COUNT(*) FROM contacts WHERE email = 'alex.martinez@freelance.com') as alexandra_exists,
      (SELECT COUNT(*) FROM companies) as total_companies,
      (SELECT COUNT(*) FROM workflows) as total_workflows,
      (SELECT COUNT(*) FROM contacts WHERE availability = 'Available') as available_contacts,
      (SELECT COUNT(*) FROM contacts WHERE availability = 'Busy') as busy_contacts,
      (SELECT COUNT(*) FROM contacts WHERE availability = 'Unavailable') as unavailable_contacts,
      (SELECT COUNT(*) FROM contacts WHERE type = 'Employee') as employees,
      (SELECT COUNT(*) FROM contacts WHERE type = 'Vendor') as vendors,
      (SELECT COUNT(*) FROM contacts WHERE type = 'Freelancer') as freelancers,
      (SELECT COUNT(*) FROM skills) as total_skills,
      (SELECT COUNT(*) FROM users) as total_users
  `);

  const data = stats.rows[0];

  log('\n=====================================', 'blue');
  log('🎉 DEMO SETUP COMPLETE!', 'bright');
  log('=====================================\n', 'blue');

  log('📊 DATABASE STATISTICS:', 'cyan');
  log(`   Total Contacts: ${data.total_contacts}`, 'green');
  log(`   ├── Employees: ${data.employees}`);
  log(`   ├── Vendors: ${data.vendors}`);
  log(`   └── Freelancers: ${data.freelancers}`);
  log('');
  log(`   Availability:`, 'green');
  log(`   ├── Available: ${data.available_contacts} (${Math.round(data.available_contacts/data.total_contacts*100)}%)`);
  log(`   ├── Busy: ${data.busy_contacts} (${Math.round(data.busy_contacts/data.total_contacts*100)}%)`);
  log(`   └── Unavailable: ${data.unavailable_contacts} (${Math.round(data.unavailable_contacts/data.total_contacts*100)}%)`);
  log('');
  log(`   Companies: ${data.total_companies}`, 'green');
  log(`   Workflows: ${data.total_workflows}`, 'green');
  log(`   Skills: ${data.total_skills}`, 'green');
  log(`   Test Users: ${data.total_users}`, 'green');

  log('\n✅ KEY DEMO DATA VERIFIED:', 'cyan');
  if (data.alexandra_exists > 0) {
    log('   ✓ Alexandra Martinez (Freelancer) - READY', 'green');
  } else {
    log('   ✗ Alexandra Martinez - NOT FOUND', 'red');
  }

  // Get and display key contacts
  const keyContacts = await client.query(`
    SELECT first_name || ' ' || last_name as name, email, availability, current_workload 
    FROM contacts 
    WHERE email IN ('john.smith@s4carlisle.com', 'sarah.johnson@s4carlisle.com')
    ORDER BY email
  `);

  keyContacts.rows.forEach(contact => {
    log(`   ✓ ${contact.name} - ${contact.availability} (${contact.current_workload}% workload)`, 'green');
  });

  log('\n🔐 TEST ACCOUNTS:', 'cyan');
  log('   Email: admin@s4carlisle.com    Password: Demo2024!');
  log('   Email: manager@s4carlisle.com  Password: Demo2024!');
  log('   Email: user@s4carlisle.com     Password: Demo2024!');

  log('\n🎯 DEMO SCENARIOS READY:', 'cyan');
  log('   ✓ Search for "Alexandra Martinez" to show freelancer assignment');
  log('   ✓ Filter by "Available" to show resource availability');
  log('   ✓ John Smith shows 60% workload for capacity demo');
  log('   ✓ Sarah Johnson shows "Busy" status at 80% capacity');
  log('   ✓ Search for "Blockchain" to demonstrate skills gap');
  log('   ✓ Content Production Workflow ready for assignment demo');

  log('\n🚀 YOUR DEMO IS READY!', 'bright');
  log('   Start your Replit app and begin the demonstration', 'green');
  log('   Good luck with your presentation! 🎉\n', 'green');
}

// Run the setup
setupDemo().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});