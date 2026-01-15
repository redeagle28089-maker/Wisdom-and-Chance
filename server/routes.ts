import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertCardSchema, insertDeckSchema, insertPlayerSchema, insertGameSchema, ELEMENTS } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerMultiplayerRoutes } from "./multiplayerRoutes";
import { generateImage } from "./replit_integrations/image/client";

const ADMIN_EMAIL = "redeagle28089@gmail.com";

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
