import express from 'express';
import { HttpClient } from '../../../../shared/utils/http-client';

const authServiceClient = new HttpClient({
  baseUrl: `http://localhost:${process.env.AUTH_SERVICE_PORT || 3003}`,
  timeout: 5000,
});

export const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // Forward the session cookies and headers to the auth service
    const headers: Record<string, string> = {};
    
    // Forward cookies
    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie;
    }
    
    // Forward any authorization headers
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }

    // Verify authentication with auth service
    const authResponse = await authServiceClient.get('/api/auth/verify', headers);
    
    if (authResponse.success && authResponse.data?.authenticated) {
      // Add user ID to request for downstream services
      (req as any).userId = authResponse.data.userId;
      next();
    } else {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // If auth service is down, we still allow the request to pass through
    // but without user context (this is a fallback for service resilience)
    if (error instanceof Error && error.message.includes('Service request failed')) {
      console.warn('Auth service unavailable, allowing request without auth verification');
      next();
      return;
    }
    
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: 'Unable to verify authentication',
    });
  }
};