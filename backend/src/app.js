const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const { connectDB } = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/error');
const { setupSwagger } = require('./config/swagger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// ==============================================
// RUNTIME DASHBOARD ENDPOINTS - Added for Issue #15
// ==============================================

// Mock data generators for runtime dashboard
const generateMockMetrics = () => ({
  activeInstances: Math.floor(Math.random() * 20) + 8,
  completedToday: Math.floor(Math.random() * 15) + 5,
  avgCompletionTime: parseFloat((Math.random() * 6 + 2).toFixed(1)),
  timestamp: new Date().toISOString(),
  connectionStatus: 'live'
});

const generateMockTimeline = () => [
  {
    id: 1,
    step: 'Initialize Contact Processing',
    status: 'completed',
    assignedTo: 'John Doe',
    completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    duration: 45
  },
  {
    id: 2,
    step: 'Verify Contact Information',
    status: 'active',
    assignedTo: 'Jane Smith',
    startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    estimatedDuration: 30
  },
  {
    id: 3,
    step: 'Quality Assurance Review',
    status: 'pending',
    assignedTo: null,
    estimatedDuration: 15
  },
  {
    id: 4,
    step: 'Final Approval',
    status: 'pending',
    assignedTo: 'Bob Johnson',
    estimatedDuration: 10
  }
];

const generateMockTeam = () => [
  {
    id: 1,
    name: 'John Doe',
    avatar: '/avatars/john.jpg',
    currentTasks: Math.floor(Math.random() * 5) + 3,
    capacity: 8,
    workloadPercentage: Math.floor(Math.random() * 40) + 40,
    activeWorkflows: ['WF-001', 'WF-003', 'WF-007'],
    status: 'available'
  },
  {
    id: 2,
    name: 'Jane Smith',
    avatar: '/avatars/jane.jpg',
    currentTasks: Math.floor(Math.random() * 3) + 6,
    capacity: 8,
    workloadPercentage: Math.floor(Math.random() * 20) + 75,
    activeWorkflows: ['WF-002', 'WF-004', 'WF-008', 'WF-010'],
    status: 'busy'
  },
  {
    id: 3,
    name: 'Bob Johnson',
    avatar: '/avatars/bob.jpg',
    currentTasks: Math.floor(Math.random() * 4) + 2,
    capacity: 8,
    workloadPercentage: Math.floor(Math.random() * 30) + 30,
    activeWorkflows: ['WF-005', 'WF-009'],
    status: 'available'
  },
  {
    id: 4,
    name: 'Alice Brown',
    avatar: '/avatars/alice.jpg',
    currentTasks: Math.floor(Math.random() * 3) + 5,
    capacity: 8,
    workloadPercentage: Math.floor(Math.random() * 25) + 60,
    activeWorkflows: ['WF-006', 'WF-011', 'WF-012'],
    status: 'busy'
  }
];

const generateMockIssues = () => {
  const issues = [
    {
      id: 1,
      title: 'Database Connection Timeout',
      description: 'Multiple workflows experiencing intermittent database connectivity issues',
      severity: 'high',
      affectedWorkflows: ['WF-001', 'WF-003', 'WF-007'],
      reportedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      reportedBy: 'System Monitor'
    },
    {
      id: 2,
      title: 'Approval Process Bottleneck',
      description: 'Pending approvals are backing up the workflow queue',
      severity: 'medium',
      affectedWorkflows: ['WF-012', 'WF-015'],
      reportedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      reportedBy: 'Jane Smith'
    },
    {
      id: 3,
      title: 'Minor UI Display Issue',
      description: 'Contact form validation messages not displaying correctly in Safari',
      severity: 'low',
      affectedWorkflows: ['WF-008'],
      reportedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
      reportedBy: 'John Doe'
    }
  ];
  
  // Randomly show/hide issues to simulate resolution
  return issues.filter(() => Math.random() > 0.3);
};

// Runtime Dashboard API Endpoints
app.get('/api/workflows/runtime/metrics', (req, res) => {
  console.log('📊 Runtime metrics requested');
  res.json({
    success: true,
    data: generateMockMetrics(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/workflows/timeline/:workflowId?', (req, res) => {
  console.log('📈 Timeline data requested');
  const workflowId = req.params.workflowId;
  const timelineData = generateMockTimeline();
  
  res.json({
    success: true,
    data: workflowId ? timelineData.filter(item => item.id == workflowId) : timelineData,
    workflowId: workflowId || 'current',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/team/workload', (req, res) => {
  console.log('👥 Team workload requested');
  res.json({
    success: true,
    data: generateMockTeam(),
    teamStats: {
      totalMembers: 4,
      averageWorkload: 65,
      overloadedMembers: generateMockTeam().filter(member => member.workloadPercentage > 80).length
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/workflows/issues', (req, res) => {
  console.log('🚨 Issues and blockers requested');
  const issues = generateMockIssues();
  res.json({
    success: true,
    data: issues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    }),
    summary: {
      total: issues.length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/workflows/active', (req, res) => {
  console.log('🔄 Active workflows requested');
  const activeWorkflows = [
    { 
      id: 'WF-001', 
      name: 'Contact Processing Batch 1', 
      status: 'active', 
      progress: Math.floor(Math.random() * 40) + 40,
      assignedTo: 'John Doe',
      startedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    },
    { 
      id: 'WF-002', 
      name: 'Quality Assurance Review', 
      status: 'pending', 
      progress: Math.floor(Math.random() * 30) + 10,
      assignedTo: 'Jane Smith',
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 90 * 60 * 1000).toISOString()
    },
    {
      id: 'WF-003',
      name: 'Customer Data Verification',
      status: 'active',
      progress: Math.floor(Math.random() * 30) + 60,
      assignedTo: 'Bob Johnson',
      startedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 45 * 60 * 1000).toISOString()
    }
  ];
  
  res.json({
    success: true,
    data: activeWorkflows,
    summary: {
      total: activeWorkflows.length,
      active: activeWorkflows.filter(w => w.status === 'active').length,
      pending: activeWorkflows.filter(w => w.status === 'pending').length
    },
    timestamp: new Date().toISOString()
  });
});

// API routes (existing)
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// WebSocket setup for real-time updates
const wss = new WebSocket.Server({ 
  server: server, 
  path: '/ws' 
});

wss.on('connection', (ws, req) => {
  console.log('🔌 Runtime Dashboard WebSocket client connected');
  
  // Send initial data immediately
  const initialData = {
    type: 'runtime_update',
    payload: {
      metrics: generateMockMetrics(),
      timeline: generateMockTimeline(),
      team: generateMockTeam(),
      issues: generateMockIssues()
    },
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(initialData));
  
  // Set up periodic updates every 5 seconds
  const updateInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const updateData = {
        type: 'runtime_update',
        payload: {
          metrics: generateMockMetrics(),
          // Occasionally send full updates for other data
          ...(Math.random() > 0.6 && { 
            team: generateMockTeam(),
            issues: generateMockIssues()
          })
        },
        timestamp: new Date().toISOString()
      };
      
      ws.send(JSON.stringify(updateData));
      console.log('📡 Sent real-time update to runtime dashboard client');
    }
  }, 5000);
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📥 Received from runtime dashboard client:', data.type);
    } catch (error) {
      console.log('📥 Received raw message:', message.toString());
    }
  });
  
  // Clean up on disconnect
  ws.on('close', () => {
    console.log('🔌 Runtime Dashboard WebSocket client disconnected');
    clearInterval(updateInterval);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ Runtime Dashboard WebSocket error:', error);
    clearInterval(updateInterval);
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log('');
      console.log('📊 Runtime Dashboard endpoints added:');
      console.log(`   GET  http://localhost:${PORT}/api/workflows/runtime/metrics`);
      console.log(`   GET  http://localhost:${PORT}/api/workflows/timeline`);
      console.log(`   GET  http://localhost:${PORT}/api/team/workload`);
      console.log(`   GET  http://localhost:${PORT}/api/workflows/issues`);
      console.log(`   GET  http://localhost:${PORT}/api/workflows/active`);
      console.log(`   WS   ws://localhost:${PORT}/ws (Real-time updates)`);
      console.log('');
      console.log('✅ Ready for Runtime Dashboard testing!');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  wss.close();
  process.exit(0);
});

startServer();

module.exports = app;