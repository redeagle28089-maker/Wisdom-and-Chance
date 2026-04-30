import { users, userProviders, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";

// Normalize email to lowercase for consistent cross-platform matching.
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export interface ProviderInfo {
  provider: string;  // 'replit' | 'google' | 'mobile'
  providerSub: string; // stable, unique identifier from the provider
}

// Thrown when a provider identity (provider+sub) is already recorded against a
// different canonical user than the one the current login path resolved.
export class ProviderConflictError extends Error {
  constructor(
    public readonly provider: string,
    public readonly providerSub: string,
    public readonly existingUserId: string,
    public readonly attemptedUserId: string,
  ) {
    super(
      `Provider ${provider}:${providerSub} is already linked to account ${existingUserId}, ` +
      `cannot link to ${attemptedUserId}`
    );
    this.name = "ProviderConflictError";
  }
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser, providerInfo?: ProviderInfo): Promise<User>;
}

// Ensure the user_providers table exists. Safe to call on every startup —
// the CREATE TABLE IF NOT EXISTS is a no-op when the table already exists.
export async function ensureUserProvidersTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_providers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      provider VARCHAR NOT NULL,
      provider_sub VARCHAR NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_user_providers_provider_sub UNIQUE (provider, provider_sub)
    )
  `);
}

// Record a provider identity link for a canonical user.
// Throws ProviderConflictError if the provider+sub is already linked to a DIFFERENT user.
export async function upsertProviderLink(userId: string, providerInfo: ProviderInfo): Promise<void> {
  const [existing] = await db
    .select({ userId: userProviders.userId })
    .from(userProviders)
    .where(
      and(
        eq(userProviders.provider, providerInfo.provider),
        eq(userProviders.providerSub, providerInfo.providerSub)
      )
    );

  if (existing) {
    if (existing.userId !== userId) {
      throw new ProviderConflictError(
        providerInfo.provider,
        providerInfo.providerSub,
        existing.userId,
        userId
      );
    }
    return; // Already linked to the same user — no-op
  }

  await db.insert(userProviders).values({
    userId,
    provider: providerInfo.provider,
    providerSub: providerInfo.providerSub,
  });
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Looks up the canonical user by provider first, then by case-insensitive email,
  // then by id. Creates or updates the user record and always persists the provider link.
  // Throws ProviderConflictError when a provider sub is already bound to a different user.
  async upsertUser(userData: UpsertUser, providerInfo?: ProviderInfo): Promise<User> {
    const { id, ...rawProfileFields } = userData;

    // Normalize email before any DB operation so lookups and stored values
    // are always lowercase regardless of what the provider/client sends.
    const normalizedEmail = normalizeEmail(rawProfileFields.email);
    const profileFields = { ...rawProfileFields, email: normalizedEmail };

    // 1. Look up by provider+sub (most authoritative — avoids false email matches).
    if (providerInfo) {
      const [existingLink] = await db
        .select()
        .from(userProviders)
        .where(
          and(
            eq(userProviders.provider, providerInfo.provider),
            eq(userProviders.providerSub, providerInfo.providerSub)
          )
        );

      if (existingLink) {
        const [updated] = await db
          .update(users)
          .set({ ...profileFields, updatedAt: new Date() })
          .where(eq(users.id, existingLink.userId))
          .returning();
        console.log(
          `[auth:upsert] Returning user via provider link — userId=${updated.id} ` +
          `provider=${providerInfo.provider} sub=${providerInfo.providerSub}`
        );
        return updated;
      }
    }

    // 2. Look up by case-insensitive email (cross-platform linking + legacy email backfill).
    //    Using lower() in SQL so existing mixed-case emails in the DB are matched correctly.
    if (normalizedEmail) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`);

      if (existingByEmail) {
        const [updated] = await db
          .update(users)
          .set({ ...profileFields, updatedAt: new Date() })
          .where(eq(users.id, existingByEmail.id))
          .returning();

        if (providerInfo) {
          // Will throw ProviderConflictError if provider+sub is linked to a different user.
          await upsertProviderLink(updated.id, providerInfo);
          console.log(
            `[auth:upsert] Linked provider to existing email account — userId=${updated.id} ` +
            `email=${normalizedEmail} provider=${providerInfo.provider} sub=${providerInfo.providerSub}`
          );
        } else {
          console.log(
            `[auth:upsert] Updated existing account by email — userId=${updated.id} email=${normalizedEmail}`
          );
        }
        return updated;
      }
    }

    // 3. Look up by id (fallback for providers that pass their sub as the id).
    if (id) {
      const [existingById] = await db.select().from(users).where(eq(users.id, id));
      if (existingById) {
        const [updated] = await db
          .update(users)
          .set({ ...profileFields, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
        if (providerInfo) {
          await upsertProviderLink(updated.id, providerInfo);
        }
        console.log(
          `[auth:upsert] Updated existing account by id — userId=${id} email=${normalizedEmail ?? "none"}`
        );
        return updated;
      }
    }

    // 4. Create a new account.
    if (!normalizedEmail) {
      console.warn(
        `[auth:upsert] WARNING: Creating account without email — id=${id ?? "auto"}. ` +
        `Cross-platform linking will not be possible without an email address.`
      );
    }

    const [user] = await db
      .insert(users)
      .values({ ...profileFields, id: id ?? undefined })
      .returning();

    if (providerInfo) {
      await upsertProviderLink(user.id, providerInfo);
    }
    console.log(
      `[auth:upsert] Created new account — userId=${user.id} email=${user.email ?? "none"}` +
      (providerInfo ? ` provider=${providerInfo.provider} sub=${providerInfo.providerSub}` : "")
    );
    return user;
  }
}

export const authStorage = new AuthStorage();
