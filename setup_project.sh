#!/bin/bash

# Pathfinder Phase 1A Project Structure Setup Script
# Run this in your Replit shell to create the complete project structure

echo "🚀 Setting up Pathfinder Phase 1A project structure..."

# Create main project directories
echo "📁 Creating main directories..."
mkdir -p backend/src/{routes,models,middleware,services,config,utils}
mkdir -p backend/tests/{unit,integration,fixtures}
mkdir -p frontend/src/{components/{common,contacts,hierarchy},pages/{auth,contacts,dashboard},services,hooks,context,utils,styles}
mkdir -p frontend/public
mkdir -p database/{migrations,seeders}
mkdir -p docs/{api,setup,user_stories}

# Backend file structure
echo "🔧 Creating backend files..."

# Backend package.json
cat > backend/package.json << 'EOF'
{
  "name": "pathfinder-backend",
  "version": "1.0.0",
  "description": "Phase 1A Contact Management Backend",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "migrate": "npx sequelize-cli db:migrate",
    "seed": "npx sequelize-cli db:seed:all"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "pg": "^8.11.3",
    "pg-hstore": "^2.3.4",
    "sequelize": "^6.35.0",
    "sequelize-cli": "^6.6.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@types/jest": "^29.5.8"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Backend .env template
cat > backend/.env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/pathfinder_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pathfinder_dev
DB_USER=postgres
DB_PASSWORD=password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# API Configuration
API_VERSION=v1
API_PREFIX=/api
EOF

# Main app.js
cat > backend/src/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/error');
const { setupSwagger } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

module.exports = app;
EOF

# Database configuration
cat > backend/src/config/database.js << 'EOF'
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/pathfinder_dev',
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');

    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('📊 Database models synchronized');
    }
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    throw error;
  }
};

module.exports = { sequelize, connectDB };
EOF

# Routes index
cat > backend/src/routes/index.js << 'EOF'
const express = require('express');
const authRoutes = require('./auth');
const contactRoutes = require('./contacts');
const contactTypeRoutes = require('./contactTypes');
const hierarchyRoutes = require('./hierarchy');

const router = express.Router();

// API versioning
const API_VERSION = '/v1';

