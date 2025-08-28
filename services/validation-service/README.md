# Validation Service

A comprehensive data validation framework for the PathFinder platform with real-time and asynchronous validation capabilities.

## Features

- **Real-time Validation**: Synchronous validation for immediate feedback
- **Asynchronous Validation**: Complex cross-system validations
- **Bulk Validation**: Efficient batch processing for imports
- **Monitoring & Alerts**: Comprehensive monitoring with automated alerts
- **Configurable Rules**: JSON-based validation rule engine
- **Caching**: Performance optimization with result caching
- **Multi-domain Support**: Contact, workflow, and cross-system validations

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Update .env with your configuration
   ```

3. **Run Database Migration**
   ```bash
   npm run db:push
   ```

4. **Start Service**
   ```bash
   npm run dev
   ```

## API Endpoints

### Validation

- `POST /api/validation/validate-entity` - Real-time validation
- `POST /api/validation/validate-entity-async` - Async validation
- `POST /api/validation/validate-bulk` - Bulk validation

### Rules Management

- `GET /api/validation/rules` - Get validation rules
- `POST /api/validation/rules` - Create validation rule
- `PUT /api/validation/rules/:id` - Update validation rule
- `DELETE /api/validation/rules/:id` - Delete validation rule

### Reports

- `GET /api/validation/reports/data-quality` - Data quality metrics
- `GET /api/validation/reports/failures` - Validation failures
- `GET /api/validation/reports/performance` - Performance metrics

## Validation Rules

The service supports three types of validation rules:

### 1. Joi Schema Validation
```json
{
  "type": "joi",
  "schema": {
    "name": {"type": "string", "min": 1, "required": true},
    "email": {"type": "string", "email": true}
  }
}
```

### 2. Custom Validation
```json
{
  "type": "custom",
  "customType": "email_uniqueness"
}
```

### 3. Database Validation
```json
{
  "type": "database",
  "query": "SELECT COUNT(*) FROM contacts WHERE email = $1",
  "params": ["email"],
  "expectedResult": {"type": "count", "value": 0}
}
```

## Default Validation Rules

### Contact Domain
- **contact_required_fields**: Validates required fields based on contact type
- **contact_phone_format**: Validates phone number format
- **contact_hierarchy_integrity**: Prevents circular dependencies
- **contact_email_uniqueness**: Ensures email uniqueness
- **contact_skill_consistency**: Validates skill consistency in hierarchy

### Workflow Domain
- **workflow_step_dependencies**: Validates workflow step dependencies
- **workflow_contact_availability**: Checks contact availability conflicts
- **workflow_skill_matching**: Validates skill requirements

### Cross-System
- **cross_system_capacity_check**: Validates assignment capacity limits

## Monitoring

The service includes comprehensive monitoring capabilities:

- **Real-time Metrics**: Validation counts, success rates, error rates
- **Automated Alerts**: Threshold-based alerts for quality degradation
- **Daily/Weekly Reports**: Automated reporting with trends
- **Performance Tracking**: Response time and throughput monitoring

## Configuration

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| VALIDATION_SERVICE_PORT | 3004 | Service port |
| VALIDATION_CACHE_TTL | 300000 | Cache TTL in ms |
| VALIDATION_RATE_LIMIT | 1000 | Rate limit per 15 min |
| VALIDATION_ALERT_THRESHOLD | 10 | Error rate alert threshold (%) |

## Testing

```bash
npm test
```

## Integration

### Frontend Integration
```typescript
import { validationService } from '@/services/validationService';

// Real-time validation
const result = await validationService.validateEntity('contact', contactData);

// Field validation
const fieldResult = await validationService.validateField('contact', 'email', emailValue);
```

### Service Integration
```typescript
import { ValidationMiddleware } from './middleware/validationMiddleware';

// Contact validation middleware
app.post('/api/contacts', 
  ValidationMiddleware.validateContact(db),
  createContactHandler
);
```

## Performance

- **Caching**: Results cached for 5 minutes by default
- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **Batch Processing**: Optimized for bulk operations
- **Async Processing**: Non-blocking async validations

## Error Handling

The service provides graceful error handling:

- **Service Unavailable**: Circuit breaker for external dependencies
- **Validation Timeout**: Configurable timeouts for complex validations
- **Fallback Behavior**: Continues processing when validation service is down
- **Detailed Error Messages**: Clear error reporting with field-level details