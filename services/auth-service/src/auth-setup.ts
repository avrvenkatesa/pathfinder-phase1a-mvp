import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";
import session from "express-session";
import speakeasy from "speakeasy";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { PasswordUtils, AuditUtils, LockoutUtils } from "../../../shared/utils/auth-utils";
import type { User } from "../../../shared/types/schema";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Configure passport for user serialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy (Email/Password)
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true,
}, async (req, email: string, password: string, done) => {
  try {
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      // Audit failed login attempt
      await storage.createAuditLog(AuditUtils.createAuditLog({
        action: 'login_failed',
        resource: 'user',
        details: { email, reason: 'user_not_found' },
        ipAddress: AuditUtils.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'User not found',
      }));
      
      return done(null, false, { message: 'Invalid email or password' });
    }

    // Check if account is locked
    if (LockoutUtils.isAccountLocked(user.lockedUntil)) {
      const remainingTime = LockoutUtils.getRemainingLockoutTime(user.lockedUntil!);
      const minutesRemaining = Math.ceil(remainingTime / (1000 * 60));
      
      await storage.createAuditLog(AuditUtils.createAuditLog({
        userId: user.id,
        action: 'login_blocked',
        resource: 'user',
        details: { email, reason: 'account_locked', remainingMinutes: minutesRemaining },
        ipAddress: AuditUtils.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'Account locked',
      }));
      
      return done(null, false, { 
        message: `Account locked. Try again in ${minutesRemaining} minute(s).` 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await storage.createAuditLog(AuditUtils.createAuditLog({
        userId: user.id,
        action: 'login_blocked',
        resource: 'user',
        details: { email, reason: 'account_inactive' },
        ipAddress: AuditUtils.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'Account inactive',
      }));
      
      return done(null, false, { message: 'Account is inactive' });
    }

    // Verify password
    if (!user.password || !(await PasswordUtils.verify(password, user.password))) {
      // Increment failed login attempts
      const failedAttempts = parseInt(user.failedLoginAttempts || '0') + 1;
      const shouldLock = LockoutUtils.shouldLockAccount(failedAttempts);
      
      await storage.updateUser(user.id, {
        failedLoginAttempts: failedAttempts.toString(),
        lockedUntil: shouldLock ? LockoutUtils.calculateLockoutExpiry() : null,
      });

      await storage.createAuditLog(AuditUtils.createAuditLog({
        userId: user.id,
        action: 'login_failed',
        resource: 'user',
        details: { 
          email, 
          reason: 'invalid_password', 
          failedAttempts, 
          accountLocked: shouldLock 
        },
        ipAddress: AuditUtils.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'Invalid password',
      }));
      
      const message = shouldLock 
        ? 'Too many failed attempts. Account has been locked for 30 minutes.'
        : 'Invalid email or password';
      
      return done(null, false, { message });
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      const mfaCode = req.body.mfaCode;
      
      if (!mfaCode) {
        return done(null, false, { message: 'MFA code required', requiresMfa: true, userId: user.id });
      }

      // Verify MFA code
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: mfaCode,
        window: 2, // Allow 2 time steps before and after
      });

      if (!verified) {
        // Check if it's a backup code
        const backupCodeValid = await storage.verifyAndUseBackupCode(user.id, mfaCode);
        
        if (!backupCodeValid) {
          await storage.createAuditLog(AuditUtils.createAuditLog({
            userId: user.id,
            action: 'mfa_failed',
            resource: 'user',
            details: { email, reason: 'invalid_mfa_code' },
            ipAddress: AuditUtils.getClientIP(req),
            userAgent: req.get('User-Agent'),
            success: false,
            errorMessage: 'Invalid MFA code',
          }));
          
          return done(null, false, { message: 'Invalid MFA code' });
        }

        await storage.createAuditLog(AuditUtils.createAuditLog({
          userId: user.id,
          action: 'backup_code_used',
          resource: 'user',
          details: { email },
          ipAddress: AuditUtils.getClientIP(req),
          userAgent: req.get('User-Agent'),
          success: true,
        }));
      }
    }

    // Successful login - reset failed attempts and update last login
    await storage.updateUser(user.id, {
      failedLoginAttempts: '0',
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    await storage.createAuditLog(AuditUtils.createAuditLog({
      userId: user.id,
      action: 'login_success',
      resource: 'user',
      details: { email, mfaUsed: user.mfaEnabled },
      ipAddress: AuditUtils.getClientIP(req),
      userAgent: req.get('User-Agent'),
      success: true,
    }));

    return done(null, user);
  } catch (error) {
    console.error('Login error:', error);
    return done(error);
  }
}));

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists by Google ID
      let oauthAccount = await storage.getOAuthAccount('google', profile.id);
      let user: User;

      if (oauthAccount) {
        user = await storage.getUserById(oauthAccount.userId);
        
        // Update OAuth account tokens
        await storage.updateOAuthAccount(oauthAccount.id, {
          accessToken,
          refreshToken,
          expiresAt: accessToken ? new Date(Date.now() + 3600000) : null, // 1 hour
        });
      } else {
        // Check if user exists by email
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email provided by Google'));
        }

        let existingUser = await storage.getUserByEmail(email);

        if (existingUser) {
          // Link Google account to existing user
          user = existingUser;
          await storage.createOAuthAccount({
            userId: user.id,
            provider: 'google',
            providerAccountId: profile.id,
            accessToken,
            refreshToken,
            expiresAt: accessToken ? new Date(Date.now() + 3600000) : null,
          });
        } else {
          // Create new user
          user = await storage.createUser({
            email,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            profileImageUrl: profile.photos?.[0]?.value,
            emailVerified: true, // Google emails are pre-verified
            role: 'user',
          });

          // Create OAuth account
          await storage.createOAuthAccount({
            userId: user.id,
            provider: 'google',
            providerAccountId: profile.id,
            accessToken,
            refreshToken,
            expiresAt: accessToken ? new Date(Date.now() + 3600000) : null,
          });

          await storage.createAuditLog(AuditUtils.createAuditLog({
            userId: user.id,
            action: 'user_created',
            resource: 'user',
            details: { email, provider: 'google', firstName: user.firstName, lastName: user.lastName },
            success: true,
          }));
        }
      }

      await storage.createAuditLog(AuditUtils.createAuditLog({
        userId: user.id,
        action: 'oauth_login',
        resource: 'user',
        details: { email: user.email, provider: 'google' },
        success: true,
      }));

      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error);
    }
  }));
}

