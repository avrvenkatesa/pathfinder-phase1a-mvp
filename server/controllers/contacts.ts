import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { contacts } from '../schema/index.js';
import { eq, like, and, or, desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';

// Contact search and filtering schema
const contactSearchSchema = z.object({
  query: z.string().optional(),
  department: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  workloadMax: z.number().min(0).max(100).optional(),
  isWorkflowCompatible: z.boolean().optional(),
  company: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['relevance', 'availability', 'workload', 'lastActive', 'name']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export async function getContacts(req: Request, res: Response) {
  try {
    const params = contactSearchSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    // Build query conditions
    const conditions = [];
    
    if (params.query) {
      conditions.push(
        or(
          like(contacts.firstName, `%${params.query}%`),
          like(contacts.lastName, `%${params.query}%`),
          like(contacts.email, `%${params.query}%`),
          like(contacts.title, `%${params.query}%`)
        )
      );
    }

    if (params.department?.length) {
      conditions.push(sql`${contacts.department} = ANY(${params.department})`);
    }

    if (params.availability?.length) {
      conditions.push(sql`${contacts.availability} = ANY(${params.availability})`);
    }

    if (params.type?.length) {
      conditions.push(sql`${contacts.type} = ANY(${params.type})`);
    }

    if (params.isWorkflowCompatible) {
      conditions.push(eq(contacts.isWorkflowCompatible, true));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(contacts)
      .where(whereClause);

    // Get paginated results
    let query = db
      .select()
      .from(contacts)
      .where(whereClause)
      .limit(params.limit)
      .offset(offset);

    // Apply sorting
    switch (params.sortBy) {
      case 'name':
        query = query.orderBy(
          params.sortOrder === 'desc' ? desc(contacts.firstName) : contacts.firstName
        );
        break;
      case 'lastActive':
        query = query.orderBy(
          params.sortOrder === 'desc' ? desc(contacts.lastActive) : contacts.lastActive
        );
        break;
      default:
        query = query.orderBy(contacts.firstName);
    }

    const results = await query;
    const hasMore = offset + results.length < totalCount.count;

    // Get available filter options
    const [departments, availableStatuses] = await Promise.all([
      db.select({ department: contacts.department })
        .from(contacts)
        .groupBy(contacts.department),
      db.select({ availability: contacts.availability })
        .from(contacts)
        .groupBy(contacts.availability)
    ]);

    res.json({
      contacts: results,
      total: totalCount.count,
      page: params.page,
      limit: params.limit,
      hasMore,
      filters: {
        departments: departments.map(d => d.department).filter(Boolean),
        skills: [], // Would need separate skills table
        companies: [], // Would need separate companies table
        availableStatuses: availableStatuses.map(a => a.availability).filter(Boolean)
      }
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
}

export async function getContact(req: Request, res: Response) {
  try {
    const { contactId } = req.params;
    
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.contactId, contactId))
      .limit(1);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
}

export async function searchContacts(req: Request, res: Response) {
  try {
    const { query } = req.query as { query: string };
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const results = await db
      .select()
      .from(contacts)
      .where(
        or(
          like(contacts.firstName, `%${query}%`),
          like(contacts.lastName, `%${query}%`),
          like(contacts.email, `%${query}%`),
          like(contacts.title, `%${query}%`),
          like(contacts.department, `%${query}%`)
        )
      )
      .limit(20);

    // Add relevance scoring (simplified)
    const searchResults = results.map(contact => ({
      ...contact,
      relevanceScore: calculateRelevanceScore(contact, query),
      matchedFields: getMatchedFields(contact, query)
    }));

    // Sort by relevance
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
}

export async function getWorkflowCompatibleContacts(req: Request, res: Response) {
  try {
    const results = await db
      .select()
      .from(contacts)
      .where(eq(contacts.isWorkflowCompatible, true))
      .orderBy(contacts.firstName);

    res.json(results);
  } catch (error) {
    console.error('Error fetching workflow-compatible contacts:', error);
    res.status(500).json({ error: 'Failed to fetch workflow-compatible contacts' });
  }
}

export async function createContact(req: Request, res: Response) {
  try {
    const contactData = req.body;
    
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contactData,
        contactId: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
}

export async function updateContact(req: Request, res: Response) {
  try {
    const { contactId } = req.params;
    const updates = req.body;

    const [updatedContact] = await db
      .update(contacts)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(contacts.contactId, contactId))
      .returning();

    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
}

export async function deleteContact(req: Request, res: Response) {
  try {
    const { contactId } = req.params;

    const result = await db
      .delete(contacts)
      .where(eq(contacts.contactId, contactId))
      .returning({ deletedId: contacts.contactId });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
}

export async function batchUpdateContacts(req: Request, res: Response) {
  try {
    const { updates } = req.body as { updates: Array<{ contactId: string; data: any }> };
    
    const results = await Promise.all(
      updates.map(({ contactId, data }) =>
        db.update(contacts)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(contacts.contactId, contactId))
          .returning()
      )
    );

    const updatedContacts = results.flat();
    res.json(updatedContacts);
  } catch (error) {
    console.error('Error batch updating contacts:', error);
    res.status(500).json({ error: 'Failed to batch update contacts' });
  }
}

// Helper functions
function calculateRelevanceScore(contact: any, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  // Exact matches get higher scores
  if (contact.firstName?.toLowerCase().includes(lowerQuery)) score += 10;
  if (contact.lastName?.toLowerCase().includes(lowerQuery)) score += 10;
  if (contact.email?.toLowerCase().includes(lowerQuery)) score += 8;
  if (contact.title?.toLowerCase().includes(lowerQuery)) score += 6;
  if (contact.department?.toLowerCase().includes(lowerQuery)) score += 4;

  return Math.min(score / 10, 1); // Normalize to 0-1
}

function getMatchedFields(contact: any, query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  if (contact.firstName?.toLowerCase().includes(lowerQuery)) matches.push('firstName');
  if (contact.lastName?.toLowerCase().includes(lowerQuery)) matches.push('lastName');
  if (contact.email?.toLowerCase().includes(lowerQuery)) matches.push('email');
  if (contact.title?.toLowerCase().includes(lowerQuery)) matches.push('title');
  if (contact.department?.toLowerCase().includes(lowerQuery)) matches.push('department');

  return matches;
}