#!/bin/bash

echo "🚀 Quick Runtime Dashboard API Test"
echo "==================================="

test_api() {
    local endpoint="$1"
    local name="$2"
    
    echo -n "Testing $name... "
    response=$(curl --max-time 5 -s "$endpoint" 2>/dev/null)
    
    if [[ $? -eq 0 ]] && [[ -n "$response" ]]; then
        echo "✅ SUCCESS"
        echo "  Response: ${response:0:80}..."
    else
        echo "❌ FAILED"
    fi
}

# Test all endpoints
test_api "http://localhost:3001/api/instances" "Basic Health"
test_api "http://localhost:3001/api/runtime-dashboard/metrics" "Metrics API"
test_api "http://localhost:3001/api/runtime-dashboard/team-data" "Team Data API"  
test_api "http://localhost:3001/api/runtime-dashboard/issues" "Issues API"
test_api "http://localhost:3001/api/runtime-dashboard/timeline" "Timeline API"

echo ""
echo "Frontend serving test:"
echo -n "Testing frontend route... "
if curl --max-time 5 -s -I http://localhost:3001/ | grep -q "200"; then
    echo "✅ SUCCESS"
else
    echo "❌ FAILED"
fi
