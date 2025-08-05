import { Request, Response } from 'express';
import { sql, eq, count, desc, asc, and, or, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { getDatabase } from '../config/database.js';
import { contacts, relationships, auditLog } from '@shared/schema';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cacheConfigs } from '../middleware/cache.js';
import { z } from 'zod';

// Analytics query schemas
const timeRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
});

const contactAnalyticsSchema = z.object({
  ...timeRangeSchema.shape,
  groupBy: z.array(z.enum(['type', 'department', 'availabilityStatus', 'skills'])).optional(),
  filters: z.object({
    types: z.array(z.enum(['company', 'division', 'person'])).optional(),
    departments: z.array(z.string()).optional(),
    availabilityStatus: z.array(z.enum(['available', 'busy', 'partially_available', 'unavailable'])).optional(),
  }).optional(),
});

// Basic contact statistics
export const getContactStats = [
  cacheConfigs.contactStats,
  asyncHandler(async (req: Request, res: Response) => {
    const { db } = getDatabase();

    const stats = await db.transaction(async (tx) => {
      // Basic counts
      const [totalContacts] = await tx
        .select({ count: count() })
        .from(contacts)
        .where(isNull(contacts.deletedAt));

      const [companies] = await tx
        .select({ count: count() })
        .from(contacts)
        .where(and(eq(contacts.type, 'company'), isNull(contacts.deletedAt)));

      const [divisions] = await tx
        .select({ count: count() })
        .from(contacts)
        .where(and(eq(contacts.type, 'division'), isNull(contacts.deletedAt)));

      const [people] = await tx
        .select({ count: count() })
        .from(contacts)
        .where(and(eq(contacts.type, 'person'), isNull(contacts.deletedAt)));

      // Availability statistics
      const availabilityStats = await tx
        .select({
          status: contacts.availabilityStatus,
          count: count(),
        })
        .from(contacts)
        .where(and(
          eq(contacts.type, 'person'),
          isNull(contacts.deletedAt),
          isNotNull(contacts.availabilityStatus)
        ))
        .groupBy(contacts.availabilityStatus);

      // Growth statistics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [recentGrowth] = await tx
        .select({ count: count() })
        .from(contacts)
        .where(and(
          gte(contacts.createdAt, thirtyDaysAgo),
          isNull(contacts.deletedAt)
        ));

      return {
        totalContacts: totalContacts.count,
        totalCompanies: companies.count,
        totalDivisions: divisions.count,
        totalPeople: people.count,
        availabilityBreakdown: availabilityStats,
        recentGrowth: recentGrowth.count,
        lastUpdated: new Date().toISOString(),
      };
    });

    res.json({
      success: true,
      data: stats,
    });
  })
];

