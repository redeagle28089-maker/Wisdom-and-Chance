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
  getCardRarity,
  cardImageMappings,
  commanderImageMappings,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";

export interface IStorage {
  getCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  getCardsByElement(element: string): Promise<Card[]>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined>;
  deleteCard(id: string): Promise<boolean>;

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

  async initialize(): Promise<void> {
    try {
      const cardMappings = await db.select().from(cardImageMappings);
      for (const mapping of cardMappings) {
        const card = this.cards.get(mapping.cardId);
        if (card) {
          card.imageUrl = mapping.imageUrl;
        }
      }
      console.log(`[storage] Loaded ${cardMappings.length} card image mappings from database`);

      const commanderMappings = await db.select().from(commanderImageMappings);
      for (const mapping of commanderMappings) {
        const commander = this.commanders.get(mapping.commanderId);
        if (commander) {
          commander.imageUrl = mapping.imageUrl;
        }
      }
      console.log(`[storage] Loaded ${commanderMappings.length} commander image mappings from database`);
    } catch (error) {
      console.error("[storage] Failed to load image mappings:", error);
    }
  }

  private seedData() {
    // Comprehensive card database with unique names per element
    const fireCards = [
      // Power 1
      { name: "Ember Sprite", desc: "A tiny flame spirit that flickers with mischievous energy.", trait: null, traitValue: null, buff: 1, buffColor: "Red", debuff: 0, debuffColor: null },
      { name: "Spark Wisp", desc: "Born from the first spark of a campfire, quick but fragile.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Blue" },
      { name: "Candleflame Imp", desc: "Dances atop candles, feeding on melted wax.", trait: null, traitValue: null, buff: 1, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Cinder Mote", desc: "A floating ember that refuses to die out.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 0, debuffColor: null },
      // Power 2
      { name: "Flame Acolyte", desc: "A young devotee learning the ways of fire magic.", trait: null, traitValue: null, buff: 1, buffColor: "Red", debuff: 0, debuffColor: null },
      { name: "Torch Bearer", desc: "Carries sacred flames through the darkest nights.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Blue" },
      { name: "Salamander Scout", desc: "A fire lizard that thrives in volcanic vents.", trait: null, traitValue: null, buff: 2, buffColor: "Red", debuff: 0, debuffColor: null },
      { name: "Hearth Guardian", desc: "Protects the home fires from being extinguished.", trait: null, traitValue: null, buff: 1, buffColor: "Black", debuff: 1, debuffColor: "Black" },
      // Power 3
      { name: "Blaze Dancer", desc: "Performs ritual dances that summon flames.", trait: "Quick Strike", traitValue: 1, buff: 1, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Magma Crawler", desc: "Emerges from cooling lava flows to hunt.", trait: null, traitValue: null, buff: 2, buffColor: "Red", debuff: 0, debuffColor: null },
      { name: "Searing Bladefighter", desc: "Wields a sword of burning energy that slices through foes.", trait: "Quick Strike", traitValue: 1, buff: 1, buffColor: "Red", debuff: 1, debuffColor: "Red" },
      { name: "Ash Stalker", desc: "Hunts through smoke and cinders unseen.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 2, debuffColor: "Blue" },
      // Power 4
      { name: "Inferno Mage", desc: "Commands flames with arcane precision.", trait: "Care Package", traitValue: 1, buff: 2, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Pyroclast Shaman", desc: "Channels the rage of volcanic spirits.", trait: null, traitValue: null, buff: 1, buffColor: "Red", debuff: 2, debuffColor: "Amber" },
      { name: "Crimson Archer", desc: "Fires arrows that ignite upon release.", trait: "Quick Strike", traitValue: 2, buff: 1, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Flame Sentinel", desc: "Guards the borders of the Fire Kingdom.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Red", debuff: 0, debuffColor: null },
      // Power 5
      { name: "Ember Knight", desc: "Armored in living flame, fearless in battle.", trait: "Guardian", traitValue: 2, buff: 2, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Wildfire Berserker", desc: "Fights with uncontrolled fury, leaving destruction.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Red" },
      { name: "Volcanic Priestess", desc: "Communes with the volcano gods for power.", trait: "Restoration", traitValue: 2, buff: 2, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Molten Core Golem", desc: "A construct of living magma and stone.", trait: null, traitValue: null, buff: 2, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      // Power 6
      { name: "Firestorm Invoker", desc: "Calls down devastating storms of flame.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      { name: "Phoenix Initiate", desc: "Training to achieve the legendary rebirth.", trait: "Restoration", traitValue: 2, buff: 3, buffColor: "Red", debuff: 1, debuffColor: "Blue" },
      { name: "Blazing Cavalier", desc: "Rides a steed made of pure flame.", trait: null, traitValue: null, buff: 2, buffColor: "Red", debuff: 2, debuffColor: "Amber" },
      { name: "Lava Titan Spawn", desc: "Offspring of the great Lava Titans.", trait: "Guardian", traitValue: 2, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      // Power 7
      { name: "Pyromancer Supreme", desc: "Masters of the most destructive fire arts.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      { name: "Ashbringer Champion", desc: "Leaves only ash in their wake.", trait: "Care Package", traitValue: 2, buff: 2, buffColor: "Red", debuff: 3, debuffColor: "Blue" },
      { name: "Hellfire Warden", desc: "Guards the gates between realms.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Amber" },
      { name: "Crimson Dragon Rider", desc: "Bonded with young fire dragons.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      // Power 8
      { name: "Infernal General", desc: "Commands legions of fire warriors.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      { name: "Phoenix Guardian", desc: "Blessed with partial rebirth abilities.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      { name: "Volcanic Overlord", desc: "Rules from atop an active volcano.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Amber" },
      { name: "Flame Archon", desc: "An angelic being of pure fire.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Red", debuff: 2, debuffColor: "Blue" },
      // Power 9
      { name: "Pyros Elite Guard", desc: "Personal guards of the Fire Commander.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Blue" },
      { name: "Ancient Flamewyrm", desc: "A dragon older than most kingdoms.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Amber" },
      { name: "Solar Flare Mage", desc: "Channels the power of the sun itself.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Magma Lord", desc: "Born from the planet's molten core.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Blue" },
      // Power 10
      { name: "Phoenix Ascendant", desc: "Has achieved true immortal rebirth.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Blue" },
      { name: "Inferno Avatar", desc: "Physical manifestation of fire itself.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Eternal Flame Dragon", desc: "A legendary dragon that never stops burning.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Blue" },
      { name: "Primordial Fire Elemental", desc: "One of the first flames ever created.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Red", debuff: 3, debuffColor: "Amber" },
    ];

    const waterCards = [
      // Power 1
      { name: "Dewdrop Sprite", desc: "A tiny spirit born from morning dew.", trait: null, traitValue: null, buff: 1, buffColor: "Blue", debuff: 0, debuffColor: null },
      { name: "Puddle Lurker", desc: "Hides in shallow water waiting to surprise.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Red" },
      { name: "Mist Wisp", desc: "Floats through fog banks unseen.", trait: null, traitValue: null, buff: 1, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Tide Pool Watcher", desc: "Guards the smallest seas.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 0, debuffColor: null },
      // Power 2
      { name: "Wave Acolyte", desc: "Studies the ancient arts of water.", trait: null, traitValue: null, buff: 1, buffColor: "Blue", debuff: 0, debuffColor: null },
      { name: "Ice Shard Imp", desc: "Throws frozen projectiles at foes.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Red" },
      { name: "Stream Runner", desc: "Swift as a mountain brook.", trait: null, traitValue: null, buff: 2, buffColor: "Blue", debuff: 0, debuffColor: null },
      { name: "Coral Sprite", desc: "Lives among the reef formations.", trait: null, traitValue: null, buff: 1, buffColor: "Black", debuff: 1, debuffColor: "Black" },
      // Power 3
      { name: "Frost Mage", desc: "Commands ice and cold with precision.", trait: "Quick Strike", traitValue: 1, buff: 1, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Riptide Warrior", desc: "Uses currents to overwhelm enemies.", trait: null, traitValue: null, buff: 2, buffColor: "Blue", debuff: 0, debuffColor: null },
      { name: "Abyssal Scout", desc: "Explores the darkest ocean depths.", trait: "Care Package", traitValue: 1, buff: 1, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Ice Fisher", desc: "Pulls enemies into frozen waters.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 2, debuffColor: "Red" },
      // Power 4
      { name: "Tide Caller", desc: "Summons waves to do their bidding.", trait: "Care Package", traitValue: 1, buff: 2, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Glacial Knight", desc: "Armored in unmelting ice.", trait: "Guardian", traitValue: 1, buff: 1, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      { name: "Storm Bringer", desc: "Conjures tempests from calm seas.", trait: "Quick Strike", traitValue: 2, buff: 1, buffColor: "Blue", debuff: 1, debuffColor: "Amber" },
      { name: "Whirlpool Sentinel", desc: "Guards dangerous sea passages.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Blue", debuff: 0, debuffColor: null },
      // Power 5
      { name: "Ocean Guardian", desc: "Protector of all marine life.", trait: "Guardian", traitValue: 2, buff: 2, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Blizzard Shaman", desc: "Channels the fury of winter storms.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      { name: "Deep Sea Priestess", desc: "Communes with ancient sea gods.", trait: "Restoration", traitValue: 2, buff: 2, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Maelstrom Golem", desc: "A construct of churning water.", trait: null, traitValue: null, buff: 2, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      // Power 6
      { name: "Tsunami Invoker", desc: "Calls forth devastating waves.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      { name: "Ice Phoenix Initiate", desc: "Training in frost and rebirth.", trait: "Restoration", traitValue: 2, buff: 3, buffColor: "Blue", debuff: 1, debuffColor: "Red" },
      { name: "Kraken Spawn", desc: "Offspring of the legendary sea beast.", trait: null, traitValue: null, buff: 2, buffColor: "Blue", debuff: 2, debuffColor: "Amber" },
      { name: "Frozen Champion", desc: "Undefeated in the northern wars.", trait: "Guardian", traitValue: 2, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      // Power 7
      { name: "Hydromancer Supreme", desc: "Ultimate master of water magic.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      { name: "Leviathan Rider", desc: "Bonded with a sea serpent.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Blue", debuff: 3, debuffColor: "Red" },
      { name: "Glacier Warden", desc: "Guards the ancient ice fields.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Amber" },
      { name: "Tempest Commander", desc: "Leads fleets through any storm.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      // Power 8
      { name: "Tidal General", desc: "Commands armies of the deep.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      { name: "Frost Giant", desc: "A titan of the frozen wastes.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      { name: "Abyssal Overlord", desc: "Rules the darkest ocean trenches.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Amber" },
      { name: "Ice Archon", desc: "An angelic being of eternal winter.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 2, debuffColor: "Red" },
      // Power 9
      { name: "Aquara Elite Guard", desc: "Personal guards of the Water Commander.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Red" },
      { name: "Elder Kraken", desc: "Ancient terror of the seas.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Amber" },
      { name: "Polar Vortex Mage", desc: "Commands the coldest winds.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Ocean Emperor", desc: "Sovereign of all waters.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Red" },
      // Power 10
      { name: "Leviathan Awakened", desc: "The legendary sea monster rises.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Red" },
      { name: "Glacial Avatar", desc: "Physical manifestation of ice.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Primordial Tide Dragon", desc: "First dragon born from the sea.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Red" },
      { name: "Eternal Storm Elemental", desc: "One of the first tempests created.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Blue", debuff: 3, debuffColor: "Amber" },
    ];

    const earthCards = [
      // Power 1
      { name: "Pebble Sprite", desc: "A tiny spirit living in stones.", trait: null, traitValue: null, buff: 1, buffColor: "Amber", debuff: 0, debuffColor: null },
      { name: "Dust Devil Imp", desc: "Kicks up small sandstorms.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Green" },
      { name: "Crystal Mote", desc: "A floating shard of living crystal.", trait: null, traitValue: null, buff: 1, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Sandpit Watcher", desc: "Guards the desert's edge.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 0, debuffColor: null },
      // Power 2
      { name: "Stone Acolyte", desc: "Studies the ancient earth magics.", trait: null, traitValue: null, buff: 1, buffColor: "Amber", debuff: 0, debuffColor: null },
      { name: "Clay Golem", desc: "A simple construct of mud.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Green" },
      { name: "Boulder Roller", desc: "Pushes rocks down mountainsides.", trait: null, traitValue: null, buff: 2, buffColor: "Amber", debuff: 0, debuffColor: null },
      { name: "Cavern Scout", desc: "Explores underground tunnels.", trait: null, traitValue: null, buff: 1, buffColor: "Black", debuff: 1, debuffColor: "Black" },
      // Power 3
      { name: "Mountain Sage", desc: "Wise in the ways of stone.", trait: "Restoration", traitValue: 1, buff: 1, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Quake Warrior", desc: "Fights with earthshaking power.", trait: null, traitValue: null, buff: 2, buffColor: "Amber", debuff: 0, debuffColor: null },
      { name: "Crystal Guard", desc: "Armored in gemstone plates.", trait: "Guardian", traitValue: 1, buff: 1, buffColor: "Amber", debuff: 1, debuffColor: "Blue" },
      { name: "Sand Stalker", desc: "Hunts through desert dunes.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 2, debuffColor: "Green" },
      // Power 4
      { name: "Terra Knight", desc: "A noble warrior of stone.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Lava Forge Shaman", desc: "Works with molten rock.", trait: null, traitValue: null, buff: 1, buffColor: "Amber", debuff: 2, debuffColor: "Blue" },
      { name: "Granite Archer", desc: "Fires arrows of sharpened stone.", trait: "Quick Strike", traitValue: 2, buff: 1, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Cave Sentinel", desc: "Guards underground passages.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Amber", debuff: 0, debuffColor: null },
      // Power 5
      { name: "Boulder Crusher", desc: "Smashes through any obstacle.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Earthquake Berserker", desc: "Fights with seismic fury.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Blue" },
      { name: "Gemstone Priestess", desc: "Communes with crystal spirits.", trait: "Restoration", traitValue: 2, buff: 2, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Iron Core Golem", desc: "A construct of metal and stone.", trait: null, traitValue: null, buff: 2, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      // Power 6
      { name: "Landslide Invoker", desc: "Calls down avalanches of rock.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      { name: "Diamond Guardian", desc: "Protected by unbreakable gems.", trait: "Guardian", traitValue: 2, buff: 3, buffColor: "Amber", debuff: 1, debuffColor: "Green" },
      { name: "Sandstorm Warrior", desc: "Commands the desert winds.", trait: null, traitValue: null, buff: 2, buffColor: "Amber", debuff: 2, debuffColor: "Blue" },
      { name: "Stone Titan Spawn", desc: "Offspring of the Stone Titans.", trait: "Guardian", traitValue: 2, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      // Power 7
      { name: "Geomancer Supreme", desc: "Master of all earth magic.", trait: "Restoration", traitValue: 2, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      { name: "Obsidian Champion", desc: "Clad in volcanic glass armor.", trait: "Guardian", traitValue: 2, buff: 2, buffColor: "Amber", debuff: 3, debuffColor: "Green" },
      { name: "Mountain Warden", desc: "Guards the highest peaks.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Blue" },
      { name: "Crystal Dragon Rider", desc: "Bonded with gem dragons.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      // Power 8
      { name: "Tectonic General", desc: "Commands armies underground.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      { name: "Stone Giant", desc: "A titan of the mountains.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      { name: "Cavern Overlord", desc: "Rules the deep places.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Blue" },
      { name: "Earth Archon", desc: "An angelic being of stone.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 2, debuffColor: "Green" },
      // Power 9
      { name: "Terran Elite Guard", desc: "Personal guards of the Earth Commander.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Green" },
      { name: "Ancient Wyrm", desc: "A dragon older than the mountains.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Blue" },
      { name: "Continental Mage", desc: "Can reshape the very land.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Mountain King", desc: "Sovereign of all peaks.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Green" },
      // Power 10
      { name: "World Serpent", desc: "The legendary earth dragon.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Green" },
      { name: "Tectonic Avatar", desc: "Physical manifestation of earth.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Primordial Stone Dragon", desc: "First dragon born from rock.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Green" },
      { name: "Eternal Mountain Elemental", desc: "One of the first peaks created.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Amber", debuff: 3, debuffColor: "Blue" },
    ];

    const airCards = [
      // Power 1
      { name: "Breeze Sprite", desc: "A tiny spirit of gentle winds.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Cloud Wisp", desc: "Floats through the sky unseen.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Amber" },
      { name: "Zephyr Mote", desc: "A floating breath of air.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Sky Watcher", desc: "Observes from the clouds.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 0, debuffColor: null },
      // Power 2
      { name: "Wind Acolyte", desc: "Studies the ancient air arts.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Thunder Imp", desc: "Crackles with electrical energy.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Amber" },
      { name: "Cloud Strider", desc: "Walks upon the clouds themselves.", trait: null, traitValue: null, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Mist Scout", desc: "Scouts through fog banks.", trait: null, traitValue: null, buff: 1, buffColor: "Black", debuff: 1, debuffColor: "Black" },
      // Power 3
      { name: "Wind Dancer", desc: "Moves with graceful air currents.", trait: "Quick Strike", traitValue: 1, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Gale Warrior", desc: "Fights with howling winds.", trait: null, traitValue: null, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Sky Archer", desc: "Fires arrows from the clouds.", trait: "Quick Strike", traitValue: 1, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Storm Stalker", desc: "Hunts through tempests.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 2, debuffColor: "Amber" },
      // Power 4
      { name: "Tempest Mage", desc: "Commands storms with precision.", trait: "Quick Strike", traitValue: 1, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Lightning Shaman", desc: "Channels electrical spirits.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Cyclone Knight", desc: "Armored in swirling winds.", trait: "Quick Strike", traitValue: 2, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Cloud Sentinel", desc: "Guards the sky passages.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      // Power 5
      { name: "Thunder Caller", desc: "Summons lightning at will.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Tornado Berserker", desc: "Fights with chaotic fury.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Sky Priestess", desc: "Communes with cloud spirits.", trait: "Care Package", traitValue: 2, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Storm Core Golem", desc: "A construct of living lightning.", trait: null, traitValue: null, buff: 2, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      // Power 6
      { name: "Hurricane Invoker", desc: "Calls devastating wind storms.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      { name: "Phoenix Windrunner", desc: "Flies faster than thought.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Green", debuff: 1, debuffColor: "Amber" },
      { name: "Storm Cavalry", desc: "Rides the lightning itself.", trait: null, traitValue: null, buff: 2, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Cloud Titan Spawn", desc: "Offspring of the Sky Titans.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      // Power 7
      { name: "Aeromancer Supreme", desc: "Master of all air magic.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      { name: "Lightning Champion", desc: "Undefeated in aerial combat.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Green", debuff: 3, debuffColor: "Amber" },
      { name: "Storm Warden", desc: "Guards the thunder peaks.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Thunder Dragon Rider", desc: "Bonded with storm dragons.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      // Power 8
      { name: "Gale General", desc: "Commands aerial legions.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      { name: "Sky Giant", desc: "A titan of the upper clouds.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      { name: "Tempest Overlord", desc: "Rules all storm systems.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Air Archon", desc: "An angelic being of wind.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Amber" },
      // Power 9
      { name: "Zephyros Elite Guard", desc: "Personal guards of the Air Commander.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Amber" },
      { name: "Elder Storm Dragon", desc: "Ancient terror of the skies.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Supercell Mage", desc: "Commands the mightiest storms.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Sky Emperor", desc: "Sovereign of all winds.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Amber" },
      // Power 10
      { name: "Thunderbird Awakened", desc: "The legendary storm creature.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Amber" },
      { name: "Tempest Avatar", desc: "Physical manifestation of wind.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Primordial Storm Dragon", desc: "First dragon born from lightning.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Amber" },
      { name: "Eternal Hurricane Elemental", desc: "One of the first winds created.", trait: "Quick Strike", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
    ];

    const natureCards = [
      // Power 1
      { name: "Seedling Sprite", desc: "A tiny spirit of new growth.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Moss Wisp", desc: "Floats through ancient forests.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Red" },
      { name: "Flower Mote", desc: "A floating blossom spirit.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Grove Watcher", desc: "Guards the sacred trees.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 0, debuffColor: null },
      // Power 2
      { name: "Vine Acolyte", desc: "Studies the ancient plant arts.", trait: null, traitValue: null, buff: 1, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Thorn Imp", desc: "Throws poisonous barbs.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 1, debuffColor: "Red" },
      { name: "Forest Runner", desc: "Swift through the underbrush.", trait: null, traitValue: null, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Mushroom Scout", desc: "Explores the fungal networks.", trait: null, traitValue: null, buff: 1, buffColor: "Black", debuff: 1, debuffColor: "Black" },
      // Power 3
      { name: "Bloom Priest", desc: "Heals with flower magic.", trait: "Restoration", traitValue: 1, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Vine Warrior", desc: "Fights with living plants.", trait: null, traitValue: null, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      { name: "Thorn Warrior", desc: "Armored in natural spikes.", trait: "Guardian", traitValue: 1, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Blue" },
      { name: "Root Stalker", desc: "Hunts through underground tunnels.", trait: null, traitValue: null, buff: 0, buffColor: null, debuff: 2, debuffColor: "Red" },
      // Power 4
      { name: "Forest Guardian", desc: "Protects all woodland creatures.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Grove Shaman", desc: "Channels nature spirits.", trait: "Restoration", traitValue: 1, buff: 1, buffColor: "Green", debuff: 2, debuffColor: "Blue" },
      { name: "Leaf Dancer", desc: "Moves like falling leaves.", trait: "Quick Strike", traitValue: 2, buff: 1, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Tree Sentinel", desc: "Guards the ancient forests.", trait: "Guardian", traitValue: 1, buff: 2, buffColor: "Green", debuff: 0, debuffColor: null },
      // Power 5
      { name: "Grove Protector", desc: "Ultimate defender of nature.", trait: "Guardian", traitValue: 2, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Wild Hunt Berserker", desc: "Fights with primal fury.", trait: "Quick Strike", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Druid Priestess", desc: "Communes with ancient spirits.", trait: "Restoration", traitValue: 2, buff: 2, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Living Oak Golem", desc: "A construct of ancient wood.", trait: null, traitValue: null, buff: 2, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      // Power 6
      { name: "Overgrowth Invoker", desc: "Calls forth explosive growth.", trait: "Restoration", traitValue: 2, buff: 2, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Phoenix Blossom", desc: "Blooms from ashes.", trait: "Restoration", traitValue: 2, buff: 3, buffColor: "Green", debuff: 1, debuffColor: "Red" },
      { name: "Beast Master", desc: "Commands forest creatures.", trait: "Care Package", traitValue: 2, buff: 2, buffColor: "Green", debuff: 2, debuffColor: "Blue" },
      { name: "Treant Spawn", desc: "Offspring of the Great Treants.", trait: "Guardian", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      // Power 7
      { name: "Druid Supreme", desc: "Master of all nature magic.", trait: "Restoration", traitValue: 2, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Wolf Pack Alpha", desc: "Leads the wild hunt.", trait: "Quick Strike", traitValue: 2, buff: 2, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Ancient Oak Warden", desc: "Guards the world tree.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Blue" },
      { name: "Forest Dragon Rider", desc: "Bonded with nature dragons.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      // Power 8
      { name: "Wild General", desc: "Commands nature's armies.", trait: "Care Package", traitValue: 2, buff: 3, buffColor: "Black", debuff: 2, debuffColor: "Black" },
      { name: "Forest Giant", desc: "A titan of the deep woods.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      { name: "Nature Overlord", desc: "Rules all living things.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Blue" },
      { name: "Life Archon", desc: "An angelic being of nature.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 2, debuffColor: "Red" },
      // Power 9
      { name: "Gaia Elite Guard", desc: "Personal guards of the Nature Commander.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Elder Treant", desc: "Ancient protector of forests.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Blue" },
      { name: "Life Force Mage", desc: "Commands the essence of life.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Forest Emperor", desc: "Sovereign of all nature.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      // Power 10
      { name: "World Tree Spirit", desc: "Spirit of the great tree.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Nature Avatar", desc: "Physical manifestation of life.", trait: "Guardian", traitValue: 3, buff: 3, buffColor: "Black", debuff: 3, debuffColor: "Black" },
      { name: "Primordial Forest Dragon", desc: "First dragon born from life.", trait: "Restoration", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Red" },
      { name: "Eternal Life Elemental", desc: "One of the first living things.", trait: "Care Package", traitValue: 3, buff: 3, buffColor: "Green", debuff: 3, debuffColor: "Blue" },
    ];

    // Map element to cards
    const allCards: Record<string, typeof fireCards> = {
      Fire: fireCards,
      Water: waterCards,
      Earth: earthCards,
      Air: airCards,
      Nature: natureCards,
    };

    // Seed all cards
    for (const element of ELEMENTS) {
      const cards = allCards[element];
      cards.forEach((cardData, index) => {
        const power = Math.floor(index / 4) + 1; // 4 cards per power level
        const card: Card = {
          id: `card-${element.toLowerCase()}-${power}-${index % 4}`,
          name: cardData.name,
          element: element as typeof ELEMENTS[number],
          power,
          rarity: getCardRarity(power),
          trait: cardData.trait as typeof TRAITS[number] | null,
          traitValue: cardData.traitValue,
          buffModifier: cardData.buff,
          buffColor: cardData.buffColor as typeof BUFF_DEBUFF_COLORS[number] | null,
          debuffModifier: cardData.debuff,
          debuffColor: cardData.debuffColor as typeof BUFF_DEBUFF_COLORS[number] | null,
          description: cardData.desc,
          isCommander: false,
        };
        this.cards.set(card.id, card);
      });
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
          description: "Remove 2 advance counters: Target one non-Fire enemy unit and deal 4 damage to opponent.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "direct_damage", value: 4, target: "enemy_non_element" },
        },
        {
          id: "ability-fire-2",
          name: "Inferno Blast",
          description: "Remove 2 advance counters: Deal damage equal to your total Fire unit power to all enemies.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "element_power_damage", value: 0, target: "opponent" },
        },
        {
          id: "ability-fire-3",
          name: "Burning Rage",
          description: "Remove 2 defeat counters: Give a Fire unit you control +4 power this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "buff_element_unit", value: 4, target: "fire" },
        },
        {
          id: "ability-fire-4",
          name: "Volcanic Eruption",
          description: "Remove 2 defeat counters: Play an extra Fire unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "extra_deploy", value: 1, target: "fire" },
        },
        {
          id: "ability-fire-5",
          name: "Phoenix Rebirth",
          description: "Remove 1 advance and 1 defeat counters: Shuffle Fire units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 1,
          withdrawalCost: 1,
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
          description: "Remove 2 advance counters: Target one non-Water enemy unit and block its effects.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "block_effects", value: 0, target: "enemy_non_element" },
        },
        {
          id: "ability-water-2",
          name: "Overwhelming Tide",
          description: "Remove 2 advance counters: Negate all enemy effects, halve their strength if not Water units.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "negate_and_halve", value: 0, target: "enemy_non_water" },
        },
        {
          id: "ability-water-3",
          name: "Healing Waters",
          description: "Remove 2 defeat counters: Give a Water unit you control +4 healing factor this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "healing_factor", value: 4, target: "water" },
        },
        {
          id: "ability-water-4",
          name: "Ocean's Blessing",
          description: "Remove 2 defeat counters: Play an extra Water unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "extra_deploy", value: 1, target: "water" },
        },
        {
          id: "ability-water-5",
          name: "Current Flow",
          description: "Remove 1 advance and 1 defeat counters: Shuffle Water units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 1,
          withdrawalCost: 1,
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
          description: "Remove 2 advance counters: Target one of your Earth units - it won't go to the medical ward this turn.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "prevent_ward", value: 0, target: "earth" },
        },
        {
          id: "ability-earth-2",
          name: "Earthquake",
          description: "Remove 2 advance counters: Target one non-Earth enemy unit and send it to the medical ward.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "destroy_unit", value: 0, target: "enemy_non_earth" },
        },
        {
          id: "ability-earth-3",
          name: "Granite Shield",
          description: "Remove 2 defeat counters: Add +4 shield to an Earth unit you control.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "add_shield", value: 4, target: "earth" },
        },
        {
          id: "ability-earth-4",
          name: "Mountain's Call",
          description: "Remove 2 defeat counters: Play an extra Earth unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "extra_deploy", value: 1, target: "earth" },
        },
        {
          id: "ability-earth-5",
          name: "Tectonic Shift",
          description: "Remove 1 advance and 1 defeat counters: Shuffle Earth units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 1,
          withdrawalCost: 1,
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
          description: "Remove 2 advance counters: Target one non-Air enemy unit and reduce its power by 4.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "reduce_power", value: 4, target: "enemy_non_element" },
        },
        {
          id: "ability-air-2",
          name: "Cyclone Strike",
          description: "Remove 2 advance counters: All your Air units attack first, dealing damage before calculation.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "first_strike", value: 0, target: "air" },
        },
        {
          id: "ability-air-3",
          name: "Wind Barrier",
          description: "Remove 2 defeat counters: Give an Air unit you control +4 shield this battle.",
          phase: "combat",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "add_shield", value: 4, target: "air" },
        },
        {
          id: "ability-air-4",
          name: "Storm's Arrival",
          description: "Remove 2 defeat counters: Play an extra Air unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "extra_deploy", value: 1, target: "air" },
        },
        {
          id: "ability-air-5",
          name: "Whirlwind",
          description: "Remove 1 advance and 1 defeat counters: Shuffle Air units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 1,
          withdrawalCost: 1,
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
          description: "Remove 2 advance counters: Target one non-Nature enemy unit and reduce its power to 1.",
          phase: "combat",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "set_power", value: 1, target: "enemy_non_element" },
        },
        {
          id: "ability-nature-2",
          name: "Nature's Wrath",
          description: "Remove 2 advance counters: Return up to 2 units from your medical ward to your deck.",
          phase: "end",
          victoryCost: 2,
          withdrawalCost: 0,
          effect: { type: "restore_from_ward", value: 2, target: "deck" },
        },
        {
          id: "ability-nature-3",
          name: "Rejuvenation",
          description: "Remove 2 defeat counters: Heal 4 HP and give a Nature unit +2 power.",
          phase: "end",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "heal_and_buff", value: 4, target: "nature" },
        },
        {
          id: "ability-nature-4",
          name: "Forest's Gift",
          description: "Remove 2 defeat counters: Play an extra Nature unit from your hand during deployment.",
          phase: "deployment",
          victoryCost: 0,
          withdrawalCost: 2,
          effect: { type: "extra_deploy", value: 1, target: "nature" },
        },
        {
          id: "ability-nature-5",
          name: "Cycle of Life",
          description: "Remove 1 advance and 1 defeat counters: Shuffle Nature units from hand into deck, draw equal cards.",
          phase: "draw",
          victoryCost: 1,
          withdrawalCost: 1,
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
    const card: Card = { ...insertCard, id, rarity: getCardRarity(insertCard.power) };
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

  async deleteCard(id: string): Promise<boolean> {
    return this.cards.delete(id);
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
