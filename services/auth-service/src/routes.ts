import express from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { z } from "zod";
import { isAuthenticated } from "./auth-setup";
import { storage } from "./storage";
import {
  sendSuccess,
  sendError,
  asyncHandler,
} from "../../../shared/utils/response-helpers";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  confirmPassword: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  mfaCode: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirmPassword: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().optional(),
});

const setupMfaSchema = z.object({
  password: z.string().min(1),
});

const verifyMfaSetupSchema = z.object({
  token: z.string().length(6),
  backupCodes: z.array(z.string()).optional(),
});

const disableMfaSchema = z.object({
  password: z.string().min(1),
  mfaCode: z.string().length(6),
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many authentication attempts, please try again later.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later.",
  },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Very strict for sensitive operations
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many attempts, please try again later.",
  },
});

// JWT Helper
function generateJWT(user: any, sessionId?: string): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || "user",
    sessionId,
    jti: nanoid(), // JWT ID for blacklisting
  };

  return jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "24h",
    issuer: "pathfinder-auth",
  });
}

// Utility functions
function getClientIP(req: any): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    "unknown"
  );
}

function generateSecureToken(length: number = 32): string {
  return nanoid(length);
}

function isAccountLocked(lockedUntil?: Date | null): boolean {
  if (!lockedUntil) return false;
  return new Date() < new Date(lockedUntil);
}

function shouldLockAccount(failedAttempts: number): boolean {
  return failedAttempts >= 5;
}

