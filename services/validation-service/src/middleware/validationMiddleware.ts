import { Request, Response, NextFunction } from 'express';
import { ValidationService } from '../validationService';
import { Pool } from 'pg';

export interface ValidationMiddlewareOptions {
  entityType: string;
  rules?: string[];
  validationType?: 'sync' | 'async';
  skipOnError?: boolean;
  responseField?: string;
}

export function createValidationMiddleware(db: Pool, options: ValidationMiddlewareOptions) {
  const validationService = new ValidationService(db);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityType, rules, validationType = 'sync', skipOnError = false, responseField = 'validationResult' } = options;
      
      // Extract data from request body
      const data = req.body;
      
      if (!data) {
        if (skipOnError) {
          return next();
        }
        return res.status(400).json({
          error: 'Request body is required for validation'
        });
      }

      let validationResult;
      
      if (validationType === 'async') {
        // For async validation, start the process but don't wait
        validationService.validateAsync(entityType, data, rules)
          .then(result => {
            console.log('Async validation completed:', result);
          })
          .catch(error => {
            console.error('Async validation failed:', error);
          });
        
        // Continue with request processing
        return next();
      } else {
        // Synchronous validation
        validationResult = await validationService.validateSync(entityType, data, rules);
      }

      // Add validation result to request for downstream processing
      (req as any)[responseField] = validationResult;

      // If validation failed and we're not skipping errors, return error response
      if (!validationResult.isValid && !skipOnError) {
        return res.status(422).json({
          error: 'Validation failed',
          validationResult: {
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        });
      }

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      
      if (skipOnError) {
        return next();
      }
      
      return res.status(500).json({
        error: 'Validation service error',
        details: error.message
      });
    }
  };
}

export function createBulkValidationMiddleware(db: Pool, options: {
  entityTypeField: string;
  dataField?: string;
  skipOnError?: boolean;
}) {
  const validationService = new ValidationService(db);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityTypeField, dataField = 'data', skipOnError = false } = options;
      
      // Extract entities from request body
      const entities = req.body[dataField];
      
      if (!entities || !Array.isArray(entities)) {
        if (skipOnError) {
          return next();
        }
        return res.status(400).json({
          error: `Request body must contain an array of entities in field '${dataField}'`
        });
      }

      // Prepare entities for bulk validation
      const entitiesToValidate = entities.map((entity, index) => ({
        type: entity[entityTypeField] || 'unknown',
        data: entity,
        id: entity.id || `bulk_${index}`
      }));

      const { results, summary } = await validationService.validateBulk(entitiesToValidate);

      // Add validation results to request
      (req as any).bulkValidationResults = results;
      (req as any).bulkValidationSummary = summary;

      // If any validations failed and we're not skipping errors
      if (summary.failed > 0 && !skipOnError) {
        return res.status(422).json({
          error: 'Bulk validation failed',
          summary,
          failedEntities: results.filter(r => !r.isValid)
        });
      }

      next();
    } catch (error) {
      console.error('Bulk validation middleware error:', error);
      
      if (skipOnError) {
        return next();
      }
      
      return res.status(500).json({
        error: 'Bulk validation service error',
        details: error.message
      });
    }
  };
}

export function createFieldValidationMiddleware(db: Pool, options: {
  field: string;
  entityType: string;
  rules?: string[];
}) {
  const validationService = new ValidationService(db);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { field, entityType, rules } = options;
      
      const fieldValue = req.body[field];
      
      if (fieldValue === undefined || fieldValue === null) {
        return next();
      }

      // Create a minimal object for validation
      const dataToValidate = { [field]: fieldValue, id: req.body.id };
      
      const validationResult = await validationService.validateSync(entityType, dataToValidate, rules);

      // Add field-specific validation result
      (req as any).fieldValidationResults = (req as any).fieldValidationResults || {};
      (req as any).fieldValidationResults[field] = validationResult;

      // Check if this specific field has errors
      const fieldErrors = validationResult.errors.filter(error => error.field === field);
      
      if (fieldErrors.length > 0) {
        return res.status(422).json({
          error: `Validation failed for field '${field}'`,
          field,
          errors: fieldErrors,
          warnings: validationResult.warnings.filter(warning => warning.field === field)
        });
      }

      next();
    } catch (error) {
      console.error('Field validation middleware error:', error);
      return res.status(500).json({
        error: 'Field validation service error',
        details: error.message
      });
    }
  };
}

// Convenience middleware factory for common use cases
export const ValidationMiddleware = {
  // Contact validation middleware
  validateContact: (db: Pool, options?: { rules?: string[]; async?: boolean }) => 
    createValidationMiddleware(db, {
      entityType: 'contact',
      rules: options?.rules,
      validationType: options?.async ? 'async' : 'sync'
    }),

  // Workflow validation middleware  
  validateWorkflow: (db: Pool, options?: { rules?: string[]; async?: boolean }) =>
    createValidationMiddleware(db, {
      entityType: 'workflow',
      rules: options?.rules,
      validationType: options?.async ? 'async' : 'sync'
    }),

  // Cross-system validation middleware
  validateCrossSystem: (db: Pool, options?: { rules?: string[]; async?: boolean }) =>
    createValidationMiddleware(db, {
      entityType: 'cross-system',
      rules: options?.rules,
      validationType: options?.async ? 'async' : 'sync'
    }),

  // Email uniqueness validation for contacts
  validateEmailUniqueness: (db: Pool) =>
    createFieldValidationMiddleware(db, {
      field: 'email',
      entityType: 'contact',
      rules: ['contact_email_uniqueness']
    }),

  // Bulk contact import validation
  validateBulkContacts: (db: Pool) =>
    createBulkValidationMiddleware(db, {
      entityTypeField: 'type',
      dataField: 'contacts'
    })
};