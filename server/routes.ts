import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertContactSchema, updateContactSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
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

  app.put("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactData = updateContactSchema.parse(req.body);
      
      const contact = await storage.updateContact(req.params.id, contactData, userId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteContact(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Relationship management routes
  app.get("/api/relationships", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const relationships = await storage.getContactRelationships(userId);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const relationshipData = { ...req.body, userId };
      const relationship = await storage.createContactRelationship(relationshipData);
      res.status(201).json(relationship);
    } catch (error) {
      console.error("Error creating relationship:", error);
      res.status(500).json({ message: "Failed to create relationship" });
    }
  });

  app.put("/api/relationships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const relationshipData = { ...req.body, userId };
      const relationship = await storage.updateContactRelationship(req.params.id, relationshipData, userId);
      
      if (!relationship) {
        return res.status(404).json({ message: "Relationship not found" });
      }
      
      res.json(relationship);
    } catch (error) {
      console.error("Error updating relationship:", error);
      res.status(500).json({ message: "Failed to update relationship" });
    }
  });

  app.delete("/api/relationships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteContactRelationship(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Relationship not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  app.post("/api/relationships/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { operation, relationshipIds } = req.body;
      
      const result = await storage.bulkUpdateRelationships(relationshipIds, operation, userId);
      res.json({ affected: result });
    } catch (error) {
      console.error("Error performing bulk relationship operation:", error);
      res.status(500).json({ message: "Failed to perform bulk operation" });
    }
  });

  // Hierarchy change tracking routes
  app.get("/api/hierarchy-changes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = req.query.contactId as string;
      const changes = await storage.getHierarchyChanges(userId, contactId);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching hierarchy changes:", error);
      res.status(500).json({ message: "Failed to fetch hierarchy changes" });
    }
  });

  app.post("/api/hierarchy-changes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const changeData = { ...req.body, userId };
      const change = await storage.createHierarchyChange(changeData);
      res.status(201).json(change);
    } catch (error) {
      console.error("Error creating hierarchy change:", error);
      res.status(500).json({ message: "Failed to create hierarchy change" });
    }
  });

  // Workflow assignment routes
  app.get("/api/workflow-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = req.query.contactId as string;
      const workflowName = req.query.workflowName as string;
      const assignments = await storage.getWorkflowAssignments(userId, { contactId, workflowName });
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching workflow assignments:", error);
      res.status(500).json({ message: "Failed to fetch workflow assignments" });
    }
  });

  app.post("/api/workflow-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assignmentData = { ...req.body, userId };
      const assignment = await storage.createWorkflowAssignment(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating workflow assignment:", error);
      res.status(500).json({ message: "Failed to create workflow assignment" });
    }
  });

  app.post("/api/workflow-assignments/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { assignments, priority, deadline } = req.body;
      
      const results = await Promise.all(
        assignments.map((assignment: any) => 
          storage.createWorkflowAssignment({ 
            ...assignment, 
            userId, 
            priority, 
            deadline: deadline ? new Date(deadline) : undefined 
          })
        )
      );
      
      res.status(201).json(results);
    } catch (error) {
      console.error("Error creating bulk workflow assignments:", error);
      res.status(500).json({ message: "Failed to create bulk workflow assignments" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
