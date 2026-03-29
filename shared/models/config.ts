import { pgTable, varchar, boolean, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 100 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serverConfig = pgTable("server_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string().nullable(),
});

export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const DEFAULT_FEATURE_FLAGS: Record<string, { enabled: boolean; description: string }> = {
  economy_enabled: { enabled: false, description: "Currency system (gold, gems, dust)" },
  collection_enabled: { enabled: false, description: "Card collection and ownership tracking" },
  shop_enabled: { enabled: false, description: "In-game shop for purchasing packs and items" },
  pack_opening_enabled: { enabled: false, description: "Card pack opening and booster system" },
  crafting_enabled: { enabled: false, description: "Card crafting and disenchanting" },
  ranked_seasons: { enabled: false, description: "Ranked season resets and rewards" },
  battle_pass: { enabled: false, description: "Battle pass / seasonal reward track" },
  weekly_challenges: { enabled: false, description: "Weekly challenge quests" },
  emotes: { enabled: false, description: "In-match emote system" },
  spectator_mode: { enabled: true, description: "Watch live matches" },
  practice_mode: { enabled: true, description: "Play against AI opponents" },
  multiplayer: { enabled: true, description: "Online multiplayer matches" },
  friends_system: { enabled: true, description: "Friend list, requests, and messaging" },
  daily_challenges: { enabled: true, description: "Daily challenge quests" },
  achievements: { enabled: true, description: "Achievement system with XP rewards" },
  leaderboard: { enabled: true, description: "Global leaderboard and rankings" },
};

export const appConfigSchema = z.object({
  apiVersion: z.string(),
  features: z.record(z.string(), z.boolean()),
  season: z.object({
    id: z.string(),
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    daysRemaining: z.number(),
  }).nullable(),
  maintenance: z.object({
    active: z.boolean(),
    message: z.string().optional(),
  }),
  minClientVersion: z.string(),
  serverTime: z.string(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
