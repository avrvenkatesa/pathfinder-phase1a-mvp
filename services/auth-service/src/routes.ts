import express from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from './auth-setup';
import { storage } from './storage';
import { sendSuccess, sendError, asyncHandler } from '../../../shared/utils/response-helpers';

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later.',
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  },
});

export function setupRoutes(app: express.Express) {
  const router = express.Router();

  /**
   * @swagger
   * /api/auth/user:
   *   get:
   *     summary: Get current user
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: User information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized
   */
  router.get('/user', generalLimiter, isAuthenticated, asyncHandler(async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
      }

      return sendSuccess(res, user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch user');
    }
  }));

  /**
   * @swagger
   * /api/auth/verify:
   *   get:
   *     summary: Verify authentication status
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Authentication status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     authenticated:
   *                       type: boolean
   *                     userId:
   *                       type: string
   *       401:
   *         description: Unauthorized
   */
  router.get('/verify', generalLimiter, isAuthenticated, asyncHandler(async (req: any, res) => {
    const userId = req.user.claims.sub;
    return sendSuccess(res, {
      authenticated: true,
      userId,
    });
  }));

  /**
   * @swagger
   * /api/auth/session:
   *   get:
   *     summary: Get session information
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Session information
   *       401:
   *         description: Unauthorized
   */
  router.get('/session', generalLimiter, isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = req.user;
    const sessionInfo = {
      userId: user.claims.sub,
      email: user.claims.email,
      expiresAt: user.expires_at,
      isAuthenticated: req.isAuthenticated(),
    };
    return sendSuccess(res, sessionInfo);
  }));

  app.use('/api/auth', router);
}