import { pgTable, varchar, integer, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const playerCurrencies = pgTable("player_currencies", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  gold: integer("gold").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  dust: integer("dust").notNull().default(0),
  starterClaimed: boolean("starter_claimed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const playerCollection = pgTable("player_collection", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  cardId: varchar("card_id", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
}, (table) => [
  uniqueIndex("player_collection_user_card_idx").on(table.userId, table.cardId),
]);

export const CARD_RARITIES = ["Common", "Rare", "Epic", "Legendary"] as const;
export type CardRarity = typeof CARD_RARITIES[number];

export function getCardRarity(power: number): CardRarity {
  if (power <= 3) return "Common";
  if (power <= 6) return "Rare";
  if (power <= 8) return "Epic";
  return "Legendary";
}

export const RARITY_COLORS: Record<CardRarity, string> = {
  Common: "#9CA3AF",
  Rare: "#3B82F6",
  Epic: "#A855F7",
  Legendary: "#F59E0B",
};

export const ECONOMY_CONSTANTS = {
  STARTER_GOLD: 500,
  STARTER_GEMS: 0,
  STARTER_DUST: 0,

  PACK_COST_GOLD: 100,
  PACK_CARDS: 5,

  PACK_RARITY_WEIGHTS: {
    Common: 60,
    Rare: 25,
    Epic: 10,
    Legendary: 5,
  } as Record<CardRarity, number>,

  CRAFT_COST: {
    Common: 40,
    Rare: 100,
    Epic: 400,
    Legendary: 1600,
  } as Record<CardRarity, number>,

  DISENCHANT_VALUE: {
    Common: 5,
    Rare: 20,
    Epic: 100,
    Legendary: 400,
  } as Record<CardRarity, number>,

  REWARDS: {
    WIN_GOLD: 30,
    LOSS_GOLD: 10,
    DRAW_GOLD: 15,
    DAILY_CHALLENGE_GOLD: 25,
    ACHIEVEMENT_GOLD: 50,
    FORFEIT_WIN_GOLD: 15,
  },

  STARTER_COLLECTION_POWERS: [1, 2, 3, 4, 5],
} as const;

export const currencyBalanceSchema = z.object({
  gold: z.number(),
  gems: z.number(),
  dust: z.number(),
});

export type CurrencyBalance = z.infer<typeof currencyBalanceSchema>;

export const collectionEntrySchema = z.object({
  cardId: z.string(),
  quantity: z.number(),
});

export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

export const packResultSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string(),
    rarity: z.enum(CARD_RARITIES),
    isNew: z.boolean(),
  })),
  costGold: z.number(),
  remainingGold: z.number(),
});

export type PackResult = z.infer<typeof packResultSchema>;
