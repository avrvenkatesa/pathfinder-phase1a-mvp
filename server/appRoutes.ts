// server/appRoutes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { authJwtRoutes } from "./routes/authJwt";
import { contactWebSocketService } from "./services/websocketService";

// ETag helpers
import { computeContactETag, ifMatchSatisfied } from "./utils/etag";

/**
 * Register all routes and return the HTTP server instance.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Session/OIDC middleware (required before authJwt routes)
  await setupAuth(app);

  // JWT cookie endpoints under /api/auth
  app.use("/api/auth", authJwtRoutes);

  // --- Contacts with Optimistic Concurrency (ETag) ---

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
          .json({
            message: "Missing If-Match header",
            code: "MISSING_IF_MATCH",
          });
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
          .json({
            message: "Missing If-Match header",
            code: "MISSING_IF_MATCH",
          });
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
