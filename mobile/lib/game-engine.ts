import { Card, Commander, CommanderAbility } from './api';

export const GAME_CONSTANTS = {
  initialHP: 40,
  initialHandSize: 5,
  cardsDrawnPerTurn: 2,
  cardsDeployedPerTurn: 2,
  totalCards: 40,
  cardsPerPowerRank: 4,
};

export type GamePhase =
  | 'setup'
  | 'card_draw'
  | 'deployment'
  | 'combat'
  | 'quick_strike'
  | 'power_calculation'
  | 'guardian_block'
  | 'healing'
  | 'damage_resolution'
  | 'round_end'
  | 'game_over';

export interface DeployedCard extends Card {
  faceDown: boolean;
  currentPower: number;
  appliedBuffs: number;
  appliedDebuffs: number;
}

export interface AbilityBuff {
  type: 'buff' | 'debuff' | 'reduce' | 'growth' | 'shield' | 'first_strike' | 'heal' | 'heal_buff';
  amount: number;
  element?: string;
  abilityName: string;
  playerSide: 'p1' | 'p2';
}

export interface AbilityEffect {
  playerSide: string;
  abilityName: string;
  effectDescription: string;
  phase: string;
}

export interface PlayerState {
  hp: number;
  hand: Card[];
  deployed: DeployedCard[];
  deck: Card[];
  commander: Commander;
  victoryCurrency: number;
  withdrawalCurrency: number;
  usedAbilities: string[];
  roundPower: number;
  quickStrikeDamage: number;
  guardianBlock: number;
  healingAmount: number;
  abilityBuffs: AbilityBuff[];
}

export interface RoundResult {
  round: number;
  p1Power: number;
  p2Power: number;
  winner: 'p1' | 'p2' | 'draw';
  damage: number;
  p1HP: number;
  p2HP: number;
  p1Cards: DeployedCard[];
  p2Cards: DeployedCard[];
  p1QS: number;
  p2QS: number;
  p1Guardian: number;
  p2Guardian: number;
  p1Healing: number;
  p2Healing: number;
  abilityEffects?: AbilityEffect[];
}

export interface GameState {
  phase: GamePhase;
  round: number;
  player1: PlayerState;
  player2: PlayerState;
  currentPlayer: 'p1' | 'p2';
  roundResults: RoundResult[];
  winner: 'p1' | 'p2' | null;
  log: string[];
  abilityLog: AbilityEffect[];
  turnActions: { p1Deployed: boolean; p2Deployed: boolean };
  cardsDrawnPerTurn: number;
  cardsDeployedPerTurn: number;
}

