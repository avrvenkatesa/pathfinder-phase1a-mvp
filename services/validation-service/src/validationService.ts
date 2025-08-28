import Joi from 'joi';
import _ from 'lodash';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface ValidationRule {
  id?: number;
  name: string;
  domain: 'contact' | 'workflow' | 'cross-system';
  ruleType: 'sync' | 'async' | 'batch';
  ruleDefinition: any;
  version: number;
  isActive: boolean;
  createdAt?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  entityType: string;
  entityId: string;
  ruleId?: number;
  severity: 'error' | 'warning' | 'info';
  validatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value: any;
}

export interface ValidationSummary {
  totalValidated: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
}

export class ValidationService extends EventEmitter {
  private db: Pool;
  private cache: Map<string, ValidationResult>;
  private cacheTTL: number;

  constructor(db: Pool, cacheTTL: number = 300000) { // 5 minutes default
    super();
    this.db = db;
    this.cache = new Map();
    this.cacheTTL = cacheTTL;
  }

  /**
   * Synchronous validation for immediate feedback
   */
  async validateSync(entityType: string, data: any, rules?: string[]): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(entityType, data, rules);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.validatedAt)) {
      return cached;
    }

    const validationRules = await this.getValidationRules(entityType, 'sync', rules);
    const result = await this.executeValidation(entityType, data, validationRules);
    
    this.cache.set(cacheKey, result);
    this.emit('validation:completed', result);
    
    return result;
  }

  /**
   * Asynchronous validation for complex cross-system checks
   */
  async validateAsync(entityType: string, data: any, rules?: string[]): Promise<ValidationResult> {
    const validationRules = await this.getValidationRules(entityType, 'async', rules);
    const result = await this.executeValidation(entityType, data, validationRules);
    
    // Store result in database for tracking
    await this.storeValidationResult(result);
    this.emit('validation:async:completed', result);
    
    return result;
  }

  /**
   * Bulk validation for batch operations
   */
  async validateBulk(entities: Array<{type: string, data: any, id?: string}>): Promise<{
    results: ValidationResult[];
    summary: ValidationSummary;
  }> {
    const results: ValidationResult[] = [];
    const summary: ValidationSummary = {
      totalValidated: entities.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0
    };

    for (const entity of entities) {
      try {
        const result = await this.validateSync(entity.type, entity.data);
        results.push(result);
        
        if (result.isValid) {
          summary.passed++;
        } else {
          summary.failed++;
        }
        
        summary.warnings += result.warnings.length;
        summary.errors += result.errors.length;
      } catch (error) {
        const errorResult: ValidationResult = {
          isValid: false,
          errors: [{
            field: 'system',
            message: `Validation failed: ${error.message}`,
            code: 'VALIDATION_ERROR',
            value: entity.data
          }],
          warnings: [],
          entityType: entity.type,
          entityId: entity.id || 'unknown',
          severity: 'error',
          validatedAt: new Date()
        };
        results.push(errorResult);
        summary.failed++;
        summary.errors++;
      }
    }

    this.emit('validation:bulk:completed', { results, summary });
    return { results, summary };
  }

  /**
   * Execute validation rules against data
   */
  private async executeValidation(
    entityType: string, 
    data: any, 
    rules: ValidationRule[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let isValid = true;

    for (const rule of rules) {
      try {
        const ruleResult = await this.executeRule(rule, data, entityType);
        
        if (!ruleResult.isValid) {
          isValid = false;
          errors.push(...ruleResult.errors);
        }
        
        warnings.push(...ruleResult.warnings);
      } catch (error) {
        isValid = false;
        errors.push({
          field: 'system',
          message: `Rule execution failed: ${error.message}`,
          code: 'RULE_EXECUTION_ERROR',
          value: data
        });
      }
    }

    return {
      isValid,
      errors,
      warnings,
      entityType,
      entityId: data.id || 'unknown',
      severity: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'info'),
      validatedAt: new Date()
    };
  }

  /**
   * Execute individual validation rule
   */
  private async executeRule(rule: ValidationRule, data: any, entityType: string): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let isValid = true;

    switch (rule.ruleDefinition.type) {
      case 'joi':
        const joiResult = this.executeJoiValidation(rule.ruleDefinition.schema, data);
        if (!joiResult.isValid) {
          isValid = false;
          errors.push(...joiResult.errors);
        }
        break;

      case 'custom':
        const customResult = await this.executeCustomValidation(rule.ruleDefinition, data, entityType);
        if (!customResult.isValid) {
          isValid = false;
          errors.push(...customResult.errors);
        }
        warnings.push(...customResult.warnings);
        break;

      case 'database':
        const dbResult = await this.executeDatabaseValidation(rule.ruleDefinition, data);
        if (!dbResult.isValid) {
          isValid = false;
          errors.push(...dbResult.errors);
        }
        break;

      default:
        errors.push({
          field: 'rule',
          message: `Unknown rule type: ${rule.ruleDefinition.type}`,
          code: 'UNKNOWN_RULE_TYPE',
          value: rule.ruleDefinition.type
        });
        isValid = false;
    }

    return { isValid, errors, warnings };
  }

  /**
   * Execute Joi schema validation
   */
  private executeJoiValidation(schema: any, data: any): {
    isValid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    
    try {
      const joiSchema = Joi.compile(schema);
      const { error } = joiSchema.validate(data, { abortEarly: false });
      
      if (error) {
        error.details.forEach(detail => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message,
            code: detail.type,
            value: detail.context?.value
          });
        });
        return { isValid: false, errors };
      }
      
      return { isValid: true, errors: [] };
    } catch (err) {
      errors.push({
        field: 'schema',
        message: `Schema compilation failed: ${err.message}`,
        code: 'SCHEMA_ERROR',
        value: schema
      });
      return { isValid: false, errors };
    }
  }

  /**
   * Execute custom validation logic
   */
  private async executeCustomValidation(ruleDefinition: any, data: any, entityType: string): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Implement custom validation logic based on rule definition
    switch (ruleDefinition.customType) {
      case 'email_uniqueness':
        const emailResult = await this.validateEmailUniqueness(data, entityType);
        if (!emailResult.isValid) {
          errors.push(...emailResult.errors);
        }
        break;

      case 'circular_dependency':
        const circularResult = await this.validateCircularDependency(data);
        if (!circularResult.isValid) {
          errors.push(...circularResult.errors);
        }
        break;

      case 'skill_consistency':
        const skillResult = await this.validateSkillConsistency(data);
        if (!skillResult.isValid) {
          warnings.push(...skillResult.warnings);
        }
        break;

      default:
        errors.push({
          field: 'customType',
          message: `Unknown custom validation type: ${ruleDefinition.customType}`,
          code: 'UNKNOWN_CUSTOM_TYPE',
          value: ruleDefinition.customType
        });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Execute database validation
   */
  private async executeDatabaseValidation(ruleDefinition: any, data: any): Promise<{
    isValid: boolean;
    errors: ValidationError[];
  }> {
    const errors: ValidationError[] = [];
    
    try {
      const result = await this.db.query(ruleDefinition.query, ruleDefinition.params ? 
        ruleDefinition.params.map((param: string) => data[param]) : []);
      
      if (ruleDefinition.expectedResult) {
        const isValid = this.checkExpectedResult(result.rows, ruleDefinition.expectedResult);
        if (!isValid) {
          errors.push({
            field: ruleDefinition.field || 'database',
            message: ruleDefinition.errorMessage || 'Database validation failed',
            code: ruleDefinition.errorCode || 'DATABASE_VALIDATION_FAILED',
            value: data
          });
        }
      }
    } catch (error) {
      errors.push({
        field: 'database',
        message: `Database query failed: ${error.message}`,
        code: 'DATABASE_QUERY_ERROR',
        value: ruleDefinition.query
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email uniqueness across system
   */
  private async validateEmailUniqueness(data: any, entityType: string): Promise<{
    isValid: boolean;
    errors: ValidationError[];
  }> {
    if (!data.email) {
      return { isValid: true, errors: [] };
    }

    try {
      const result = await this.db.query(
        'SELECT id FROM contacts WHERE email = $1 AND id != $2',
        [data.email, data.id || '']
      );

      if (result.rows.length > 0) {
        return {
          isValid: false,
          errors: [{
            field: 'email',
            message: 'Email address already exists in the system',
            code: 'EMAIL_NOT_UNIQUE',
            value: data.email
          }]
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'email',
          message: `Email uniqueness check failed: ${error.message}`,
          code: 'EMAIL_UNIQUENESS_CHECK_ERROR',
          value: data.email
        }]
      };
    }
  }

  /**
   * Validate no circular dependencies in parent-child relationships
   */
  private async validateCircularDependency(data: any): Promise<{
    isValid: boolean;
    errors: ValidationError[];
  }> {
    if (!data.parentId || !data.id) {
      return { isValid: true, errors: [] };
    }

    try {
      // Check if setting this parent would create a circular dependency
      const result = await this.db.query(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, "parentId", 1 as level
          FROM contacts 
          WHERE id = $1
          
          UNION ALL
          
          SELECT c.id, c."parentId", h.level + 1
          FROM contacts c
          INNER JOIN hierarchy h ON c.id = h."parentId"
          WHERE h.level < 10
        )
        SELECT COUNT(*) as count
        FROM hierarchy 
        WHERE id = $2
      `, [data.parentId, data.id]);

      if (parseInt(result.rows[0].count) > 0) {
        return {
          isValid: false,
          errors: [{
            field: 'parentId',
            message: 'Setting this parent would create a circular dependency',
            code: 'CIRCULAR_DEPENDENCY',
            value: data.parentId
          }]
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'parentId',
          message: `Circular dependency check failed: ${error.message}`,
          code: 'CIRCULAR_DEPENDENCY_CHECK_ERROR',
          value: data.parentId
        }]
      };
    }
  }

  /**
   * Validate skill consistency across hierarchy
   */
  private async validateSkillConsistency(data: any): Promise<{
    warnings: ValidationWarning[];
  }> {
    const warnings: ValidationWarning[] = [];

    if (!data.skills || !data.parentId) {
      return { warnings };
    }

    try {
      const result = await this.db.query(
        'SELECT skills FROM contacts WHERE id = $1',
        [data.parentId]
      );

      if (result.rows.length > 0) {
        const parentSkills = result.rows[0].skills || [];
        const childSkills = data.skills || [];

        // Check if child has skills not present in parent hierarchy
        const uncommonSkills = childSkills.filter(skill => !parentSkills.includes(skill));
        
        if (uncommonSkills.length > 0) {
          warnings.push({
            field: 'skills',
            message: `Skills not common in parent hierarchy: ${uncommonSkills.join(', ')}`,
            code: 'SKILL_HIERARCHY_INCONSISTENCY',
            value: uncommonSkills
          });
        }
      }
    } catch (error) {
      // Don't fail validation, just skip warning
    }

    return { warnings };
  }

  /**
   * Get validation rules from database
   */
  private async getValidationRules(
    entityType: string, 
    ruleType: string, 
    ruleNames?: string[]
  ): Promise<ValidationRule[]> {
    let query = `
      SELECT * FROM validation_rules 
      WHERE domain = $1 AND rule_type = $2 AND is_active = true
    `;
    const params = [entityType, ruleType];

    if (ruleNames && ruleNames.length > 0) {
      query += ` AND name = ANY($3)`;
      params.push(ruleNames);
    }

    query += ` ORDER BY name`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Store validation result in database
   */
  private async storeValidationResult(result: ValidationResult): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO validation_results 
        (entity_type, entity_id, rule_id, is_valid, error_message, severity, validated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        result.entityType,
        result.entityId,
        result.ruleId,
        result.isValid,
        result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        result.severity,
        result.validatedAt
      ]);
    } catch (error) {
      console.error('Failed to store validation result:', error);
    }
  }

  /**
   * Check expected result for database validations
   */
  private checkExpectedResult(rows: any[], expectedResult: any): boolean {
    switch (expectedResult.type) {
      case 'count':
        return rows.length === expectedResult.value;
      case 'empty':
        return rows.length === 0;
      case 'not_empty':
        return rows.length > 0;
      case 'exists':
        return rows.length > 0 && rows[0][expectedResult.field] !== null;
      default:
        return true;
    }
  }

  /**
   * Generate cache key for validation result
   */
  private getCacheKey(entityType: string, data: any, rules?: string[]): string {
    const dataHash = JSON.stringify(data);
    const rulesHash = rules ? rules.join(',') : 'all';
    return `${entityType}:${rulesHash}:${dataHash}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(validatedAt: Date): boolean {
    return Date.now() - validatedAt.getTime() < this.cacheTTL;
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL
    };
  }
}