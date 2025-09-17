const { Client } = require('pg');

async function testNeonConnection() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
        console.error('❌ DATABASE_URL not found');
        console.log('Please set DATABASE_URL with your Neon connection string');
        process.exit(1);
    }
    
    console.log('🔍 Testing Neon database connection...');
    
    // Parse URL to show connection details (safely)
    try {
        const url = new URL(connectionString);
        console.log('Host:', url.hostname);
        console.log('Database:', url.pathname.substring(1));
        console.log('SSL Mode:', url.searchParams.get('sslmode'));
    } catch (e) {
        console.log('Could not parse URL');
    }
    
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for Neon
    });
    
    try {
        await client.connect();
        console.log('✅ Neon database connection successful!');
        
        // Test query
        const result = await client.query('SELECT version()');
        console.log('📊 PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
        
        // Check if tables exist
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📋 Tables found:', tables.rows.length);
        
        await client.end();
        console.log('✅ Connection test complete');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        
        if (error.message.includes('password authentication')) {
            console.log('💡 Check your username and password');
        } else if (error.message.includes('does not exist')) {
            console.log('💡 Check your database name');
        } else if (error.message.includes('getaddrinfo')) {
            console.log('💡 Check your host URL');
        }
        
        process.exit(1);
    }
}

testNeonConnection();
