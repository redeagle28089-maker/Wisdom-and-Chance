import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const FRIEND_REQUEST_STATUS = ["pending", "accepted", "declined"] as const;
export type FriendRequestStatus = typeof FRIEND_REQUEST_STATUS[number];

export const ROOM_STATUS = ["waiting", "ready", "in_game", "completed"] as const;
export type RoomStatus = typeof ROOM_STATUS[number];

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    senderId: varchar("sender_id").notNull().references(() => users.id),
    receiverId: varchar("receiver_id").notNull().references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_friend_requests_sender").on(table.senderId),
    index("idx_friend_requests_receiver").on(table.receiverId),
  ]
);

export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = typeof friendRequests.$inferInsert;

export const friendships = pgTable(
  "friendships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    friendId: varchar("friend_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_friendships_user").on(table.userId),
    index("idx_friendships_friend").on(table.friendId),
  ]
);

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

export const gameRooms = pgTable(
  "game_rooms",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    hostId: varchar("host_id").notNull().references(() => users.id),
    guestId: varchar("guest_id").references(() => users.id),
    isPrivate: boolean("is_private").default(false),
    password: varchar("password", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    hostDeckId: varchar("host_deck_id"),
    guestDeckId: varchar("guest_deck_id"),
    hostReady: boolean("host_ready").default(false),
    guestReady: boolean("guest_ready").default(false),
    gameId: varchar("game_id"),
    maxSpectators: integer("max_spectators").default(10),
    settings: jsonb("settings"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_game_rooms_host").on(table.hostId),
    index("idx_game_rooms_status").on(table.status),
  ]
);

export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = typeof gameRooms.$inferInsert;

export const roomSpectators = pgTable(
  "room_spectators",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    roomId: varchar("room_id").notNull().references(() => gameRooms.id),
    userId: varchar("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => [
    index("idx_room_spectators_room").on(table.roomId),
  ]
);

export type RoomSpectator = typeof roomSpectators.$inferSelect;
export type InsertRoomSpectator = typeof roomSpectators.$inferInsert;

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    roomId: varchar("room_id").references(() => gameRooms.id),
    gameId: varchar("game_id"),
    senderId: varchar("sender_id").notNull().references(() => users.id),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_chat_messages_room").on(table.roomId),
    index("idx_chat_messages_game").on(table.gameId),
  ]
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const playerRatings = pgTable(
  "player_ratings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id).unique(),
    rating: integer("rating").default(1000),
    wins: integer("wins").default(0),
    losses: integer("losses").default(0),
    streak: integer("streak").default(0),
    highestRating: integer("highest_rating").default(1000),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_player_ratings_user").on(table.userId),
    index("idx_player_ratings_rating").on(table.rating),
  ]
);

export type PlayerRating = typeof playerRatings.$inferSelect;
export type InsertPlayerRating = typeof playerRatings.$inferInsert;

export const userPresence = pgTable(
  "user_presence",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id).unique(),
    status: varchar("status", { length: 20 }).default("offline"),
    currentRoomId: varchar("current_room_id"),
    currentGameId: varchar("current_game_id"),
    lastSeen: timestamp("last_seen").defaultNow(),
  },
  (table) => [
    index("idx_user_presence_user").on(table.userId),
    index("idx_user_presence_status").on(table.status),
  ]
);

export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = typeof userPresence.$inferInsert;

export const matchmakingQueue = pgTable(
  "matchmaking_queue",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id).unique(),
    deckId: varchar("deck_id").notNull(),
    rating: integer("rating").default(1000),
    queueType: varchar("queue_type", { length: 20 }).default("ranked"),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => [
    index("idx_matchmaking_queue_type").on(table.queueType),
    index("idx_matchmaking_queue_rating").on(table.rating),
  ]
);

export type MatchmakingEntry = typeof matchmakingQueue.$inferSelect;
export type InsertMatchmakingEntry = typeof matchmakingQueue.$inferInsert;