// Detailed contact analytics
export const getContactAnalytics = [
  cacheConfigs.analytics,
  asyncHandler(async (req: Request, res: Response) => {
    const query = contactAnalyticsSchema.parse(req.query);
    const { db } = getDatabase();

    // Build date filters
    const dateFilters = [];
    if (query.startDate) {
      dateFilters.push(gte(contacts.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      dateFilters.push(lte(contacts.createdAt, new Date(query.endDate)));
    }

    // Build additional filters
    const additionalFilters = [isNull(contacts.deletedAt)];
    if (query.filters?.types?.length) {
      additionalFilters.push(sql`${contacts.type} = ANY(${query.filters.types})`);
    }
    if (query.filters?.departments?.length) {
      additionalFilters.push(sql`${contacts.department} = ANY(${query.filters.departments})`);
    }
    if (query.filters?.availabilityStatus?.length) {
      additionalFilters.push(sql`${contacts.availabilityStatus} = ANY(${query.filters.availabilityStatus})`);
    }

    const allFilters = [...dateFilters, ...additionalFilters];

    const analytics = await db.transaction(async (tx) => {
      // Contact distribution by type
      const typeDistribution = await tx
        .select({
          type: contacts.type,
          count: count(),
        })
        .from(contacts)
        .where(and(...allFilters))
        .groupBy(contacts.type);

      // Department distribution
      const departmentDistribution = await tx
        .select({
          department: contacts.department,
          count: count(),
        })
        .from(contacts)
        .where(and(...allFilters, isNotNull(contacts.department)))
        .groupBy(contacts.department)
        .orderBy(desc(count()));

      // Skills analysis
      const skillsQuery = await tx
        .select({
          skills: contacts.skills,
        })
        .from(contacts)
        .where(and(...allFilters, isNotNull(contacts.skills)));

      // Process skills data
      const skillsMap = new Map<string, number>();
      skillsQuery.forEach(row => {
        if (row.skills) {
          row.skills.forEach(skill => {
            skillsMap.set(skill, (skillsMap.get(skill) || 0) + 1);
          });
        }
      });

      const topSkills = Array.from(skillsMap.entries())
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Growth trend (last 12 months)
      const growthTrend = await tx
        .select({
          month: sql<string>`to_char(${contacts.createdAt}, 'YYYY-MM')`,
          count: count(),
        })
        .from(contacts)
        .where(and(
          gte(contacts.createdAt, sql`NOW() - INTERVAL '12 months'`),
          isNull(contacts.deletedAt)
        ))
        .groupBy(sql`to_char(${contacts.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${contacts.createdAt}, 'YYYY-MM')`);

      // Relationship statistics
      const relationshipStats = await tx
        .select({
          relationshipType: relationships.relationshipType,
          count: count(),
        })
        .from(relationships)
        .groupBy(relationships.relationshipType);

      // Hierarchy depth analysis
      const hierarchyDepth = await tx.execute(sql`
        WITH RECURSIVE hierarchy_depth AS (
          -- Base case: root contacts (no parent)
          SELECT id, name, 0 as depth
          FROM ${contacts}
          WHERE parent_id IS NULL AND deleted_at IS NULL
          
          UNION ALL
          
          -- Recursive case: children
          SELECT c.id, c.name, hd.depth + 1
          FROM ${contacts} c
          JOIN hierarchy_depth hd ON c.parent_id = hd.id
          WHERE c.deleted_at IS NULL
        )
        SELECT depth, COUNT(*) as count
        FROM hierarchy_depth
        GROUP BY depth
        ORDER BY depth
      `);

      return {
        summary: {
          totalContacts: typeDistribution.reduce((sum, item) => sum + item.count, 0),
          analysisDate: new Date().toISOString(),
          timeRange: {
            startDate: query.startDate,
            endDate: query.endDate,
            period: query.period,
          },
        },
        distributions: {
          byType: typeDistribution,
          byDepartment: departmentDistribution,
          bySkills: topSkills,
        },
        trends: {
          growth: growthTrend,
        },
        relationships: {
          stats: relationshipStats,
        },
        hierarchy: {
          depthDistribution: hierarchyDepth.rows,
        },
      };
    });

    res.json({
      success: true,
      data: analytics,
    });
  })
];

// Activity analytics
export const getActivityAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { db } = getDatabase();
  const query = timeRangeSchema.parse(req.query);

  const dateFilters = [];
  if (query.startDate) {
    dateFilters.push(gte(auditLog.timestamp, new Date(query.startDate)));
  }
  if (query.endDate) {
    dateFilters.push(lte(auditLog.timestamp, new Date(query.endDate)));
  }

  const activity = await db.transaction(async (tx) => {
    // Activity by action type
    const actionStats = await tx
      .select({
        action: auditLog.action,
        count: count(),
      })
      .from(auditLog)
      .where(and(...dateFilters))
      .groupBy(auditLog.action);

    // Activity timeline
    const timelineQuery = query.period === 'day' 
      ? sql`to_char(${auditLog.timestamp}, 'YYYY-MM-DD')`
      : query.period === 'week'
      ? sql`to_char(${auditLog.timestamp}, 'IYYY-IW')`
      : sql`to_char(${auditLog.timestamp}, 'YYYY-MM')`;

    const timeline = await tx
      .select({
        period: sql<string>`${timelineQuery}`,
        count: count(),
      })
      .from(auditLog)
      .where(and(...dateFilters))
      .groupBy(sql`${timelineQuery}`)
      .orderBy(sql`${timelineQuery}`);

    // Most active users
    const activeUsers = await tx
      .select({
        userId: auditLog.userId,
        count: count(),
      })
      .from(auditLog)
      .where(and(...dateFilters, isNotNull(auditLog.userId)))
      .groupBy(auditLog.userId)
      .orderBy(desc(count()))
      .limit(10);

    // Resource activity
    const resourceActivity = await tx
      .select({
        resourceType: auditLog.resourceType,
        action: auditLog.action,
        count: count(),
      })
      .from(auditLog)
      .where(and(...dateFilters))
      .groupBy(auditLog.resourceType, auditLog.action)
      .orderBy(desc(count()));

    return {
      summary: {
        totalActivities: actionStats.reduce((sum, item) => sum + item.count, 0),
        period: query.period,
        analysisDate: new Date().toISOString(),
      },
      actionBreakdown: actionStats,
      timeline,
      topUsers: activeUsers,
      resourceActivity,
    };
  });

  res.json({
    success: true,
    data: activity,
  });
});

