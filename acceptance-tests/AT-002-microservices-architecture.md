# AT-002: Microservices Architecture Implementation

## Test Information
- **Test ID**: AT-002
- **Test Name**: Microservices Architecture Implementation
- **Priority**: HIGH (Non-negotiable requirement)
- **Category**: Architecture & Infrastructure
- **Estimated Duration**: 10 minutes

## Test Description
This test validates the complete implementation of the microservices architecture for PathFinder, ensuring all four core services are properly configured, can be started independently, and communicate correctly through the API Gateway.

## Prerequisites
- PostgreSQL database available
- Redis server available (if configured)
- All microservice dependencies installed
- Environment variables configured in `.env.microservices`

## Test Environment
- **Base URL**: http://localhost:3000 (API Gateway)
- **Service Ports**: 
  - API Gateway: 3000
  - Contact Service: 3001  
  - Workflow Service: 3002
  - Auth Service: 3003

## Acceptance Criteria

### Core Architecture Requirements
1. **Service Separation**: All four microservices are implemented as separate, independent applications
2. **API Gateway**: Central entry point routing requests to appropriate services
3. **Service Discovery**: All services can be discovered and communicated with through the gateway
4. **Health Monitoring**: All services provide health check endpoints
5. **Documentation**: Each service provides Swagger API documentation

### Service-Specific Requirements

#### API Gateway (Port 3000)
- ✅ Routes requests to appropriate backend services
- ✅ Handles authentication verification
- ✅ Implements rate limiting
- ✅ Provides unified error handling
- ✅ Aggregates health checks from all services
- ✅ Serves consolidated API documentation

#### Authentication Service (Port 3003) 
- ✅ Handles user login/logout functionality
- ✅ Manages user sessions and JWT tokens
- ✅ Provides authentication verification endpoints
- ✅ Supports multiple OAuth providers (Google, Microsoft)
- ✅ Manages user profile data

#### Contact Service (Port 3001)
- ✅ Provides CRUD operations for contacts
- ✅ Manages contact hierarchy and relationships
- ✅ Supports contact search and filtering
- ✅ Handles contact statistics and analytics
- ✅ Provides bulk operations for contacts

#### Workflow Service (Port 3002)
- ✅ Manages workflow templates and instances
- ✅ Handles workflow execution tracking
- ✅ Supports BPMN workflow processing
- ✅ Manages workflow tasks and assignments
- ✅ Provides workflow analytics

## Test Steps

### Step 1: Environment Setup
1. Navigate to project root directory
2. Verify `.env.microservices` configuration exists
3. Ensure database is accessible

### Step 2: Start Microservices
1. Run: `./scripts/start-microservices.sh`
2. Verify all services start without errors
3. Check service logs in `./logs/` directory

### Step 3: Service Health Verification
1. Test individual service health:
   - Auth Service: `GET http://localhost:3003/health`
   - Contact Service: `GET http://localhost:3001/health` 
   - Workflow Service: `GET http://localhost:3002/health`
   - API Gateway: `GET http://localhost:3000/health`

2. Test aggregated health through API Gateway:
   - `GET http://localhost:3000/health/detailed`
   - `GET http://localhost:3000/health/ready`

### Step 4: API Documentation Verification
1. Access service documentation:
   - API Gateway: `http://localhost:3000/api-docs`
   - Auth Service: `http://localhost:3003/api-docs`
   - Contact Service: `http://localhost:3001/api-docs`
   - Workflow Service: `http://localhost:3002/api-docs`

### Step 5: Inter-Service Communication Test
1. Test authentication flow through API Gateway
2. Verify request routing to appropriate services
3. Confirm user context forwarding between services

### Step 6: Automated Testing
1. Run: `./scripts/test-microservices.sh`
2. Verify all automated tests pass

## Expected Results

### Service Health Checks
- All services respond with HTTP 200 status
- Health responses include service status and metadata
- API Gateway aggregated health shows all services as healthy

### API Documentation
- All services serve complete Swagger documentation
- API endpoints are properly documented with schemas
- Interactive API testing is available through Swagger UI

### Inter-Service Communication
- Requests are properly routed through the API Gateway
- Authentication context is forwarded correctly
- Services can communicate with each other when needed

## Test Data
- Use existing test contacts and workflows
- Authentication can use demo OAuth providers
- No additional test data setup required

## Pass Criteria
- ✅ All four microservices start successfully
- ✅ All health check endpoints return HTTP 200
- ✅ API Gateway successfully routes requests
- ✅ All service documentation is accessible
- ✅ Automated test script passes all checks
- ✅ Services can be stopped and restarted cleanly

## Failure Recovery
If test fails:
1. Check service logs in `./logs/` directory
2. Verify environment configuration
3. Ensure no port conflicts exist
4. Restart services using `./scripts/stop-microservices.sh` then `./scripts/start-microservices.sh`

## Notes
- This test validates the fundamental architectural shift from monolithic to microservices
- Successful completion demonstrates the non-negotiable microservices requirement is met
- The architecture supports horizontal scaling and independent service deployment
- Services maintain loose coupling while providing cohesive functionality