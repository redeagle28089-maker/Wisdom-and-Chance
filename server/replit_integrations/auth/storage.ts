import { users, userProviders, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, sql, count } from "drizzle-orm";

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

// Backfill provider links for legacy accounts that predate the user_providers table.
// Infers the provider from the user id format:
//   - id starts with 'google:' → provider='google', sub=id
//   - id is a UUID (mobile auto-generated) → provider='mobile', sub=email (skipped if no email)
//   - otherwise → provider='replit', sub=id
// Only inserts rows for users that have no provider link at all. Idempotent.
export async function backfillProviderLinks(): Promise<void> {
  const uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

  // Count users needing backfill per provider type first, for accurate logging.
  const [{ replitPending }] = await db
    .select({ replitPending: count() })
    .from(users)
    .where(
      sql`${users.id} NOT LIKE 'google:%'
        AND ${users.id} !~ ${uuidPattern}
        AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = ${users.id})`
    );

  const [{ googlePending }] = await db
    .select({ googlePending: count() })
    .from(users)
    .where(
      sql`${users.id} LIKE 'google:%'
        AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = ${users.id})`
    );

  const [{ mobilePending }] = await db
    .select({ mobilePending: count() })
    .from(users)
    .where(
      sql`${users.id} ~ ${uuidPattern}
        AND ${users.email} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = ${users.id})`
    );

  const total = replitPending + googlePending + mobilePending;
  if (total === 0) {
    console.log("[auth:backfill] No legacy accounts needed backfilling");
    return;
  }

  // Backfill Replit accounts (non-UUID, non-google: prefix)
  await db.execute(sql`
    INSERT INTO user_providers (id, user_id, provider, provider_sub)
    SELECT gen_random_uuid(), u.id, 'replit', u.id
    FROM users u
    WHERE u.id NOT LIKE 'google:%'
      AND u.id !~ ${uuidPattern}
      AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = u.id)
    ON CONFLICT (provider, provider_sub) DO NOTHING
  `);

  // Backfill Google accounts (id starts with 'google:')
  await db.execute(sql`
    INSERT INTO user_providers (id, user_id, provider, provider_sub)
    SELECT gen_random_uuid(), u.id, 'google', u.id
    FROM users u
    WHERE u.id LIKE 'google:%'
      AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = u.id)
    ON CONFLICT (provider, provider_sub) DO NOTHING
  `);

  // Backfill mobile accounts (UUID id) that have an email to use as the stable sub.
  await db.execute(sql`
    INSERT INTO user_providers (id, user_id, provider, provider_sub)
    SELECT gen_random_uuid(), u.id, 'mobile', lower(u.email)
    FROM users u
    WHERE u.id ~ ${uuidPattern}
      AND u.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = u.id)
    ON CONFLICT (provider, provider_sub) DO NOTHING
  `);

  console.log(
    `[auth:backfill] Backfilled provider links — replit=${replitPending} google=${googlePending} mobile=${mobilePending}`
  );

  // Report any UUID accounts without email that could not be backfilled.
  // These will have linkedProviders=[] until they log in via a tracked flow.
  const [{ uuidNoEmail }] = await db
    .select({ uuidNoEmail: count() })
    .from(users)
    .where(
      sql`${users.id} ~ ${uuidPattern}
        AND ${users.email} IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_providers up WHERE up.user_id = ${users.id})`
    );
  if (uuidNoEmail > 0) {
    console.warn(
      `[auth:backfill] ${uuidNoEmail} UUID account(s) with no email could not be backfilled — ` +
      `linkedProviders will be empty until they log in again`
    );
  }
}