// Performance analytics
export const getPerformanceAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { db } = getDatabase();

  // Database performance metrics
  const dbStats = await db.execute(sql`
    SELECT 
      schemaname,
      tablename,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_tuples,
      n_dead_tup as dead_tuples,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
  `);

  // Index usage statistics
  const indexStats = await db.execute(sql`
    SELECT 
      schemaname,
      tablename,
      indexname,
      idx_tup_read,
      idx_tup_fetch,
      idx_scan
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC
  `);

  // Query performance (slow queries)
  const slowQueries = await db.execute(sql`
    SELECT 
      query,
      calls,
      total_time,
      mean_time,
      min_time,
      max_time,
      stddev_time
    FROM pg_stat_statements 
    WHERE query NOT LIKE '%pg_stat_statements%'
    ORDER BY mean_time DESC 
    LIMIT 10
  `);

  res.json({
    success: true,
    data: {
      database: {
        tables: dbStats.rows,
        indexes: indexStats.rows,
        slowQueries: slowQueries.rows,
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

// Custom report generation
export const generateCustomReport = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    reportType: z.enum(['contacts', 'relationships', 'activity', 'performance']),
    filters: z.object({
      dateRange: timeRangeSchema.optional(),
      contactTypes: z.array(z.enum(['company', 'division', 'person'])).optional(),
      departments: z.array(z.string()).optional(),
      includeDeleted: z.boolean().default(false),
    }).optional(),
    groupBy: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    format: z.enum(['json', 'csv', 'excel']).default('json'),
  });

  const { reportType, filters, groupBy, metrics, format } = schema.parse(req.body);
  const { db } = getDatabase();

  let reportData: any = {};

  switch (reportType) {
    case 'contacts':
      // Build dynamic contact report
      const contactFilters = [
        filters?.includeDeleted ? undefined : isNull(contacts.deletedAt),
        filters?.contactTypes?.length ? sql`${contacts.type} = ANY(${filters.contactTypes})` : undefined,
        filters?.departments?.length ? sql`${contacts.department} = ANY(${filters.departments})` : undefined,
      ].filter(Boolean);

      const contactQuery = db
        .select()
        .from(contacts)
        .where(contactFilters.length ? and(...contactFilters) : undefined);

      reportData = await contactQuery;
      break;

    case 'relationships':
      reportData = await db
        .select()
        .from(relationships);
      break;

    case 'activity':
      const activityFilters = [];
      if (filters?.dateRange?.startDate) {
        activityFilters.push(gte(auditLog.timestamp, new Date(filters.dateRange.startDate)));
      }
      if (filters?.dateRange?.endDate) {
        activityFilters.push(lte(auditLog.timestamp, new Date(filters.dateRange.endDate)));
      }

      reportData = await db
        .select()
        .from(auditLog)
        .where(activityFilters.length ? and(...activityFilters) : undefined)
        .orderBy(desc(auditLog.timestamp));
      break;

    default:
      throw new Error(`Report type ${reportType} not implemented`);
  }

  // Format response based on requested format
  if (format === 'csv') {
    // Convert to CSV format
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
    
    // Simple CSV conversion (in production, use proper CSV library)
    if (Array.isArray(reportData) && reportData.length > 0) {
      const headers = Object.keys(reportData[0]).join(',');
      const rows = reportData.map(row => 
        Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );
      res.send([headers, ...rows].join('\n'));
    } else {
      res.send('No data available');
    }
  } else {
    res.json({
      success: true,
      data: {
        reportType,
        filters,
        generatedAt: new Date().toISOString(),
        recordCount: Array.isArray(reportData) ? reportData.length : 1,
        data: reportData,
      },
    });
  }
});

