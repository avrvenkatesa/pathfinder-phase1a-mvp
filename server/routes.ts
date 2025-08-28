import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { contactService } from "./services/contactService";
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

// isAuthenticated will be imported from replitAuth

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  const { setupAuth, isAuthenticated } = await import("./replitAuth");
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

  // Email/Password login endpoint - keeping for backward compatibility
  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required"
        });
      }

      // Check test credentials
      if (email === 'test@example.com' && password === 'Test123!') {
        // Check if MFA code was provided for testing
        const { mfaCode } = req.body;
        
        // For MFA testing, require code "123456" for test user
        if (mfaCode) {
          if (mfaCode !== '123456') {
            return res.status(401).json({
              success: false,
              message: "The code you entered is incorrect. Please check your authenticator app and try again."
            });
          }
        } else {
          // First login step - require MFA
          return res.status(200).json({
            success: false,
            requiresMfa: true,
            message: "MFA code required"
          });
        }
        
        // Create or get test user
        const testUser = {
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          mfaEnabled: true
        };

        // Ensure test user exists in storage
        await storage.upsertUser({
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        });

        // Mock JWT token
        const accessToken = `test-token-${Date.now()}`;

        return res.json({
          success: true,
          user: {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: testUser.role,
            mfaEnabled: false,
            emailVerified: true
          },
          accessToken,
          message: "Login successful"
        });
      }

      // Invalid credentials
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Login failed"
      });
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

  // Enhanced Contact routes for workflow functionality
  
  // Contact Skills routes
  app.get("/api/contacts/:id/skills", isAuthenticated, async (req: any, res) => {
    try {
      const skills = await storage.getContactSkills(req.params.id);
      res.json(skills);
    } catch (error) {
      console.error("Error fetching contact skills:", error);
      res.status(500).json({ message: "Failed to fetch contact skills" });
    }
  });

  app.post("/api/contacts/:id/skills", isAuthenticated, async (req: any, res) => {
    try {
      const skillData = insertContactSkillSchema.parse({
        ...req.body,
        contactId: req.params.id
      });
      
      const skill = await storage.createContactSkill(skillData);
      res.status(201).json(skill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid skill data", errors: error.errors });
      }
      console.error("Error creating contact skill:", error);
      res.status(500).json({ message: "Failed to create contact skill" });
    }
  });

  app.put("/api/skills/:id", isAuthenticated, async (req: any, res) => {
    try {
      const skillData = updateContactSkillSchema.parse(req.body);
      const skill = await storage.updateContactSkill(req.params.id, skillData);
      
      if (!skill) {
        return res.status(404).json({ message: "Skill not found" });
      }
      
      res.json(skill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid skill data", errors: error.errors });
      }
      console.error("Error updating contact skill:", error);
      res.status(500).json({ message: "Failed to update contact skill" });
    }
  });

  app.delete("/api/skills/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteContactSkill(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Skill not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact skill:", error);
      res.status(500).json({ message: "Failed to delete contact skill" });
    }
  });

  // Contact Certifications routes
  app.get("/api/contacts/:id/certifications", isAuthenticated, async (req: any, res) => {
    try {
      const certifications = await storage.getContactCertifications(req.params.id);
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching contact certifications:", error);
      res.status(500).json({ message: "Failed to fetch contact certifications" });
    }
  });

  app.post("/api/contacts/:id/certifications", isAuthenticated, async (req: any, res) => {
    try {
      const certificationData = insertContactCertificationSchema.parse({
        ...req.body,
        contactId: req.params.id
      });
      
      const certification = await storage.createContactCertification(certificationData);
      res.status(201).json(certification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid certification data", errors: error.errors });
      }
      console.error("Error creating contact certification:", error);
      res.status(500).json({ message: "Failed to create contact certification" });
    }
  });

  app.put("/api/certifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const certificationData = updateContactCertificationSchema.parse(req.body);
      const certification = await storage.updateContactCertification(req.params.id, certificationData);
      
      if (!certification) {
        return res.status(404).json({ message: "Certification not found" });
      }
      
      res.json(certification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid certification data", errors: error.errors });
      }
      console.error("Error updating contact certification:", error);
      res.status(500).json({ message: "Failed to update contact certification" });
    }
  });

  app.delete("/api/certifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteContactCertification(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Certification not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact certification:", error);
      res.status(500).json({ message: "Failed to delete contact certification" });
    }
  });

  // Contact Availability routes
  app.get("/api/contacts/:id/availability", isAuthenticated, async (req: any, res) => {
    try {
      const availability = await storage.getContactAvailability(req.params.id);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching contact availability:", error);
      res.status(500).json({ message: "Failed to fetch contact availability" });
    }
  });

  app.post("/api/contacts/:id/availability", isAuthenticated, async (req: any, res) => {
    try {
      const availabilityData = insertContactAvailabilitySchema.parse({
        ...req.body,
        contactId: req.params.id
      });
      
      const availability = await storage.createContactAvailability(availabilityData);
      res.status(201).json(availability);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid availability data", errors: error.errors });
      }
      console.error("Error creating contact availability:", error);
      res.status(500).json({ message: "Failed to create contact availability" });
    }
  });

  app.put("/api/availability/:id", isAuthenticated, async (req: any, res) => {
    try {
      const availabilityData = updateContactAvailabilitySchema.parse(req.body);
      const availability = await storage.updateContactAvailability(req.params.id, availabilityData);
      
      if (!availability) {
        return res.status(404).json({ message: "Availability not found" });
      }
      
      res.json(availability);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid availability data", errors: error.errors });
      }
      console.error("Error updating contact availability:", error);
      res.status(500).json({ message: "Failed to update contact availability" });
    }
  });

  app.delete("/api/availability/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteContactAvailability(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Availability not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact availability:", error);
      res.status(500).json({ message: "Failed to delete contact availability" });
    }
  });

  // Enhanced workflow-related routes
  app.get("/api/contacts/by-skills", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const skills = req.query.skills ? (req.query.skills as string).split(',') : [];
      
      if (skills.length === 0) {
        return res.status(400).json({ message: "At least one skill is required" });
      }
      
      const contacts = await storage.getContactsBySkills(skills, userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts by skills:", error);
      res.status(500).json({ message: "Failed to fetch contacts by skills" });
    }
  });

  app.get("/api/contacts/available", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workloadThreshold = req.query.threshold ? parseInt(req.query.threshold as string) : 80;
      
      const contacts = await storage.getAvailableContacts(userId, workloadThreshold);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching available contacts:", error);
      res.status(500).json({ message: "Failed to fetch available contacts" });
    }
  });

  app.get("/api/contacts/:id/capacity", isAuthenticated, async (req: any, res) => {
    try {
      const capacity = await storage.calculateContactCapacity(req.params.id);
      res.json(capacity);
    } catch (error) {
      console.error("Error calculating contact capacity:", error);
      res.status(500).json({ message: "Failed to calculate contact capacity" });
    }
  });

  app.get("/api/contacts/assignment-candidates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const skills = req.query.skills ? (req.query.skills as string).split(',') : [];
      
      if (skills.length === 0) {
        return res.status(400).json({ message: "At least one required skill must be specified" });
      }
      
      const contacts = await storage.getContactsForAssignment(skills, userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching assignment candidates:", error);
      res.status(500).json({ message: "Failed to fetch assignment candidates" });
    }
  });

  // Enhanced Business Logic APIs
  
  // Assignment recommendations with scoring
  app.post("/api/contacts/assignment-recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requiredSkills, options = {} } = req.body;
      
      if (!requiredSkills || requiredSkills.length === 0) {
        return res.status(400).json({ message: "Required skills must be specified" });
      }
      
      const recommendations = await contactService.getAssignmentRecommendations(
        requiredSkills,
        userId,
        options
      );
      
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating assignment recommendations:", error);
      res.status(500).json({ message: "Failed to generate assignment recommendations" });
    }
  });

  // Enhanced contact creation with full details
  app.post("/api/contacts/enhanced", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contact, skills = [], certifications = [], availability = [] } = req.body;
      
      const contactData = insertContactSchema.parse(contact);
      
      const result = await contactService.createContactWithDetails(
        contactData,
        skills,
        certifications,
        availability,
        userId
      );
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      console.error("Error creating enhanced contact:", error);
      res.status(500).json({ message: "Failed to create enhanced contact" });
    }
  });

  // Bulk skills assignment
  app.post("/api/contacts/:id/skills/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const { skills } = req.body;
      
      if (!skills || !Array.isArray(skills)) {
        return res.status(400).json({ message: "Skills array is required" });
      }
      
      const result = await contactService.assignSkillsBulk(req.params.id, skills);
      res.json(result);
    } catch (error) {
      console.error("Error assigning skills in bulk:", error);
      res.status(500).json({ message: "Failed to assign skills in bulk" });
    }
  });

  // Skills gap analysis
  app.post("/api/contacts/skills-gap-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requiredSkills } = req.body;
      
      if (!requiredSkills || !Array.isArray(requiredSkills)) {
        return res.status(400).json({ message: "Required skills array is required" });
      }
      
      const analysis = await contactService.analyzeSkillsGap(requiredSkills, userId);
      res.json(analysis);
    } catch (error) {
      console.error("Error performing skills gap analysis:", error);
      res.status(500).json({ message: "Failed to perform skills gap analysis" });
    }
  });

  // Event queue for microservices integration
  app.get("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const events = contactService.getAndClearEventQueue();
      res.json({ events, count: events.length });
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
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

  // Workflow management routes
  app.get("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        search: req.query.search as string,
        status: req.query.status ? (req.query.status as string).split(',') : undefined,
        category: req.query.category as string,
        isTemplate: req.query.isTemplate ? req.query.isTemplate === 'true' : undefined,
      };
      
      const workflows = await storage.getWorkflows(userId, filters);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workflow = await storage.getWorkflowById(req.params.id, userId);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.json(workflow);
    } catch (error) {
      console.error("Error fetching workflow:", error);
      res.status(500).json({ message: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workflowData = insertWorkflowSchema.parse(req.body);
      
      const workflow = await storage.createWorkflow(workflowData, userId);
      res.status(201).json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workflow data", errors: error.errors });
      }
      console.error("Error creating workflow:", error);
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  app.put("/api/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workflowData = updateWorkflowSchema.parse(req.body);
      
      const workflow = await storage.updateWorkflow(req.params.id, workflowData, userId);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workflow data", errors: error.errors });
      }
      console.error("Error updating workflow:", error);
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteWorkflow(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  app.post("/api/workflows/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const duplicated = await storage.duplicateWorkflow(req.params.id, userId);
      
      if (!duplicated) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.status(201).json(duplicated);
    } catch (error) {
      console.error("Error duplicating workflow:", error);
      res.status(500).json({ message: "Failed to duplicate workflow" });
    }
  });

  // Workflow execution routes
  app.post("/api/workflows/:id/execute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, variables } = req.body;
      
      const instance = await storage.createWorkflowInstance(req.params.id, {
        name: name || `Execution ${new Date().toISOString()}`,
        variables: variables || {},
        status: 'pending',
      }, userId);
      
      res.status(201).json(instance);
    } catch (error) {
      console.error("Error executing workflow:", error);
      res.status(500).json({ message: "Failed to execute workflow" });
    }
  });

  app.get("/api/workflow-instances/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const instance = await storage.getWorkflowInstance(req.params.id, userId);
      
      if (!instance) {
        return res.status(404).json({ message: "Workflow instance not found" });
      }
      
      // Get tasks for this instance
      const tasks = await storage.getWorkflowTasksByInstance(req.params.id);
      
      res.json({ ...instance, tasks });
    } catch (error) {
      console.error("Error fetching workflow instance:", error);
      res.status(500).json({ message: "Failed to fetch workflow instance" });
    }
  });

  app.put("/api/workflow-instances/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const instance = await storage.updateWorkflowInstance(req.params.id, req.body, userId);
      
      if (!instance) {
        return res.status(404).json({ message: "Workflow instance not found" });
      }
      
      res.json(instance);
    } catch (error) {
      console.error("Error updating workflow instance:", error);
      res.status(500).json({ message: "Failed to update workflow instance" });
    }
  });

  app.get("/api/workflows/:id/instances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const instances = await storage.getWorkflowInstancesByWorkflow(req.params.id, userId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching workflow instances:", error);
      res.status(500).json({ message: "Failed to fetch workflow instances" });
    }
  });

  // Workflow task routes
  app.put("/api/workflow-tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const task = await storage.updateWorkflowTask(req.params.id, req.body);
      
      if (!task) {
        return res.status(404).json({ message: "Workflow task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating workflow task:", error);
      res.status(500).json({ message: "Failed to update workflow task" });
    }
  });

  // Workflow template routes
  app.get("/api/workflow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        search: req.query.search as string,
        category: req.query.category as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
      };
      
      const templates = await storage.getWorkflowTemplates(userId, filters);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ message: "Failed to fetch workflow templates" });
    }
  });

  app.post("/api/workflow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateData = insertWorkflowTemplateSchema.parse(req.body);
      
      const template = await storage.createWorkflowTemplate(templateData, userId);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error creating workflow template:", error);
      res.status(500).json({ message: "Failed to create workflow template" });
    }
  });

  app.post("/api/workflow-templates/:id/use", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workflow = await storage.useWorkflowTemplate(req.params.id, userId);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error using workflow template:", error);
      res.status(500).json({ message: "Failed to use workflow template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
