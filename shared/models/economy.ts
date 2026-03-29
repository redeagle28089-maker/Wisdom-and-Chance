import { pgTable, varchar, integer, timestamp, uniqueIndex, boolean, jsonb, date } from "drizzle-orm/pg-core";
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

export const shopCatalog = pgTable("shop_catalog", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull(),
  costGold: integer("cost_gold").notNull().default(100),
  costGems: integer("cost_gems").notNull().default(0),
  cardsPerPack: integer("cards_per_pack").notNull().default(5),
  elementFilter: varchar("element_filter", { length: 50 }),
  guaranteedMinRarity: varchar("guaranteed_min_rarity", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopBundles = pgTable("shop_bundles", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull(),
  costGold: integer("cost_gold").notNull(),
  originalCostGold: integer("original_cost_gold").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  packsJson: varchar("packs_json", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyDeals = pgTable("daily_deals", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  dealDate: date("deal_date").notNull().unique(),
  packTypeId: varchar("pack_type_id", { length: 50 }).notNull(),
  discountPercent: integer("discount_percent").notNull().default(20),
  featuredCardId: varchar("featured_card_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const PACK_TYPES = {
  standard: {
    id: "standard",
    name: "Standard Pack",
    description: "5 random cards from any element with standard rarity odds.",
    costGold: 100,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 60, Rare: 25, Epic: 10, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: null as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
  premium: {
    id: "premium",
    name: "Premium Pack",
    description: "5 cards with guaranteed Rare or better. Higher Legendary odds.",
    costGold: 250,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 0, Rare: 55, Epic: 30, Legendary: 15 } as Record<CardRarity, number>,
    elementFilter: null as string | null,
    guaranteedMinRarity: "Rare" as CardRarity | null,
  },
  fire: {
    id: "fire",
    name: "Fire Pack",
    description: "5 Fire element cards. Great for building Fire decks.",
    costGold: 150,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 55, Rare: 28, Epic: 12, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: "Fire" as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
  water: {
    id: "water",
    name: "Water Pack",
    description: "5 Water element cards. Great for building Water decks.",
    costGold: 150,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 55, Rare: 28, Epic: 12, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: "Water" as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
  earth: {
    id: "earth",
    name: "Earth Pack",
    description: "5 Earth element cards. Great for building Earth decks.",
    costGold: 150,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 55, Rare: 28, Epic: 12, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: "Earth" as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
  air: {
    id: "air",
    name: "Air Pack",
    description: "5 Air element cards. Great for building Air decks.",
    costGold: 150,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 55, Rare: 28, Epic: 12, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: "Air" as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
  nature: {
    id: "nature",
    name: "Nature Pack",
    description: "5 Nature element cards. Great for building Nature decks.",
    costGold: 150,
    costGems: 0,
    cardsPerPack: 5,
    rarityWeights: { Common: 55, Rare: 28, Epic: 12, Legendary: 5 } as Record<CardRarity, number>,
    elementFilter: "Nature" as string | null,
    guaranteedMinRarity: null as CardRarity | null,
  },
} as const;

export type PackTypeId = keyof typeof PACK_TYPES;
export type PackType = typeof PACK_TYPES[PackTypeId];

export const packTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  costGold: z.number(),
  costGems: z.number(),
  cardsPerPack: z.number(),
  elementFilter: z.string().nullable(),
  guaranteedMinRarity: z.string().nullable(),
});

export const dailyDealSchema = z.object({
  packTypeId: z.string(),
  packName: z.string(),
  originalCostGold: z.number(),
  discountedCostGold: z.number(),
  discountPercent: z.number(),
  featuredCardId: z.string().nullable(),
  expiresAt: z.string(),
});

export type DailyDeal = z.infer<typeof dailyDealSchema>;
