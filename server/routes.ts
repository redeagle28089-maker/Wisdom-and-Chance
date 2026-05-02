import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { eq, or, and, lt, lte, desc, sql, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertCardSchema, insertDeckSchema, insertPlayerSchema, insertGameSchema, ELEMENTS, userDecks, insertUserDeckSchema, GAME_CONSTANTS, cardImages, insertCardImageSchema, TRAITS, BUFF_DEBUFF_COLORS, users, friendships, friendMessages, cardImageMappings, commanderImageMappings, GAME_PHASES, GAME_MODE_CONFIG, AI_DIFFICULTY, GAME_STATUS, featureFlags, serverConfig, DEFAULT_FEATURE_FLAGS, playerCurrencies, playerCollection, ECONOMY_CONSTANTS, getCardRarity, type CardRarity, playerChallenges, playerAchievements, PACK_TYPES, dailyDeals, shopCatalog, shopBundles, seasons, seasonHistory, battlePassLevels, playerBattlePass, weeklyChallenges, playerWeeklyChallenges, RANKED_TIERS, SEASON_REWARDS, BATTLE_PASS_XP, playerRatings, gameRooms } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerMultiplayerRoutes } from "./multiplayerRoutes";
import { registerMobileAuthRoutes } from "./mobileAuth";
import { registerApiDocsRoutes } from "./apiDocs";
import { registerPaymentRoutes } from "./paymentRoutes";
import { isUnifiedAuth } from "./unifiedAuth";
import jwt from "jsonwebtoken";
import { generateImage, generateText } from "./replit_integrations/image/client";
import { getWebSocketServer } from "./websocket";
import { filterObscenity } from "./obscenity-filter";
import { gameEngine } from "./gameEngine";
import { ensureCurrencies, grantGold, grantStarterCollection, grantBattlePassXP } from "./economyService";

const ADMIN_EMAIL = "redeagle28089@gmail.com";

const deckSuggestionSchema = z.object({
  commanderId: z.string().min(1, "Commander is required"),
  playstyle: z.enum(["aggressive", "defensive", "balanced"]),
});

const generateArtSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt too long"),
  element: z.enum(ELEMENTS).optional(),
  referenceImageBase64: z.string().optional(),
});

// Enhanced schema for generating card with stats
const generateCardSchema = z.object({
  mode: z.enum(["art", "stats", "both"]),
  prompt: z.string().max(2000).optional(),
  element: z.enum(ELEMENTS).optional(),
  referenceImageBase64: z.string().optional(),
  // Toggleable stat generation options
  generatePower: z.boolean().default(true),
  powerValue: z.number().min(1).max(10).optional(),
  generateTrait: z.boolean().default(false),
  traitValue: z.enum(TRAITS).optional(),
  traitModifier: z.number().optional(),
  generateBuff: z.boolean().default(false),
  buffColor: z.enum(BUFF_DEBUFF_COLORS).optional(),
  buffValue: z.number().optional(),
  generateDebuff: z.boolean().default(false),
  debuffColor: z.enum(BUFF_DEBUFF_COLORS).optional(),
  debuffValue: z.number().optional(),
  cardName: z.string().optional(),
});

const saveToImageDatabaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  imageUrl: z.string().min(1, "Image URL is required"),
  element: z.enum(ELEMENTS).optional(),
  cardType: z.enum(["unit", "commander"]).default("unit"),
  tags: z.array(z.string()).optional(),
});

