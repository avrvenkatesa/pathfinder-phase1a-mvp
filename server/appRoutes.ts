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

// 🔧 Workflow / Instances routers
import workflows from "./routes/workflows";
import instancesSteps from "./routes/instances.steps";
import instancesProgress from "./routes/instances.progress";
import instancesById from "./routes/instances.byId";
import instances from "./routes/instances";

/**
 * Register all routes and return the HTTP server instance.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Session/OIDC middleware (required before authJwt routes)
  await setupAuth(app);

  // Health (for quick curl checks)
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

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

  // ✅ Workflows (separate path)
  app.use("/api/workflows", workflows);

  // ✅ Instances family — most specific first
  app.use("/api/instances", instancesSteps);     // PATCH /:id/steps/:stepId/status
  app.use("/api/instances", instancesProgress);  // GET   /:id/progress
  app.use("/api/instances", instancesById);      // GET   /:id
  app.use("/api/instances", instances);          // GET   /  (list with seek)

  // ---- TEMP: contacts stubs to avoid DB errors while contacts schema is not ready
  const useContactStubs =
    process.env.NODE_ENV !== "production" && process.env.CONTACTS_STUB === "true";

  if (useContactStubs) {
    // List contacts (stub)
    app.get("/api/contacts", isAuthenticated, (_req, res) => {
      res.json([]); // empty list
    });

    // Stats (stub)
    app.get("/api/contacts/stats", isAuthenticated, (_req, res) => {
      res.json({ total: 0, byType: {}, byTag: {} });
    });

    // Hierarchy (stub)
    app.get("/api/contacts/hierarchy", isAuthenticated, (_req, res) => {
      res.json([]); // empty tree
    });
  } else {
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
          return res.status(412).json({
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
          return res.status(412).json({
            message: "ETag precondition failed",
            code: "ETAG_MISMATCH",
            currentETag,
          });
        }

        // CRITICAL: Check for active workflow assignments before deletion
        const activeAssignments = await storage.checkContactAssignments(contactId, userId);
        if (activeAssignments.length > 0) {
          return res.status(409).json({
            message: "Cannot delete contact with active workflow assignments",
            code: "CONTACT_HAS_ACTIVE_ASSIGNMENTS",
            details: {
              assignmentCount: activeAssignments.length,
              assignments: activeAssignments.map((a) => ({
                id: a.id,
                workflowName: a.workflowName,
                status: a.status,
                assignedAt: a.assignedAt,
              })),
            },
            suggestions: [
              "Complete or cancel the assigned workflow tasks",
              "Reassign tasks to another contact",
              "Remove contact from workflow assignments",
            ],
          });
        }

        const deleted = await storage.deleteContact(contactId, userId);
        if (!deleted) {
          return res.status(404).json({ message: "Contact not found" });
        }

        // Broadcast contact deletion to all connected clients
        contactWebSocketService.broadcastContactDeleted(contactId, current);

        return res.status(204).end();
      } catch (err: any) {
        console.error("Error deleting contact:", err);

        // Handle database foreign key constraint violations
        if (err.code === "23503") {
          return res.status(409).json({
            message: "Cannot delete contact due to existing references",
            code: "REFERENTIAL_INTEGRITY_VIOLATION",
            hint: "Remove all workflow assignments before deleting this contact",
          });
        }

        return res.status(500).json({ message: "Failed to delete contact" });
      }
    });

    // Check if contact can be deleted (pre-deletion validation)
    app.get("/api/contacts/:id/can-delete", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;

        const current = await storage.getContactById(contactId, userId);
        if (!current) {
          return res.status(404).json({ message: "Contact not found" });
        }

        const activeAssignments = await storage.checkContactAssignments(contactId, userId);

        res.json({
          canDelete: activeAssignments.length === 0,
          contact: {
            id: current.id,
            name: current.name,
            type: current.type,
          },
          assignmentCount: activeAssignments.length,
          assignments: activeAssignments,
          reasons:
            activeAssignments.length > 0
              ? [`Contact has ${activeAssignments.length} active workflow assignments`]
              : [],
          suggestions:
            activeAssignments.length > 0
              ? [
                  "Complete or cancel active assignments",
                  "Reassign tasks to another contact",
                  "Use workflow management to remove assignments",
                ]
              : [],
        });
      } catch (err) {
        console.error("Error checking contact dependencies:", err);
        return res.status(500).json({ message: "Failed to check contact dependencies" });
      }
    });
  }
  // ---- END TEMP vs REAL CONTACTS

  // Simple health check (legacy path)
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Build the HTTP server and initialize websockets
  const httpServer = createServer(app);
  contactWebSocketService.initialize(httpServer);

  return httpServer;
}

// Default export for server/index.ts
export default registerRoutes;
