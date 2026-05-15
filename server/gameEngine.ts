import type { Card, Commander, CommanderAbility, BattlefieldCard, GameState, Game, CombatLog, CardPowerBreakdown, Element } from "@shared/schema";
import type { FieldCard } from "@shared/models/cards";
import { GAME_CONSTANTS, GAME_MODE_CONFIG, ALLOWED_ABILITY_EFFECTS } from "@shared/schema";
import { storage } from "./storage";

// Drift guard: the admin AI generator and commanderAbilityEffectSchema both
// read from ALLOWED_ABILITY_EFFECTS in shared/models/cards.ts. The switch in
// processAbility below MUST handle every entry in that list (and only those).
// If you add a new case to the switch, add it to ALLOWED_ABILITY_EFFECTS too;
// if you remove one, remove it from the list. The arrays are compared at
// startup so a mismatch crashes the server immediately.
export const IMPLEMENTED_ABILITY_TYPES = [
  "direct_damage",
  "element_power_damage",
  "buff_element_unit",
  "extra_deploy",
  "cycle_element_cards",
  "block_effects",
  "negate_and_halve",
  "healing_factor",
  "draw_cards",
  "protect_element",
  "debuff_enemy",
  "swap_units",
  "revive_unit",
  "growth_buff",
  "prevent_ward",
  "destroy_unit",
  "add_shield",
  "reduce_power",
  "first_strike",
  "add_evasion",
  "set_power",
  "restore_from_ward",
  "heal_and_buff",
] as const;

(function assertEffectListsMatch() {
  const allowed = new Set(ALLOWED_ABILITY_EFFECTS.map((e) => e.type));
  const implemented = new Set(IMPLEMENTED_ABILITY_TYPES);
  const missingFromEngine = [...allowed].filter((t) => !implemented.has(t as any));
  const extraInEngine = [...implemented].filter((t) => !allowed.has(t));
  if (missingFromEngine.length > 0 || extraInEngine.length > 0) {
    throw new Error(
      `[gameEngine] ALLOWED_ABILITY_EFFECTS / IMPLEMENTED_ABILITY_TYPES drift detected. ` +
        `missingFromEngine=${JSON.stringify(missingFromEngine)} extraInEngine=${JSON.stringify(extraInEngine)}. ` +
        `Update both shared/models/cards.ts and server/gameEngine.ts so they agree.`
    );
  }
})();

const colorToElement: Record<string, string> = {
  Red: "Fire",
  Blue: "Water",
  Amber: "Earth",
  Green: "Nature",
  Black: "Air",
};

