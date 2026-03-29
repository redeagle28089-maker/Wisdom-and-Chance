import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { playerCurrencies, playerCollection, ECONOMY_CONSTANTS, featureFlags, seasons, playerBattlePass, battlePassLevels, BATTLE_PASS_XP } from "@shared/schema";
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

    let [bp] = await db.select().from(playerBattlePass)
      .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
      .limit(1);

    if (!bp) {
      [bp] = await db.insert(playerBattlePass).values({
        userId,
        seasonId: season.id,
        currentXp: 0,
        currentLevel: 0,
        claimedLevels: "[]",
      }).onConflictDoNothing().returning();
      if (!bp) {
        [bp] = await db.select().from(playerBattlePass)
          .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
          .limit(1);
      }
      if (!bp) return;
    }

    const newXp = bp.currentXp + xpAmount;
    const allLevels = await db.select().from(battlePassLevels)
      .where(eq(battlePassLevels.seasonId, season.id));
    const sorted = allLevels.sort((a, b) => a.level - b.level);

    let newLevel = 0;
    let xpAccum = 0;
    for (const l of sorted) {
      xpAccum += l.xpRequired;
      if (newXp >= xpAccum) newLevel = l.level;
      else break;
    }

    await db.update(playerBattlePass)
      .set({ currentXp: newXp, currentLevel: newLevel, updatedAt: new Date() })
      .where(eq(playerBattlePass.id, bp.id));

    console.log(`[battlepass] Granted ${xpAmount} BP XP to ${userId}: ${reason} (now level ${newLevel})`);
  } catch (error) {
    console.error("[battlepass] Error granting XP:", error);
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
      }
    } else if (winnerId) {
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      await grantGold(winnerId, ECONOMY_CONSTANTS.REWARDS.WIN_GOLD, "match_win");
      await grantGold(loserId, ECONOMY_CONSTANTS.REWARDS.LOSS_GOLD, "match_loss");
      await grantBattlePassXP(winnerId, BATTLE_PASS_XP.MATCH_WIN, "match_win");
      await grantBattlePassXP(loserId, BATTLE_PASS_XP.MATCH_LOSS, "match_loss");
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
