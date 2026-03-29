import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { playerCurrencies, playerCollection, ECONOMY_CONSTANTS, featureFlags } from "@shared/schema";
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

export async function handleGameEndRewards(winnerId: string | null, player1Id: string, player2Id: string | null, reason: string) {
  try {
    if (!player2Id) return;
    if (!(await isEconomyEnabled())) return;

    const isForfeit = ["forfeit", "player_forfeit", "disconnect_timeout", "opponent_forfeit"].includes(reason);

    if (isForfeit) {
      if (winnerId) await grantGold(winnerId, ECONOMY_CONSTANTS.REWARDS.FORFEIT_WIN_GOLD, "opponent_forfeit");
    } else if (winnerId) {
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      await grantGold(winnerId, ECONOMY_CONSTANTS.REWARDS.WIN_GOLD, "match_win");
      await grantGold(loserId, ECONOMY_CONSTANTS.REWARDS.LOSS_GOLD, "match_loss");
    } else {
      await grantGold(player1Id, ECONOMY_CONSTANTS.REWARDS.DRAW_GOLD, "match_draw");
      await grantGold(player2Id, ECONOMY_CONSTANTS.REWARDS.DRAW_GOLD, "match_draw");
    }
  } catch (error) {
    console.error("[economy] Error granting game-end rewards:", error);
  }
}
