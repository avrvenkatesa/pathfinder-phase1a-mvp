# Pathfinder Platform - Microservices Architecture

This document describes the microservices architecture implementation for the Pathfinder Platform.

## Architecture Overview

The Pathfinder Platform has been refactored from a monolithic application into a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Auth Service  │
│   (React)       │────│   Port: 3000    │────│   Port: 3003    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                          │
                              │                          │
                    ┌─────────┼─────────┐               │
                    │                   │               │
            ┌─────────────────┐ ┌─────────────────┐     │
            │ Contact Service │ │Workflow Service │     │
            │   Port: 3001    │ │   Port: 3002    │     │
            └─────────────────┘ └─────────────────┘     │
                    │                   │               │
                    └─────────┬─────────┘               │
                              │                         │
                    ┌─────────────────┐         ┌─────────────┐
                    │   PostgreSQL    │         │    Redis    │
                    │   Port: 5432    │         │  Port: 6379 │
                    └─────────────────┘         └─────────────┘
```

## Services

### 1. API Gateway (Port 3000)
- **Purpose**: Central entry point for all client requests
- **Responsibilities**:
  - Request routing to appropriate services
  - Authentication verification
  - Rate limiting
  - Unified error handling
  - Health check aggregation
  - API documentation consolidation

### 2. Authentication Service (Port 3003)
- **Purpose**: Handle user authentication and session management
- **Responsibilities**:
  - User login/logout
  - Session management
  - Authentication verification
  - User profile management
  - Replit OAuth integration

### 3. Contact Service (Port 3001)
- **Purpose**: Manage contacts and organizational hierarchy
- **Responsibilities**:
  - CRUD operations for contacts
  - Contact hierarchy management
  - Contact statistics
  - Bulk operations
  - Contact search and filtering

### 4. Workflow Service (Port 3002)
- **Purpose**: Handle workflow and template management
- **Responsibilities**:
  - Workflow CRUD operations
  - Workflow execution tracking
  - Template management
  - Workflow instances and tasks
  - BPMN workflow processing

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker (for containerized deployment)

### Development Setup

1. **Clone and Setup**:
   ```bash
   git clone <repository>
   cd pathfinder-platform
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.microservices .env
   # Edit .env with your configuration
   ```

3. **Database Setup**:
   ```bash
   # Make sure PostgreSQL is running
   npm run db:push
   ```

4. **Start Microservices**:
   ```bash
   chmod +x scripts/start-microservices.sh
   ./scripts/start-microservices.sh
   ```

5. **Stop Microservices**:
   ```bash
   chmod +x scripts/stop-microservices.sh
   ./scripts/stop-microservices.sh
   ```

### Manual Service Management

Each service can be started individually for development:

```bash
# Auth Service
cd services/auth-service
npm install
npm run dev

# Contact Service
cd services/contact-service
npm install
npm run dev

# Workflow Service
cd services/workflow-service
npm install
npm run dev

# API Gateway
cd services/api-gateway
npm install
npm run dev
```

### Docker Deployment

For production deployment with Docker:

```bash
# Start all services with docker-compose
docker-compose -f docker-compose.microservices.yml up -d

# View logs
docker-compose -f docker-compose.microservices.yml logs -f

# Stop services
docker-compose -f docker-compose.microservices.yml down
```

## API Documentation

Each service provides its own Swagger documentation:

- **API Gateway**: http://localhost:3000/api-docs
- **Auth Service**: http://localhost:3003/api-docs  
- **Contact Service**: http://localhost:3001/api-docs
- **Workflow Service**: http://localhost:3002/api-docs

## Health Checks

The API Gateway provides comprehensive health checking:

- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed` - Shows status of all services
- **Readiness Check**: `GET /health/ready` - Critical services readiness
- **Liveness Check**: `GET /health/live` - Simple uptime check

Individual service health checks:
- Auth Service: `GET http://localhost:3003/health`
- Contact Service: `GET http://localhost:3001/health`
- Workflow Service: `GET http://localhost:3002/health`

## Rate Limiting

The API Gateway implements rate limiting:

- **General API**: 1000 requests per 15 minutes
- **Authentication**: 20 requests per 15 minutes
- **Write Operations**: 200 requests per 15 minutes
- **Bulk Operations**: 20 requests per 15 minutes

## Inter-Service Communication

Services communicate through HTTP REST APIs. The API Gateway:

1. Receives client requests
2. Verifies authentication with Auth Service
3. Routes requests to appropriate services
4. Forwards user context via headers
5. Returns unified responses

### Authentication Flow

```
Client Request → API Gateway → Auth Service (verify) → Target Service
                     ↓              ↓                      ↓
                  Add User ID     Return Auth Status    Process Request
                  to Headers                              ↓
Client Response ← Unified Response ← ← ← ← ← ← ← ← ← ← ← Return Data
```

## Database Access

Each service has its own database connection but shares the same PostgreSQL database:

