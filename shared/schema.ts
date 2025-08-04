import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact type enum
export const contactTypeEnum = pgEnum("contact_type", ["company", "division", "person"]);

// Main contacts table with hierarchical structure
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: contactTypeEnum("type").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  title: varchar("title"), // Job title for persons
  description: text("description"), // Company/division description
  address: text("address"),
  website: varchar("website"),
  parentId: varchar("parent_id"),
  userId: varchar("user_id").notNull(), // Owner of the contact
  tags: text("tags").array().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  parent: one(contacts, {
    fields: [contacts.parentId],
    references: [contacts.id],
    relationName: "parent_child",
  }),
  children: many(contacts, {
    relationName: "parent_child",
  }),
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
}));

// Schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const updateContactSchema = insertContactSchema.partial();

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect & {
  parent?: Contact | null;
  children?: Contact[];
};
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;

export interface ContactStats {
  totalCompanies: number;
  totalDivisions: number;
  totalPeople: number;
}
