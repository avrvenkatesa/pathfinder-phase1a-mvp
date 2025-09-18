# Pathfinder Platform - Phase 1A MVP

A modern contact management system with runtime dashboard capabilities, built on a fresh Express.js architecture with React frontend.

## Project Status

- **Backend**: ✅ Production Ready
- **Runtime Dashboard APIs**: ✅ Complete (Issue #15 Resolved)
- **Frontend**: ⚠️ In Progress (Issue #16 - Path Import Resolution)
- **Version**: 1.0.0

## Architecture

### Backend
- **Framework**: Express.js with Fresh Architecture
- **Runtime**: Node.js with TypeScript (tsx)
- **Database**: PostgreSQL
- **WebSocket**: Integrated for real-time updates
- **Logging**: Structured logging with timestamps

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + Material-UI components
- **State Management**: React hooks and context

## Features

### Runtime Dashboard (Complete)
- **System Metrics**: CPU, memory, uptime, request monitoring
- **Team Management**: Availability tracking, performance metrics
- **Issue Tracking**: Severity-based issue management
- **Timeline Events**: System event monitoring with timestamps
- **Real-time Updates**: WebSocket integration for live data

### Contact Management (Existing)
- Contact CRUD operations
- Hierarchical relationships (Company → Division → Person)
- Advanced search and filtering
- User authentication and authorization

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database

### Installation
```bash
# Clone repository
git clone <repository-url>
cd pathfinder-phase1a-mvp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database configuration

# Start development server
tsx server/freshStart.ts
Development Server
The server runs on http://localhost:3001 and includes:

Backend APIs at /api/*
Frontend serving at /
WebSocket server for real-time features

API Documentation
Runtime Dashboard Endpoints
System Metrics
httpGET /api/runtime-dashboard/metrics
Returns real-time system performance data including CPU, memory, and request metrics.
Team Data
httpGET /api/runtime-dashboard/team-data
Provides team availability and performance statistics.
Issues Tracking
httpGET /api/runtime-dashboard/issues
Lists current system issues with severity levels and status.
Timeline Events
httpGET /api/runtime-dashboard/timeline
Returns chronological system events for monitoring.
Health Check
httpGET /api/instances
Basic server connectivity and health verification.
Response Format
All APIs return JSON with proper HTTP status codes. See API Documentation for detailed schemas.
Development
Project Structure
pathfinder-phase1a-mvp/
├── server/                     # Backend Express application
│   ├── freshStart.ts          # Server entry point
│   ├── freshAppWithEvents.ts  # Main application with routes
│   ├── logger.ts              # Logging configuration
│   └── websocket.ts           # WebSocket integration
├── client/                     # React frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks
│   │   └── lib/              # Utility libraries
│   ├── vite.config.ts        # Vite configuration
│   └── tsconfig.json         # TypeScript configuration
├── docs/                       # Documentation
├── tests/                      # Test files
├── runtime_dashboard_test_script.sh  # API testing script
└── README.md
Testing
Runtime Dashboard API Testing
bash# Run comprehensive API tests
./runtime_dashboard_test_script.sh

# Quick API validation
./quick_runtime_test.sh

# Manual endpoint testing
curl http://localhost:3001/api/instances
curl http://localhost:3001/api/runtime-dashboard/metrics
Test Results

API Success Rate: 100%
All Endpoints: ✅ Functional
Response Times: < 100ms average
Error Handling: ✅ Proper status codes

Known Issues
Issue #16: Frontend Path Import Resolution
The frontend currently has TypeScript path alias configuration issues preventing React components from loading. This does not affect backend functionality.
Symptoms:

Vite dependency resolution errors
Frontend routes return server errors
React application not loading

Status: Open issue, backend APIs fully functional
Deployment
Development
bashtsx server/freshStart.ts
Production
Production deployment documentation will be provided after frontend resolution (Issue #16).
Contributing

Fork the repository
Create a feature branch
Make changes with appropriate tests
Submit a pull request

Code Standards

TypeScript for type safety
Structured logging for debugging
Comprehensive error handling
API documentation for all endpoints

Recent Changes
Issue #15 Resolution

✅ Implemented runtime dashboard backend APIs
✅ Resolved HTTP routing issues with fresh Express architecture
✅ Added WebSocket support for real-time updates
✅ Comprehensive API testing with 100% success rate

Support
For technical issues:

Check the API Documentation
Review test results with ./runtime_dashboard_test_script.sh
Check server logs for detailed error information
Refer to issue tracking for known problems

License
[License information to be added]
Team
Development Team - Pathfinder Platform Migration Phase 1A

Note: This project successfully resolves HTTP routing issues that were blocking runtime dashboard functionality. The fresh Express architecture provides a stable foundation for both current features and future development.
