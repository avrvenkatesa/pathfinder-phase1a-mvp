// server/appRoutes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { Router } from "express";

import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { authJwtRoutes } from "./routes/authJwt";
import { computeContactETag, ifMatchSatisfied } from "./utils/etag";

// Schemas & validation
import { z } from "zod";
import { insertContactSchema } from "@shared/schema";

// Error helpers (standardized error envelope)
import { errors } from "./errors";

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
const testOnlyAuthGate = (req: Request, _res: Response, next: NextFunction) => {
  if (req.get("X-Test-Auth") === "1") return next();
  // Canonical 401 envelope
  return next(errors.authMissing());
};
const requireAuthRuntime =
  process.env.NODE_ENV === "test" ? testOnlyAuthGate : isAuthenticated;

/**
 * Mount all routes onto the provided Express app.
 * NOTE: no server creation, no websockets, no 404/error handlers here.
 */
export async function registerRoutes(app: Express): Promise<void> {
  // Session/OIDC middleware (required before authJwt routes), but skip in tests so routes mount immediately.
  if (process.env.NODE_ENV !== "test") {
    await setupAuth(app);
  }

  // Public health (keep here so everything lives together)
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Session-based auth endpoint
  app.get("/api/auth/user", isAuthenticated, async (req: any, res, next) => {
    try {
      const user = req.user;
      if (!user?.claims) return next(errors.authMissing());
      return res.json({ claims: user.claims, authenticated: true });
    } catch (err) {
      return next(err);
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
  // Contacts (session auth)
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
    app.get("/api/contacts", isAuthenticated, async (req: any, res, next) => {
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
      } catch (err) {
        next(err);
      }
    });

    app.post("/api/contacts", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactData = insertContactSchema.parse(req.body); // Zod throws on invalid
        const contact = await storage.createContact(contactData, userId);
        res.status(201).json(contact);
      } catch (err) {
        // ZodError and others are normalized by the global error handler
        next(err);
      }
    });

    app.get("/api/contacts/stats", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const stats = await storage.getContactStats(userId);
        res.json(stats);
      } catch (err) {
        next(err);
      }
    });

    app.get("/api/contacts/hierarchy", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const hierarchy = await storage.getContactHierarchy(userId);
        res.json(hierarchy);
      } catch (err) {
        next(err);
      }
    });

    // Contacts with Optimistic Concurrency (ETag) — :id routes
    app.get("/api/contacts/:id", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;
        const contact = await storage.getContactById(contactId, userId);
        if (!contact) return next(errors.notFound("Contact"));
        const etag = computeContactETag(contact);
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", "no-store");
        return res.json(contact);
      } catch (err) {
        return next(err);
      }
    });

    app.put("/api/contacts/:id", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;

        const ifMatch = req.get("If-Match");
        if (!ifMatch) return next(errors.preconditionRequired());

        const current = await storage.getContactById(contactId, userId);
        if (!current) return next(errors.notFound("Contact"));

        const currentETag = computeContactETag(current);
        if (!ifMatchSatisfied(ifMatch, currentETag)) {
          return next(errors.preconditionFailed());
        }

        const updated = await storage.updateContact(contactId, req.body, userId);
        if (!updated) return next(errors.notFound("Contact"));

        const newETag = computeContactETag(updated);
        res.setHeader("ETag", newETag);
        res.setHeader("Cache-Control", "no-store");
        return res.json(updated);
      } catch (err) {
        return next(err);
      }
    });

    app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;

        const ifMatch = req.get("If-Match");
        if (!ifMatch) return next(errors.preconditionRequired());

        const current = await storage.getContactById(contactId, userId);
        if (!current) return next(errors.notFound("Contact"));

        const deleted = await storage.deleteContact(contactId, userId);
        if (!deleted) return next(errors.notFound("Contact"));

        return res.status(204).end();
      } catch (err) {
        return next(err);
      }
    });

    // Pre-deletion validation
    app.get("/api/contacts/:id/can-delete", isAuthenticated, async (req: any, res, next) => {
      try {
        const userId = req.user?.claims?.sub;
        const contactId = req.params.id;

        const current = await storage.getContactById(contactId, userId);
        if (!current) return next(errors.notFound("Contact"));

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
        return next(err);
      }
    });
  }

  // Legacy health for external probes
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
}

export default registerRoutes;
