import { Express } from "express";
import { db } from "./db";
import { 
  friendRequests, 
  friendships, 
  gameRooms, 
  roomSpectators, 
  chatMessages,
  playerRatings,
  userPresence,
  matchmakingQueue,
  achievements,
  playerAchievements,
  dailyChallenges,
  playerChallenges,
  playerStats,
  users
} from "@shared/schema";
import { eq, and, or, desc, sql, gte, lt } from "drizzle-orm";
import { getWebSocketServer } from "./websocket";

export function registerMultiplayerRoutes(app: Express) {
  app.get("/api/friends", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;

    const friendshipsList = await db
      .select({
        id: friendships.id,
        friendId: friendships.friendId,
        createdAt: friendships.createdAt,
        friend: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(friendships)
      .leftJoin(users, eq(friendships.friendId, users.id))
      .where(eq(friendships.userId, userId));

    const wsServer = getWebSocketServer();
    const friendsWithStatus = friendshipsList.map((f) => ({
      ...f,
      isOnline: wsServer?.isUserOnline(f.friendId) || false,
    }));

    res.json(friendsWithStatus);
  });

  app.get("/api/friend-requests", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;

    const [incoming, outgoing] = await Promise.all([
      db
        .select({
          id: friendRequests.id,
          senderId: friendRequests.senderId,
          status: friendRequests.status,
          createdAt: friendRequests.createdAt,
          sender: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          },
        })
        .from(friendRequests)
        .leftJoin(users, eq(friendRequests.senderId, users.id))
        .where(and(eq(friendRequests.receiverId, userId), eq(friendRequests.status, "pending"))),
      db
        .select({
          id: friendRequests.id,
          receiverId: friendRequests.receiverId,
          status: friendRequests.status,
          createdAt: friendRequests.createdAt,
          receiver: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          },
        })
        .from(friendRequests)
        .leftJoin(users, eq(friendRequests.receiverId, users.id))
        .where(and(eq(friendRequests.senderId, userId), eq(friendRequests.status, "pending"))),
    ]);

    res.json({ incoming, outgoing });
  });

  app.post("/api/friend-requests", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const targetUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (targetUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const receiverId = targetUser[0].id;

    if (receiverId === userId) {
      return res.status(400).json({ message: "Cannot send friend request to yourself" });
    }

    const existingFriendship = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userId, userId), eq(friendships.friendId, receiverId)),
          and(eq(friendships.userId, receiverId), eq(friendships.friendId, userId))
        )
      )
      .limit(1);

    if (existingFriendship.length > 0) {
      return res.status(400).json({ message: "Already friends with this user" });
    }

    const existingRequest = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          or(
            and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, receiverId)),
            and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, userId))
          ),
          eq(friendRequests.status, "pending")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return res.status(400).json({ message: "Friend request already pending" });
    }

    const [request] = await db
      .insert(friendRequests)
      .values({ senderId: userId, receiverId, status: "pending" })
      .returning();

    const wsServer = getWebSocketServer();
    wsServer?.sendToUser(receiverId, {
      type: "friend_request",
      payload: { requestId: request.id, senderId: userId },
    });

    res.status(201).json(request);
  });

  app.post("/api/friend-requests/:id/accept", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;

    const [request] = await db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.id, id), eq(friendRequests.receiverId, userId), eq(friendRequests.status, "pending")));

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    await db.update(friendRequests).set({ status: "accepted", updatedAt: new Date() }).where(eq(friendRequests.id, id));

    await db.insert(friendships).values([
      { userId, friendId: request.senderId },
      { userId: request.senderId, friendId: userId },
    ]);

    const wsServer = getWebSocketServer();
    wsServer?.sendToUser(request.senderId, {
      type: "friend_request_accepted",
      payload: { requestId: id, friendId: userId },
    });

    res.json({ message: "Friend request accepted" });
  });

  app.post("/api/friend-requests/:id/decline", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;

    const result = await db
      .update(friendRequests)
      .set({ status: "declined", updatedAt: new Date() })
      .where(and(eq(friendRequests.id, id), eq(friendRequests.receiverId, userId), eq(friendRequests.status, "pending")));

    res.json({ message: "Friend request declined" });
  });

  app.delete("/api/friends/:friendId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { friendId } = req.params;

    await db.delete(friendships).where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
        and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
      )
    );

    res.json({ message: "Friend removed" });
  });

  app.get("/api/rooms", async (req, res) => {
    const rooms = await db
      .select({
        id: gameRooms.id,
        name: gameRooms.name,
        hostId: gameRooms.hostId,
        guestId: gameRooms.guestId,
        isPrivate: gameRooms.isPrivate,
        status: gameRooms.status,
        createdAt: gameRooms.createdAt,
        host: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(gameRooms)
      .leftJoin(users, eq(gameRooms.hostId, users.id))
      .where(eq(gameRooms.status, "waiting"))
      .orderBy(desc(gameRooms.createdAt));

    res.json(rooms);
  });

  app.get("/api/rooms/:id", async (req, res) => {
    const { id } = req.params;

    const [room] = await db
      .select()
      .from(gameRooms)
      .where(eq(gameRooms.id, id));

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const [host] = await db.select().from(users).where(eq(users.id, room.hostId));
    const guest = room.guestId 
      ? (await db.select().from(users).where(eq(users.id, room.guestId)))[0] 
      : null;

    const spectators = await db
      .select({
        id: roomSpectators.id,
        userId: roomSpectators.userId,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(roomSpectators)
      .leftJoin(users, eq(roomSpectators.userId, users.id))
      .where(eq(roomSpectators.roomId, id));

    res.json({ ...room, host, guest, spectators });
  });

  app.post("/api/rooms", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { name, isPrivate, password } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const [room] = await db
      .insert(gameRooms)
      .values({
        name,
        hostId: userId,
        isPrivate: isPrivate || false,
        password: isPrivate ? password : null,
        status: "waiting",
      })
      .returning();

    res.status(201).json(room);
  });

  app.post("/api/rooms/:id/join", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;
    const { password } = req.body;

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, id));

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.status !== "waiting") {
      return res.status(400).json({ message: "Room is not accepting players" });
    }

    if (room.guestId) {
      return res.status(400).json({ message: "Room is full" });
    }

    if (room.isPrivate && room.password !== password) {
      return res.status(403).json({ message: "Incorrect password" });
    }

    const [updatedRoom] = await db
      .update(gameRooms)
      .set({ guestId: userId, updatedAt: new Date() })
      .where(eq(gameRooms.id, id))
      .returning();

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "player_joined",
      payload: { roomId: id, userId },
    });

    res.json(updatedRoom);
  });

  app.post("/api/rooms/:id/leave", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, id));

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.hostId === userId) {
      if (room.guestId) {
        await db
          .update(gameRooms)
          .set({ hostId: room.guestId, guestId: null, hostReady: false, guestReady: false, updatedAt: new Date() })
          .where(eq(gameRooms.id, id));
      } else {
        await db.delete(gameRooms).where(eq(gameRooms.id, id));
      }
    } else if (room.guestId === userId) {
      await db
        .update(gameRooms)
        .set({ guestId: null, guestReady: false, guestDeckId: null, updatedAt: new Date() })
        .where(eq(gameRooms.id, id));
    }

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "player_left",
      payload: { roomId: id, userId },
    });

    res.json({ message: "Left room" });
  });

  app.post("/api/rooms/:id/ready", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;
    const { ready, deckId } = req.body;

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, id));

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.hostId === userId) {
      await db
        .update(gameRooms)
        .set({ hostReady: ready, hostDeckId: deckId, updatedAt: new Date() })
        .where(eq(gameRooms.id, id));
    } else if (room.guestId === userId) {
      await db
        .update(gameRooms)
        .set({ guestReady: ready, guestDeckId: deckId, updatedAt: new Date() })
        .where(eq(gameRooms.id, id));
    } else {
      return res.status(403).json({ message: "Not a member of this room" });
    }

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "player_ready_update",
      payload: { roomId: id, userId, ready, deckId },
    });

    res.json({ message: ready ? "Marked ready" : "Marked not ready" });
  });

  app.post("/api/rooms/:id/spectate", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;

    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, id));

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const existingSpectator = await db
      .select()
      .from(roomSpectators)
      .where(and(eq(roomSpectators.roomId, id), eq(roomSpectators.userId, userId)));

    if (existingSpectator.length > 0) {
      return res.status(400).json({ message: "Already spectating" });
    }

    const [spectator] = await db
      .insert(roomSpectators)
      .values({ roomId: id, userId })
      .returning();

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "spectator_joined",
      payload: { roomId: id, userId },
    });

    res.status(201).json(spectator);
  });

  app.delete("/api/rooms/:id/spectate", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;

    await db
      .delete(roomSpectators)
      .where(and(eq(roomSpectators.roomId, id), eq(roomSpectators.userId, userId)));

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "spectator_left",
      payload: { roomId: id, userId },
    });

    res.json({ message: "Stopped spectating" });
  });

  app.get("/api/rooms/:id/messages", async (req, res) => {
    const { id } = req.params;

    const messages = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        sender: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.roomId, id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(100);

    res.json(messages.reverse());
  });

  app.post("/api/rooms/:id/messages", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const [chatMessage] = await db
      .insert(chatMessages)
      .values({ roomId: id, senderId: userId, message })
      .returning();

    const wsServer = getWebSocketServer();
    wsServer?.sendToRoom(id, {
      type: "chat_message",
      payload: { roomId: id, senderId: userId, message, createdAt: chatMessage.createdAt },
    });

    res.status(201).json(chatMessage);
  });

  app.get("/api/player-rating", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;

    let [rating] = await db.select().from(playerRatings).where(eq(playerRatings.userId, userId));

    if (!rating) {
      [rating] = await db.insert(playerRatings).values({ userId }).returning();
    }

    res.json(rating);
  });

  app.get("/api/leaderboard", async (req, res) => {
    const leaderboardData = await db
      .select({
        id: playerRatings.id,
        rating: playerRatings.rating,
        wins: playerRatings.wins,
        losses: playerRatings.losses,
        streak: playerRatings.streak,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(playerRatings)
      .leftJoin(users, eq(playerRatings.userId, users.id))
      .orderBy(desc(playerRatings.rating))
      .limit(100);

    const formattedLeaderboard = leaderboardData.map((entry, index) => {
      const displayName = entry.firstName 
        ? `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`
        : 'Unknown Player';
      const totalGames = (entry.wins || 0) + (entry.losses || 0);
      const winRate = totalGames > 0 ? ((entry.wins || 0) / totalGames) * 100 : 0;
      
      return {
        id: entry.id,
        rank: index + 1,
        userId: entry.userId,
        displayName,
        profileImageUrl: entry.profileImageUrl,
        rating: entry.rating || 1000,
        wins: entry.wins || 0,
        losses: entry.losses || 0,
        winRate,
        streak: entry.streak || 0,
        tier: getTier(entry.rating || 1000),
      };
    });

    res.json(formattedLeaderboard);
  });

  function getTier(rating: number): string {
    if (rating < 800) return "Bronze";
    if (rating < 1000) return "Silver";
    if (rating < 1200) return "Gold";
    if (rating < 1400) return "Platinum";
    if (rating < 1600) return "Diamond";
    return "Master";
  }

  app.get("/api/achievements", async (req, res) => {
    const allAchievements = await db.select().from(achievements).orderBy(achievements.category);
    res.json(allAchievements);
  });

  app.get("/api/player-achievements", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const playerAchs = await db
      .select()
      .from(playerAchievements)
      .where(eq(playerAchievements.userId, userId));

    res.json(playerAchs);
  });

  app.get("/api/daily-challenges", async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysChallenges = await db
      .select()
      .from(dailyChallenges)
      .where(
        and(
          gte(dailyChallenges.activeDate, today),
          lt(dailyChallenges.activeDate, tomorrow)
        )
      );

    res.json(todaysChallenges);
  });

  app.get("/api/player-challenges", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const playerChs = await db
      .select()
      .from(playerChallenges)
      .where(eq(playerChallenges.userId, userId));

    res.json(playerChs);
  });

  app.post("/api/player-challenges/:id/claim", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    const challengeId = req.params.id;

    const [playerCh] = await db
      .select()
      .from(playerChallenges)
      .where(
        and(
          eq(playerChallenges.userId, userId),
          eq(playerChallenges.challengeId, challengeId)
        )
      );

    if (!playerCh || !playerCh.completedAt || playerCh.claimedAt) {
      return res.status(400).json({ message: "Cannot claim this challenge" });
    }

    const [updated] = await db
      .update(playerChallenges)
      .set({ claimedAt: new Date() })
      .where(eq(playerChallenges.id, playerCh.id))
      .returning();

    res.json(updated);
  });

  app.get("/api/player-stats", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = (req.user as any).id;
    let [stats] = await db.select().from(playerStats).where(eq(playerStats.userId, userId));

    if (!stats) {
      [stats] = await db.insert(playerStats).values({ userId }).returning();
    }

    res.json(stats);
  });

  app.get("/api/users/search", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const results = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(
        or(
          sql`${users.email} ILIKE ${`%${q}%`}`,
          sql`${users.firstName} ILIKE ${`%${q}%`}`,
          sql`${users.lastName} ILIKE ${`%${q}%`}`
        )
      )
      .limit(10);

    res.json(results);
  });
}
