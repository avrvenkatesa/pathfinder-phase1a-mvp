import {
  users,
  oauthAccounts,
  userSessions,
  roles,
  auditLogs,
  type User,
  type InsertOAuthAccount,
  type OAuthAccount,
  type InsertUserSession,
  type UserSession,
  type InsertAuditLog,
  type AuditLog,
} from "../../../shared/types/schema";
import { db } from "./db";
import { eq, and, desc, gt, lt, inArray, or, ilike } from "drizzle-orm";
import { PasswordUtils, TokenUtils, EncryptionUtils } from "../../../shared/utils/auth-utils";
import crypto from 'crypto';

export interface IAuthStorage {
  // User operations
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Partial<User>): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  upsertUser(userData: any): Promise<User>; // Keep for compatibility
  getUser(id: string): Promise<User | undefined>; // Keep for compatibility
  
  // OAuth operations
  getOAuthAccount(provider: string, providerAccountId: string): Promise<OAuthAccount | undefined>;
  createOAuthAccount(account: InsertOAuthAccount): Promise<OAuthAccount>;
  updateOAuthAccount(id: string, account: Partial<OAuthAccount>): Promise<OAuthAccount | undefined>;
  deleteOAuthAccount(id: string): Promise<boolean>;
  
  // Session operations
  createSession(session: InsertUserSession): Promise<UserSession>;
  getSession(sessionToken: string): Promise<UserSession | undefined>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  updateSession(id: string, session: Partial<UserSession>): Promise<UserSession | undefined>;
  deleteSession(id: string): Promise<boolean>;
  deleteUserSessions(userId: string, excludeSessionId?: string): Promise<number>;
  deleteExpiredSessions(): Promise<number>;
  
  // MFA operations
  generateMfaSecret(): Promise<{ secret: string; qrCodeUrl: string }>;
  enableMfa(userId: string, secret: string, backupCodes: string[]): Promise<boolean>;
  disableMfa(userId: string): Promise<boolean>;
  verifyMfaCode(userId: string, code: string): Promise<boolean>;
  generateBackupCodes(userId: string): Promise<string[]>;
  verifyAndUseBackupCode(userId: string, code: string): Promise<boolean>;
  
  // Password operations
  resetPassword(userId: string, newPassword: string): Promise<boolean>;
  generatePasswordResetToken(userId: string): Promise<string>;
  verifyPasswordResetToken(token: string): Promise<User | undefined>;
  
  // Email verification
  generateEmailVerificationToken(userId: string): Promise<string>;
  verifyEmailVerificationToken(token: string): Promise<User | undefined>;
  
  // JWT blacklist (for logout)
  blacklistJwt(jti: string, expiresAt: Date): Promise<boolean>;
  isJwtBlacklisted(jti: string): Promise<boolean>;
  
  // Security & Audit
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId?: string, action?: string, limit?: number): Promise<AuditLog[]>;
  
  // Admin operations
  getUsers(filters?: { search?: string; role?: string; isActive?: boolean }): Promise<User[]>;
  getUserStats(): Promise<{ total: number; active: number; mfaEnabled: number; }>;
}

