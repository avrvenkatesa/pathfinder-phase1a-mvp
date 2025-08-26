import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { DEFAULT_ROLE_PERMISSIONS, type Permission, type UserRole } from '../types/auth';

// Password utilities
export class PasswordUtils {
  static async hash(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validateStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Token utilities
export class TokenUtils {
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  static verifyBackupCode(code: string, hashedCode: string): boolean {
    const cleanCode = code.replace('-', '').toUpperCase();
    const hashedInput = crypto.createHash('sha256').update(cleanCode).digest('hex');
    return hashedInput === hashedCode;
  }
}

// Permission utilities
export class PermissionUtils {
  static hasPermission(userRole: UserRole, permission: Permission): boolean {
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[userRole];
    return rolePermissions.includes(permission);
  }

  static hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  static hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  static getRolePermissions(role: UserRole): Permission[] {
    return DEFAULT_ROLE_PERMISSIONS[role] as Permission[];
  }

  static canAccessRoute(userRole: UserRole, route: string): boolean {
    // Route-based permission mapping
    const routePermissions: Record<string, Permission[]> = {
      '/api/users': ['users.view'],
      '/api/users/*': ['users.view'],
      '/api/contacts': ['contacts.view'],
      '/api/contacts/*': ['contacts.view'],
      '/api/workflows': ['workflows.view'],
      '/api/workflows/*': ['workflows.view'],
      '/api/admin/*': ['system.manage_settings'],
      '/api/audit-logs': ['system.view_audit_logs'],
    };

    // Check for exact match first
    if (routePermissions[route]) {
      return this.hasAnyPermission(userRole, routePermissions[route]);
    }

    // Check for wildcard patterns
    for (const [pattern, permissions] of Object.entries(routePermissions)) {
      if (pattern.endsWith('/*')) {
        const basePattern = pattern.slice(0, -2);
        if (route.startsWith(basePattern)) {
          return this.hasAnyPermission(userRole, permissions);
        }
      }
    }

    // Default to allowing access for authenticated users
    return true;
  }
}

// Account lockout utilities
export class LockoutUtils {
  static readonly MAX_FAILED_ATTEMPTS = 5;
  static readonly LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  static shouldLockAccount(failedAttempts: number): boolean {
    return failedAttempts >= this.MAX_FAILED_ATTEMPTS;
  }

  static calculateLockoutExpiry(): Date {
    return new Date(Date.now() + this.LOCKOUT_DURATION_MS);
  }

  static isAccountLocked(lockedUntil: Date | null): boolean {
    if (!lockedUntil) return false;
    return new Date() < lockedUntil;
  }

  static getRemainingLockoutTime(lockedUntil: Date): number {
    const now = new Date().getTime();
    const lockoutTime = lockedUntil.getTime();
    return Math.max(0, lockoutTime - now);
  }
}

// Session utilities
export class SessionUtils {
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  static calculateExpiryTime(rememberMe: boolean = false): Date {
    const hoursToAdd = rememberMe ? 24 * 30 : 24; // 30 days or 24 hours
    return new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
  }

  static isSessionExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  static parseUserAgent(userAgent: string): string {
    // Simple user agent parsing for device info
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Macintosh')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';
    return 'Unknown Device';
  }
}

// Email utilities
export class EmailUtils {
  static generateVerificationToken(): string {
    return TokenUtils.generateSecureToken(32);
  }

  static generatePasswordResetToken(): string {
    return TokenUtils.generateSecureToken(32);
  }

  static calculateEmailTokenExpiry(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }

  static isEmailTokenExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return true;
    return new Date() > expiresAt;
  }
}

// Rate limiting utilities
export class RateLimitUtils {
  private static attempts: Map<string, { count: number; resetTime: number }> = new Map();

  static checkRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now > attempt.resetTime) {
      // First attempt or window expired
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    }

    if (attempt.count >= maxAttempts) {
      return { allowed: false, remainingAttempts: 0 };
    }

    attempt.count++;
    return { allowed: true, remainingAttempts: maxAttempts - attempt.count };
  }

  static clearRateLimit(key: string): void {
    this.attempts.delete(key);
  }
}

// Audit logging utilities
export class AuditUtils {
  static createAuditLog(params: {
    userId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
  }) {
    return {
      userId: params.userId || null,
      action: params.action,
      resource: params.resource || null,
      resourceId: params.resourceId || null,
      details: params.details || {},
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      success: params.success ?? true,
      errorMessage: params.errorMessage || null,
    };
  }

  static sanitizeUserAgent(userAgent: string): string {
    // Remove potentially sensitive information from user agent
    return userAgent.substring(0, 500); // Limit length
  }

  static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
  }
}

// Encryption utilities for sensitive data
export class EncryptionUtils {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly keyLength = 32;
  private static readonly ivLength = 16;

  static encrypt(text: string, key: string): string {
    const keyBuffer = crypto.scryptSync(key, 'salt', this.keyLength);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipherGCM(this.algorithm, keyBuffer, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText: string, key: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const keyBuffer = crypto.scryptSync(key, 'salt', this.keyLength);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipherGCM(this.algorithm, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}