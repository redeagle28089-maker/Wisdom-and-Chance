import { db } from "./db";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import { playerCurrencies, playerCollection, ECONOMY_CONSTANTS, featureFlags, seasons, playerBattlePass, battlePassLevels, BATTLE_PASS_XP, weeklyChallenges, playerWeeklyChallenges } from "@shared/schema";
import { storage } from "./storage";

async function isEconomyEnabled(): Promise<boolean> {
  const flag = await db.select().from(featureFlags).where(eq(featureFlags.key, "economy_enabled")).limit(1);
  return flag.length > 0 ? flag[0].enabled : false;
}

export async function ensureCurrencies(userId: string) {
  const existing = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(playerCurrencies).values({
      userId,
      gold: ECONOMY_CONSTANTS.STARTER_GOLD,
      gems: ECONOMY_CONSTANTS.STARTER_GEMS,
      dust: ECONOMY_CONSTANTS.STARTER_DUST,
      updatedAt: new Date(),
    });
    return { gold: ECONOMY_CONSTANTS.STARTER_GOLD, gems: ECONOMY_CONSTANTS.STARTER_GEMS, dust: ECONOMY_CONSTANTS.STARTER_DUST };
  }
  return { gold: existing[0].gold, gems: existing[0].gems, dust: existing[0].dust };
}

export async function grantGold(userId: string, amount: number, reason: string) {
  await ensureCurrencies(userId);
  await db.update(playerCurrencies)
    .set({ gold: sql`gold + ${amount}`, updatedAt: new Date() })
    .where(eq(playerCurrencies.userId, userId));
  console.log(`[economy] Granted ${amount} gold to ${userId}: ${reason}`);
}

export async function grantStarterCollection(userId: string) {
  const cur = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
  if (cur.length > 0 && cur[0].starterClaimed) return;

  const allCards = await storage.getCards();
  const starterCards = allCards.filter(c => ECONOMY_CONSTANTS.STARTER_COLLECTION_POWERS.includes(c.power));

  for (const c of starterCards) {
    await db.insert(playerCollection)
      .values({ userId, cardId: c.id, quantity: 2 })
      .onConflictDoUpdate({
        target: [playerCollection.userId, playerCollection.cardId],
        set: { quantity: sql`${playerCollection.quantity} + 2` },
      });
  }

  await db.update(playerCurrencies)
    .set({ starterClaimed: true })
    .where(eq(playerCurrencies.userId, userId));

  console.log(`[economy] Granted starter collection (${starterCards.length} cards x2) to ${userId}`);
}

export async function grantBattlePassXP(userId: string, xpAmount: number, reason: string) {
  try {
    const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
    if (!season) return;

    await db.transaction(async (tx) => {
      let [bp] = await tx.select().from(playerBattlePass)
        .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
        .limit(1);

      if (!bp) {
        [bp] = await tx.insert(playerBattlePass).values({
          userId,
          seasonId: season.id,
          currentXp: 0,
          currentLevel: 0,
          claimedLevels: "[]",
        }).onConflictDoNothing().returning();
        if (!bp) {
          [bp] = await tx.select().from(playerBattlePass)
            .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
            .limit(1);
        }
        if (!bp) return;
      }

      await tx.update(playerBattlePass)
        .set({ currentXp: sql`${playerBattlePass.currentXp} + ${xpAmount}`, updatedAt: new Date() })
        .where(eq(playerBattlePass.id, bp.id));

      const [updated] = await tx.select().from(playerBattlePass)
        .where(eq(playerBattlePass.id, bp.id)).limit(1);
      if (!updated) return;

      const allLevels = await tx.select().from(battlePassLevels)
        .where(eq(battlePassLevels.seasonId, season.id));
      const sorted = allLevels.sort((a, b) => a.level - b.level);

      let newLevel = 0;
      let xpAccum = 0;
      for (const l of sorted) {
        xpAccum += l.xpRequired;
        if (updated.currentXp >= xpAccum) newLevel = l.level;
        else break;
      }

      if (newLevel !== updated.currentLevel) {
        await tx.update(playerBattlePass)
          .set({ currentLevel: newLevel, updatedAt: new Date() })
          .where(eq(playerBattlePass.id, bp.id));
      }

      console.log(`[battlepass] Granted ${xpAmount} BP XP to ${userId}: ${reason} (now level ${newLevel})`);
    });
  } catch (error) {
    console.error("[battlepass] Error granting XP:", error);
  }
}

