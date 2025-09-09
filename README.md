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

## What’s new

**M1: Convenience step endpoints**  
Two new endpoints wrap the validated transition logic & dependency checks used by the PATCH route:

- `POST /api/instances/{instanceId}/steps/{stepInstanceId}/advance` → `pending → in_progress`
- `POST /api/instances/{instanceId}/steps/{stepInstanceId}/complete` → `in_progress → completed`

If earlier steps in the workflow aren’t completed, these return **409** with:

```json
{ "error": "Conflict", "code": "NotReady" }
Quick examples
Advance:

bash
Copy code
curl -X POST \
  "http://localhost:3000/api/instances/<instanceId>/steps/<stepInstanceId>/advance" \
  -H "Content-Type: application/json"
Complete (may be blocked by sequence rules):

bash
Copy code
curl -X POST \
  "http://localhost:3000/api/instances/<instanceId>/steps/<laterStepId>/complete" \
  -H "Content-Type: application/json"
```
