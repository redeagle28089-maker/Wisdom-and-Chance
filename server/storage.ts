import {
  type Card,
  type InsertCard,
  type Commander,
  type InsertCommander,
  type Deck,
  type InsertDeck,
  type Player,
  type InsertPlayer,
  type Game,
  type InsertGame,
  ELEMENTS,
  TRAITS,
  BUFF_DEBUFF_COLORS,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  getCardsByElement(element: string): Promise<Card[]>;
  createCard(card: InsertCard): Promise<Card>;

  getCommanders(): Promise<Commander[]>;
  getCommander(id: string): Promise<Commander | undefined>;
  createCommander(commander: InsertCommander): Promise<Commander>;

  getDecks(): Promise<Deck[]>;
  getDecksByPlayer(playerId: string): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | undefined>;
  createDeck(deck: InsertDeck): Promise<Deck>;
  updateDeck(id: string, deck: Partial<InsertDeck>): Promise<Deck | undefined>;
  deleteDeck(id: string): Promise<boolean>;

  getPlayers(): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayerByUsername(username: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined>;

  getGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | undefined>;
  getGamesByPlayer(playerId: string): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  deleteGame(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private cards: Map<string, Card>;
  private commanders: Map<string, Commander>;
  private decks: Map<string, Deck>;
  private players: Map<string, Player>;
  private games: Map<string, Game>;

  constructor() {
    this.cards = new Map();
    this.commanders = new Map();
    this.decks = new Map();
    this.players = new Map();
    this.games = new Map();
    this.seedData();
  }

  private seedData() {
    const cardNames: Record<string, string[]> = {
      Fire: ["Flame Warrior", "Inferno Mage", "Ember Scout", "Phoenix Guard", "Blaze Knight", "Volcano Shaman", "Fire Serpent", "Crimson Archer"],
      Water: ["Tide Caller", "Frost Mage", "Ocean Guardian", "Aqua Assassin", "Storm Bringer", "Ice Sentinel", "Coral Defender", "Mist Walker"],
      Earth: ["Stone Golem", "Mountain Sage", "Crystal Guard", "Terra Knight", "Boulder Crusher", "Cave Dweller", "Granite Defender", "Sandstorm Warrior"],
      Air: ["Wind Dancer", "Cloud Strider", "Tempest Mage", "Sky Archer", "Zephyr Scout", "Thunder Caller", "Cyclone Knight", "Breeze Spirit"],
      Nature: ["Forest Guardian", "Vine Weaver", "Bloom Priest", "Thorn Warrior", "Grove Protector", "Root Shaman", "Leaf Dancer", "Moss Giant"],
    };

    const traits = [null, null, "Quick Strike", "Care Package", "Restoration", "Guardian"];
    const buffDebuffColors = ["Red", "Blue", "Amber", "Green", "Black"] as const;

    let cardIndex = 0;
    for (const element of ELEMENTS) {
      const names = cardNames[element];
      for (let power = 1; power <= 10; power++) {
        for (let copy = 0; copy < 4; copy++) {
          const nameIndex = (power + copy) % names.length;
          const trait = power >= 7 ? traits[Math.floor(Math.random() * traits.length)] : null;
          const hasBuff = Math.random() > 0.5;
          const hasDebuff = Math.random() > 0.5;
          
          const card: Card = {
            id: `card-${element.toLowerCase()}-${power}-${copy}`,
            name: `${names[nameIndex]} ${power > 5 ? "Elite" : ""} ${copy > 0 ? `#${copy + 1}` : ""}`.trim(),
            element: element as typeof ELEMENTS[number],
            power,
            trait: trait as typeof TRAITS[number] | null,
            buffModifier: hasBuff ? Math.floor(Math.random() * 3) + 1 : 0,
            buffColor: hasBuff ? buffDebuffColors[Math.floor(Math.random() * buffDebuffColors.length)] : null,
            debuffModifier: hasDebuff ? Math.floor(Math.random() * 3) + 1 : 0,
            debuffColor: hasDebuff ? buffDebuffColors[Math.floor(Math.random() * buffDebuffColors.length)] : null,
            description: `A ${element} unit with power ${power}`,
            isCommander: false,
          };
          this.cards.set(card.id, card);
          cardIndex++;
        }
      }
    }

    const commanderData = [
      { name: "Pyros the Eternal", element: "Fire", title: "Lord of Flames", description: "Commands the fury of ancient volcanoes" },
      { name: "Aquara the Deep", element: "Water", title: "Queen of Tides", description: "Controls the endless oceans" },
      { name: "Terran the Unmovable", element: "Earth", title: "Mountain King", description: "Strength of a thousand mountains" },
      { name: "Zephyros the Swift", element: "Air", title: "Wind Lord", description: "Speed of the eternal storm" },
      { name: "Gaia the Eternal", element: "Nature", title: "Forest Mother", description: "Life springs from her touch" },
    ];

    for (const cmd of commanderData) {
      const commander: Commander = {
        id: `commander-${cmd.element.toLowerCase()}`,
        name: cmd.name,
        element: cmd.element as typeof ELEMENTS[number],
        title: cmd.title,
        description: cmd.description,
        abilities: [
          {
            id: `ability-${cmd.element.toLowerCase()}-1`,
            name: "Power Surge",
            description: "Boost all allied cards by +2 power",
            phase: "combat",
            victoryCost: 2,
            withdrawalCost: 0,
            effect: { type: "buff_all", value: 2, target: "allied" },
          },
          {
            id: `ability-${cmd.element.toLowerCase()}-2`,
            name: "Defensive Stance",
            description: "Reduce incoming damage by 5",
            phase: "calculation",
            victoryCost: 0,
            withdrawalCost: 2,
            effect: { type: "reduce_damage", value: 5, target: "self" },
          },
          {
            id: `ability-${cmd.element.toLowerCase()}-3`,
            name: "Draw Power",
            description: "Draw 2 additional cards",
            phase: "draw",
            victoryCost: 1,
            withdrawalCost: 1,
            effect: { type: "draw_cards", value: 2, target: "self" },
          },
        ],
      };
      this.commanders.set(commander.id, commander);
    }

    const guestPlayer: Player = {
      id: "player-guest",
      username: "guest",
      displayName: "Guest Player",
      wins: 0,
      losses: 0,
      createdAt: new Date(),
    };
    this.players.set(guestPlayer.id, guestPlayer);

    const aiPlayer: Player = {
      id: "player-ai",
      username: "AI",
      displayName: "AI Opponent",
      wins: 0,
      losses: 0,
      createdAt: new Date(),
    };
    this.players.set(aiPlayer.id, aiPlayer);
  }

  async getCards(): Promise<Card[]> {
    return Array.from(this.cards.values());
  }

  async getCard(id: string): Promise<Card | undefined> {
    return this.cards.get(id);
  }

  async getCardsByElement(element: string): Promise<Card[]> {
    return Array.from(this.cards.values()).filter(c => c.element === element);
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const id = randomUUID();
    const card: Card = { ...insertCard, id };
    this.cards.set(id, card);
    return card;
  }

  async getCommanders(): Promise<Commander[]> {
    return Array.from(this.commanders.values());
  }

  async getCommander(id: string): Promise<Commander | undefined> {
    return this.commanders.get(id);
  }

  async createCommander(insertCommander: InsertCommander): Promise<Commander> {
    const id = randomUUID();
    const commander: Commander = { ...insertCommander, id };
    this.commanders.set(id, commander);
    return commander;
  }

  async getDecks(): Promise<Deck[]> {
    return Array.from(this.decks.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getDecksByPlayer(playerId: string): Promise<Deck[]> {
    return Array.from(this.decks.values())
      .filter(d => d.playerId === playerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return this.decks.get(id);
  }

  async createDeck(insertDeck: InsertDeck): Promise<Deck> {
    const id = randomUUID();
    const deck: Deck = { ...insertDeck, id, createdAt: new Date() };
    this.decks.set(id, deck);
    return deck;
  }

  async updateDeck(id: string, updates: Partial<InsertDeck>): Promise<Deck | undefined> {
    const existing = this.decks.get(id);
    if (!existing) return undefined;
    const updated: Deck = { ...existing, ...updates };
    this.decks.set(id, updated);
    return updated;
  }

  async deleteDeck(id: string): Promise<boolean> {
    return this.decks.delete(id);
  }

  async getPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayerByUsername(username: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(p => p.username === username);
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const player: Player = { ...insertPlayer, id, wins: 0, losses: 0, createdAt: new Date() };
    this.players.set(id, player);
    return player;
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined> {
    const existing = this.players.get(id);
    if (!existing) return undefined;
    const updated: Player = { ...existing, ...updates };
    this.players.set(id, updated);
    return updated;
  }

  async getGames(): Promise<Game[]> {
    return Array.from(this.games.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getGamesByPlayer(playerId: string): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(g => g.player1Id === playerId || g.player2Id === playerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    const game: Game = { ...insertGame, id, createdAt: new Date() };
    this.games.set(id, game);
    return game;
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined> {
    const existing = this.games.get(id);
    if (!existing) return undefined;
    const updated: Game = { ...existing, ...updates };
    this.games.set(id, updated);
    return updated;
  }

  async deleteGame(id: string): Promise<boolean> {
    return this.games.delete(id);
  }
}

export const storage = new MemStorage();
