#!/bin/bash

# Microservices Startup Script
echo "🚀 Starting Pathfinder Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}Failed to start $name${NC}"
    return 1
}

# Load environment variables
if [ -f .env.microservices ]; then
    export $(cat .env.microservices | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Environment variables loaded"
else
    echo -e "${YELLOW}Warning: .env.microservices not found, using defaults${NC}"
fi

# Set default ports if not set
export AUTH_SERVICE_PORT=${AUTH_SERVICE_PORT:-3003}
export CONTACT_SERVICE_PORT=${CONTACT_SERVICE_PORT:-3001}
export WORKFLOW_SERVICE_PORT=${WORKFLOW_SERVICE_PORT:-3002}
export API_GATEWAY_PORT=${API_GATEWAY_PORT:-3000}

# Check for port conflicts
echo "🔍 Checking for port conflicts..."
ports=($AUTH_SERVICE_PORT $CONTACT_SERVICE_PORT $WORKFLOW_SERVICE_PORT $API_GATEWAY_PORT)
for port in "${ports[@]}"; do
    if check_port $port; then
        echo -e "${RED}Error: Port $port is already in use${NC}"
        echo "Please stop the service using that port or change the port in .env.microservices"
        exit 1
    fi
done
echo -e "${GREEN}✓${NC} No port conflicts detected"

# Make sure we're in the right directory
if [ ! -d "services" ]; then
    echo -e "${RED}Error: services directory not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Start database migration if needed
echo "📊 Checking database schema..."
if [ -f "drizzle.config.ts" ]; then
    echo "Running database migrations..."
    npm run db:push
fi

# Start services in background
echo "🚀 Starting microservices..."

# Start Auth Service
echo -e "${BLUE}Starting Auth Service on port $AUTH_SERVICE_PORT...${NC}"
cd services/auth-service
npm install > /dev/null 2>&1
npm run dev > ../../logs/auth-service.log 2>&1 &
AUTH_PID=$!
cd ../..

# Start Contact Service  
echo -e "${BLUE}Starting Contact Service on port $CONTACT_SERVICE_PORT...${NC}"
cd services/contact-service
npm install > /dev/null 2>&1
npm run dev > ../../logs/contact-service.log 2>&1 &
CONTACT_PID=$!
cd ../..

# Start Workflow Service
echo -e "${BLUE}Starting Workflow Service on port $WORKFLOW_SERVICE_PORT...${NC}"
cd services/workflow-service
npm install > /dev/null 2>&1
npm run dev > ../../logs/workflow-service.log 2>&1 &
WORKFLOW_PID=$!
cd ../..

# Wait for services to be ready
sleep 5

# Check service health
echo "🔍 Checking service health..."
wait_for_service "http://localhost:$AUTH_SERVICE_PORT/health" "Auth Service"
wait_for_service "http://localhost:$CONTACT_SERVICE_PORT/health" "Contact Service"  
wait_for_service "http://localhost:$WORKFLOW_SERVICE_PORT/health" "Workflow Service"

# Start API Gateway last
echo -e "${BLUE}Starting API Gateway on port $API_GATEWAY_PORT...${NC}"
cd services/api-gateway
npm install > /dev/null 2>&1
npm run dev > ../../logs/api-gateway.log 2>&1 &
GATEWAY_PID=$!
cd ../..

# Wait for API Gateway
sleep 3
wait_for_service "http://localhost:$API_GATEWAY_PORT/health" "API Gateway"

# Create log directory if it doesn't exist
mkdir -p logs

# Save PIDs for cleanup script
echo "$AUTH_PID $CONTACT_PID $WORKFLOW_PID $GATEWAY_PID" > .microservices.pids

echo ""
echo -e "${GREEN}🎉 All microservices are running!${NC}"
echo ""
echo -e "${YELLOW}Services:${NC}"
echo -e "  🔐 Auth Service:     http://localhost:$AUTH_SERVICE_PORT (API: /api-docs)"
echo -e "  👥 Contact Service:  http://localhost:$CONTACT_SERVICE_PORT (API: /api-docs)"
echo -e "  ⚡ Workflow Service: http://localhost:$WORKFLOW_SERVICE_PORT (API: /api-docs)"
echo -e "  🌐 API Gateway:      http://localhost:$API_GATEWAY_PORT (API: /api-docs)"
echo ""
echo -e "${YELLOW}Health Checks:${NC}"
echo -e "  📊 Detailed Health: http://localhost:$API_GATEWAY_PORT/health/detailed"
echo -e "  🔍 Ready Check:     http://localhost:$API_GATEWAY_PORT/health/ready"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  📝 All logs are in ./logs/ directory"
echo -e "  🔍 Monitor logs: tail -f logs/*.log"
echo ""
echo -e "${BLUE}To stop all services, run: ./scripts/stop-microservices.sh${NC}"
echo ""