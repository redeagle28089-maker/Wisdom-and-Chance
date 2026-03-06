import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { eq, or, and, lt, desc, sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertCardSchema, insertDeckSchema, insertPlayerSchema, insertGameSchema, ELEMENTS, userDecks, insertUserDeckSchema, GAME_CONSTANTS, cardImages, insertCardImageSchema, TRAITS, BUFF_DEBUFF_COLORS, users, friendships, friendMessages, cardImageMappings, commanderImageMappings, GAME_PHASES, GAME_MODE_CONFIG, AI_DIFFICULTY, GAME_STATUS } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerMultiplayerRoutes } from "./multiplayerRoutes";
import { registerMobileAuthRoutes } from "./mobileAuth";
import { registerApiDocsRoutes } from "./apiDocs";
import { isUnifiedAuth } from "./unifiedAuth";
import jwt from "jsonwebtoken";
import { generateImage, generateText } from "./replit_integrations/image/client";
import { getWebSocketServer } from "./websocket";
import { filterObscenity } from "./obscenity-filter";
import { gameEngine } from "./gameEngine";

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

  app.get("/api/health", async (_req, res) => {
    try {
      const [dbCheck] = await db.select({ now: sql`NOW()` }).from(sql`(SELECT 1) AS t`);
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "2.1.0",
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
        version: "2.1.0",
        database: "error",
      });
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

  async function validateDeckCards(cardIds: string[]): Promise<{ valid: boolean; error?: string }> {
    const allCards = await storage.getCards();
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    // Check all cards exist
    const invalidCards = cardIds.filter(id => !cardMap.has(id));
    if (invalidCards.length > 0) {
      return { valid: false, error: `Invalid card IDs: ${invalidCards.slice(0, 5).join(", ")}` };
    }

    // Check max 3 copies per card
    const cardCounts = new Map<string, number>();
    for (const cardId of cardIds) {
      const count = (cardCounts.get(cardId) || 0) + 1;
      if (count > GAME_CONSTANTS.MAX_COPIES_PER_CARD) {
        const card = cardMap.get(cardId);
        return { valid: false, error: `Maximum ${GAME_CONSTANTS.MAX_COPIES_PER_CARD} copies of "${card?.name}" allowed` };
      }
      cardCounts.set(cardId, count);
    }

    // Check 4 cards per power rank
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

      // Validate deck cards (existence, copies, power distribution)
      const deckValidation = await validateDeckCards(cardIds);
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

      // Validate cards if provided (existence, copies, power distribution)
      if (updates.cardIds) {
        const deckValidation = await validateDeckCards(updates.cardIds);
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
}
