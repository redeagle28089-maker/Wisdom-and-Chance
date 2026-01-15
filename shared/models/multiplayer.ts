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
