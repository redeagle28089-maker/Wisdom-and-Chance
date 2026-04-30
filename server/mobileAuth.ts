import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { seedStarterDecks } from "./starter-decks";
import { authStorage, ProviderConflictError, getLinkedProviders } from "./replit_integrations/auth";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.warn("[mobile-auth] WARNING: SESSION_SECRET not set. Mobile auth will be unavailable.");
}
const JWT_EXPIRY = "7d";

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string | null {
  if (!JWT_SECRET) return null;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): JWTPayload | null {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function isMobileAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  (req as any).mobileUser = payload;
  next();
}

export function registerMobileAuthRoutes(app: Express) {
  app.post("/api/mobile/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, provider, providerToken, firstName, lastName, profileImageUrl } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required — email is needed for cross-platform account linking" });
      }

      // Normalize email to lowercase for consistent cross-platform matching.
      // This also handles legacy accounts that were stored with mixed-case emails.
      const normalizedEmail: string = email.trim().toLowerCase();

      // Delegate user lookup, creation, update, and provider linking to the shared
      // authStorage.upsertUser() so all account logic lives in one place.
      // Resolution order (inherited from upsertUser): provider link first, then
      // case-insensitive email, then create. This matches web auth precedence and
      // is intentionally different from the old mobile-only path (email-first).
      let user;
      try {
        user = await authStorage.upsertUser(
          {
            email: normalizedEmail,
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(profileImageUrl ? { profileImageUrl } : {}),
          },
          { provider: "mobile", providerSub: normalizedEmail }
        );
      } catch (upsertError) {
        if (upsertError instanceof ProviderConflictError) {
          console.error("[mobile-auth:login] Provider link conflict:", upsertError.message);
          return res.status(409).json({
            error: "This email is already linked to a different account. Please contact support.",
          });
        }
        throw upsertError;
      }

      try {
        await seedStarterDecks(user.id);
      } catch (error) {
        console.warn("[mobile-auth] Failed to seed starter decks:", error);
      }

      try {
        const { ensureCurrencies, grantStarterCollection } = await import("./economyService");
        await ensureCurrencies(user.id);
        await grantStarterCollection(user.id);
      } catch (error) {
        console.warn("[mobile-auth] Failed to grant starter economy:", error);
      }

      const token = generateToken({ userId: user.id, email: user.email || normalizedEmail });
      if (!token) {
        return res.status(503).json({ error: "Mobile auth is not configured" });
      }

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
      });
    } catch (error: any) {
      console.error("[mobile-auth] Login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/mobile/auth/refresh", isMobileAuthenticated, async (req: Request, res: Response) => {
    const mobileUser = (req as any).mobileUser as JWTPayload;
    const token = generateToken({ userId: mobileUser.userId, email: mobileUser.email });
    if (!token) {
      return res.status(503).json({ error: "Mobile auth is not configured" });
    }
    res.json({ token });
  });

  app.get("/api/mobile/auth/me", isMobileAuthenticated, async (req: Request, res: Response) => {
    const mobileUser = (req as any).mobileUser as JWTPayload;

    try {
      const user = await authStorage.getUser(mobileUser.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const linkedProviders = await getLinkedProviders(user.id);

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        linkedProviders,
      });
    } catch (error: any) {
      console.error("[mobile-auth] Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