// Engagement metrics
export const getEngagementMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { db } = getDatabase();

  const engagement = await db.transaction(async (tx) => {
    // Most connected contacts (by relationship count)
    const mostConnected = await tx.execute(sql`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.department,
        COUNT(DISTINCT r1.id) + COUNT(DISTINCT r2.id) as connection_count
      FROM ${contacts} c
      LEFT JOIN ${relationships} r1 ON c.id = r1.source_id
      LEFT JOIN ${relationships} r2 ON c.id = r2.target_id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.type, c.department
      ORDER BY connection_count DESC
      LIMIT 20
    `);

    // Collaboration patterns
    const collaborationPatterns = await tx
      .select({
        relationshipType: relationships.relationshipType,
        count: count(),
      })
      .from(relationships)
      .groupBy(relationships.relationshipType)
      .orderBy(desc(count()));

    // Department connectivity
    const departmentConnectivity = await tx.execute(sql`
      SELECT 
        c1.department as source_department,
        c2.department as target_department,
        COUNT(*) as connection_count
      FROM ${relationships} r
      JOIN ${contacts} c1 ON r.source_id = c1.id
      JOIN ${contacts} c2 ON r.target_id = c2.id
      WHERE c1.department IS NOT NULL 
        AND c2.department IS NOT NULL
        AND c1.deleted_at IS NULL 
        AND c2.deleted_at IS NULL
      GROUP BY c1.department, c2.department
      ORDER BY connection_count DESC
      LIMIT 50
    `);

    return {
      mostConnected: mostConnected.rows,
      collaborationPatterns,
      departmentConnectivity: departmentConnectivity.rows,
      analysisDate: new Date().toISOString(),
    };
  });

  res.json({
    success: true,
    data: engagement,
  });
});

// Capacity and utilization metrics
export const getCapacityMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { db } = getDatabase();

  const capacity = await db.transaction(async (tx) => {
    // Availability distribution
    const availabilityDistribution = await tx
      .select({
        status: contacts.availabilityStatus,
        count: count(),
      })
      .from(contacts)
      .where(and(
        eq(contacts.type, 'person'),
        isNull(contacts.deletedAt),
        isNotNull(contacts.availabilityStatus)
      ))
      .groupBy(contacts.availabilityStatus);

    // Department capacity
    const departmentCapacity = await tx
      .select({
        department: contacts.department,
        total: count(),
        available: sql<number>`COUNT(CASE WHEN ${contacts.availabilityStatus} = 'available' THEN 1 END)`,
        busy: sql<number>`COUNT(CASE WHEN ${contacts.availabilityStatus} = 'busy' THEN 1 END)`,
        partiallyAvailable: sql<number>`COUNT(CASE WHEN ${contacts.availabilityStatus} = 'partially_available' THEN 1 END)`,
        unavailable: sql<number>`COUNT(CASE WHEN ${contacts.availabilityStatus} = 'unavailable' THEN 1 END)`,
      })
      .from(contacts)
      .where(and(
        eq(contacts.type, 'person'),
        isNull(contacts.deletedAt),
        isNotNull(contacts.department)
      ))
      .groupBy(contacts.department)
      .orderBy(desc(count()));

    // Skills capacity analysis
    const skillsCapacity = await tx
      .select({
        skills: contacts.skills,
        availabilityStatus: contacts.availabilityStatus,
      })
      .from(contacts)
      .where(and(
        eq(contacts.type, 'person'),
        isNull(contacts.deletedAt),
        isNotNull(contacts.skills),
        isNotNull(contacts.availabilityStatus)
      ));

    // Process skills capacity
    const skillsMap = new Map<string, {
      total: number;
      available: number;
      busy: number;
      partiallyAvailable: number;
      unavailable: number;
    }>();

    skillsCapacity.forEach(row => {
      if (row.skills) {
        row.skills.forEach(skill => {
          if (!skillsMap.has(skill)) {
            skillsMap.set(skill, {
              total: 0,
              available: 0,
              busy: 0,
              partiallyAvailable: 0,
              unavailable: 0,
            });
          }

          const skillData = skillsMap.get(skill)!;
          skillData.total++;

          switch (row.availabilityStatus) {
            case 'available':
              skillData.available++;
              break;
            case 'busy':
              skillData.busy++;
              break;
            case 'partially_available':
              skillData.partiallyAvailable++;
              break;
            case 'unavailable':
              skillData.unavailable++;
              break;
          }
        });
      }
    });

    const topSkillsCapacity = Array.from(skillsMap.entries())
      .map(([skill, data]) => ({
        skill,
        ...data,
        utilizationRate: ((data.busy + data.partiallyAvailable) / data.total) * 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    return {
      overall: {
        totalPeople: availabilityDistribution.reduce((sum, item) => sum + item.count, 0),
        availabilityBreakdown: availabilityDistribution,
      },
      byDepartment: departmentCapacity,
      bySkills: topSkillsCapacity,
      analysisDate: new Date().toISOString(),
    };
  });

  res.json({
    success: true,
    data: capacity,
  });
});