#!/bin/bash

# Microservices Test Script
echo "🧪 Testing Pathfinder Microservices Architecture..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set test ports
API_GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3003
CONTACT_SERVICE_PORT=3001
WORKFLOW_SERVICE_PORT=3002

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test service health
test_service_health() {
    local url=$1
    local name=$2
    
    echo -n "Testing $name health endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo -e " ${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e " ${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test service availability
test_service_availability() {
    local port=$1
    local name=$2
    
    echo -n "Testing $name availability on port $port..."
    if nc -z localhost $port 2>/dev/null; then
        echo -e " ${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e " ${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo ""
echo -e "${BLUE}=== MICROSERVICES ARCHITECTURE TEST ===\n${NC}"

echo -e "${YELLOW}Test 1: Service Port Availability${NC}"
test_service_availability $AUTH_SERVICE_PORT "Auth Service"
test_service_availability $CONTACT_SERVICE_PORT "Contact Service" 
test_service_availability $WORKFLOW_SERVICE_PORT "Workflow Service"
test_service_availability $API_GATEWAY_PORT "API Gateway"

echo ""
echo -e "${YELLOW}Test 2: Service Health Endpoints${NC}"
test_service_health "http://localhost:$AUTH_SERVICE_PORT/health" "Auth Service"
test_service_health "http://localhost:$CONTACT_SERVICE_PORT/health" "Contact Service"
test_service_health "http://localhost:$WORKFLOW_SERVICE_PORT/health" "Workflow Service" 
test_service_health "http://localhost:$API_GATEWAY_PORT/health" "API Gateway"

echo ""
echo -e "${YELLOW}Test 3: API Gateway Aggregated Health${NC}"
echo -n "Testing API Gateway detailed health..."
if curl -s "http://localhost:$API_GATEWAY_PORT/health/detailed" | grep -q "status"; then
    echo -e " ${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e " ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo -e "${YELLOW}Test 4: Service Documentation${NC}"
echo -n "Testing API Gateway documentation..."
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_GATEWAY_PORT/api-docs" | grep -q "200"; then
    echo -e " ${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e " ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo -e "${BLUE}=== TEST RESULTS ===\n${NC}"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ($TESTS_PASSED/$TOTAL_TESTS)${NC}"
    echo ""
    echo -e "${GREEN}✅ Microservices Architecture is fully operational!${NC}"
    echo ""
    echo -e "${YELLOW}Services Running:${NC}"
    echo -e "  🔐 Auth Service:     http://localhost:$AUTH_SERVICE_PORT"
    echo -e "  👥 Contact Service:  http://localhost:$CONTACT_SERVICE_PORT" 
    echo -e "  ⚡ Workflow Service: http://localhost:$WORKFLOW_SERVICE_PORT"
    echo -e "  🌐 API Gateway:      http://localhost:$API_GATEWAY_PORT"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED! ($TESTS_PASSED/$TOTAL_TESTS passed)${NC}"
    echo ""
    echo -e "${RED}Please check the services are running with: ./scripts/start-microservices.sh${NC}"
    echo ""
    exit 1
fi