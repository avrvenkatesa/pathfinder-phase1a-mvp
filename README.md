[![OpenAPI CI](https://github.com/OWNER/REPO/actions/workflows/openapi-ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/openapi-ci.yml)

The canonical spec lives at `server/docs/openapi.yaml`. CI validates and lints the spec on every push/PR, enforcing:

- Operation-level `security` + `401`/`429` on `/api/instances/**` and `/api/workflows/**`
- Hygiene: `operationId`, `summary`, and `tags`

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

### Runtime auth (M1)

Runtime endpoints now require authentication. See **[Runtime Auth (M1)](server/docs/runtime/runtime-auth.md)** for details and examples.  
Related: **[Rate limits](server/docs/runtime/rate-limits.md)**.

**Gated (401 if unauthenticated):**

- `GET /api/instances` (seek-paginated list)
- `GET /api/instances/:id`
- `GET /api/instances/:id/progress`
- `PATCH /api/instances/:id/steps/:stepId/status`
- `POST /api/instances/:id/steps/:stepId/advance`
- `POST /api/instances/:id/steps/:stepId/complete`
- All routes under `/api/workflows/**`

**Public / un-gated:**

- `GET /api/health`, `GET /healthz`
- API docs (e.g., `GET /api/docs/openapi.yaml`)
- `GET /metrics` (non-sensitive metrics)
- Auth bootstrap under `/api/auth/*` (as defined in `authJwtRoutes`; note: `/api/auth/user` itself requires a session)

**Client note:** send a valid session cookie or `Authorization: Bearer <token>` with all runtime requests; on `401`, refresh credentials and retry.
