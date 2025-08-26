// Re-export all types from schema
export * from './schema';

// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Service configuration types
export interface ServiceConfig {
  port: number;
  host: string;
  serviceName: string;
  databaseUrl: string;
  sessionSecret: string;
  jwtSecret: string;
  corsOrigins: string[];
}

// Inter-service communication types
export interface ServiceRequest<T = any> {
  userId?: string;
  data: T;
  headers?: Record<string, string>;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  version: string;
  uptime: number;
  dependencies?: {
    [key: string]: 'healthy' | 'unhealthy';
  };
}