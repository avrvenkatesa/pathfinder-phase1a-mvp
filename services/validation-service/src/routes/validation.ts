import { Router, Request, Response } from 'express';
import { ValidationService } from '../validationService';
import { Pool } from 'pg';

export function createValidationRoutes(db: Pool): Router {
  const router = Router();
  const validationService = new ValidationService(db);

  // Real-time validation endpoint
  router.post('/validate-entity', async (req: Request, res: Response) => {
    try {
      const { entityType, data, rules } = req.body;

      if (!entityType || !data) {
        return res.status(400).json({
          error: 'Missing required fields: entityType and data'
        });
      }

      const result = await validationService.validateSync(entityType, data, rules);
      
      res.json({
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        metadata: {
          entityType: result.entityType,
          entityId: result.entityId,
          validatedAt: result.validatedAt,
          severity: result.severity
        }
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        error: 'Internal validation service error',
        details: error.message
      });
    }
  });

  // Asynchronous validation endpoint
  router.post('/validate-entity-async', async (req: Request, res: Response) => {
    try {
      const { entityType, data, rules } = req.body;

      if (!entityType || !data) {
        return res.status(400).json({
          error: 'Missing required fields: entityType and data'
        });
      }

      // Start async validation (don't await)
      validationService.validateAsync(entityType, data, rules)
        .then(result => {
          // Emit event or webhook notification when complete
          console.log('Async validation completed:', result);
        })
        .catch(error => {
          console.error('Async validation failed:', error);
        });

      res.json({
        message: 'Async validation started',
        entityType,
        entityId: data.id || 'unknown'
      });
    } catch (error) {
      console.error('Async validation error:', error);
      res.status(500).json({
        error: 'Failed to start async validation',
        details: error.message
      });
    }
  });

  // Bulk validation endpoint
  router.post('/validate-bulk', async (req: Request, res: Response) => {
    try {
      const { entities } = req.body;

      if (!entities || !Array.isArray(entities)) {
        return res.status(400).json({
          error: 'Missing or invalid entities array'
        });
      }

      const { results, summary } = await validationService.validateBulk(entities);
      
      res.json({
        results,
        summary,
        metadata: {
          processedAt: new Date(),
          totalEntities: entities.length
        }
      });
    } catch (error) {
      console.error('Bulk validation error:', error);
      res.status(500).json({
        error: 'Bulk validation failed',
        details: error.message
      });
    }
  });

  // Get validation rules
  router.get('/rules', async (req: Request, res: Response) => {
    try {
      const { domain, ruleType, active } = req.query;
      
      let query = 'SELECT * FROM validation_rules WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (domain) {
        query += ` AND domain = $${++paramCount}`;
        params.push(domain);
      }

      if (ruleType) {
        query += ` AND rule_type = $${++paramCount}`;
        params.push(ruleType);
      }

      if (active !== undefined) {
        query += ` AND is_active = $${++paramCount}`;
        params.push(active === 'true');
      }

      query += ' ORDER BY domain, name';

      const result = await db.query(query, params);
      
      res.json({
        rules: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get rules error:', error);
      res.status(500).json({
        error: 'Failed to fetch validation rules',
        details: error.message
      });
    }
  });

  // Create validation rule
  router.post('/rules', async (req: Request, res: Response) => {
    try {
      const { name, domain, ruleType, ruleDefinition, isActive = true } = req.body;

      if (!name || !domain || !ruleType || !ruleDefinition) {
        return res.status(400).json({
          error: 'Missing required fields: name, domain, ruleType, ruleDefinition'
        });
      }

      const result = await db.query(`
        INSERT INTO validation_rules (name, domain, rule_type, rule_definition, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [name, domain, ruleType, JSON.stringify(ruleDefinition), isActive]);

      res.status(201).json({
        rule: result.rows[0]
      });
    } catch (error) {
      console.error('Create rule error:', error);
      res.status(500).json({
        error: 'Failed to create validation rule',
        details: error.message
      });
    }
  });

  // Update validation rule
  router.put('/rules/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, domain, ruleType, ruleDefinition, isActive, version } = req.body;

      const result = await db.query(`
        UPDATE validation_rules 
        SET name = COALESCE($1, name),
            domain = COALESCE($2, domain),
            rule_type = COALESCE($3, rule_type),
            rule_definition = COALESCE($4, rule_definition),
            is_active = COALESCE($5, is_active),
            version = COALESCE($6, version),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [name, domain, ruleType, ruleDefinition ? JSON.stringify(ruleDefinition) : null, isActive, version, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Validation rule not found'
        });
      }

      res.json({
        rule: result.rows[0]
      });
    } catch (error) {
      console.error('Update rule error:', error);
      res.status(500).json({
        error: 'Failed to update validation rule',
        details: error.message
      });
    }
  });

  // Delete validation rule
  router.delete('/rules/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await db.query(`
        UPDATE validation_rules 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Validation rule not found'
        });
      }

      res.json({
        message: 'Validation rule deactivated',
        rule: result.rows[0]
      });
    } catch (error) {
      console.error('Delete rule error:', error);
      res.status(500).json({
        error: 'Failed to delete validation rule',
        details: error.message
      });
    }
  });

  // Get validation reports - data quality
  router.get('/reports/data-quality', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, entityType } = req.query;

      let query = `
        SELECT 
          entity_type,
          COUNT(*) as total_validations,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as successful_validations,
          COUNT(CASE WHEN is_valid = false THEN 1 END) as failed_validations,
          COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warnings,
          ROUND(
            (COUNT(CASE WHEN is_valid = true THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
            2
          ) as success_rate
        FROM validation_results 
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (startDate) {
        query += ` AND validated_at >= $${++paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND validated_at <= $${++paramCount}`;
        params.push(endDate);
      }

      if (entityType) {
        query += ` AND entity_type = $${++paramCount}`;
        params.push(entityType);
      }

      query += ` GROUP BY entity_type ORDER BY entity_type`;

      const result = await db.query(query, params);
      
      res.json({
        dataQuality: result.rows,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error('Data quality report error:', error);
      res.status(500).json({
        error: 'Failed to generate data quality report',
        details: error.message
      });
    }
  });

  // Get validation reports - failures
  router.get('/reports/failures', async (req: Request, res: Response) => {
    try {
      const { limit = 100, entityType, severity } = req.query;

      let query = `
        SELECT 
          vr.*,
          vru.name as rule_name,
          vru.domain as rule_domain
        FROM validation_results vr
        LEFT JOIN validation_rules vru ON vr.rule_id = vru.id
        WHERE vr.is_valid = false
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (entityType) {
        query += ` AND vr.entity_type = $${++paramCount}`;
        params.push(entityType);
      }

      if (severity) {
        query += ` AND vr.severity = $${++paramCount}`;
        params.push(severity);
      }

      query += ` ORDER BY vr.validated_at DESC LIMIT $${++paramCount}`;
      params.push(limit);

      const result = await db.query(query, params);
      
      res.json({
        failures: result.rows,
        total: result.rows.length,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error('Failures report error:', error);
      res.status(500).json({
        error: 'Failed to generate failures report',
        details: error.message
      });
    }
  });

  // Get validation reports - performance
  router.get('/reports/performance', async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          DATE_TRUNC('hour', validated_at) as hour,
          COUNT(*) as validations_count,
          AVG(EXTRACT(EPOCH FROM (validated_at - validated_at))) as avg_response_time
        FROM validation_results 
        WHERE validated_at >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', validated_at)
        ORDER BY hour
      `);
      
      // Get cache stats
      const cacheStats = validationService.getCacheStats();
      
      res.json({
        performance: result.rows,
        cacheStats,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error('Performance report error:', error);
      res.status(500).json({
        error: 'Failed to generate performance report',
        details: error.message
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    try {
      // Test database connection
      await db.query('SELECT 1');
      
      const cacheStats = validationService.getCacheStats();
      
      res.json({
        status: 'healthy',
        database: 'connected',
        cache: cacheStats,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      });
    }
  });

  return router;
}