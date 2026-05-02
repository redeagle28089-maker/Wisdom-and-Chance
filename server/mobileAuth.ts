import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { seedStarterDecks } from "./starter-decks";
import { authStorage, ProviderConflictError, getLinkedProviders } from "./replit_integrations/auth";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.warn("[mobile-auth] WARNING: SESSION_SECRET not set. Mobile auth will be unavailable.");
}
const JWT_EXPIRY = "7d";

// Emails that must NEVER be obtainable via the unverified mobile-login endpoint.
// The mobile login flow is "claim any email and we'll mint you a JWT for it" —
// fine for normal accounts, catastrophic for the admin account. Anyone who
// guesses the admin email could otherwise become admin.
//
// The base list is the hardcoded admin email; additional emails can be added
// at deploy time via PROTECTED_LOGIN_EMAILS (comma-separated).
const HARDCODED_ADMIN_EMAIL = "redeagle28089@gmail.com";
const PROTECTED_LOGIN_EMAILS: ReadonlySet<string> = new Set(
  [
    HARDCODED_ADMIN_EMAIL,
    ...(process.env.PROTECTED_LOGIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ].map((e) => e.toLowerCase()),
);

// Enforced unconditionally in production. In development, allow protected-email
// mobile login so the admin smoke tests (test-ai-generator.mjs,
// test-multiplayer-hardening.mjs) keep working without a backdoor secret.
// Set ENFORCE_PROTECTED_LOGIN=1 to enforce in dev too.
function isProtectedEmailBlocked(normalizedEmail: string): boolean {
  if (!PROTECTED_LOGIN_EMAILS.has(normalizedEmail)) return false;
  if (process.env.ENFORCE_PROTECTED_LOGIN === "1") return true;
  return process.env.NODE_ENV === "production";
}

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
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("[mobile-auth] Auth rejected: missing or malformed Authorization header");
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
      console.warn("[mobile-auth] Auth rejected: invalid or expired token");
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    (req as any).mobileUser = payload;
    next();
  } catch (error: any) {
    console.error("[mobile-auth] Authentication middleware error:", error);
    res.status(500).json({ error: "Authentication check failed" });
  }
}

export function registerMobileAuthRoutes(app: Express) {
  app.post("/api/mobile/auth/login", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const { email, firstName, lastName, profileImageUrl } = body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required — email is needed for cross-platform account linking" });
      }

      // Normalize email to lowercase for consistent cross-platform matching.
      // This also handles legacy accounts that were stored with mixed-case emails.
      const normalizedEmail: string = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ error: "Email is required — email is needed for cross-platform account linking" });
      }

      // Reject login attempts for protected (admin) emails. The mobile endpoint
      // does not verify email ownership, so without this gate anyone could
      // sign in as admin by sending the admin's email address.
      if (isProtectedEmailBlocked(normalizedEmail)) {
        console.warn(`[mobile-auth] Blocked protected-email login attempt for ${normalizedEmail}`);
        return res.status(403).json({
          error: "This account must sign in through a verified provider (Replit or Google). Mobile email login is not allowed for this account.",
        });
      }

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
            ...(typeof firstName === "string" ? { firstName } : {}),
            ...(typeof lastName === "string" ? { lastName } : {}),
            ...(typeof profileImageUrl === "string" ? { profileImageUrl } : {}),
          },
          { provider: "mobile", providerSub: normalizedEmail }
        );
      } catch (upsertError) {
        if (upsertError instanceof ProviderConflictError) {
          console.error("[mobile-auth] Provider link conflict on login:", upsertError.message);
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
        console.error("[mobile-auth] Cannot issue login token: SESSION_SECRET not configured");
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
    try {
      const mobileUser = (req as any).mobileUser as JWTPayload | undefined;
      if (!mobileUser) {
        console.error("[mobile-auth] Refresh called without authenticated mobile user");
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Defense in depth: even if a protected-email JWT was issued before this
      // hardening (or via a misconfigured environment), refuse to refresh it
      // so the token cannot be kept alive indefinitely.
      const refreshEmail = (mobileUser.email ?? "").trim().toLowerCase();
      if (isProtectedEmailBlocked(refreshEmail)) {
        console.warn(`[mobile-auth] Blocked refresh for protected-email token: ${refreshEmail}`);
        return res.status(403).json({
          error: "This account cannot use mobile token refresh. Sign in through a verified provider.",
        });
      }

      const token = generateToken({ userId: mobileUser.userId, email: mobileUser.email });
      if (!token) {
        console.error("[mobile-auth] Cannot refresh token: SESSION_SECRET not configured");
        return res.status(503).json({ error: "Mobile auth is not configured" });
      }
      res.json({ token });
    } catch (error: any) {
      console.error("[mobile-auth] Token refresh error:", error);
      res.status(500).json({ error: "Token refresh failed" });
    }
  });

  app.get("/api/mobile/auth/me", isMobileAuthenticated, async (req: Request, res: Response) => {
    try {
      const mobileUser = (req as any).mobileUser as JWTPayload | undefined;
      if (!mobileUser) {
        console.error("[mobile-auth] Profile fetch called without authenticated mobile user");
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const user = await authStorage.getUser(mobileUser.userId);
      if (!user) {
        console.warn("[mobile-auth] Profile fetch: user not found for id", mobileUser.userId);
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
