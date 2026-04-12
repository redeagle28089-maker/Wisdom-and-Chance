import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { id, ...profileFields } = userData;

    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0) {
        const [updated] = await db
          .update(users)
          .set({ ...profileFields, updatedAt: new Date() })
          .where(eq(users.email, userData.email))
          .returning();
        return updated;
      }
    }

    if (id) {
      const existingById = await db.select().from(users).where(eq(users.id, id));
      if (existingById.length > 0) {
        const [updated] = await db
          .update(users)
          .set({ ...profileFields, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
        return updated;
      }
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
