import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware } from './middleware/auth';

const services = {
  auth: {
    target: `http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}`,
    pathPrefix: '/api/auth',
  },
  contact: {
    target: `http://localhost:${process.env.CONTACT_SERVICE_PORT || 3001}`,
    pathPrefix: '/api/contacts',
  },
  workflow: {
    target: `http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}`,
    pathPrefix: '/api/workflows',
  },
  workflowTemplates: {
    target: `http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}`,
    pathPrefix: '/api/workflow-templates',
  },
};

export function setupProxies(app: express.Express) {
  // Auth service proxy - no auth middleware for auth routes
  app.use(
    services.auth.pathPrefix,
    createProxyMiddleware({
      target: services.auth.target,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        // Forward the original path
        return path;
      },
      onError: (err, req, res) => {
        console.error(`Auth Service Proxy Error:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Authentication service is currently unavailable',
          service: 'auth-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying to Auth Service: ${req.method} ${req.url}`);
      },
    })
  );

  // Contact service proxy - with auth middleware
  app.use(
    services.contact.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.contact.target,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        return path;
      },
      onError: (err, req, res) => {
        console.error(`Contact Service Proxy Error:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Contact service is currently unavailable',
          service: 'contact-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add user ID header for contact service
        const userId = (req as any).userId;
        if (userId) {
          proxyReq.setHeader('x-user-id', userId);
        }
        console.log(`Proxying to Contact Service: ${req.method} ${req.url}`);
      },
    })
  );

  // Workflow service proxy - with auth middleware
  app.use(
    services.workflow.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.workflow.target,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        return path;
      },
      onError: (err, req, res) => {
        console.error(`Workflow Service Proxy Error:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Workflow service is currently unavailable',
          service: 'workflow-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add user ID header for workflow service
        const userId = (req as any).userId;
        if (userId) {
          proxyReq.setHeader('x-user-id', userId);
        }
        console.log(`Proxying to Workflow Service: ${req.method} ${req.url}`);
      },
    })
  );

  // Workflow templates proxy - with auth middleware
  app.use(
    services.workflowTemplates.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.workflowTemplates.target,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        return path;
      },
      onError: (err, req, res) => {
        console.error(`Workflow Templates Proxy Error:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Workflow templates service is currently unavailable',
          service: 'workflow-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add user ID header for workflow service
        const userId = (req as any).userId;
        if (userId) {
          proxyReq.setHeader('x-user-id', userId);
        }
        console.log(`Proxying to Workflow Templates: ${req.method} ${req.url}`);
      },
    })
  );

  console.log('✅ Service proxies configured:');
  console.log(`   Auth Service: ${services.auth.pathPrefix} -> ${services.auth.target}`);
  console.log(`   Contact Service: ${services.contact.pathPrefix} -> ${services.contact.target}`);
  console.log(`   Workflow Service: ${services.workflow.pathPrefix} -> ${services.workflow.target}`);
  console.log(`   Workflow Templates: ${services.workflowTemplates.pathPrefix} -> ${services.workflowTemplates.target}`);
}