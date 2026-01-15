import { z } from "zod";

export const ELEMENTS = ["Fire", "Water", "Earth", "Air", "Nature"] as const;
export type Element = typeof ELEMENTS[number];

export const TRAITS = ["Quick Strike", "Care Package", "Restoration", "Guardian"] as const;
export type Trait = typeof TRAITS[number];

export const GAME_PHASES = ["draw", "deployment", "combat", "calculation", "end"] as const;
export type GamePhase = typeof GAME_PHASES[number];

export const GAME_STATUS = ["waiting", "in_progress", "completed"] as const;
export type GameStatus = typeof GAME_STATUS[number];

export const BUFF_DEBUFF_COLORS = ["Red", "Blue", "Amber", "Green", "Black"] as const;
export type BuffDebuffColor = typeof BUFF_DEBUFF_COLORS[number];

export const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  element: z.enum(ELEMENTS),
  power: z.number().min(1).max(10),
  trait: z.enum(TRAITS).nullable(),
  buffModifier: z.number().default(0),
  buffColor: z.enum(BUFF_DEBUFF_COLORS).nullable(),
  debuffModifier: z.number().default(0),
  debuffColor: z.enum(BUFF_DEBUFF_COLORS).nullable(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isCommander: z.boolean().default(false),
});

export type Card = z.infer<typeof cardSchema>;
export const insertCardSchema = cardSchema.omit({ id: true });
export type InsertCard = z.infer<typeof insertCardSchema>;

export const commanderAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  phase: z.enum(GAME_PHASES),
  victoryCost: z.number().default(0),
  withdrawalCost: z.number().default(0),
  effect: z.object({
    type: z.string(),
    value: z.number().optional(),
    target: z.string().optional(),
  }),
});

export type CommanderAbility = z.infer<typeof commanderAbilitySchema>;

export const commanderSchema = z.object({
  id: z.string(),
  name: z.string(),
  element: z.enum(ELEMENTS),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
  abilities: z.array(commanderAbilitySchema),
});

export type Commander = z.infer<typeof commanderSchema>;
export const insertCommanderSchema = commanderSchema.omit({ id: true });
export type InsertCommander = z.infer<typeof insertCommanderSchema>;

export const deckSchema = z.object({
  id: z.string(),
  name: z.string(),
  playerId: z.string(),
  commanderId: z.string(),
  cardIds: z.array(z.string()),
  createdAt: z.date(),
});

export type Deck = z.infer<typeof deckSchema>;
export const insertDeckSchema = deckSchema.omit({ id: true, createdAt: true });
export type InsertDeck = z.infer<typeof insertDeckSchema>;

export const playerSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  wins: z.number().default(0),
  losses: z.number().default(0),
  createdAt: z.date(),
});

export type Player = z.infer<typeof playerSchema>;
export const insertPlayerSchema = playerSchema.omit({ id: true, createdAt: true, wins: true, losses: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export const battlefieldCardSchema = z.object({
  cardId: z.string(),
  faceDown: z.boolean().default(true),
  modifiedPower: z.number().optional(),
});

export type BattlefieldCard = z.infer<typeof battlefieldCardSchema>;

export const gameStateSchema = z.object({
  player1Hand: z.array(z.string()),
  player2Hand: z.array(z.string()),
  player1Deck: z.array(z.string()),
  player2Deck: z.array(z.string()),
  player1Battlefield: z.array(battlefieldCardSchema),
  player2Battlefield: z.array(battlefieldCardSchema),
  player1Yard: z.array(z.string()),
  player2Yard: z.array(z.string()),
});

export type GameState = z.infer<typeof gameStateSchema>;

export const gameSchema = z.object({
  id: z.string(),
  player1Id: z.string(),
  player2Id: z.string().nullable(),
  player1DeckId: z.string(),
  player2DeckId: z.string().nullable(),
  player1HP: z.number().default(40),
  player2HP: z.number().default(40),
  player1VictoryPoints: z.number().default(0),
  player2VictoryPoints: z.number().default(0),
  player1WithdrawalPoints: z.number().default(0),
  player2WithdrawalPoints: z.number().default(0),
  currentPhase: z.enum(GAME_PHASES).default("draw"),
  currentTurn: z.number().default(1),
  activePlayer: z.string(),
  status: z.enum(GAME_STATUS).default("waiting"),
  gameType: z.enum(["solo", "practice", "multiplayer"]).default("practice"),
  winnerId: z.string().nullable(),
  gameState: gameStateSchema,
  gameHistory: z.array(z.object({
    turn: z.number(),
    phase: z.string(),
    action: z.string(),
    playerId: z.string(),
    details: z.any(),
    timestamp: z.date(),
  })),
  createdAt: z.date(),
});

export type Game = z.infer<typeof gameSchema>;
export const insertGameSchema = gameSchema.omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;

export const GAME_CONSTANTS = {
  STARTING_HP: 40,
  DECK_SIZE: 40,
  STARTING_HAND_SIZE: 5,
  CARDS_TO_DRAW: 2,
  CARDS_TO_DEPLOY: 2,
  MAX_HAND_SIZE: 10,
  CARDS_PER_POWER_RANK: 4,
  MAX_COPIES_PER_CARD: 3,
};
