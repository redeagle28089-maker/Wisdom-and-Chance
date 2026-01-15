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
  updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined>;

  getCommanders(): Promise<Commander[]>;
  getCommander(id: string): Promise<Commander | undefined>;
  createCommander(commander: InsertCommander): Promise<Commander>;
  updateCommander(id: string, updates: Partial<Commander>): Promise<Commander | undefined>;

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

    // Fire General
    const fireCommander: Commander = {
      id: "commander-fire",
      name: "Pyros the Eternal",
      element: "Fire",
      title: "Lord of Flames",
      description: "Commands the fury of ancient volcanoes. Earns advance counters from victories and defeat counters from losses.",
      abilities: [
        {
          id: "ability-fire-1",
          name: "Scorching Flames",
          description: "Remove 4 advance counters: Target one non-Fire enemy unit and deal 4 damage to opponent.",
          phase: "combat",
          victoryCost: 4,
          withdrawalCost: 0,
          effect: { type: "direct_damage", value: 4, target: "enemy_non_element" },
        },
        {
          id: "ability-fire-2",
          name: "Inferno Blast",
          description: "Remove 10 advance counters: Deal damage equal to your total Fire unit power to the opponent.",
          phase: "combat",
          victoryCost: 10,
          withdrawalCost: 0,
          effect: { type: "element_power_damage", value: 0, target: "opponent" },
        },
        {
          id: "ability-fire-3",
          name: "Burning Rage",
          description: "Remove 4 defeat counters: Give a Fire unit you control +4 power this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 4,
          effect: { type: "buff_element_unit", value: 4, target: "fire" },
        },
        {
          id: "ability-fire-4",
          name: "Volcanic Eruption",
          description: "Remove 10 defeat counters: Play an extra Fire unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 10,
          effect: { type: "extra_deploy", value: 1, target: "fire" },
        },
        {
          id: "ability-fire-5",
          name: "Phoenix Rebirth",
          description: "Remove 4 advance and 4 defeat counters: Shuffle Fire units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 4,
          withdrawalCost: 4,
          effect: { type: "cycle_element_cards", value: 0, target: "fire" },
        },
      ],
    };
    this.commanders.set(fireCommander.id, fireCommander);

    // Water General
    const waterCommander: Commander = {
      id: "commander-water",
      name: "Aquara the Deep",
      element: "Water",
      title: "Queen of Tides",
      description: "Controls the endless oceans. Earns advance counters from victories and defeat counters from losses.",
      abilities: [
        {
          id: "ability-water-1",
          name: "Tidal Lock",
          description: "Remove 4 advance counters: Target one non-Water enemy unit and block its effects.",
          phase: "combat",
          victoryCost: 4,
          withdrawalCost: 0,
          effect: { type: "block_effects", value: 0, target: "enemy_non_element" },
        },
        {
          id: "ability-water-2",
          name: "Overwhelming Tide",
          description: "Remove 10 advance counters: Negate all enemy effects, halve their strength if not Water units.",
          phase: "combat",
          victoryCost: 10,
          withdrawalCost: 0,
          effect: { type: "negate_and_halve", value: 0, target: "enemy_non_water" },
        },
        {
          id: "ability-water-3",
          name: "Healing Waters",
          description: "Remove 4 defeat counters: Give a Water unit you control +4 healing factor this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 4,
          effect: { type: "healing_factor", value: 4, target: "water" },
        },
        {
          id: "ability-water-4",
          name: "Ocean's Blessing",
          description: "Remove 10 defeat counters: Play an extra Water unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 10,
          effect: { type: "extra_deploy", value: 1, target: "water" },
        },
        {
          id: "ability-water-5",
          name: "Current Flow",
          description: "Remove 4 advance and 4 defeat counters: Shuffle Water units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 4,
          withdrawalCost: 4,
          effect: { type: "cycle_element_cards", value: 0, target: "water" },
        },
      ],
    };
    this.commanders.set(waterCommander.id, waterCommander);

    // Earth General
    const earthCommander: Commander = {
      id: "commander-earth",
      name: "Terran the Unmovable",
      element: "Earth",
      title: "Mountain King",
      description: "Strength of a thousand mountains. Earns advance counters from victories and defeat counters from losses.",
      abilities: [
        {
          id: "ability-earth-1",
          name: "Stone Wall",
          description: "Remove 4 advance counters: Target one of your Earth units - it won't go to the medical ward this turn.",
          phase: "combat",
          victoryCost: 4,
          withdrawalCost: 0,
          effect: { type: "prevent_ward", value: 0, target: "earth" },
        },
        {
          id: "ability-earth-2",
          name: "Earthquake",
          description: "Remove 10 advance counters: Target one non-Earth enemy unit and send it to the medical ward.",
          phase: "combat",
          victoryCost: 10,
          withdrawalCost: 0,
          effect: { type: "destroy_unit", value: 0, target: "enemy_non_earth" },
        },
        {
          id: "ability-earth-3",
          name: "Granite Shield",
          description: "Remove 4 defeat counters: Add +4 shield to an Earth unit you control.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 4,
          effect: { type: "add_shield", value: 4, target: "earth" },
        },
        {
          id: "ability-earth-4",
          name: "Mountain's Call",
          description: "Remove 10 defeat counters: Play an extra Earth unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 10,
          effect: { type: "extra_deploy", value: 1, target: "earth" },
        },
        {
          id: "ability-earth-5",
          name: "Tectonic Shift",
          description: "Remove 4 advance and 4 defeat counters: Shuffle Earth units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 4,
          withdrawalCost: 4,
          effect: { type: "cycle_element_cards", value: 0, target: "earth" },
        },
      ],
    };
    this.commanders.set(earthCommander.id, earthCommander);

    // Air General
    const airCommander: Commander = {
      id: "commander-air",
      name: "Zephyros the Swift",
      element: "Air",
      title: "Wind Lord",
      description: "Speed of the eternal storm. Earns advance counters from victories and defeat counters from losses.",
      abilities: [
        {
          id: "ability-air-1",
          name: "Gale Force",
          description: "Remove 4 advance counters: Target one non-Air enemy unit and reduce its power by 4.",
          phase: "combat",
          victoryCost: 4,
          withdrawalCost: 0,
          effect: { type: "reduce_power", value: 4, target: "enemy_non_element" },
        },
        {
          id: "ability-air-2",
          name: "Cyclone Strike",
          description: "Remove 10 advance counters: All your Air units attack first, dealing damage before calculation.",
          phase: "combat",
          victoryCost: 10,
          withdrawalCost: 0,
          effect: { type: "first_strike", value: 0, target: "air" },
        },
        {
          id: "ability-air-3",
          name: "Wind Barrier",
          description: "Remove 4 defeat counters: Give an Air unit you control +4 evasion this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 4,
          effect: { type: "add_evasion", value: 4, target: "air" },
        },
        {
          id: "ability-air-4",
          name: "Storm's Arrival",
          description: "Remove 10 defeat counters: Play an extra Air unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 10,
          effect: { type: "extra_deploy", value: 1, target: "air" },
        },
        {
          id: "ability-air-5",
          name: "Whirlwind",
          description: "Remove 4 advance and 4 defeat counters: Shuffle Air units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 4,
          withdrawalCost: 4,
          effect: { type: "cycle_element_cards", value: 0, target: "air" },
        },
      ],
    };
    this.commanders.set(airCommander.id, airCommander);

    // Nature General
    const natureCommander: Commander = {
      id: "commander-nature",
      name: "Gaia the Eternal",
      element: "Nature",
      title: "Forest Mother",
      description: "Life springs from her touch. Earns advance counters from victories and defeat counters from losses.",
      abilities: [
        {
          id: "ability-nature-1",
          name: "Entangling Vines",
          description: "Remove 4 advance counters: Target one non-Nature enemy unit and reduce its power to 1.",
          phase: "combat",
          victoryCost: 4,
          withdrawalCost: 0,
          effect: { type: "set_power", value: 1, target: "enemy_non_element" },
        },
        {
          id: "ability-nature-2",
          name: "Nature's Wrath",
          description: "Remove 10 advance counters: Return up to 3 units from your medical ward to your deck.",
          phase: "end",
          victoryCost: 10,
          withdrawalCost: 0,
          effect: { type: "restore_from_ward", value: 3, target: "deck" },
        },
        {
          id: "ability-nature-3",
          name: "Rejuvenation",
          description: "Remove 4 defeat counters: Heal 4 HP and give a Nature unit +2 power.",
          phase: "end",
          victoryCost: 0,
          withdrawalCost: 4,
          effect: { type: "heal_and_buff", value: 4, target: "nature" },
        },
        {
          id: "ability-nature-4",
          name: "Forest's Gift",
          description: "Remove 10 defeat counters: Play an extra Nature unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 10,
          effect: { type: "extra_deploy", value: 1, target: "nature" },
        },
        {
          id: "ability-nature-5",
          name: "Cycle of Life",
          description: "Remove 4 advance and 4 defeat counters: Shuffle Nature units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 4,
          withdrawalCost: 4,
          effect: { type: "cycle_element_cards", value: 0, target: "nature" },
        },
      ],
    };
    this.commanders.set(natureCommander.id, natureCommander);

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

  async updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined> {
    const existing = this.cards.get(id);
    if (!existing) return undefined;
    const updated: Card = { ...existing, ...updates };
    this.cards.set(id, updated);
    return updated;
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

  async updateCommander(id: string, updates: Partial<Commander>): Promise<Commander | undefined> {
    const existing = this.commanders.get(id);
    if (!existing) return undefined;
    const updated: Commander = { ...existing, ...updates };
    this.commanders.set(id, updated);
    return updated;
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