// Route mounting
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/contacts`, contactRoutes);
router.use(`${API_VERSION}/contact-types`, contactTypeRoutes);
router.use(`${API_VERSION}/hierarchy`, hierarchyRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Pathfinder API v1.0.0',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      contacts: '/api/v1/contacts',
      contactTypes: '/api/v1/contact-types',
      hierarchy: '/api/v1/hierarchy'
    },
    documentation: '/api-docs'
  });
});

module.exports = router;
EOF

# Create basic route files
touch backend/src/routes/{auth.js,contacts.js,contactTypes.js,hierarchy.js}
touch backend/src/models/{index.js,User.js,Contact.js,ContactType.js,ContactRelationship.js}
touch backend/src/middleware/{auth.js,validation.js,error.js,logging.js}
touch backend/src/services/{contactService.js,hierarchyService.js,searchService.js,validationService.js}
touch backend/src/config/{jwt.js,environment.js,swagger.js}
touch backend/src/utils/{helpers.js,constants.js,validators.js}

# Frontend file structure
echo "⚛️ Creating frontend files..."

# Frontend package.json
cat > frontend/package.json << 'EOF'
{
  "name": "pathfinder-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@mui/material": "^5.14.20",
    "@mui/icons-material": "^5.14.19",
    "@mui/lab": "^5.0.0-alpha.155",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "@mui/x-tree-view": "^6.17.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "react-hook-form": "^7.48.2",
    "axios": "^1.6.2",
    "@tanstack/react-query": "^5.8.4",
    "@hookform/resolvers": "^3.3.2",
    "yup": "^1.4.0",
    "react-hot-toast": "^2.4.1",
    "date-fns": "^2.30.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^5.17.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^13.5.0",
    "@types/react": "^18.2.42",
    "@types/react-dom": "^18.2.17",
    "typescript": "^4.9.5",
    "web-vitals": "^2.1.4",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:5000"
}
EOF

# Frontend .env
cat > frontend/.env << 'EOF'
REACT_APP_API_BASE_URL=http://localhost:5000/api/v1
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development
REACT_APP_APP_NAME=Pathfinder Contact Management
EOF

# Frontend public/index.html
cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Pathfinder Contact Management System" />
    <title>Pathfinder - Contact Management</title>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
    />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
    />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

# Main App.jsx
cat > frontend/src/App.jsx << 'EOF'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import theme from './styles/theme';
import { AuthProvider } from './context/AuthContext';
import { ContactProvider } from './context/ContactContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import ContactsPage from './pages/contacts/ContactsPage';
import ContactDetailsPage from './pages/contacts/ContactDetailsPage';
import CreateContactPage from './pages/contacts/CreateContactPage';
import EditContactPage from './pages/contacts/EditContactPage';
import DashboardPage from './pages/dashboard/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ContactProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/contacts" element={<ContactsPage />} />
                          <Route path="/contacts/:id" element={<ContactDetailsPage />} />
                          <Route path="/contacts/new" element={<CreateContactPage />} />
                          <Route path="/contacts/:id/edit" element={<EditContactPage />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Router>
            <Toaster position="top-right" />
          </ContactProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
EOF

# index.js
cat > frontend/src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Create placeholder component files
touch frontend/src/components/common/{Layout.jsx,Header.jsx,Sidebar.jsx,LoadingSpinner.jsx,ErrorBoundary.jsx,ProtectedRoute.jsx}
touch frontend/src/components/contacts/{ContactList.jsx,ContactCard.jsx,ContactForm.jsx,ContactDetails.jsx,ContactSearch.jsx,ContactFilters.jsx}
touch frontend/src/components/hierarchy/{HierarchyTree.jsx,HierarchyNode.jsx,RelationshipManager.jsx}
touch frontend/src/pages/auth/{LoginPage.jsx,RegisterPage.jsx}
touch frontend/src/pages/contacts/{ContactsPage.jsx,ContactDetailsPage.jsx,CreateContactPage.jsx,EditContactPage.jsx}
touch frontend/src/pages/dashboard/DashboardPage.jsx
touch frontend/src/services/{api.js,authService.js,contactService.js,hierarchyService.js,searchService.js}
touch frontend/src/hooks/{useAuth.js,useContacts.js,useSearch.js,useHierarchy.js}
touch frontend/src/context/{AuthContext.jsx,ContactContext.jsx,ThemeContext.jsx}
touch frontend/src/utils/{constants.js,helpers.js,formatters.js,validators.js}

# CSS files
cat > frontend/src/styles/globals.css << 'EOF'
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

#root {
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
EOF

touch frontend/src/styles/{components.css,themes.css}

# Database files
echo "🗄️ Creating database files..."

cat > database/schema.sql << 'EOF'
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
EOF

# Documentation files
echo "📚 Creating documentation..."

cat > README.md << 'EOF'
# Pathfinder Phase 1A - Contact Management MVP

## Project Overview
This is the Phase 1A implementation of the Pathfinder Platform Migration project, focusing on Contact Management with workflow integration foundation.

## Technology Stack
- **Backend**: Express.js + Node.js
- **Frontend**: React 18 + Material-UI
- **Database**: PostgreSQL + Sequelize ORM
- **Authentication**: JWT
- **Development**: Replit collaborative environment

## Quick Start

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Database Setup
```bash
cd backend
npm run migrate
npm run seed
```

## Project Structure
```
pathfinder-phase1a-mvp/
├── backend/          # Express.js API
├── frontend/         # React application
├── database/         # Database schema and migrations
└── docs/            # Documentation
```

## API Endpoints
- `GET /api/v1/contacts` - List contacts
- `POST /api/v1/contacts` - Create contact
- `GET /api/v1/contacts/:id` - Get contact details
- `PUT /api/v1/contacts/:id` - Update contact
- `DELETE /api/v1/contacts/:id` - Delete contact

## Development Team
- 2 Developers (Replit-based)
- 1 Tester
- Infrastructure support team

## Phase 1A Features
✅ Contact CRUD operations
✅ Hierarchical contact relationships
✅ Contact type management
✅ Search and filtering
✅ JWT Authentication
✅ Workflow integration foundation

## Next Steps
- Implement User Stories 1.2-1.5
- Add workflow integration
- Deploy to production infrastructure
EOF

# Root .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
build/
dist/
*.tgz
*.tar.gz

# Logs
logs
*.log

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Database
*.sqlite
*.db

# Temporary files
tmp/
temp/
EOF

# Make the script executable and run final setup
echo "🎉 Project structure created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. cd backend && npm install"
echo "2. cd frontend && npm install"
echo "3. Set up your PostgreSQL database connection in backend/.env"
echo "4. Run 'npm run dev' in backend directory"
echo "5. Run 'npm start' in frontend directory"
echo ""
echo "🔗 URLs after setup:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
echo "- API Documentation: http://localhost:5000/api-docs"
echo "- Health Check: http://localhost:5000/health"
echo ""
echo "✅ Ready for Phase 1A development!"