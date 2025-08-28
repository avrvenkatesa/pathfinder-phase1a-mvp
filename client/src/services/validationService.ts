import { apiRequest } from "@/lib/queryClient";

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

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: {
    entityType: string;
    entityId: string;
    validatedAt: string;
    severity: 'error' | 'warning' | 'info';
  };
}

export interface ValidationSummary {
  totalValidated: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
}

class ValidationService {
  private cache = new Map<string, { result: ValidationResult; timestamp: number }>();
  private readonly cacheTTL = 60000; // 1 minute

  /**
   * Validate entity in real-time
   */
  async validateEntity(
    entityType: string,
    data: any,
    rules?: string[]
  ): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(entityType, data, rules);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    try {
      const response = await apiRequest('/api/validation/validate-entity', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          data,
          rules
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result: ValidationResult = {
        isValid: response.isValid,
        errors: response.errors || [],
        warnings: response.warnings || [],
        metadata: response.metadata
      };

      // Cache successful results
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        errors: [{
          field: 'system',
          message: 'Validation service unavailable',
          code: 'SERVICE_ERROR',
          value: error.message
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate field in real-time (for form fields)
   */
  async validateField(
    entityType: string,
    fieldName: string,
    fieldValue: any,
    entityData?: any
  ): Promise<ValidationResult> {
    const data = {
      [fieldName]: fieldValue,
      ...(entityData || {})
    };

    return this.validateEntity(entityType, data, [`${entityType}_${fieldName}`]);
  }

  /**
   * Start async validation
   */
  async validateEntityAsync(
    entityType: string,
    data: any,
    rules?: string[]
  ): Promise<void> {
    try {
      await apiRequest('/api/validation/validate-entity-async', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          data,
          rules
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Async validation error:', error);
    }
  }

  /**
   * Validate multiple entities
   */
  async validateBulk(entities: Array<{type: string, data: any, id?: string}>): Promise<{
    results: ValidationResult[];
    summary: ValidationSummary;
  }> {
    try {
      const response = await apiRequest('/api/validation/validate-bulk', {
        method: 'POST',
        body: JSON.stringify({ entities }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        results: response.results || [],
        summary: response.summary || {
          totalValidated: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
          errors: 0
        }
      };
    } catch (error) {
      console.error('Bulk validation error:', error);
      return {
        results: [],
        summary: {
          totalValidated: entities.length,
          passed: 0,
          failed: entities.length,
          warnings: 0,
          errors: entities.length
        }
      };
    }
  }

  /**
   * Get validation rules
   */
  async getValidationRules(domain?: string, ruleType?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (domain) params.append('domain', domain);
      if (ruleType) params.append('ruleType', ruleType);
      params.append('active', 'true');

      const response = await apiRequest(`/api/validation/rules?${params.toString()}`);
      return response.rules || [];
    } catch (error) {
      console.error('Error fetching validation rules:', error);
      return [];
    }
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).length
    };
  }

  private getCacheKey(entityType: string, data: any, rules?: string[]): string {
    const dataHash = JSON.stringify(data);
    const rulesHash = rules ? rules.join(',') : 'all';
    return `${entityType}:${rulesHash}:${dataHash}`;
  }
}

export const validationService = new ValidationService();