import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedStarterDecks } from "./starter-decks";

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
        return res.status(400).json({ error: "Email is required" });
      }

      let [user] = await db.select().from(users).where(eq(users.email, email));

      if (!user) {
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            profileImageUrl: profileImageUrl || null,
          })
          .returning();
        user = newUser;
      } else {
        if (firstName || lastName || profileImageUrl) {
          const [updated] = await db
            .update(users)
            .set({
              ...(firstName && { firstName }),
              ...(lastName && { lastName }),
              ...(profileImageUrl && { profileImageUrl }),
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id))
            .returning();
          user = updated;
        }
      }

      try {
        await seedStarterDecks(user.id);
      } catch (error) {
        console.warn("[mobile-auth] Failed to seed starter decks:", error);
      }

      const token = generateToken({ userId: user.id, email: user.email || email });
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

    const [user] = await db.select().from(users).where(eq(users.id, mobileUser.userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    });
  });
}