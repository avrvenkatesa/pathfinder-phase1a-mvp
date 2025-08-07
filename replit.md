# PathFinder - Hierarchical Contact Management System

## Overview

PathFinder is a full-stack contact management application that organizes contacts in a hierarchical structure. The system allows users to manage companies, divisions, and people with their relationships, providing a comprehensive view of organizational structures and personal networks.

The application is built as a modern web application with a React frontend and Express.js backend, featuring real-time contact management, filtering capabilities, and a tree-based visualization of contact hierarchies.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 2025)

### Skills-Based Assignment Engine - COMPLETED
- **Status**: Fully operational and tested
- **Implementation**: Complete assignment engine with real-time recommendations
- **Features**: 
  - Multi-tab interface with Simple Test and S4 Editorial Examples
  - Live recommendation system using actual contact data
  - Intelligent scoring based on skills, roles, and availability
  - Interactive recommendation cards with detailed reasoning
  - Fallback system using S4 Editorial team examples
- **Testing**: Successfully validated with user confirmation
- **Location**: `/assignment-engine` page with comprehensive demo interface

### BPMN Connectors Implementation - COMPLETED
- **Status**: Fully operational BPMN workflow connectors with visual feedback
- **Date**: January 6, 2025
- **Implementation**: Complete visual connection system for workflow elements
- **Core Features**:
  - **WorkflowConnector Component** - Professional bezier curve connections with arrows
  - **ConnectionCreator Component** - Interactive anchor point system for creating connections
  - **Visual Feedback System** - Hover states, selection indicators, and delete controls
  - **Connection Types** - Support for sequence, conditional, and message flow types
  - **Smart Anchoring** - Automatic anchor point detection (top, right, bottom, left)
  - **Integrated Canvas Support** - Full integration with existing workflow canvas system
  - **Demo Implementation** - Working demonstration component with interactive examples
- **Technical Features**:
  - SVG-based rendering for crisp visual quality at any zoom level
  - Pointer event handling for intuitive connection creation workflow
  - Type-safe TypeScript interfaces for all connection properties
  - Efficient re-rendering with React optimization patterns
  - Z-index management for proper layering with workflow elements
- **User Experience**:
  - Click and drag workflow for connecting elements
  - Visual anchor points appear on hover for precise connection placement
  - Selected connections show delete buttons and visual highlighting
  - Support for connection labeling and conditional flow types
- **Testing**: Successfully demonstrated with interactive ConnectorDemo component
- **Location**: `client/src/components/WorkflowConnector.tsx` and demo at `client/src/components/ConnectorDemo.tsx`

### Complete Skills-Based Assignment Engine with Gap Analysis - COMPLETED
- **Status**: Fully operational with comprehensive functionality including intelligent skills gap analysis
- **Date**: January 6, 2025
- **Implementation**: Advanced workflow assignment system with intelligent contact matching and comprehensive gap analysis
- **Core Features**:
  - Required Skills section with drag-and-drop reordering and visual proficiency indicators
  - Add/Remove skill functionality with name, level (Beginner/Intermediate/Advanced/Expert), and weight (1-10)
  - Weight distribution system with percentage calculations and color-coded importance levels
  - Visual weight analysis with progress bars and normalize to 100% functionality
  - **NEW: Comprehensive Skills Gap Analysis Component** - Intelligent detection and resolution of skill shortages
    - Critical gap alerts (red) for missing high-weight skills with no qualified team members
    - Moderate gap warnings (yellow) for scarce skills or insufficient proficiency levels
    - Expandable gap details with closest matches and skill distance analysis
    - Actionable suggestion system with effort estimates and time requirements
    - Clickable "Apply" buttons for automatic requirement adjustments
    - Visual coverage progress bars showing team skill adequacy percentages
    - Real-time analysis updates when skills are added, edited, or removed
    - Robust error handling for missing or malformed skill data
  - Collapsible Assignment Recommendations with intelligent scoring algorithm
  - Real-time contact matching based on skills (45%), availability (25%), workload (20%), and department (10%)
  - Rich recommendation cards showing match percentages, skill breakdowns, and workload visualization
  - Functional assignment system with contact assignment/removal capabilities
  - Visual task assignment display on workflow canvas with assignee names in green badges
  - Persistent assignment data storage in workflow element properties
- **Testing**: Successfully validated with user confirmation - complete system with gap analysis operational
- **Location**: Workflow Designer Properties panel with full assignment workflow integration and gap analysis between Required Skills and Assignment Recommendations sections

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for robust form management
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety across the entire stack
- **API Design**: RESTful API with structured endpoints for contacts and authentication
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes
- **Session Management**: Express sessions with PostgreSQL storage for persistence

### Data Storage Solutions
- **Database**: PostgreSQL as the primary database
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Database Provider**: Neon serverless PostgreSQL for scalable cloud hosting
- **Schema Design**: Hierarchical contact structure with self-referencing parent-child relationships
- **Session Storage**: PostgreSQL-backed session store for authentication persistence

### Authentication and Authorization
- **Provider**: Replit Auth integration using OpenID Connect (OIDC)
- **Session Management**: Secure session-based authentication with HTTP-only cookies
- **Authorization**: Route-level protection with middleware checking authenticated status
- **User Management**: Automatic user creation and profile synchronization from Replit

### Contact Management Features
- **Hierarchical Structure**: Three-tier system supporting companies, divisions, and people
- **Advanced Search & Filtering**: Multi-field search with Boolean operators, fuzzy matching, and real-time suggestions
- **Tree Visualization**: Expandable/collapsible tree view for exploring contact relationships
- **CRUD Operations**: Full create, read, update, delete functionality with optimistic updates
- **Analytics Dashboard**: Interactive charts with contact distribution, skills analysis, and capacity metrics
- **Advanced Hierarchy Tree**: Interactive drag-and-drop tree with visual feedback and reorganization
- **Relationship Management**: Multi-type relationships (reports to, works with, supervises, collaborates)
- **Organization Chart**: Visual org chart with PDF export and team structure visualization
- **Workflow Contact Selection**: Skills-based filtering and bulk assignment for workflow management
- **Enhanced Contact Forms**: Multi-step forms with comprehensive contact data collection
- **Export Capabilities**: Multiple formats (CSV, Excel, PDF, vCard) with custom field selection
- **Performance Optimization**: Debounced search, contact caching, and efficient filtering
- **Skills-Based Assignment Engine**: Fully operational intelligent matching system with real-time recommendations, skill analysis, and workflow integration
- **Department Integration**: Dynamic department dropdown tied to company hierarchy for improved data consistency
- **Assignment Engine Demo**: Interactive demonstration with S4 Editorial examples and live recommendation system
- **Workflow Required Skills Management**: Complete skill requirement definition system with add/remove functionality, skill levels, and weighting for workflow elements

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-kit**: Database schema management and migrations
- **@tanstack/react-query**: Server state management and caching
- **express**: Web framework for the backend API
- **passport**: Authentication middleware for Express

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for managing component variants
- **lucide-react**: Icon library for consistent iconography
- **@dnd-kit/***: Drag and drop functionality for hierarchy reorganization
- **react-organizational-chart**: Organization chart visualization component

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Type checking and enhanced developer experience
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **wouter**: Lightweight routing for React applications

### Authentication
- **openid-client**: OpenID Connect client for Replit Auth integration
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **express-session**: Session management middleware

### Form and Validation
- **react-hook-form**: Performant form library with minimal re-renders
- **@hookform/resolvers**: Integration between React Hook Form and validation libraries
- **zod**: Runtime type validation and schema definition
- **drizzle-zod**: Integration between Drizzle ORM and Zod validation