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
  workflowInstances: {
    target: `http://localhost:${process.env.WORKFLOW_SERVICE_PORT || 3002}`,
    pathPrefix: '/api/workflow-instances',
  },
  validation: {
    target: `http://localhost:${process.env.VALIDATION_SERVICE_PORT || 3004}`,
    pathPrefix: '/api/validation',
  },
};

export function setupProxies(app: express.Express) {
  console.log('Setting up proxy middleware...');
  
  // Auth service proxy - no auth middleware for auth routes
  console.log(`Setting up proxy for ${services.auth.pathPrefix} -> ${services.auth.target}`);
  
  app.use(
    services.auth.pathPrefix,
    createProxyMiddleware({
      target: services.auth.target,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: {
        // Keep the full path including /api/auth
        ['^' + services.auth.pathPrefix]: services.auth.pathPrefix,
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[AUTH PROXY] ${req.method} ${req.originalUrl} -> ${services.auth.target}${req.url}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[AUTH PROXY RESPONSE] ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },
      onError: (err, req, res) => {
        console.error(`[AUTH PROXY ERROR] ${req.method} ${req.originalUrl}:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Authentication service is currently unavailable',
          service: 'auth-service',
        });
      },
    })
  );

  // Contact service proxy - with auth middleware
  console.log(`Setting up proxy for ${services.contact.pathPrefix} -> ${services.contact.target}`);
  app.use(
    services.contact.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.contact.target,
      changeOrigin: true,
      pathRewrite: {
        // Keep the full path including /api/contacts
        ['^' + services.contact.pathPrefix]: services.contact.pathPrefix,
      },
      onError: (err, req, res) => {
        console.error(`[CONTACT PROXY ERROR] ${req.method} ${req.originalUrl}:`, err.message);
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
        console.log(`[CONTACT PROXY] ${req.method} ${req.originalUrl} -> ${services.contact.target}${req.url}`);
      },
    })
  );

  // Workflow service proxy - with auth middleware
  console.log(`Setting up proxy for ${services.workflow.pathPrefix} -> ${services.workflow.target}`);
  app.use(
    services.workflow.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.workflow.target,
      changeOrigin: true,
      pathRewrite: {
        // Keep the full path including /api/workflows
        ['^' + services.workflow.pathPrefix]: services.workflow.pathPrefix,
      },
      onError: (err, req, res) => {
        console.error(`[WORKFLOW PROXY ERROR] ${req.method} ${req.originalUrl}:`, err.message);
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
        console.log(`[WORKFLOW PROXY] ${req.method} ${req.originalUrl} -> ${services.workflow.target}${req.url}`);
      },
    })
  );

  // Workflow templates proxy - with auth middleware
  console.log(`Setting up proxy for ${services.workflowTemplates.pathPrefix} -> ${services.workflowTemplates.target}`);
  app.use(
    services.workflowTemplates.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.workflowTemplates.target,
      changeOrigin: true,
      pathRewrite: {
        // Keep the full path including /api/workflow-templates
        ['^' + services.workflowTemplates.pathPrefix]: services.workflowTemplates.pathPrefix,
      },
      onError: (err, req, res) => {
        console.error(`[WORKFLOW TEMPLATES PROXY ERROR] ${req.method} ${req.originalUrl}:`, err.message);
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
        console.log(`[WORKFLOW TEMPLATES PROXY] ${req.method} ${req.originalUrl} -> ${services.workflowTemplates.target}${req.url}`);
      },
    })
  );

  // Workflow instances proxy - with auth middleware
  app.use(
    services.workflowInstances.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.workflowInstances.target,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        return path;
      },
      onError: (err, req, res) => {
        console.error(`Workflow Instances Proxy Error:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Workflow instances service is currently unavailable',
          service: 'workflow-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add user ID header for workflow service
        const userId = (req as any).userId;
        if (userId) {
          proxyReq.setHeader('x-user-id', userId);
        }
        console.log(`Proxying to Workflow Instances: ${req.method} ${req.url}`);
      },
    })
  );

  // Validation service proxy - with auth middleware
  console.log(`Setting up proxy for ${services.validation.pathPrefix} -> ${services.validation.target}`);
  app.use(
    services.validation.pathPrefix,
    authMiddleware,
    createProxyMiddleware({
      target: services.validation.target,
      changeOrigin: true,
      pathRewrite: {
        // Keep the full path including /api/validation
        ['^' + services.validation.pathPrefix]: services.validation.pathPrefix,
      },
      onError: (err, req, res) => {
        console.error(`[VALIDATION PROXY ERROR] ${req.method} ${req.originalUrl}:`, err.message);
        (res as express.Response).status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Validation service is currently unavailable',
          service: 'validation-service',
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add user ID header for validation service
        const userId = (req as any).userId;
        if (userId) {
          proxyReq.setHeader('x-user-id', userId);
        }
        console.log(`[VALIDATION PROXY] ${req.method} ${req.originalUrl} -> ${services.validation.target}${req.url}`);
      },
    })
  );

  console.log('✅ Service proxies configured:');
  console.log(`   Auth Service: ${services.auth.pathPrefix} -> ${services.auth.target}`);
  console.log(`   Contact Service: ${services.contact.pathPrefix} -> ${services.contact.target}`);
  console.log(`   Workflow Service: ${services.workflow.pathPrefix} -> ${services.workflow.target}`);
  console.log(`   Workflow Templates: ${services.workflowTemplates.pathPrefix} -> ${services.workflowTemplates.target}`);
  console.log(`   Workflow Instances: ${services.workflowInstances.pathPrefix} -> ${services.workflowInstances.target}`);
  console.log(`   Validation Service: ${services.validation.pathPrefix} -> ${services.validation.target}`);
}