/** Normalize element strings to lowercase for consistent comparison. */
function normEl(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function getCardIdFromInstance(instanceId: string): string {
  return instanceId.split("::")[0];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface AbilityBuff {
  targetElement: string;
  amount: number;
  type: string;
}

interface ServerCardBreakdown {
  card: Card;
  basePower: number;
  buffBonuses: { fromCard: Card; amount: number }[];
  debuffPenalties: { fromCard: Card; amount: number }[];
  traitInfo: { trait: string; value: number } | null;
  finalPower: number;
}

interface CombatSummary {
  player1QuickStrikeDamage: number;
  player2QuickStrikeDamage: number;
  player1GuardianBlocked: number;
  player2GuardianBlocked: number;
  player1Healing: number;
  player2Healing: number;
  player1CardsDrawn: number;
  player2CardsDrawn: number;
  baseDamageToPlayer1: number;
  baseDamageToPlayer2: number;
  finalDamageToPlayer1: number;
  finalDamageToPlayer2: number;
  abilityEffects: Array<{ playerSide: string; abilityName: string; effectDescription: string; phase: string }>;
}

interface ActivePvPGame {
  game: Game;
  player1TurnEnded: boolean;
  player2TurnEnded: boolean;
  player1Deployed: boolean;
  player2Deployed: boolean;
  player1DrawnThisTurn: boolean;
  player2DrawnThisTurn: boolean;
  usedAbilities: Set<string>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  disconnectedPlayers: Set<string>;
  combatResolving: boolean;
  seq: number;
  turnTimer: NodeJS.Timeout | null;
  turnDeadline: number | null;
  consecutiveTimeouts: Map<string, number>;
  recentActionIds: Map<string, Set<string>>;
  broadcastHandler?: (eventType: string, payload: any) => void;
  battlefieldMode: boolean;
  p1ActiveFieldCard: FieldCard | null;
  p2ActiveFieldCard: FieldCard | null;
}

type EngineBroadcastHandler = (eventType: string, payload: any) => void;

export interface SanitizedGameState {
  myHand: string[];
  myDeckCount: number;
  myBattlefield: BattlefieldCard[];
  myYard: string[];
  myHP: number;
  myVP: number;
  myWP: number;
  myCommanderId: string;
  myHasDrawn: boolean;
  myHasDeployed: boolean;
  myTurnEnded: boolean;
  opponentHandCount: number;
  opponentDeckCount: number;
  opponentBattlefield: BattlefieldCard[];
  opponentYard: string[];
  opponentHP: number;
  opponentVP: number;
  opponentWP: number;
  opponentCommanderId: string;
  opponentHasDrawn: boolean;
  opponentHasDeployed: boolean;
  opponentTurnEnded: boolean;
  currentPhase: string;
  currentTurn: number;
  status: string;
  winnerId: string | null;
  gameType: string;
  gameMode: string;
  gameId: string;
  player1Id: string;
  player2Id: string;
  isPlayer1: boolean;
  lastCombatLog?: CombatLog;
  combatHistory?: CombatLog[];
  abilityLog?: any[];
  abilityBuffs?: AbilityBuff[];
  opponentAbilityBuffs?: AbilityBuff[];
  extraDeploy?: number;
  blockedEffects?: boolean;
  opponentBlockedEffects?: boolean;
  negateAndHalve?: boolean;
  opponentNegateAndHalve?: boolean;
  protectedElement?: string;
  opponentProtectedElement?: string;
  seq: number;
  turnDeadline: number | null;
  responsiblePlayerIds: string[];
  consecutiveTimeouts: { player1: number; player2: number };
  battlefieldModeEnabled?: boolean;
  battlefieldActiveCards?: { myCard: FieldCard | null; oppCard: FieldCard | null } | null;
  battlefieldDeckRemaining?: { myCount: number; oppCount: number } | null;
}

export interface CombatResult {
  player1Breakdown: CardPowerBreakdown[];
  player2Breakdown: CardPowerBreakdown[];
  player1Total: number;
  player2Total: number;
  damage: number;
  winner: "player1" | "player2" | "tie";
  combatSummary: CombatSummary;
  combatLog: CombatLog;
  newPlayer1HP: number;
  newPlayer2HP: number;
  newPlayer1VP: number;
  newPlayer2VP: number;
  newPlayer1WP: number;
  newPlayer2WP: number;
  gameOver: boolean;
  winnerId: string | null;
}

type ActionResult = 
  | { success: true; type: "state_update"; broadcast?: string }
  | { success: true; type: "combat_result"; combatResult: CombatResult }
  | { success: true; type: "game_over"; winnerId: string; reason: string }
  | { success: false; error: string };

class ServerGameEngine {
  private activeGames: Map<string, ActivePvPGame> = new Map();
  private cardCache: Map<string, Card> = new Map();
  private commanderCache: Map<string, Commander> = new Map();

  async getCardById(instanceId: string): Promise<Card | undefined> {
    const baseId = getCardIdFromInstance(instanceId);
    if (this.cardCache.has(baseId)) return this.cardCache.get(baseId);
    const card = await storage.getCard(baseId);
    if (card) this.cardCache.set(baseId, card);
    return card;
  }

  async getCommanderById(id: string): Promise<Commander | undefined> {
    if (this.commanderCache.has(id)) return this.commanderCache.get(id);
    const commander = await storage.getCommander(id);
    if (commander) this.commanderCache.set(id, commander);
    return commander;
  }

  async loadCards(instanceIds: string[]): Promise<Card[]> {
    const cards: Card[] = [];
    for (const id of instanceIds) {
      const card = await this.getCardById(id);
      if (card) cards.push(card);
    }
    return cards;
  }

  async registerGame(game: Game): Promise<void> {
    this.activeGames.set(game.id, {
      game: { ...game },
      player1TurnEnded: false,
      player2TurnEnded: false,
      player1Deployed: false,
      player2Deployed: false,
      player1DrawnThisTurn: false,
      player2DrawnThisTurn: false,
      usedAbilities: new Set(),
      disconnectTimers: new Map(),
      disconnectedPlayers: new Set(),
      combatResolving: false,
      seq: 0,
      turnTimer: null,
      turnDeadline: null,
      consecutiveTimeouts: new Map(),
      recentActionIds: new Map(),
      battlefieldMode: !!((game.gameState as any).battlefieldMode),
      p1ActiveFieldCard: null,
      p2ActiveFieldCard: null,
    });
    // Start the inactivity turn timer for the initial phase.
    this.scheduleTurnTimer(game.id);
  }

  setBroadcastHandler(gameId: string, handler: EngineBroadcastHandler): void {
    const active = this.activeGames.get(gameId);
    if (active) active.broadcastHandler = handler;
  }

  getActiveGame(gameId: string): ActivePvPGame | undefined {
    return this.activeGames.get(gameId);
  }

  removeGame(gameId: string): void {
    const active = this.activeGames.get(gameId);
    if (active) {
      for (const timer of active.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      if (active.turnTimer) {
        clearTimeout(active.turnTimer);
        active.turnTimer = null;
      }
      this.activeGames.delete(gameId);
    }
  }

  /**
   * Idempotency check for client-supplied action ids. Returns true if the
   * (playerId, clientActionId) pair was already seen — in which case the
   * caller should silently no-op rather than re-execute the action.
   * Cap retained ids per player at 32 to avoid unbounded growth.
   */
  markActionSeen(gameId: string, playerId: string, clientActionId?: string): boolean {
    if (!clientActionId) return false;
    const active = this.activeGames.get(gameId);
    if (!active) return false;
    let set = active.recentActionIds.get(playerId);
    if (!set) {
      set = new Set();
      active.recentActionIds.set(playerId, set);
    }
    if (set.has(clientActionId)) return true;
    set.add(clientActionId);
    if (set.size > 32) {
      const first = set.values().next().value;
      if (first) set.delete(first);
    }
    return false;
  }

  /**
   * Reset the consecutive-timeout counter for a player who took a manual
   * action — they're clearly not AFK.
   */
  noteManualAction(gameId: string, playerId: string): void {
    const active = this.activeGames.get(gameId);
    if (!active) return;
    active.consecutiveTimeouts.set(playerId, 0);
  }

  /**
   * Bump the monotonic state-change sequence and re-arm the per-game turn
   * inactivity timer. Call this after every successful state mutation so the
   * client can drop stale updates and so AFK detection stays current.
   */
  private bumpSeqAndReschedule(gameId: string): void {
    const active = this.activeGames.get(gameId);
    if (!active) return;
    active.seq += 1;
    this.scheduleTurnTimer(gameId);
  }

  /**
   * Compute which player ids are currently expected to act for the active
   * phase. Used both to render the UI ("opponent's turn — thinking…") and
   * to know whose timeout counter to bump on inactivity.
   */
  private getResponsiblePlayerIds(active: ActivePvPGame): string[] {
    const game = active.game;
    if (game.status !== "in_progress") return [];
    const p1 = game.player1Id;
    const p2 = game.player2Id;
    if (!p2) return [];
    switch (game.currentPhase) {
      case "draw":
        return [
          ...(active.player1DrawnThisTurn ? [] : [p1]),
          ...(active.player2DrawnThisTurn ? [] : [p2]),
        ];
      case "deployment":
        return [
          ...(active.player1Deployed ? [] : [p1]),
          ...(active.player2Deployed ? [] : [p2]),
        ];
      case "combat":
        return [
          ...(active.player1TurnEnded ? [] : [p1]),
          ...(active.player2TurnEnded ? [] : [p2]),
        ];
      default:
        return [];
    }
  }

  private scheduleTurnTimer(gameId: string): void {
    const active = this.activeGames.get(gameId);
    if (!active) return;
    if (active.turnTimer) {
      clearTimeout(active.turnTimer);
      active.turnTimer = null;
    }
    if (active.game.status !== "in_progress") {
      active.turnDeadline = null;
      return;
    }
    const responsible = this.getResponsiblePlayerIds(active);
    if (responsible.length === 0) {
      active.turnDeadline = null;
      return;
    }
    const ms = Number(process.env.MP_TURN_TIMEOUT_MS) || 60_000;
    active.turnDeadline = Date.now() + ms;
    active.turnTimer = setTimeout(() => {
      this.onTurnTimeout(gameId).catch((err) => {
        console.error(`[gameEngine] turn-timer error for ${gameId}:`, err);
      });
    }, ms);
  }

  /**
   * Auto-advance the game when a turn-timer expires:
   *   - increment each responsible player's consecutive-timeout strike
   *   - if any player hits 3 strikes, forfeit them
   *   - otherwise, auto-execute their pending action (auto-draw, auto-deploy,
   *     auto-end-turn) so the game keeps moving
   * Then re-arm the timer for whatever phase we land in.
   */
  private async onTurnTimeout(gameId: string): Promise<void> {
    const active = this.activeGames.get(gameId);
    if (!active) return;
    if (active.game.status !== "in_progress") return;

    active.turnTimer = null;
    active.turnDeadline = null;

    const responsible = this.getResponsiblePlayerIds(active);
    if (responsible.length === 0) return;

    // First, count strikes and check for any 3-strike forfeit.
    for (const pid of responsible) {
      const next = (active.consecutiveTimeouts.get(pid) || 0) + 1;
      active.consecutiveTimeouts.set(pid, next);
      if (next >= 3) {
        const result = await this.forfeitGame(gameId, pid, "turn_timeout_forfeit");
        if (result.success && result.type === "game_over") {
          active.broadcastHandler?.("turn_timeout_forfeit", {
            gameId,
            forfeitedPlayerId: pid,
            winnerId: result.winnerId,
          });
          active.broadcastHandler?.("game_over_from_timeout", {
            gameId,
            winnerId: result.winnerId,
            reason: result.reason,
          });
        }
        return;
      }
    }

    // No forfeit yet — auto-execute each responsible player's pending action.
    active.broadcastHandler?.("turn_timeout", {
      gameId,
      players: responsible.slice(),
      strikes: responsible.map((pid) => ({
        playerId: pid,
        consecutive: active.consecutiveTimeouts.get(pid) || 0,
      })),
    });

    for (const pid of responsible) {
      try {
        await this.autoActionForPlayer(gameId, pid);
      } catch (err) {
        console.error(`[gameEngine] auto-action failed for ${pid}:`, err);
      }
    }

    // After auto-actions, broadcast latest state and re-arm.
    active.broadcastHandler?.("state_advance", { gameId });
    this.scheduleTurnTimer(gameId);
  }

  private async autoActionForPlayer(gameId: string, playerId: string): Promise<void> {
    const active = this.activeGames.get(gameId);
    if (!active) return;
    const game = active.game;
    if (game.status !== "in_progress") return;
    const isP1 = this.isPlayer1(game, playerId);
    const phase = game.currentPhase;

    if (phase === "draw") {
      const drawn = isP1 ? active.player1DrawnThisTurn : active.player2DrawnThisTurn;
      if (!drawn) await this.processDrawPhase(gameId, playerId);
    } else if (phase === "deployment") {
      const deployed = isP1 ? active.player1Deployed : active.player2Deployed;
      if (!deployed) {
        const gs = game.gameState;
        const hand = isP1 ? gs.player1Hand : gs.player2Hand;
        const modeConfig = this.getGameMode(game);
        const extra = (isP1 ? gs.player1ExtraDeploy : gs.player2ExtraDeploy) || 0;
        const want = Math.min(modeConfig.cardsToDeploy + extra, hand.length);
        const cardIds = hand.slice(0, want);
        await this.processDeployment(gameId, playerId, cardIds);
      }
    } else if (phase === "combat") {
      const ended = isP1 ? active.player1TurnEnded : active.player2TurnEnded;
      if (!ended) await this.processEndTurn(gameId, playerId);
    }
  }

  private isPlayer1(game: Game, playerId: string): boolean {
    return game.player1Id === playerId;
  }

  private getGameMode(game: Game) {
    const mode = (game as any).gameMode || "standard";
    return GAME_MODE_CONFIG[mode as keyof typeof GAME_MODE_CONFIG] || GAME_MODE_CONFIG.standard;
  }

  async processDrawPhase(gameId: string, playerId: string): Promise<ActionResult> {
    const active = this.activeGames.get(gameId);
    if (!active) return { success: false, error: "Game not found" };

    const game = active.game;
    if (game.status !== "in_progress") return { success: false, error: "Game is not in progress" };
    if (game.currentPhase !== "draw") return { success: false, error: "Not in draw phase" };

    const isP1 = this.isPlayer1(game, playerId);
    if (isP1 && active.player1DrawnThisTurn) return { success: false, error: "Already drawn this turn" };
    if (!isP1 && active.player2DrawnThisTurn) return { success: false, error: "Already drawn this turn" };

    const modeConfig = this.getGameMode(game);
    const cardsToDraw = modeConfig.cardsToDraw;

    const gs = game.gameState;
    const deck = isP1 ? [...gs.player1Deck] : [...gs.player2Deck];
    const hand = isP1 ? [...gs.player1Hand] : [...gs.player2Hand];

    if (deck.length < cardsToDraw) {
      return { success: false, error: "Not enough cards to draw" };
    }

    for (let i = 0; i < cardsToDraw; i++) {
      hand.push(deck.shift()!);
    }

    if (isP1) {
      gs.player1Deck = deck;
      gs.player1Hand = hand;
      gs.player1HasDrawn = true;
      active.player1DrawnThisTurn = true;
    } else {
      gs.player2Deck = deck;
      gs.player2Hand = hand;
      gs.player2HasDrawn = true;
      active.player2DrawnThisTurn = true;
    }

    if (active.player1DrawnThisTurn && active.player2DrawnThisTurn) {
      game.currentPhase = "deployment";
      // Battlefield mode: flip one card from each player's field deck for this round
      if (active.battlefieldMode) {
        const gsAny = gs as any;
        const p1Deck: string[] = [...(gsAny.p1BattlefieldDeck || [])];
        const p2Deck: string[] = [...(gsAny.p2BattlefieldDeck || [])];
        if (p1Deck.length > 0) {
          const cardId = p1Deck.shift()!;
          gsAny.p1BattlefieldDeck = p1Deck;
          gsAny.p1ActiveFieldCardId = cardId;
          active.p1ActiveFieldCard = (await storage.getFieldCard(cardId)) || null;
        } else {
          gsAny.p1ActiveFieldCardId = null;
          active.p1ActiveFieldCard = null;
        }
        if (p2Deck.length > 0) {
          const cardId = p2Deck.shift()!;
          gsAny.p2BattlefieldDeck = p2Deck;
          gsAny.p2ActiveFieldCardId = cardId;
          active.p2ActiveFieldCard = (await storage.getFieldCard(cardId)) || null;
        } else {
          gsAny.p2ActiveFieldCardId = null;
          active.p2ActiveFieldCard = null;
        }
      }
    }

    await this.persistGame(game);
    return { success: true, type: "state_update", broadcast: "opponent_drew" };
  }

  async processDeployment(gameId: string, playerId: string, cardIds: string[]): Promise<ActionResult> {
    const active = this.activeGames.get(gameId);
    if (!active) return { success: false, error: "Game not found" };

    const game = active.game;
    if (game.status !== "in_progress") return { success: false, error: "Game is not in progress" };
    if (game.currentPhase !== "deployment") return { success: false, error: "Not in deployment phase" };

    const isP1 = this.isPlayer1(game, playerId);
    if (isP1 && active.player1Deployed) return { success: false, error: "Already deployed this turn" };
    if (!isP1 && active.player2Deployed) return { success: false, error: "Already deployed this turn" };

    const gs = game.gameState;
    const hand = isP1 ? [...gs.player1Hand] : [...gs.player2Hand];
    const battlefield = isP1 ? [...gs.player1Battlefield] : [...gs.player2Battlefield];

    const modeConfig = this.getGameMode(game);
    let maxDeploy = modeConfig.cardsToDeploy + ((isP1 ? gs.player1ExtraDeploy : gs.player2ExtraDeploy) || 0);
    // Battlefield mode: apply deploy_limit_override from active field cards (minimum value wins)
    if (active.battlefieldMode) {
      const overrides: number[] = [active.p1ActiveFieldCard, active.p2ActiveFieldCard]
        .filter((fc): fc is FieldCard => fc !== null)
        .flatMap(fc => fc.effects)
        .filter((eff): eff is any => eff.type === "deploy_limit_override")
        .map((eff: any) => eff.value as number);
      if (overrides.length > 0) {
        maxDeploy = Math.max(1, Math.min(maxDeploy, ...overrides));
      }
    }

    if (cardIds.length > maxDeploy) {
      return { success: false, error: `Cannot deploy more than ${maxDeploy} cards` };
    }
    
    const requiredDeploy = Math.min(maxDeploy, hand.length);
    if (cardIds.length < requiredDeploy) {
      return { success: false, error: `Must deploy exactly ${requiredDeploy} cards` };
    }

    for (const cardId of cardIds) {
      const idx = hand.indexOf(cardId);
      if (idx === -1) {
        return { success: false, error: `Card ${cardId} not in hand` };
      }
      hand.splice(idx, 1);
      battlefield.push({ cardId, faceDown: true });
    }

    if (isP1) {
      gs.player1Hand = hand;
      gs.player1Battlefield = battlefield;
      active.player1Deployed = true;
    } else {
      gs.player2Hand = hand;
      gs.player2Battlefield = battlefield;
      active.player2Deployed = true;
    }

    if (active.player1Deployed && active.player2Deployed) {
      game.currentPhase = "combat";
      gs.player1Battlefield.forEach(bf => bf.faceDown = false);
      gs.player2Battlefield.forEach(bf => bf.faceDown = false);
    }

    await this.persistGame(game);
    return { success: true, type: "state_update", broadcast: "opponent_deployed" };
  }

  async processAbility(gameId: string, playerId: string, abilityId: string): Promise<ActionResult> {
    const active = this.activeGames.get(gameId);
    if (!active) return { success: false, error: "Game not found" };

    const game = active.game;
    if (game.status !== "in_progress") return { success: false, error: "Game is not in progress" };
    if (game.currentPhase !== "combat" && game.currentPhase !== "deployment" && game.currentPhase !== "draw") {
      return { success: false, error: "Cannot use abilities in this phase" };
    }

    const turnKey = `${game.currentTurn}:${playerId}:${abilityId}`;
    if (active.usedAbilities.has(turnKey)) {
      return { success: false, error: "Already used this ability this turn" };
    }

    const isP1 = this.isPlayer1(game, playerId);
    const gs = game.gameState;
    const commanderId = isP1 ? gs.player1CommanderId : gs.player2CommanderId;
    if (!commanderId) return { success: false, error: "No commander found" };

    const commander = await this.getCommanderById(commanderId);
    if (!commander) return { success: false, error: "Commander not found" };

    const ability = commander.abilities.find(a => a.id === abilityId);
    if (!ability) return { success: false, error: "Ability not found" };

    if (ability.phase !== game.currentPhase) {
      return { success: false, error: `This ability can only be used during ${ability.phase} phase` };
    }

    const currentVP = isP1 ? game.player1VictoryPoints : game.player2VictoryPoints;
    const currentWP = isP1 ? game.player1WithdrawalPoints : game.player2WithdrawalPoints;

    if (currentVP < ability.victoryCost || currentWP < ability.withdrawalCost) {
      return { success: false, error: "Not enough counter points" };
    }

    if (isP1) {
      game.player1VictoryPoints -= ability.victoryCost;
      game.player1WithdrawalPoints -= ability.withdrawalCost;
    } else {
      game.player2VictoryPoints -= ability.victoryCost;
      game.player2WithdrawalPoints -= ability.withdrawalCost;
    }

    await this.applyAbilityEffect(game, isP1, ability, commander);
    active.usedAbilities.add(turnKey);

    await this.persistGame(game);
    return { success: true, type: "state_update", broadcast: "ability_used" };
  }

  private async applyAbilityEffect(game: Game, isP1: boolean, ability: CommanderAbility, commander: Commander) {
    const gs = game.gameState;
    const effect = ability.effect;

    const myHandKey = isP1 ? "player1Hand" : "player2Hand";
    const myDeckKey = isP1 ? "player1Deck" : "player2Deck";
    const myBFKey = isP1 ? "player1Battlefield" : "player2Battlefield";
    const myBuffsKey = isP1 ? "player1AbilityBuffs" : "player2AbilityBuffs";
    const oppBuffsKey = isP1 ? "player2AbilityBuffs" : "player1AbilityBuffs";
    const myExtraDeployKey = isP1 ? "player1ExtraDeploy" : "player2ExtraDeploy";
    const oppBlockedKey = isP1 ? "player2BlockedEffects" : "player1BlockedEffects";
    const myNegateKey = isP1 ? "player1NegateAndHalve" : "player2NegateAndHalve";
    const myProtectKey = isP1 ? "player1ProtectedElement" : "player2ProtectedElement";
    const myYardKey = isP1 ? "player1Yard" : "player2Yard";
    const oppBFKey = isP1 ? "player2Battlefield" : "player1Battlefield";
    const oppYardKey = isP1 ? "player2Yard" : "player1Yard";

    let effectDescription = "";

    switch (effect.type) {
      case "direct_damage": {
        const dmg = effect.value || 4;
        if (isP1) game.player2HP -= dmg;
        else game.player1HP -= dmg;
        effectDescription = `Dealt ${dmg} direct damage`;
        break;
      }
      case "element_power_damage": {
        const bfCards = (gs as any)[myBFKey] as BattlefieldCard[];
        let totalPower = 0;
        for (const bf of bfCards) {
          const c = await this.getCardById(bf.cardId);
          if (c && c.element === commander.element) totalPower += c.power;
        }
        if (isP1) game.player2HP -= totalPower;
        else game.player1HP -= totalPower;
        effectDescription = `Dealt ${totalPower} element power damage`;
        break;
      }
      case "buff_element_unit": {
        const buffValue = effect.value || 4;
        const targetEl = (effect.target || commander.element).toLowerCase();
        const currentBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentBuffs, { targetElement: targetEl, amount: buffValue, type: "buff" }];
        effectDescription = `Buffed ${targetEl} units +${buffValue}`;
        break;
      }
      case "extra_deploy": {
        const current = ((gs as any)[myExtraDeployKey] as number) || 0;
        (gs as any)[myExtraDeployKey] = current + (effect.value || 1);
        effectDescription = `Extra deploy granted`;
        break;
      }
      case "cycle_element_cards": {
        const hand = [...(gs as any)[myHandKey]] as string[];
        const elementName = (effect.target || commander.element).toLowerCase();
        const elementCards = [];
        const remainingHand = [];
        for (const cardId of hand) {
          const card = await this.getCardById(cardId);
          if (card && card.element.toLowerCase() === elementName) {
            elementCards.push(cardId);
          } else {
            remainingHand.push(cardId);
          }
        }
        const count = elementCards.length;
        const deck = [...(gs as any)[myDeckKey] as string[], ...elementCards];
        const shuffled = shuffleArray(deck);
        const drawn = shuffled.splice(0, Math.min(count, shuffled.length));
        (gs as any)[myHandKey] = [...remainingHand, ...drawn];
        (gs as any)[myDeckKey] = shuffled;
        effectDescription = `Cycled ${count} cards, drew ${drawn.length}`;
        break;
      }
      case "block_effects": {
        (gs as any)[oppBlockedKey] = true;
        effectDescription = `Blocked enemy effects`;
        break;
      }
      case "negate_and_halve": {
        (gs as any)[myNegateKey] = true;
        effectDescription = `Negated and halved enemy`;
        break;
      }
      case "healing_factor": {
        const healValue = effect.value || 4;
        const targetEl2 = (effect.target || commander.element).toLowerCase();
        const currentBuffs2: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentBuffs2, { targetElement: targetEl2, amount: healValue, type: "heal" }];
        effectDescription = `Healing factor +${healValue}`;
        break;
      }
      case "draw_cards": {
        const drawCount = effect.value || 2;
        const deck = [...(gs as any)[myDeckKey] as string[]];
        const hand = [...(gs as any)[myHandKey] as string[]];
        const actualDraw = Math.min(drawCount, deck.length);
        for (let i = 0; i < actualDraw; i++) hand.push(deck.shift()!);
        (gs as any)[myHandKey] = hand;
        (gs as any)[myDeckKey] = deck;
        effectDescription = `Drew ${actualDraw} extra cards`;
        break;
      }
      case "protect_element": {
        const protectEl = (effect.target || commander.element).toLowerCase();
        (gs as any)[myProtectKey] = protectEl;
        effectDescription = `Protected ${protectEl} units`;
        break;
      }
      case "debuff_enemy": {
        const debuffValue = effect.value || 3;
        const currentOppBuffs: AbilityBuff[] = (gs as any)[oppBuffsKey] || [];
        (gs as any)[oppBuffsKey] = [...currentOppBuffs, { targetElement: "all", amount: -debuffValue, type: "debuff" }];
        effectDescription = `Debuffed all enemy units -${debuffValue}`;
        break;
      }
      case "swap_units": {
        const bf = [...(gs as any)[myBFKey] as BattlefieldCard[]];
        const hand = [...(gs as any)[myHandKey] as string[]];
        if (bf.length > 0 && hand.length > 0) {
          const removed = bf.pop()!;
          const added = hand.pop()!;
          hand.push(removed.cardId);
          bf.push({ cardId: added, faceDown: true });
          (gs as any)[myBFKey] = bf;
          (gs as any)[myHandKey] = hand;
          effectDescription = `Swapped unit`;
        }
        break;
      }
      case "revive_unit": {
        const yard = [...(gs as any)[myYardKey] as string[]];
        const hand = [...(gs as any)[myHandKey] as string[]];
        if (yard.length > 0) {
          const revived = yard.pop()!;
          hand.push(revived);
          (gs as any)[myYardKey] = yard;
          (gs as any)[myHandKey] = hand;
          effectDescription = `Revived unit`;
        }
        break;
      }
      case "growth_buff": {
        const growthValue = effect.value || 2;
        const growthEl = (effect.target || commander.element).toLowerCase();
        const currentGrowthBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentGrowthBuffs, { targetElement: growthEl, amount: growthValue, type: "growth" }];
        effectDescription = `Growth buff +${growthValue}`;
        break;
      }
      case "prevent_ward": {
        const protEl = (effect.target || commander.element).toLowerCase();
        (gs as any)[myProtectKey] = protEl;
        effectDescription = `Protected from medical ward`;
        break;
      }
      case "destroy_unit": {
        const oppBF = [...(gs as any)[oppBFKey] as BattlefieldCard[]];
        const oppYard = [...(gs as any)[oppYardKey] as string[]];
        const nonElCards = [];
        for (const bf of oppBF) {
          const c = await this.getCardById(bf.cardId);
          if (c && c.element.toLowerCase() !== commander.element.toLowerCase()) nonElCards.push(bf);
        }
        if (nonElCards.length > 0) {
          const target = nonElCards[0];
          (gs as any)[oppBFKey] = oppBF.filter(bf => bf.cardId !== target.cardId);
          oppYard.push(target.cardId);
          (gs as any)[oppYardKey] = oppYard;
          effectDescription = `Destroyed enemy unit`;
        }
        break;
      }
      case "add_shield": {
        const shieldValue = effect.value || 4;
        const shieldEl = (effect.target || commander.element).toLowerCase();
        const currentShieldBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentShieldBuffs, { targetElement: shieldEl, amount: shieldValue, type: "shield" }];
        effectDescription = `Shield +${shieldValue}`;
        break;
      }
      case "reduce_power": {
        const reduceValue = effect.value || 4;
        const currentReduceDebuffs: AbilityBuff[] = (gs as any)[oppBuffsKey] || [];
        const oppElement = commander.element.toLowerCase();
        (gs as any)[oppBuffsKey] = [...currentReduceDebuffs, { targetElement: "all_non_" + oppElement, amount: -reduceValue, type: "reduce" }];
        effectDescription = `Reduced enemy power -${reduceValue}`;
        break;
      }
      case "first_strike": {
        const fsValue = effect.value || 3;
        const fsEl = (effect.target || commander.element).toLowerCase();
        const currentFSBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentFSBuffs, { targetElement: fsEl, amount: fsValue, type: "first_strike" }];
        effectDescription = `First strike +${fsValue}`;
        break;
      }
      case "add_evasion": {
        const evasionValue = effect.value || 4;
        const evasionEl = (effect.target || commander.element).toLowerCase();
        const currentEvasionBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentEvasionBuffs, { targetElement: evasionEl, amount: evasionValue, type: "shield" }];
        effectDescription = `Evasion +${evasionValue}`;
        break;
      }
      case "set_power": {
        const setPowerValue = effect.value || 1;
        const oppBF2 = [...(gs as any)[oppBFKey] as BattlefieldCard[]];
        const nonElCards2 = [];
        for (const bf of oppBF2) {
          const c = await this.getCardById(bf.cardId);
          if (c && c.element.toLowerCase() !== commander.element.toLowerCase()) nonElCards2.push(bf);
        }
        if (nonElCards2.length > 0) {
          const target = nonElCards2[0];
          (gs as any)[oppBFKey] = oppBF2.map(bf => bf.cardId === target.cardId ? { ...bf, modifiedPower: setPowerValue } : bf);
          effectDescription = `Set enemy power to ${setPowerValue}`;
        }
        break;
      }
      case "restore_from_ward": {
        const restoreCount = effect.value || 3;
        const yard2 = [...(gs as any)[myYardKey] as string[]];
        const deck2 = [...(gs as any)[myDeckKey] as string[]];
        const toRestore = Math.min(restoreCount, yard2.length);
        for (let i = 0; i < toRestore; i++) deck2.push(yard2.pop()!);
        (gs as any)[myYardKey] = yard2;
        (gs as any)[myDeckKey] = shuffleArray(deck2);
        effectDescription = `Restored ${toRestore} units`;
        break;
      }
      case "heal_and_buff": {
        // effect.value = heal HP amount (default 4)
        // effect.secondaryValue = unit buff amount (default 2) — configurable per commander
        const healAmount = effect.value || 4;
        const healBuffAmount = effect.secondaryValue ?? 2;
        if (isP1) game.player1HP = Math.min(GAME_CONSTANTS.STARTING_HP, game.player1HP + healAmount);
        else game.player2HP = Math.min(GAME_CONSTANTS.STARTING_HP, game.player2HP + healAmount);
        const healBuffEl = normEl(effect.target || commander.element);
        const currentHealBuffs: AbilityBuff[] = (gs as any)[myBuffsKey] || [];
        (gs as any)[myBuffsKey] = [...currentHealBuffs, { targetElement: healBuffEl, amount: healBuffAmount, type: "heal_buff" }];
        effectDescription = `Healed ${healAmount} HP and buffed +${healBuffAmount}`;
        break;
      }
    }

    const abilityLogEntry = {
      turn: game.currentTurn,
      phase: game.currentPhase,
      playerId: isP1 ? game.player1Id : game.player2Id!,
      abilityId: ability.id,
      abilityName: ability.name,
      commanderName: commander.name,
      victoryCost: ability.victoryCost,
      withdrawalCost: ability.withdrawalCost,
      effectDescription,
    };
    gs.abilityLog = [...(gs.abilityLog || []), abilityLogEntry];

    if (game.player1HP <= 0) {
      game.status = "completed";
      game.winnerId = game.player2Id;
    } else if (game.player2HP <= 0) {
      game.status = "completed";
      game.winnerId = game.player1Id;
    }
  }

  async processEndTurn(gameId: string, playerId: string): Promise<ActionResult> {
    const active = this.activeGames.get(gameId);
    if (!active) return { success: false, error: "Game not found" };

    const game = active.game;
    if (game.status !== "in_progress") return { success: false, error: "Game is not in progress" };

    if (game.currentPhase !== "deployment" && game.currentPhase !== "combat") {
      return { success: false, error: `Cannot end turn during ${game.currentPhase} phase` };
    }

    const isP1 = this.isPlayer1(game, playerId);

    if (game.currentPhase === "deployment") {
      if (isP1) {
        if (!active.player1Deployed) active.player1Deployed = true;
      } else {
        if (!active.player2Deployed) active.player2Deployed = true;
      }

      if (active.player1Deployed && active.player2Deployed) {
        game.currentPhase = "combat";
        game.gameState.player1Battlefield.forEach(bf => bf.faceDown = false);
        game.gameState.player2Battlefield.forEach(bf => bf.faceDown = false);
        await this.persistGame(game);
        return { success: true, type: "state_update", broadcast: "phase_changed" };
      }
      await this.persistGame(game);
      return { success: true, type: "state_update", broadcast: "opponent_deployed" };
    }

    if (isP1) active.player1TurnEnded = true;
    else active.player2TurnEnded = true;

    if (active.player1TurnEnded && active.player2TurnEnded) {
      // Guard against duplicate / racing end_turn messages re-entering combat
      // resolution while the first invocation is still awaiting (resolveCombat
      // has many awaits before it flips currentPhase off "combat").
      if (active.combatResolving) {
        return { success: false, error: "Combat is already resolving" };
      }
      active.combatResolving = true;
      try {
        const combatResult = await this.resolveCombat(gameId);
        if (combatResult) {
          return { success: true, type: "combat_result", combatResult };
        }
        return { success: false, error: "Failed to resolve combat" };
      } finally {
        active.combatResolving = false;
      }
    }

    await this.persistGame(game);
    return { success: true, type: "state_update", broadcast: "turn_ended" };
  }

  async resolveCombat(gameId: string): Promise<CombatResult | null> {
    const active = this.activeGames.get(gameId);
    if (!active) return null;

    const game = active.game;
    const gs = game.gameState;

    const p1BFCards = await this.mapBattlefieldToCards(gs.player1Battlefield);
    const p2BFCards = await this.mapBattlefieldToCards(gs.player2Battlefield);

    // Collect active field cards for this round (battlefield mode)
    const activeFieldCards: FieldCard[] = [];
    if (active.battlefieldMode) {
      if (active.p1ActiveFieldCard) activeFieldCards.push(active.p1ActiveFieldCard);
      if (active.p2ActiveFieldCard) activeFieldCards.push(active.p2ActiveFieldCard);
    }

    const p1Breakdown = await this.calculateBattlePower(
      p1BFCards, p2BFCards, gs.player1Battlefield,
      gs.player1AbilityBuffs, gs.player1BlockedEffects, gs.player2NegateAndHalve, gs.player1ProtectedElement,
      activeFieldCards
    );
    const p2Breakdown = await this.calculateBattlePower(
      p2BFCards, p1BFCards, gs.player2Battlefield,
      gs.player2AbilityBuffs, gs.player2BlockedEffects, gs.player1NegateAndHalve, gs.player2ProtectedElement,
      activeFieldCards
    );

    const p1Total = p1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const p2Total = p2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const winner: "player1" | "player2" | "tie" = p1Total > p2Total ? "player1" : p2Total > p1Total ? "player2" : "tie";

    const combatSummary = this.generateCombatSummary(
      p1Breakdown, p2Breakdown, p1Total, p2Total,
      gs.player1AbilityBuffs || [], gs.player2AbilityBuffs || [],
      gs.abilityLog || [], game.currentTurn
    );

    // Apply unique field card effects: compute boolean flags once to prevent double-application
    if (activeFieldCards.length > 0) {
      const allFieldEffects = activeFieldCards.flatMap(fc => fc.effects as any[]);
      const hasHealDoubled = allFieldEffects.some(e => e.type === "unique_effect" && e.key === "heal_doubled");
      const hasGuardianDisabled = allFieldEffects.some(e => e.type === "unique_effect" && e.key === "guardian_disabled");

      if (hasHealDoubled) {
        combatSummary.player1Healing *= 2;
        combatSummary.player2Healing *= 2;
      }

      if (hasGuardianDisabled) {
        // Only suppress Guardian TRAIT blocks; commander shield ability buffs still apply
        const totalIncomingP1 = combatSummary.baseDamageToPlayer1 + combatSummary.player2QuickStrikeDamage;
        const totalIncomingP2 = combatSummary.baseDamageToPlayer2 + combatSummary.player1QuickStrikeDamage;
        // Compute Guardian-trait-only blocked amounts from the breakdown
        let p1TraitBlocked = 0;
        for (const b of p1Breakdown) {
          if (b.traitInfo?.trait === "Guardian") {
            const blockable = Math.max(0, totalIncomingP1 - p1TraitBlocked);
            p1TraitBlocked += Math.min(b.traitInfo.value, blockable);
          }
        }
        let p2TraitBlocked = 0;
        for (const b of p2Breakdown) {
          if (b.traitInfo?.trait === "Guardian") {
            const blockable = Math.max(0, totalIncomingP2 - p2TraitBlocked);
            p2TraitBlocked += Math.min(b.traitInfo.value, blockable);
          }
        }
        // Remove only the trait-portion; shield ability buffs remain
        combatSummary.player1GuardianBlocked = Math.max(0, combatSummary.player1GuardianBlocked - p1TraitBlocked);
        combatSummary.player2GuardianBlocked = Math.max(0, combatSummary.player2GuardianBlocked - p2TraitBlocked);
        combatSummary.finalDamageToPlayer1 = Math.max(0, totalIncomingP1 - combatSummary.player1GuardianBlocked);
        combatSummary.finalDamageToPlayer2 = Math.max(0, totalIncomingP2 - combatSummary.player2GuardianBlocked);
      }
    }

    let newP1HP = Math.min(GAME_CONSTANTS.STARTING_HP, game.player1HP + combatSummary.player1Healing);
    newP1HP -= combatSummary.finalDamageToPlayer1;
    let newP2HP = Math.min(GAME_CONSTANTS.STARTING_HP, game.player2HP + combatSummary.player2Healing);
    newP2HP -= combatSummary.finalDamageToPlayer2;
    let newP1VP = game.player1VictoryPoints;
    let newP2VP = game.player2VictoryPoints;
    let newP1WP = game.player1WithdrawalPoints;
    let newP2WP = game.player2WithdrawalPoints;

    if (winner === "player1") {
      newP1VP += 1;
      newP2WP += 1;
    } else if (winner === "player2") {
      newP2VP += 1;
      newP1WP += 1;
    } else {
      newP1VP += 1; newP2VP += 1;
      newP1WP += 1; newP2WP += 1;
    }

    if (combatSummary.player1CardsDrawn > 0) {
      const deck = [...gs.player1Deck];
      const hand = [...gs.player1Hand];
      const toDraw = Math.min(combatSummary.player1CardsDrawn, deck.length);
      for (let i = 0; i < toDraw; i++) hand.push(deck.shift()!);
      gs.player1Deck = deck;
      gs.player1Hand = hand;
    }
    if (combatSummary.player2CardsDrawn > 0) {
      const deck = [...gs.player2Deck];
      const hand = [...gs.player2Hand];
      const toDraw = Math.min(combatSummary.player2CardsDrawn, deck.length);
      for (let i = 0; i < toDraw; i++) hand.push(deck.shift()!);
      gs.player2Deck = deck;
      gs.player2Hand = hand;
    }

    const p1Yard = [...gs.player1Yard, ...gs.player1Battlefield.map(bf => bf.cardId)];
    const p2Yard = [...gs.player2Yard, ...gs.player2Battlefield.map(bf => bf.cardId)];

    const loserNetDmg = winner === "player1"
      ? combatSummary.finalDamageToPlayer2
      : winner === "player2"
        ? combatSummary.finalDamageToPlayer1
        : 0;

    const combatLog: CombatLog = {
      player1Cards: p1Breakdown.map(b => ({
        cardId: b.card.id,
        cardName: b.card.name,
        basePower: b.basePower,
        buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
        debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
        finalPower: b.finalPower,
        traitName: b.traitInfo?.trait,
        traitValue: b.traitInfo?.value,
      })),
      player2Cards: p2Breakdown.map(b => ({
        cardId: b.card.id,
        cardName: b.card.name,
        basePower: b.basePower,
        buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
        debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
        finalPower: b.finalPower,
        traitName: b.traitInfo?.trait,
        traitValue: b.traitInfo?.value,
      })),
      player1Total: p1Total,
      player2Total: p2Total,
      damage: loserNetDmg,
      winner,
      turn: game.currentTurn,
      abilityEffects: combatSummary.abilityEffects,
      player1QuickStrikeDamage: combatSummary.player1QuickStrikeDamage,
      player2QuickStrikeDamage: combatSummary.player2QuickStrikeDamage,
      player1GuardianBlocked: combatSummary.player1GuardianBlocked,
      player2GuardianBlocked: combatSummary.player2GuardianBlocked,
      player1Healing: combatSummary.player1Healing,
      player2Healing: combatSummary.player2Healing,
      player1CardsDrawn: combatSummary.player1CardsDrawn,
      player2CardsDrawn: combatSummary.player2CardsDrawn,
      player1NetDmg: combatSummary.finalDamageToPlayer1,
      player2NetDmg: combatSummary.finalDamageToPlayer2,
    };

    game.player1HP = newP1HP;
    game.player2HP = newP2HP;
    game.player1VictoryPoints = newP1VP;
    game.player2VictoryPoints = newP2VP;
    game.player1WithdrawalPoints = newP1WP;
    game.player2WithdrawalPoints = newP2WP;
    gs.player1Battlefield = [];
    gs.player2Battlefield = [];
    gs.player1Yard = p1Yard;
    gs.player2Yard = p2Yard;
    gs.player1AbilityBuffs = [];
    gs.player2AbilityBuffs = [];
    gs.player1ExtraDeploy = 0;
    gs.player2ExtraDeploy = 0;
    gs.player1BlockedEffects = false;
    gs.player2BlockedEffects = false;
    gs.player1NegateAndHalve = false;
    gs.player2NegateAndHalve = false;
    gs.player1ProtectedElement = undefined;
    gs.player2ProtectedElement = undefined;
    // Clear battlefield field cards after round resolves
    if (active.battlefieldMode) {
      (gs as any).p1ActiveFieldCardId = null;
      (gs as any).p2ActiveFieldCardId = null;
      active.p1ActiveFieldCard = null;
      active.p2ActiveFieldCard = null;
    }
    gs.lastCombatLog = combatLog;
    gs.combatHistory = [...(gs.combatHistory || []), combatLog];
    gs.player1HasDrawn = false;
    gs.player2HasDrawn = false;

    let gameOver = false;
    let resultWinnerId: string | null = null;

    if (newP1HP <= 0) {
      game.status = "completed";
      game.winnerId = game.player2Id;
      gameOver = true;
      resultWinnerId = game.player2Id;
    } else if (newP2HP <= 0) {
      game.status = "completed";
      game.winnerId = game.player1Id;
      gameOver = true;
      resultWinnerId = game.player1Id;
    } else {
      game.currentPhase = "draw";
      game.currentTurn += 1;
    }

    active.player1TurnEnded = false;
    active.player2TurnEnded = false;
    active.player1Deployed = false;
    active.player2Deployed = false;
    active.player1DrawnThisTurn = false;
    active.player2DrawnThisTurn = false;
    active.usedAbilities.clear();

    await this.persistGame(game);

    return {
      player1Breakdown: p1Breakdown.map(b => ({
        cardId: b.card.id,
        cardName: b.card.name,
        basePower: b.basePower,
        buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
        debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
        finalPower: b.finalPower,
        traitName: b.traitInfo?.trait,
        traitValue: b.traitInfo?.value,
      })),
      player2Breakdown: p2Breakdown.map(b => ({
        cardId: b.card.id,
        cardName: b.card.name,
        basePower: b.basePower,
        buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
        debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
        finalPower: b.finalPower,
        traitName: b.traitInfo?.trait,
        traitValue: b.traitInfo?.value,
      })),
      player1Total: p1Total,
      player2Total: p2Total,
      damage: loserNetDmg,
      winner,
      combatSummary,
      combatLog,
      newPlayer1HP: newP1HP,
      newPlayer2HP: newP2HP,
      newPlayer1VP: newP1VP,
      newPlayer2VP: newP2VP,
      newPlayer1WP: newP1WP,
      newPlayer2WP: newP2WP,
      gameOver,
      winnerId: resultWinnerId,
    };
  }

  private async mapBattlefieldToCards(battlefield: BattlefieldCard[]): Promise<Card[]> {
    const cards: Card[] = [];
    for (const bf of battlefield) {
      const card = await this.getCardById(bf.cardId);
      if (card) {
        if (bf.modifiedPower !== undefined) {
          cards.push({ ...card, power: bf.modifiedPower });
        } else {
          cards.push(card);
        }
      }
    }
    return cards;
  }

  private async calculateBattlePower(
    friendlyCards: Card[],
    enemyCards: Card[],
    battlefield: BattlefieldCard[],
    friendlyAbilityBuffs?: AbilityBuff[],
    enemyBlockedEffects?: boolean,
    enemyNegateAndHalve?: boolean,
    friendlyProtectedElement?: string,
    activeFieldCards?: FieldCard[],
  ): Promise<ServerCardBreakdown[]> {
    return friendlyCards.map(card => {
      const basePower = card.power;
      const buffBonuses: { fromCard: Card; amount: number }[] = [];
      const debuffPenalties: { fromCard: Card; amount: number }[] = [];

      let halvedPower = basePower;
      if (enemyNegateAndHalve) {
        halvedPower = Math.floor(basePower / 2);
      }

      // Friendly card-to-card buffs (suppressed if enemy blocked our effects).
      if (!enemyBlockedEffects) {
        friendlyCards.forEach(friendlyCard => {
          if (friendlyCard.id !== card.id && friendlyCard.buffModifier > 0 && friendlyCard.buffColor) {
            const buffElement = normEl(colorToElement[friendlyCard.buffColor]);
            if (buffElement === normEl(card.element)) {
              buffBonuses.push({ fromCard: friendlyCard, amount: friendlyCard.buffModifier });
            }
          }
        });
      }

      // Friendly commander ability positive buffs.
      // Suppressed when enemy has negate_and_halve active (negates our commander effects).
      if (friendlyAbilityBuffs && !enemyNegateAndHalve) {
        friendlyAbilityBuffs.forEach(ab => {
          if (ab.amount > 0 && (ab.targetElement === "all" || ab.targetElement === normEl(card.element))) {
            buffBonuses.push({ fromCard: card, amount: ab.amount });
          }
        });
      }

      const isProtected = !!friendlyProtectedElement && normEl(card.element) === normEl(friendlyProtectedElement);

      // Enemy unit card debuffs — always apply unless this unit is protected.
      // NOT gated by negate_and_halve: unit card debuffs are not commander effects.
      if (!isProtected) {
        enemyCards.forEach(enemyCard => {
          if (enemyCard.debuffModifier > 0 && enemyCard.debuffColor) {
            const debuffElement = normEl(colorToElement[enemyCard.debuffColor]);
            if (debuffElement === normEl(card.element)) {
              debuffPenalties.push({ fromCard: enemyCard, amount: enemyCard.debuffModifier });
            }
          }
        });
      }

      // Negative ability buffs — commander debuffs planted in our array by the enemy
      // commander (e.g. debuff_enemy, reduce_power).  These are the ENEMY's commander
      // effects, so they are NOT suppressed by our own negate_and_halve.
      if (friendlyAbilityBuffs && !isProtected) {
        const cardElNorm = normEl(card.element);
        friendlyAbilityBuffs.forEach(ab => {
          if (ab.amount < 0) {
            const tgt = ab.targetElement ?? "";
            const matches =
              tgt === "all" ||
              tgt === cardElNorm ||
              // reduce_power uses "all_non_<element>" to target every element except one
              (tgt.startsWith("all_non_") && tgt !== `all_non_${cardElNorm}`);
            if (matches) {
              debuffPenalties.push({ fromCard: card, amount: Math.abs(ab.amount) });
            }
          }
        });
      }

      // Battlefield mode: apply global field card effects (element_buff / element_debuff / all_units_debuff)
      if (activeFieldCards && activeFieldCards.length > 0) {
        for (const fc of activeFieldCards) {
          for (const eff of fc.effects as any[]) {
            if (eff.type === "element_buff" && eff.element) {
              if (normEl(card.element) === normEl(eff.element)) {
                buffBonuses.push({ fromCard: card, amount: eff.value });
              }
            } else if (eff.type === "element_debuff" && eff.element) {
              if (normEl(card.element) === normEl(eff.element)) {
                debuffPenalties.push({ fromCard: card, amount: eff.value });
              }
            } else if (eff.type === "all_units_debuff") {
              debuffPenalties.push({ fromCard: card, amount: eff.value });
            }
          }
        }
      }

      const totalBuffs = buffBonuses.reduce((sum, b) => sum + b.amount, 0);
      const totalDebuffs = debuffPenalties.reduce((sum, d) => sum + d.amount, 0);
      const effectiveBase = enemyNegateAndHalve ? halvedPower : basePower;
      const finalPower = Math.max(0, effectiveBase + totalBuffs - totalDebuffs);

      const traitInfo = card.trait && card.traitValue !== null
        ? { trait: card.trait, value: card.traitValue }
        : null;

      return { card, basePower: effectiveBase, buffBonuses, debuffPenalties, traitInfo, finalPower };
    });
  }

  private generateCombatSummary(
    p1Breakdown: ServerCardBreakdown[],
    p2Breakdown: ServerCardBreakdown[],
    p1Total: number,
    p2Total: number,
    p1AbilityBuffs: AbilityBuff[] = [],
    p2AbilityBuffs: AbilityBuff[] = [],
    abilityLog: any[] = [],
    currentTurn: number = 0,
  ): CombatSummary {
    let player1QuickStrikeDamage = 0;
    let player2QuickStrikeDamage = 0;
    let player1GuardianBlocked = 0;
    let player2GuardianBlocked = 0;
    let player1Healing = 0;
    let player2Healing = 0;
    let player1CardsDrawn = 0;
    let player2CardsDrawn = 0;

    p1Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike").forEach(b => {
      player1QuickStrikeDamage += b.traitInfo!.value;
    });
    p2Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike").forEach(b => {
      player2QuickStrikeDamage += b.traitInfo!.value;
    });

    p1AbilityBuffs.filter(ab => ab.type === "first_strike").forEach(ab => {
      player1QuickStrikeDamage += ab.amount;
    });
    p2AbilityBuffs.filter(ab => ab.type === "first_strike").forEach(ab => {
      player2QuickStrikeDamage += ab.amount;
    });

    const baseDamage = Math.abs(p1Total - p2Total);
    let baseDamageToPlayer1 = p2Total > p1Total ? baseDamage : 0;
    let baseDamageToPlayer2 = p1Total > p2Total ? baseDamage : 0;

    const totalIncomingToP1 = baseDamageToPlayer1 + player2QuickStrikeDamage;
    const totalIncomingToP2 = baseDamageToPlayer2 + player1QuickStrikeDamage;

    p1Breakdown.filter(b => b.traitInfo?.trait === "Guardian").forEach(b => {
      const blockAmount = Math.min(b.traitInfo!.value, totalIncomingToP1 - player1GuardianBlocked);
      if (blockAmount > 0) player1GuardianBlocked += blockAmount;
    });
    p2Breakdown.filter(b => b.traitInfo?.trait === "Guardian").forEach(b => {
      const blockAmount = Math.min(b.traitInfo!.value, totalIncomingToP2 - player2GuardianBlocked);
      if (blockAmount > 0) player2GuardianBlocked += blockAmount;
    });

    p1AbilityBuffs.filter(ab => ab.type === "shield").forEach(ab => {
      const blockAmount = Math.min(ab.amount, totalIncomingToP1 - player1GuardianBlocked);
      if (blockAmount > 0) player1GuardianBlocked += blockAmount;
    });
    p2AbilityBuffs.filter(ab => ab.type === "shield").forEach(ab => {
      const blockAmount = Math.min(ab.amount, totalIncomingToP2 - player2GuardianBlocked);
      if (blockAmount > 0) player2GuardianBlocked += blockAmount;
    });

    p1Breakdown.filter(b => b.traitInfo?.trait === "Restoration").forEach(b => {
      player1Healing += b.traitInfo!.value;
    });
    p2Breakdown.filter(b => b.traitInfo?.trait === "Restoration").forEach(b => {
      player2Healing += b.traitInfo!.value;
    });

    p1AbilityBuffs.filter(ab => ab.type === "heal").forEach(ab => {
      player1Healing += ab.amount;
    });
    p2AbilityBuffs.filter(ab => ab.type === "heal").forEach(ab => {
      player2Healing += ab.amount;
    });

    p1Breakdown.filter(b => b.traitInfo?.trait === "Care Package").forEach(b => {
      player1CardsDrawn += b.traitInfo!.value;
    });
    p2Breakdown.filter(b => b.traitInfo?.trait === "Care Package").forEach(b => {
      player2CardsDrawn += b.traitInfo!.value;
    });

    const finalDamageToPlayer1 = Math.max(0, baseDamageToPlayer1 + player2QuickStrikeDamage - player1GuardianBlocked);
    const finalDamageToPlayer2 = Math.max(0, baseDamageToPlayer2 + player1QuickStrikeDamage - player2GuardianBlocked);

    const abilityEffects: Array<{ playerSide: string; abilityName: string; effectDescription: string; phase: string }> = [];
    const turnEntries = abilityLog.filter((entry: any) => entry.turn === currentTurn);
    for (const entry of turnEntries) {
      abilityEffects.push({
        playerSide: entry.playerId || "unknown",
        abilityName: entry.abilityName || entry.name || "Unknown Ability",
        effectDescription: entry.effectDescription || entry.description || "",
        phase: entry.phase || "",
      });
    }

    return {
      player1QuickStrikeDamage, player2QuickStrikeDamage,
      player1GuardianBlocked, player2GuardianBlocked,
      player1Healing, player2Healing,
      player1CardsDrawn, player2CardsDrawn,
      baseDamageToPlayer1, baseDamageToPlayer2,
      finalDamageToPlayer1, finalDamageToPlayer2,
      abilityEffects,
    };
  }

  getGameStateForPlayer(gameId: string, playerId: string): SanitizedGameState | null {
    const active = this.activeGames.get(gameId);
    if (!active) return null;

    const game = active.game;
    const gs = game.gameState;
    const isP1 = this.isPlayer1(game, playerId);

    return {
      myHand: isP1 ? gs.player1Hand : gs.player2Hand,
      myDeckCount: isP1 ? gs.player1Deck.length : gs.player2Deck.length,
      myBattlefield: isP1 ? gs.player1Battlefield : gs.player2Battlefield,
      myYard: isP1 ? gs.player1Yard : gs.player2Yard,
      myHP: isP1 ? game.player1HP : game.player2HP,
      myVP: isP1 ? game.player1VictoryPoints : game.player2VictoryPoints,
      myWP: isP1 ? game.player1WithdrawalPoints : game.player2WithdrawalPoints,
      myCommanderId: (isP1 ? gs.player1CommanderId : gs.player2CommanderId) || "",
      myHasDrawn: isP1 ? active.player1DrawnThisTurn : active.player2DrawnThisTurn,
      myHasDeployed: isP1 ? active.player1Deployed : active.player2Deployed,
      myTurnEnded: isP1 ? active.player1TurnEnded : active.player2TurnEnded,
      opponentHandCount: isP1 ? gs.player2Hand.length : gs.player1Hand.length,
      opponentDeckCount: isP1 ? gs.player2Deck.length : gs.player1Deck.length,
      opponentBattlefield: (isP1 ? gs.player2Battlefield : gs.player1Battlefield).map(bf => {
        if (bf.faceDown && game.currentPhase === "deployment") {
          return { cardId: "hidden", faceDown: true };
        }
        return bf;
      }),
      opponentYard: isP1 ? gs.player2Yard : gs.player1Yard,
      opponentHP: isP1 ? game.player2HP : game.player1HP,
      opponentVP: isP1 ? game.player2VictoryPoints : game.player1VictoryPoints,
      opponentWP: isP1 ? game.player2WithdrawalPoints : game.player1WithdrawalPoints,
      opponentCommanderId: (isP1 ? gs.player2CommanderId : gs.player1CommanderId) || "",
      opponentHasDrawn: isP1 ? active.player2DrawnThisTurn : active.player1DrawnThisTurn,
      opponentHasDeployed: isP1 ? active.player2Deployed : active.player1Deployed,
      opponentTurnEnded: isP1 ? active.player2TurnEnded : active.player1TurnEnded,
      currentPhase: game.currentPhase,
      currentTurn: game.currentTurn,
      status: game.status,
      winnerId: game.winnerId,
      gameType: game.gameType,
      gameMode: (game as any).gameMode || "standard",
      gameId: game.id,
      player1Id: game.player1Id,
      player2Id: game.player2Id!,
      isPlayer1: isP1,
      lastCombatLog: gs.lastCombatLog,
      combatHistory: gs.combatHistory,
      abilityLog: gs.abilityLog,
      abilityBuffs: isP1 ? gs.player1AbilityBuffs : gs.player2AbilityBuffs,
      opponentAbilityBuffs: isP1 ? gs.player2AbilityBuffs : gs.player1AbilityBuffs,
      extraDeploy: isP1 ? gs.player1ExtraDeploy : gs.player2ExtraDeploy,
      blockedEffects: isP1 ? gs.player1BlockedEffects : gs.player2BlockedEffects,
      opponentBlockedEffects: isP1 ? gs.player2BlockedEffects : gs.player1BlockedEffects,
      negateAndHalve: isP1 ? gs.player1NegateAndHalve : gs.player2NegateAndHalve,
      opponentNegateAndHalve: isP1 ? gs.player2NegateAndHalve : gs.player1NegateAndHalve,
      protectedElement: isP1 ? gs.player1ProtectedElement : gs.player2ProtectedElement,
      opponentProtectedElement: isP1 ? gs.player2ProtectedElement : gs.player1ProtectedElement,
      seq: active.seq,
      turnDeadline: active.turnDeadline,
      responsiblePlayerIds: this.getResponsiblePlayerIds(active),
      consecutiveTimeouts: {
        player1: active.consecutiveTimeouts.get(game.player1Id) || 0,
        player2: active.consecutiveTimeouts.get(game.player2Id || "") || 0,
      },
      battlefieldModeEnabled: active.battlefieldMode || false,
      battlefieldActiveCards: active.battlefieldMode
        ? {
            myCard: isP1 ? active.p1ActiveFieldCard : active.p2ActiveFieldCard,
            oppCard: isP1 ? active.p2ActiveFieldCard : active.p1ActiveFieldCard,
          }
        : null,
      battlefieldDeckRemaining: active.battlefieldMode
        ? {
            myCount: isP1
              ? ((gs as any).p1BattlefieldDeck || []).length
              : ((gs as any).p2BattlefieldDeck || []).length,
            oppCount: isP1
              ? ((gs as any).p2BattlefieldDeck || []).length
              : ((gs as any).p1BattlefieldDeck || []).length,
          }
        : null,
    };
  }

  async forfeitGame(gameId: string, forfeitPlayerId: string, reason: string): Promise<ActionResult> {
    const active = this.activeGames.get(gameId);
    if (!active) return { success: false, error: "Game not found" };

    const game = active.game;
    if (game.status !== "in_progress") return { success: false, error: "Game is not in progress" };
    if (game.player1Id !== forfeitPlayerId && game.player2Id !== forfeitPlayerId) {
      return { success: false, error: "Not a participant in this game" };
    }
    const isP1 = this.isPlayer1(game, forfeitPlayerId);
    const winnerId = isP1 ? game.player2Id! : game.player1Id;

    game.status = "completed";
    game.winnerId = winnerId;
    await this.persistGame(game);

    return { success: true, type: "game_over", winnerId, reason };
  }

  handleDisconnect(gameId: string, playerId: string, onForfeit: (winnerId: string) => void): void {
    const active = this.activeGames.get(gameId);
    if (!active || active.game.status !== "in_progress") return;

    active.disconnectedPlayers.add(playerId);

    const timeoutMs = Number(process.env.MP_DISCONNECT_TIMEOUT_MS) || 60000;
    const timer = setTimeout(async () => {
      const stillActive = this.activeGames.get(gameId);
      if (!stillActive || stillActive.game.status !== "in_progress") return;
      if (!stillActive.disconnectedPlayers.has(playerId)) return;

      const result = await this.forfeitGame(gameId, playerId, "disconnect_timeout");
      if (result.success && result.type === "game_over") {
        onForfeit(result.winnerId);
      }
    }, timeoutMs);

    active.disconnectTimers.set(playerId, timer);
  }

  handleReconnect(gameId: string, playerId: string): boolean {
    const active = this.activeGames.get(gameId);
    if (!active) return false;

    const timer = active.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      active.disconnectTimers.delete(playerId);
    }
    active.disconnectedPlayers.delete(playerId);
    return true;
  }

  isPlayerDisconnected(gameId: string, playerId: string): boolean {
    const active = this.activeGames.get(gameId);
    return active?.disconnectedPlayers.has(playerId) || false;
  }

  private async persistGame(game: Game): Promise<void> {
    await storage.updateGame(game.id, {
      player1HP: game.player1HP,
      player2HP: game.player2HP,
      player1VictoryPoints: game.player1VictoryPoints,
      player2VictoryPoints: game.player2VictoryPoints,
      player1WithdrawalPoints: game.player1WithdrawalPoints,
      player2WithdrawalPoints: game.player2WithdrawalPoints,
      currentPhase: game.currentPhase,
      currentTurn: game.currentTurn,
      status: game.status,
      winnerId: game.winnerId,
      gameState: game.gameState,
    });
    // Stamp a monotonic seq on every successful state mutation and
    // re-arm the inactivity turn timer for whatever phase we landed in.
    // Clients use seq to drop stale game_state messages after reconnect.
    this.bumpSeqAndReschedule(game.id);
  }
}

export const gameEngine = new ServerGameEngine();
