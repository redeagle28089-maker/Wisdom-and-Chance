import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET;

export interface UnifiedUser {
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

function verifyJWT(token: string): { userId: string; email: string } | null {
  if (!JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export const isUnifiedAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyJWT(token);
    if (payload) {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
        if (user) {
          (req as any).user = {
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
            },
          } as UnifiedUser;
          return next();
        }
      } catch {}
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  return res.status(401).json({ message: "Unauthorized" });
};
