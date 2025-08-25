/**
 * FIX REPLIT AUTH DATABASE ISSUE
 * 
 * Run this script to fix the password NULL constraint issue
 * Save as: fixAuth.cjs
 * Run: node fixAuth.cjs
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database found!');
  process.exit(1);
}

async function fixAuthIssue() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Fixing Replit Auth database issue...\n');

    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Check current users table structure
    console.log('📋 Checking current table structure...');
    const checkStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('Current users table columns:');
    checkStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Step 2: Alter the password column to allow NULL
    console.log('\n🔄 Modifying password column to allow NULL values...');
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN password DROP NOT NULL;
    `);
    console.log('✅ Password column now allows NULL values');

    // Step 3: Add auth_provider column if it doesn't exist
    console.log('\n➕ Adding auth_provider column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
    `);
    console.log('✅ auth_provider column added');

    // Step 4: Add replit_id column for Replit OAuth
    console.log('\n➕ Adding replit_id column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS replit_id VARCHAR(255) UNIQUE;
    `);
    console.log('✅ replit_id column added');

    // Step 5: Update existing demo users to mark them as local auth
    console.log('\n📝 Updating existing demo users...');
    await client.query(`
      UPDATE users 
      SET auth_provider = 'local' 
      WHERE email IN ('admin@s4carlisle.com', 'manager@s4carlisle.com', 'user@s4carlisle.com')
      AND password IS NOT NULL;
    `);
    console.log('✅ Demo users updated');

    // Step 6: Create index for faster lookups
    console.log('\n🚀 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_replit_id ON users(replit_id);
      CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
    `);
    console.log('✅ Indexes created');

    // Step 7: Verify the changes
    console.log('\n✅ Verifying changes...');
    const verifyStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('password', 'auth_provider', 'replit_id')
      ORDER BY column_name;
    `);

    console.log('\nUpdated columns:');
    verifyStructure.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Step 8: Show sample insert statements
    console.log('\n📋 Your app can now handle both auth types:');
    console.log('\n1. Replit OAuth users (no password):');
    console.log(`   INSERT INTO users (email, first_name, last_name, auth_provider, replit_id)
   VALUES ('user@example.com', 'John', 'Doe', 'replit', 'replit_user_123');`);

    console.log('\n2. Local auth users (with password):');
    console.log(`   INSERT INTO users (email, password, first_name, last_name, auth_provider)
   VALUES ('local@example.com', 'hashed_password', 'Jane', 'Smith', 'local');`);

    console.log('\n🎉 Database fixed! Your Replit app should work now.');
    console.log('\n📌 Note: You may need to restart your Replit app for changes to take effect.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

// Also create a function to check if a specific user exists
async function checkUser(email) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length > 0) {
      console.log(`\n👤 User found: ${email}`);
      console.log(`   Name: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
      console.log(`   Auth: ${result.rows[0].auth_provider || 'local'}`);
      console.log(`   Has Password: ${result.rows[0].password ? 'Yes' : 'No'}`);
    } else {
      console.log(`\n❌ User not found: ${email}`);
    }
  } catch (error) {
    console.error('Error checking user:', error.message);
  } finally {
    await client.end();
  }
}

// Run the fix
fixAuthIssue().then(() => {
  // Optionally check for your user
  if (process.argv[2]) {
    checkUser(process.argv[2]);
  }
}).catch(console.error);