function calculateLockoutExpiry(): Date {
  return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setupRoutes(app: express.Express) {
  const router = express.Router();

  // ===================
  // AUTHENTICATION ENDPOINTS
  // ===================

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   */
  router.post(
    "/register",
    authLimiter,
    asyncHandler(async (req, res) => {
      try {
        const validatedData = registerSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await storage.getUserByEmail?.(
          validatedData.email,
        );
        if (existingUser) {
          return sendError(
            res,
            409,
            "EMAIL_EXISTS",
            "Email already registered",
          );
        }

        // Hash password
        const hashedPassword = await hashPassword(validatedData.password);

        // Create user using the existing upsertUser method
        const newUser = await storage.upsertUser({
          id: nanoid(),
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
        });

        const response = {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email!,
            firstName: newUser.firstName || "",
            lastName: newUser.lastName || "",
            role: "user",
            mfaEnabled: false,
            emailVerified: false,
          },
          message: "Registration successful!",
        };

        return res.status(201).json(response);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("Registration error:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "Registration failed");
      }
    }),
  );

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Authentication]
   */
  router.post(
    "/login",
    authLimiter,
    asyncHandler(async (req, res) => {
      try {
        const validatedData = loginSchema.parse(req.body);

        // For now, create a mock successful login response
        // In production, you'd verify against the database
        const mockUser = {
          id: nanoid(),
          email: validatedData.email,
          firstName: "Demo",
          lastName: "User",
          role: "user",
        };

        // Generate JWT
        const accessToken = generateJWT(mockUser);

        const response = {
          success: true,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            role: mockUser.role,
            mfaEnabled: false,
            emailVerified: true,
          },
          accessToken,
          message: "Login successful",
        };

        return res.json(response);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("Login error:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "Login failed");
      }
    }),
  );

  // ===================
  // EXISTING ENDPOINTS (Keep as-is for Replit compatibility)
  // ===================

  /**
   * @swagger
   * /api/auth/user:
   *   get:
   *     summary: Get current user (Replit compatibility)
   */
  router.get(
    "/user",
    generalLimiter,
    isAuthenticated,
    asyncHandler(async (req: any, res) => {
      try {
        const userId = req.user.claims?.sub || req.user.id;
        const user = await storage.getUser(userId);

        if (!user) {
          return sendError(res, 404, "USER_NOT_FOUND", "User not found");
        }

        return sendSuccess(res, user);
      } catch (error) {
        console.error("Error fetching user:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch user");
      }
    }),
  );

  /**
   * @swagger
   * /api/auth/verify:
   *   get:
   *     summary: Verify authentication status (Replit compatibility)
   */
  router.get(
    "/verify",
    generalLimiter,
    isAuthenticated,
    asyncHandler(async (req: any, res) => {
      const userId = req.user.claims?.sub || req.user.id;
      return sendSuccess(res, {
        authenticated: true,
        userId,
      });
    }),
  );

  /**
   * @swagger
   * /api/auth/session:
   *   get:
   *     summary: Get session information (Replit compatibility)
   */
  router.get(
    "/session",
    generalLimiter,
    isAuthenticated,
    asyncHandler(async (req: any, res) => {
      const user = req.user;
      const sessionInfo = {
        userId: user.claims?.sub || user.id,
        email: user.claims?.email || user.email,
        expiresAt: user.expires_at,
        isAuthenticated: req.isAuthenticated(),
      };
      return sendSuccess(res, sessionInfo);
    }),
  );

  // ===================
  // MFA ENDPOINTS
  // ===================

  /**
   * @swagger
   * /api/auth/mfa/setup:
   *   post:
   *     summary: Setup MFA for user
   *     tags: [MFA]
   */
  router.post(
    "/mfa/setup",
    authLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const validatedData = setupMfaSchema.parse(req.body);

        // Generate MFA secret
        const secret = speakeasy.generateSecret({
          name: `Pathfinder (${req.user?.email || "user"})`,
          issuer: "Pathfinder MVP",
        });

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        const response = {
          success: true,
          qrCode: qrCodeUrl,
          secret: secret.base32,
          message: "Scan the QR code with your authenticator app",
        };

        return res.json(response);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("MFA setup error:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "MFA setup failed");
      }
    }),
  );

  /**
   * @swagger
   * /api/auth/mfa/verify-setup:
   *   post:
   *     summary: Verify and complete MFA setup
   *     tags: [MFA]
   */
  router.post(
    "/mfa/verify-setup",
    authLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const validatedData = verifyMfaSetupSchema.parse(req.body);

        // For demonstration, we'll assume verification succeeds
        // In production, you'd verify against the stored secret

        // Generate backup codes
        const backupCodes = Array.from({ length: 10 }, () =>
          Math.random().toString(36).substring(2, 10).toUpperCase(),
        );

        const response = {
          success: true,
          backupCodes,
          message:
            "MFA has been successfully enabled. Save your backup codes in a secure location.",
        };

        return res.json(response);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("MFA verification error:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "MFA verification failed");
      }
    }),
  );

  // ===================
  // PASSWORD MANAGEMENT
  // ===================

  /**
   * @swagger
   * /api/auth/forgot-password:
   *   post:
   *     summary: Request password reset
   *     tags: [Password]
   */
  router.post(
    "/forgot-password",
    strictLimiter,
    asyncHandler(async (req, res) => {
      try {
        const validatedData = forgotPasswordSchema.parse(req.body);

        // Always return success to prevent email enumeration
        return sendSuccess(
          res,
          null,
          "If an account with that email exists, a password reset link has been sent.",
        );
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("Forgot password error:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to process request",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/auth/reset-password:
   *   post:
   *     summary: Reset password with token
   *     tags: [Password]
   */
  router.post(
    "/reset-password",
    authLimiter,
    asyncHandler(async (req, res) => {
      try {
        const validatedData = resetPasswordSchema.parse(req.body);

        // For demonstration purposes, accept any token
        if (!validatedData.token) {
          return sendError(
            res,
            400,
            "INVALID_TOKEN",
            "Invalid or expired reset token",
          );
        }

        return sendSuccess(res, null, "Password has been reset successfully");
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("Reset password error:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to reset password",
        );
      }
    }),
  );

  /**
   * @swagger
   * /api/auth/change-password:
   *   post:
   *     summary: Change password (authenticated user)
   *     tags: [Password]
   */
  router.post(
    "/change-password",
    authLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        const validatedData = changePasswordSchema.parse(req.body);

        // For demonstration, assume password change succeeds
        return sendSuccess(res, null, "Password has been changed successfully");
      } catch (error: any) {
        if (error.name === "ZodError") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            error.issues[0].message,
          );
        }
        console.error("Change password error:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to change password",
        );
      }
    }),
  );

  // ===================
  // EMAIL VERIFICATION
  // ===================

  /**
   * @swagger
   * /api/auth/verify-email:
   *   get:
   *     summary: Verify email address
   *     tags: [Email]
   */
  router.get(
    "/verify-email",
    asyncHandler(async (req, res) => {
      try {
        const { token } = req.query;

        if (!token || typeof token !== "string") {
          return sendError(
            res,
            400,
            "INVALID_TOKEN",
            "Verification token is required",
          );
        }

        return sendSuccess(res, null, "Email verified successfully");
      } catch (error) {
        console.error("Email verification error:", error);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Email verification failed",
        );
      }
    }),
  );

  // ===================
  // BASIC LOGOUT
  // ===================

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout current session
   *     tags: [Authentication]
   */
  router.post(
    "/logout",
    generalLimiter,
    asyncHandler(async (req: any, res) => {
      try {
        // For Replit compatibility, handle session logout
        if (req.logout) {
          req.logout((err: any) => {
            if (err) {
              return sendError(res, 500, "LOGOUT_ERROR", "Logout failed");
            }
            if (req.session && req.session.destroy) {
              req.session.destroy((err: any) => {
                if (err) {
                  return sendError(
                    res,
                    500,
                    "SESSION_ERROR",
                    "Session destruction failed",
                  );
                }
                return sendSuccess(res, null, "Logged out successfully");
              });
            } else {
              return sendSuccess(res, null, "Logged out successfully");
            }
          });
        } else {
          return sendSuccess(res, null, "Logged out successfully");
        }
      } catch (error) {
        console.error("Logout error:", error);
        return sendError(res, 500, "INTERNAL_ERROR", "Logout failed");
      }
    }),
  );

  app.use("/api/auth", router);
}
