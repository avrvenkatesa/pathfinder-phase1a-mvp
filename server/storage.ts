import {
  contacts,
  users,
  type Contact,
  type InsertContact,
  type UpdateContact,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, or, ilike, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Contact operations
  getContacts(userId: string, filters?: ContactFilters): Promise<Contact[]>;
  getContactById(id: string, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, userId: string): Promise<Contact>;
  updateContact(id: string, contact: UpdateContact, userId: string): Promise<Contact | undefined>;
  deleteContact(id: string, userId: string): Promise<boolean>;
  getContactHierarchy(userId: string): Promise<Contact[]>;
  getContactStats(userId: string): Promise<ContactStats>;
}

export interface ContactFilters {
  search?: string;
  type?: string[];
  tags?: string[];
  location?: string;
  isActive?: boolean;
}

export interface ContactStats {
  totalCompanies: number;
  totalDivisions: number;
  totalPeople: number;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Contact operations
  async getContacts(userId: string, filters?: ContactFilters): Promise<Contact[]> {
    const conditions = [eq(contacts.userId, userId)];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(contacts.name, `%${filters.search}%`),
          ilike(contacts.email, `%${filters.search}%`),
          ilike(contacts.description, `%${filters.search}%`)
        )!
      );
    }
    
    if (filters?.type && filters.type.length > 0) {
      conditions.push(inArray(contacts.type, filters.type as ("company" | "division" | "person")[]));
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

  async getContactById(id: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return contact;
  }

  async createContact(contact: InsertContact, userId: string): Promise<Contact> {
    const [newContact] = await db
      .insert(contacts)
      .values({ ...contact, userId })
      .returning();
    return newContact;
  }

  async updateContact(id: string, contact: UpdateContact, userId: string): Promise<Contact | undefined> {
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
    allContacts.forEach(contact => {
      contactMap.set(contact.id, { ...contact, children: [] });
    });

    // Second pass: build hierarchy
    allContacts.forEach(contact => {
      const contactWithChildren = contactMap.get(contact.id)!;
      
      if (contact.parentId) {
        const parent = contactMap.get(contact.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(contactWithChildren);
          contactWithChildren.parent = parent;
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

    allContacts.forEach(contact => {
      switch (contact.type) {
        case 'company':
          stats.totalCompanies++;
          break;
        case 'division':
          stats.totalDivisions++;
          break;
        case 'person':
          stats.totalPeople++;
          break;
      }
    });

    return stats;
  }
}

export const storage = new DatabaseStorage();