// Microsoft OAuth Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: '/api/auth/microsoft/callback',
    scope: ['user.read'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists by Microsoft ID
      let oauthAccount = await storage.getOAuthAccount('microsoft', profile.id);
      let user: User;

      if (oauthAccount) {
        user = await storage.getUserById(oauthAccount.userId);
        
        // Update OAuth account tokens
        await storage.updateOAuthAccount(oauthAccount.id, {
          accessToken,
          refreshToken,
          expiresAt: accessToken ? new Date(Date.now() + 3600000) : null,
        });
      } else {
        // Check if user exists by email
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email provided by Microsoft'));
        }

        let existingUser = await storage.getUserByEmail(email);

        if (existingUser) {
          // Link Microsoft account to existing user
          user = existingUser;
          await storage.createOAuthAccount({
            userId: user.id,
            provider: 'microsoft',
            providerAccountId: profile.id,
            accessToken,
            refreshToken,
            expiresAt: accessToken ? new Date(Date.now() + 3600000) : null,
          });
        } else {
          // Create new user
          user = await storage.createUser({
            email,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            profileImageUrl: profile.photos?.[0]?.value,
            emailVerified: true, // Microsoft emails are pre-verified
            role: 'user',
          });

          // Create OAuth account
          await storage.createOAuthAccount({
            userId: user.id,
            provider: 'microsoft',
            providerAccountId: profile.id,
            accessToken,
            refreshToken,
            expiresAt: accessToken ? new Date(Date.now() + 3600000) : null,
          });

          await storage.createAuditLog(AuditUtils.createAuditLog({
            userId: user.id,
            action: 'user_created',
            resource: 'user',
            details: { email, provider: 'microsoft', firstName: user.firstName, lastName: user.lastName },
            success: true,
          }));
        }
      }

      await storage.createAuditLog(AuditUtils.createAuditLog({
        userId: user.id,
        action: 'oauth_login',
        resource: 'user',
        details: { email: user.email, provider: 'microsoft' },
        success: true,
      }));

      return done(null, user);
    } catch (error) {
      console.error('Microsoft OAuth error:', error);
      return done(error);
    }
  }));
}

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
  passReqToCallback: true,
}, async (req, payload, done) => {
  try {
    const user = await storage.getUserById(payload.sub);
    
    if (!user || !user.isActive) {
      return done(null, false);
    }

    // Check if JWT is blacklisted (for logout functionality)
    const isBlacklisted = await storage.isJwtBlacklisted(payload.jti);
    if (isBlacklisted) {
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        config,
        client_id: process.env.REPL_ID!,
        redirect_uri: `https://${domain}/api/auth/callback`,
        response_types: ["code"],
        scope: "openid profile email",
      },
      verify
    );

    passport.use(domain, strategy);
  }

  // Legacy Replit auth routes (keeping for compatibility)
  app.get("/api/auth/login", (req, res, next) => {
    const host = req.get("host");
    if (!host || !process.env.REPLIT_DOMAINS!.split(",").includes(host)) {
      return res.status(400).json({ error: "Invalid host" });
    }
    passport.authenticate(host)(req, res, next);
  });

  app.get("/api/auth/callback", (req, res, next) => {
    const host = req.get("host");
    if (!host || !process.env.REPLIT_DOMAINS!.split(",").includes(host)) {
      return res.status(400).json({ error: "Invalid host" });
    }
    passport.authenticate(host, { 
      successRedirect: "/", 
      failureRedirect: "/login" 
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      req.session.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ error: "Session destruction failed" });
        }
        res.json({ success: true, message: "Logged out successfully" });
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};