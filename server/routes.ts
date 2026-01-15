import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertCardSchema, insertDeckSchema, insertPlayerSchema, insertGameSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerMultiplayerRoutes } from "./multiplayerRoutes";

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
}
