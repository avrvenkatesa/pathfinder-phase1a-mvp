import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';
import xss from 'xss';
import DOMPurify from 'isomorphic-dompurify';

// Validation schemas for contacts
export const contactSchemas = {
  create: z.object({
    name: z.string().min(1).max(255).transform(val => DOMPurify.sanitize(val)),
    email: z.string().email().optional().nullable(),
    type: z.enum(['company', 'division', 'person']),
    parentId: z.string().uuid().optional().nullable(),
    jobTitle: z.string().max(255).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
    department: z.string().max(255).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
    skills: z.array(z.string().max(100)).optional().default([]),
    availabilityStatus: z.enum(['available', 'busy', 'partially_available', 'unavailable']).optional(),
    notes: z.string().max(5000).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
  }),

  update: z.object({
    name: z.string().min(1).max(255).optional().transform(val => val ? DOMPurify.sanitize(val) : val),
    email: z.string().email().optional().nullable(),
    type: z.enum(['company', 'division', 'person']).optional(),
    parentId: z.string().uuid().optional().nullable(),
    jobTitle: z.string().max(255).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
    department: z.string().max(255).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
    skills: z.array(z.string().max(100)).optional(),
    availabilityStatus: z.enum(['available', 'busy', 'partially_available', 'unavailable']).optional(),
    notes: z.string().max(5000).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
  }),

  bulkCreate: z.object({
    contacts: z.array(z.object({
      name: z.string().min(1).max(255).transform(val => DOMPurify.sanitize(val)),
      email: z.string().email().optional().nullable(),
      type: z.enum(['company', 'division', 'person']),
      parentId: z.string().uuid().optional().nullable(),
      jobTitle: z.string().max(255).optional().nullable(),
      department: z.string().max(255).optional().nullable(),
      skills: z.array(z.string().max(100)).optional().default([]),
      availabilityStatus: z.enum(['available', 'busy', 'partially_available', 'unavailable']).optional(),
      notes: z.string().max(5000).optional().nullable(),
    })).min(1).max(1000), // Limit bulk operations to 1000 items
  }),

  search: z.object({
    query: z.string().max(500).optional(),
    types: z.array(z.enum(['company', 'division', 'person'])).optional(),
    departments: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    availabilityStatus: z.array(z.enum(['available', 'busy', 'partially_available', 'unavailable'])).optional(),
    limit: z.number().int().min(1).max(1000).default(100),
    offset: z.number().int().min(0).default(0),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'type']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  relationship: z.object({
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    relationshipType: z.enum(['reports_to', 'works_with', 'supervises', 'collaborates']),
    notes: z.string().max(1000).optional().nullable().transform(val => val ? DOMPurify.sanitize(val) : val),
  }),
};

// SQL injection prevention patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
  /(--|#|\/\*|\*\/)/g,
  /(\bor\b\s*\d+\s*=\s*\d+)/gi,
  /(\band\b\s*\d+\s*=\s*\d+)/gi,
  /(;|'|"|`|\\)/g,
];

// Check for SQL injection attempts
export const checkSQLInjection = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
};

// Sanitize object recursively
export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    // Check for SQL injection
    if (checkSQLInjection(obj)) {
      throw new Error('Potential SQL injection detected');
    }
    // Sanitize HTML/XSS
    return DOMPurify.sanitize(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Validation middleware factory
export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input first
      const sanitizedBody = sanitizeObject(req.body);
      
      // Validate with schema
      const validated = await schema.parseAsync(sanitizedBody);
      
      // Replace request body with validated and sanitized data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: validationError.message,
          details: error.errors,
        });
      }
      
      if (error instanceof Error && error.message.includes('SQL injection')) {
        return res.status(400).json({
          success: false,
          error: 'Security violation',
          message: 'Invalid input detected',
        });
      }
      
      next(error);
    }
  };
};

// Query parameter validation middleware
export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate query parameters
      const validated = await schema.parseAsync(req.query);
      
      // Replace query with validated data
      req.query = validated as any;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          error: 'Query validation failed',
          message: validationError.message,
          details: error.errors,
        });
      }
      
      next(error);
    }
  };
};

// File upload validation
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string().max(255),
  mimetype: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
});

// Email validation with additional checks
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Basic format check
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Check for common disposable email domains
  const disposableDomains = [
    'tempmail.com',
    'throwaway.email',
    'guerrillamail.com',
    '10minutemail.com',
  ];
  
  const domain = email.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return false;
  }
  
  return true;
};

// Phone number validation
export const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid length (10-15 digits)
  return cleaned.length >= 10 && cleaned.length <= 15;
};

// UUID validation
export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};