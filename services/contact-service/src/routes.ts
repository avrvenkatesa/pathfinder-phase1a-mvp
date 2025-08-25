import express from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from './storage';
import { sendSuccess, sendError, sendPaginated, asyncHandler } from '../../../shared/utils/response-helpers';
import { validateBody, validateQuery, validateParams } from '../../../shared/utils/validation';
import { z } from 'zod';
import { insertContactSchema, updateContactSchema } from '../../../shared/types/schema';

// Rate limiting
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write requests, please try again later.',
  },
});

const bulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 10, // limit each IP to 10 bulk requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many bulk requests, please try again later.',
  },
});

// Validation schemas
const contactFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional().transform(val => val?.split(',')),
  tags: z.string().optional().transform(val => val?.split(',')),
  location: z.string().optional(),
  isActive: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '20')),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

// Middleware to extract user ID from headers (will be set by API Gateway)
const extractUserId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return sendError(res, 401, 'MISSING_USER_ID', 'User ID not found in request headers');
  }
  (req as any).userId = userId;
  next();
};

export function setupRoutes(app: express.Express) {
  const router = express.Router();

  // Apply user ID extraction middleware to all routes
  router.use(extractUserId);

  /**
   * @swagger
   * /api/contacts:
   *   get:
   *     summary: Get contacts list
   *     tags: [Contacts]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *         description: Contact types (comma-separated)
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: Tags (comma-separated)
   *       - in: query
   *         name: location
   *         schema:
   *           type: string
   *         description: Location filter
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Active status filter
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Contacts list
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedContactsResponse'
   */
  router.get('/', readLimiter, validateQuery(contactFiltersSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const filters = req.query;
      const { page = 1, limit = 20, ...contactFilters } = filters;
      
      const contacts = await storage.getContacts(userId, contactFilters);
      
      // Simple pagination (in a real microservice, you'd want database-level pagination)
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedContacts = contacts.slice(startIndex, endIndex);
      
      return sendPaginated(res, paginatedContacts, page, limit, contacts.length);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch contacts');
    }
  }));

  /**
   * @swagger
   * /api/contacts/hierarchy:
   *   get:
   *     summary: Get contact hierarchy
   *     tags: [Contacts]
   *     responses:
   *       200:
   *         description: Contact hierarchy
   */
  router.get('/hierarchy', readLimiter, asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const hierarchy = await storage.getContactHierarchy(userId);
      return sendSuccess(res, hierarchy);
    } catch (error) {
      console.error("Error fetching contact hierarchy:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch contact hierarchy');
    }
  }));

  /**
   * @swagger
   * /api/contacts/stats:
   *   get:
   *     summary: Get contact statistics
   *     tags: [Contacts]
   *     responses:
   *       200:
   *         description: Contact statistics
   */
  router.get('/stats', readLimiter, asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const stats = await storage.getContactStats(userId);
      return sendSuccess(res, stats);
    } catch (error) {
      console.error("Error fetching contact stats:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch contact stats');
    }
  }));

  /**
   * @swagger
   * /api/contacts/{id}:
   *   get:
   *     summary: Get contact by ID
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Contact details
   *       404:
   *         description: Contact not found
   */
  router.get('/:id', readLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const contact = await storage.getContactById(req.params.id, userId);
      
      if (!contact) {
        return sendError(res, 404, 'CONTACT_NOT_FOUND', 'Contact not found');
      }
      
      return sendSuccess(res, contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch contact');
    }
  }));

  /**
   * @swagger
   * /api/contacts:
   *   post:
   *     summary: Create new contact
   *     tags: [Contacts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateContactRequest'
   *     responses:
   *       201:
   *         description: Contact created
   */
  router.post('/', writeLimiter, validateBody(insertContactSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const contact = await storage.createContact(req.body, userId);
      return res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact created successfully',
      });
    } catch (error) {
      console.error("Error creating contact:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create contact');
    }
  }));

  /**
   * @swagger
   * /api/contacts/{id}:
   *   put:
   *     summary: Update contact
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateContactRequest'
   *     responses:
   *       200:
   *         description: Contact updated
   *       404:
   *         description: Contact not found
   */
  router.put('/:id', writeLimiter, validateParams(idParamsSchema), validateBody(updateContactSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const contact = await storage.updateContact(req.params.id, req.body, userId);
      
      if (!contact) {
        return sendError(res, 404, 'CONTACT_NOT_FOUND', 'Contact not found');
      }
      
      return sendSuccess(res, contact, 'Contact updated successfully');
    } catch (error) {
      console.error("Error updating contact:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update contact');
    }
  }));

  /**
   * @swagger
   * /api/contacts/{id}:
   *   delete:
   *     summary: Delete contact
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Contact deleted
   *       404:
   *         description: Contact not found
   */
  router.delete('/:id', writeLimiter, validateParams(idParamsSchema), asyncHandler(async (req: any, res) => {
    try {
      const userId = req.userId;
      const deleted = await storage.deleteContact(req.params.id, userId);
      
      if (!deleted) {
        return sendError(res, 404, 'CONTACT_NOT_FOUND', 'Contact not found');
      }
      
      return sendSuccess(res, { deleted: true }, 'Contact deleted successfully');
    } catch (error) {
      console.error("Error deleting contact:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to delete contact');
    }
  }));

  app.use('/api/contacts', router);
}