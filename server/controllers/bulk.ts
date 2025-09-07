import { Request, Response } from 'express';
import { eq, inArray, and, or, ilike } from 'drizzle-orm';
import { getDatabase } from '../config/database.js';
import { contacts, relationships, auditLog } from '@shared/schema';
import { asyncHandler, AppError, DatabaseError } from '../middleware/errorHandler.js';
import { metrics } from '../middleware/monitoring.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import csv from 'csv-parser';
import { Readable } from 'stream';

// Bulk operations schemas
const bulkCreateContactsSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().optional().nullable(),
    type: z.enum(['company', 'division', 'person']),
    parentId: z.string().uuid().optional().nullable(),
    jobTitle: z.string().max(255).optional().nullable(),
    department: z.string().max(255).optional().nullable(),
    skills: z.array(z.string().max(100)).optional().default([]),
    availabilityStatus: z.enum(['available', 'busy', 'partially_available', 'unavailable']).optional(),
    notes: z.string().max(5000).optional().nullable(),
  })).min(1).max(1000),
  options: z.object({
    skipDuplicates: z.boolean().default(false),
    validateHierarchy: z.boolean().default(true),
    createTransaction: z.boolean().default(true),
  }).optional().default({}),
});

const bulkUpdateSchema = z.object({
  filters: z.object({
    ids: z.array(z.string().uuid()).optional(),
    types: z.array(z.enum(['company', 'division', 'person'])).optional(),
    departments: z.array(z.string()).optional(),
    parentIds: z.array(z.string().uuid()).optional(),
  }),
  updates: z.object({
    department: z.string().max(255).optional(),
    availabilityStatus: z.enum(['available', 'busy', 'partially_available', 'unavailable']).optional(),
    skills: z.array(z.string().max(100)).optional(),
    notes: z.string().max(5000).optional(),
  }),
  options: z.object({
    skipAudit: z.boolean().default(false),
    batchSize: z.number().int().min(1).max(100).default(50),
  }).optional().default({}),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  options: z.object({
    softDelete: z.boolean().default(true),
    cascadeDelete: z.boolean().default(false),
    skipBackup: z.boolean().default(false),
  }).optional().default({}),
});

