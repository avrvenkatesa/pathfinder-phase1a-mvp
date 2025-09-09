// server/appRoutes.ts
import type { Express } from "express";
import { Router } from "express";

import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { authJwtRoutes } from "./routes/authJwt";
import { computeContactETag, ifMatchSatisfied } from "./utils/etag";

// Schemas & validation
import { z } from "zod";
import { insertContactSchema } from "@shared/schema";

// Workflow / Instances routers
import workflows from "./routes/workflows";
import instancesSteps from "./routes/instances.steps";
import instancesStepsConvenience from "./routes/instances.steps.convenience";
import instancesProgress from "./routes/instances.progress";
import instancesById from "./routes/instances.byId";
import instances from "./routes/instances"; // list (seek) router

/**
 * Test-only auth gate:
 * - In test, require X-Test-Auth: 1
 * - Otherwise, delegate to real isAuthenticated
 */
const testOnlyAuthGate = (req: any, res: any, next: any) => {
  if (req.get("X-Test-Auth") === "1") return next();
  return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
};
const requireAuthRuntime =
  process.env.NODE_ENV === "test" ? testOnlyAuthGate : isAuthenticated;

/**
 * Mount all routes onto the provided Express app.
 * NOTE: no server creation, no websockets, no 404/error handlers here.
 */
export async function registerRoutes(app: Express): Promise<void> {
  // Session/OIDC middleware (required before authJwt routes)
  await setupAuth(app);

  // Health (for quick curl checks)
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Session-based auth endpoint
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.claims) return res.status(401).json({ error: "No active session" });
      res.json({ claims: user.claims, authenticated: true });
    } catch (error) {
      console.error("Error in /api/auth/user:", error);
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // JWT routes
  app.use("/api/auth", authJwtRoutes);

  // ───────────────────────────────────────────────────────────────────────────
  // Runtime: AUTH-GATED
  // ───────────────────────────────────────────────────────────────────────────

  // /api/workflows (gate everything under this prefix)
  const workflowsRoot = Router();
  workflowsRoot.use(workflows);
  app.use("/api/workflows", requireAuthRuntime, workflowsRoot);

  // /api/instances (mount specific → generic under a single auth gate)
  const instancesRoot = Router();
  instancesRoot.use(instancesStepsConvenience); // POST /:id/steps/:stepId/{advance,complete}
  instancesRoot.use(instancesSteps);            // PATCH /:id/steps/:stepId/status
  instancesRoot.use(instancesProgress);         // GET   /:id/progress
  instancesRoot.use(instancesById);             // GET   /:id
  instancesRoot.use(instances);                 // GET   /   (list with seek)
  app.use("/api/instances", requireAuthRuntime, instancesRoot);

  // ───────────────────────────────────────────────────────────────────────────
  // Contacts (kept as-is; still require session auth)
  // ───────────────────────────────────────────────────────────────────────────
  const useContactStubs =
    process.env.NODE_ENV !== "production" && process.env.CONTACTS_STUB === "true";

  if (useContactStubs) {
    app.get("/api/contacts", isAuthenticated, (_req, res) => res.json([]));
    app.get("/api/contacts/stats", isAuthenticated, (_req, res) =>
      res.json({ total: 0, byType: {}, byTag: {} })
    );
    app.get("/api/contacts/hierarchy", isAuthenticated, (_req, res) => res.json([]));
  } else {
    // Contacts (list/create/stats) — must come BEFORE the :id routes
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

    app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactData = insertContactSchema.parse(req.body);
        const contact = await storage.createContact(contactData, userId);
        res.status(201).json(contact);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
        }
        console.error("Error creating contact:", error);
        res.status(500).json({ message: "Failed to create contact" });
      }
    });

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

    // Contacts with Optimistic Concurrency (ETag) — :id routes
    app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;
        const contact = await storage.getContactById(contactId, userId);
        if (!contact) return res.status(404).json({ message: "Contact not found" });
        const etag = computeContactETag(contact);
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", "no-store");
        return res.json(contact);
      } catch (err) {
        console.error("Error fetching contact:", err);
        return res.status(500).json({ message: "Failed to fetch contact" });
      }
    });

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
        if (!current) return res.status(404).json({ message: "Contact not found" });

        const currentETag = computeContactETag(current);
        if (!ifMatchSatisfied(ifMatch, currentETag)) {
          return res.status(412).json({
            message: "ETag precondition failed",
            code: "ETAG_MISMATCH",
            currentETag,
          });
        }

        const updated = await storage.updateContact(contactId, req.body, userId);
        if (!updated) return res.status(404).json({ message: "Contact not found" });

        const newETag = computeContactETag(updated);
        res.setHeader("ETag", newETag);
        res.setHeader("Cache-Control", "no-store");
        return res.json(updated);
      } catch (err) {
        console.error("Error updating contact:", err);
        return res.status(500).json({ message: "Failed to update contact" });
      }
    });

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
        if (!current) return res.status(404).json({ message: "Contact not found" });

        const deleted = await storage.deleteContact(contactId, userId);
        if (!deleted) return res.status(404).json({ message: "Contact not found" });

        return res.status(204).end();
      } catch (err: any) {
        console.error("Error deleting contact:", err);
        return res.status(500).json({ message: "Failed to delete contact" });
      }
    });

    // Pre-deletion validation
    app.get("/api/contacts/:id/can-delete", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;

        const current = await storage.getContactById(contactId, userId);
        if (!current) return res.status(404).json({ message: "Contact not found" });

        const activeAssignments = await storage.checkContactAssignments(contactId, userId);

        res.json({
          canDelete: activeAssignments.length === 0,
          contact: { id: current.id, name: current.name, type: current.type },
          assignmentCount: activeAssignments.length,
          assignments: activeAssignments,
          reasons:
            activeAssignments.length > 0
              ? [`Contact has ${activeAssignments.length} active workflow assignments`]
              : [],
          suggestions:
            activeAssignments.length > 0
              ? ["Complete/cancel assignments", "Reassign tasks", "Remove workflow assignments"]
              : [],
        });
      } catch (err) {
        console.error("Error checking contact dependencies:", err);
        return res.status(500).json({ message: "Failed to check contact dependencies" });
      }
    });
  }

  // Legacy health
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
}

export default registerRoutes;
