import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { issueSession, verifyAccess, verifyRefresh, rotateRefresh, revokeAllForSid } from "../config/jwt";
import type { JwtUser } from "../config/jwt";

const router = Router();

// Middleware to extract access token from cookies or headers
function extractAccessToken(req: Request): string | null {
  // Try cookie first (preferred for web apps)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  
  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

// Middleware to extract refresh token from cookies
function extractRefreshToken(req: Request): string | null {
  return req.cookies?.refreshToken || null;
}

// JWT middleware to verify access tokens
export function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  try {
    const payload = verifyAccess(token);
    (req as any).jwtUser = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

// Development-only login endpoint (for testing without Replit auth)
if (process.env.NODE_ENV === 'development') {
  router.post('/login', (req: Request, res: Response) => {
    try {
      const { email, name } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user: JwtUser = {
        id: email, // Use email as ID for dev
        email,
        name: name || email
      };
      
      const { accessToken, refreshToken } = issueSession(user);
      
      // Set HTTP-only cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });
      
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      res.json({
        message: "Login successful",
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
}

// Mint JWT tokens from Replit session
router.post('/mint-from-session', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!req.isAuthenticated() || !user) {
      return res.status(401).json({ message: "Not authenticated with Replit" });
    }
    
    const jwtUser: JwtUser = {
      id: user.claims.sub,
      email: user.claims.email,
      name: user.claims.name || user.claims.preferred_username
    };
    
    const { accessToken, refreshToken } = issueSession(jwtUser);
    
    // Set HTTP-only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({
      message: "JWT tokens issued successfully",
      user: { id: jwtUser.id, email: jwtUser.email, name: jwtUser.name }
    });
  } catch (error) {
    console.error("Mint from session error:", error);
    res.status(500).json({ message: "Failed to mint tokens" });
  }
});

// Refresh access token using refresh token
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const refreshToken = extractRefreshToken(req);
    
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }
    
    const payload = verifyRefresh(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = rotateRefresh(
      payload.jti,
      payload.uid,
      payload.sid
    );
    
    // Set new cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({ message: "Tokens refreshed successfully" });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// Get current session info (using JWT)
router.get('/session', jwtAuth, (req: Request, res: Response) => {
  try {
    const jwtUser = (req as any).jwtUser;
    res.json({
      user: { id: jwtUser.id, email: jwtUser.email, name: jwtUser.name },
      sessionId: jwtUser.sid
    });
  } catch (error) {
    console.error("Session error:", error);
    res.status(500).json({ message: "Failed to get session info" });
  }
});

// Logout (revoke refresh tokens)
router.post('/logout', (req: Request, res: Response) => {
  try {
    const refreshToken = extractRefreshToken(req);
    
    if (refreshToken) {
      try {
        const payload = verifyRefresh(refreshToken);
        revokeAllForSid(payload.uid, payload.sid);
      } catch (error) {
        // Ignore invalid refresh token during logout
      }
    }
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
});

// GET logout for browser redirects
router.get('/logout', (req: Request, res: Response) => {
  try {
    const refreshToken = extractRefreshToken(req);
    
    if (refreshToken) {
      try {
        const payload = verifyRefresh(refreshToken);
        revokeAllForSid(payload.uid, payload.sid);
      } catch (error) {
        // Ignore invalid refresh token during logout
      }
    }
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    // Redirect to home or login page
    res.redirect('/');
  } catch (error) {
    console.error("Logout error:", error);
    res.redirect('/');
  }
});

export default router;