// Bulk create contacts
export const bulkCreateContacts = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { db } = getDatabase();
  const userId = (req as any).user?.id;

  const { contacts: contactsData, options } = bulkCreateContactsSchema.parse(req.body);

  // Validate hierarchy if enabled
  if (options.validateHierarchy) {
    const parentIds = contactsData
      .filter(c => c.parentId)
      .map(c => c.parentId!)
      .filter((id, index, arr) => arr.indexOf(id) === index);

    if (parentIds.length > 0) {
      const existingParents = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(inArray(contacts.id, parentIds));

      const missingParents = parentIds.filter(
        id => !existingParents.some(p => p.id === id)
      );

      if (missingParents.length > 0) {
        throw new AppError(400, `Parent contacts not found: ${missingParents.join(', ')}`);
      }
    }
  }

  const results = {
    created: 0,
    skipped: 0,
    errors: [] as any[],
    contacts: [] as any[],
  };

  try {
    if (options.createTransaction) {
      await db.transaction(async (tx) => {
        for (const contactData of contactsData) {
          try {
            // Check for duplicates if enabled
            if (!options.skipDuplicates) {
              const existing = await tx
                .select({ id: contacts.id })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.name, contactData.name),
                    contactData.email ? eq(contacts.email, contactData.email) : undefined
                  )
                )
                .limit(1);

              if (existing.length > 0) {
                results.skipped++;
                results.errors.push({
                  contact: contactData.name,
                  error: 'Contact already exists',
                });
                continue;
              }
            }

            // Create contact
            const newContact = {
              id: nanoid(),
              ...contactData,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const [created] = await tx
              .insert(contacts)
              .values(newContact)
              .returning();

            results.contacts.push(created);
            results.created++;

            // Audit log
            if (userId) {
              await tx.insert(auditLog).values({
                id: nanoid(),
                userId,
                action: 'CREATE',
                resourceType: 'contact',
                resourceId: created.id,
                changes: newContact,
                timestamp: new Date(),
              });
            }

          } catch (error) {
            results.errors.push({
              contact: contactData.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });
    } else {
      // Process without transaction for better performance with large datasets
      const batchSize = 50;
      for (let i = 0; i < contactsData.length; i += batchSize) {
        const batch = contactsData.slice(i, i + batchSize);
        const batchContacts = batch.map(contactData => ({
          id: nanoid(),
          ...contactData,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        try {
          const created = await db
            .insert(contacts)
            .values(batchContacts)
            .returning();

          results.contacts.push(...created);
          results.created += created.length;
        } catch (error) {
          // Handle batch errors individually
          for (const contactData of batch) {
            try {
              const newContact = {
                id: nanoid(),
                ...contactData,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const [created] = await db
                .insert(contacts)
                .values(newContact)
                .returning();

              results.contacts.push(created);
              results.created++;
            } catch (error) {
              results.errors.push({
                contact: contactData.name,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    metrics.recordMetric('bulk_create_contacts_duration', duration);
    metrics.incrementCounter('bulk_create_contacts_success');

    res.status(201).json({
      success: true,
      data: {
        summary: {
          total: contactsData.length,
          created: results.created,
          skipped: results.skipped,
          errors: results.errors.length,
        },
        contacts: results.contacts,
        errors: results.errors,
        performance: {
          duration,
          throughput: Math.round((results.created / duration) * 1000),
        },
      },
    });

  } catch (error) {
    metrics.incrementCounter('bulk_create_contacts_failed');
    throw new DatabaseError('Bulk create operation failed', error);
  }
});

// Bulk update contacts
export const bulkUpdateContacts = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { db } = getDatabase();
  const userId = (req as any).user?.id;

  const { filters, updates, options } = bulkUpdateSchema.parse(req.body);

  // Build where conditions
  const whereConditions = [];
  if (filters.ids?.length) {
    whereConditions.push(inArray(contacts.id, filters.ids));
  }
  if (filters.types?.length) {
    whereConditions.push(inArray(contacts.type, filters.types));
  }
  if (filters.departments?.length) {
    whereConditions.push(inArray(contacts.department, filters.departments));
  }
  if (filters.parentIds?.length) {
    whereConditions.push(inArray(contacts.parentId, filters.parentIds));
  }

  if (whereConditions.length === 0) {
    throw new AppError(400, 'At least one filter condition is required');
  }

  try {
    // Get contacts to update for audit purposes
    const contactsToUpdate = await db
      .select()
      .from(contacts)
      .where(and(...whereConditions));

    if (contactsToUpdate.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            matched: 0,
            updated: 0,
          },
          performance: {
            duration: Date.now() - startTime,
          },
        },
      });
    }

    // Batch update
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    const updatedContacts = await db
      .update(contacts)
      .set(updateData)
      .where(and(...whereConditions))
      .returning();

    // Create audit logs if not skipped
    if (!options.skipAudit && userId) {
      const auditEntries = contactsToUpdate.map(contact => ({
        id: nanoid(),
        userId,
        action: 'UPDATE' as const,
        resourceType: 'contact',
        resourceId: contact.id,
        changes: updates,
        timestamp: new Date(),
      }));

      // Insert audit logs in batches
      const batchSize = options.batchSize;
      for (let i = 0; i < auditEntries.length; i += batchSize) {
        const batch = auditEntries.slice(i, i + batchSize);
        await db.insert(auditLog).values(batch);
      }
    }

    const duration = Date.now() - startTime;
    metrics.recordMetric('bulk_update_contacts_duration', duration);
    metrics.incrementCounter('bulk_update_contacts_success');

    res.json({
      success: true,
      data: {
        summary: {
          matched: contactsToUpdate.length,
          updated: updatedContacts.length,
        },
        contacts: updatedContacts,
        performance: {
          duration,
          throughput: Math.round((updatedContacts.length / duration) * 1000),
        },
      },
    });

  } catch (error) {
    metrics.incrementCounter('bulk_update_contacts_failed');
    throw new DatabaseError('Bulk update operation failed', error);
  }
});

// Bulk delete contacts
export const bulkDeleteContacts = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { db } = getDatabase();
  const userId = (req as any).user?.id;

  const { ids, options } = bulkDeleteSchema.parse(req.body);

  try {
    // Get contacts to delete for backup/audit
    const contactsToDelete = await db
      .select()
      .from(contacts)
      .where(inArray(contacts.id, ids));

    if (contactsToDelete.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            requested: ids.length,
            deleted: 0,
          },
        },
      });
    }

    let deletedCount = 0;

    if (options.softDelete) {
      // Soft delete - mark as deleted
      const updated = await db
        .update(contacts)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(contacts.id, ids))
        .returning({ id: contacts.id });

      deletedCount = updated.length;
    } else {
      // Hard delete
      if (options.cascadeDelete) {
        // Delete relationships first
        await db
          .delete(relationships)
          .where(
            or(
              inArray(relationships.sourceId, ids),
              inArray(relationships.targetId, ids)
            )
          );
      }

      // Delete contacts
      const deleted = await db
        .delete(contacts)
        .where(inArray(contacts.id, ids))
        .returning({ id: contacts.id });

      deletedCount = deleted.length;
    }

    // Create audit logs
    if (userId) {
      const auditEntries = contactsToDelete.map(contact => ({
        id: nanoid(),
        userId,
        action: 'DELETE' as const,
        resourceType: 'contact',
        resourceId: contact.id,
        changes: { softDelete: options.softDelete },
        timestamp: new Date(),
      }));

      await db.insert(auditLog).values(auditEntries);
    }

    const duration = Date.now() - startTime;
    metrics.recordMetric('bulk_delete_contacts_duration', duration);
    metrics.incrementCounter('bulk_delete_contacts_success');

    res.json({
      success: true,
      data: {
        summary: {
          requested: ids.length,
          deleted: deletedCount,
        },
        performance: {
          duration,
          throughput: Math.round((deletedCount / duration) * 1000),
        },
      },
    });

  } catch (error) {
    metrics.incrementCounter('bulk_delete_contacts_failed');
    throw new DatabaseError('Bulk delete operation failed', error);
  }
});

