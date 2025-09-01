// server/appRoutes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { authJwtRoutes } from "./routes/authJwt";
import { contactWebSocketService } from "./services/websocketService";

// ETag helpers
import { computeContactETag, ifMatchSatisfied } from "./utils/etag";

// Schemas & validation
import { z } from "zod";
import { insertContactSchema } from "@shared/schema";

/**
 * Register all routes and return the HTTP server instance.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Session/OIDC middleware (required before authJwt routes)
  await setupAuth(app);

  // Session-based auth endpoint (handy for the client)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user || !user.claims) {
        return res.status(401).json({ error: "No active session" });
      }
      res.json({ claims: user.claims, authenticated: true });
    } catch (error) {
      console.error("Error in /api/auth/user:", error);
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Keep JWT routes for cookie mint/refresh/etc.
  app.use("/api/auth", authJwtRoutes);

  // Add validation proxy routes (simplified version for contact creation)
  app.post("/api/validation/validate-entity", async (req, res) => {
    try {
      const { entityType, data } = req.body;
      
      if (!entityType || !data) {
        return res.status(400).json({
          error: 'Missing required fields: entityType and data'
        });
      }

      // Simple validation for contacts - just check required fields
      if (entityType === 'contact') {
        const errors: any[] = [];
        const warnings: any[] = [];

        // Check required fields based on contact type
        if (!data.name || !data.name.trim()) {
          errors.push({
            field: 'name',
            message: 'Full name is required',
            code: 'REQUIRED_FIELD',
            value: data.name
          });
        }

        if (!data.type) {
          errors.push({
            field: 'type',
            message: 'Contact type is required',
            code: 'REQUIRED_FIELD',
            value: data.type
          });
        }

        // For person type, check firstName and lastName separately
        if (data.type === 'person') {
          if (!data.firstName || !data.firstName.trim()) {
            errors.push({
              field: 'firstName',
              message: 'First name is required for persons',
              code: 'REQUIRED_FIELD',
              value: data.firstName
            });
          }

          if (!data.lastName || !data.lastName.trim()) {
            errors.push({
              field: 'lastName',
              message: 'Last name is required for persons',
              code: 'REQUIRED_FIELD',
              value: data.lastName
            });
          }
        }

        // Email validation if provided
        if (data.email && data.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(data.email)) {
            errors.push({
              field: 'email',
              message: 'Invalid email format',
              code: 'INVALID_FORMAT',
              value: data.email
            });
          }
        }

        const result = {
          isValid: errors.length === 0,
          errors,
          warnings,
          metadata: {
            entityType,
            entityId: data.id || 'new',
            validatedAt: new Date().toISOString(),
            severity: errors.length > 0 ? 'error' : 'info'
          }
        };

        return res.json(result);
      }

      // For other entity types, return basic success
      return res.json({
        isValid: true,
        errors: [] as any[],
        warnings: [] as any[],
        metadata: {
          entityType,
          entityId: data.id || 'new',
          validatedAt: new Date().toISOString(),
          severity: 'info'
        }
      });
      
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(500).json({
        error: 'Internal validation service error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ------------------------------------------------------------------
  // Contacts (list/create/stats) — must come BEFORE the :id routes
  // ------------------------------------------------------------------

  // List contacts
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const filters = {
        search: req.query.search as string,
        type: req.query.type ? (req.query.type as string).split(",") : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
        location: req.query.location as string,
        isActive: req.query.isActive ? req.query.isActive === "true" : true,
      };
      const contacts = await storage.getContacts(userId, filters);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Create contact
  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData, userId);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid contact data", errors: error.errors });
      }
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Stats used by the UI
  app.get("/api/contacts/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const stats = await storage.getContactStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching contact stats:", error);
      res.status(500).json({ message: "Failed to fetch contact stats" });
    }
  });

  // (Optional) Hierarchy endpoint, if your UI calls it
  app.get("/api/contacts/hierarchy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const hierarchy = await storage.getContactHierarchy(userId);
      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching contact hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch contact hierarchy" });
    }
  });

  // ------------------------------------------------------------------
  // Contacts with Optimistic Concurrency (ETag) — :id routes
  // ------------------------------------------------------------------

  // GET contact (sends ETag)
  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const contactId = req.params.id;

      const contact = await storage.getContactById(contactId, userId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const etag = computeContactETag(contact);
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "no-store");
      return res.json(contact);
    } catch (err) {
      console.error("Error fetching contact:", err);
      return res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  // PUT contact (requires If-Match)
  app.put("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const contactId = req.params.id;

      const ifMatch = req.get("If-Match");
      if (!ifMatch) {
        return res
          .status(428)
          .json({ message: "Missing If-Match header", code: "MISSING_IF_MATCH" });
      }

      const current = await storage.getContactById(contactId, userId);
      if (!current) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const currentETag = computeContactETag(current);
      if (!ifMatchSatisfied(ifMatch, currentETag)) {
        return res
          .status(412)
          .json({
            message: "ETag precondition failed",
            code: "ETAG_MISMATCH",
            currentETag,
          });
      }

      const updated = await storage.updateContact(contactId, req.body, userId);
      if (!updated) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Broadcast contact modification to all connected clients
      contactWebSocketService.broadcastContactModified(contactId, req.body, updated);

      const newETag = computeContactETag(updated);
      res.setHeader("ETag", newETag);
      res.setHeader("Cache-Control", "no-store");
      return res.json(updated);
    } catch (err) {
      console.error("Error updating contact:", err);
      return res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // DELETE contact (requires If-Match)
  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const contactId = req.params.id;

      const ifMatch = req.get("If-Match");
      if (!ifMatch) {
        return res
          .status(428)
          .json({ message: "Missing If-Match header", code: "MISSING_IF_MATCH" });
      }

      const current = await storage.getContactById(contactId, userId);
      if (!current) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const currentETag = computeContactETag(current);
      if (!ifMatchSatisfied(ifMatch, currentETag)) {
        return res
          .status(412)
          .json({
            message: "ETag precondition failed",
            code: "ETAG_MISMATCH",
            currentETag,
          });
      }

      const deleted = await storage.deleteContact(contactId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Broadcast contact deletion to all connected clients
      contactWebSocketService.broadcastContactDeleted(contactId, current);

      return res.status(204).end();
    } catch (err) {
      console.error("Error deleting contact:", err);
      return res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Simple health check
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Build the HTTP server and initialize websockets
  const httpServer = createServer(app);
  contactWebSocketService.initialize(httpServer);

  return httpServer;
}

// Default export for server/index.ts
export default registerRoutes;