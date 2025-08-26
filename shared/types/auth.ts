import { z } from 'zod';

// Authentication request schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  mfaCode: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// MFA schemas
export const setupMfaSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const verifyMfaSetupSchema = z.object({
  token: z.string().length(6, 'MFA code must be 6 digits'),
  backupCodes: z.array(z.string()).optional(),
});

export const verifyMfaSchema = z.object({
  code: z.string().min(1, 'MFA code is required'),
});

export const disableMfaSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().length(6, 'MFA code must be 6 digits'),
});

// Session management schemas
export const sessionSchema = z.object({
  sessionId: z.string(),
});

// OAuth schemas
export const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// Type exports
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type SetupMfaRequest = z.infer<typeof setupMfaSchema>;
export type VerifyMfaSetupRequest = z.infer<typeof verifyMfaSetupSchema>;
export type VerifyMfaRequest = z.infer<typeof verifyMfaSchema>;
export type DisableMfaRequest = z.infer<typeof disableMfaSchema>;
export type SessionRequest = z.infer<typeof sessionSchema>;
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackSchema>;

// Authentication response types
export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    mfaEnabled: boolean;
    emailVerified: boolean;
  };
  requiresMfa?: boolean;
  sessionId?: string;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

export interface MfaSetupResponse {
  success: boolean;
  qrCode?: string;
  secret?: string;
  backupCodes?: string[];
  message?: string;
  error?: string;
}

export interface SessionInfo {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastAccessed: string;
  isCurrentSession: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
  profileImageUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  oauthAccounts: Array<{
    provider: string;
    providerAccountId: string;
    createdAt: string;
  }>;
  activeSessions: SessionInfo[];
}

// Permission constants
export const PERMISSIONS = {
  // User management
  'users.view': 'View users',
  'users.create': 'Create users', 
  'users.edit': 'Edit users',
  'users.delete': 'Delete users',
  'users.manage_roles': 'Manage user roles',
  
  // Contact management
  'contacts.view': 'View contacts',
  'contacts.create': 'Create contacts',
  'contacts.edit': 'Edit contacts',
  'contacts.delete': 'Delete contacts',
  'contacts.export': 'Export contacts',
  'contacts.import': 'Import contacts',
  
  // Workflow management
  'workflows.view': 'View workflows',
  'workflows.create': 'Create workflows',
  'workflows.edit': 'Edit workflows',
  'workflows.delete': 'Delete workflows',
  'workflows.execute': 'Execute workflows',
  'workflows.manage_templates': 'Manage workflow templates',
  
  // System administration
  'system.view_audit_logs': 'View audit logs',
  'system.manage_settings': 'Manage system settings',
  'system.view_analytics': 'View system analytics',
} as const;

// Default role permissions
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS),
  manager: [
    'users.view',
    'users.edit',
    'contacts.view',
    'contacts.create',
    'contacts.edit',
    'contacts.delete',
    'contacts.export',
    'contacts.import',
    'workflows.view',
    'workflows.create',
    'workflows.edit',
    'workflows.delete',
    'workflows.execute',
    'workflows.manage_templates',
    'system.view_analytics',
  ],
  user: [
    'contacts.view',
    'contacts.create',
    'contacts.edit',
    'workflows.view',
    'workflows.create',
    'workflows.edit',
    'workflows.execute',
  ],
  viewer: [
    'contacts.view',
    'workflows.view',
  ],
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type UserRole = keyof typeof DEFAULT_ROLE_PERMISSIONS;