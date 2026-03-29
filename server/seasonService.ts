import { db } from "./db";
import { eq, and, sql, ne, lt } from "drizzle-orm";
import {
  seasons, seasonHistory, playerBattlePass, battlePassLevels,
  weeklyChallenges, playerWeeklyChallenges, playerRatings,
  playerCurrencies,
  RANKED_TIERS, SEASON_REWARDS, BATTLE_PASS_XP,
} from "@shared/schema";
import { serverConfig } from "@shared/schema";
import { grantGold, ensureCurrencies } from "./economyService";

function getTierForRating(rating: number): string {
  let tier = "Bronze";
  for (const t of RANKED_TIERS) {
    if (rating >= t.minRating) tier = t.name;
  }
  return tier;
}

const SEASON_BASELINE_RATING = 1000;
const SEASON_SOFT_RESET_RATIO = 0.5;

export async function checkAndTransitionSeason() {
  try {
    const [activeSeason] = await db.select().from(seasons)
      .where(eq(seasons.isActive, true)).limit(1);

    if (!activeSeason) return;

    const now = new Date();
    if (now < activeSeason.endsAt) return;

    console.log(`[season] Season "${activeSeason.name}" ended. Starting transition...`);

    const allRatings = await db.select().from(playerRatings);

    for (const pr of allRatings) {
      const peakTier = getTierForRating(pr.highestRating);

      const [existingHistory] = await db.select().from(seasonHistory)
        .where(and(eq(seasonHistory.userId, pr.userId), eq(seasonHistory.seasonId, activeSeason.id)))
        .limit(1);

      if (existingHistory && existingHistory.rewardsClaimed) continue;

      if (!existingHistory) {
        await db.insert(seasonHistory).values({
          userId: pr.userId,
          seasonId: activeSeason.id,
          finalRating: pr.rating,
          peakRating: pr.highestRating,
          tier: peakTier,
          gamesPlayed: pr.wins + pr.losses,
          wins: pr.wins,
          rewardsClaimed: false,
        }).onConflictDoNothing();
      }

      const rewards = SEASON_REWARDS[peakTier as keyof typeof SEASON_REWARDS];
      if (rewards) {
        await ensureCurrencies(pr.userId);
        if (rewards.gold > 0) await grantGold(pr.userId, rewards.gold, `season_${activeSeason.seasonNumber}_reward`);
        if (rewards.dust > 0) {
          await db.update(playerCurrencies)
            .set({ dust: sql`dust + ${rewards.dust}`, updatedAt: new Date() })
            .where(eq(playerCurrencies.userId, pr.userId));
        }
        if (rewards.packs > 0) {
          const { openPackForUser } = await import("./economyService");
          for (let p = 0; p < rewards.packs; p++) {
            await openPackForUser(pr.userId, rewards.packs >= 5 ? "premium" : "standard");
          }
        }
      }

      const cosmeticReward = rewards?.cosmetic ?? null;
      await db.update(seasonHistory)
        .set({ rewardsClaimed: true, cosmeticReward })
        .where(and(eq(seasonHistory.userId, pr.userId), eq(seasonHistory.seasonId, activeSeason.id)));

      const newRating = Math.round(SEASON_BASELINE_RATING + (pr.rating - SEASON_BASELINE_RATING) * SEASON_SOFT_RESET_RATIO);
      await db.update(playerRatings)
        .set({
          rating: newRating,
          highestRating: newRating,
          wins: 0,
          losses: 0,
          streak: 0,
          updatedAt: new Date(),
        })
        .where(eq(playerRatings.id, pr.id));
    }

    await db.update(seasons)
      .set({ isActive: false })
      .where(eq(seasons.id, activeSeason.id));

    const nextSeasonNumber = activeSeason.seasonNumber + 1;
    const nextStart = new Date();
    let seasonDurationDays = 30;
    try {
      const [cfg] = await db.select().from(serverConfig).where(eq(serverConfig.key, "season_duration_days")).limit(1);
      if (cfg && typeof cfg.value === "number") seasonDurationDays = cfg.value;
    } catch (_e) {}
    const nextEnd = new Date(nextStart.getTime() + seasonDurationDays * 24 * 60 * 60 * 1000);

    const [existingNext] = await db.select().from(seasons)
      .where(eq(seasons.seasonNumber, nextSeasonNumber)).limit(1);

    const newSeason = existingNext || (await db.insert(seasons).values({
      name: `Season ${nextSeasonNumber}`,
      seasonNumber: nextSeasonNumber,
      startsAt: nextStart,
      endsAt: nextEnd,
      isActive: true,
    }).onConflictDoNothing().returning())[0];

    if (newSeason) {
      const levelRewards = [
        { type: "gold", amount: 50 }, { type: "gold", amount: 75 }, { type: "gold", amount: 100 },
        { type: "dust", amount: 25 }, { type: "gold", amount: 125 }, { type: "pack", amount: 1 },
        { type: "gold", amount: 150 }, { type: "dust", amount: 50 }, { type: "gold", amount: 175 },
        { type: "gems", amount: 10 }, { type: "gold", amount: 200 }, { type: "dust", amount: 75 },
        { type: "gold", amount: 225 }, { type: "pack", amount: 1 }, { type: "gold", amount: 250 },
        { type: "gems", amount: 15 }, { type: "gold", amount: 275 }, { type: "dust", amount: 100 },
        { type: "gold", amount: 300 }, { type: "pack", amount: 1 }, { type: "gold", amount: 325 },
        { type: "dust", amount: 125 }, { type: "gold", amount: 350 }, { type: "gems", amount: 20 },
        { type: "gold", amount: 375 }, { type: "pack", amount: 1 }, { type: "gold", amount: 400 },
        { type: "dust", amount: 150 }, { type: "gold", amount: 425 }, { type: "gems", amount: 25 },
        { type: "gold", amount: 450 }, { type: "dust", amount: 175 }, { type: "gold", amount: 475 },
        { type: "pack", amount: 1 }, { type: "gold", amount: 500 }, { type: "gems", amount: 30 },
        { type: "gold", amount: 550 }, { type: "dust", amount: 200 }, { type: "gold", amount: 600 },
        { type: "pack", amount: 1 }, { type: "gold", amount: 650 }, { type: "dust", amount: 250 },
        { type: "gold", amount: 700 }, { type: "gems", amount: 40 }, { type: "gold", amount: 750 },
        { type: "pack", amount: 2 }, { type: "gold", amount: 800 }, { type: "dust", amount: 300 },
        { type: "gems", amount: 50 }, { type: "pack", amount: 3 },
      ];

      for (let i = 0; i < 50; i++) {
        const r = levelRewards[i];
        await db.insert(battlePassLevels).values({
          seasonId: newSeason.id,
          level: i + 1,
          xpRequired: (i + 1) * 200,
          rewardType: r.type,
          rewardAmount: r.amount,
          rewardDescription: `${r.amount} ${r.type}`,
        });
      }

      const challengeTypes = [
        { challengeType: "win_games", description: "Win 5 matches", requirement: 5 },
        { challengeType: "play_element", description: "Play 20 cards of any element", requirement: 20 },
        { challengeType: "deal_damage", description: "Deal 100 total damage", requirement: 100 },
      ];

      for (let week = 0; week < 5; week++) {
        const weekStart = new Date(nextStart.getTime() + week * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const challenges = challengeTypes.map(ct => ({
          seasonId: newSeason.id,
          weekNumber: week + 1,
          challengeType: ct.challengeType,
          description: ct.description,
          requirement: ct.requirement,
          xpReward: BATTLE_PASS_XP.WEEKLY_CHALLENGE,
          goldReward: 50,
          activeFrom: weekStart,
          activeUntil: weekEnd,
        }));
        await db.insert(weeklyChallenges).values(challenges).onConflictDoNothing();
      }
    }

    console.log(`[season] Transition complete. Season ${nextSeasonNumber} started.`);
  } catch (error) {
    console.error("[season] Error during season transition:", error);
  }
}

let seasonCheckInterval: NodeJS.Timeout | null = null;

export function startSeasonChecker() {
  seasonCheckInterval = setInterval(() => {
    checkAndTransitionSeason();
  }, 60 * 60 * 1000);
  console.log("[season] Season transition checker started (hourly)");
}

export function stopSeasonChecker() {
  if (seasonCheckInterval) {
    clearInterval(seasonCheckInterval);
    seasonCheckInterval = null;
  }
}
