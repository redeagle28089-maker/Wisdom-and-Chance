import type { Express, Request, Response } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { users, userProviders } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

// Typed intersection for a request that may carry Passport session or mobile JWT data.
type SessionOrTokenRequest = Request & {
  isAuthenticated?: () => boolean;
  user?: { claims?: { sub?: string }; expires_at?: number };
};

// Typed intersection for a request known to carry valid Passport session data.
type AuthenticatedSessionRequest = Request & {
  user: { claims: { sub: string } };
};

// Resolve the canonical user id from either a web session or a mobile JWT Bearer token.
// Returns null if the request is not authenticated.
async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Web session (Passport)
  const sessionReq = req as SessionOrTokenRequest;
  if (sessionReq.isAuthenticated?.()) {
    const sub = sessionReq.user?.claims?.sub;
    if (sub) return sub;
  }

  // 2. Mobile JWT Bearer token — handled inline to avoid Express middleware ordering
  //    issues (the JWT middleware in routes.ts runs after auth routes are registered).
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const secret = process.env.SESSION_SECRET;
    if (secret && token) {
      try {
        const payload = jwt.verify(token, secret) as { userId?: string };
        if (payload?.userId) return payload.userId;
      } catch {
        // invalid / expired token — fall through to null
      }
    }
  }

  return null;
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user (web session only)
  app.get("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const authedReq = req as AuthenticatedSessionRequest;
      const userId = authedReq.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Shared identity check — usable by both web (session cookie) and mobile (Bearer JWT).
  // Returns the canonical user id, email, and which providers are stored in the
  // user_providers table for this account. Useful for verifying cross-platform linking
  // and confirming both platforms resolve to the same underlying account.
  app.get("/api/auth/identity", async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Fetch all provider links stored for this user.
      const providerLinks = await db
        .select({ provider: userProviders.provider, providerSub: userProviders.providerSub })
        .from(userProviders)
        .where(eq(userProviders.userId, userId));

      const linkedProviders = providerLinks.map((p) => p.provider);

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        linkedProviders,
        providerDetails: providerLinks,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error("[auth:identity] Error:", error);
      res.status(500).json({ message: "Failed to fetch identity" });
    }
  });
}
