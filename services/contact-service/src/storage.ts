import {
  contacts,
  contactRelationships,
  type Contact,
  type InsertContact,
  type UpdateContact,
  type ContactRelationship,
  type InsertContactRelationship,
} from "../../../shared/types/schema";
import { db } from "./db";
import {
  eq,
  and,
  isNull,
  or,
  ilike,
  inArray,
  sql,
  desc,
  asc,
} from "drizzle-orm";

export interface ContactFilters {
  search?: string;
  type?: string[];
  tags?: string[];
  location?: string;
  isActive?: boolean;
}

export interface AdvancedSearchFilters {
  query?: string;
  types?: string[];
  skills?: string[];
  departments?: string[];
  locations?: string[];
  availabilityStatus?: string[];
  workloadStatus?: string[];
  hasWorkflows?: boolean;
}

export interface ContactStats {
  totalCompanies: number;
  totalDivisions: number;
  totalPeople: number;
}

export interface ContactAnalytics {
  overview: {
    totalContacts: number;
    activeContacts: number;
    newThisMonth: number;
    typeBreakdown: Record<string, number>;
  };
  hierarchy: {
    maxDepth: number;
    orphanedContacts: number;
  };
  activity: {
    recentlyUpdated: Contact[];
    mostConnected: Contact[];
  };
}

export interface IContactStorage {
  // Contact operations
  getContacts(userId: string, filters?: ContactFilters): Promise<Contact[]>;
  getContactById(id: string, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, userId: string): Promise<Contact>;
  updateContact(
    id: string,
    contact: UpdateContact,
    userId: string,
  ): Promise<Contact | undefined>;
  deleteContact(id: string, userId: string): Promise<boolean>;
  getContactHierarchy(userId: string): Promise<Contact[]>;
  getContactStats(userId: string): Promise<ContactStats>;

  // Advanced search and relationships
  advancedContactSearch(
    filters: AdvancedSearchFilters,
    userId: string,
  ): Promise<Contact[]>;
  createRelationship(
    relationship: InsertContactRelationship,
    userId: string,
  ): Promise<ContactRelationship>;
  getContactRelationships(
    contactId: string,
    userId: string,
  ): Promise<ContactRelationship[]>;
  getContactTree(contactId: string, userId: string): Promise<any>;
  getContactAnalytics(userId: string): Promise<ContactAnalytics>;
}

