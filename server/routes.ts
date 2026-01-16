import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertCardSchema, insertDeckSchema, insertPlayerSchema, insertGameSchema, ELEMENTS, userDecks, insertUserDeckSchema, GAME_CONSTANTS } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerMultiplayerRoutes } from "./multiplayerRoutes";
import { generateImage, generateText } from "./replit_integrations/image/client";

const ADMIN_EMAIL = "redeagle28089@gmail.com";

const deckSuggestionSchema = z.object({
  commanderId: z.string().min(1, "Commander is required"),
  playstyle: z.enum(["aggressive", "defensive", "balanced"]),
});

const generateArtSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt too long"),
  element: z.enum(ELEMENTS).optional(),
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
  registerMultiplayerRoutes(app);
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
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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
    if (!req.user || req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin routes for card art generation
  app.get("/api/admin/check", isAuthenticated, (req: any, res) => {
    const isAdminUser = req.user?.email === ADMIN_EMAIL;
    res.json({ isAdmin: isAdminUser });
  });

  app.post("/api/admin/generate-card-art", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parseResult = generateArtSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten().fieldErrors });
      }

      const { prompt, element } = parseResult.data;
      const fullPrompt = `Create a fantasy trading card game artwork for a ${element || "magical"} themed card. ${prompt}. Style: High quality fantasy digital art, dramatic lighting, epic composition. Do not include any text or UI elements.`;

      const imageDataUrl = await generateImage(fullPrompt);
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
    res.json(commander);
  });
}