// Bulk CSV import
export const bulkImportCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, 'CSV file is required');
  }

  const startTime = Date.now();
  const results = {
    total: 0,
    created: 0,
    errors: [] as any[],
  };

  try {
    const csvData: any[] = [];

    // Parse CSV
    await new Promise((resolve, reject) => {
      const stream = Readable.from(req.file!.buffer)
        .pipe(csv({
          mapHeaders: ({ header }) => header.toLowerCase().trim(),
        }))
        .on('data', (data) => {
          csvData.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    results.total = csvData.length;

    // Transform CSV data to contact format
    const contactsData = csvData.map((row, index) => {
      try {
        return {
          name: row.name || `Imported Contact ${index + 1}`,
          email: row.email || null,
          type: ['company', 'division', 'person'].includes(row.type) ? row.type : 'person',
          jobTitle: row.jobtitle || row.job_title || null,
          department: row.department || null,
          skills: row.skills ? row.skills.split(',').map((s: string) => s.trim()) : [],
          availabilityStatus: ['available', 'busy', 'partially_available', 'unavailable'].includes(row.availability) 
            ? row.availability 
            : 'available',
          notes: row.notes || null,
        };
      } catch (error) {
        results.errors.push({
          row: index + 1,
          error: `Invalid data format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        return null;
      }
    }).filter(Boolean);

    // Use bulk create functionality
    const { db } = getDatabase();
    const batchSize = 100;

    for (let i = 0; i < contactsData.length; i += batchSize) {
      const batch = contactsData.slice(i, i + batchSize);
      
      try {
        const batchContacts = batch.map(contactData => ({
          id: nanoid(),
          ...contactData,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        const created = await db
          .insert(contacts)
          .values(batchContacts)
          .returning({ id: contacts.id });

        results.created += created.length;
      } catch (error) {
        results.errors.push({
          batch: `${i + 1}-${Math.min(i + batchSize, contactsData.length)}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    metrics.recordMetric('csv_import_duration', duration);
    metrics.incrementCounter('csv_import_success');

    res.json({
      success: true,
      data: {
        summary: {
          total: results.total,
          processed: contactsData.length,
          created: results.created,
          errors: results.errors.length,
        },
        errors: results.errors,
        performance: {
          duration,
          throughput: Math.round((results.created / duration) * 1000),
        },
      },
    });

  } catch (error) {
    metrics.incrementCounter('csv_import_failed');
    throw new AppError(500, 'CSV import failed', error);
  }
});

// Bulk relationship assignment
export const bulkAssignRelationships = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    relationships: z.array(z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
      relationshipType: z.enum(['reports_to', 'works_with', 'supervises', 'collaborates']),
      notes: z.string().max(1000).optional().nullable(),
    })).min(1).max(1000),
    options: z.object({
      skipDuplicates: z.boolean().default(true),
      validateContacts: z.boolean().default(true),
    }).optional().default({}),
  });

  const { relationships: relationshipsData, options } = schema.parse(req.body);
  const { db } = getDatabase();
  const startTime = Date.now();

  try {
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as any[],
    };

    // Validate contacts exist
    if (options.validateContacts) {
      const allContactIds = [
        ...new Set([
          ...relationshipsData.map(r => r.sourceId),
          ...relationshipsData.map(r => r.targetId),
        ])
      ];

      const existingContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(inArray(contacts.id, allContactIds));

      const existingIds = new Set(existingContacts.map(c => c.id));
      const missingIds = allContactIds.filter(id => !existingIds.has(id));

      if (missingIds.length > 0) {
        throw new AppError(400, `Contacts not found: ${missingIds.join(', ')}`);
      }
    }

    await db.transaction(async (tx) => {
      for (const relationshipData of relationshipsData) {
        try {
          // Check for duplicates
          if (options.skipDuplicates) {
            const existing = await tx
              .select({ id: relationships.id })
              .from(relationships)
              .where(
                and(
                  eq(relationships.sourceId, relationshipData.sourceId),
                  eq(relationships.targetId, relationshipData.targetId),
                  eq(relationships.relationshipType, relationshipData.relationshipType)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              results.skipped++;
              continue;
            }
          }

          await tx.insert(relationships).values({
            id: nanoid(),
            ...relationshipData,
            createdAt: new Date(),
          });

          results.created++;
        } catch (error) {
          results.errors.push({
            relationship: `${relationshipData.sourceId} -> ${relationshipData.targetId}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });

    const duration = Date.now() - startTime;
    metrics.recordMetric('bulk_assign_relationships_duration', duration);

    res.json({
      success: true,
      data: {
        summary: {
          total: relationshipsData.length,
          created: results.created,
          skipped: results.skipped,
          errors: results.errors.length,
        },
        errors: results.errors,
        performance: {
          duration,
          throughput: Math.round((results.created / duration) * 1000),
        },
      },
    });

  } catch (error) {
    throw new AppError(500, 'Bulk relationship assignment failed', error);
  }
});