export class ContactStorage implements IContactStorage {
  async getContacts(
    userId: string,
    filters?: ContactFilters,
  ): Promise<Contact[]> {
    const conditions = [eq(contacts.userId, userId)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(contacts.name, `%${filters.search}%`),
          ilike(contacts.email, `%${filters.search}%`),
          ilike(contacts.description, `%${filters.search}%`),
        )!,
      );
    }

    if (filters?.type && filters.type.length > 0) {
      conditions.push(
        inArray(
          contacts.type,
          filters.type as ("company" | "division" | "person")[],
        ),
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(contacts.isActive, filters.isActive));
    }

    return await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(contacts.createdAt);
  }

  async getContactById(
    id: string,
    userId: string,
  ): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return contact;
  }

  async createContact(
    contact: InsertContact,
    userId: string,
  ): Promise<Contact> {
    const [newContact] = await db
      .insert(contacts)
      .values({ ...contact, userId })
      .returning();
    return newContact;
  }

  async updateContact(
    id: string,
    contact: UpdateContact,
    userId: string,
  ): Promise<Contact | undefined> {
    const [updatedContact] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    return updatedContact;
  }

  async deleteContact(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getContactHierarchy(userId: string): Promise<Contact[]> {
    // Get all contacts for the user
    const allContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.isActive, true)))
      .orderBy(contacts.name);

    // Build hierarchy
    const contactMap = new Map<string, Contact>();
    const rootContacts: Contact[] = [];

    // First pass: create contact map
    allContacts.forEach((contact) => {
      contactMap.set(contact.id, { ...contact, children: [] });
    });

    // Second pass: build hierarchy (without circular references)
    allContacts.forEach((contact) => {
      const contactWithChildren = contactMap.get(contact.id)!;

      if (contact.parentId) {
        const parent = contactMap.get(contact.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(contactWithChildren);
        }
      } else {
        rootContacts.push(contactWithChildren);
      }
    });

    return rootContacts;
  }

  async getContactStats(userId: string): Promise<ContactStats> {
    const allContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.isActive, true)));

    const stats = {
      totalCompanies: 0,
      totalDivisions: 0,
      totalPeople: 0,
    };

    allContacts.forEach((contact) => {
      switch (contact.type) {
        case "company":
          stats.totalCompanies++;
          break;
        case "division":
          stats.totalDivisions++;
          break;
        case "person":
          stats.totalPeople++;
          break;
      }
    });

    return stats;
  }

  // Advanced Search Implementation
  async advancedContactSearch(
    filters: AdvancedSearchFilters,
    userId: string,
  ): Promise<Contact[]> {
    const conditions = [
      eq(contacts.userId, userId),
      eq(contacts.isActive, true),
    ];

    // Basic text search
    if (filters.query) {
      conditions.push(
        or(
          ilike(contacts.name, `%${filters.query}%`),
          ilike(contacts.email, `%${filters.query}%`),
          ilike(contacts.description, `%${filters.query}%`),
          ilike(contacts.location, `%${filters.query}%`),
        )!,
      );
    }

    // Type filter
    if (filters.types && filters.types.length > 0) {
      conditions.push(
        inArray(
          contacts.type,
          filters.types as ("company" | "division" | "person")[],
        ),
      );
    }

    // Location filter
    if (filters.locations && filters.locations.length > 0) {
      conditions.push(
        or(
          ...filters.locations.map((location) =>
            ilike(contacts.location, `%${location}%`),
          ),
        )!,
      );
    }

    // Skills filter (search in JSON field or tags)
    if (filters.skills && filters.skills.length > 0) {
      const skillConditions = filters.skills.map(
        (skill) =>
          or(
            ilike(contacts.tags, `%${skill}%`),
            ilike(contacts.description, `%${skill}%`),
          )!,
      );
      conditions.push(or(...skillConditions)!);
    }

    const results = await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.updatedAt));

    return results;
  }

  // Relationship Management
  async createRelationship(
    relationship: InsertContactRelationship,
    userId: string,
  ): Promise<ContactRelationship> {
    // Verify both contacts belong to the user
    const [parentContact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, relationship.parentId),
          eq(contacts.userId, userId),
        ),
      );

    const [childContact] = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.id, relationship.childId), eq(contacts.userId, userId)),
      );

    if (!parentContact || !childContact) {
      throw new Error("One or both contacts not found or unauthorized");
    }

    const [newRelationship] = await db
      .insert(contactRelationships)
      .values({ ...relationship, userId })
      .returning();

    return newRelationship;
  }

  async getContactRelationships(
    contactId: string,
    userId: string,
  ): Promise<ContactRelationship[]> {
    const relationships = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.userId, userId),
          or(
            eq(contactRelationships.parentId, contactId),
            eq(contactRelationships.childId, contactId),
          ),
        ),
      );

    return relationships;
  }

  async getContactTree(contactId: string, userId: string): Promise<any> {
    // Get the contact and all its relationships
    const contact = await this.getContactById(contactId, userId);
    if (!contact) {
      return null;
    }

    // Get all descendants
    const getAllDescendants = async (id: string): Promise<Contact[]> => {
      const children = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.parentId, id), eq(contacts.userId, userId)));

      const descendants: Contact[] = [...children];

      for (const child of children) {
        const childDescendants = await getAllDescendants(child.id);
        descendants.push(...childDescendants);
      }

      return descendants;
    };

    // Get all ancestors
    const getAllAncestors = async (id: string): Promise<Contact[]> => {
      const current = await this.getContactById(id, userId);
      if (!current || !current.parentId) {
        return [];
      }

      const parent = await this.getContactById(current.parentId, userId);
      if (!parent) {
        return [];
      }

      const ancestors = await getAllAncestors(parent.id);
      return [parent, ...ancestors];
    };

    const descendants = await getAllDescendants(contactId);
    const ancestors = await getAllAncestors(contactId);

    return {
      contact,
      ancestors,
      descendants,
      totalNodes: 1 + ancestors.length + descendants.length,
    };
  }

  // Analytics
  async getContactAnalytics(userId: string): Promise<ContactAnalytics> {
    const allContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId));

    const activeContacts = allContacts.filter((c) => c.isActive);

    // Calculate new contacts this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newThisMonth = allContacts.filter(
      (c) => c.createdAt && c.createdAt >= thisMonth,
    ).length;

    // Type breakdown
    const typeBreakdown = allContacts.reduce(
      (acc, contact) => {
        acc[contact.type] = (acc[contact.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Recently updated (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const recentlyUpdated = allContacts
      .filter((c) => c.updatedAt && c.updatedAt >= lastWeek)
      .sort(
        (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
      )
      .slice(0, 10);

    // Calculate hierarchy depth and orphaned contacts
    const contactMap = new Map<string, Contact>();
    allContacts.forEach((contact) => contactMap.set(contact.id, contact));

    let maxDepth = 0;
    let orphanedContacts = 0;

    const calculateDepth = (contactId: string, currentDepth = 0): number => {
      const contact = contactMap.get(contactId);
      if (!contact || !contact.parentId) {
        return currentDepth;
      }
      return calculateDepth(contact.parentId, currentDepth + 1);
    };

    allContacts.forEach((contact) => {
      const depth = calculateDepth(contact.id);
      maxDepth = Math.max(maxDepth, depth);

      // Check if contact has parent but parent doesn't exist
      if (contact.parentId && !contactMap.has(contact.parentId)) {
        orphanedContacts++;
      }
    });

    return {
      overview: {
        totalContacts: allContacts.length,
        activeContacts: activeContacts.length,
        newThisMonth,
        typeBreakdown,
      },
      hierarchy: {
        maxDepth,
        orphanedContacts,
      },
      activity: {
        recentlyUpdated,
        mostConnected: [], // Could implement connection counting later
      },
    };
  }
}

export const storage = new ContactStorage();
