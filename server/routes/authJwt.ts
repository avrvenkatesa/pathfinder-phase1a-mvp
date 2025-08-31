import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { authJwtRoutes } from "./routes/authJwt"; // ⬅️ CHANGED: named import
import { contactService } from "./services/contactService";
import { contactWebSocketService } from "./services/websocketService";
import { 
  insertContactSchema, 
  updateContactSchema, 
  insertContactSkillSchema,
  updateContactSkillSchema,
  insertContactCertificationSchema,
  updateContactCertificationSchema,
  insertContactAvailabilitySchema,
  updateContactAvailabilitySchema,
  insertWorkflowSchema, 
  updateWorkflowSchema,
  insertWorkflowInstanceSchema,
  insertWorkflowTaskSchema,
  insertWorkflowTemplateSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware (Replit OIDC session)
  await setupAuth(app);

  // Mount JWT auth endpoints
  app.use("/api/auth", authJwtRoutes);

  // Auth routes (Replit session-based user info)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Fetching contacts for user ID:", userId);
      const filters = {
        search: req.query.search as string,
        type: req.query.type ? (req.query.type as string).split(',') : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        location: req.query.location as string,
        isActive: req.query.isActive ? req.query.isActive === 'true' : true,
      };

      const contacts = await storage.getContacts(userId, filters);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/hierarchy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hierarchy = await storage.getContactHierarchy(userId);
      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching contact hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch contact hierarchy" });
    }
  });

  app.get("/api/contacts/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getContactStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching contact stats:", error);
      res.status(500).json({ message: "Failed to fetch contact stats" });
    }
  });

  // Capacity optimization analysis - must be before :id route
  app.get("/api/contacts/capacity-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const analysis = await contactService.getCapacityOptimizationSuggestions(userId);
      res.json(analysis);
    } catch (error) {
      console.error("Error performing capacity analysis:", error);
      res.status(500).json({ message: "Failed to perform capacity analysis" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contact = await storage.getContactById(req.params.id, userId);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Creating contact for user ID:", userId);
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

  app.put("/api/co