export class AuthStorage implements IAuthStorage {
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-this';
  }

  // Compatibility methods
  async getUser(id: string): Promise<User | undefined> {
    return this.getUserById(id);
  }

  async upsertUser(userData: any): Promise<User> {
    const existingUser = await this.getUserById(userData.id);
    if (existingUser) {
      const updated = await this.updateUser(userData.id, userData);
      return updated || existingUser;
    } else {
      return this.createUser(userData);
    }
  }

  // User operations
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async createUser(user: Partial<User>): Promise<User> {
    const userData: any = {
      ...user,
      role: user.role || 'user',
      isActive: user.isActive ?? true,
      mfaEnabled: false,
      failedLoginAttempts: '0',
      emailVerified: user.emailVerified ?? false,
    };

    // Hash password if provided
    if (user.password) {
      userData.password = await PasswordUtils.hash(user.password);
    }

    const [newUser] = await db
      .insert(users)
      .values(userData)
      .returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<User>): Promise<User | undefined> {
    const updateData: any = { ...user, updatedAt: new Date() };

    // Hash password if being updated
    if (user.password) {
      updateData.password = await PasswordUtils.hash(user.password);
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  // OAuth operations
  async getOAuthAccount(provider: string, providerAccountId: string): Promise<OAuthAccount | undefined> {
    const [account] = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, provider as any),
          eq(oauthAccounts.providerAccountId, providerAccountId)
        )
      );
    return account;
  }

  async createOAuthAccount(account: InsertOAuthAccount): Promise<OAuthAccount> {
    const [newAccount] = await db
      .insert(oauthAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateOAuthAccount(id: string, account: Partial<OAuthAccount>): Promise<OAuthAccount | undefined> {
    const [updatedAccount] = await db
      .update(oauthAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(oauthAccounts.id, id))
      .returning();
    return updatedAccount;
  }

  async deleteOAuthAccount(id: string): Promise<boolean> {
    const result = await db
      .delete(oauthAccounts)
      .where(eq(oauthAccounts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Session operations
  async createSession(session: InsertUserSession): Promise<UserSession> {
    const [newSession] = await db
      .insert(userSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getSession(sessionToken: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionToken, sessionToken),
          eq(userSessions.isActive, true),
          gt(userSessions.expiresAt, new Date())
        )
      );
    return session;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true),
          gt(userSessions.expiresAt, new Date())
        )
      )
      .orderBy(desc(userSessions.lastAccessedAt));
  }

  async updateSession(id: string, session: Partial<UserSession>): Promise<UserSession | undefined> {
    const [updatedSession] = await db
      .update(userSessions)
      .set(session)
      .where(eq(userSessions.id, id))
      .returning();
    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteUserSessions(userId: string, excludeSessionId?: string): Promise<number> {
    const conditions = [eq(userSessions.userId, userId)];
    
    if (excludeSessionId) {
      conditions.push(eq(userSessions.id, excludeSessionId));
    }

    const result = await db
      .update(userSessions)
      .set({ isActive: false })
      .where(excludeSessionId ? and(...conditions) : eq(userSessions.userId, userId));
        
    return result.rowCount || 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await db
      .update(userSessions)
      .set({ isActive: false })
      .where(lt(userSessions.expiresAt, new Date()));
    return result.rowCount || 0;
  }

  // MFA operations
  async generateMfaSecret(): Promise<{ secret: string; qrCodeUrl: string }> {
    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');

    const secret = speakeasy.generateSecret({
      issuer: 'Pathfinder Platform',
      name: 'Pathfinder',
      length: 32,
    });

    const qrCodeUrl = await new Promise<string>((resolve, reject) => {
      qrcode.toDataURL(secret.otpauth_url, (err: any, dataUrl: string) => {
        if (err) reject(err);
        else resolve(dataUrl);
      });
    });

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  async enableMfa(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
    // Encrypt and hash backup codes
    const encryptedBackupCodes = backupCodes.map(code => 
      EncryptionUtils.encrypt(TokenUtils.hashBackupCode(code), this.encryptionKey)
    );

    const result = await db
      .update(users)
      .set({
        mfaEnabled: true,
        mfaSecret: EncryptionUtils.encrypt(secret, this.encryptionKey),
        backupCodes: encryptedBackupCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return (result.rowCount || 0) > 0;
  }

  async disableMfa(userId: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({
        mfaEnabled: false,
        mfaSecret: null,
        backupCodes: [],
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return (result.rowCount || 0) > 0;
  }

  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    const speakeasy = require('speakeasy');
    const decryptedSecret = EncryptionUtils.decrypt(user.mfaSecret, this.encryptionKey);

    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
  }

  async generateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = TokenUtils.generateBackupCodes(10);
    const encryptedBackupCodes = backupCodes.map(code => 
      EncryptionUtils.encrypt(TokenUtils.hashBackupCode(code), this.encryptionKey)
    );

    await db
      .update(users)
      .set({
        backupCodes: encryptedBackupCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return backupCodes;
  }

  async verifyAndUseBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
      return false;
    }

    const cleanCode = code.replace('-', '').toUpperCase();
    const hashedCode = TokenUtils.hashBackupCode(cleanCode);

    // Check if the code matches any backup code
    let matchIndex = -1;
    for (let i = 0; i < user.backupCodes.length; i++) {
      try {
        const decryptedHashedCode = EncryptionUtils.decrypt(user.backupCodes[i], this.encryptionKey);
        if (decryptedHashedCode === hashedCode) {
          matchIndex = i;
          break;
        }
      } catch (error) {
        // Skip invalid encrypted codes
        continue;
      }
    }

    if (matchIndex === -1) {
      return false;
    }

    // Remove the used backup code
    const updatedBackupCodes = [...user.backupCodes];
    updatedBackupCodes.splice(matchIndex, 1);

    await db
      .update(users)
      .set({
        backupCodes: updatedBackupCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true;
  }

  // Password operations
  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await PasswordUtils.hash(newPassword);
    
    const result = await db
      .update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: '0',
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return (result.rowCount || 0) > 0;
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const token = TokenUtils.generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return token;
  }

  async verifyPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.passwordResetToken, token),
          gt(users.passwordResetExpires, new Date())
        )
      );
    return user;
  }

  // Email verification
  async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = TokenUtils.generateSecureToken();

    await db
      .update(users)
      .set({
        emailVerificationToken: token,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return token;
  }

  async verifyEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));

    if (user) {
      // Mark email as verified and clear token
      await db
        .update(users)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return { ...user, emailVerified: true };
    }

    return undefined;
  }

  // JWT blacklist (stored in memory for simplicity, use Redis in production)
  private jwtBlacklist = new Map<string, Date>();

  async blacklistJwt(jti: string, expiresAt: Date): Promise<boolean> {
    this.jwtBlacklist.set(jti, expiresAt);
    return true;
  }

  async isJwtBlacklisted(jti: string): Promise<boolean> {
    const expiresAt = this.jwtBlacklist.get(jti);
    if (!expiresAt) return false;

    // Clean up expired tokens
    if (new Date() > expiresAt) {
      this.jwtBlacklist.delete(jti);
      return false;
    }

    return true;
  }

  // Security & Audit
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAuditLogs(userId?: string, action?: string, limit: number = 100): Promise<AuditLog[]> {
    const conditions = [];

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    return await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  // Admin operations
  async getUsers(filters?: { search?: string; role?: string; isActive?: boolean }): Promise<User[]> {
    const conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(users.email, `%${filters.search}%`),
          ilike(users.firstName, `%${filters.search}%`),
          ilike(users.lastName, `%${filters.search}%`)
        )!
      );
    }

    if (filters?.role) {
      conditions.push(eq(users.role, filters.role as any));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(users.isActive, filters.isActive));
    }

    return await db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));
  }

  async getUserStats(): Promise<{ total: number; active: number; mfaEnabled: number; }> {
    const allUsers = await db.select().from(users);
    
    return {
      total: allUsers.length,
      active: allUsers.filter(u => u.isActive).length,
      mfaEnabled: allUsers.filter(u => u.mfaEnabled).length,
    };
  }
}

export const storage = new AuthStorage();