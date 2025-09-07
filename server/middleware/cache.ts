import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { metrics } from './monitoring.js';

// In-memory cache implementation (for development)
// In production, use Redis or similar
class MemoryCache {
  private cache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
    tags: string[];
  }>();

  set(key: string, data: any, ttl: number = 300, tags: string[] = []): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      tags,
    });

    // Clean up expired entries periodically
    this.cleanup();
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      metrics.incrementCounter('cache_miss');
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      metrics.incrementCounter('cache_expired');
      return null;
    }

    metrics.incrementCounter('cache_hit');
    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Invalidate by tags
  invalidateByTag(tag: string): number {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    metrics.incrementCounter('cache_invalidated', invalidated);
    return invalidated;
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    metrics.incrementCounter('cache_cleared', size);
  }

  // Get cache statistics
  getStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.data).length;
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    }

    return {
      entries: this.cache.size,
      totalSizeBytes: totalSize,
      expiredEntries: expiredCount,
    };
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Cache instance
export const cache = new MemoryCache();

// Generate cache key from request
export const generateCacheKey = (req: Request, prefix: string = ''): string => {
  const keyParts = [
    prefix,
    req.method,
    req.path,
    JSON.stringify(req.query),
    req.get('Accept-Language') || 'en',
  ];

  const baseKey = keyParts.join(':');
  return createHash('md5').update(baseKey).digest('hex');
};

// Cache middleware factory
export const cacheMiddleware = (options: {
  ttl?: number;
  tags?: string[];
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  prefix?: string;
} = {}) => {
  const {
    ttl = 300, // 5 minutes default
    tags = [],
    keyGenerator,
    condition,
    prefix = 'api',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip cache for non-GET requests or if condition fails
    if (req.method !== 'GET' || (condition && !condition(req))) {
      return next();
    }

    const cacheKey = keyGenerator 
      ? keyGenerator(req) 
      : generateCacheKey(req, prefix);

    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey);
      return res.json(cachedData);
    }

    // Cache miss - intercept response
    const originalSend = res.send;
    res.send = function(data: any) {
      res.send = originalSend;

      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          cache.set(cacheKey, parsedData, ttl, tags);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Key', cacheKey);
        } catch (error) {
          console.warn('Failed to cache response:', error);
        }
      }

      return res.send(data);
    };

    next();
  };
};

// Cache invalidation middleware
export const invalidateCache = (tags: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    
    res.on('finish', () => {
      // Only invalidate on successful write operations
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        res.statusCode >= 200 && 
        res.statusCode < 300
      ) {
        tagsArray.forEach(tag => {
          const invalidated = cache.invalidateByTag(tag);
          console.log(`Cache invalidated: ${invalidated} entries for tag '${tag}'`);
        });
      }
    });

    next();
  };
};

// Predefined cache configurations for different endpoints
export const cacheConfigs = {
  // Contacts list - cache for 5 minutes, invalidate on contact changes
  contactsList: cacheMiddleware({
    ttl: 300,
    tags: ['contacts'],
    prefix: 'contacts:list',
  }),

  // Individual contact - cache for 10 minutes
  contactDetail: cacheMiddleware({
    ttl: 600,
    tags: ['contacts'],
    prefix: 'contacts:detail',
    keyGenerator: (req) => `contacts:detail:${req.params.id}`,
  }),

  // Contact stats - cache for 15 minutes
  contactStats: cacheMiddleware({
    ttl: 900,
    tags: ['contacts', 'stats'],
    prefix: 'contacts:stats',
  }),

  // Search results - cache for 2 minutes (shorter due to dynamic nature)
  searchResults: cacheMiddleware({
    ttl: 120,
    tags: ['contacts', 'search'],
    prefix: 'search',
    condition: (req) => {
      // Only cache if query has meaningful parameters
      const query = req.query.q as string;
      return !!(query && query.length > 2);
    },
  }),

  // Analytics data - cache for 30 minutes
  analytics: cacheMiddleware({
    ttl: 1800,
    tags: ['contacts', 'analytics'],
    prefix: 'analytics',
  }),

  // Hierarchy data - cache for 10 minutes
  hierarchy: cacheMiddleware({
    ttl: 600,
    tags: ['contacts', 'hierarchy'],
    prefix: 'hierarchy',
  }),
};

// Cache warming functions
export const warmCache = {
  // Warm up common queries
  async warmCommonQueries() {
    console.log('Warming up cache...');
    
    // This would typically make requests to common endpoints
    // to populate the cache during application startup
    
    // Example:
    // await fetch('/api/contacts/stats');
    // await fetch('/api/contacts?limit=50');
    // await fetch('/api/contacts/analytics');
    
    console.log('Cache warming completed');
  },

  // Warm specific contact data
  async warmContactData(contactIds: string[]) {
    // Pre-load specific contacts into cache
    console.log(`Warming cache for ${contactIds.length} contacts`);
  },
};

// Cache monitoring and metrics
export const cacheMetrics = {
  // Get detailed cache statistics
  getDetailedStats() {
    const stats = cache.getStats();
    const hitRate = metrics.getCounter('cache_hit') / 
      (metrics.getCounter('cache_hit') + metrics.getCounter('cache_miss'));

    return {
      ...stats,
      hitRate: isNaN(hitRate) ? 0 : hitRate,
      totalHits: metrics.getCounter('cache_hit'),
      totalMisses: metrics.getCounter('cache_miss'),
      totalInvalidations: metrics.getCounter('cache_invalidated'),
    };
  },

  // Reset cache metrics
  resetMetrics() {
    // This would reset metrics counters in a real implementation
    console.log('Cache metrics reset');
  },
};

// Cache administration endpoints
export const cacheAdmin = {
  // Get cache status
  status: (req: Request, res: Response) => {
    const stats = cacheMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        cacheStatus: 'active',
        ...stats,
        timestamp: new Date().toISOString(),
      },
    });
  },

  // Clear cache
  clear: (req: Request, res: Response) => {
    cache.clear();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  },

  // Invalidate by tag
  invalidateTag: (req: Request, res: Response) => {
    const { tag } = req.params;
    const invalidated = cache.invalidateByTag(tag);
    
    res.json({
      success: true,
      message: `Invalidated ${invalidated} cache entries for tag '${tag}'`,
      invalidatedCount: invalidated,
      timestamp: new Date().toISOString(),
    });
  },
};

// Response compression for large payloads
export const compressionConfig = {
  // Compress responses above 1KB
  threshold: 1024,
  // Compression level (1-9, 6 is default)
  level: 6,
  // Filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Compress JSON responses
    const contentType = res.getHeader('content-type') as string;
    return contentType && contentType.includes('json');
  },
};

// ETags for client-side caching
export const generateETag = (data: any): string => {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('md5').update(content).digest('hex');
};

export const etagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    res.send = originalSend;

    // Generate ETag for successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const etag = generateETag(data);
      res.setHeader('ETag', `"${etag}"`);

      // Check if client has current version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === `"${etag}"`) {
        return res.status(304).end();
      }
    }

    return res.send(data);
  };

  next();
};