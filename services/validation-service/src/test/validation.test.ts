import { ValidationService } from '../validationService';
import { Pool } from 'pg';

// Mock database
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService(mockDb);
    jest.clearAllMocks();
  });

  describe('validateSync', () => {
    it('should validate contact with required fields', async () => {
      // Mock validation rules
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'contact_required_fields',
          domain: 'contact',
          rule_type: 'sync',
          rule_definition: {
            type: 'joi',
            schema: {
              name: { type: 'string', min: 1, required: true },
              type: { type: 'string', valid: ['company', 'division', 'person'], required: true }
            }
          }
        }]
      });

      const validData = {
        name: 'John Doe',
        type: 'person',
        email: 'john@example.com'
      };

      const result = await validationService.validateSync('contact', validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'contact_required_fields',
          domain: 'contact',
          rule_type: 'sync',
          rule_definition: {
            type: 'joi',
            schema: {
              name: { type: 'string', min: 1, required: true },
              type: { type: 'string', valid: ['company', 'division', 'person'], required: true }
            }
          }
        }]
      });

      const invalidData = {
        email: 'john@example.com'
        // Missing name and type
      };

      const result = await validationService.validateSync('contact', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate email uniqueness', async () => {
      // Mock validation rules
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 2,
          name: 'contact_email_uniqueness',
          domain: 'contact',
          rule_type: 'async',
          rule_definition: {
            type: 'custom',
            customType: 'email_uniqueness'
          }
        }]
      });

      // Mock email uniqueness check - no existing email
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const contactData = {
        name: 'Jane Smith',
        type: 'person',
        email: 'jane@example.com',
        id: 'new-contact'
      };

      const result = await validationService.validateAsync('contact', contactData);

      expect(result.isValid).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM contacts WHERE email = $1 AND id != $2',
        ['jane@example.com', 'new-contact']
      );
    });

    it('should detect email uniqueness violation', async () => {
      // Mock validation rules
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 2,
          name: 'contact_email_uniqueness',
          domain: 'contact',
          rule_type: 'async',
          rule_definition: {
            type: 'custom',
            customType: 'email_uniqueness'
          }
        }]
      });

      // Mock email uniqueness check - existing email found
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'existing-contact' }]
      });

      const contactData = {
        name: 'Jane Smith',
        type: 'person',
        email: 'existing@example.com',
        id: 'new-contact'
      };

      const result = await validationService.validateAsync('contact', contactData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          code: 'EMAIL_NOT_UNIQUE'
        })
      );
    });

    it('should detect circular dependencies', async () => {
      // Mock validation rules
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 3,
          name: 'contact_hierarchy_integrity',
          domain: 'contact',
          rule_type: 'sync',
          rule_definition: {
            type: 'custom',
            customType: 'circular_dependency'
          }
        }]
      });

      // Mock circular dependency check - circular dependency found
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });

      const contactData = {
        id: 'contact-1',
        parentId: 'contact-2',
        name: 'Contact 1'
      };

      const result = await validationService.validateSync('contact', contactData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'parentId',
          code: 'CIRCULAR_DEPENDENCY'
        })
      );
    });
  });

  describe('validateBulk', () => {
    it('should validate multiple entities', async () => {
      // Mock validation rules for each call
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No validation rules
        .mockResolvedValueOnce({ rows: [] }); // No validation rules

      const entities = [
        {
          type: 'contact',
          data: { name: 'John Doe', type: 'person', email: 'john@example.com' },
          id: 'contact-1'
        },
        {
          type: 'contact',
          data: { name: 'ACME Corp', type: 'company' },
          id: 'contact-2'
        }
      ];

      const result = await validationService.validateBulk(entities);

      expect(result.summary.totalValidated).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should handle mixed validation results', async () => {
      // Mock validation rules
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'contact_required_fields',
            domain: 'contact',
            rule_type: 'sync',
            rule_definition: {
              type: 'joi',
              schema: {
                name: { type: 'string', min: 1, required: true }
              }
            }
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'contact_required_fields',
            domain: 'contact',
            rule_type: 'sync',
            rule_definition: {
              type: 'joi',
              schema: {
                name: { type: 'string', min: 1, required: true }
              }
            }
          }]
        });

      const entities = [
        {
          type: 'contact',
          data: { name: 'Valid Contact' },
          id: 'valid-contact'
        },
        {
          type: 'contact',
          data: { name: '' }, // Invalid - empty name
          id: 'invalid-contact'
        }
      ];

      const result = await validationService.validateBulk(entities);

      expect(result.summary.totalValidated).toBe(2);
      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(1);
    });
  });

  describe('cache functionality', () => {
    it('should cache validation results', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const data = { name: 'Test', type: 'person' };

      // First call should hit database
      await validationService.validateSync('contact', data);
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await validationService.validateSync('contact', data);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should clear cache', () => {
      validationService.clearCache();
      
      const stats = validationService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      (mockDb.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await validationService.validateSync('contact', { name: 'Test' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      );
    });

    it('should handle invalid rule definitions', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'invalid_rule',
          domain: 'contact',
          rule_type: 'sync',
          rule_definition: {
            type: 'unknown_type'
          }
        }]
      });

      const result = await validationService.validateSync('contact', { name: 'Test' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'UNKNOWN_RULE_TYPE'
        })
      );
    });
  });
});

// Integration test with real validation scenarios
describe('ValidationService Integration', () => {
  it('should validate a complete contact creation workflow', async () => {
    const validationService = new ValidationService(mockDb);

    // Mock all necessary database calls
    (mockDb.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'contact_required_fields',
            domain: 'contact',
            rule_type: 'sync',
            rule_definition: {
              type: 'joi',
              schema: {
                name: { type: 'string', min: 1, required: true },
                type: { type: 'string', valid: ['company', 'division', 'person'], required: true }
              }
            }
          },
          {
            id: 2,
            name: 'contact_email_uniqueness',
            domain: 'contact',
            rule_type: 'sync',
            rule_definition: {
              type: 'custom',
              customType: 'email_uniqueness'
            }
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] }); // Email uniqueness check

    const newContact = {
      name: 'John Smith',
      type: 'person',
      email: 'john.smith@example.com',
      phone: '+1-555-0123',
      department: 'Engineering'
    };

    const result = await validationService.validateSync('contact', newContact);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.entityType).toBe('contact');
  });
});