export const ACHIEVEMENT_CATEGORIES = ["wins", "games", "collection", "social", "special"] as const;
export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[number];

export const achievements = pgTable(
  "achievements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 20 }).notNull(),
    icon: varchar("icon", { length: 50 }),
    requirement: integer("requirement").notNull().default(1),
    xpReward: integer("xp_reward").default(100),
    isSecret: boolean("is_secret").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_achievements_category").on(table.category),
  ]
);

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export const playerAchievements = pgTable(
  "player_achievements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
    progress: integer("progress").default(0),
    unlockedAt: timestamp("unlocked_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_player_achievements_user").on(table.userId),
    index("idx_player_achievements_achievement").on(table.achievementId),
  ]
);

export type PlayerAchievement = typeof playerAchievements.$inferSelect;
export type InsertPlayerAchievement = typeof playerAchievements.$inferInsert;

export const CHALLENGE_TYPES = ["win_games", "play_element", "deal_damage", "use_commander", "play_cards"] as const;
export type ChallengeType = typeof CHALLENGE_TYPES[number];

export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    challengeType: varchar("challenge_type", { length: 30 }).notNull(),
    requirement: integer("requirement").notNull(),
    elementFilter: varchar("element_filter", { length: 20 }),
    xpReward: integer("xp_reward").default(50),
    activeDate: timestamp("active_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_daily_challenges_date").on(table.activeDate),
  ]
);

export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type InsertDailyChallenge = typeof dailyChallenges.$inferInsert;

export const playerChallenges = pgTable(
  "player_challenges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    challengeId: varchar("challenge_id").notNull().references(() => dailyChallenges.id),
    progress: integer("progress").default(0),
    completedAt: timestamp("completed_at"),
    claimedAt: timestamp("claimed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_player_challenges_user").on(table.userId),
    index("idx_player_challenges_challenge").on(table.challengeId),
  ]
);

export type PlayerChallenge = typeof playerChallenges.$inferSelect;
export type InsertPlayerChallenge = typeof playerChallenges.$inferInsert;

export const playerStats = pgTable(
  "player_stats",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id).unique(),
    totalXp: integer("total_xp").default(0),
    level: integer("level").default(1),
    gamesPlayed: integer("games_played").default(0),
    gamesWon: integer("games_won").default(0),
    gamesLost: integer("games_lost").default(0),
    totalDamageDealt: integer("total_damage_dealt").default(0),
    totalCardsPlayed: integer("total_cards_played").default(0),
    favoriteElement: varchar("favorite_element", { length: 20 }),
    favoriteCommander: varchar("favorite_commander"),
    longestWinStreak: integer("longest_win_streak").default(0),
    currentWinStreak: integer("current_win_streak").default(0),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_player_stats_user").on(table.userId),
    index("idx_player_stats_level").on(table.level),
    index("idx_player_stats_xp").on(table.totalXp),
  ]
);

export type PlayerStats = typeof playerStats.$inferSelect;
export type InsertPlayerStats = typeof playerStats.$inferInsert;

export const EMOTE_TYPES = ["good_game", "nice_play", "thanks", "thinking", "hurry_up", "sorry"] as const;
export type EmoteType = typeof EMOTE_TYPES[number];

export const deckCodes = pgTable(
  "deck_codes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 20 }).notNull().unique(),
    deckName: varchar("deck_name", { length: 100 }).notNull(),
    commanderId: varchar("commander_id").notNull(),
    cardIds: jsonb("card_ids").notNull(),
    creatorId: varchar("creator_id").references(() => users.id),
    isPublic: boolean("is_public").default(false),
    uses: integer("uses").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_deck_codes_code").on(table.code),
    index("idx_deck_codes_creator").on(table.creatorId),
  ]
);

export type DeckCode = typeof deckCodes.$inferSelect;
export type InsertDeckCode = typeof deckCodes.$inferInsert;
