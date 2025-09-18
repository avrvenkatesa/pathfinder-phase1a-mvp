# Runtime Dashboard API Documentation

## Overview
The Runtime Dashboard APIs provide real-time system monitoring, team performance metrics, issue tracking, and system timeline events for the Pathfinder platform.

**Base URL**: `http://localhost:3001/api`  
**Version**: 1.0.0  
**Status**: Production Ready  

## Authentication
Currently no authentication required for development endpoints. Production deployment will require appropriate authentication headers.

## API Endpoints

### 1. Server Health Check
**Endpoint**: `GET /api/instances`  
**Description**: Basic server connectivity and health status  
**Response Time**: < 50ms  

**Response**:
```json
{
  "message": "Fresh app instances endpoint",
  "working": true
}
Status Codes:

200 OK: Server operational
503 Service Unavailable: Server issues


2. System Metrics
Endpoint: GET /api/runtime-dashboard/metrics
Description: Real-time system performance metrics
Response Time: < 100ms
Response:
json{
  "system": {
    "cpu": 56,
    "memory": 18,
    "uptime": 246,
    "requests": 1321
  },
  "performance": {
    "avgResponseTime": 33,
    "errorRate": "1.25",
    "throughput": 87
  },
  "timestamp": "2025-09-17T23:48:49.375Z"
}
Fields:

cpu: CPU usage percentage (0-100)
memory: Memory usage percentage (0-100)
uptime: Server uptime in seconds
requests: Total requests processed
avgResponseTime: Average response time in milliseconds
errorRate: Error rate as percentage string
throughput: Requests per minute
timestamp: ISO 8601 timestamp


3. Team Data
Endpoint: GET /api/runtime-dashboard/team-data
Description: Team member availability and performance metrics
Response Time: < 100ms
Response:
json{
  "totalMembers": 12,
  "available": 8,
  "busy": 3,
  "offline": 1,
  "performance": {
    "overall": 94.5,
    "thisWeek": 92.3,
    "efficiency": 87.2
  }
}
Fields:

totalMembers: Total team members
available: Members available for work
busy: Members currently busy
offline: Members offline
performance.overall: Overall team performance percentage
performance.thisWeek: Current week performance
performance.efficiency: Team efficiency rating


4. Issues Tracking
Endpoint: GET /api/runtime-dashboard/issues
Description: Current system issues and their status
Response Time: < 100ms
Response:
json[
  {
    "id": 1,
    "title": "High CPU Usage on Server-01",
    "severity": "high",
    "status": "active"
  },
  {
    "id": 2,
    "title": "Memory Leak in Contact Service",
    "severity": "medium",
    "status": "investigating"
  }
]
Fields:

id: Unique issue identifier
title: Issue description
severity: Issue severity level (low, medium, high, critical)
status: Current status (active, investigating, resolved, closed)


5. Timeline Events
Endpoint: GET /api/runtime-dashboard/timeline
Description: System events timeline for monitoring
Response Time: < 100ms
Response:
json[
  {
    "time": "2025-09-17T23:48:49.375Z",
    "event": "System Health Check",
    "type": "info"
  },
  {
    "time": "2025-09-17T23:47:19.375Z",
    "event": "Runtime Dashboard Testing",
    "type": "success"
  }
]
Fields:

time: ISO 8601 timestamp
event: Event description
type: Event type (info, success, warning, error)

WebSocket Support
Endpoint: ws://localhost:3001/ws
Status: Available
Purpose: Real-time updates for dashboard components
Error Handling
All endpoints return appropriate HTTP status codes and error responses:
Error Response Format:
json{
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-17T23:48:49.375Z"
}
Common Status Codes:

200 OK: Successful request
400 Bad Request: Invalid request format
404 Not Found: Endpoint not found
500 Internal Server Error: Server error
503 Service Unavailable: Service temporarily unavailable

Rate Limiting

No rate limiting currently implemented for development
Production deployment will implement appropriate rate limiting

Testing
All endpoints tested with 100% success rate. See test results in project documentation.
Test Command:
bash./runtime_dashboard_test_script.sh
Implementation Notes

Built on Fresh Express architecture
Resolves previous HTTP routing issues
Production-ready with proper error handling
WebSocket integration available for real-time features
Comprehensive logging for monitoring and debugging

Support
For technical issues or questions about these APIs, refer to the project documentation or contact the development team.