const updateImageSchema = z.object({
  imageUrl: z.string().min(1, "Image URL is required").refine(
    (url) => url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://"),
    "Invalid image URL format"
  ),
});

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/api", async (req: any, res, next) => {
    if (req.user && req.isAuthenticated && req.isAuthenticated()) return next();
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.SESSION_SECRET;
      if (secret && token) {
        try {
          const payload = jwt.verify(token, secret) as any;
          if (payload?.userId) {
            const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
            if (user) {
              req.user = {
                claims: {
                  sub: user.id,
                  email: user.email,
                  first_name: user.firstName,
                  last_name: user.lastName,
                },
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              };
              req.isAuthenticated = () => true;
              return next();
            }
          }
        } catch {}
      }
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    next();
  });

  registerMultiplayerRoutes(app);
  registerMobileAuthRoutes(app);
  registerApiDocsRoutes(app);
  await registerPaymentRoutes(app);

  app.get("/api/health", async (_req, res) => {
    try {
      const [dbCheck] = await db.select({ now: sql`NOW()` }).from(sql`(SELECT 1) AS t`);
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "2.2.0",
        database: dbCheck ? "connected" : "error",
        services: {
          auth: "available",
          websocket: "available",
          multiplayer: "available",
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        version: "2.2.0",
        database: "error",
      });
    }
  });

  app.get("/api/config", async (_req, res) => {
    try {
      const flags = await db.select().from(featureFlags);
      const flagMap: Record<string, boolean> = {};
      for (const [key, def] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
        const dbFlag = flags.find(f => f.key === key);
        flagMap[key] = dbFlag ? dbFlag.enabled : def.enabled;
      }
      for (const f of flags) {
        if (!(f.key in flagMap)) flagMap[f.key] = f.enabled;
      }

      const maintenanceRow = await db.select().from(serverConfig).where(eq(serverConfig.key, "maintenance")).limit(1);
      const maintenanceVal = maintenanceRow[0]?.value as { active: boolean; message?: string } | undefined;

      let season = null;
      const seasonRow = await db.select().from(serverConfig).where(eq(serverConfig.key, "current_season")).limit(1);
      const seasonVal = seasonRow[0]?.value as { id: string; name: string; start: string; end: string } | null;
      if (seasonVal && seasonVal.end) {
        const daysRemaining = Math.max(0, Math.ceil((new Date(seasonVal.end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        season = { ...seasonVal, daysRemaining };
      } else {
        const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
        if (activeSeason) {
          const daysRemaining = Math.max(0, Math.ceil((activeSeason.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          season = { id: activeSeason.id, name: activeSeason.name, start: activeSeason.startsAt.toISOString(), end: activeSeason.endsAt.toISOString(), daysRemaining };
        }
      }

      const minVersionRow = await db.select().from(serverConfig).where(eq(serverConfig.key, "min_client_version")).limit(1);
      const minClientVersion = (minVersionRow[0]?.value as { version: string })?.version || "1.0.0";

      res.json({
        apiVersion: "2.2.0",
        features: flagMap,
        season,
        maintenance: maintenanceVal || { active: false },
        minClientVersion,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[config] Error fetching config:", error);
      res.status(500).json({ message: "Failed to fetch config" });
    }
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const profileSchema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        profileImageUrl: z.string().url().optional().nullable(),
      });

      const parseResult = profileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const updates = parseResult.data;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const [updated] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/cards", async (req, res) => {
    const cards = await storage.getCards();
    res.json(cards);
  });

  app.get("/api/cards/:id", async (req, res) => {
    const card = await storage.getCard(req.params.id);
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }
    res.json(card);
  });

  app.get("/api/cards/element/:element", async (req, res) => {
    const cards = await storage.getCardsByElement(req.params.element);
    res.json(cards);
  });

  app.get("/api/commanders", async (req, res) => {
    const commanders = await storage.getCommanders();
    res.json(commanders);
  });

  app.get("/api/commanders/:id", async (req, res) => {
    const commander = await storage.getCommander(req.params.id);
    if (!commander) {
      return res.status(404).json({ message: "Commander not found" });
    }
    res.json(commander);
  });

  app.get("/api/decks", async (req, res) => {
    const playerId = req.query.playerId as string;
    if (playerId) {
      const decks = await storage.getDecksByPlayer(playerId);
      return res.json(decks);
    }
    const decks = await storage.getDecks();
    res.json(decks);
  });

  app.get("/api/decks/:id", async (req, res) => {
    const deck = await storage.getDeck(req.params.id);
    if (!deck) {
      return res.status(404).json({ message: "Deck not found" });
    }
    res.json(deck);
  });

  app.post("/api/decks", async (req, res) => {
    const result = insertDeckSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid deck data", errors: result.error.flatten() });
    }
    const deck = await storage.createDeck(result.data);
    res.status(201).json(deck);
  });

  app.patch("/api/decks/:id", async (req, res) => {
    const deck = await storage.updateDeck(req.params.id, req.body);
    if (!deck) {
      return res.status(404).json({ message: "Deck not found" });
    }
    res.json(deck);
  });

  app.delete("/api/decks/:id", async (req, res) => {
    const deleted = await storage.deleteDeck(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Deck not found" });
    }
    res.status(204).send();
  });

  app.get("/api/players", async (req, res) => {
    const players = await storage.getPlayers();
    res.json(players);
  });

  app.get("/api/players/:id", async (req, res) => {
    const player = await storage.getPlayer(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    res.json(player);
  });

  app.post("/api/players", async (req, res) => {
    const result = insertPlayerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid player data", errors: result.error.flatten() });
    }
    const existing = await storage.getPlayerByUsername(result.data.username);
    if (existing) {
      return res.json(existing);
    }
    const player = await storage.createPlayer(result.data);
    res.status(201).json(player);
  });

  app.patch("/api/players/:id", async (req, res) => {
    const player = await storage.updatePlayer(req.params.id, req.body);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    res.json(player);
  });

  app.get("/api/games", async (req, res) => {
    const playerId = req.query.playerId as string;
    if (playerId) {
      const games = await storage.getGamesByPlayer(playerId);
      return res.json(games);
    }
    const games = await storage.getGames();
    res.json(games);
  });

  app.get("/api/games/:id", async (req, res) => {
    const game = await storage.getGame(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.gameType === "multiplayer" && game.status === "in_progress" && req.user) {
      const userId = (req.user as any).claims?.sub || (req.user as any).userId;
      if (userId) {
        const sanitized = gameEngine.getGameStateForPlayer(game.id, userId);
        if (sanitized) {
          return res.json({ ...game, sanitizedState: sanitized });
        }
      }
    }

    res.json(game);
  });

  app.post("/api/games", async (req, res) => {
    const result = insertGameSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid game data", errors: result.error.flatten() });
    }
    const game = await storage.createGame(result.data);
    res.status(201).json(game);
  });

  app.patch("/api/games/:id", async (req, res) => {
    const existingGame = await storage.getGame(req.params.id);
    if (!existingGame) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (existingGame.gameType === "multiplayer" && existingGame.status === "in_progress") {
      return res.status(403).json({ message: "Multiplayer games can only be modified through the game engine" });
    }

    const game = await storage.updateGame(req.params.id, req.body);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json(game);
  });

  app.delete("/api/games/:id", async (req, res) => {
    const deleted = await storage.deleteGame(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.status(204).send();
  });

  // User Decks - Saved deck endpoints (database-backed)
  app.get("/api/user-decks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const decks = await db.select().from(userDecks).where(eq(userDecks.userId, userId));
      res.json(decks);
    } catch (error) {
      console.error("Error fetching user decks:", error);
      res.status(500).json({ error: "Failed to fetch decks" });
    }
  });

  app.get("/api/user-decks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const [deck] = await db.select().from(userDecks)
        .where(eq(userDecks.id, req.params.id));
      
      if (!deck) {
        return res.status(404).json({ error: "Deck not found" });
      }
      if (deck.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this deck" });
      }
      res.json(deck);
    } catch (error) {
      console.error("Error fetching deck:", error);
      res.status(500).json({ error: "Failed to fetch deck" });
    }
  });

  const createUserDeckSchema = z.object({
    name: z.string().min(1, "Deck name is required").max(50, "Deck name too long"),
    commanderId: z.string().min(1, "Commander is required"),
    cardIds: z.array(z.string()).length(GAME_CONSTANTS.DECK_SIZE, `Deck must have exactly ${GAME_CONSTANTS.DECK_SIZE} cards`),
  });

  async function validateDeckCards(cardIds: string[], userId?: string): Promise<{ valid: boolean; error?: string }> {
    const allCards = await storage.getCards();
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    const invalidCards = cardIds.filter(id => !cardMap.has(id));
    if (invalidCards.length > 0) {
      return { valid: false, error: `Invalid card IDs: ${invalidCards.slice(0, 5).join(", ")}` };
    }

    const cardCounts = new Map<string, number>();
    for (const cardId of cardIds) {
      const count = (cardCounts.get(cardId) || 0) + 1;
      if (count > GAME_CONSTANTS.MAX_COPIES_PER_CARD) {
        const card = cardMap.get(cardId);
        return { valid: false, error: `Maximum ${GAME_CONSTANTS.MAX_COPIES_PER_CARD} copies of "${card?.name}" allowed` };
      }
      cardCounts.set(cardId, count);
    }

    const powerCounts: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) powerCounts[i] = 0;
    
    for (const cardId of cardIds) {
      const card = cardMap.get(cardId);
      if (card) {
        powerCounts[card.power]++;
      }
    }

    for (let power = 1; power <= 10; power++) {
      if (powerCounts[power] !== GAME_CONSTANTS.CARDS_PER_POWER_RANK) {
        return { valid: false, error: `Power ${power} needs exactly ${GAME_CONSTANTS.CARDS_PER_POWER_RANK} cards, found ${powerCounts[power]}` };
      }
    }

    if (userId && await isEconomyEnabled()) {
      const collection = await db.select().from(playerCollection).where(eq(playerCollection.userId, userId));
      const ownedMap = new Map(collection.map(e => [e.cardId, e.quantity]));

      for (const [cardId, needed] of cardCounts.entries()) {
        const owned = ownedMap.get(cardId) ?? 0;
        if (owned < needed) {
          const card = cardMap.get(cardId);
          return { valid: false, error: `You only own ${owned} copies of "${card?.name}" but need ${needed}` };
        }
      }
    }

    return { valid: true };
  }

  app.post("/api/user-decks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const parseResult = createUserDeckSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const { name, commanderId, cardIds } = parseResult.data;

      // Validate commander exists
      const commander = await storage.getCommander(commanderId);
      if (!commander) {
        return res.status(400).json({ error: "Invalid commander" });
      }

      const deckValidation = await validateDeckCards(cardIds, userId);
      if (!deckValidation.valid) {
        return res.status(400).json({ error: deckValidation.error });
      }

      const [newDeck] = await db.insert(userDecks).values({
        userId,
        name,
        commanderId,
        cardIds,
      }).returning();

      res.status(201).json(newDeck);
    } catch (error) {
      console.error("Error creating deck:", error);
      res.status(500).json({ error: "Failed to create deck" });
    }
  });

  app.patch("/api/user-decks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check deck exists and belongs to user
      const [existingDeck] = await db.select().from(userDecks)
        .where(eq(userDecks.id, req.params.id));
      
      if (!existingDeck) {
        return res.status(404).json({ error: "Deck not found" });
      }
      if (existingDeck.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to edit this deck" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(50).optional(),
        commanderId: z.string().min(1).optional(),
        cardIds: z.array(z.string()).length(GAME_CONSTANTS.DECK_SIZE).optional(),
      });

      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const updates = parseResult.data;
      
      // Validate commander if provided
      if (updates.commanderId) {
        const commander = await storage.getCommander(updates.commanderId);
        if (!commander) {
          return res.status(400).json({ error: "Invalid commander" });
        }
      }

      if (updates.cardIds) {
        const deckValidation = await validateDeckCards(updates.cardIds, userId);
        if (!deckValidation.valid) {
          return res.status(400).json({ error: deckValidation.error });
        }
      }

      const [updatedDeck] = await db.update(userDecks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userDecks.id, req.params.id))
        .returning();

      res.json(updatedDeck);
    } catch (error) {
      console.error("Error updating deck:", error);
      res.status(500).json({ error: "Failed to update deck" });
    }
  });

  app.delete("/api/user-decks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check deck exists and belongs to user
      const [existingDeck] = await db.select().from(userDecks)
        .where(eq(userDecks.id, req.params.id));
      
      if (!existingDeck) {
        return res.status(404).json({ error: "Deck not found" });
      }
      if (existingDeck.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this deck" });
      }

      await db.delete(userDecks).where(eq(userDecks.id, req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deck:", error);
      res.status(500).json({ error: "Failed to delete deck" });
    }
  });

  // AI Deck Suggestion endpoint
  app.post("/api/deck-suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const parseResult = deckSuggestionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const { commanderId, playstyle } = parseResult.data;
      
      // Get commander and cards data
      const commander = await storage.getCommander(commanderId);
      if (!commander) {
        return res.status(404).json({ error: "Commander not found" });
      }

      const allCards = await storage.getCards();
      
      // Get unique cards by element and power
      const uniqueCards = new Map<string, typeof allCards[0]>();
      allCards.forEach((card) => {
        const key = `${card.element}-${card.power}`;
        if (!uniqueCards.has(key)) {
          uniqueCards.set(key, card);
        }
      });

      const cardList = Array.from(uniqueCards.values()).map(c => ({
        id: c.id,
        name: c.name,
        element: c.element,
        power: c.power,
        trait: c.trait || "None",
      }));

      const playstyleDescriptions: Record<string, string> = {
        aggressive: "Focus on high-power cards (7-10), Fire and Air elements, offensive traits. Prioritize damage output.",
        defensive: "Focus on mid-power cards (4-7), Earth and Water elements, defensive traits. Prioritize survival.",
        balanced: "Mix of all power levels, diverse elements matching the commander's element. Adaptable strategy.",
      };

      const prompt = `You are a deck building AI for the Wisdom & Chance TCG. Build a 40-card deck with these EXACT requirements:
- Exactly 4 cards of each power rank (1-10) = 40 cards total
- Maximum 3 copies of any single card
- Commander: ${commander.name} (${commander.element} element)
- Playstyle: ${playstyle} - ${playstyleDescriptions[playstyle]}

Available cards (format: id|name|element|power|trait):
${cardList.map(c => `${c.id}|${c.name}|${c.element}|${c.power}|${c.trait}`).join("\n")}

Return ONLY a JSON object with this exact structure, no other text:
{
  "deckName": "Creative deck name based on strategy",
  "strategy": "Brief 1-2 sentence explanation of the deck strategy",
  "cards": [{"id": "card-id", "count": 1-3}]
}

IMPORTANT: 
- cards array must result in exactly 40 total cards
- Each power rank (1-10) must have exactly 4 cards total
- Favor cards matching the commander's ${commander.element} element for synergy`;

      const aiResponse = await generateText(prompt);
      
      // Parse the JSON from AI response
      let suggestion;
      try {
        // Extract JSON from response (may have markdown code blocks)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        suggestion = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse AI response:", aiResponse);
        return res.status(500).json({ error: "Failed to parse deck suggestion" });
      }

      // Validate the suggestion structure
      if (!suggestion.cards || !Array.isArray(suggestion.cards)) {
        return res.status(500).json({ error: "Invalid deck suggestion format" });
      }

      // Validate each card exists and count totals
      const validatedCards: { id: string; count: number }[] = [];
      const powerCounts: Record<number, number> = {};
      for (let i = 1; i <= 10; i++) powerCounts[i] = 0;
      
      for (const cardEntry of suggestion.cards) {
        const card = allCards.find(c => c.id === cardEntry.id);
        if (!card) continue;
        
        const count = Math.min(cardEntry.count || 1, 3);
        const availableForPower = 4 - powerCounts[card.power];
        const actualCount = Math.min(count, availableForPower);
        
        if (actualCount > 0) {
          validatedCards.push({ id: card.id, count: actualCount });
          powerCounts[card.power] += actualCount;
        }
      }

      // Fill any missing power ranks if AI didn't provide enough cards
      for (let power = 1; power <= 10; power++) {
        while (powerCounts[power] < 4) {
          const availableCards = Array.from(uniqueCards.values())
            .filter(c => c.power === power)
            .filter(c => {
              const existing = validatedCards.find(v => v.id === c.id);
              return !existing || existing.count < 3;
            });
          
          if (availableCards.length === 0) break;
          
          const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
          const existing = validatedCards.find(v => v.id === randomCard.id);
          
          if (existing) {
            const toAdd = Math.min(3 - existing.count, 4 - powerCounts[power]);
            existing.count += toAdd;
            powerCounts[power] += toAdd;
          } else {
            const toAdd = Math.min(3, 4 - powerCounts[power]);
            validatedCards.push({ id: randomCard.id, count: toAdd });
            powerCounts[power] += toAdd;
          }
        }
      }

      res.json({
        deckName: suggestion.deckName || `${commander.name}'s ${playstyle} Deck`,
        strategy: suggestion.strategy || `A ${playstyle} deck built around ${commander.name}'s abilities.`,
        commanderId,
        cards: validatedCards,
      });
    } catch (error) {
      console.error("Error generating deck suggestion:", error);
      res.status(500).json({ error: "Failed to generate deck suggestion" });
    }
  });

  async function isEconomyEnabled(): Promise<boolean> {
    const flag = await db.select().from(featureFlags).where(eq(featureFlags.key, "economy_enabled")).limit(1);
    return flag.length > 0 ? flag[0].enabled : false;
  }

  const requireEconomy = async (_req: any, res: any, next: any) => {
    if (!(await isEconomyEnabled())) {
      return res.status(403).json({ message: "Economy system is not enabled" });
    }
    next();
  };

  app.get("/api/currencies", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const balances = await ensureCurrencies(userId);
      res.json(balances);
    } catch (error) {
      console.error("[economy] Error fetching currencies:", error);
      res.status(500).json({ message: "Failed to fetch currencies" });
    }
  });

  app.get("/api/collection", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const entries = await db.select().from(playerCollection).where(eq(playerCollection.userId, userId));
      res.json(entries.map(e => ({ cardId: e.cardId, quantity: e.quantity })));
    } catch (error) {
      console.error("[economy] Error fetching collection:", error);
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  async function seedShopCatalog() {
    const existing = await db.select().from(shopCatalog).limit(1);
    if (existing.length > 0) return;
    console.log("[shop] Seeding shop catalog from PACK_TYPES...");
    let sortOrder = 0;
    for (const pack of Object.values(PACK_TYPES)) {
      await db.insert(shopCatalog).values({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        costGold: pack.costGold,
        costGems: pack.costGems,
        cardsPerPack: pack.cardsPerPack,
        elementFilter: pack.elementFilter,
        guaranteedMinRarity: pack.guaranteedMinRarity,
        isActive: true,
        sortOrder: sortOrder++,
      }).onConflictDoNothing();
    }
    const existingBundles = await db.select().from(shopBundles).limit(1);
    if (existingBundles.length === 0) {
      console.log("[shop] Seeding shop bundles...");
      await db.insert(shopBundles).values([
        {
          id: "starter-bundle",
          name: "Starter Bundle",
          description: "Perfect for new players! Get 3 Standard Packs and 1 Premium Pack at a discounted price.",
          costGold: 500,
          originalCostGold: 550,
          isActive: true,
          packsJson: JSON.stringify([{ type: "standard", count: 3 }, { type: "premium", count: 1 }]),
        },
        {
          id: "element-sampler",
          name: "Element Sampler",
          description: "One pack from each element! Great for exploring all playstyles.",
          costGold: 650,
          originalCostGold: 750,
          isActive: true,
          packsJson: JSON.stringify([{ type: "fire", count: 1 }, { type: "water", count: 1 }, { type: "earth", count: 1 }, { type: "air", count: 1 }, { type: "nature", count: 1 }]),
        },
      ]).onConflictDoNothing();
    }
    console.log("[shop] Shop catalog seeded.");
  }

  seedShopCatalog().catch(e => console.error("[shop] Failed to seed catalog:", e));

  async function rotateDailyDeal() {
    const today = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(dailyDeals).where(eq(dailyDeals.dealDate, today)).limit(1);
    if (existing) return;

    const packIds = Object.keys(PACK_TYPES) as (keyof typeof PACK_TYPES)[];
    const randomPackId = packIds[Math.floor(Math.random() * packIds.length)];
    const discount = [15, 20, 25, 30][Math.floor(Math.random() * 4)];
    const allCards = await storage.getCards();
    const featuredCard = allCards[Math.floor(Math.random() * allCards.length)];

    await db.insert(dailyDeals).values({
      dealDate: today,
      packTypeId: randomPackId,
      discountPercent: discount,
      featuredCardId: featuredCard?.id ?? null,
    }).onConflictDoUpdate({
      target: dailyDeals.dealDate,
      set: { packTypeId: randomPackId, discountPercent: discount, featuredCardId: featuredCard?.id ?? null },
    });
    console.log(`[shop] Daily deal rotated: ${randomPackId} at ${discount}% off`);
  }

  rotateDailyDeal().catch(e => console.error("[shop] Failed to rotate daily deal:", e));

  setInterval(() => {
    rotateDailyDeal().catch(e => console.error("[shop] Daily deal rotation failed:", e));
  }, 60 * 60 * 1000);

  app.get("/api/shop/catalog", requireEconomy, async (_req: any, res) => {
    try {
      const dbCatalog = await db.select().from(shopCatalog).where(eq(shopCatalog.isActive, true));
      if (dbCatalog.length > 0) {
        const sorted = dbCatalog.sort((a, b) => a.sortOrder - b.sortOrder);
        res.json(sorted.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          costGold: p.costGold,
          costGems: p.costGems,
          cardsPerPack: p.cardsPerPack,
          elementFilter: p.elementFilter,
          guaranteedMinRarity: p.guaranteedMinRarity,
        })));
      } else {
        const catalog = Object.values(PACK_TYPES).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          costGold: p.costGold,
          costGems: p.costGems,
          cardsPerPack: p.cardsPerPack,
          elementFilter: p.elementFilter,
          guaranteedMinRarity: p.guaranteedMinRarity,
        }));
        res.json(catalog);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch catalog" });
    }
  });

  app.get("/api/shop/daily-deals", requireEconomy, async (_req: any, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      let [deal] = await db.select().from(dailyDeals).where(eq(dailyDeals.dealDate, today)).limit(1);

      if (!deal) {
        const packIds = Object.keys(PACK_TYPES) as (keyof typeof PACK_TYPES)[];
        const randomPackId = packIds[Math.floor(Math.random() * packIds.length)];
        const discount = [15, 20, 25, 30][Math.floor(Math.random() * 4)];
        const allCards = await storage.getCards();
        const featuredCard = allCards[Math.floor(Math.random() * allCards.length)];

        [deal] = await db.insert(dailyDeals).values({
          dealDate: today,
          packTypeId: randomPackId,
          discountPercent: discount,
          featuredCardId: featuredCard?.id ?? null,
        }).returning();
      }

      const packType = PACK_TYPES[deal.packTypeId as keyof typeof PACK_TYPES] ?? PACK_TYPES.standard;
      const discountedCost = Math.floor(packType.costGold * (1 - deal.discountPercent / 100));

      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);

      res.json({
        packTypeId: deal.packTypeId,
        packName: packType.name,
        originalCostGold: packType.costGold,
        discountedCostGold: discountedCost,
        discountPercent: deal.discountPercent,
        featuredCardId: deal.featuredCardId,
        expiresAt: tomorrow.toISOString(),
      });
    } catch (error) {
      console.error("[shop] Error fetching daily deal:", error);
      res.status(500).json({ message: "Failed to fetch daily deal" });
    }
  });

  app.get("/api/shop/bundles", requireEconomy, async (_req: any, res) => {
    try {
      const bundles = await db.select().from(shopBundles).where(eq(shopBundles.isActive, true));
      res.json(bundles.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        costGold: b.costGold,
        originalCostGold: b.originalCostGold,
        packs: JSON.parse(b.packsJson),
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  app.post("/api/shop/purchase-bundle", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { bundleId, currency } = req.body || {};
      const currencyType: "gold" | "gems" = currency === "gems" ? "gems" : "gold";
      const [bundle] = await db.select().from(shopBundles).where(and(eq(shopBundles.id, bundleId), eq(shopBundles.isActive, true))).limit(1);
      if (!bundle) return res.status(400).json({ message: "Invalid bundle" });

      const cost = bundle.costGold;
      const packs: { type: string; count: number }[] = JSON.parse(bundle.packsJson);

      await ensureCurrencies(userId);
      const currencyField = currencyType === "gems" ? playerCurrencies.gems : playerCurrencies.gold;

      const result = await db.transaction(async (tx) => {
        const deducted = await tx.update(playerCurrencies)
          .set({ [currencyType]: sql`${currencyField} - ${cost}`, updatedAt: new Date() })
          .where(and(eq(playerCurrencies.userId, userId), sql`${currencyField} >= ${cost}`))
          .returning();

        if (deducted.length === 0) {
          const cur = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
          return { error: true, message: `Not enough ${currencyType}`, required: cost, current: currencyType === "gems" ? (cur[0]?.gems ?? 0) : (cur[0]?.gold ?? 0) };
        }

        const allCards = await storage.getCards();
        const existingCollection = await tx.select().from(playerCollection).where(eq(playerCollection.userId, userId));
        const ownedMap = new Map(existingCollection.map(e => [e.cardId, e.quantity]));
        const allPulledCards: { cardId: string; rarity: CardRarity; isNew: boolean; cardName: string; element: string; power: number }[] = [];

        for (const packEntry of packs) {
          const packDef = PACK_TYPES[packEntry.type as keyof typeof PACK_TYPES];
          if (!packDef) continue;

          for (let p = 0; p < packEntry.count; p++) {
            let pool = allCards;
            if (packDef.elementFilter) {
              pool = allCards.filter(c => c.element === packDef.elementFilter);
            }

            const cardsByRarity: Record<CardRarity, typeof allCards> = {
              Common: pool.filter(c => getCardRarity(c.power) === "Common"),
              Rare: pool.filter(c => getCardRarity(c.power) === "Rare"),
              Epic: pool.filter(c => getCardRarity(c.power) === "Epic"),
              Legendary: pool.filter(c => getCardRarity(c.power) === "Legendary"),
            };

            const weights = packDef.rarityWeights as Record<CardRarity, number>;
            const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

            for (let i = 0; i < packDef.cardsPerPack; i++) {
              let roll = Math.random() * totalWeight;
              let selectedRarity: CardRarity = "Common";
              for (const [rarity, weight] of Object.entries(weights) as [CardRarity, number][]) {
                roll -= weight;
                if (roll <= 0) { selectedRarity = rarity; break; }
              }

              let rarityPool = cardsByRarity[selectedRarity];
              if (rarityPool.length === 0) {
                for (const fallback of ["Common", "Rare", "Epic", "Legendary"] as CardRarity[]) {
                  if (cardsByRarity[fallback].length > 0) { rarityPool = cardsByRarity[fallback]; selectedRarity = fallback; break; }
                }
              }
              if (rarityPool.length === 0) continue;

              const card = rarityPool[Math.floor(Math.random() * rarityPool.length)];
              const isNew = !ownedMap.has(card.id);
              ownedMap.set(card.id, (ownedMap.get(card.id) || 0) + 1);

              await tx.insert(playerCollection)
                .values({ userId, cardId: card.id, quantity: 1 })
                .onConflictDoUpdate({
                  target: [playerCollection.userId, playerCollection.cardId],
                  set: { quantity: sql`${playerCollection.quantity} + 1` },
                });

              allPulledCards.push({ cardId: card.id, rarity: selectedRarity, isNew, cardName: card.name, element: card.element, power: card.power });
            }
          }
        }

        const updated = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        return {
          error: false,
          data: {
            packTypeId: bundleId,
            packName: bundle.name,
            cards: allPulledCards,
            costGold: cost,
            remainingGold: updated[0]?.gold ?? 0,
            remainingGems: updated[0]?.gems ?? 0,
          },
        };
      });

      if (result.error) {
        return res.status(400).json({ message: result.message, required: result.required, current: result.current });
      }
      res.json(result.data);
    } catch (error) {
      console.error("[shop] Error purchasing bundle:", error);
      res.status(500).json({ message: "Failed to purchase bundle" });
    }
  });

  app.post("/api/shop/purchase", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { packTypeId, useDailyDeal, currency } = req.body || {};
      const currencyType: "gold" | "gems" = currency === "gems" ? "gems" : "gold";
      const packDef = PACK_TYPES[packTypeId as keyof typeof PACK_TYPES];
      if (!packDef) return res.status(400).json({ message: "Invalid pack type" });

      let cost = currencyType === "gems" ? packDef.costGems : packDef.costGold;
      if (cost <= 0) return res.status(400).json({ message: `This pack cannot be purchased with ${currencyType}` });

      if (useDailyDeal && currencyType === "gold") {
        const today = new Date().toISOString().split("T")[0];
        const [deal] = await db.select().from(dailyDeals).where(eq(dailyDeals.dealDate, today)).limit(1);
        if (deal && deal.packTypeId === packTypeId) {
          cost = Math.floor(packDef.costGold * (1 - deal.discountPercent / 100));
        }
      }

      await ensureCurrencies(userId);
      const currencyField = currencyType === "gems" ? playerCurrencies.gems : playerCurrencies.gold;

      const result = await db.transaction(async (tx) => {
        const deducted = await tx.update(playerCurrencies)
          .set({ [currencyType]: sql`${currencyField} - ${cost}`, updatedAt: new Date() })
          .where(and(eq(playerCurrencies.userId, userId), sql`${currencyField} >= ${cost}`))
          .returning();

        if (deducted.length === 0) {
          const cur = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
          return { error: true, message: `Not enough ${currencyType}`, required: cost, current: currencyType === "gems" ? (cur[0]?.gems ?? 0) : (cur[0]?.gold ?? 0) };
        }

        const allCards = await storage.getCards();
        let pool = allCards;
        if (packDef.elementFilter) {
          pool = allCards.filter(c => c.element === packDef.elementFilter);
        }

        const cardsByRarity: Record<CardRarity, typeof allCards> = {
          Common: pool.filter(c => getCardRarity(c.power) === "Common"),
          Rare: pool.filter(c => getCardRarity(c.power) === "Rare"),
          Epic: pool.filter(c => getCardRarity(c.power) === "Epic"),
          Legendary: pool.filter(c => getCardRarity(c.power) === "Legendary"),
        };

        const weights = packDef.rarityWeights as Record<CardRarity, number>;
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        const pulledCards: { cardId: string; rarity: CardRarity; isNew: boolean; cardName: string; element: string; power: number }[] = [];

        const existingCollection = await tx.select().from(playerCollection).where(eq(playerCollection.userId, userId));
        const ownedMap = new Map(existingCollection.map(e => [e.cardId, e.quantity]));

        for (let i = 0; i < packDef.cardsPerPack; i++) {
          let roll = Math.random() * totalWeight;
          let selectedRarity: CardRarity = "Common";
          for (const [rarity, weight] of Object.entries(weights) as [CardRarity, number][]) {
            roll -= weight;
            if (roll <= 0) {
              selectedRarity = rarity;
              break;
            }
          }

          let rarityPool = cardsByRarity[selectedRarity];
          if (rarityPool.length === 0) {
            for (const fallback of ["Common", "Rare", "Epic", "Legendary"] as CardRarity[]) {
              if (cardsByRarity[fallback].length > 0) {
                rarityPool = cardsByRarity[fallback];
                selectedRarity = fallback;
                break;
              }
            }
          }
          if (rarityPool.length === 0) continue;

          const card = rarityPool[Math.floor(Math.random() * rarityPool.length)];
          const isNew = !ownedMap.has(card.id);
          ownedMap.set(card.id, (ownedMap.get(card.id) || 0) + 1);

          await tx.insert(playerCollection)
            .values({ userId, cardId: card.id, quantity: 1 })
            .onConflictDoUpdate({
              target: [playerCollection.userId, playerCollection.cardId],
              set: { quantity: sql`${playerCollection.quantity} + 1` },
            });

          pulledCards.push({
            cardId: card.id,
            rarity: selectedRarity,
            isNew,
            cardName: card.name,
            element: card.element,
            power: card.power,
          });
        }

        const updated = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        return {
          error: false,
          data: {
            packTypeId,
            packName: packDef.name,
            cards: pulledCards,
            costGold: cost,
            remainingGold: updated[0]?.gold ?? 0,
            remainingGems: updated[0]?.gems ?? 0,
          },
        };
      });

      if (result.error) {
        return res.status(400).json({ message: result.message, required: result.required, current: result.current });
      }
      res.json(result.data);
    } catch (error) {
      console.error("[shop] Error purchasing pack:", error);
      res.status(500).json({ message: "Failed to purchase pack" });
    }
  });

  app.post("/api/packs/open", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      await ensureCurrencies(userId);
      const packType = req.body?.packType || "standard";
      const cost = ECONOMY_CONSTANTS.PACK_COST_GOLD;

      const deducted = await db.update(playerCurrencies)
        .set({ gold: sql`gold - ${cost}`, updatedAt: new Date() })
        .where(and(eq(playerCurrencies.userId, userId), sql`gold >= ${cost}`))
        .returning({ gold: playerCurrencies.gold });

      if (deducted.length === 0) {
        const cur = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        return res.status(400).json({ message: "Not enough gold", required: cost, current: cur[0]?.gold ?? 0 });
      }

      const allCards = await storage.getCards();
      const cardsByRarity: Record<CardRarity, typeof allCards> = {
        Common: allCards.filter(c => getCardRarity(c.power) === "Common"),
        Rare: allCards.filter(c => getCardRarity(c.power) === "Rare"),
        Epic: allCards.filter(c => getCardRarity(c.power) === "Epic"),
        Legendary: allCards.filter(c => getCardRarity(c.power) === "Legendary"),
      };

      const weights = ECONOMY_CONSTANTS.PACK_RARITY_WEIGHTS;
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      const pulledCards: { cardId: string; rarity: CardRarity; isNew: boolean }[] = [];

      const existingCollection = await db.select().from(playerCollection).where(eq(playerCollection.userId, userId));
      const ownedMap = new Map(existingCollection.map(e => [e.cardId, e.quantity]));

      for (let i = 0; i < ECONOMY_CONSTANTS.PACK_CARDS; i++) {
        let roll = Math.random() * totalWeight;
        let selectedRarity: CardRarity = "Common";
        for (const [rarity, weight] of Object.entries(weights) as [CardRarity, number][]) {
          roll -= weight;
          if (roll <= 0) {
            selectedRarity = rarity;
            break;
          }
        }

        const pool = cardsByRarity[selectedRarity];
        if (pool.length === 0) continue;
        const card = pool[Math.floor(Math.random() * pool.length)];
        const isNew = !ownedMap.has(card.id);

        const currentQty = ownedMap.get(card.id) || 0;
        ownedMap.set(card.id, currentQty + 1);

        await db.insert(playerCollection)
          .values({ userId, cardId: card.id, quantity: 1 })
          .onConflictDoUpdate({
            target: [playerCollection.userId, playerCollection.cardId],
            set: { quantity: sql`${playerCollection.quantity} + 1` },
          });

        pulledCards.push({ cardId: card.id, rarity: selectedRarity, isNew });
      }

      const updated = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
      res.json({
        cards: pulledCards,
        costGold: cost,
        remainingGold: updated[0]?.gold ?? 0,
      });
    } catch (error) {
      console.error("[economy] Error opening pack:", error);
      res.status(500).json({ message: "Failed to open pack" });
    }
  });

  app.post("/api/cards/craft", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = z.object({ cardId: z.string() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "cardId is required" });

      const card = await storage.getCard(parsed.data.cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const rarity = getCardRarity(card.power);
      const cost = ECONOMY_CONSTANTS.CRAFT_COST[rarity];

      await ensureCurrencies(userId);
      const deducted = await db.update(playerCurrencies)
        .set({ dust: sql`dust - ${cost}`, updatedAt: new Date() })
        .where(and(eq(playerCurrencies.userId, userId), sql`dust >= ${cost}`))
        .returning({ dust: playerCurrencies.dust });

      if (deducted.length === 0) {
        const cur = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        return res.status(400).json({ message: "Not enough dust", required: cost, current: cur[0]?.dust ?? 0 });
      }

      await db.insert(playerCollection)
        .values({ userId, cardId: card.id, quantity: 1 })
        .onConflictDoUpdate({
          target: [playerCollection.userId, playerCollection.cardId],
          set: { quantity: sql`${playerCollection.quantity} + 1` },
        });

      const updated = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
      res.json({
        cardId: card.id,
        rarity,
        dustCost: cost,
        remainingDust: updated[0]?.dust ?? 0,
      });
    } catch (error) {
      console.error("[economy] Error crafting card:", error);
      res.status(500).json({ message: "Failed to craft card" });
    }
  });

  app.post("/api/cards/disenchant", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = z.object({ cardId: z.string(), quantity: z.number().int().min(1).default(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "cardId and optional quantity required", errors: parsed.error.flatten() });

      const card = await storage.getCard(parsed.data.cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const rarity = getCardRarity(card.power);
      const dustGained = ECONOMY_CONSTANTS.DISENCHANT_VALUE[rarity] * parsed.data.quantity;

      const deducted = await db.update(playerCollection)
        .set({ quantity: sql`${playerCollection.quantity} - ${parsed.data.quantity}` })
        .where(and(
          eq(playerCollection.userId, userId),
          eq(playerCollection.cardId, card.id),
          sql`${playerCollection.quantity} >= ${parsed.data.quantity}`
        ))
        .returning({ quantity: playerCollection.quantity });

      if (deducted.length === 0) {
        const owned = await db.select().from(playerCollection)
          .where(and(eq(playerCollection.userId, userId), eq(playerCollection.cardId, card.id)))
          .limit(1);
        return res.status(400).json({ message: "Not enough copies", owned: owned[0]?.quantity ?? 0, requested: parsed.data.quantity });
      }

      if (deducted[0].quantity <= 0) {
        await db.delete(playerCollection)
          .where(and(eq(playerCollection.userId, userId), eq(playerCollection.cardId, card.id)));
      }

      await ensureCurrencies(userId);
      await db.update(playerCurrencies)
        .set({ dust: sql`LEAST(dust + ${dustGained}, ${ECONOMY_CONSTANTS.MAX_CURRENCY})`, updatedAt: new Date() })
        .where(eq(playerCurrencies.userId, userId));

      const updatedCur = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
      res.json({
        cardId: card.id,
        quantity: parsed.data.quantity,
        rarity,
        dustGained,
        remainingDust: updatedCur[0]?.dust ?? 0,
      });
    } catch (error) {
      console.error("[economy] Error disenchanting:", error);
      res.status(500).json({ message: "Failed to disenchant" });
    }
  });

  app.post("/api/collection/starter", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      await ensureCurrencies(userId);
      await grantStarterCollection(userId);
      const entries = await db.select().from(playerCollection).where(eq(playerCollection.userId, userId));
      const balances = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
      res.json({
        collection: entries.map(e => ({ cardId: e.cardId, quantity: e.quantity })),
        currencies: balances[0] ? { gold: balances[0].gold, gems: balances[0].gems, dust: balances[0].dust } : null,
      });
    } catch (error) {
      console.error("[economy] Error granting starter collection:", error);
      res.status(500).json({ message: "Failed to grant starter collection" });
    }
  });

  app.post("/api/achievements/:id/claim", isAuthenticated, requireEconomy, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const achievementId = req.params.id;
      const [pa] = await db.select().from(playerAchievements)
        .where(and(
          eq(playerAchievements.userId, userId),
          eq(playerAchievements.achievementId, achievementId)
        ))
        .limit(1);

      if (!pa) return res.status(404).json({ message: "Achievement progress not found" });
      if (!pa.unlockedAt) return res.status(400).json({ message: "Achievement not yet unlocked" });
      if (pa.goldClaimed) return res.status(400).json({ message: "Gold already claimed for this achievement" });

      await db.update(playerAchievements)
        .set({ goldClaimed: true })
        .where(eq(playerAchievements.id, pa.id));

      await grantGold(userId, ECONOMY_CONSTANTS.REWARDS.ACHIEVEMENT_GOLD, "achievement_unlock");
      await grantBattlePassXP(userId, BATTLE_PASS_XP.ACHIEVEMENT, "achievement_unlock");

      const balances = await ensureCurrencies(userId);
      res.json({ claimed: true, goldAwarded: ECONOMY_CONSTANTS.REWARDS.ACHIEVEMENT_GOLD, currencies: balances });
    } catch (error) {
      console.error("[economy] Error claiming achievement:", error);
      res.status(500).json({ message: "Failed to claim achievement" });
    }
  });

  // Admin middleware
  const isAdmin = (req: any, res: any, next: any) => {
    const userEmail = req.user?.claims?.email;
    if (!req.user || userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin routes for card art generation
  app.get("/api/admin/check", isAuthenticated, (req: any, res) => {
    const userEmail = req.user?.claims?.email;
    const isAdminUser = userEmail === ADMIN_EMAIL;
    res.json({ isAdmin: isAdminUser });
  });

  // Delete waiting rooms older than `olderThanHours` (default 24h) with no guest.
  // Helps reclaim abandoned lobbies when a host creates a room and never starts.
  app.post("/api/admin/cleanup-stale-rooms", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const olderThanHours = Number(req.body?.olderThanHours);
      const hours = Number.isFinite(olderThanHours) && olderThanHours > 0 ? olderThanHours : 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const stale = await db
        .select({ id: gameRooms.id })
        .from(gameRooms)
        .where(
          and(
            eq(gameRooms.status, "waiting"),
            isNull(gameRooms.guestId),
            lt(gameRooms.createdAt, cutoff),
          )
        );

      if (stale.length === 0) {
        return res.json({ deleted: 0, olderThanHours: hours });
      }

      await db
        .delete(gameRooms)
        .where(
          and(
            eq(gameRooms.status, "waiting"),
            isNull(gameRooms.guestId),
            lt(gameRooms.createdAt, cutoff),
          )
        );

      res.json({ deleted: stale.length, olderThanHours: hours });
    } catch (error: any) {
      console.error("[admin] cleanup-stale-rooms error:", error);
      res.status(500).json({ message: "Failed to clean up stale rooms" });
    }
  });

  // Test-mode helper: admins can shorten the multiplayer disconnect-forfeit
  // timeout at runtime so integration tests don't have to wait 60s for a
  // disconnected player to be declared a forfeit. Future calls to
  // gameEngine.handleDisconnect read this env var fresh.
  app.post("/api/admin/test/disconnect-timeout", isAuthenticated, isAdmin, async (req, res) => {
    const ms = Number(req.body?.ms);
    if (!Number.isFinite(ms) || ms < 100 || ms > 120_000) {
      return res.status(400).json({ message: "ms must be a number between 100 and 120000" });
    }
    process.env.MP_DISCONNECT_TIMEOUT_MS = String(ms);
    res.json({ disconnectTimeoutMs: ms });
  });

  app.get("/api/admin/feature-flags", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const flags = await db.select().from(featureFlags);
      const result: Record<string, { enabled: boolean; description: string | null }> = {};
      for (const [key, def] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
        const dbFlag = flags.find(f => f.key === key);
        result[key] = {
          enabled: dbFlag ? dbFlag.enabled : def.enabled,
          description: dbFlag?.description || def.description,
        };
      }
      for (const f of flags) {
        if (!(f.key in result)) {
          result[f.key] = { enabled: f.enabled, description: f.description };
        }
      }
      res.json(result);
    } catch (error) {
      console.error("[admin] Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });

  app.patch("/api/admin/feature-flags/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      if (!(key in DEFAULT_FEATURE_FLAGS)) {
        return res.status(400).json({ message: `Unknown feature flag. Allowed keys: ${Object.keys(DEFAULT_FEATURE_FLAGS).join(", ")}` });
      }
      const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "enabled must be a boolean", errors: parsed.error.flatten() });
      }
      const description = DEFAULT_FEATURE_FLAGS[key]?.description || null;
      await db.insert(featureFlags)
        .values({ key, enabled: parsed.data.enabled, description, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: { enabled: parsed.data.enabled, updatedAt: new Date() },
        });
      res.json({ key, enabled: parsed.data.enabled, description });
    } catch (error) {
      console.error("[admin] Error updating feature flag:", error);
      res.status(500).json({ message: "Failed to update feature flag" });
    }
  });

  const serverConfigSchemas: Record<string, z.ZodType> = {
    maintenance: z.object({ active: z.boolean(), message: z.string().optional() }),
    current_season: z.object({ id: z.string(), name: z.string(), start: z.string(), end: z.string() }),
    min_client_version: z.object({ version: z.string() }),
  };

  app.put("/api/admin/server-config/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const schema = serverConfigSchemas[key];
      if (!schema) {
        return res.status(400).json({ message: `Invalid config key. Allowed: ${Object.keys(serverConfigSchemas).join(", ")}` });
      }
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({ message: "value is required" });
      }
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid value shape", errors: parsed.error.flatten() });
      }
      await db.insert(serverConfig)
        .values({ key, value: parsed.data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: serverConfig.key,
          set: { value: parsed.data, updatedAt: new Date() },
        });
      res.json({ key, value: parsed.data });
    } catch (error) {
      console.error("[admin] Error updating server config:", error);
      res.status(500).json({ message: "Failed to update server config" });
    }
  });

  app.post("/api/admin/generate-card-art", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parseResult = generateArtSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const { prompt, element, referenceImageBase64 } = parseResult.data;
      const fullPrompt = `Create a fantasy trading card game artwork for a ${element || "magical"} themed card. ${prompt}. Style: High quality fantasy digital art, dramatic lighting, epic composition. Do not include any text or UI elements.`;

      const imageDataUrl = await generateImage(fullPrompt, referenceImageBase64);
      res.json({ imageUrl: imageDataUrl });
    } catch (error) {
      console.error("Error generating card art:", error);
      res.status(500).json({ error: "Failed to generate card art" });
    }
  });

  app.patch("/api/admin/cards/:id", isAuthenticated, isAdmin, async (req, res) => {
    const parseResult = updateImageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
    }

    const { imageUrl } = parseResult.data;
    const card = await storage.updateCard(req.params.id, { imageUrl });
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }
    await db.insert(cardImageMappings).values({ cardId: req.params.id, imageUrl }).onConflictDoUpdate({ target: cardImageMappings.cardId, set: { imageUrl, updatedAt: new Date() } });
    res.json(card);
  });

  app.delete("/api/admin/cards/:id", isAuthenticated, isAdmin, async (req, res) => {
    const deleted = await storage.deleteCard(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Card not found" });
    }
    res.json({ success: true, message: "Card deleted" });
  });

  app.patch("/api/admin/commanders/:id", isAuthenticated, isAdmin, async (req, res) => {
    const parseResult = updateImageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
    }

    const { imageUrl } = parseResult.data;
    const commander = await storage.updateCommander(req.params.id, { imageUrl });
    if (!commander) {
      return res.status(404).json({ message: "Commander not found" });
    }
    await db.insert(commanderImageMappings).values({ commanderId: req.params.id, imageUrl }).onConflictDoUpdate({ target: commanderImageMappings.commanderId, set: { imageUrl, updatedAt: new Date() } });
    res.json(commander);
  });

  // =============== Card Image Database Routes ===============

  // Get all images from card image database
  app.get("/api/admin/card-images/bulk/download-manifest", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const images = await db.select({
        id: cardImages.id,
        name: cardImages.name,
        element: cardImages.element,
        cardType: cardImages.cardType,
        createdAt: cardImages.createdAt,
      }).from(cardImages).orderBy(cardImages.createdAt);

      const manifest = images.map(img => ({
        ...img,
        downloadUrl: `/api/admin/card-images/${img.id}/download`,
      }));

      res.json({ total: manifest.length, images: manifest });
    } catch (error) {
      console.error("Error fetching image manifest:", error);
      res.status(500).json({ error: "Failed to fetch image manifest" });
    }
  });

  app.get("/api/admin/card-images", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const images = await db.select().from(cardImages).orderBy(cardImages.createdAt);
      res.json(images);
    } catch (error) {
      console.error("Error fetching card images:", error);
      res.status(500).json({ error: "Failed to fetch card images" });
    }
  });

  // Get single card image
  app.get("/api/admin/card-images/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [image] = await db.select().from(cardImages).where(eq(cardImages.id, req.params.id));
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(image);
    } catch (error) {
      console.error("Error fetching card image:", error);
      res.status(500).json({ error: "Failed to fetch card image" });
    }
  });

  // Save generated art to image database
  app.post("/api/admin/card-images", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parseResult = saveToImageDatabaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const userId = req.user?.claims?.sub;
      const { name, imageUrl, element, cardType, tags } = parseResult.data;

      const [newImage] = await db.insert(cardImages).values({
        name,
        imageUrl,
        element: element || null,
        cardType: cardType || "unit",
        tags: tags || [],
        createdBy: userId,
      }).returning();

      res.status(201).json(newImage);
    } catch (error) {
      console.error("Error saving card image:", error);
      res.status(500).json({ error: "Failed to save card image" });
    }
  });

  // Update card image metadata
  app.patch("/api/admin/card-images/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, element, cardType, tags } = req.body;
      
      const [updated] = await db.update(cardImages)
        .set({ 
          ...(name && { name }),
          ...(element !== undefined && { element }),
          ...(cardType && { cardType }),
          ...(tags && { tags }),
        })
        .where(eq(cardImages.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating card image:", error);
      res.status(500).json({ error: "Failed to update card image" });
    }
  });

  // Delete card image from database
  app.delete("/api/admin/card-images/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [deleted] = await db.delete(cardImages).where(eq(cardImages.id, req.params.id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json({ success: true, message: "Image deleted" });
    } catch (error) {
      console.error("Error deleting card image:", error);
      res.status(500).json({ error: "Failed to delete card image" });
    }
  });

  app.get("/api/admin/card-images/:id/download", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [image] = await db.select().from(cardImages).where(eq(cardImages.id, req.params.id));
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      const base64Match = image.imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const mimeType = `image/${base64Match[1]}`;
      const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
      const buffer = Buffer.from(base64Match[2], "base64");
      const safeName = image.name.replace(/[^a-zA-Z0-9_-]/g, "_");

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${ext}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading card image:", error);
      res.status(500).json({ error: "Failed to download image" });
    }
  });

  app.get("/api/cards/:id/image", isAuthenticated, async (req, res) => {
    try {
      const [mapping] = await db.select().from(cardImageMappings).where(eq(cardImageMappings.cardId, req.params.id));
      if (!mapping || !mapping.imageUrl) {
        return res.status(404).json({ error: "No image found for this card" });
      }

      const base64Match = mapping.imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const mimeType = `image/${base64Match[1]}`;
      const buffer = Buffer.from(base64Match[2], "base64");

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error fetching card image:", error);
      res.status(500).json({ error: "Failed to fetch card image" });
    }
  });

  app.get("/api/commanders/:id/image", isAuthenticated, async (req, res) => {
    try {
      const [mapping] = await db.select().from(commanderImageMappings).where(eq(commanderImageMappings.commanderId, req.params.id));
      if (!mapping || !mapping.imageUrl) {
        return res.status(404).json({ error: "No image found for this commander" });
      }

      const base64Match = mapping.imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const mimeType = `image/${base64Match[1]}`;
      const buffer = Buffer.from(base64Match[2], "base64");

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error fetching commander image:", error);
      res.status(500).json({ error: "Failed to fetch commander image" });
    }
  });

  // Enhanced card generation with modes (art/stats/both)
  app.post("/api/admin/generate-card", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parseResult = generateCardSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const data = parseResult.data;
      const result: any = {};

      // Generate art if mode is "art" or "both"
      if (data.mode === "art" || data.mode === "both") {
        if (!data.prompt) {
          return res.status(400).json({ error: "Prompt is required for art generation" });
        }
        
        const fullPrompt = `Create a fantasy trading card game artwork for a ${data.element || "magical"} themed card. ${data.prompt}. Style: High quality fantasy digital art, dramatic lighting, epic composition. Do not include any text or UI elements.`;
        const imageDataUrl = await generateImage(fullPrompt, data.referenceImageBase64);
        result.imageUrl = imageDataUrl;
      }

      // Generate or use stats if mode is "stats" or "both"
      if (data.mode === "stats" || data.mode === "both") {
        const stats: any = {
          element: data.element || "Fire",
        };

        // Power generation
        if (data.generatePower) {
          stats.power = data.powerValue ?? Math.floor(Math.random() * 10) + 1;
        }

        // Trait generation
        if (data.generateTrait) {
          stats.trait = data.traitValue ?? null;
          stats.traitValue = data.traitModifier ?? null;
        }

        // Buff generation
        if (data.generateBuff) {
          stats.buffModifier = data.buffValue ?? 0;
          stats.buffColor = data.buffColor ?? null;
        }

        // Debuff generation
        if (data.generateDebuff) {
          stats.debuffModifier = data.debuffValue ?? 0;
          stats.debuffColor = data.debuffColor ?? null;
        }

        result.stats = stats;

        // If mode is "both", create the card in the game database
        if (data.mode === "both" && result.imageUrl) {
          const cardName = data.cardName || `Generated ${data.element || "Mystic"} Unit`;
          const newCard = await storage.createCard({
            name: cardName,
            element: stats.element,
            power: stats.power || 5,
            trait: stats.trait || null,
            traitValue: stats.traitValue || null,
            buffModifier: stats.buffModifier || 0,
            buffColor: stats.buffColor || null,
            debuffModifier: stats.debuffModifier || 0,
            debuffColor: stats.debuffColor || null,
            description: data.prompt,
            imageUrl: result.imageUrl,
            isCommander: false,
          });
          result.card = newCard;
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Error generating card:", error);
      res.status(500).json({ error: "Failed to generate card" });
    }
  });

  // Swap image from image database to a card
  app.post("/api/admin/swap-card-image", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { cardId, imageId } = req.body;
      
      if (!cardId || !imageId) {
        return res.status(400).json({ error: "cardId and imageId are required" });
      }

      // Get the image from image database
      const [image] = await db.select().from(cardImages).where(eq(cardImages.id, imageId));
      if (!image) {
        return res.status(404).json({ error: "Image not found in image database" });
      }

      const card = await storage.updateCard(cardId, { imageUrl: image.imageUrl });
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      await db.insert(cardImageMappings).values({ cardId, imageUrl: image.imageUrl, imageId }).onConflictDoUpdate({ target: cardImageMappings.cardId, set: { imageUrl: image.imageUrl, imageId, updatedAt: new Date() } });

      res.json({ success: true, card, swappedImage: image });
    } catch (error) {
      console.error("Error swapping card image:", error);
      res.status(500).json({ error: "Failed to swap card image" });
    }
  });

  // Swap image from image database to a commander
  app.post("/api/admin/swap-commander-image", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { commanderId, imageId } = req.body;
      
      if (!commanderId || !imageId) {
        return res.status(400).json({ error: "commanderId and imageId are required" });
      }

      // Get the image from image database
      const [image] = await db.select().from(cardImages).where(eq(cardImages.id, imageId));
      if (!image) {
        return res.status(404).json({ error: "Image not found in image database" });
      }

      const commander = await storage.updateCommander(commanderId, { imageUrl: image.imageUrl });
      if (!commander) {
        return res.status(404).json({ error: "Commander not found" });
      }
      await db.insert(commanderImageMappings).values({ commanderId, imageUrl: image.imageUrl, imageId }).onConflictDoUpdate({ target: commanderImageMappings.commanderId, set: { imageUrl: image.imageUrl, imageId, updatedAt: new Date() } });

      res.json({ success: true, commander, swappedImage: image });
    } catch (error) {
      console.error("Error swapping commander image:", error);
      res.status(500).json({ error: "Failed to swap commander image" });
    }
  });

  // Upload image directly to image database (from computer)
  app.post("/api/admin/upload-card-image", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, imageBase64, element, cardType, tags } = req.body;
      
      if (!name || !imageBase64) {
        return res.status(400).json({ error: "name and imageBase64 are required" });
      }

      const userId = req.user?.claims?.sub;

      const [newImage] = await db.insert(cardImages).values({
        name,
        imageUrl: imageBase64, // Store as data URL
        element: element || null,
        cardType: cardType || "unit",
        tags: tags || [],
        createdBy: userId,
      }).returning();

      res.status(201).json(newImage);
    } catch (error) {
      console.error("Error uploading card image:", error);
      res.status(500).json({ error: "Failed to upload card image" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        createdAt: users.createdAt,
      }).from(users);

      const wsServer = getWebSocketServer();
      const usersWithStatus = allUsers.map((u) => ({
        ...u,
        isOnline: wsServer?.isUserOnline(u.id) || false,
      }));

      res.json(usersWithStatus);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/force-add-friend", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      if (targetUserId === adminId) {
        return res.status(400).json({ message: "Cannot add yourself as a friend" });
      }

      const existingFriendship = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.userId, adminId), eq(friendships.friendId, targetUserId)),
            and(eq(friendships.userId, targetUserId), eq(friendships.friendId, adminId))
          )
        )
        .limit(1);

      if (existingFriendship.length > 0) {
        return res.status(400).json({ message: "Already friends with this user" });
      }

      await db.insert(friendships).values([
        { userId: adminId, friendId: targetUserId },
        { userId: targetUserId, friendId: adminId },
      ]);

      const wsServer = getWebSocketServer();
      wsServer?.sendToUser(targetUserId, {
        type: "friend_request_accepted",
        payload: { friendId: adminId },
      });

      res.status(201).json({ message: "Friend added successfully" });
    } catch (error) {
      console.error("Error force-adding friend:", error);
      res.status(500).json({ error: "Failed to add friend" });
    }
  });

  app.get("/api/admin/database-export", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const tables = [
        "users", "user_decks", "friend_requests", "friendships", "friend_messages",
        "game_rooms", "room_spectators", "chat_messages",
        "player_ratings", "player_stats", "achievements", "player_achievements",
        "daily_challenges", "player_challenges", "deck_codes",
        "card_images", "card_image_mappings", "commander_image_mappings",
        "user_presence", "matchmaking_queue"
      ];

      const exportData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        version: "2.2.0",
        tables: {},
      };

      for (const table of tables) {
        try {
          const result = await db.execute(sql`SELECT * FROM ${sql.identifier(table)}`);
          exportData.tables[table] = {
            rowCount: result.rows.length,
            rows: result.rows,
          };
        } catch (err: any) {
          exportData.tables[table] = { error: err.message, rowCount: 0, rows: [] };
        }
      }

      const saveToFile = req.query.save === "true";
      if (saveToFile) {
        const backupDir = path.default.join(process.cwd(), "backups");
        if (!fs.default.existsSync(backupDir)) {
          fs.default.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `db-backup-${timestamp}.json`;
        const filepath = path.default.join(backupDir, filename);

        fs.default.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
        exportData.savedToFile = filepath;
        exportData.note = "Full backup including card image data saved to file.";
      }

      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting database:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  const SYNC_ACCESS_CODE = "4838";

  app.get("/api/admin/sync", async (req, res) => {
    const code = req.query.code as string;
    if (code !== SYNC_ACCESS_CODE) {
      return res.status(403).json({ error: "Invalid access code" });
    }

    try {
      const allCards = await storage.getCards();
      const allCommanders = await storage.getCommanders();

      res.json({
        version: "2.2.0",
        syncedAt: new Date().toISOString(),
        cards: allCards,
        commanders: allCommanders,
        gameConstants: {
          ...GAME_CONSTANTS,
          ELEMENTS,
          TRAITS,
          BUFF_DEBUFF_COLORS,
          GAME_PHASES,
          AI_DIFFICULTY,
          GAME_STATUS,
          GAME_MODE_CONFIG,
        },
        deckRules: {
          deckSize: GAME_CONSTANTS.DECK_SIZE,
          maxCopiesPerCard: GAME_CONSTANTS.MAX_COPIES_PER_CARD,
          cardsPerPowerRank: GAME_CONSTANTS.CARDS_PER_POWER_RANK,
          powerDistribution: "40 cards total: 4 cards at each power level 1-10. Max 3 copies of any single card.",
          requiresCommander: true,
        },
        databaseSchemas: {
          users: { table: "users", columns: { id: "varchar PK (uuid)", email: "varchar unique", firstName: "varchar", lastName: "varchar", profileImageUrl: "varchar", createdAt: "timestamp", updatedAt: "timestamp" } },
          userDecks: { table: "user_decks", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id", name: "varchar", commanderId: "varchar", cardIds: "text[]", createdAt: "timestamp", updatedAt: "timestamp" } },
          friendRequests: { table: "friend_requests", columns: { id: "varchar PK (uuid)", senderId: "varchar FK->users.id", receiverId: "varchar FK->users.id", status: "varchar (pending|accepted|declined)", createdAt: "timestamp", updatedAt: "timestamp" } },
          friendships: { table: "friendships", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id", friendId: "varchar FK->users.id", createdAt: "timestamp" } },
          friendMessages: { table: "friend_messages", columns: { id: "varchar PK (uuid)", senderId: "varchar FK->users.id", receiverId: "varchar FK->users.id", message: "text", createdAt: "timestamp" } },
          gameRooms: { table: "game_rooms", columns: { id: "varchar PK (uuid)", name: "varchar(100)", hostId: "varchar FK->users.id", guestId: "varchar FK->users.id nullable", isPrivate: "boolean", password: "varchar(100) nullable", status: "varchar (waiting|ready|in_game|completed)", hostDeckId: "varchar", guestDeckId: "varchar", hostReady: "boolean", guestReady: "boolean", gameId: "varchar", maxSpectators: "integer default 10", settings: "jsonb", createdAt: "timestamp", updatedAt: "timestamp" } },
          roomSpectators: { table: "room_spectators", columns: { id: "varchar PK (uuid)", roomId: "varchar FK->game_rooms.id", userId: "varchar FK->users.id", joinedAt: "timestamp" } },
          chatMessages: { table: "chat_messages", columns: { id: "varchar PK (uuid)", roomId: "varchar FK->game_rooms.id nullable", gameId: "varchar nullable", senderId: "varchar FK->users.id", message: "text", createdAt: "timestamp" } },
          playerRatings: { table: "player_ratings", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id unique", rating: "integer default 1000", wins: "integer default 0", losses: "integer default 0", streak: "integer default 0", highestRating: "integer default 1000", updatedAt: "timestamp" } },
          playerStats: { table: "player_stats", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id unique", totalXp: "integer default 0", level: "integer default 1", gamesPlayed: "integer default 0", gamesWon: "integer default 0", gamesLost: "integer default 0", totalDamageDealt: "integer default 0", totalCardsPlayed: "integer default 0", favoriteElement: "varchar(20)", favoriteCommander: "varchar", longestWinStreak: "integer default 0", currentWinStreak: "integer default 0", updatedAt: "timestamp" } },
          achievements: { table: "achievements", columns: { id: "varchar PK (uuid)", name: "varchar(100)", description: "text", category: "varchar (wins|games|collection|social|special)", icon: "varchar(50)", requirement: "integer", xpReward: "integer default 100", isSecret: "boolean", createdAt: "timestamp" } },
          playerAchievements: { table: "player_achievements", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id", achievementId: "varchar FK->achievements.id", progress: "integer default 0", unlockedAt: "timestamp nullable", createdAt: "timestamp" } },
          dailyChallenges: { table: "daily_challenges", columns: { id: "varchar PK (uuid)", name: "varchar(100)", description: "text", challengeType: "varchar (win_games|play_element|deal_damage|use_commander|play_cards)", requirement: "integer", elementFilter: "varchar(20) nullable", xpReward: "integer default 50", activeDate: "timestamp", createdAt: "timestamp" } },
          playerChallenges: { table: "player_challenges", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id", challengeId: "varchar FK->daily_challenges.id", progress: "integer default 0", completedAt: "timestamp nullable", claimedAt: "timestamp nullable", createdAt: "timestamp" } },
          deckCodes: { table: "deck_codes", columns: { id: "varchar PK (uuid)", code: "varchar(20) unique", deckName: "varchar(100)", commanderId: "varchar", cardIds: "jsonb", creatorId: "varchar FK->users.id nullable", isPublic: "boolean", uses: "integer default 0", createdAt: "timestamp" } },
          cardImages: { table: "card_images", columns: { id: "varchar PK (uuid)", name: "varchar", imageUrl: "text (base64 data URL)", element: "varchar nullable", cardType: "varchar (unit|commander)", tags: "text[]", createdAt: "timestamp", createdBy: "varchar FK->users.id" } },
          cardImageMappings: { table: "card_image_mappings", columns: { cardId: "varchar PK", imageUrl: "text", imageId: "varchar FK->card_images.id nullable", updatedAt: "timestamp" } },
          commanderImageMappings: { table: "commander_image_mappings", columns: { commanderId: "varchar PK", imageUrl: "text", imageId: "varchar FK->card_images.id nullable", updatedAt: "timestamp" } },
          userPresence: { table: "user_presence", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id unique", status: "varchar (online|offline|in_game)", currentRoomId: "varchar nullable", currentGameId: "varchar nullable", lastSeen: "timestamp" } },
          matchmakingQueue: { table: "matchmaking_queue", columns: { id: "varchar PK (uuid)", userId: "varchar FK->users.id unique", deckId: "varchar", rating: "integer default 1000", queueType: "varchar (ranked)", joinedAt: "timestamp" } },
        },
        apiEndpoints: {
          auth: {
            login: { method: "POST", path: "/api/mobile/auth/login", body: { email: "string (required)", firstName: "string", lastName: "string", profileImageUrl: "string", provider: "google|apple", providerToken: "string" }, response: "{ token, user }" },
            refresh: { method: "POST", path: "/api/mobile/auth/refresh", auth: "Bearer token", response: "{ token }" },
            me: { method: "GET", path: "/api/mobile/auth/me", auth: "Bearer token", response: "{ id, email, firstName, lastName, profileImageUrl }" },
            webLogin: { method: "GET", path: "/api/login", response: "Redirect to Replit OIDC" },
            webUser: { method: "GET", path: "/api/auth/user", response: "{ id, email, firstName, lastName, profileImageUrl }" },
            updateProfile: { method: "PATCH", path: "/api/user/profile", auth: "Bearer/session", body: { firstName: "string", lastName: "string" }, response: "{ user }" },
          },
          cards: {
            list: { method: "GET", path: "/api/cards", response: "Card[]" },
            get: { method: "GET", path: "/api/cards/:id", response: "Card" },
            byElement: { method: "GET", path: "/api/cards/element/:element", response: "Card[]" },
          },
          commanders: {
            list: { method: "GET", path: "/api/commanders", response: "Commander[]" },
            get: { method: "GET", path: "/api/commanders/:id", response: "Commander" },
          },
          decks: {
            list: { method: "GET", path: "/api/decks?playerId=X", response: "Deck[]" },
            userDecks: { method: "GET", path: "/api/user-decks", auth: "Bearer/session", response: "UserDeck[]" },
            save: { method: "POST", path: "/api/user-decks", auth: "Bearer/session", body: { name: "string", commanderId: "string", cardIds: "string[]" }, response: "UserDeck" },
            update: { method: "PUT", path: "/api/user-decks/:id", auth: "Bearer/session", body: { name: "string", commanderId: "string", cardIds: "string[]" }, response: "UserDeck" },
            delete: { method: "DELETE", path: "/api/user-decks/:id", auth: "Bearer/session" },
            aiSuggest: { method: "POST", path: "/api/deck-suggestion", body: { commanderId: "string", playstyle: "aggressive|defensive|balanced" }, response: "{ suggestion: string }" },
          },
          multiplayer: {
            rooms: { method: "GET", path: "/api/rooms", auth: "Bearer/session", response: "GameRoom[]" },
            createRoom: { method: "POST", path: "/api/rooms", auth: "Bearer/session", body: { name: "string", isPrivate: "boolean", password: "string optional" } },
            friends: { method: "GET", path: "/api/friends", auth: "Bearer/session", response: "{ friends, pendingRequests }" },
            sendFriendRequest: { method: "POST", path: "/api/friends/request", auth: "Bearer/session", body: { targetUserId: "string" } },
            acceptFriendRequest: { method: "POST", path: "/api/friends/accept", auth: "Bearer/session", body: { requestId: "string" } },
          },
          progression: {
            leaderboard: { method: "GET", path: "/api/leaderboard", response: "PlayerRating[]" },
            stats: { method: "GET", path: "/api/stats", auth: "Bearer/session", response: "PlayerStats" },
            achievements: { method: "GET", path: "/api/achievements", auth: "Bearer/session", response: "{ achievements, playerAchievements }" },
            challenges: { method: "GET", path: "/api/daily-challenges", auth: "Bearer/session", response: "{ challenges, playerProgress }" },
          },
          images: {
            cardImage: { method: "GET", path: "/api/cards/:id/image", auth: "Bearer/session", response: "Binary image (Content-Type varies: image/png, image/jpeg, etc.). Returns the mapped artwork for a specific unit card." },
            commanderImage: { method: "GET", path: "/api/commanders/:id/image", auth: "Bearer/session", response: "Binary image (Content-Type varies: image/png, image/jpeg, etc.). Returns the mapped artwork for a specific commander." },
            adminDownload: { method: "GET", path: "/api/admin/card-images/:id/download", auth: "Bearer (admin)", response: "Binary image download with Content-Disposition attachment header. Content-Type varies by stored format." },
            adminManifest: { method: "GET", path: "/api/admin/card-images/bulk/download-manifest", auth: "Bearer (admin)", response: "{ total: number, images: [{ id, name, element, cardType, createdAt, downloadUrl }] }. Use downloadUrl for each image to fetch the binary file." },
            adminList: { method: "GET", path: "/api/admin/card-images", auth: "Bearer (admin)", response: "CardImage[] with full base64 imageUrl included." },
          },
          health: { method: "GET", path: "/api/health", response: "{ status: 'ok', version, uptime }" },
          docs: { method: "GET", path: "/api/docs", response: "Full API documentation JSON" },
        },
        websocketEvents: {
          connection: "wss://<host>/ws?token=<jwt> or via session cookie",
          clientEvents: [
            "join_room", "leave_room", "select_deck", "toggle_ready",
            "game_action", "chat_message", "send_emote",
            "join_matchmaking", "cancel_matchmaking",
          ],
          serverEvents: [
            "room_update", "game_start", "game_state", "game_over",
            "chat_message", "emote", "player_joined", "player_left",
            "spectator_joined", "spectator_left",
            "friend_request", "friend_request_accepted", "friend_online", "friend_offline",
            "matchmaking_found",
          ],
        },
        gameMechanics: {
          turnPhases: ["Draw Phase: Draw cards from deck", "Deployment Phase: Play units to battlefield", "Combat Phase: Use commander abilities, resolve buffs/debuffs", "Calculation Phase: Compare battlefield power totals", "End Phase: Resolve damage, check victory conditions"],
          victoryConditions: "Reduce opponent HP from 40 to 0",
          elements: { Fire: "Offensive power, direct damage abilities", Water: "Control and healing abilities", Earth: "Defensive and resilient abilities", Air: "Speed and evasion abilities", Nature: "Growth and resource abilities" },
          counterSystem: "Commanders earn advance counters from won battles and defeat counters from lost battles. Abilities cost advance or defeat counters to activate.",
          commanderAbilityCategories: {
            groupBuffsDebuffs: {
              description: "Abilities that modify power for groups of units (all allies, all enemies, or units matching element/trait criteria).",
              effectTypes: ["buff_element_unit", "debuff_enemy", "reduce_power", "growth_buff", "block_effects", "negate_and_halve", "protect_element"],
              validPhase: "combat",
            },
            traitActivation: {
              description: "Abilities that grant trait-like effects (Quick Strike, Guardian/Shield, Restoration) with numeric values.",
              effectTypes: ["first_strike", "add_shield", "healing_factor", "add_evasion"],
              validPhase: "combat",
              mechanicDetails: {
                first_strike: "AbilityBuff type 'first_strike' — deals pre-combat damage equal to value AND adds power to matching units",
                add_shield: "AbilityBuff type 'shield' — blocks incoming damage equal to value AND adds power to matching units",
                healing_factor: "AbilityBuff type 'heal' — heals player HP equal to value after combat AND adds power to matching units",
                add_evasion: "Same as add_shield (uses 'shield' buff type)",
              },
            },
            traitLikeGroupEffects: {
              description: "Broader versions of trait activation that apply to ALL units or enemy units, not just a specific element.",
              note: "Use same effect types as traitActivation but with target='all' for broader reach.",
            },
            extraDeployments: {
              description: "Abilities that allow deploying additional units beyond the normal 2-card limit.",
              effectTypes: ["extra_deploy"],
              validPhase: "deployment (ONLY — this is critical)",
            },
          },
          abilityBuffTypes: {
            note: "AbilityBuff entries have a 'type' field that determines special behavior beyond power modification.",
            types: {
              buff: "Pure power buff (no special mechanic)",
              debuff: "Pure power debuff (no special mechanic)",
              reduce: "Same as debuff",
              growth: "Same as buff",
              shield: "ALSO blocks incoming damage equal to value (like Guardian trait)",
              first_strike: "ALSO deals pre-combat damage equal to value (like Quick Strike trait)",
              heal: "ALSO heals player HP equal to value after combat (like Restoration trait)",
              heal_buff: "Power buff only (heal_and_buff ability heals HP directly, not through this type)",
            },
          },
          combatLogSchema: {
            note: "Combat log now includes abilityEffects field showing which commander abilities were active during each round.",
            abilityEffects: "Array<{ playerSide: string, abilityName: string, effectDescription: string, phase: string }>",
            displayNote: "Show ability effects as a separate step in combat log UI. Color-code by player side (green=you, red=opponent).",
          },
          commanderInfoButtons: {
            note: "Game board has two 'Commander' buttons — one showing your commander details/abilities, one showing opponent's. Both visible during gameplay. Use allCommanders + opponentCommanderId from server state to look up opponent commander.",
          },
        },
      });
    } catch (error) {
      console.error("Error generating sync data:", error);
      res.status(500).json({ error: "Failed to generate sync data" });
    }
  });

  app.get("/api/friend-messages/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendId } = req.params;

      const isFriend = await db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)))
        .limit(1);

      if (isFriend.length === 0) {
        return res.status(403).json({ message: "You can only view messages with friends" });
      }

      await db.delete(friendMessages).where(
        lt(friendMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      );

      const msgs = await db
        .select()
        .from(friendMessages)
        .where(
          or(
            and(eq(friendMessages.senderId, userId), eq(friendMessages.receiverId, friendId)),
            and(eq(friendMessages.senderId, friendId), eq(friendMessages.receiverId, userId))
          )
        )
        .orderBy(friendMessages.createdAt)
        .limit(100);

      res.json(msgs);
    } catch (error) {
      console.error("Error fetching friend messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/friend-messages/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const isFriend = await db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)))
        .limit(1);

      if (isFriend.length === 0) {
        return res.status(403).json({ message: "You can only message friends" });
      }

      const filteredMessage = filterObscenity(message.trim());

      const [msg] = await db
        .insert(friendMessages)
        .values({ senderId: userId, receiverId: friendId, message: filteredMessage })
        .returning();

      const wsServer = getWebSocketServer();
      wsServer?.sendToUser(friendId, {
        type: "friend_message",
        payload: { id: msg.id, senderId: userId, receiverId: friendId, message: filteredMessage, createdAt: msg.createdAt },
      });

      res.status(201).json(msg);
    } catch (error) {
      console.error("Error sending friend message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  setInterval(async () => {
    try {
      await db.delete(friendMessages).where(
        lt(friendMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      );
    } catch (e) {
      console.error("Error cleaning up old messages:", e);
    }
  }, 60 * 60 * 1000);

  function getTierForRating(rating: number): string {
    let tier = "Bronze";
    for (const t of RANKED_TIERS) {
      if (rating >= t.minRating) tier = t.name;
    }
    return tier;
  }

  async function backfillPremiumLevels() {
    await db.execute(sql`
      UPDATE battle_pass_levels 
      SET is_premium = true 
      WHERE is_premium = false AND (level % 10 = 0 OR (level >= 25 AND level % 5 = 0))
    `);
  }

  async function seedCurrentSeason() {
    const [existing] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
    if (existing) {
      await backfillPremiumLevels();
      return;
    }

    const now = new Date();
    let seasonDurationDays = 30;
    try {
      const [cfg] = await db.select().from(serverConfig).where(eq(serverConfig.key, "season_duration_days")).limit(1);
      if (cfg && typeof cfg.value === "number") seasonDurationDays = cfg.value;
    } catch (_e) {}
    const endsAt = new Date(now.getTime() + seasonDurationDays * 24 * 60 * 60 * 1000);

    const [season] = await db.insert(seasons).values({
      name: "Season 1: Dawn of the Elements",
      seasonNumber: 1,
      startsAt: now,
      endsAt,
      isActive: true,
      ratingBaseline: 1000,
    }).onConflictDoNothing().returning();

    if (season) {
      const bpLevels = [];
      for (let i = 1; i <= 50; i++) {
        const xpRequired = i * 200;
        let rewardType: string;
        let rewardAmount: number;
        let rewardDescription: string;

        if (i % 10 === 0) {
          rewardType = "pack";
          rewardAmount = i === 50 ? 3 : 1;
          rewardDescription = i === 50 ? "3x Premium Packs" : "1x Standard Pack";
        } else if (i % 5 === 0) {
          rewardType = "gems";
          rewardAmount = 50 + Math.floor(i / 10) * 25;
          rewardDescription = `${rewardAmount} Gems`;
        } else if (i % 3 === 0) {
          rewardType = "dust";
          rewardAmount = 25 + Math.floor(i / 5) * 15;
          rewardDescription = `${rewardAmount} Dust`;
        } else {
          rewardType = "gold";
          rewardAmount = 50 + Math.floor(i / 5) * 25;
          rewardDescription = `${rewardAmount} Gold`;
        }

        const isPremiumLevel = i % 10 === 0 || (i >= 25 && i % 5 === 0);

        bpLevels.push({
          seasonId: season.id,
          level: i,
          xpRequired,
          rewardType,
          rewardAmount,
          rewardDescription,
          isPremium: isPremiumLevel,
        });
      }
      await db.insert(battlePassLevels).values(bpLevels).onConflictDoNothing();

      const weeklyDefs = [
        { type: "win_games", desc: "Win 5 matches", req: 5 },
        { type: "play_element", desc: "Play 20 cards of any element", req: 20 },
        { type: "deal_damage", desc: "Deal 100 total damage", req: 100 },
      ];

      for (let week = 1; week <= 5; week++) {
        const weekStart = new Date(now.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        const challenges = weeklyDefs.map(w => ({
          seasonId: season.id,
          weekNumber: week,
          challengeType: w.type,
          description: w.desc,
          requirement: w.req,
          xpReward: 300,
          goldReward: 50,
          activeFrom: weekStart,
          activeUntil: weekEnd,
        }));
        await db.insert(weeklyChallenges).values(challenges).onConflictDoNothing();
      }

      console.log(`[season] Seeded Season 1 with 50 battle pass levels and 15 weekly challenges`);
    }
  }

  seedCurrentSeason().catch(e => console.error("[season] Failed to seed season:", e));
  import("./seasonService").then(({ startSeasonChecker, checkAndTransitionSeason }) => {
    checkAndTransitionSeason().catch(e => console.error("[season] Initial transition check error:", e));
    startSeasonChecker();
  });

  app.get("/api/season/current", async (_req, res) => {
    try {
      const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      if (!season) {
        return res.json(null);
      }

      const daysRemaining = Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      res.json({
        id: season.id,
        name: season.name,
        seasonNumber: season.seasonNumber,
        startsAt: season.startsAt.toISOString(),
        endsAt: season.endsAt.toISOString(),
        daysRemaining,
        isActive: season.isActive,
        tiers: RANKED_TIERS,
      });
    } catch (error) {
      console.error("Error fetching current season:", error);
      res.status(500).json({ error: "Failed to fetch season" });
    }
  });

  app.get("/api/season/rewards", async (_req, res) => {
    try {
      res.json({
        tiers: RANKED_TIERS.map(t => ({
          ...t,
          rewards: SEASON_REWARDS[t.name] || { gold: 0, packs: 0, dust: 0 },
        })),
      });
    } catch (error) {
      console.error("Error fetching season rewards:", error);
      res.status(500).json({ error: "Failed to fetch season rewards" });
    }
  });

  app.get("/api/season/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const history = await db.select().from(seasonHistory).where(eq(seasonHistory.userId, userId));
      res.json(history);
    } catch (error) {
      console.error("Error fetching season history:", error);
      res.status(500).json({ error: "Failed to fetch season history" });
    }
  });

  app.get("/api/battlepass", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      if (!season) return res.json({ season: null, progress: null, levels: [] });

      let [progress] = await db.select().from(playerBattlePass)
        .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
        .limit(1);

      if (!progress) {
        [progress] = await db.insert(playerBattlePass).values({
          userId,
          seasonId: season.id,
          currentXp: 0,
          currentLevel: 0,
          claimedLevels: "[]",
        }).returning();
      }

      const levels = await db.select().from(battlePassLevels)
        .where(eq(battlePassLevels.seasonId, season.id));

      const sortedLevels = levels.sort((a, b) => a.level - b.level);
      const claimed: number[] = JSON.parse(progress.claimedLevels || "[]");

      const xpForNextLevel = sortedLevels.find(l => l.level === progress.currentLevel + 1)?.xpRequired ?? 0;
      const totalXpToCurrentLevel = sortedLevels
        .filter(l => l.level <= progress.currentLevel)
        .reduce((sum, l) => sum + l.xpRequired, 0);
      const xpIntoCurrentLevel = progress.currentXp - totalXpToCurrentLevel;

      res.json({
        season: {
          id: season.id,
          name: season.name,
          endsAt: season.endsAt.toISOString(),
          daysRemaining: Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
        },
        progress: {
          currentXp: progress.currentXp,
          currentLevel: progress.currentLevel,
          xpIntoCurrentLevel: Math.max(0, xpIntoCurrentLevel),
          xpForNextLevel,
          claimedLevels: claimed,
          premiumUnlocked: progress.premiumUnlocked ?? false,
        },
        levels: sortedLevels.map(l => ({
          level: l.level,
          xpRequired: l.xpRequired,
          rewardType: l.rewardType,
          rewardAmount: l.rewardAmount,
          rewardDescription: l.rewardDescription,
          isPremium: l.isPremium,
          claimed: claimed.includes(l.level),
          unlocked: l.level <= progress.currentLevel,
        })),
      });
    } catch (error) {
      console.error("Error fetching battle pass:", error);
      res.status(500).json({ error: "Failed to fetch battle pass" });
    }
  });

  app.post("/api/battlepass/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { level } = req.body;
      if (!level || typeof level !== "number") return res.status(400).json({ error: "Level is required" });

      const result = await db.transaction(async (tx) => {
        const [season] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
        if (!season) throw new Error("NO_ACTIVE_SEASON");

        const [progress] = await tx.select().from(playerBattlePass)
          .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
          .limit(1);
        if (!progress) throw new Error("NO_PROGRESS");

        if (level > progress.currentLevel) throw new Error("LEVEL_NOT_UNLOCKED");

        const originalClaimedStr = progress.claimedLevels || "[]";
        const claimed: number[] = JSON.parse(originalClaimedStr);
        if (claimed.includes(level)) throw new Error("ALREADY_CLAIMED");

        const [bpLevel] = await tx.select().from(battlePassLevels)
          .where(and(eq(battlePassLevels.seasonId, season.id), eq(battlePassLevels.level, level)))
          .limit(1);
        if (!bpLevel) throw new Error("INVALID_LEVEL");

        if (bpLevel.isPremium && !progress.premiumUnlocked) {
          throw new Error("PREMIUM_REQUIRED");
        }

        const [existingCur] = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        if (!existingCur) {
          await tx.insert(playerCurrencies).values({
            userId,
            gold: ECONOMY_CONSTANTS.STARTER_GOLD,
            gems: ECONOMY_CONSTANTS.STARTER_GEMS,
            dust: ECONOMY_CONSTANTS.STARTER_DUST,
            updatedAt: new Date(),
          });
        }

        if (bpLevel.rewardType === "gold") {
          await tx.update(playerCurrencies)
            .set({ gold: sql`LEAST(gold + ${bpLevel.rewardAmount}, ${ECONOMY_CONSTANTS.MAX_CURRENCY})`, updatedAt: new Date() })
            .where(eq(playerCurrencies.userId, userId));
        } else if (bpLevel.rewardType === "gems") {
          await tx.update(playerCurrencies)
            .set({ gems: sql`LEAST(gems + ${bpLevel.rewardAmount}, ${ECONOMY_CONSTANTS.MAX_CURRENCY})`, updatedAt: new Date() })
            .where(eq(playerCurrencies.userId, userId));
        } else if (bpLevel.rewardType === "dust") {
          await tx.update(playerCurrencies)
            .set({ dust: sql`LEAST(dust + ${bpLevel.rewardAmount}, ${ECONOMY_CONSTANTS.MAX_CURRENCY})`, updatedAt: new Date() })
            .where(eq(playerCurrencies.userId, userId));
        } else if (bpLevel.rewardType === "pack") {
          const packType = bpLevel.rewardAmount >= 3 ? "premium" : "standard";
          for (let p = 0; p < bpLevel.rewardAmount; p++) {
            const packDef = PACK_TYPES[packType as keyof typeof PACK_TYPES];
            const allCards = await storage.getCards();
            const filteredCards = allCards.filter(c => c.rarity);
            for (let ci = 0; ci < packDef.cardsPerPack; ci++) {
              const card = filteredCards[Math.floor(Math.random() * filteredCards.length)];
              if (card) {
                await tx.insert(playerCollection).values({ userId, cardId: card.id, quantity: 1 })
                  .onConflictDoUpdate({
                    target: [playerCollection.userId, playerCollection.cardId],
                    set: { quantity: sql`${playerCollection.quantity} + 1` },
                  });
              }
            }
          }
        } else if (bpLevel.rewardType === "card") {
          if (bpLevel.rewardCardId) {
            await tx.insert(playerCollection).values({ userId, cardId: bpLevel.rewardCardId, quantity: bpLevel.rewardAmount })
              .onConflictDoUpdate({
                target: [playerCollection.userId, playerCollection.cardId],
                set: { quantity: sql`${playerCollection.quantity} + ${bpLevel.rewardAmount}` },
              });
          } else {
            const allCards = await storage.getCards();
            const filteredCards = allCards.filter(c => c.rarity);
            for (let ci = 0; ci < bpLevel.rewardAmount; ci++) {
              const card = filteredCards[Math.floor(Math.random() * filteredCards.length)];
              if (card) {
                await tx.insert(playerCollection).values({ userId, cardId: card.id, quantity: 1 })
                  .onConflictDoUpdate({
                    target: [playerCollection.userId, playerCollection.cardId],
                    set: { quantity: sql`${playerCollection.quantity} + 1` },
                  });
              }
            }
          }
        }

        claimed.push(level);
        const newClaimedStr = JSON.stringify(claimed);
        const [updateResult] = await tx.update(playerBattlePass)
          .set({ claimedLevels: newClaimedStr, updatedAt: new Date() })
          .where(and(
            eq(playerBattlePass.id, progress.id),
            eq(playerBattlePass.claimedLevels, originalClaimedStr)
          ))
          .returning();
        if (!updateResult) throw new Error("ALREADY_CLAIMED");

        const [currencies] = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId));

        return {
          claimed: true,
          level,
          rewardType: bpLevel.rewardType,
          rewardAmount: bpLevel.rewardAmount,
          rewardDescription: bpLevel.rewardDescription,
          currencies: currencies ? { gold: currencies.gold, gems: currencies.gems, dust: currencies.dust } : null,
        };
      });

      res.json(result);
    } catch (error: any) {
      const msg = error?.message;
      if (msg === "NO_ACTIVE_SEASON") return res.status(400).json({ error: "No active season" });
      if (msg === "NO_PROGRESS") return res.status(400).json({ error: "No battle pass progress found" });
      if (msg === "LEVEL_NOT_UNLOCKED") return res.status(400).json({ error: "Level not unlocked yet" });
      if (msg === "ALREADY_CLAIMED") return res.status(400).json({ error: "Reward already claimed" });
      if (msg === "PREMIUM_REQUIRED") return res.status(403).json({ error: "Premium battle pass required to claim this reward" });
      if (msg === "INVALID_LEVEL") return res.status(400).json({ error: "Invalid level" });
      console.error("Error claiming battle pass reward:", error);
      res.status(500).json({ error: "Failed to claim reward" });
    }
  });

  app.get("/api/weekly-challenges", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      if (!activeSeason) return res.json([]);

      const challenges = await db.select().from(weeklyChallenges)
        .where(and(
          eq(weeklyChallenges.seasonId, activeSeason.id),
          lte(weeklyChallenges.activeFrom, now),
          sql`${weeklyChallenges.activeUntil} > ${now}`
        ));

      if (challenges.length === 0) return res.json([]);

      const challengeIds = challenges.map(c => c.id);
      const playerProgress = await db.select().from(playerWeeklyChallenges)
        .where(and(
          eq(playerWeeklyChallenges.userId, userId),
          sql`${playerWeeklyChallenges.challengeId} IN (${sql.join(challengeIds.map(id => sql`${id}`), sql`, `)})`
        ));

      const progressMap = new Map(playerProgress.map(p => [p.challengeId, p]));

      const result = challenges.map(c => {
        const prog = progressMap.get(c.id);
        return {
          id: c.id,
          challengeType: c.challengeType,
          description: c.description,
          requirement: c.requirement,
          xpReward: c.xpReward,
          goldReward: c.goldReward,
          weekNumber: c.weekNumber,
          progress: prog?.progress ?? 0,
          completed: (prog?.completedAt ?? null) !== null,
          claimed: (prog?.claimedAt ?? null) !== null,
          activeUntil: c.activeUntil.toISOString(),
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching weekly challenges:", error);
      res.status(500).json({ error: "Failed to fetch weekly challenges" });
    }
  });

  app.post("/api/weekly-challenges/:id/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const challengeId = req.params.id;

      const result = await db.transaction(async (tx) => {
        const [activeSeason] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
        if (!activeSeason) throw new Error("NO_SEASON");

        const [challenge] = await tx.select().from(weeklyChallenges)
          .where(and(eq(weeklyChallenges.id, challengeId), eq(weeklyChallenges.seasonId, activeSeason.id)))
          .limit(1);
        if (!challenge) throw new Error("NOT_FOUND");

        const [progress] = await tx.select({
          id: playerWeeklyChallenges.id,
          userId: playerWeeklyChallenges.userId,
          challengeId: playerWeeklyChallenges.challengeId,
          progress: playerWeeklyChallenges.progress,
          completedAt: playerWeeklyChallenges.completedAt,
          claimedAt: playerWeeklyChallenges.claimedAt,
        }).from(playerWeeklyChallenges)
          .where(and(
            eq(playerWeeklyChallenges.userId, userId),
            eq(playerWeeklyChallenges.challengeId, challengeId)
          )).limit(1);

        if (!progress || !progress.completedAt) throw new Error("NOT_COMPLETED");
        if (progress.claimedAt) throw new Error("ALREADY_CLAIMED");

        const [updateResult] = await tx.update(playerWeeklyChallenges)
          .set({ claimedAt: new Date() })
          .where(and(
            eq(playerWeeklyChallenges.id, progress.id),
            sql`${playerWeeklyChallenges.claimedAt} IS NULL`
          ))
          .returning();
        if (!updateResult) throw new Error("ALREADY_CLAIMED");

        const [existingCur] = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
        if (!existingCur) {
          await tx.insert(playerCurrencies).values({
            userId,
            gold: ECONOMY_CONSTANTS.STARTER_GOLD,
            gems: ECONOMY_CONSTANTS.STARTER_GEMS,
            dust: ECONOMY_CONSTANTS.STARTER_DUST,
            updatedAt: new Date(),
          });
        }

        if (challenge.goldReward > 0) {
          await tx.update(playerCurrencies)
            .set({ gold: sql`LEAST(gold + ${challenge.goldReward}, ${ECONOMY_CONSTANTS.MAX_CURRENCY})`, updatedAt: new Date() })
            .where(eq(playerCurrencies.userId, userId));
        }

        if (challenge.xpReward > 0) {
          const [activeSeason] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
          if (activeSeason) {
            let [bp] = await tx.select().from(playerBattlePass)
              .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, activeSeason.id)))
              .limit(1);
            if (!bp) {
              [bp] = await tx.insert(playerBattlePass).values({
                userId,
                seasonId: activeSeason.id,
                currentXp: 0,
                currentLevel: 0,
                claimedLevels: "[]",
              }).onConflictDoNothing().returning();
              if (!bp) {
                [bp] = await tx.select().from(playerBattlePass)
                  .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, activeSeason.id)))
                  .limit(1);
              }
            }
            if (bp) {
              const newXp = bp.currentXp + challenge.xpReward;
              const allLevels = await tx.select().from(battlePassLevels)
                .where(eq(battlePassLevels.seasonId, activeSeason.id));
              const sorted = allLevels.sort((a, b) => a.level - b.level);
              let newLevel = 0;
              let xpAccum = 0;
              for (const l of sorted) {
                xpAccum += l.xpRequired;
                if (newXp >= xpAccum) newLevel = l.level;
                else break;
              }
              await tx.update(playerBattlePass)
                .set({ currentXp: newXp, currentLevel: newLevel, updatedAt: new Date() })
                .where(eq(playerBattlePass.id, bp.id));
            }
          }
        }

        const [currencies] = await tx.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId));

        return {
          claimed: true,
          goldReward: challenge.goldReward,
          xpReward: challenge.xpReward,
          currencies: currencies ? { gold: currencies.gold, gems: currencies.gems, dust: currencies.dust } : null,
        };
      });

      res.json(result);
    } catch (error: any) {
      const msg = error?.message;
      if (msg === "NO_SEASON") return res.status(400).json({ error: "No active season" });
      if (msg === "NOT_FOUND") return res.status(404).json({ error: "Challenge not found or not in current season" });
      if (msg === "NOT_COMPLETED") return res.status(400).json({ error: "Challenge not completed" });
      if (msg === "ALREADY_CLAIMED") return res.status(400).json({ error: "Reward already claimed" });
      console.error("Error claiming weekly challenge:", error);
      res.status(500).json({ error: "Failed to claim reward" });
    }
  });

  app.get("/api/season/player-rank", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      if (!season) return res.json({ season: null, rank: null });

      const [rating] = await db.select().from(playerRatings).where(eq(playerRatings.userId, userId)).limit(1);

      const currentRating = rating?.rating ?? 1000;
      const highestRating = rating?.highestRating ?? 1000;
      const tier = getTierForRating(currentRating);
      const peakTier = getTierForRating(highestRating);

      const currentTierData = RANKED_TIERS.find(t => t.name === tier);
      const nextTierData = RANKED_TIERS.find(t => t.minRating > (currentTierData?.minRating ?? 0));

      res.json({
        currentRating,
        highestRating,
        tier,
        peakTier,
        nextTier: nextTierData ? {
          name: nextTierData.name,
          ratingNeeded: nextTierData.minRating - currentRating,
        } : null,
        seasonRewards: SEASON_REWARDS[peakTier] || SEASON_REWARDS["Bronze"],
      });
    } catch (error) {
      console.error("Error fetching player rank:", error);
      res.status(500).json({ error: "Failed to fetch player rank" });
    }
  });
}