export async function updateWeeklyChallengeProgress(userId: string, challengeType: string, amount: number) {
  try {
    const now = new Date();
    const activeChallenges = await db.select().from(weeklyChallenges)
      .where(and(
        eq(weeklyChallenges.challengeType, challengeType),
        lte(weeklyChallenges.activeFrom, now),
        gte(weeklyChallenges.activeUntil, now)
      ));

    for (const challenge of activeChallenges) {
      let [progress] = await db.select().from(playerWeeklyChallenges)
        .where(and(
          eq(playerWeeklyChallenges.userId, userId),
          eq(playerWeeklyChallenges.challengeId, challenge.id)
        )).limit(1);

      if (!progress) {
        [progress] = await db.insert(playerWeeklyChallenges).values({
          userId,
          challengeId: challenge.id,
          progress: 0,
        }).onConflictDoNothing().returning();
        if (!progress) {
          [progress] = await db.select().from(playerWeeklyChallenges)
            .where(and(
              eq(playerWeeklyChallenges.userId, userId),
              eq(playerWeeklyChallenges.challengeId, challenge.id)
            )).limit(1);
        }
        if (!progress) continue;
      }

      if (progress.completedAt) continue;

      const newProgress = progress.progress + amount;
      const completed = newProgress >= challenge.requirement;

      await db.update(playerWeeklyChallenges)
        .set({
          progress: newProgress,
          ...(completed ? { completedAt: new Date() } : {}),
        })
        .where(eq(playerWeeklyChallenges.id, progress.id));
    }
  } catch (error) {
    console.error("[weekly-challenges] Error updating progress:", error);
  }
}

export async function openPackForUser(userId: string, packType: string) {
  try {
    const { PACK_TYPES } = await import("@shared/schema");
    const { playerCollection } = await import("@shared/schema");
    const packDef = PACK_TYPES[packType as keyof typeof PACK_TYPES];
    if (!packDef) return;
    const allCards = await storage.getCards();
    const filteredCards = allCards.filter(c => c.rarity);
    for (let ci = 0; ci < packDef.cardsPerPack; ci++) {
      const card = filteredCards[Math.floor(Math.random() * filteredCards.length)];
      if (card) {
        const [existing] = await db.select().from(playerCollection)
          .where(and(eq(playerCollection.userId, userId), eq(playerCollection.cardId, card.id)))
          .limit(1);
        if (existing) {
          await db.update(playerCollection)
            .set({ quantity: sql`quantity + 1` })
            .where(eq(playerCollection.id, existing.id));
        } else {
          await db.insert(playerCollection).values({ userId, cardId: card.id, quantity: 1 });
        }
      }
    }
    console.log(`[economy] Opened ${packType} pack for ${userId}`);
  } catch (error) {
    console.error("[economy] Error opening pack for user:", error);
  }
}

export async function handleGameEndRewards(winnerId: string | null, player1Id: string, player2Id: string | null, reason: string) {
  try {
    if (!player2Id) return;
    if (!(await isEconomyEnabled())) return;

    const isForfeit = ["forfeit", "player_forfeit", "disconnect_timeout", "opponent_forfeit"].includes(reason);

    if (isForfeit) {
      if (winnerId) {
        await grantGold(winnerId, ECONOMY_CONSTANTS.REWARDS.FORFEIT_WIN_GOLD, "opponent_forfeit");
        await grantBattlePassXP(winnerId, BATTLE_PASS_XP.MATCH_WIN, "match_forfeit_win");
        await updateWeeklyChallengeProgress(winnerId, "win_games", 1);
      }
    } else if (winnerId) {
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      await grantGold(winnerId, ECONOMY_CONSTANTS.REWARDS.WIN_GOLD, "match_win");
      await grantGold(loserId, ECONOMY_CONSTANTS.REWARDS.LOSS_GOLD, "match_loss");
      await grantBattlePassXP(winnerId, BATTLE_PASS_XP.MATCH_WIN, "match_win");
      await grantBattlePassXP(loserId, BATTLE_PASS_XP.MATCH_LOSS, "match_loss");
      await updateWeeklyChallengeProgress(winnerId, "win_games", 1);
    } else {
      await grantGold(player1Id, ECONOMY_CONSTANTS.REWARDS.DRAW_GOLD, "match_draw");
      await grantGold(player2Id, ECONOMY_CONSTANTS.REWARDS.DRAW_GOLD, "match_draw");
      await grantBattlePassXP(player1Id, BATTLE_PASS_XP.MATCH_LOSS, "match_draw");
      await grantBattlePassXP(player2Id, BATTLE_PASS_XP.MATCH_LOSS, "match_draw");
    }

  } catch (error) {
    console.error("[economy] Error granting game-end rewards:", error);
  }
}
