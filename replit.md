# PathFinder - Hierarchical Contact Management System

## Overview

PathFinder is a full-stack contact management application that organizes contacts in a hierarchical structure. The system allows users to manage companies, divisions, and people with their relationships, providing a comprehensive view of organizational structures and personal networks.

The application is built as a modern web application with a React frontend and Express.js backend, featuring real-time contact management, filtering capabilities, and a tree-based visualization of contact hierarchies.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Skills-Based Assignment Engine**: Intelligent matching system with skill taxonomy, workload balancing, and ML-ready scoring
- **Department Integration**: Dynamic department dropdown tied to company hierarchy for improved data consistency

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