- **Auth Service**: Users, Sessions tables
- **Contact Service**: Contacts, Contact relationships tables
- **Workflow Service**: Workflows, Templates, Instances, Tasks tables

All services use Drizzle ORM with shared schema definitions in `/shared/types/schema.ts`.

## Monitoring and Logging

### Development
- Logs are written to `./logs/` directory
- Each service has its own log file
- Use `tail -f logs/*.log` to monitor all services

### Production
- Prometheus metrics collection (port 9090)
- Grafana dashboards (port 3001) 
- Centralized logging with structured JSON logs

## Migration from Monolith

The microservices architecture runs alongside the existing monolith during the transition:

1. **Legacy API** continues running on port 5000
2. **New API Gateway** runs on port 3000
3. **Gradual Migration**: Move frontend API calls from port 5000 to 3000
4. **Feature Parity**: Ensure all monolith features are available in microservices
5. **Complete Migration**: Remove monolith when all clients use microservices

## Environment Variables

Key environment variables for microservices:

```bash
# Service Ports
API_GATEWAY_PORT=3000
CONTACT_SERVICE_PORT=3001
WORKFLOW_SERVICE_PORT=3002
AUTH_SERVICE_PORT=3003

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pathfinder

# Authentication
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
REPLIT_DOMAINS=your-domain.repl.co
REPL_ID=your-repl-id

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
   ```bash
   lsof -i :3000  # Check what's using port 3000
   kill <PID>     # Stop the process
   ```

2. **Service Not Starting**:
   ```bash
   # Check logs
   tail -f logs/service-name.log
   
   # Check if dependencies are installed
   cd services/service-name && npm install
   ```

3. **Database Connection Issues**:
   ```bash
   # Verify database is running
   pg_isready -h localhost -p 5432
   
   # Run migrations
   npm run db:push
   ```

4. **Authentication Issues**:
   - Verify REPLIT_DOMAINS is set correctly
   - Check session cookies are being forwarded
   - Ensure Auth Service is responding to health checks

### Performance Optimization

1. **Connection Pooling**: Each service maintains its own database connection pool
2. **Caching**: Redis is used for session storage and caching
3. **Rate Limiting**: Prevents abuse and ensures fair resource usage
4. **Health Checks**: Quick detection of failing services

## Development Guidelines

### Adding New Endpoints

1. **Identify Service**: Determine which service should handle the endpoint
2. **Add Route**: Add the route to the appropriate service's `routes.ts`
3. **Add Validation**: Use Zod schemas for request/response validation
4. **Add Documentation**: Include Swagger/OpenAPI documentation
5. **Test**: Verify the endpoint works through the API Gateway

### Creating New Services

1. **Service Structure**: Follow the existing pattern in `/services/`
2. **Package.json**: Include necessary dependencies and scripts
3. **Dockerfile**: Create appropriate Docker configuration
4. **Health Checks**: Implement `/health` endpoint
5. **Documentation**: Add Swagger documentation
6. **Gateway Integration**: Add routing in API Gateway
7. **Docker Compose**: Add service to docker-compose configuration

## Testing

### Unit Testing
```bash
# Run tests for specific service
cd services/contact-service
npm test
```

### Integration Testing
```bash
# Test service communication
curl http://localhost:3000/health/detailed
```

### Load Testing
```bash
# Use Apache Bench for basic load testing
ab -n 1000 -c 10 http://localhost:3000/api/contacts
```

## Security Considerations

1. **Authentication**: All routes except auth endpoints require authentication
2. **CORS**: Configured to only allow specific origins
3. **Rate Limiting**: Prevents abuse and DoS attacks
4. **Input Validation**: All inputs validated with Zod schemas
5. **Security Headers**: Helmet.js provides security headers
6. **Session Security**: Secure session configuration with HttpOnly cookies

## Deployment Strategies

### Blue-Green Deployment
1. Deploy new version alongside current version
2. Test new version thoroughly
3. Switch traffic to new version
4. Keep old version as backup

### Rolling Updates
1. Update services one at a time
2. Verify each service is healthy before updating the next
3. Rollback if issues are detected

### Canary Deployment
1. Deploy new version to small percentage of traffic
2. Monitor metrics and error rates
3. Gradually increase traffic to new version
4. Full rollout if metrics are good

## Future Enhancements

1. **Service Mesh**: Implement Istio or Linkerd for advanced traffic management
2. **Event-Driven Architecture**: Add message queues (RabbitMQ, Kafka) for async communication
3. **Circuit Breakers**: Implement circuit breaker pattern for resilience
4. **Distributed Tracing**: Add Jaeger or Zipkin for request tracing
5. **Service Discovery**: Implement Consul or etcd for dynamic service discovery
6. **Auto-scaling**: Container orchestration with Kubernetes
7. **Centralized Configuration**: Configuration management with Consul or Vault
8. **API Versioning**: Implement versioned APIs for backward compatibility