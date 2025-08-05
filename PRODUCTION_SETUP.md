# Production Setup Guide - Contact Management API

## Overview

This guide covers the complete production deployment setup for the Contact Management API with all performance optimizations, security features, and monitoring capabilities.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │     API Server  │    │   Database      │
│   (Nginx)       │────│   (Node.js)     │────│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │     Cache       │
                       │    (Redis)      │
                       └─────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 15+
- Redis 7+
- SSL certificates (for production)

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/contact_management
POSTGRES_DB=contact_management
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password

# Security Secrets (Generate strong secrets!)
SESSION_SECRET=your_session_secret_32_chars_minimum
JWT_SECRET=your_jwt_secret_32_chars_minimum
ENCRYPTION_KEY=your_encryption_key_32_chars_minimum

# API Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
API_RATE_LIMIT_GENERAL=100
API_RATE_LIMIT_AUTH=5
API_RATE_LIMIT_BULK=10

# Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
DATADOG_API_KEY=your_datadog_api_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Grafana (for monitoring)
GRAFANA_PASSWORD=your_grafana_password
```

### Security Considerations

1. **Generate Strong Secrets**: Use cryptographically secure random generators
```bash
# Generate secrets using OpenSSL
openssl rand -hex 32  # For SESSION_SECRET
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

2. **Database Security**:
   - Use strong passwords
   - Enable SSL connections
   - Restrict network access
   - Regular backups

3. **API Security**:
   - Configure proper CORS origins
   - Use HTTPS in production
   - Implement proper rate limiting
   - Monitor for suspicious activity

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Clone and Setup**:
```bash
git clone <repository>
cd contact-management-api
cp .env.example .env
# Edit .env with your configuration
```

2. **Build and Deploy**:
```bash
# Production deployment
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

3. **Database Migration**:
```bash
# Run initial migrations
docker-compose exec api npm run migrate

# Seed initial data (optional)
docker-compose exec api npm run seed
```

### Option 2: Manual Installation

1. **Install Dependencies**:
```bash
npm ci --only=production
```

2. **Build Application**:
```bash
npm run build
```

3. **Setup Database**:
```bash
# Create database
createdb contact_management

# Run migrations
npm run migrate
```

4. **Start Application**:
```bash
npm start
```

## Performance Optimization

### Database Optimization

1. **Indexes**: All critical indexes are included in migration files
2. **Connection Pooling**: Configured for 20 connections by default
3. **Query Optimization**: Uses prepared statements and query planning

### Caching Strategy

1. **Redis Caching**:
   - Contact lists: 5 minutes
   - Individual contacts: 10 minutes
   - Analytics: 30 minutes
   - Search results: 2 minutes

2. **HTTP Caching**:
   - ETags for client-side caching
   - Proper cache headers
   - Compression for large responses

### Rate Limiting

- General endpoints: 100 requests/minute
- Authentication: 5 requests/15 minutes
- Bulk operations: 10 requests/5 minutes
- Read operations: 200 requests/minute

## Monitoring and Observability

### Health Checks

- **Endpoint**: `GET /health`
- **Database connectivity**: Automatic checks
- **Redis connectivity**: Automatic checks
- **System resources**: Memory and CPU monitoring

### Metrics Collection

- **Endpoint**: `GET /metrics`
- **Performance metrics**: Response times, throughput
- **Error tracking**: Error rates and types
- **Usage analytics**: API endpoint usage

### Logging

- **Structured JSON logging** in production
- **Request/response logging** with performance metrics
- **Error logging** with full stack traces
- **Audit logging** for all data changes

### External Monitoring (Optional)

1. **Sentry**: Error tracking and performance monitoring
2. **Datadog**: Infrastructure and application monitoring
3. **Slack**: Alert notifications
4. **Grafana**: Custom dashboards

## Load Testing

### Test Scenarios

1. **Concurrent Users**: Test with 1000+ concurrent connections
2. **Bulk Operations**: Test large dataset imports
3. **Search Performance**: Test complex search queries
4. **Database Performance**: Test with large datasets

### Load Testing Commands

```bash
# Install k6 for load testing
npm install -g k6

# Run basic load test
k6 run loadtest/basic-load-test.js

# Run bulk operations test
k6 run loadtest/bulk-operations-test.js

# Run search performance test
k6 run loadtest/search-performance-test.js
```

## Security Checklist

### Pre-Production Security Audit

- [ ] All environment variables configured securely
- [ ] HTTPS enabled with valid SSL certificates
- [ ] Database connections encrypted
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] File upload restrictions in place
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive information

### Vulnerability Scanning

```bash
# Check for known vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Advanced security scanning
docker run --rm -v "$PWD":/app clair-scanner
```

## Backup and Recovery

### Database Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/contact_db_$DATE.sql
gzip backups/contact_db_$DATE.sql

# Keep only last 30 days
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

### Recovery Procedure

```bash
# Restore from backup
gunzip -c backups/contact_db_20240101_000000.sql.gz | psql $DATABASE_URL
```

## Scaling Considerations

### Horizontal Scaling

1. **Multiple API Instances**:
   - Use load balancer (Nginx/HAProxy)
   - Session storage in Redis
   - Stateless application design

2. **Database Scaling**:
   - Read replicas for analytics queries
   - Connection pooling
   - Query optimization

3. **Caching Layer**:
   - Redis cluster for high availability
   - CDN for static assets
   - Application-level caching

### Vertical Scaling

- **CPU**: 2-4 cores recommended
- **Memory**: 4-8GB RAM minimum
- **Storage**: SSD for database
- **Network**: High bandwidth for API responses

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
```bash
# Check database connectivity
docker-compose exec api node -e "console.log(process.env.DATABASE_URL)"

# Test connection
docker-compose exec postgres psql -U postgres -d contact_management -c "SELECT 1;"
```

2. **Redis Connection Issues**:
```bash
# Check Redis
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

3. **High Memory Usage**:
```bash
# Monitor memory usage
docker stats

# Check for memory leaks
docker-compose exec api node --inspect=0.0.0.0:9229 dist/server/app.js
```

4. **Slow Query Performance**:
```bash
# Enable query logging in PostgreSQL
docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"
docker-compose exec postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

### Performance Tuning

1. **Database Tuning**:
```sql
-- Optimize PostgreSQL settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
SELECT pg_reload_conf();
```

2. **Node.js Tuning**:
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Enable cluster mode
PM2_INSTANCES=max pm2 start dist/server/app.js
```

## Maintenance

### Regular Maintenance Tasks

1. **Daily**:
   - Monitor error logs
   - Check system resources
   - Verify backups

2. **Weekly**:
   - Update dependencies
   - Security patches
   - Performance analysis

3. **Monthly**:
   - Database maintenance
   - Log rotation
   - Security audit

### Update Procedure

```bash
# 1. Backup current version
docker-compose exec postgres pg_dump contact_management > backup_pre_update.sql

# 2. Pull latest changes
git pull origin main

# 3. Build new version
docker-compose build

# 4. Deploy with zero downtime
docker-compose up -d --no-deps api

# 5. Run migrations if needed
docker-compose exec api npm run migrate

# 6. Verify deployment
curl -f http://localhost:5000/health
```

## Support and Documentation

- **API Documentation**: `/api-docs` endpoint
- **Health Status**: `/health` endpoint
- **Metrics**: `/metrics` endpoint
- **OpenAPI Spec**: Available at `/api/docs/openapi.yaml`

For production support, monitor the following:
- Application logs
- System metrics
- Database performance
- Cache hit rates
- Error rates
- Response times

## License

This project is licensed under the MIT License - see the LICENSE file for details.