function shuffleDeck(cards: Card[]): Card[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createPlayerState(deckCards: Card[], commander: Commander): PlayerState {
  const shuffled = shuffleDeck(deckCards);
  const hand = shuffled.slice(0, GAME_CONSTANTS.initialHandSize);
  const deck = shuffled.slice(GAME_CONSTANTS.initialHandSize);
  return {
    hp: GAME_CONSTANTS.initialHP,
    hand,
    deployed: [],
    deck,
    commander,
    victoryCurrency: 0,
    withdrawalCurrency: 0,
    usedAbilities: [],
    roundPower: 0,
    quickStrikeDamage: 0,
    guardianBlock: 0,
    healingAmount: 0,
    abilityBuffs: [],
  };
}

export function initializeGame(
  p1Cards: Card[], p1Commander: Commander,
  p2Cards: Card[], p2Commander: Commander,
  options?: { cardsDrawn?: number; cardsDeployed?: number }
): GameState {
  const cardsDrawnPerTurn = options?.cardsDrawn ?? GAME_CONSTANTS.cardsDrawnPerTurn;
  const cardsDeployedPerTurn = options?.cardsDeployed ?? GAME_CONSTANTS.cardsDeployedPerTurn;
  return {
    phase: 'card_draw',
    round: 1,
    player1: createPlayerState(p1Cards, p1Commander),
    player2: createPlayerState(p2Cards, p2Commander),
    currentPlayer: 'p1',
    roundResults: [],
    winner: null,
    log: [`Round 1 begins! (${cardsDrawnPerTurn} draw / ${cardsDeployedPerTurn} deploy per turn)`],
    abilityLog: [],
    turnActions: { p1Deployed: false, p2Deployed: false },
    cardsDrawnPerTurn,
    cardsDeployedPerTurn,
  };
}

export function drawCards(state: GameState, player: 'p1' | 'p2'): GameState {
  const ps = player === 'p1' ? { ...state.player1 } : { ...state.player2 };
  const opp = player === 'p1' ? { ...state.player2 } : { ...state.player1 };
  const log = [...state.log];
  const toDraw = Math.min(state.cardsDrawnPerTurn, ps.deck.length);

  if (toDraw === 0 && ps.deck.length === 0 && state.round > 1) {
    opp.hp = Math.max(opp.hp, 1);
    log.push(`${player === 'p1' ? 'Player' : 'Opponent'} cannot draw — deck depleted!`);
    const newState = { ...state, log };
    if (player === 'p1') {
      newState.player1 = ps;
      newState.player2 = opp;
      newState.phase = 'game_over';
      newState.winner = 'p2';
      log.push('Opponent wins by deck depletion!');
    } else {
      newState.player2 = ps;
      newState.player1 = opp;
      newState.phase = 'game_over';
      newState.winner = 'p1';
      log.push('Player wins by deck depletion!');
    }
    return newState;
  }

  const drawn = ps.deck.slice(0, toDraw);
  ps.hand = [...ps.hand, ...drawn];
  ps.deck = ps.deck.slice(toDraw);

  log.push(`${player === 'p1' ? 'Player' : 'Opponent'} drew ${toDraw} cards`);

  const newState = { ...state, log };
  if (player === 'p1') newState.player1 = ps;
  else newState.player2 = ps;
  return newState;
}

export function deployCard(state: GameState, player: 'p1' | 'p2', cardIndex: number): GameState {
  const ps = player === 'p1' ? { ...state.player1 } : { ...state.player2 };
  const opp = player === 'p1' ? { ...state.player2 } : { ...state.player1 };
  if (cardIndex < 0 || cardIndex >= ps.hand.length) return state;
  if (ps.deployed.length >= state.cardsDeployedPerTurn) return state;

  const card = ps.hand[cardIndex];
  const deployed: DeployedCard = {
    ...card,
    faceDown: true,
    currentPower: card.power,
    appliedBuffs: 0,
    appliedDebuffs: 0,
  };

  ps.hand = ps.hand.filter((_, i) => i !== cardIndex);
  ps.deployed = [...ps.deployed, deployed];

  const log = [...state.log];
  const playerLabel = player === 'p1' ? 'Player' : 'Opponent';

  if (card.trait === 'Restoration') {
    ps.healingAmount += card.traitValue || 2;
  }

  if (card.trait === 'Quick Strike') {
    const qsDamage = card.traitValue || card.power;
    opp.hp = Math.max(0, opp.hp - qsDamage);
    ps.quickStrikeDamage += qsDamage;
    log.push(`${playerLabel} Quick Strike: ${card.name} deals ${qsDamage} immediate damage!`);
  }

  if (card.trait === 'Care Package') {
    const extra = Math.min(card.traitValue || 1, ps.deck.length);
    if (extra > 0) {
      const bonus = ps.deck.slice(0, extra);
      ps.hand = [...ps.hand, ...bonus];
      ps.deck = ps.deck.slice(extra);
      log.push(`${playerLabel} Care Package: ${card.name} draws ${extra} extra card${extra > 1 ? 's' : ''}!`);
    }
  }

  const newState = { ...state, log };
  if (player === 'p1') {
    newState.player1 = ps;
    newState.player2 = opp;
  } else {
    newState.player2 = ps;
    newState.player1 = opp;
  }
  return newState;
}

export function undeployCard(state: GameState, player: 'p1' | 'p2', deployIndex: number): GameState {
  const ps = player === 'p1' ? { ...state.player1 } : { ...state.player2 };
  const opp = player === 'p1' ? { ...state.player2 } : { ...state.player1 };
  if (deployIndex < 0 || deployIndex >= ps.deployed.length) return state;

  const card = ps.deployed[deployIndex];
  ps.hand = [...ps.hand, card as Card];
  ps.deployed = ps.deployed.filter((_, i) => i !== deployIndex);

  if (card.trait === 'Restoration') {
    ps.healingAmount = Math.max(0, ps.healingAmount - (card.traitValue || 2));
  }

  if (card.trait === 'Quick Strike') {
    const qsDamage = card.traitValue || card.power;
    opp.hp = Math.min(GAME_CONSTANTS.initialHP, opp.hp + qsDamage);
    ps.quickStrikeDamage = Math.max(0, ps.quickStrikeDamage - qsDamage);
  }

  const newState = { ...state };
  if (player === 'p1') {
    newState.player1 = ps;
    newState.player2 = opp;
  } else {
    newState.player2 = ps;
    newState.player1 = opp;
  }
  return newState;
}

function colorMatchesElement(color: string, element: string): boolean {
  const c = color.toLowerCase();
  const e = element.toLowerCase();
  if (c === 'black') return true;
  if (c === 'red' && e === 'fire') return true;
  if (c === 'blue' && e === 'water') return true;
  if (c === 'amber' && e === 'earth') return true;
  if (c === 'green' && (e === 'air' || e === 'nature')) return true;
  return false;
}

function applyBuffsDebuffs(attacker: PlayerState, defender: PlayerState): { attacker: PlayerState; defender: PlayerState } {
  const a = { ...attacker, deployed: attacker.deployed.map(c => ({ ...c })) };
  const d = { ...defender, deployed: defender.deployed.map(c => ({ ...c })) };

  for (const card of a.deployed) {
    if (card.buffModifier > 0 && card.buffColor) {
      for (const ally of a.deployed) {
        if (ally.id === card.id) continue;
        if (colorMatchesElement(card.buffColor, ally.element)) {
          ally.currentPower += card.buffModifier;
          ally.appliedBuffs += card.buffModifier;
        }
      }
    }
    if (card.debuffModifier > 0 && card.debuffColor) {
      for (const enemy of d.deployed) {
        if (colorMatchesElement(card.debuffColor, enemy.element)) {
          enemy.currentPower = Math.max(1, enemy.currentPower - card.debuffModifier);
          enemy.appliedDebuffs += card.debuffModifier;
        }
      }
    }
  }

  return { attacker: a, defender: d };
}

export function resolveCombat(state: GameState): GameState {
  let p1 = { ...state.player1, deployed: state.player1.deployed.map(c => ({ ...c, faceDown: false })), abilityBuffs: [...state.player1.abilityBuffs] };
  let p2 = { ...state.player2, deployed: state.player2.deployed.map(c => ({ ...c, faceDown: false })), abilityBuffs: [...state.player2.abilityBuffs] };

  const { attacker: p1Buffed, defender: p2Debuffed } = applyBuffsDebuffs(p1, p2);
  const { attacker: p2Buffed, defender: p1Debuffed } = applyBuffsDebuffs(p2Debuffed, p1Buffed);
  p1 = p1Debuffed;
  p2 = p2Buffed;

  let p1AbilityFS = 0;
  let p2AbilityFS = 0;
  for (const b of p1.abilityBuffs) {
    if (b.type === 'first_strike') p1AbilityFS += b.amount;
  }
  for (const b of p2.abilityBuffs) {
    if (b.type === 'first_strike') p2AbilityFS += b.amount;
  }
  if (p1AbilityFS > 0) {
    p2.hp = Math.max(0, p2.hp - p1AbilityFS);
    p1.quickStrikeDamage += p1AbilityFS;
  }
  if (p2AbilityFS > 0) {
    p1.hp = Math.max(0, p1.hp - p2AbilityFS);
    p2.quickStrikeDamage += p2AbilityFS;
  }

  let p1AbilityShield = 0;
  let p2AbilityShield = 0;
  for (const b of p1.abilityBuffs) {
    if (b.type === 'shield') p1AbilityShield += b.amount;
  }
  for (const b of p2.abilityBuffs) {
    if (b.type === 'shield') p2AbilityShield += b.amount;
  }

  let p1AbilityHeal = 0;
  let p2AbilityHeal = 0;
  for (const b of p1.abilityBuffs) {
    if (b.type === 'heal') p1AbilityHeal += b.amount;
  }
  for (const b of p2.abilityBuffs) {
    if (b.type === 'heal') p2AbilityHeal += b.amount;
  }

  const p1QS = p1.quickStrikeDamage;
  const p2QS = p2.quickStrikeDamage;

  const p1Power = p1.deployed.reduce((sum, c) => sum + c.currentPower, 0);
  const p2Power = p2.deployed.reduce((sum, c) => sum + c.currentPower, 0);
  p1.roundPower = p1Power;
  p2.roundPower = p2Power;

  let p1Guard = 0;
  let p2Guard = 0;
  for (const c of p1.deployed) {
    if (c.trait === 'Guardian') {
      p1Guard += c.traitValue || 3;
    }
  }
  for (const c of p2.deployed) {
    if (c.trait === 'Guardian') {
      p2Guard += c.traitValue || 3;
    }
  }
  p1Guard += p1AbilityShield;
  p2Guard += p2AbilityShield;
  p1.guardianBlock = p1Guard;
  p2.guardianBlock = p2Guard;

  p1.healingAmount += p1AbilityHeal;
  p2.healingAmount += p2AbilityHeal;

  if (p1.healingAmount > 0) {
    p1.hp = Math.min(GAME_CONSTANTS.initialHP, p1.hp + p1.healingAmount);
  }
  if (p2.healingAmount > 0) {
    p2.hp = Math.min(GAME_CONSTANTS.initialHP, p2.hp + p2.healingAmount);
  }

  let winner: 'p1' | 'p2' | 'draw' = 'draw';
  let damage = 0;

  if (p1Power > p2Power) {
    winner = 'p1';
    damage = Math.max(0, (p1Power - p2Power) - p2Guard);
    p2.hp -= damage;
    p1.victoryCurrency++;
    p2.withdrawalCurrency++;
  } else if (p2Power > p1Power) {
    winner = 'p2';
    damage = Math.max(0, (p2Power - p1Power) - p1Guard);
    p1.hp -= damage;
    p2.victoryCurrency++;
    p1.withdrawalCurrency++;
  }

  const roundAbilityEffects = [...state.abilityLog];

  const roundResult: RoundResult = {
    round: state.round,
    p1Power,
    p2Power,
    winner,
    damage,
    p1HP: Math.max(0, p1.hp),
    p2HP: Math.max(0, p2.hp),
    p1Cards: [...p1.deployed],
    p2Cards: [...p2.deployed],
    p1QS,
    p2QS,
    p1Guardian: p1Guard,
    p2Guardian: p2Guard,
    p1Healing: p1.healingAmount,
    p2Healing: p2.healingAmount,
    abilityEffects: roundAbilityEffects.length > 0 ? roundAbilityEffects : undefined,
  };

  p1.hp = Math.max(0, p1.hp);
  p2.hp = Math.max(0, p2.hp);

  const log = [...state.log];
  log.push(`--- Round ${state.round} Combat ---`);
  if (p1QS > 0) log.push(`Player Quick Strike: ${p1QS} damage`);
  if (p2QS > 0) log.push(`Opponent Quick Strike: ${p2QS} damage`);
  log.push(`Player Power: ${p1Power} | Opponent Power: ${p2Power}`);
  if (winner === 'p1') {
    log.push(`Player wins the round! ${damage} damage to opponent${p2Guard > 0 ? ` (${p2Guard} blocked)` : ''}`);
  } else if (winner === 'p2') {
    log.push(`Opponent wins the round! ${damage} damage to player${p1Guard > 0 ? ` (${p1Guard} blocked)` : ''}`);
  } else {
    log.push(`Round is a draw!`);
  }
  if (p1.healingAmount > 0) log.push(`Player healed ${p1.healingAmount} HP`);
  if (p2.healingAmount > 0) log.push(`Opponent healed ${p2.healingAmount} HP`);
  log.push(`HP: Player ${p1.hp} | Opponent ${p2.hp}`);

  let gameOver = p1.hp <= 0 || p2.hp <= 0;
  const bothEmpty = p1.hand.length === 0 && p1.deck.length === 0 && p2.hand.length === 0 && p2.deck.length === 0;
  if (bothEmpty) gameOver = true;

  let gameWinner: 'p1' | 'p2' | null = null;
  if (gameOver) {
    if (p1.hp > p2.hp) gameWinner = 'p1';
    else if (p2.hp > p1.hp) gameWinner = 'p2';
    else gameWinner = p1Power >= p2Power ? 'p1' : 'p2';
    log.push(gameWinner === 'p1' ? 'Player wins the game!' : 'Opponent wins the game!');
  }

  p1.healingAmount = 0;
  p2.healingAmount = 0;
  p1.quickStrikeDamage = 0;
  p2.quickStrikeDamage = 0;
  p1.guardianBlock = 0;
  p2.guardianBlock = 0;
  p1.roundPower = 0;
  p2.roundPower = 0;

  return {
    ...state,
    phase: gameOver ? 'game_over' : 'round_end',
    player1: p1,
    player2: p2,
    roundResults: [...state.roundResults, roundResult],
    winner: gameWinner,
    log,
    abilityLog: [],
  };
}

export function nextRound(state: GameState): GameState {
  return {
    ...state,
    phase: 'card_draw',
    round: state.round + 1,
    turnActions: { p1Deployed: false, p2Deployed: false },
    player1: {
      ...state.player1,
      deployed: [],
      quickStrikeDamage: 0,
      guardianBlock: 0,
      healingAmount: 0,
      usedAbilities: [],
      abilityBuffs: [],
    },
    player2: {
      ...state.player2,
      deployed: [],
      quickStrikeDamage: 0,
      guardianBlock: 0,
      healingAmount: 0,
      usedAbilities: [],
      abilityBuffs: [],
    },
    log: [...state.log, `\nRound ${state.round + 1} begins!`],
    abilityLog: [],
  };
}

export function useCommanderAbility(
  state: GameState,
  player: 'p1' | 'p2',
  abilityId: string
): GameState {
  const ps = player === 'p1' ? { ...state.player1, abilityBuffs: [...state.player1.abilityBuffs] } : { ...state.player2, abilityBuffs: [...state.player2.abilityBuffs] };
  const opp = player === 'p1' ? { ...state.player2 } : { ...state.player1 };
  const ability = ps.commander.abilities.find(a => a.id === abilityId);
  if (!ability) return state;
  if (ps.usedAbilities.includes(abilityId)) return state;

  if (ability.victoryCost > 0 && ps.victoryCurrency < ability.victoryCost) return state;
  if (ability.withdrawalCost > 0 && ps.withdrawalCurrency < ability.withdrawalCost) return state;

  ps.victoryCurrency -= ability.victoryCost;
  ps.withdrawalCurrency -= ability.withdrawalCost;
  ps.usedAbilities = [...ps.usedAbilities, abilityId];

  const { type, value, target } = ability.effect;
  const cmdElement = ps.commander.element.toLowerCase();
  const playerLabel = player === 'p1' ? 'Player' : 'Opponent';
  const log = [...state.log];
  const abilityLog = [...state.abilityLog];
  let effectDesc = '';
  log.push(`${playerLabel} used ${ability.name}!`);

  switch (type) {
    case 'direct_damage': {
      opp.hp = Math.max(0, opp.hp - value);
      effectDesc = `Deals ${value} direct damage`;
      log.push(`Deals ${value} direct damage!`);
      break;
    }
    case 'element_power_damage': {
      const totalPower = ps.deployed
        .filter(c => c.element.toLowerCase() === cmdElement)
        .reduce((sum, c) => sum + c.currentPower, 0);
      opp.hp = Math.max(0, opp.hp - totalPower);
      effectDesc = `Deals ${totalPower} damage from ${cmdElement} unit power`;
      log.push(`Deals ${totalPower} damage from ${cmdElement} unit power!`);
      break;
    }
    case 'buff_element_unit': {
      const targets = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      if (targets.length > 0) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        t.currentPower += value;
        t.appliedBuffs += value;
        effectDesc = `Buffed ${t.name} +${value} power`;
        log.push(`${t.name} gains +${value} power!`);
        ps.abilityBuffs.push({ type: 'buff', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      }
      break;
    }
    case 'extra_deploy': {
      effectDesc = `Extra ${cmdElement} deployment`;
      log.push(`Can deploy an extra ${cmdElement} unit this turn!`);
      break;
    }
    case 'cycle_element_cards': {
      const eleCards = ps.hand.filter(c => c.element.toLowerCase() === cmdElement);
      const count = eleCards.length;
      if (count > 0) {
        ps.hand = ps.hand.filter(c => c.element.toLowerCase() !== cmdElement);
        ps.deck = shuffleDeck([...ps.deck, ...eleCards]);
        const drawCount = Math.min(count, ps.deck.length);
        const drawn = ps.deck.slice(0, drawCount);
        ps.hand = [...ps.hand, ...drawn];
        ps.deck = ps.deck.slice(drawCount);
        effectDesc = `Cycled ${count} ${cmdElement} cards`;
        log.push(`Cycled ${count} ${cmdElement} cards, drew ${drawCount} new cards!`);
      }
      break;
    }
    case 'block_effects': {
      const enemies = opp.deployed.filter(c => c.element.toLowerCase() !== cmdElement);
      if (enemies.length > 0) {
        const t = enemies[Math.floor(Math.random() * enemies.length)];
        t.currentPower = Math.max(1, t.power);
        t.appliedBuffs = 0;
        t.appliedDebuffs = 0;
        effectDesc = `Blocked effects on ${t.name}`;
        log.push(`Blocked effects on ${t.name}!`);
      }
      break;
    }
    case 'negate_and_halve': {
      for (const c of opp.deployed) {
        c.appliedBuffs = 0;
        c.appliedDebuffs = 0;
        if (c.element.toLowerCase() !== cmdElement) {
          c.currentPower = Math.max(1, Math.floor(c.currentPower / 2));
        } else {
          c.currentPower = c.power;
        }
      }
      effectDesc = `Negated effects and halved non-${cmdElement} power`;
      log.push(`Negated all enemy effects and halved non-${cmdElement} power!`);
      break;
    }
    case 'healing_factor': {
      const targets2 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      if (targets2.length > 0) {
        for (const t of targets2) {
          t.currentPower += value;
          t.appliedBuffs += value;
        }
        effectDesc = `+${value} heal on ${cmdElement} units`;
        log.push(`Added +${value} healing factor to ${cmdElement} units!`);
        ps.abilityBuffs.push({ type: 'heal', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      }
      break;
    }
    case 'prevent_ward': {
      effectDesc = `Protected ${cmdElement} unit from medical ward`;
      log.push(`An ${cmdElement} unit is protected from the medical ward!`);
      break;
    }
    case 'destroy_unit': {
      const enemies2 = opp.deployed.filter(c => c.element.toLowerCase() !== cmdElement);
      if (enemies2.length > 0) {
        const t = enemies2[Math.floor(Math.random() * enemies2.length)];
        opp.deployed = opp.deployed.filter(c => c.id !== t.id);
        effectDesc = `Sent ${t.name} to the medical ward`;
        log.push(`Sent ${t.name} to the medical ward!`);
      }
      break;
    }
    case 'add_shield': {
      const targets3 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      if (targets3.length > 0) {
        for (const t of targets3) {
          t.currentPower += value;
          t.appliedBuffs += value;
        }
        effectDesc = `+${value} shield on ${cmdElement} units`;
        log.push(`Added +${value} shield to ${cmdElement} units!`);
        ps.abilityBuffs.push({ type: 'shield', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      }
      break;
    }
    case 'reduce_power': {
      const enemies3 = opp.deployed.filter(c => c.element.toLowerCase() !== cmdElement);
      if (enemies3.length > 0) {
        const t = enemies3[Math.floor(Math.random() * enemies3.length)];
        t.currentPower = Math.max(1, t.currentPower - value);
        t.appliedDebuffs += value;
        effectDesc = `Reduced ${t.name} power by ${value}`;
        log.push(`Reduced ${t.name} power by ${value}!`);
        ps.abilityBuffs.push({ type: 'reduce', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      }
      break;
    }
    case 'first_strike': {
      const fsAmount = value || 3;
      const matchingUnits = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      if (matchingUnits.length > 0) {
        for (const t of matchingUnits) {
          t.currentPower += fsAmount;
          t.appliedBuffs += fsAmount;
        }
        effectDesc = `+${fsAmount} first strike on ${cmdElement} units`;
        log.push(`First Strike! ${cmdElement} units gain +${fsAmount} power with pre-combat damage!`);
        ps.abilityBuffs.push({ type: 'first_strike', amount: fsAmount, element: cmdElement, abilityName: ability.name, playerSide: player });
      }
      break;
    }
    case 'set_power': {
      const enemies4 = opp.deployed.filter(c => c.element.toLowerCase() !== cmdElement);
      if (enemies4.length > 0) {
        const t = enemies4[Math.floor(Math.random() * enemies4.length)];
        const reduction = t.currentPower - value;
        t.currentPower = Math.max(1, value);
        if (reduction > 0) t.appliedDebuffs += reduction;
        effectDesc = `Set ${t.name} power to ${value}`;
        log.push(`Set ${t.name} power to ${value}!`);
      }
      break;
    }
    case 'restore_from_ward': {
      effectDesc = `Restored units from medical ward`;
      log.push(`Restored units from medical ward to deck!`);
      break;
    }
    case 'heal_and_buff': {
      ps.hp = Math.min(GAME_CONSTANTS.initialHP, ps.hp + value);
      const targets4 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      if (targets4.length > 0) {
        const t = targets4[Math.floor(Math.random() * targets4.length)];
        t.currentPower += 2;
        t.appliedBuffs += 2;
        effectDesc = `Healed ${value} HP and buffed ${t.name} +2`;
        log.push(`Healed ${value} HP and buffed ${t.name} +2 power!`);
        ps.abilityBuffs.push({ type: 'heal_buff', amount: 2, element: cmdElement, abilityName: ability.name, playerSide: player });
      } else {
        effectDesc = `Healed ${value} HP`;
        log.push(`Healed ${value} HP!`);
      }
      break;
    }
    case 'damage': {
      opp.hp = Math.max(0, opp.hp - value);
      effectDesc = `Deals ${value} damage`;
      break;
    }
    case 'heal': {
      ps.hp = Math.min(GAME_CONSTANTS.initialHP, ps.hp + value);
      effectDesc = `Healed ${value} HP`;
      break;
    }
    case 'draw': {
      const toDraw = Math.min(value, ps.deck.length);
      ps.hand = [...ps.hand, ...ps.deck.slice(0, toDraw)];
      ps.deck = ps.deck.slice(toDraw);
      effectDesc = `Drew ${toDraw} cards`;
      break;
    }
    case 'buff': {
      for (const c of ps.deployed) {
        c.currentPower += value;
      }
      effectDesc = `Buffed all units +${value}`;
      ps.abilityBuffs.push({ type: 'buff', amount: value, abilityName: ability.name, playerSide: player });
      break;
    }
    case 'debuff': {
      for (const c of opp.deployed) {
        c.currentPower = Math.max(1, c.currentPower - value);
      }
      effectDesc = `Debuffed all enemy units -${value}`;
      ps.abilityBuffs.push({ type: 'debuff', amount: value, abilityName: ability.name, playerSide: player });
      break;
    }
    case 'growth_buff': {
      const targets5 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      for (const t of targets5) {
        t.currentPower += value;
        t.appliedBuffs += value;
      }
      effectDesc = `Growth +${value} on ${cmdElement} units`;
      log.push(`Growth! ${cmdElement} units gain +${value} power!`);
      ps.abilityBuffs.push({ type: 'growth', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      break;
    }
    case 'debuff_enemy': {
      for (const c of opp.deployed) {
        c.currentPower = Math.max(1, c.currentPower - value);
        c.appliedDebuffs += value;
      }
      effectDesc = `Debuffed all enemy units -${value}`;
      log.push(`Debuffed all enemy units by ${value}!`);
      ps.abilityBuffs.push({ type: 'debuff', amount: value, abilityName: ability.name, playerSide: player });
      break;
    }
    case 'protect_element': {
      const targets6 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      for (const t of targets6) {
        t.currentPower += value;
        t.appliedBuffs += value;
      }
      effectDesc = `Protected ${cmdElement} units +${value}`;
      log.push(`Protected ${cmdElement} units with +${value} power!`);
      ps.abilityBuffs.push({ type: 'shield', amount: value, element: cmdElement, abilityName: ability.name, playerSide: player });
      break;
    }
    case 'add_evasion': {
      const targets7 = ps.deployed.filter(c => c.element.toLowerCase() === cmdElement);
      for (const t of targets7) {
        t.currentPower += value;
        t.appliedBuffs += value;
      }
      effectDesc = `+${value} evasion on ${cmdElement} units`;
      log.push(`Added +${value} evasion to ${cmdElement} units!`);
      break;
    }
  }

  if (effectDesc) {
    abilityLog.push({
      playerSide: player === 'p1' ? 'player1' : 'player2',
      abilityName: ability.name,
      effectDescription: `Activated: ${effectDesc}`,
      phase: ability.phase || 'combat',
    });
  }

  const newState = { ...state, log, abilityLog };
  if (player === 'p1') {
    newState.player1 = ps;
    newState.player2 = opp;
  } else {
    newState.player2 = ps;
    newState.player1 = opp;
  }
  return newState;
}
