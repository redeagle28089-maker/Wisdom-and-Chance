import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, timestamp, varchar, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Admin flag — only accounts with this set true can reach isAdmin-gated endpoints.
  // Auto-set on web OIDC login when the email matches the configured admin email
  // (replitAuth.upsertUser). Stored on the user row so admin status follows the
  // registered account, not just an email string. Manual promotion via SQL is also
  // supported. See task #61.
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  check("chk_users_email_lowercase", sql`${table.email} IS NULL OR ${table.email} = lower(${table.email})`),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Provider identity links — maps external provider identities to canonical users.
// Allows the same user to be recognized regardless of which platform they sign in from.
export const userProviders = pgTable(
  "user_providers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    provider: varchar("provider").notNull(), // 'replit' | 'google' | 'mobile'
    providerSub: varchar("provider_sub").notNull(), // provider's stable identifier for this user
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("uq_user_providers_provider_sub").on(table.provider, table.providerSub),
  ]
);

export type UserProvider = typeof userProviders.$inferSelect;

// User decks table for storing saved decks
export const userDecks = pgTable("user_decks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  commanderId: varchar("commander_id").notNull(),
  cardIds: text("card_ids").array().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserDeckSchema = createInsertSchema(userDecks).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const selectUserDeckSchema = createSelectSchema(userDecks);
export type InsertUserDeck = z.infer<typeof insertUserDeckSchema>;
export type UserDeck = typeof userDecks.$inferSelect;

// Card image database for storing generated art that hasn't been assigned to cards yet
export const cardImages = pgTable("card_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  imageUrl: text("image_url").notNull(),
  element: varchar("element"),
  cardType: varchar("card_type").notNull().default("unit"), // "unit" | "commander"
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertCardImageSchema = createInsertSchema(cardImages).omit({ 
  id: true, 
  createdAt: true 
});
export const selectCardImageSchema = createSelectSchema(cardImages);
export type InsertCardImage = z.infer<typeof insertCardImageSchema>;
export type CardImage = typeof cardImages.$inferSelect;

export const cardImageMappings = pgTable("card_image_mappings", {
  cardId: varchar("card_id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  imageId: varchar("image_id").references(() => cardImages.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CardImageMapping = typeof cardImageMappings.$inferSelect;

export const commanderImageMappings = pgTable("commander_image_mappings", {
  commanderId: varchar("commander_id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  imageId: varchar("image_id").references(() => cardImages.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CommanderImageMapping = typeof commanderImageMappings.$inferSelect;
