import { Card } from './api';
import { GameState, deployCard, drawCards, useCommanderAbility } from './game-engine';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

function scoreCard(card: Card, difficulty: AIDifficulty): number {
  let score = card.power;
  if (card.trait === 'Quick Strike') score += 3;
  if (card.trait === 'Guardian') score += 2;
  if (card.trait === 'Restoration') score += 1.5;
  if (card.trait === 'Care Package') score += 1;
  if (card.buffModifier > 0) score += card.buffModifier * 1.5;
  if (card.debuffModifier > 0) score += card.debuffModifier * 1.2;

  if (difficulty === 'easy') {
    score += (Math.random() - 0.5) * 8;
  } else if (difficulty === 'medium') {
    score += (Math.random() - 0.5) * 3;
  }
  return score;
}

export function aiDraw(state: GameState): GameState {
  return drawCards(state, 'p2');
}

export function aiDeploy(state: GameState, difficulty: AIDifficulty): GameState {
  let current = { ...state };
  const ps = current.player2;
  if (ps.hand.length === 0) return current;

  const scored = ps.hand
    .map((card, index) => ({ card, index, score: scoreCard(card, difficulty) }))
    .sort((a, b) => b.score - a.score);

  const count = Math.min(current.cardsDeployedPerTurn, scored.length);
  const toPlay = scored.slice(0, count);
  toPlay.sort((a, b) => b.index - a.index);

  for (const { index } of toPlay) {
    const adjusted = current.player2.hand.findIndex(c => c.id === scored.find(s => s.index === index)?.card.id);
    if (adjusted >= 0) {
      current = deployCard(current, 'p2', adjusted);
    }
  }

  return current;
}

export function aiUseAbilities(state: GameState, difficulty: AIDifficulty): GameState {
  if (difficulty === 'easy') return state;
  let current = { ...state };
  const ps = current.player2;

  for (const ability of ps.commander.abilities) {
    if (ps.usedAbilities.includes(ability.id)) continue;
    const canAfford =
      (ability.victoryCost === 0 || ps.victoryCurrency >= ability.victoryCost) &&
      (ability.withdrawalCost === 0 || ps.withdrawalCurrency >= ability.withdrawalCost);

    if (!canAfford) continue;

    if (difficulty === 'medium' && Math.random() < 0.4) continue;

    if (ability.effect.type === 'heal' && ps.hp >= 30) continue;
    if (ability.effect.type === 'damage' && current.player1.hp <= 0) continue;

    current = useCommanderAbility(current, 'p2', ability.id);
  }

  return current;
}

export function aiTurn(state: GameState, difficulty: AIDifficulty): GameState {
  let current = aiDraw(state);
  current = aiDeploy(current, difficulty);
  current = aiUseAbilities(current, difficulty);
  return current;
}