// One-time migration: lowercase all existing email values in the users table.
// Safe to run on every startup — only touches rows where email != lower(email).
//
// Collision handling: if two separate user rows have emails that are equal when
// lowercased (e.g. "User@Example.com" vs "user@example.com"), the oldest account
// is kept as canonical.  Every FK and user-keyed economy reference is re-pointed
// from each duplicate to the canonical user, then the duplicate row is deleted —
// all inside a per-group transaction that rolls back atomically on any error.
// Groups that cannot be cleanly resolved are logged for manual review and excluded
// from the final blanket lowercase so startup is never aborted.
//
// Must be called before backfillProviderLinks so mobile provider_sub values
// (which use the email as the stable sub) are consistent.
export async function migrateEmailsToLowercase(): Promise<void> {
  // Quick early-exit: nothing to do if all emails are already lowercase.
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(users)
    .where(sql`email IS NOT NULL AND email != lower(email)`);

  if (pending === 0) {
    console.log("[auth:migrate-emails] All emails already lowercase — nothing to do");
    return;
  }

  // Find groups of users whose emails collide when lowercased.
  // array_agg ordered oldest-first → user_ids[0] is always the canonical account.
  const collisionResult = await db.execute(sql`
    SELECT lower(email) AS normalized_email,
           array_agg(id ORDER BY created_at ASC, id ASC) AS user_ids
    FROM users
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
  `);

  const collisionGroups = collisionResult.rows as Array<{
    normalized_email: string;
    user_ids: string[];
  }>;

  // Track normalized emails whose collision groups could NOT be resolved.
  // The blanket lowercase step excludes these to avoid unique-constraint violations.
  const unresolvedNormEmails = new Set<string>();
  let mergedDuplicates = 0;

  for (const group of collisionGroups) {
    const [canonicalId, ...duplicateIds] = group.user_ids;
    const normEmail = group.normalized_email;
    console.log(
      `[auth:migrate-emails] Merging collision group for '${normEmail}': ` +
      `canonical=${canonicalId} duplicates=[${duplicateIds.join(", ")}]`
    );

    try {
      // Wrap the entire group (all duplicates + canonical lowercase) in one
      // transaction so that any failure rolls back completely — no partial state.
      await db.transaction(async (tx) => {
        for (const dupId of duplicateIds) {
          // ── FK-constrained tables ─────────────────────────────────────────
          // user_providers — unique(provider, provider_sub): skip conflicting rows
          await tx.execute(sql`
            UPDATE user_providers SET user_id = ${canonicalId}
            WHERE user_id = ${dupId}
              AND NOT EXISTS (
                SELECT 1 FROM user_providers up2
                WHERE up2.user_id = ${canonicalId}
                  AND up2.provider = user_providers.provider
                  AND up2.provider_sub = user_providers.provider_sub
              )
          `);
          await tx.execute(sql`DELETE FROM user_providers WHERE user_id = ${dupId}`);

          // user_decks — plain re-point
          await tx.execute(sql`UPDATE user_decks SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // card_images — nullable created_by
          await tx.execute(sql`UPDATE card_images SET created_by = ${canonicalId} WHERE created_by = ${dupId}`);

          // friend_requests
          await tx.execute(sql`UPDATE friend_requests SET sender_id = ${canonicalId} WHERE sender_id = ${dupId}`);
          await tx.execute(sql`UPDATE friend_requests SET receiver_id = ${canonicalId} WHERE receiver_id = ${dupId}`);

          // friendships
          await tx.execute(sql`UPDATE friendships SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);
          await tx.execute(sql`UPDATE friendships SET friend_id = ${canonicalId} WHERE friend_id = ${dupId}`);

          // game_rooms
          await tx.execute(sql`UPDATE game_rooms SET host_id = ${canonicalId} WHERE host_id = ${dupId}`);
          await tx.execute(sql`UPDATE game_rooms SET guest_id = ${canonicalId} WHERE guest_id = ${dupId}`);

          // room_spectators
          await tx.execute(sql`UPDATE room_spectators SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // chat_messages
          await tx.execute(sql`UPDATE chat_messages SET sender_id = ${canonicalId} WHERE sender_id = ${dupId}`);

          // player_ratings — unique(user_id): drop dup's row when canonical already has one
          await tx.execute(sql`
            DELETE FROM player_ratings
            WHERE user_id = ${dupId}
              AND EXISTS (SELECT 1 FROM player_ratings WHERE user_id = ${canonicalId})
          `);
          await tx.execute(sql`UPDATE player_ratings SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // user_presence — unique(user_id)
          await tx.execute(sql`
            DELETE FROM user_presence
            WHERE user_id = ${dupId}
              AND EXISTS (SELECT 1 FROM user_presence WHERE user_id = ${canonicalId})
          `);
          await tx.execute(sql`UPDATE user_presence SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // matchmaking_queue — unique(user_id): dup row is transient, just delete
          await tx.execute(sql`DELETE FROM matchmaking_queue WHERE user_id = ${dupId}`);

          // player_achievements
          await tx.execute(sql`UPDATE player_achievements SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // player_challenges
          await tx.execute(sql`UPDATE player_challenges SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // player_stats — unique(user_id)
          await tx.execute(sql`
            DELETE FROM player_stats
            WHERE user_id = ${dupId}
              AND EXISTS (SELECT 1 FROM player_stats WHERE user_id = ${canonicalId})
          `);
          await tx.execute(sql`UPDATE player_stats SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // deck_codes — nullable creator_id
          await tx.execute(sql`UPDATE deck_codes SET creator_id = ${canonicalId} WHERE creator_id = ${dupId}`);

          // friend_messages
          await tx.execute(sql`UPDATE friend_messages SET sender_id = ${canonicalId} WHERE sender_id = ${dupId}`);
          await tx.execute(sql`UPDATE friend_messages SET receiver_id = ${canonicalId} WHERE receiver_id = ${dupId}`);

          // ── Economy tables (user_id stored as plain varchar, no FK) ─────────
          // player_currencies — primaryKey(user_id):
          //   - If canonical has no row: re-point dup's row so no data is lost.
          //   - If both rows exist: add dup's balances into canonical, then delete dup.
          await tx.execute(sql`
            UPDATE player_currencies SET user_id = ${canonicalId}
            WHERE user_id = ${dupId}
              AND NOT EXISTS (SELECT 1 FROM player_currencies WHERE user_id = ${canonicalId})
          `);
          await tx.execute(sql`
            UPDATE player_currencies
            SET gold          = gold          + (SELECT gold          FROM player_currencies WHERE user_id = ${dupId}),
                gems          = gems          + (SELECT gems          FROM player_currencies WHERE user_id = ${dupId}),
                dust          = dust          + (SELECT dust          FROM player_currencies WHERE user_id = ${dupId}),
                updated_at    = NOW()
            WHERE user_id = ${canonicalId}
              AND EXISTS (SELECT 1 FROM player_currencies WHERE user_id = ${dupId})
          `);
          await tx.execute(sql`DELETE FROM player_currencies WHERE user_id = ${dupId}`);

          // player_collection — unique(user_id, card_id): drop conflicting rows first
          await tx.execute(sql`
            DELETE FROM player_collection
            WHERE user_id = ${dupId}
              AND EXISTS (
                SELECT 1 FROM player_collection pc2
                WHERE pc2.user_id = ${canonicalId} AND pc2.card_id = player_collection.card_id
              )
          `);
          await tx.execute(sql`UPDATE player_collection SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // season_history — unique(user_id, season_id): drop conflicting rows first
          await tx.execute(sql`
            DELETE FROM season_history
            WHERE user_id = ${dupId}
              AND EXISTS (
                SELECT 1 FROM season_history sh2
                WHERE sh2.user_id = ${canonicalId} AND sh2.season_id = season_history.season_id
              )
          `);
          await tx.execute(sql`UPDATE season_history SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // player_battle_pass — unique(user_id, season_id): drop conflicting rows first
          await tx.execute(sql`
            DELETE FROM player_battle_pass
            WHERE user_id = ${dupId}
              AND EXISTS (
                SELECT 1 FROM player_battle_pass pb2
                WHERE pb2.user_id = ${canonicalId} AND pb2.season_id = player_battle_pass.season_id
              )
          `);
          await tx.execute(sql`UPDATE player_battle_pass SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // player_weekly_challenges — unique(user_id, challenge_id): drop conflicting rows first
          await tx.execute(sql`
            DELETE FROM player_weekly_challenges
            WHERE user_id = ${dupId}
              AND EXISTS (
                SELECT 1 FROM player_weekly_challenges pwc2
                WHERE pwc2.user_id = ${canonicalId} AND pwc2.challenge_id = player_weekly_challenges.challenge_id
              )
          `);
          await tx.execute(sql`UPDATE player_weekly_challenges SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // purchase_transactions — plain re-point (no unique on user_id)
          await tx.execute(sql`UPDATE purchase_transactions SET user_id = ${canonicalId} WHERE user_id = ${dupId}`);

          // ── Delete the duplicate user row ───────────────────────────────────
          await tx.execute(sql`DELETE FROM users WHERE id = ${dupId}`);
        }

        // Lowercase the canonical user's email inside the same transaction.
        await tx.execute(sql`
          UPDATE users SET email = ${normEmail}, updated_at = NOW() WHERE id = ${canonicalId}
        `);
      });

      mergedDuplicates += duplicateIds.length;
      console.log(
        `[auth:migrate-emails] Resolved collision for '${normEmail}' — ` +
        `deleted ${duplicateIds.length} duplicate(s), canonical=${canonicalId}`
      );
    } catch (err) {
      // The transaction was rolled back — DB is untouched for this group.
      // Record it so the blanket lowercase step skips it (avoiding unique violation).
      unresolvedNormEmails.add(normEmail);
      console.error(
        `[auth:migrate-emails] Could not resolve collision for '${normEmail}' ` +
        `(canonical=${canonicalId}, duplicates=[${duplicateIds.join(", ")}]): ${err}. ` +
        `Manual review required — skipping lowercase for this group.`
      );
    }
  }

  // Blanket lowercase for simple (non-collision) rows.
  // Explicitly exclude unresolved collision emails so we never hit unique violations.
  const [{ simpleCount }] = await db
    .select({ simpleCount: count() })
    .from(users)
    .where(sql`email IS NOT NULL AND email != lower(email)`);

  if (simpleCount > 0) {
    if (unresolvedNormEmails.size > 0) {
      // Build a safe exclusion: skip emails whose lowercase form is unresolved.
      // Parameterised array binding avoids SQL injection.
      const excluded = Array.from(unresolvedNormEmails);
      await db.execute(sql`
        UPDATE users
        SET email = lower(email), updated_at = NOW()
        WHERE email IS NOT NULL
          AND email != lower(email)
          AND lower(email) != ALL(${excluded})
      `);
    } else {
      await db.execute(sql`
        UPDATE users
        SET email = lower(email), updated_at = NOW()
        WHERE email IS NOT NULL AND email != lower(email)
      `);
    }
  }

  console.log(
    `[auth:migrate-emails] Done — lowercased ${simpleCount} simple row(s), ` +
    `merged ${mergedDuplicates} duplicate(s) across ${collisionGroups.length} collision group(s)` +
    (unresolvedNormEmails.size > 0
      ? `, ${unresolvedNormEmails.size} group(s) unresolved (see above errors)`
      : "")
  );

  // Post-migration verification: count any emails that are still not lowercase.
  // Should always be 0 unless there are unresolved collision groups.
  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(users)
    .where(sql`email IS NOT NULL AND email != lower(email)`);
  if (remaining > 0) {
    console.warn(
      `[auth:migrate-emails] WARNING: ${remaining} email(s) still not lowercase ` +
      `(${unresolvedNormEmails.size} unresolved collision group(s) excluded). Manual review required.`
    );
  } else {
    console.log("[auth:migrate-emails] Verification passed — all stored emails are now lowercase");
  }
}

// Return the list of provider names linked to a given user (e.g. ["mobile", "google"]).
export async function getLinkedProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ provider: userProviders.provider })
    .from(userProviders)
    .where(eq(userProviders.userId, userId));
  return rows.map((r) => r.provider);
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
