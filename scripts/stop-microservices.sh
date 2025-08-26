#!/bin/bash

# Microservices Stop Script
echo "🛑 Stopping Pathfinder Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Read PIDs from file
if [ -f .microservices.pids ]; then
    PIDS=$(cat .microservices.pids)
    echo "Found running services with PIDs: $PIDS"
    
    # Kill each PID
    for pid in $PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping process $pid..."
            kill $pid
            sleep 2
            
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo "Force stopping process $pid..."
                kill -9 $pid
            fi
        else
            echo "Process $pid already stopped"
        fi
    done
    
    # Clean up PID file
    rm -f .microservices.pids
else
    echo "No PID file found, attempting to find and stop services by port..."
    
    # Default ports
    PORTS=(3000 3001 3002 3003)
    
    for port in "${PORTS[@]}"; do
        PID=$(lsof -ti :$port)
        if [ ! -z "$PID" ]; then
            echo "Stopping service on port $port (PID: $PID)..."
            kill $PID
            sleep 1
        fi
    done
fi

# Also stop any remaining node processes that might be our services
echo "Cleaning up any remaining microservice processes..."
pkill -f "tsx.*auth-service" 2>/dev/null
pkill -f "tsx.*contact-service" 2>/dev/null  
pkill -f "tsx.*workflow-service" 2>/dev/null
pkill -f "tsx.*api-gateway" 2>/dev/null

sleep 2

# Verify all services are stopped
echo "Verifying services are stopped..."
PORTS=(3000 3001 3002 3003)
all_stopped=true

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}Warning: Service still running on port $port${NC}"
        all_stopped=false
    else
        echo -e "${GREEN}✓${NC} Port $port is free"
    fi
done

if [ "$all_stopped" = true ]; then
    echo -e "${GREEN}🎉 All microservices have been stopped successfully!${NC}"
else
    echo -e "${YELLOW}Some services may still be running. You may need to stop them manually.${NC}"
    echo "Use: lsof -i :PORT to find processes and kill PID to stop them"
fi

# Clean up log files if requested
read -p "Do you want to clear the log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f logs/*.log
    echo -e "${GREEN}✓${NC} Log files cleared"
fi

echo "Done!"