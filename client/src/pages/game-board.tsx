import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Heart, Swords, Trophy, Flag, ArrowRight, Shield, Flame, Droplet, Mountain, Wind, Leaf, RotateCcw, LogIn, MessageSquare, Eye, Send, X, Zap, Sparkles, Plus, Scroll, History, Crown } from "lucide-react";
import type { Game, Card as CardType, Element, BattlefieldCard, GameMode, Commander, CommanderAbility } from "@shared/schema";
import { GAME_CONSTANTS, GAME_MODE_CONFIG } from "@shared/schema";
import { getCardIdFromInstance } from "@/lib/card-utils";

import fireCardArt from "@assets/generated_images/fire_element_card_art.png";
import waterCardArt from "@assets/generated_images/water_element_card_art.png";
import earthCardArt from "@assets/generated_images/earth_element_card_art.png";
import airCardArt from "@assets/generated_images/air_element_card_art.png";
import natureCardArt from "@assets/generated_images/nature_element_card_art.png";

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string; cardArt: string; solidBorder: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-gradient-to-br from-red-600 to-orange-600", cardArt: fireCardArt, solidBorder: "border-red-500" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600", cardArt: waterCardArt, solidBorder: "border-blue-500" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-gradient-to-br from-amber-700 to-yellow-600", cardArt: earthCardArt, solidBorder: "border-orange-500" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-gradient-to-br from-green-400 to-teal-400", cardArt: airCardArt, solidBorder: "border-cyan-400" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-gradient-to-br from-green-700 to-emerald-600", cardArt: natureCardArt, solidBorder: "border-green-500" },
};

const colorToElement: Record<string, Element> = {
  Red: "Fire",
  Blue: "Water",
  Amber: "Earth",
  Green: "Nature",
  Black: "Air",
};

const elementToColor: Record<Element, string> = {
  Fire: "Red",
  Water: "Blue",
  Earth: "Amber",
  Nature: "Green",
  Air: "Black",
};

const traitIconsMap: Record<string, typeof Zap> = {
  "Quick Strike": Zap,
  "Care Package": Plus,
  "Restoration": Heart,
  "Guardian": Shield,
};

const buffDebuffColorMap: Record<string, { bg: string; text: string; border: string }> = {
  Red: { bg: "bg-red-500/90", text: "text-white", border: "border-red-300/50" },
  Blue: { bg: "bg-blue-500/90", text: "text-white", border: "border-blue-300/50" },
  Amber: { bg: "bg-amber-500/90", text: "text-white", border: "border-amber-300/50" },
  Green: { bg: "bg-green-500/90", text: "text-white", border: "border-green-300/50" },
  Black: { bg: "bg-slate-800/90", text: "text-white", border: "border-slate-500/50" },
};

interface CardPowerBreakdown {
  card: CardType;
  basePower: number;
  buffBonuses: { fromCard: CardType; amount: number }[];
  debuffPenalties: { fromCard: CardType; amount: number }[];
  traitInfo: { trait: string; value: number } | null;
  finalPower: number;
}

interface CombatLogEntry {
  step: number;
  phase: "quick_strike" | "power_calculation" | "damage_resolution" | "guardian_block" | "healing" | "card_draw";
  description: string;
  icon: string;
  actor: "player1" | "player2" | "both" | "system";
  cardName?: string;
  traitName?: string;
  value?: number;
  targetAffected?: "player1_hp" | "player2_hp" | "player1_damage" | "player2_damage" | "cards";
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
  log: CombatLogEntry[];
  abilityEffects?: Array<{ playerSide: string; abilityName: string; effectDescription: string; phase: string }>;
}

interface AbilityBuff {
  targetElement: string;
  amount: number;
  type: string;
}

function mapBattlefieldToCards(
  battlefield: BattlefieldCard[],
  getCardById: (id: string) => CardType | undefined
): CardType[] {
  return battlefield.map(bf => {
    const card = getCardById(bf.cardId);
    if (!card) return null;
    if (bf.modifiedPower !== undefined && bf.modifiedPower !== null) {
      return { ...card, power: bf.modifiedPower };
    }
    return card;
  }).filter(Boolean) as CardType[];
}

function calculateBattlePower(
  friendlyCards: CardType[],
  enemyCards: CardType[],
  getCardById: (id: string) => CardType | undefined,
  friendlyAbilityBuffs?: AbilityBuff[],
  enemyBlockedEffects?: boolean,
  enemyNegateAndHalve?: boolean,
  friendlyProtectedElement?: string,
): CardPowerBreakdown[] {
  return friendlyCards.map(card => {
    const basePower = card.power;
    const buffBonuses: { fromCard: CardType; amount: number }[] = [];
    const debuffPenalties: { fromCard: CardType; amount: number }[] = [];
    
    // If enemy used negate_and_halve, halve non-matching element cards
    let halvedPower = basePower;
    if (enemyNegateAndHalve) {
      halvedPower = Math.floor(basePower / 2);
    }
    
    // Buffs from OTHER friendly cards that match this card's element
    // Skip if enemy blocked our effects
    if (!enemyBlockedEffects) {
      friendlyCards.forEach(friendlyCard => {
        if (friendlyCard.id !== card.id && friendlyCard.buffModifier > 0 && friendlyCard.buffColor) {
          const buffElement = colorToElement[friendlyCard.buffColor];
          if (buffElement === card.element) {
            buffBonuses.push({ fromCard: friendlyCard, amount: friendlyCard.buffModifier });
          }
        }
      });
    }
    
    // Commander ability buffs (buff, heal, growth types)
    if (friendlyAbilityBuffs) {
      friendlyAbilityBuffs.forEach(ab => {
        if (ab.amount > 0 && (ab.targetElement === "all" || ab.targetElement === card.element.toLowerCase())) {
          buffBonuses.push({ fromCard: card, amount: ab.amount });
        }
      });
    }
    
    const isProtected = friendlyProtectedElement && card.element.toLowerCase() === friendlyProtectedElement.toLowerCase();
    
    // Debuffs from enemy cards that target this card's element
    // Skip if enemy used negate_and_halve (enemy effects are negated) or card is protected
    if (!enemyNegateAndHalve && !isProtected) {
      enemyCards.forEach(enemyCard => {
        if (enemyCard.debuffModifier > 0 && enemyCard.debuffColor) {
          const debuffElement = colorToElement[enemyCard.debuffColor];
          if (debuffElement === card.element) {
            debuffPenalties.push({ fromCard: enemyCard, amount: enemyCard.debuffModifier });
          }
        }
      });
    }
    
    // Commander ability debuffs applied to this card by opponent (skip if protected)
    if (friendlyAbilityBuffs && !isProtected) {
      friendlyAbilityBuffs.forEach(ab => {
        if (ab.amount < 0 && (ab.targetElement === "all" || ab.targetElement === card.element.toLowerCase())) {
          debuffPenalties.push({ fromCard: card, amount: Math.abs(ab.amount) });
        }
      });
    }
    
    const totalBuffs = buffBonuses.reduce((sum, b) => sum + b.amount, 0);
    const totalDebuffs = debuffPenalties.reduce((sum, d) => sum + d.amount, 0);
    const effectiveBase = enemyNegateAndHalve ? halvedPower : basePower;
    const finalPower = Math.max(0, effectiveBase + totalBuffs - totalDebuffs);
    
    const traitInfo = card.trait && card.traitValue !== null 
      ? { trait: card.trait, value: card.traitValue }
      : null;
    
    return {
      card,
      basePower: effectiveBase,
      buffBonuses,
      debuffPenalties,
      traitInfo,
      finalPower,
    };
  });
}

function generateCombatLog(
  player1Breakdown: CardPowerBreakdown[],
  player2Breakdown: CardPowerBreakdown[],
  player1Total: number,
  player2Total: number,
  p1AbilityBuffs: AbilityBuff[] = [],
  p2AbilityBuffs: AbilityBuff[] = [],
  abilityLog: any[] = [],
  currentTurn: number = 0,
): CombatSummary {
  const log: CombatLogEntry[] = [];
  let step = 1;
  
  let player1QuickStrikeDamage = 0;
  let player2QuickStrikeDamage = 0;
  let player1GuardianBlocked = 0;
  let player2GuardianBlocked = 0;
  let player1Healing = 0;
  let player2Healing = 0;
  let player1CardsDrawn = 0;
  let player2CardsDrawn = 0;

  const player1QuickStrikers = player1Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike");
  const player2QuickStrikers = player2Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike");
  
  if (player1QuickStrikers.length > 0 || player2QuickStrikers.length > 0) {
    log.push({
      step: step++,
      phase: "quick_strike",
      description: "Quick Strike Phase - Direct HP damage (bypasses combat calculation)!",
      icon: "zap",
      actor: "system"
    });
    
    player1QuickStrikers.forEach(b => {
      const damage = b.traitInfo!.value;
      player1QuickStrikeDamage += damage;
      log.push({
        step: step++,
        phase: "quick_strike",
        description: `[P1] ${b.card.name}'s Quick Strike (${damage}) bypasses combat - ${damage} direct HP damage to P2!`,
        icon: "zap",
        actor: "player1",
        cardName: b.card.name,
        traitName: "Quick Strike",
        value: damage,
        targetAffected: "player2_hp"
      });
    });
    
    player2QuickStrikers.forEach(b => {
      const damage = b.traitInfo!.value;
      player2QuickStrikeDamage += damage;
      log.push({
        step: step++,
        phase: "quick_strike",
        description: `[P2] ${b.card.name}'s Quick Strike (${damage}) bypasses combat - ${damage} direct HP damage to P1!`,
        icon: "zap",
        actor: "player2",
        cardName: b.card.name,
        traitName: "Quick Strike",
        value: damage,
        targetAffected: "player1_hp"
      });
    });
  }

  const p1FSBuffs = p1AbilityBuffs.filter(ab => ab.type === "first_strike");
  const p2FSBuffs = p2AbilityBuffs.filter(ab => ab.type === "first_strike");
  if (p1FSBuffs.length > 0 || p2FSBuffs.length > 0) {
    if (player1QuickStrikers.length === 0 && player2QuickStrikers.length === 0) {
      log.push({
        step: step++,
        phase: "quick_strike",
        description: "Commander Quick Strike - Direct HP damage from commander ability!",
        icon: "zap",
        actor: "system"
      });
    }
    p1FSBuffs.forEach(ab => {
      player1QuickStrikeDamage += ab.amount;
      log.push({
        step: step++,
        phase: "quick_strike",
        description: `[P1] Commander ability grants First Strike (${ab.amount}) - ${ab.amount} direct HP damage to P2!`,
        icon: "zap",
        actor: "player1",
        traitName: "First Strike (Ability)",
        value: ab.amount,
        targetAffected: "player2_hp"
      });
    });
    p2FSBuffs.forEach(ab => {
      player2QuickStrikeDamage += ab.amount;
      log.push({
        step: step++,
        phase: "quick_strike",
        description: `[P2] Commander ability grants First Strike (${ab.amount}) - ${ab.amount} direct HP damage to P1!`,
        icon: "zap",
        actor: "player2",
        traitName: "First Strike (Ability)",
        value: ab.amount,
        targetAffected: "player1_hp"
      });
    });
  }

  log.push({
    step: step++,
    phase: "power_calculation",
    description: "Power Calculation - Comparing total battlefield power...",
    icon: "calculator",
    actor: "system"
  });
  log.push({
    step: step++,
    phase: "power_calculation",
    description: `[P1] Total power: ${player1Total} (${player1Breakdown.map(b => `${b.card.name}: ${b.finalPower}`).join(" + ")})`,
    icon: "shield",
    actor: "player1",
    value: player1Total
  });

  log.push({
    step: step++,
    phase: "power_calculation",
    description: `[P2] Total power: ${player2Total} (${player2Breakdown.map(b => `${b.card.name}: ${b.finalPower}`).join(" + ")})`,
    icon: "swords",
    actor: "player2",
    value: player2Total
  });

  // Phase 3: Damage Resolution
  const baseDamage = Math.abs(player1Total - player2Total);
  const winner = player1Total > player2Total ? "player1" : player2Total > player1Total ? "player2" : "tie";
  
  // Base damage from power comparison
  let baseDamageToPlayer1 = 0;
  let baseDamageToPlayer2 = 0;
  
  if (winner === "player1") {
    baseDamageToPlayer2 = baseDamage;
    log.push({
      step: step++,
      phase: "damage_resolution",
      description: `P1 wins combat! P2 takes ${baseDamage} damage (${player1Total} - ${player2Total} = ${baseDamage})`,
      icon: "trophy",
      actor: "player1",
      value: baseDamage,
      targetAffected: "player2_hp"
    });
  } else if (winner === "player2") {
    baseDamageToPlayer1 = baseDamage;
    log.push({
      step: step++,
      phase: "damage_resolution",
      description: `P2 wins combat! P1 takes ${baseDamage} damage (${player2Total} - ${player1Total} = ${baseDamage})`,
      icon: "skull",
      actor: "player2",
      value: baseDamage,
      targetAffected: "player1_hp"
    });
  } else {
    log.push({
      step: step++,
      phase: "damage_resolution",
      description: "Tie! Both players gain +1 Advance and +1 Withdraw.",
      icon: "handshake",
      actor: "both"
    });
  }

  // Calculate total incoming damage before Guardian (includes Quick Strike)
  const totalIncomingToP1 = baseDamageToPlayer1 + player2QuickStrikeDamage;
  const totalIncomingToP2 = baseDamageToPlayer2 + player1QuickStrikeDamage;

  // Phase 4: Guardian blocks (reduces ALL incoming damage, including Quick Strike)
  const player1Guardians = player1Breakdown.filter(b => b.traitInfo?.trait === "Guardian");
  const player2Guardians = player2Breakdown.filter(b => b.traitInfo?.trait === "Guardian");
  
  if ((player1Guardians.length > 0 && totalIncomingToP1 > 0) || 
      (player2Guardians.length > 0 && totalIncomingToP2 > 0)) {
    log.push({
      step: step++,
      phase: "guardian_block",
      description: "Guardian Phase - Defensive traits block incoming damage!",
      icon: "shield",
      actor: "system"
    });
    
    if (player1Guardians.length > 0 && totalIncomingToP1 > 0) {
      player1Guardians.forEach(b => {
        const blockAmount = Math.min(b.traitInfo!.value, totalIncomingToP1 - player1GuardianBlocked);
        if (blockAmount > 0) {
          player1GuardianBlocked += blockAmount;
          log.push({
            step: step++,
            phase: "guardian_block",
            description: `[P1] ${b.card.name}'s Guardian blocks ${blockAmount} incoming damage!`,
            icon: "shield",
            actor: "player1",
            cardName: b.card.name,
            traitName: "Guardian",
            value: blockAmount,
            targetAffected: "player1_damage"
          });
        }
      });
    }
    
    if (player2Guardians.length > 0 && totalIncomingToP2 > 0) {
      player2Guardians.forEach(b => {
        const blockAmount = Math.min(b.traitInfo!.value, totalIncomingToP2 - player2GuardianBlocked);
        if (blockAmount > 0) {
          player2GuardianBlocked += blockAmount;
          log.push({
            step: step++,
            phase: "guardian_block",
            description: `[P2] ${b.card.name}'s Guardian blocks ${blockAmount} incoming damage!`,
            icon: "shield",
            actor: "player2",
            cardName: b.card.name,
            traitName: "Guardian",
            value: blockAmount,
            targetAffected: "player2_damage"
          });
        }
      });
    }
  }

  const p1ShieldBuffs = p1AbilityBuffs.filter(ab => ab.type === "shield");
  const p2ShieldBuffs = p2AbilityBuffs.filter(ab => ab.type === "shield");
  if ((p1ShieldBuffs.length > 0 && totalIncomingToP1 > 0) || (p2ShieldBuffs.length > 0 && totalIncomingToP2 > 0)) {
    if (player1Guardians.length === 0 && player2Guardians.length === 0) {
      log.push({
        step: step++,
        phase: "guardian_block",
        description: "Commander Shield - Blocking incoming damage from commander ability!",
        icon: "shield",
        actor: "system"
      });
    }
    p1ShieldBuffs.forEach(ab => {
      const blockAmount = Math.min(ab.amount, totalIncomingToP1 - player1GuardianBlocked);
      if (blockAmount > 0) {
        player1GuardianBlocked += blockAmount;
        log.push({
          step: step++,
          phase: "guardian_block",
          description: `[P1] Commander Shield blocks ${blockAmount} incoming damage!`,
          icon: "shield",
          actor: "player1",
          traitName: "Shield (Ability)",
          value: blockAmount,
          targetAffected: "player1_damage"
        });
      }
    });
    p2ShieldBuffs.forEach(ab => {
      const blockAmount = Math.min(ab.amount, totalIncomingToP2 - player2GuardianBlocked);
      if (blockAmount > 0) {
        player2GuardianBlocked += blockAmount;
        log.push({
          step: step++,
          phase: "guardian_block",
          description: `[P2] Commander Shield blocks ${blockAmount} incoming damage!`,
          icon: "shield",
          actor: "player2",
          traitName: "Shield (Ability)",
          value: blockAmount,
          targetAffected: "player2_damage"
        });
      }
    });
  }

  const player1Healers = player1Breakdown.filter(b => b.traitInfo?.trait === "Restoration");
  const player2Healers = player2Breakdown.filter(b => b.traitInfo?.trait === "Restoration");
  
  if (player1Healers.length > 0 || player2Healers.length > 0) {
    log.push({
      step: step++,
      phase: "healing",
      description: "Restoration Phase - Healing effects activate!",
      icon: "heart",
      actor: "system"
    });
    
    player1Healers.forEach(b => {
      const healAmount = b.traitInfo!.value;
      player1Healing += healAmount;
      log.push({
        step: step++,
        phase: "healing",
        description: `[P1] ${b.card.name}'s Restoration heals P1 for ${healAmount} HP!`,
        icon: "heart",
        actor: "player1",
        cardName: b.card.name,
        traitName: "Restoration",
        value: healAmount,
        targetAffected: "player1_hp"
      });
    });
    
    player2Healers.forEach(b => {
      const healAmount = b.traitInfo!.value;
      player2Healing += healAmount;
      log.push({
        step: step++,
        phase: "healing",
        description: `[P2] ${b.card.name}'s Restoration heals P2 for ${healAmount} HP!`,
        icon: "heart",
        actor: "player2",
        cardName: b.card.name,
        traitName: "Restoration",
        value: healAmount,
        targetAffected: "player2_hp"
      });
    });
  }

  const p1HealBuffs = p1AbilityBuffs.filter(ab => ab.type === "heal");
  const p2HealBuffs = p2AbilityBuffs.filter(ab => ab.type === "heal");
  if (p1HealBuffs.length > 0 || p2HealBuffs.length > 0) {
    if (player1Healers.length === 0 && player2Healers.length === 0) {
      log.push({
        step: step++,
        phase: "healing",
        description: "Commander Healing - Healing effects from commander ability!",
        icon: "heart",
        actor: "system"
      });
    }
    p1HealBuffs.forEach(ab => {
      player1Healing += ab.amount;
      log.push({
        step: step++,
        phase: "healing",
        description: `[P1] Commander ability heals P1 for ${ab.amount} HP!`,
        icon: "heart",
        actor: "player1",
        traitName: "Healing (Ability)",
        value: ab.amount,
        targetAffected: "player1_hp"
      });
    });
    p2HealBuffs.forEach(ab => {
      player2Healing += ab.amount;
      log.push({
        step: step++,
        phase: "healing",
        description: `[P2] Commander ability heals P2 for ${ab.amount} HP!`,
        icon: "heart",
        actor: "player2",
        traitName: "Healing (Ability)",
        value: ab.amount,
        targetAffected: "player2_hp"
      });
    });
  }

  const player1Drawers = player1Breakdown.filter(b => b.traitInfo?.trait === "Care Package");
  const player2Drawers = player2Breakdown.filter(b => b.traitInfo?.trait === "Care Package");
  
  if (player1Drawers.length > 0 || player2Drawers.length > 0) {
    log.push({
      step: step++,
      phase: "card_draw",
      description: "Care Package Phase - Bonus card draws!",
      icon: "plus",
      actor: "system"
    });
    
    player1Drawers.forEach(b => {
      const drawAmount = b.traitInfo!.value;
      player1CardsDrawn += drawAmount;
      log.push({
        step: step++,
        phase: "card_draw",
        description: `[P1] ${b.card.name}'s Care Package lets P1 draw ${drawAmount} extra card(s)!`,
        icon: "plus",
        actor: "player1",
        cardName: b.card.name,
        traitName: "Care Package",
        value: drawAmount,
        targetAffected: "cards"
      });
    });
    
    player2Drawers.forEach(b => {
      const drawAmount = b.traitInfo!.value;
      player2CardsDrawn += drawAmount;
      log.push({
        step: step++,
        phase: "card_draw",
        description: `[P2] ${b.card.name}'s Care Package lets P2 draw ${drawAmount} extra card(s)!`,
        icon: "plus",
        actor: "player2",
        cardName: b.card.name,
        traitName: "Care Package",
        value: drawAmount,
        targetAffected: "cards"
      });
    });
  }

  // Calculate final damage after all modifiers
  // Total incoming = base combat damage + Quick Strike damage - Guardian blocked
  const finalDamageToPlayer1 = Math.max(0, baseDamageToPlayer1 + player2QuickStrikeDamage - player1GuardianBlocked);
  const finalDamageToPlayer2 = Math.max(0, baseDamageToPlayer2 + player1QuickStrikeDamage - player2GuardianBlocked);

  const abilityEffects: Array<{ playerSide: string; abilityName: string; effectDescription: string; phase: string }> = [];
  const turnEntries = abilityLog.filter((entry: any) => entry.turn === currentTurn);
  for (const entry of turnEntries) {
    abilityEffects.push({
      playerSide: entry.playerId || "unknown",
      abilityName: entry.abilityName || entry.commanderName || "Unknown Ability",
      effectDescription: entry.effectDescription || entry.description || "",
      phase: entry.phase || "",
    });
  }

  return {
    player1QuickStrikeDamage,
    player2QuickStrikeDamage,
    player1GuardianBlocked,
    player2GuardianBlocked,
    player1Healing,
    player2Healing,
    player1CardsDrawn,
    player2CardsDrawn,
    baseDamageToPlayer1,
    baseDamageToPlayer2,
    finalDamageToPlayer1,
    finalDamageToPlayer2,
    log,
    abilityEffects,
  };
}

const phaseNames: Record<string, string> = {
  draw: "Draw Phase",
  deployment: "Deployment Phase",
  combat: "Combat Phase",
  calculation: "Calculation Phase",
  end: "End Phase",
};

function VictoryWithdrawalCounter({
  victories,
  withdrawals,
  isPlayer
}: {
  victories: number;
  withdrawals: number;
  isPlayer: boolean;
}) {
  return (
    <div className={`flex gap-1.5 px-1.5 py-1 rounded-md ${isPlayer ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`} data-testid={`${isPlayer ? 'player' : 'opponent'}-counters`}>
      <div className="flex items-center gap-0.5" title="Advances (Victories)">
        <Trophy className="w-3.5 h-3.5 text-green-400" />
        <span className="text-green-300 font-bold text-xs" data-testid={`${isPlayer ? 'player' : 'opponent'}-victories`}>
          {victories}
        </span>
      </div>
      <div className="flex items-center gap-0.5" title="Withdrawals (Defeats)">
        <Flag className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-blue-300 font-bold text-xs" data-testid={`${isPlayer ? 'player' : 'opponent'}-withdrawals`}>
          {withdrawals}
        </span>
      </div>
    </div>
  );
}

function AnimatedHPBar({ 
  current, 
  max, 
  isPlayer, 
  label,
  previousHP
}: { 
  current: number; 
  max: number; 
  isPlayer: boolean; 
  label: string;
  previousHP?: number;
}) {
  const percentage = Math.max(0, (current / max) * 100);
  const isLow = percentage <= 25;
  const isCritical = percentage <= 10;
  const tookDamage = previousHP !== undefined && current < previousHP;
  const [shaking, setShaking] = useState(false);
  
  useEffect(() => {
    if (tookDamage) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [current, tookDamage]);
  
  return (
    <div className={`relative rounded-lg overflow-hidden ${isPlayer ? 'bg-slate-800/80' : 'bg-slate-800/60'} border ${isPlayer ? 'border-green-500/30' : 'border-red-500/30'} px-2 py-1.5 min-w-[140px] hp-bar ${shaking ? 'animate-damage-shake' : ''}`}>
      <div className="absolute inset-0 opacity-20">
        <div 
          className={`h-full transition-all duration-500 ease-out ${
            isCritical ? 'bg-red-600 animate-pulse' : 
            isLow ? 'bg-orange-500' : 
            isPlayer ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Heart className={`w-4 h-4 ${isPlayer ? 'text-green-400' : 'text-red-400'} ${isCritical ? 'animate-pulse' : ''}`} />
          <span className="text-white/70 text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <span className={`text-lg font-bold transition-all hp-value ${isCritical ? 'text-red-400 animate-pulse' : shaking ? 'text-red-300 scale-110' : 'text-white'}`}>
            {current}
          </span>
          <span className="text-white/40 text-xs">/{max}</span>
        </div>
      </div>
    </div>
  );
}

function PhaseIndicator({ 
  currentPhase, 
  isMyTurn, 
  turn,
  combatHistoryCount,
  onViewCombatHistory,
}: { 
  currentPhase: string; 
  isMyTurn: boolean; 
  turn: number;
  combatHistoryCount?: number;
  onViewCombatHistory?: () => void;
}) {
  const phases = ['draw', 'deployment', 'combat', 'calculation', 'end'];
  const phaseIcons: Record<string, typeof ArrowRight> = {
    draw: ArrowRight,
    deployment: Shield,
    combat: Swords,
    calculation: Trophy,
    end: Flag,
  };
  const phaseColors: Record<string, string> = {
    draw: 'from-cyan-500 to-blue-500',
    deployment: 'from-purple-500 to-pink-500',
    combat: 'from-red-500 to-orange-500',
    calculation: 'from-yellow-500 to-amber-500',
    end: 'from-green-500 to-teal-500',
  };
  
  return (
    <div className="flex flex-col items-center gap-1 phase-indicator-zone">
      <div className="flex items-center gap-1.5 text-xs">
        {combatHistoryCount && combatHistoryCount > 0 && onViewCombatHistory && (
          <Button 
            size="sm"
            variant="outline" 
            onClick={onViewCombatHistory}
            className="border-cyan-500/50 text-cyan-300"
            data-testid="button-view-combat-history"
          >
            <History className="w-3 h-3 mr-1" />
            History ({combatHistoryCount})
          </Button>
        )}
        <Badge variant="outline" className="text-purple-300 border-purple-500/30">
          Turn {turn}
        </Badge>
        {isMyTurn && (
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse">
            <Sparkles className="w-3 h-3 mr-1" />
            Your Turn
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-full p-1 border border-purple-500/20">
        {phases.map((phase, i) => {
          const Icon = phaseIcons[phase];
          const isActive = phase === currentPhase;
          const isPast = phases.indexOf(currentPhase) > i;
          
          return (
            <div key={phase} className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 phase-dot ${
                  isActive 
                    ? `bg-gradient-to-r ${phaseColors[phase]} shadow-lg shadow-${phase === 'combat' ? 'red' : 'purple'}-500/30` 
                    : isPast 
                      ? 'bg-slate-600/50' 
                      : 'bg-slate-700/30'
                }`}
                title={phaseNames[phase]}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isPast ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
              {i < phases.length - 1 && (
                <div className={`w-2 h-0.5 ${isPast ? 'bg-slate-500' : 'bg-slate-700/50'}`} />
              )}
            </div>
          );
        })}
      </div>
      <span className={`text-xs font-medium bg-gradient-to-r ${phaseColors[currentPhase]} bg-clip-text text-transparent phase-name`}>
        {phaseNames[currentPhase]}
      </span>
    </div>
  );
}

function MiniCard({ 
  card, 
  faceDown = false, 
  selected = false, 
  playable = false,
  isOnBattlefield = false,
  isNewlyPlayed = false,
  onClick,
  onPreview 
}: { 
  card: CardType; 
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  isOnBattlefield?: boolean;
  isNewlyPlayed?: boolean;
  onClick?: () => void;
  onPreview?: () => void;
}) {
  const config = elementConfig[card.element];
  const Icon = config.icon;
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onPreview) {
      hoverTimerRef.current = setTimeout(() => {
        onPreview();
      }, 800);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    if (onPreview) {
      hoverTimerRef.current = setTimeout(() => {
        onPreview();
      }, 600);
    }
  };

  const handleTouchEnd = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleClick = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (onClick) {
      onClick();
    }
  };

  if (faceDown) {
    return (
      <div 
        className={`w-[4.5rem] h-[6.5rem] rounded-lg bg-gradient-to-br from-purple-800 to-purple-900 border-2 border-purple-500/50 flex items-center justify-center shadow-lg transition-all duration-300 minicard ${isOnBattlefield ? 'animate-pulse' : ''}`}
        onClick={handleClick}
      >
        <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center border border-purple-400/30">
          <span className="text-purple-300 text-xl font-bold">?</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-[4.5rem] h-[6.5rem] rounded-lg ${config.bgColor} border-2 transition-all duration-200 cursor-pointer group minicard
        ${selected 
          ? 'border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/30 -translate-y-2 scale-105' 
          : playable 
            ? 'border-green-400/70 hover:border-green-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/20' 
            : 'border-white/20 hover:border-white/40'
        }
        ${playable && !selected ? 'animate-subtleGlow' : ''}
        ${isNewlyPlayed ? 'animate-[cardDraw_0.4s_ease-out]' : ''}
        ${isHovered ? 'z-10' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={onPreview}
      data-testid={`card-minicard-${card.id}`}
    >
      {/* Card art background */}
      <img 
        src={card.imageUrl || config.cardArt} 
        alt={card.element}
        className="absolute inset-0 w-full h-full object-cover rounded-lg"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 rounded-lg" />
      
      {playable && !selected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-[slowPulse_2s_ease-in-out_infinite] z-20 opacity-80" />
      )}
      
      {/* Power/Rank badge - top left (always visible) */}
      <div className="absolute top-1 left-1 w-6 h-6 bg-slate-900/90 rounded flex items-center justify-center border border-white/30 z-10 card-power-badge">
        <span className="text-white font-bold text-xs">{card.power}</span>
      </div>
      
      {/* Trait value badge - top right (always visible with icon) */}
      {(() => {
        const TraitIcon = card.trait ? traitIconsMap[card.trait] || Zap : null;
        return (
          <div className={`absolute top-1 right-1 h-6 px-0.5 rounded flex items-center justify-center gap-0.5 z-10 ${
            card.trait ? 'bg-purple-600/90 border border-purple-400/50' : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[10px] ${card.trait ? 'text-white' : 'text-slate-400'}`}>{card.trait ? (card.traitValue ?? 1) : 0}</span>
            {TraitIcon && <TraitIcon className="w-3 h-3 text-white" />}
          </div>
        );
      })()}
      
      {/* Buff indicator - bottom left (always visible - uses card's buff color) */}
      {(() => {
        const buffStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
        return (
          <div className={`absolute bottom-6 left-1 w-6 h-5 rounded flex items-center justify-center z-10 ${
            card.buffModifier > 0 
              ? buffStyle ? `${buffStyle.bg} ${buffStyle.border}` : 'bg-cyan-500/90 border border-cyan-300/50'
              : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[9px] ${card.buffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>+{card.buffModifier}</span>
          </div>
        );
      })()}
      
      {/* Debuff indicator - bottom right (always visible - uses card's debuff color) */}
      {(() => {
        const debuffStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];
        return (
          <div className={`absolute bottom-6 right-1 w-6 h-5 rounded flex items-center justify-center z-10 ${
            card.debuffModifier > 0 
              ? debuffStyle ? `${debuffStyle.bg} ${debuffStyle.border}` : 'bg-orange-500/90 border border-orange-300/50'
              : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[9px] ${card.debuffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>-{card.debuffModifier}</span>
          </div>
        );
      })()}
      
      {/* Card name at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 py-1 text-center rounded-b-lg z-10">
        <p className="text-white text-[10px] truncate px-1 font-medium">{card.name.split(' ')[0]}</p>
      </div>
      {isHovered && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-900/95 px-2 py-1 rounded text-xs text-white whitespace-nowrap z-20 border border-purple-500/30">
          Hold to preview
        </div>
      )}
    </div>
  );
}

function CardPreviewDialog({ 
  card, 
  open, 
  onClose 
}: { 
  card: CardType | null; 
  open: boolean; 
  onClose: () => void;
}) {
  if (!card) return null;
  
  const config = elementConfig[card.element];
  const Icon = config.icon;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Icon className={config.color} />
            {card.name}
          </DialogTitle>
        </DialogHeader>
        <div className={`w-full aspect-[3/4] rounded-xl border-4 ${config.solidBorder} relative overflow-hidden`}>
          <img 
            src={card.imageUrl || config.cardArt} 
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          {/* Power/Rank badge - top left */}
          <div className="absolute top-3 left-3 w-12 h-12 bg-slate-900/90 rounded-lg flex items-center justify-center border-2 border-white/30">
            <span className="text-white font-bold text-xl">{card.power}</span>
          </div>
          {/* Trait value badge - top right (with icon) */}
          {(() => {
            const TraitIcon = card.trait ? traitIconsMap[card.trait] || Zap : null;
            return (
              <div className={`absolute top-3 right-3 w-12 h-12 rounded-lg flex flex-col items-center justify-center border-2 ${
                card.trait ? 'bg-purple-600/90 border-purple-400/50' : 'bg-slate-700/80 border-slate-500/30'
              }`}>
                <div className="flex items-center gap-1">
                  <span className={`font-bold text-lg ${card.trait ? 'text-white' : 'text-slate-400'}`}>{card.trait ? (card.traitValue ?? 1) : 0}</span>
                  {TraitIcon && <TraitIcon className="w-4 h-4 text-white" />}
                </div>
                <span className={`text-[8px] ${card.trait ? 'text-purple-200' : 'text-slate-500'}`}>TRAIT</span>
              </div>
            );
          })()}
          {/* Buff badge - bottom left (uses card's buff color) */}
          {(() => {
            const buffStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
            return (
              <div className={`absolute bottom-12 left-3 w-10 h-8 rounded-lg flex items-center justify-center border ${
                card.buffModifier > 0 
                  ? buffStyle ? `${buffStyle.bg} ${buffStyle.border}` : 'bg-cyan-500/90 border-cyan-300/50'
                  : 'bg-slate-700/80 border-slate-500/30'
              }`}>
                <span className={`font-bold text-sm ${card.buffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>+{card.buffModifier}</span>
              </div>
            );
          })()}
          {/* Debuff badge - bottom right (uses card's debuff color) */}
          {(() => {
            const debuffStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];
            return (
              <div className={`absolute bottom-12 right-3 w-10 h-8 rounded-lg flex items-center justify-center border ${
                card.debuffModifier > 0 
                  ? debuffStyle ? `${debuffStyle.bg} ${debuffStyle.border}` : 'bg-orange-500/90 border-orange-300/50'
                  : 'bg-slate-700/80 border-slate-500/30'
              }`}>
                <span className={`font-bold text-sm ${card.debuffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>-{card.debuffModifier}</span>
              </div>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 py-2 text-center ml-[100px] mr-[100px]">
            <p className="text-white font-bold text-lg">{card.name}</p>
            <Badge className="mt-1 bg-purple-600">{card.element}</Badge>
          </div>
        </div>
        <div className="space-y-2">
          {card.trait && (
            <div className="bg-purple-500/20 rounded-lg p-2">
              <p className="text-purple-300 text-xs font-medium">Trait: {card.trait}</p>
              <p className="text-white text-sm">Value: {card.traitValue ?? 1}</p>
            </div>
          )}
          <div className="flex gap-2">
            {(() => {
              const buffStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
              return (
                <div className={`flex-1 rounded-lg p-2 ${card.buffModifier > 0 && buffStyle ? buffStyle.bg.replace('/90', '/30') : card.buffModifier > 0 ? 'bg-cyan-500/30' : 'bg-slate-700/20'}`}>
                  <p className={`text-xs font-medium ${card.buffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>Buff ({card.buffColor || 'None'})</p>
                  <p className="text-white text-sm">+{card.buffModifier}</p>
                </div>
              );
            })()}
            {(() => {
              const debuffStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];
              return (
                <div className={`flex-1 rounded-lg p-2 ${card.debuffModifier > 0 && debuffStyle ? debuffStyle.bg.replace('/90', '/30') : card.debuffModifier > 0 ? 'bg-orange-500/30' : 'bg-slate-700/20'}`}>
                  <p className={`text-xs font-medium ${card.debuffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>Debuff ({card.debuffColor || 'None'})</p>
                  <p className="text-white text-sm">-{card.debuffModifier}</p>
                </div>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AbilityPreviewDialog({
  ability,
  commanderElement,
  open,
  onClose,
}: {
  ability: CommanderAbility | null;
  commanderElement: Element | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!ability || !commanderElement) return null;

  const config = elementConfig[commanderElement];
  const Icon = config.icon;

  const effectTypeLabels: Record<string, string> = {
    direct_damage: "Direct Damage",
    element_power_damage: "Elemental Power Damage",
    buff_element_unit: "Buff Element Units",
    extra_deploy: "Extra Deployment",
    cycle_element_cards: "Cycle Element Cards",
    block_effects: "Block Enemy Effects",
    negate_and_halve: "Negate & Halve",
    healing_factor: "Healing Factor",
    draw_cards: "Draw Cards",
    protect_element: "Protect Element",
    debuff_enemy: "Debuff Enemy Units",
    swap_units: "Swap Units",
    revive_unit: "Revive Unit",
    growth_buff: "Growth Buff",
    prevent_ward: "Ward Prevention",
    destroy_unit: "Destroy Unit",
    add_shield: "Add Shield",
    reduce_power: "Reduce Power",
    first_strike: "First Strike",
    add_evasion: "Add Shield",
    set_power: "Set Power",
    restore_from_ward: "Restore from Ward",
    heal_and_buff: "Heal & Buff",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/30 max-w-sm" data-testid="dialog-ability-preview">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${config.color}`}>
            <Icon className="w-5 h-5" />
            {ability.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-slate-200 text-sm leading-relaxed">
            {ability.description}
          </p>

          <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Phase</span>
              <Badge className={`${ability.phase === "combat" ? "bg-red-600/80" : ability.phase === "deployment" ? "bg-blue-600/80" : ability.phase === "draw" ? "bg-cyan-600/80" : "bg-slate-600/80"}`}>
                {ability.phase}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Effect Type</span>
              <span className="text-white text-sm font-medium">
                {effectTypeLabels[ability.effect.type] || ability.effect.type}
              </span>
            </div>

            {ability.effect.value !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs uppercase tracking-wider">Value</span>
                <span className="text-yellow-300 text-sm font-bold">{ability.effect.value}</span>
              </div>
            )}

            {ability.effect.target && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs uppercase tracking-wider">Target</span>
                <span className="text-white text-sm capitalize">{ability.effect.target}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {ability.victoryCost > 0 && (
              <div className="flex items-center gap-1.5 bg-green-900/40 border border-green-500/30 rounded-lg px-3 py-1.5">
                <Trophy className="w-4 h-4 text-green-400" />
                <span className="text-green-300 text-sm font-medium">-{ability.victoryCost} Advantage</span>
              </div>
            )}
            {ability.withdrawalCost > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-500/30 rounded-lg px-3 py-1.5">
                <Flag className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 text-sm font-medium">-{ability.withdrawalCost} Withdrawal</span>
              </div>
            )}
            {ability.victoryCost === 0 && ability.withdrawalCost === 0 && (
              <div className="flex items-center gap-1.5 bg-slate-700/40 border border-slate-500/30 rounded-lg px-3 py-1.5">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-slate-300 text-sm font-medium">Free to use</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CombatResultProps {
  player1Breakdown: CardPowerBreakdown[];
  player2Breakdown: CardPowerBreakdown[];
  combatSummary: CombatSummary | null;
  timer: number;
  onSkip: () => void;
  isPlayer1: boolean;
}

function CombatResultPanel({ 
  player1Breakdown, 
  player2Breakdown, 
  combatSummary,
  timer, 
  onSkip,
  isPlayer1
}: CombatResultProps) {
  const [showDetailedLog, setShowDetailedLog] = useState(false);
  
  const player1Total = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
  const player2Total = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
  
  const winner = player1Total > player2Total ? "player1" : player2Total > player1Total ? "player2" : "tie";
  const damage = Math.abs(player1Total - player2Total);
  
  const yourBreakdown = isPlayer1 ? player1Breakdown : player2Breakdown;
  const enemyBreakdown = isPlayer1 ? player2Breakdown : player1Breakdown;
  const yourTotal = isPlayer1 ? player1Total : player2Total;
  const enemyTotal = isPlayer1 ? player2Total : player1Total;
  const youWin = (isPlayer1 && winner === "player1") || (!isPlayer1 && winner === "player2");
  const isTie = winner === "tie";
  
  const traitIcons: Record<string, typeof Zap> = {
    "Quick Strike": Zap,
    "Care Package": Plus,
    "Restoration": Heart,
    "Guardian": Shield,
  };
  
  const logIconMap: Record<string, typeof Zap> = {
    "zap": Zap,
    "calculator": ArrowRight,
    "shield": Shield,
    "swords": Swords,
    "trophy": Trophy,
    "skull": X,
    "handshake": ArrowRight,
    "heart": Heart,
    "plus": Plus,
  };

  const phaseColors: Record<string, string> = {
    "quick_strike": "border-yellow-500/50 bg-yellow-500/10",
    "power_calculation": "border-blue-500/50 bg-blue-500/10",
    "damage_resolution": "border-purple-500/50 bg-purple-500/10",
    "guardian_block": "border-cyan-500/50 bg-cyan-500/10",
    "healing": "border-pink-500/50 bg-pink-500/10",
    "card_draw": "border-green-500/50 bg-green-500/10",
  };

  const actorColors: Record<string, string> = {
    "player1": "text-green-300",
    "player2": "text-red-300",
    "both": "text-yellow-300",
    "system": "text-purple-300",
  };

  // Calculate trait effect summaries for current player's perspective
  const yourQuickStrike = isPlayer1 ? combatSummary?.player1QuickStrikeDamage || 0 : combatSummary?.player2QuickStrikeDamage || 0;
  const enemyQuickStrike = isPlayer1 ? combatSummary?.player2QuickStrikeDamage || 0 : combatSummary?.player1QuickStrikeDamage || 0;
  const yourGuardianBlock = isPlayer1 ? combatSummary?.player1GuardianBlocked || 0 : combatSummary?.player2GuardianBlocked || 0;
  const enemyGuardianBlock = isPlayer1 ? combatSummary?.player2GuardianBlocked || 0 : combatSummary?.player1GuardianBlocked || 0;
  const yourHealing = isPlayer1 ? combatSummary?.player1Healing || 0 : combatSummary?.player2Healing || 0;
  const enemyHealing = isPlayer1 ? combatSummary?.player2Healing || 0 : combatSummary?.player1Healing || 0;
  const yourCardsDraw = isPlayer1 ? combatSummary?.player1CardsDrawn || 0 : combatSummary?.player2CardsDrawn || 0;
  const enemyCardsDraw = isPlayer1 ? combatSummary?.player2CardsDrawn || 0 : combatSummary?.player1CardsDrawn || 0;
  const finalDamageToYou = isPlayer1 ? combatSummary?.finalDamageToPlayer1 || 0 : combatSummary?.finalDamageToPlayer2 || 0;
  const finalDamageToEnemy = isPlayer1 ? combatSummary?.finalDamageToPlayer2 || 0 : combatSummary?.finalDamageToPlayer1 || 0;

  const hasTraitEffects = yourQuickStrike > 0 || enemyQuickStrike > 0 || 
                          yourGuardianBlock > 0 || enemyGuardianBlock > 0 ||
                          yourHealing > 0 || enemyHealing > 0 ||
                          yourCardsDraw > 0 || enemyCardsDraw > 0;
  
  return (
    <div className="bg-slate-900/95 border border-purple-500/30 rounded-lg p-3 space-y-3 max-h-[40vh] overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <Swords className="w-5 h-5 text-yellow-400" />
          Combat Results
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-purple-300 text-sm">
            Auto-advance: <span className="font-mono text-yellow-400">{timer}s</span>
          </div>
          <Button size="sm" variant="outline" onClick={onSkip} data-testid="button-skip-timer">
            Skip
          </Button>
        </div>
      </div>
      
      {/* Result Header */}
      <div className={`text-center p-3 rounded-lg ${
        isTie ? 'bg-yellow-500/20 border border-yellow-500/30' : 
        youWin ? 'bg-green-500/20 border border-green-500/30' : 
        'bg-red-500/20 border border-red-500/30'
      }`}>
        <p className={`font-bold text-lg ${
          isTie ? 'text-yellow-300' : youWin ? 'text-green-300' : 'text-red-300'
        }`}>
          {isTie ? (
            <>TIE! Both players get +1 Advance and +1 Withdraw</>
          ) : youWin ? (
            <>Victory! You deal {finalDamageToEnemy > 0 ? finalDamageToEnemy : damage} damage!</>
          ) : (
            <>Defeat! You take {finalDamageToYou > 0 ? finalDamageToYou : damage} damage!</>
          )}
        </p>
        <p className="text-white/60 text-sm mt-1">
          Your Power: {yourTotal} vs Enemy Power: {enemyTotal}
        </p>
      </div>

      {/* Trait Effects Summary */}
      {hasTraitEffects && combatSummary && (
        <div className="bg-slate-800/50 border border-purple-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-purple-300 font-medium text-sm flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Trait Effects Summary
            </h4>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowDetailedLog(!showDetailedLog)}
              className="text-xs h-6"
              data-testid="button-toggle-combat-log"
            >
              {showDetailedLog ? "Hide Log" : "Show Full Log"}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Your Trait Effects */}
            <div className="space-y-1">
              <p className="text-green-400 font-medium">Your Traits:</p>
              {yourQuickStrike > 0 && (
                <div className="flex items-center gap-1 text-yellow-300">
                  <Zap className="w-3 h-3" />
                  <span>Quick Strike: {yourQuickStrike} direct HP dmg (bypasses combat)</span>
                </div>
              )}
              {yourGuardianBlock > 0 && (
                <div className="flex items-center gap-1 text-cyan-300">
                  <Shield className="w-3 h-3" />
                  <span>Guardian: Blocked {yourGuardianBlock} dmg</span>
                </div>
              )}
              {yourHealing > 0 && (
                <div className="flex items-center gap-1 text-pink-300">
                  <Heart className="w-3 h-3" />
                  <span>Restoration: +{yourHealing} HP</span>
                </div>
              )}
              {yourCardsDraw > 0 && (
                <div className="flex items-center gap-1 text-green-300">
                  <Plus className="w-3 h-3" />
                  <span>Care Package: +{yourCardsDraw} cards</span>
                </div>
              )}
              {yourQuickStrike === 0 && yourGuardianBlock === 0 && yourHealing === 0 && yourCardsDraw === 0 && (
                <p className="text-white/40 italic">No traits activated</p>
              )}
            </div>
            
            {/* Enemy Trait Effects */}
            <div className="space-y-1">
              <p className="text-red-400 font-medium">Enemy Traits:</p>
              {enemyQuickStrike > 0 && (
                <div className="flex items-center gap-1 text-yellow-300">
                  <Zap className="w-3 h-3" />
                  <span>Quick Strike: {enemyQuickStrike} direct HP dmg (bypasses combat)</span>
                </div>
              )}
              {enemyGuardianBlock > 0 && (
                <div className="flex items-center gap-1 text-cyan-300">
                  <Shield className="w-3 h-3" />
                  <span>Guardian: Blocked {enemyGuardianBlock} dmg</span>
                </div>
              )}
              {enemyHealing > 0 && (
                <div className="flex items-center gap-1 text-pink-300">
                  <Heart className="w-3 h-3" />
                  <span>Restoration: +{enemyHealing} HP</span>
                </div>
              )}
              {enemyCardsDraw > 0 && (
                <div className="flex items-center gap-1 text-green-300">
                  <Plus className="w-3 h-3" />
                  <span>Care Package: +{enemyCardsDraw} cards</span>
                </div>
              )}
              {enemyQuickStrike === 0 && enemyGuardianBlock === 0 && enemyHealing === 0 && enemyCardsDraw === 0 && (
                <p className="text-white/40 italic">No traits activated</p>
              )}
            </div>
          </div>

          {/* Final Damage Calculation */}
          <div className="mt-2 pt-2 border-t border-slate-700">
            <p className="text-white/80 text-xs font-medium">Final Health Changes:</p>
            <div className="flex justify-between text-xs mt-1">
              <div>
                <span className="text-green-300">You: </span>
                {finalDamageToYou > 0 && <span className="text-red-400">-{finalDamageToYou} HP</span>}
                {yourHealing > 0 && <span className="text-pink-400"> +{yourHealing} heal</span>}
                {finalDamageToYou === 0 && yourHealing === 0 && <span className="text-white/40">No change</span>}
              </div>
              <div>
                <span className="text-red-300">Enemy: </span>
                {finalDamageToEnemy > 0 && <span className="text-red-400">-{finalDamageToEnemy} HP</span>}
                {enemyHealing > 0 && <span className="text-pink-400"> +{enemyHealing} heal</span>}
                {finalDamageToEnemy === 0 && enemyHealing === 0 && <span className="text-white/40">No change</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Combat Log */}
      {showDetailedLog && combatSummary && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
          <h4 className="text-white font-medium text-sm flex items-center gap-1 sticky top-0 bg-slate-800/90 p-1 -m-1 rounded">
            <ArrowRight className="w-4 h-4 text-purple-400" />
            Detailed Combat Log
          </h4>
          <div className="space-y-1.5">
            {combatSummary.log.map((entry, i) => {
              const IconComponent = logIconMap[entry.icon] || ArrowRight;
              return (
                <div 
                  key={i} 
                  className={`p-2 rounded border text-xs ${phaseColors[entry.phase] || 'border-slate-600/50 bg-slate-700/30'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <IconComponent className={`w-3 h-3 ${actorColors[entry.actor]}`} />
                    </div>
                    <div className="flex-1">
                      <span className={actorColors[entry.actor]}>{entry.description}</span>
                      {entry.traitName && (
                        <span className="ml-1 text-purple-400 font-medium">
                          [{entry.traitName}]
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-white/40 text-[10px]">
                      #{entry.step}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Your Cards Breakdown */}
      <div className="space-y-2">
        <p className="text-green-300 font-medium text-sm flex items-center gap-1">
          <Shield className="w-4 h-4" />
          Your Cards
        </p>
        <div className="space-y-2">
          {yourBreakdown.map((breakdown, i) => {
            const config = elementConfig[breakdown.card.element];
            const Icon = config.icon;
            const TraitIcon = breakdown.traitInfo ? traitIcons[breakdown.traitInfo.trait] : null;
            
            return (
              <div key={i} className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded ${config.bgColor} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{breakdown.card.name}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-white/60">Base: {breakdown.basePower}</span>
                      {breakdown.buffBonuses.length > 0 && (
                        <span className="text-green-400">
                          +{breakdown.buffBonuses.reduce((s, b) => s + b.amount, 0)} buff
                        </span>
                      )}
                      {breakdown.debuffPenalties.length > 0 && (
                        <span className="text-red-400">
                          -{breakdown.debuffPenalties.reduce((s, d) => s + d.amount, 0)} debuff
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{breakdown.finalPower}</p>
                    {breakdown.traitInfo && TraitIcon && (
                      <div className="flex items-center gap-0.5 text-purple-300 text-xs">
                        <TraitIcon className="w-3 h-3" />
                        <span>{breakdown.traitInfo.trait.split(' ')[0]}: {breakdown.traitInfo.value}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Detailed buff/debuff sources */}
                {(breakdown.buffBonuses.length > 0 || breakdown.debuffPenalties.length > 0) && (
                  <div className="mt-1 pl-10 space-y-0.5">
                    {breakdown.buffBonuses.map((buff, j) => (
                      <p key={`buff-${j}`} className="text-green-400 text-xs">
                        +{buff.amount} from {buff.fromCard.name} ({buff.fromCard.buffColor} buff)
                      </p>
                    ))}
                    {breakdown.debuffPenalties.map((debuff, j) => (
                      <p key={`debuff-${j}`} className="text-red-400 text-xs">
                        -{debuff.amount} from enemy {debuff.fromCard.name} ({debuff.fromCard.debuffColor} debuff)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Enemy Cards Breakdown */}
      <div className="space-y-2">
        <p className="text-red-300 font-medium text-sm flex items-center gap-1">
          <Swords className="w-4 h-4" />
          Enemy Cards
        </p>
        <div className="space-y-2">
          {enemyBreakdown.map((breakdown, i) => {
            const config = elementConfig[breakdown.card.element];
            const Icon = config.icon;
            const TraitIcon = breakdown.traitInfo ? traitIcons[breakdown.traitInfo.trait] : null;
            
            return (
              <div key={i} className="bg-slate-800/50 rounded-lg p-2 border border-red-900/30">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded ${config.bgColor} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{breakdown.card.name}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-white/60">Base: {breakdown.basePower}</span>
                      {breakdown.buffBonuses.length > 0 && (
                        <span className="text-green-400">
                          +{breakdown.buffBonuses.reduce((s, b) => s + b.amount, 0)} buff
                        </span>
                      )}
                      {breakdown.debuffPenalties.length > 0 && (
                        <span className="text-red-400">
                          -{breakdown.debuffPenalties.reduce((s, d) => s + d.amount, 0)} debuff
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{breakdown.finalPower}</p>
                    {breakdown.traitInfo && TraitIcon && (
                      <div className="flex items-center gap-0.5 text-purple-300 text-xs">
                        <TraitIcon className="w-3 h-3" />
                        <span>{breakdown.traitInfo.trait.split(' ')[0]}: {breakdown.traitInfo.value}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BattlefieldZone({ 
  cards, 
  isOpponent, 
  allCards, 
  onPreview,
  newlyDeployedCards = new Set()
}: { 
  cards: BattlefieldCard[]; 
  isOpponent: boolean; 
  allCards: CardType[];
  onPreview: (card: CardType) => void;
  newlyDeployedCards?: Set<string>;
}) {
  const getCardById = (instanceId: string) => {
    const cardId = getCardIdFromInstance(instanceId);
    return allCards.find((c) => c.id === cardId);
  };
  
  return (
    <div className={`relative rounded-lg border-2 ${isOpponent ? 'border-red-500/20 bg-gradient-to-b from-red-900/10 to-slate-800/30' : 'border-green-500/20 bg-gradient-to-t from-green-900/10 to-slate-800/30'} p-2 flex-1 min-h-0 flex flex-col battlefield-zone`}>
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_${isOpponent ? '0%' : '100%'},_var(--tw-gradient-from)_0%,_transparent_70%)] ${isOpponent ? 'from-red-500/5' : 'from-green-500/5'}`} />
      </div>
      <p className={`${isOpponent ? 'text-red-300' : 'text-green-300'} text-[10px] font-medium mb-1 text-center uppercase tracking-wider flex-shrink-0`}>
        {isOpponent ? "Opponent's Field" : "Your Field"}
      </p>
      <div className="flex gap-2 justify-center flex-1 min-h-0 items-center">
        {cards.length > 0 ? (
          cards.map((bf, i) => {
            const card = getCardById(bf.cardId);
            if (!card) return null;
            const isJustDeployed = newlyDeployedCards.has(bf.cardId);
            const isRevealed = !bf.faceDown;
            return (
              <div 
                key={i} 
                className={`transition-all duration-500 ${
                  isJustDeployed ? 'animate-[cardDraw_0.4s_ease-out]' : 
                  isRevealed ? 'animate-[flipIn_0.5s_ease-out]' : ''
                }`}
              >
                <MiniCard 
                  card={card} 
                  faceDown={bf.faceDown}
                  isOnBattlefield
                  onPreview={() => !bf.faceDown && onPreview(card)}
                />
              </div>
            );
          })
        ) : (
          <div className={`text-sm ${isOpponent ? 'text-red-400/50' : 'text-green-400/50'} italic`}>
            No cards deployed
          </div>
        )}
      </div>
    </div>
  );
}

function AbilityCard({ 
  ability, 
  commanderElement,
  canAfford,
  isCorrectPhase,
  isMyTurn,
  usedThisTurn,
  onActivate,
  onPreview,
}: {
  ability: CommanderAbility;
  commanderElement: Element;
  canAfford: boolean;
  isCorrectPhase: boolean;
  isMyTurn: boolean;
  usedThisTurn: boolean;
  onActivate: () => void;
  onPreview: () => void;
}) {
  const config = elementConfig[commanderElement];
  const isPlayable = canAfford && isCorrectPhase && isMyTurn;
  
  return (
    <div 
      className={`relative w-32 rounded-lg border-2 p-2 transition-all duration-200 cursor-pointer
        ${usedThisTurn 
          ? 'border-amber-500/40 opacity-70 bg-gradient-to-br from-amber-900/30 to-slate-900' 
          : isPlayable 
            ? 'border-yellow-400 shadow-lg shadow-yellow-500/20 hover:-translate-y-1 bg-gradient-to-br from-slate-800 to-slate-900' 
            : 'border-slate-600/50 opacity-50 bg-gradient-to-br from-slate-800 to-slate-900'
        }
      `}
      onClick={() => isPlayable && !usedThisTurn && onActivate()}
      data-testid={`ability-card-${ability.id}`}
    >
      {usedThisTurn && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-amber-600/90 text-amber-100 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transform -rotate-12 shadow-lg">
            Used
          </div>
        </div>
      )}

      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 z-20 w-5 h-5 min-h-0 rounded-full bg-slate-700/80 border border-slate-500/40"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        data-testid={`button-preview-ability-${ability.id}`}
      >
        <Eye className="w-3 h-3 text-slate-300" />
      </Button>
      
      <div className={`text-xs font-bold ${config.color} mb-1 truncate pr-5`}>
        {ability.name}
      </div>
      
      <p className="text-[10px] text-slate-300 leading-tight mb-2 line-clamp-3">
        {ability.description}
      </p>
      
      <div className="flex items-center gap-1 flex-wrap">
        {ability.victoryCost > 0 && (
          <Badge className="bg-green-600/80 text-[9px] px-1 py-0">
            <Trophy className="w-2.5 h-2.5 mr-0.5" />
            -{ability.victoryCost} Adv
          </Badge>
        )}
        {ability.withdrawalCost > 0 && (
          <Badge className="bg-blue-600/80 text-[9px] px-1 py-0">
            <Flag className="w-2.5 h-2.5 mr-0.5" />
            -{ability.withdrawalCost} Wth
          </Badge>
        )}
        {ability.victoryCost === 0 && ability.withdrawalCost === 0 && (
          <Badge className="bg-slate-600/80 text-[9px] px-1 py-0">
            Free
          </Badge>
        )}
      </div>
      
      <div className={`mt-1 text-[9px] uppercase tracking-wider ${isCorrectPhase ? 'text-yellow-400' : 'text-slate-500'}`}>
        {ability.phase} phase
      </div>
      
      {isPlayable && !usedThisTurn && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}

function CommanderInfoDialog({
  commander,
  open,
  onClose,
  label,
}: {
  commander: Commander | null | undefined;
  open: boolean;
  onClose: () => void;
  label: string;
}) {
  if (!commander) return null;

  const config = elementConfig[commander.element];
  const Icon = config.icon;

  const effectTypeLabels: Record<string, string> = {
    direct_damage: "Direct Damage",
    element_power_damage: "Elemental Power Damage",
    buff_element_unit: "Buff Element Units",
    extra_deploy: "Extra Deployment",
    cycle_element_cards: "Cycle Element Cards",
    block_effects: "Block Enemy Effects",
    negate_and_halve: "Negate & Halve",
    healing_factor: "Healing Factor",
    draw_cards: "Draw Cards",
    protect_element: "Protect Element",
    debuff_enemy: "Debuff Enemy Units",
    swap_units: "Swap Units",
    revive_unit: "Revive Unit",
    growth_buff: "Growth Buff",
    prevent_ward: "Ward Prevention",
    destroy_unit: "Destroy Unit",
    add_shield: "Add Shield",
    reduce_power: "Reduce Power",
    first_strike: "First Strike",
    add_evasion: "Add Shield",
    set_power: "Set Power",
    restore_from_ward: "Restore from Ward",
    heal_and_buff: "Heal & Buff",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/30 max-w-md max-h-[85vh] overflow-hidden" data-testid={`dialog-commander-info-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${config.color}`}>
            <Crown className="w-5 h-5" />
            {label}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {commander.imageUrl && (
                <img
                  src={commander.imageUrl}
                  alt={commander.name}
                  className="w-20 h-20 rounded-lg object-cover border-2 border-purple-500/30"
                />
              )}
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">{commander.name}</h3>
                <p className={`text-sm font-medium ${config.color}`}>{commander.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <Badge className={`${config.bgColor} text-white text-xs`}>
                    {commander.element}
                  </Badge>
                </div>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">{commander.description}</p>

            <div className="space-y-2">
              <h4 className="text-amber-300 font-bold text-sm flex items-center gap-1.5">
                <Scroll className="w-4 h-4" />
                Abilities ({commander.abilities.length})
              </h4>
              {commander.abilities.map((ability) => (
                <div
                  key={ability.id}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 space-y-2"
                  data-testid={`commander-ability-info-${ability.id}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-bold text-sm ${config.color}`}>{ability.name}</span>
                    <Badge className={`${ability.phase === "combat" ? "bg-red-600/80" : ability.phase === "deployment" ? "bg-blue-600/80" : ability.phase === "draw" ? "bg-cyan-600/80" : "bg-slate-600/80"} text-[10px]`}>
                      {ability.phase} phase
                    </Badge>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{ability.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">Effect:</span>
                    <span className="text-white text-xs">
                      {effectTypeLabels[ability.effect.type] || ability.effect.type}
                    </span>
                    {ability.effect.value !== undefined && (
                      <span className="text-yellow-300 text-xs font-bold">(Value: {ability.effect.value})</span>
                    )}
                    {ability.effect.target && (
                      <span className="text-white/70 text-xs capitalize">Target: {ability.effect.target}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ability.victoryCost > 0 && (
                      <div className="flex items-center gap-0.5 text-green-300 text-xs">
                        <Trophy className="w-3 h-3" />
                        <span>-{ability.victoryCost} Advance</span>
                      </div>
                    )}
                    {ability.withdrawalCost > 0 && (
                      <div className="flex items-center gap-0.5 text-blue-300 text-xs">
                        <Flag className="w-3 h-3" />
                        <span>-{ability.withdrawalCost} Withdrawal</span>
                      </div>
                    )}
                    {ability.victoryCost === 0 && ability.withdrawalCost === 0 && (
                      <div className="flex items-center gap-0.5 text-slate-400 text-xs">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        <span>Free</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function GameBoardPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/game/:id");
  const [, navigate] = useLocation();
  const gameId = params?.id;

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [previewCard, setPreviewCard] = useState<CardType | null>(null);
  const [previewAbility, setPreviewAbility] = useState<CommanderAbility | null>(null);
  const [previousMyHP, setPreviousMyHP] = useState<number | undefined>(undefined);
  const [previousOpponentHP, setPreviousOpponentHP] = useState<number | undefined>(undefined);
  const [newlyDrawnCards, setNewlyDrawnCards] = useState<Set<string>>(new Set());
  const [newlyDeployedCards, setNewlyDeployedCards] = useState<Set<string>>(new Set());
  const [combatTimer, setCombatTimer] = useState(30);
  const [showCombatResults, setShowCombatResults] = useState(false);
  const [combatBreakdown, setCombatBreakdown] = useState<{
    player1: CardPowerBreakdown[];
    player2: CardPowerBreakdown[];
  } | null>(null);
  const [combatSummary, setCombatSummary] = useState<CombatSummary | null>(null);
  const [showCombatLogDialog, setShowCombatLogDialog] = useState(false);
  const [showCombatHistoryDialog, setShowCombatHistoryDialog] = useState(false);
  const [handView, setHandView] = useState<"units" | "abilities">("units");
  const [usedAbilitiesThisTurn, setUsedAbilitiesThisTurn] = useState<Set<string>>(new Set());
  const [showAbilityLogDialog, setShowAbilityLogDialog] = useState(false);
  const [showMyCommanderDialog, setShowMyCommanderDialog] = useState(false);
  const [showOpponentCommanderDialog, setShowOpponentCommanderDialog] = useState(false);
  const [selectedHistoryRound, setSelectedHistoryRound] = useState<number | null>(null);
  const [combatPhaseTimer, setCombatPhaseTimer] = useState(30);
  const [combatPhaseTimerActive, setCombatPhaseTimerActive] = useState(false);
  const combatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const combatPhaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previousHandRef = useRef<string[] | null>(null);
  const previousBattlefieldRef = useRef<string[] | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const aiExecutingRef = useRef<string | null>(null);
  const [serverState, setServerState] = useState<any>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(60);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { joinGame, leaveGame, subscribe, sendGameMessage, sendGameAction } = useWebSocket();

  const { data: game, isLoading, refetch: refetchGame } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
    refetchInterval: 3000,
  });

  const { data: allCards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: allCommanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
  });

  useEffect(() => {
    if (gameId) {
      joinGame(gameId);
    }
    return () => {
      if (gameId) {
        leaveGame(gameId);
      }
    };
  }, [gameId, joinGame, leaveGame]);

  useEffect(() => {
    const unsubscribe = subscribe("game_update", (msg) => {
      if (msg.payload?.gameId === gameId) {
        refetchGame();
      }
    });
    return unsubscribe;
  }, [subscribe, gameId, refetchGame]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(subscribe("game_state", (msg) => {
      if (msg.payload?.gameId === gameId) {
        setServerState(msg.payload);
        setWaitingForOpponent(false);
      }
    }));

    unsubs.push(subscribe("combat_result", (msg) => {
      if (msg.payload?.gameId === gameId) {
        const cr = msg.payload;
        const isP1 = cr.player1Id ? cr.player1Id === user?.id : serverState?.isPlayer1;
        const p1B = (cr.player1Breakdown || []).map((b: any) => ({
          card: allCards.find(c => c.id === b.cardId) || { id: b.cardId, name: b.cardName, power: b.basePower, element: "", trait: b.traitName, traitValue: b.traitValue, buffModifier: 0, debuffModifier: 0, buffColor: null, debuffColor: null, rarity: "common", imageUrl: null },
          basePower: b.basePower,
          buffBonuses: b.buffBonus > 0 ? [{ fromCard: { name: "buffs" } as any, amount: b.buffBonus }] : [],
          debuffPenalties: b.debuffPenalty > 0 ? [{ fromCard: { name: "debuffs" } as any, amount: b.debuffPenalty }] : [],
          traitInfo: b.traitName ? { trait: b.traitName, value: b.traitValue } : null,
          finalPower: b.finalPower,
        }));
        const p2B = (cr.player2Breakdown || []).map((b: any) => ({
          card: allCards.find(c => c.id === b.cardId) || { id: b.cardId, name: b.cardName, power: b.basePower, element: "", trait: b.traitName, traitValue: b.traitValue, buffModifier: 0, debuffModifier: 0, buffColor: null, debuffColor: null, rarity: "common", imageUrl: null },
          basePower: b.basePower,
          buffBonuses: b.buffBonus > 0 ? [{ fromCard: { name: "buffs" } as any, amount: b.buffBonus }] : [],
          debuffPenalties: b.debuffPenalty > 0 ? [{ fromCard: { name: "debuffs" } as any, amount: b.debuffPenalty }] : [],
          traitInfo: b.traitName ? { trait: b.traitName, value: b.traitValue } : null,
          finalPower: b.finalPower,
        }));
        setCombatBreakdown({ player1: p1B, player2: p2B });
        if (cr.combatSummary) setCombatSummary(cr.combatSummary);
        setShowCombatResults(true);
        setCombatTimer(30);
        if (combatTimerRef.current) clearInterval(combatTimerRef.current);
        combatTimerRef.current = setInterval(() => {
          setCombatTimer(prev => {
            if (prev <= 1) {
              if (combatTimerRef.current) { clearInterval(combatTimerRef.current); combatTimerRef.current = null; }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }));

    unsubs.push(subscribe("game_over", (msg) => {
      if (msg.payload?.gameId === gameId) {
        refetchGame();
        const winnerId = msg.payload.winnerId;
        const reason = msg.payload.reason;
        if (reason === "opponent_forfeit") {
          toast({ title: winnerId === user?.id ? "Opponent forfeited! You win!" : "You forfeited." });
        } else {
          toast({ title: winnerId === user?.id ? "You win!" : "You lost!" });
        }
        setOpponentDisconnected(false);
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      }
    }));

    unsubs.push(subscribe("opponent_disconnected", (msg) => {
      if (msg.payload?.gameId === gameId) {
        setOpponentDisconnected(true);
        setDisconnectCountdown(60);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = setInterval(() => {
          setDisconnectCountdown(prev => {
            if (prev <= 1) {
              if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        toast({ title: "Opponent disconnected. Waiting for reconnection...", variant: "destructive" });
      }
    }));

    unsubs.push(subscribe("opponent_reconnected", (msg) => {
      if (msg.payload?.gameId === gameId) {
        setOpponentDisconnected(false);
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        toast({ title: "Opponent reconnected!" });
      }
    }));

    unsubs.push(subscribe("game_error", (msg) => {
      if (msg.payload?.gameId === gameId) {
        toast({ title: msg.payload.error || "Game error", variant: "destructive" });
      }
    }));

    unsubs.push(subscribe("turn_ended", (msg) => {
      if (msg.payload?.gameId === gameId) {
        toast({ title: "Opponent ended their turn" });
      }
    }));

    unsubs.push(subscribe("opponent_drew", (msg) => {
      if (msg.payload?.gameId === gameId) {
        toast({ title: "Opponent drew their cards" });
      }
    }));

    unsubs.push(subscribe("opponent_deployed", (msg) => {
      if (msg.payload?.gameId === gameId) {
        toast({ title: "Opponent deployed their cards" });
      }
    }));

    unsubs.push(subscribe("phase_changed", (msg) => {
      if (msg.payload?.gameId === gameId) {
        refetchGame();
      }
    }));

    unsubs.push(subscribe("ability_used", (msg) => {
      if (msg.payload?.gameId === gameId) {
        toast({ title: "Opponent used an ability" });
      }
    }));

    return () => unsubs.forEach(u => u());
  }, [subscribe, gameId, user?.id, allCards, refetchGame, serverState?.isPlayer1]);

  useEffect(() => {
    const unsubscribe = subscribe("game_message", (msg) => {
      if (msg.payload?.gameId === gameId) {
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          message: msg.payload.message,
          senderId: msg.payload.senderId,
          senderName: msg.payload.senderName || "Player",
          createdAt: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, newMessage]);
      }
    });
    return unsubscribe;
  }, [subscribe, gameId]);

  useEffect(() => {
    const unsubscribe = subscribe("spectator_count", (msg) => {
      if (msg.payload?.gameId === gameId) {
        setSpectatorCount(msg.payload.count);
      }
    });
    return unsubscribe;
  }, [subscribe, gameId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendChat = () => {
    if (chatMessage.trim() && gameId) {
      sendGameMessage(gameId, chatMessage.trim());
      const myName = user?.firstName ? `${user.firstName}` : "You";
      setChatMessages((prev) => [...prev, {
        id: Date.now().toString(),
        message: chatMessage.trim(),
        senderId: user?.id || "",
        senderName: myName,
        createdAt: new Date().toISOString(),
      }]);
      setChatMessage("");
    }
  };

  const updateGameMutation = useMutation({
    mutationFn: async (updates: Partial<Game>) => {
      const res = await apiRequest("PATCH", `/api/games/${gameId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      if (gameId) {
        sendGameAction(gameId, "state_update", {});
      }
    },
  });

  const isMultiplayer = game?.gameType === "multiplayer";
  const useServerState = isMultiplayer && serverState;

  const getCardById = (instanceId: string) => {
    const cardId = getCardIdFromInstance(instanceId);
    return allCards.find((c) => c.id === cardId);
  };

  const isPlayer1 = useServerState ? serverState.isPlayer1 : (game ? game.player1Id === user?.id : false);
  const myHP = useServerState ? serverState.myHP : (game ? (isPlayer1 ? game.player1HP : game.player2HP) : GAME_CONSTANTS.STARTING_HP);
  const opponentHP = useServerState ? serverState.opponentHP : (game ? (isPlayer1 ? game.player2HP : game.player1HP) : GAME_CONSTANTS.STARTING_HP);
  const myHand = useServerState ? serverState.myHand : (game ? (isPlayer1 ? game.gameState.player1Hand : game.gameState.player2Hand) : []);
  const opponentHandSize = useServerState ? serverState.opponentHandCount : (game ? (isPlayer1 ? game.gameState.player2Hand.length : game.gameState.player1Hand.length) : 0);
  const myBattlefield = useServerState ? serverState.myBattlefield : (game ? (isPlayer1 ? game.gameState.player1Battlefield : game.gameState.player2Battlefield) : []);
  const rawOpponentBattlefield = useServerState ? serverState.opponentBattlefield : (game ? (isPlayer1 ? game.gameState.player2Battlefield : game.gameState.player1Battlefield) : []);
  const opponentBattlefield = game?.gameType === "practice" 
    ? rawOpponentBattlefield.map((bf: any) => ({ ...bf, faceDown: false }))
    : rawOpponentBattlefield;
  const myDeckSize = useServerState ? serverState.myDeckCount : (game ? (isPlayer1 ? game.gameState.player1Deck.length : game.gameState.player2Deck.length) : 0);
  const opponentDeckSize = useServerState ? serverState.opponentDeckCount : (game ? (isPlayer1 ? game.gameState.player2Deck.length : game.gameState.player1Deck.length) : 0);
  const isMyTurn = useServerState ? true : (game ? game.activePlayer === user?.id : false);
  const myVP = useServerState ? serverState.myVP : (game ? (isPlayer1 ? game.player1VictoryPoints : game.player2VictoryPoints) : 0);
  const myWP = useServerState ? serverState.myWP : (game ? (isPlayer1 ? game.player1WithdrawalPoints : game.player2WithdrawalPoints) : 0);
  const myCommanderId = useServerState ? serverState.myCommanderId : (game ? (isPlayer1 ? game.gameState.player1CommanderId : game.gameState.player2CommanderId) : undefined);
  const myCommander = myCommanderId ? allCommanders.find(c => c.id === myCommanderId) : undefined;
  const opponentCommanderId = useServerState ? serverState.opponentCommanderId : (game ? (isPlayer1 ? game.gameState.player2CommanderId : game.gameState.player1CommanderId) : undefined);
  const opponentCommander = opponentCommanderId ? allCommanders.find(c => c.id === opponentCommanderId) : undefined;
  
  // Get game mode config (draw/deploy counts)
  const gameMode: GameMode = game?.gameMode || "standard";
  const modeConfig = GAME_MODE_CONFIG[gameMode];
  const cardsToDraw = modeConfig.cardsToDraw;
  const baseCardsToDeploy = modeConfig.cardsToDeploy;
  const myExtraDeploy = useServerState ? (serverState.extraDeploy || 0) : (game ? (isPlayer1 ? (game.gameState.player1ExtraDeploy || 0) : (game.gameState.player2ExtraDeploy || 0)) : 0);
  const cardsToDeploy = baseCardsToDeploy + myExtraDeploy;
  const effectivePhase = useServerState ? serverState.currentPhase : (game?.currentPhase || "draw");
  const effectiveTurn = useServerState ? serverState.currentTurn : (game?.currentTurn || 1);
  const effectiveStatus = useServerState ? serverState.status : (game?.status || "waiting");
  const effectiveWinnerId = useServerState ? serverState.winnerId : game?.winnerId;
  const opponentVP = useServerState ? serverState.opponentVP : (game ? (isPlayer1 ? game.player2VictoryPoints : game.player1VictoryPoints) : 0);
  const opponentWP = useServerState ? serverState.opponentWP : (game ? (isPlayer1 ? game.player2WithdrawalPoints : game.player1WithdrawalPoints) : 0);

  useEffect(() => {
    if (!game) return;
    if (previousMyHP === undefined) {
      setPreviousMyHP(myHP);
    } else if (myHP !== previousMyHP) {
      const timer = setTimeout(() => setPreviousMyHP(myHP), 600);
      return () => clearTimeout(timer);
    }
  }, [myHP, previousMyHP, game]);

  useEffect(() => {
    if (!game) return;
    if (previousOpponentHP === undefined) {
      setPreviousOpponentHP(opponentHP);
    } else if (opponentHP !== previousOpponentHP) {
      const timer = setTimeout(() => setPreviousOpponentHP(opponentHP), 600);
      return () => clearTimeout(timer);
    }
  }, [opponentHP, previousOpponentHP, game]);

  useEffect(() => {
    if (!game || !gameId) return;
    
    if (lastGameIdRef.current !== gameId) {
      lastGameIdRef.current = gameId;
      previousHandRef.current = myHand;
      previousBattlefieldRef.current = myBattlefield.map(bf => bf.cardId);
      return;
    }
    
    const currentHand = myHand;
    const previousHand = previousHandRef.current || [];
    const newCards = currentHand.filter(id => !previousHand.includes(id));
    if (newCards.length > 0) {
      setNewlyDrawnCards(new Set(newCards));
      const timer = setTimeout(() => setNewlyDrawnCards(new Set()), 500);
      previousHandRef.current = currentHand;
      return () => clearTimeout(timer);
    }
    previousHandRef.current = currentHand;
  }, [myHand, game, gameId]);

  useEffect(() => {
    if (!game || !gameId) return;
    if (lastGameIdRef.current !== gameId) return;
    
    const currentBattlefield = myBattlefield.map(bf => bf.cardId);
    const previousBattlefield = previousBattlefieldRef.current || [];
    const newDeployed = currentBattlefield.filter(id => !previousBattlefield.includes(id));
    if (newDeployed.length > 0) {
      setNewlyDeployedCards(new Set(newDeployed));
      const timer = setTimeout(() => setNewlyDeployedCards(new Set()), 600);
      previousBattlefieldRef.current = currentBattlefield;
      return () => clearTimeout(timer);
    }
    previousBattlefieldRef.current = currentBattlefield;
  }, [myBattlefield, game, gameId]);

  useEffect(() => {
    if (!game) return;
    setUsedAbilitiesThisTurn(new Set());
  }, [game?.currentTurn]);

  useEffect(() => {
    if (!game || !gameId) return;
    if (game.gameType !== "practice") return;
    if (game.status === "completed") return;
    
    const isAITurn = game.activePlayer === "player-ai";
    if (!isAITurn) return;
    
    const phaseKey = `${game.currentTurn}-${game.currentPhase}`;
    if (aiExecutingRef.current === phaseKey) return;
    if (updateGameMutation.isPending) return;
    
    aiExecutingRef.current = phaseKey;
    
    const aiDifficulty = game.aiDifficulty || "medium";
    
    const executeAITurn = async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      await delay(800);
      
      if (game.currentPhase === "draw") {
        const aiDeck = [...game.gameState.player2Deck];
        const aiHand = [...game.gameState.player2Hand];
        
        if (aiDeck.length < cardsToDraw) {
          updateGameMutation.mutate({
            status: "completed",
            winnerId: game.player1Id,
          });
          return;
        }
        
        for (let i = 0; i < cardsToDraw; i++) {
          aiHand.push(aiDeck.shift()!);
        }
        
        const newGameState = { 
          ...game.gameState,
          player2Hand: aiHand,
          player2Deck: aiDeck,
          player1Battlefield: [],
          player2Battlefield: [],
        };
        
        updateGameMutation.mutate({
          currentPhase: "deployment",
          gameState: newGameState,
        });
      } else if (game.currentPhase === "deployment") {
        const aiHand = [...game.gameState.player2Hand];
        
        if (aiHand.length < cardsToDeploy) {
          updateGameMutation.mutate({
            status: "completed",
            winnerId: game.player1Id,
          });
          return;
        }
        
        let selectedCardIds: string[] = [];
        
        if (aiDifficulty === "easy") {
          const shuffled = [...aiHand].sort(() => Math.random() - 0.5);
          selectedCardIds = shuffled.slice(0, cardsToDeploy);
        } else if (aiDifficulty === "medium") {
          const cardsWithPower = aiHand.map(cardId => {
            const baseCardId = getCardIdFromInstance(cardId);
            const card = allCards.find(c => c.id === baseCardId);
            return { cardId, power: card?.power || 0 };
          });
          cardsWithPower.sort((a, b) => b.power - a.power);
          selectedCardIds = cardsWithPower.slice(0, cardsToDeploy).map(c => c.cardId);
        } else {
          const cardsWithPower = aiHand.map(cardId => {
            const baseCardId = getCardIdFromInstance(cardId);
            const card = allCards.find(c => c.id === baseCardId);
            return { cardId, power: card?.power || 0 };
          });
          const mid = Math.floor(cardsWithPower.length / 2);
          cardsWithPower.sort((a, b) => b.power - a.power);
          const topCards = cardsWithPower.slice(0, mid);
          const bottomCards = cardsWithPower.slice(mid);
          
          if (topCards.length > 0 && bottomCards.length > 0) {
            // Mix high and low power cards based on cardsToDeploy
            const numFromTop = Math.ceil(cardsToDeploy / 2);
            const numFromBottom = cardsToDeploy - numFromTop;
            const selectedTop = topCards.slice(0, numFromTop).map(c => c.cardId);
            const shuffledBottom = [...bottomCards].sort(() => Math.random() - 0.5);
            const selectedBottom = shuffledBottom.slice(0, numFromBottom).map(c => c.cardId);
            selectedCardIds = [...selectedTop, ...selectedBottom];
          } else {
            selectedCardIds = cardsWithPower.slice(0, cardsToDeploy).map(c => c.cardId);
          }
        }
        
        const newHand = aiHand.filter(id => !selectedCardIds.includes(id));
        const newBattlefield: BattlefieldCard[] = selectedCardIds.map(cardId => ({
          cardId,
          faceDown: true,
        }));
        
        const newGameState = {
          ...game.gameState,
          player2Hand: newHand,
          player2Battlefield: newBattlefield,
        };
        
        const playerBF = game.gameState.player1Battlefield;
        const nextPhase = playerBF.length === cardsToDeploy ? "combat" : "deployment";
        
        updateGameMutation.mutate({
          currentPhase: nextPhase,
          gameState: newGameState,
          activePlayer: nextPhase === "deployment" ? game.player1Id : "player-ai",
        });
      } else if (game.currentPhase === "combat") {
        const aiCommanderId = game.gameState.player2CommanderId;
        const aiCommander = aiCommanderId ? allCommanders.find(c => c.id === aiCommanderId) : undefined;
        if (aiCommander) {
          const aiVP = game.player2VictoryPoints;
          const aiWP = game.player2WithdrawalPoints;
          const combatAbilities = aiCommander.abilities.filter(a => 
            a.phase === game.currentPhase && 
            aiVP >= a.victoryCost && 
            aiWP >= a.withdrawalCost
          );
          if (combatAbilities.length > 0) {
            const ability = combatAbilities[0];
            const newVP = aiVP - ability.victoryCost;
            const newWP = aiWP - ability.withdrawalCost;
            const updatedGameState = { ...game.gameState };
            const aiEffect = ability.effect;
            let aiEffectDesc = `AI used ${ability.name}: ${ability.description}`;
            
            switch (aiEffect.type) {
              case "buff_element_unit": {
                const bv = aiEffect.value || 4;
                const te = (aiEffect.target || aiCommander.element).toLowerCase();
                const cb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...cb, { targetElement: te, amount: bv, type: "buff" }];
                aiEffectDesc = `AI buffed ${te} units with +${bv} power!`;
                break;
              }
              case "debuff_enemy": {
                const dv = aiEffect.value || 3;
                const ob = updatedGameState.player1AbilityBuffs || [];
                updatedGameState.player1AbilityBuffs = [...ob, { targetElement: "all", amount: -dv, type: "debuff" }];
                aiEffectDesc = `AI debuffed your units by -${dv} power!`;
                break;
              }
              case "block_effects":
                updatedGameState.player1BlockedEffects = true;
                aiEffectDesc = `AI blocked your card effects this combat!`;
                break;
              case "negate_and_halve":
                updatedGameState.player2NegateAndHalve = true;
                aiEffectDesc = `AI negated your effects and halved your non-matching units!`;
                break;
              case "protect_element": {
                const pe = (aiEffect.target || aiCommander.element).toLowerCase();
                updatedGameState.player2ProtectedElement = pe;
                aiEffectDesc = `AI protected ${pe} units from debuffs!`;
                break;
              }
              case "healing_factor": {
                const hv = aiEffect.value || 4;
                const ht = (aiEffect.target || aiCommander.element).toLowerCase();
                const hb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...hb, { targetElement: ht, amount: hv, type: "heal" }];
                aiEffectDesc = `AI applied +${hv} healing factor to ${ht} units!`;
                break;
              }
              case "growth_buff": {
                const gv = aiEffect.value || 2;
                const gt = (aiEffect.target || aiCommander.element).toLowerCase();
                const gb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...gb, { targetElement: gt, amount: gv, type: "growth" }];
                aiEffectDesc = `AI applied +${gv} growth buff to ${gt} units!`;
                break;
              }
              case "prevent_ward": {
                const pe2 = (aiEffect.target || aiCommander.element).toLowerCase();
                updatedGameState.player2ProtectedElement = pe2;
                aiEffectDesc = `AI protected ${pe2} units from the medical ward!`;
                break;
              }
              case "destroy_unit": {
                const p1BF = [...updatedGameState.player1Battlefield];
                const p1Yard = [...updatedGameState.player1Yard];
                const nonElTargets = p1BF.filter(bf => {
                  const c = getCardById(bf.cardId);
                  return c && c.element.toLowerCase() !== aiCommander.element.toLowerCase();
                });
                if (nonElTargets.length > 0) {
                  const t = nonElTargets[0];
                  const tc = getCardById(t.cardId);
                  updatedGameState.player1Battlefield = p1BF.filter(bf => bf.cardId !== t.cardId);
                  p1Yard.push(t.cardId);
                  updatedGameState.player1Yard = p1Yard;
                  aiEffectDesc = `AI destroyed ${tc?.name || 'your unit'}!`;
                }
                break;
              }
              case "add_shield": {
                const sv = aiEffect.value || 4;
                const st = (aiEffect.target || aiCommander.element).toLowerCase();
                const sb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...sb, { targetElement: st, amount: sv, type: "shield" }];
                aiEffectDesc = `AI added +${sv} shield to ${st} units!`;
                break;
              }
              case "reduce_power": {
                const rv = aiEffect.value || 4;
                const rb = updatedGameState.player1AbilityBuffs || [];
                updatedGameState.player1AbilityBuffs = [...rb, { targetElement: "all", amount: -rv, type: "reduce" }];
                aiEffectDesc = `AI reduced your units' power by ${rv}!`;
                break;
              }
              case "first_strike": {
                const fsValue = aiEffect.value || 3;
                const ft = (aiEffect.target || aiCommander.element).toLowerCase();
                const fb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...fb, { targetElement: ft, amount: fsValue, type: "first_strike" }];
                aiEffectDesc = `AI's ${aiCommander.element} units attack first with +${fsValue}!`;
                break;
              }
              case "add_evasion": {
                const ev = aiEffect.value || 4;
                const et = (aiEffect.target || aiCommander.element).toLowerCase();
                const eb = updatedGameState.player2AbilityBuffs || [];
                updatedGameState.player2AbilityBuffs = [...eb, { targetElement: et, amount: ev, type: "shield" }];
                aiEffectDesc = `AI added +${ev} shield to ${et} units!`;
                break;
              }
              case "set_power": {
                const spv = aiEffect.value || 1;
                const p1BF2 = [...updatedGameState.player1Battlefield];
                const nonEl2 = p1BF2.filter(bf => {
                  const c = getCardById(bf.cardId);
                  return c && c.element.toLowerCase() !== aiCommander.element.toLowerCase();
                });
                if (nonEl2.length > 0) {
                  const t2 = nonEl2[0];
                  const tc2 = getCardById(t2.cardId);
                  updatedGameState.player1Battlefield = p1BF2.map(bf => 
                    bf.cardId === t2.cardId ? { ...bf, modifiedPower: spv } : bf
                  );
                  aiEffectDesc = `AI reduced ${tc2?.name || 'your unit'}'s power to ${spv}!`;
                }
                break;
              }
            }
            
            const abilityLog = [...(updatedGameState.abilityLog || [])];
            abilityLog.push({
              turn: game.currentTurn,
              phase: game.currentPhase,
              playerId: "player-ai",
              abilityId: ability.id,
              abilityName: ability.name,
              commanderName: aiCommander.name,
              victoryCost: ability.victoryCost,
              withdrawalCost: ability.withdrawalCost,
              effectDescription: aiEffectDesc,
            });
            updatedGameState.abilityLog = abilityLog;
            
            updateGameMutation.mutate({
              player2VictoryPoints: newVP,
              player2WithdrawalPoints: newWP,
              gameState: updatedGameState,
            });
            toast({ title: aiEffectDesc });
          }
        }
        return;
      } else if (game.currentPhase === "calculation") {
        const p1Cards = mapBattlefieldToCards(game.gameState.player1Battlefield, getCardById);
        const p2Cards = mapBattlefieldToCards(game.gameState.player2Battlefield, getCardById);
        
        const gs = game.gameState;
        const player1Breakdown = calculateBattlePower(
          p1Cards, p2Cards, getCardById,
          gs.player1AbilityBuffs, gs.player1BlockedEffects, gs.player2NegateAndHalve, gs.player1ProtectedElement
        );
        const player2Breakdown = calculateBattlePower(
          p2Cards, p1Cards, getCardById,
          gs.player2AbilityBuffs, gs.player2BlockedEffects, gs.player1NegateAndHalve, gs.player2ProtectedElement
        );
        
        const p1Power = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
        const p2Power = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
        
        const damage = Math.abs(p1Power - p2Power);
        let newP1HP = game.player1HP;
        let newP2HP = game.player2HP;
        let newP1VP = game.player1VictoryPoints;
        let newP2VP = game.player2VictoryPoints;
        let newP1WP = game.player1WithdrawalPoints;
        let newP2WP = game.player2WithdrawalPoints;
        
        if (p1Power > p2Power) {
          newP2HP -= damage;
          newP1VP += 1;
          newP2WP += 1;
          toast({ title: `You win the round! ${damage} damage dealt.` });
        } else if (p2Power > p1Power) {
          newP1HP -= damage;
          newP2VP += 1;
          newP1WP += 1;
          toast({ title: `AI wins the round! ${damage} damage dealt.`, variant: "destructive" });
        } else {
          toast({ title: "Draw! No damage dealt." });
        }
        
        const p1Yard = [...game.gameState.player1Yard, ...game.gameState.player1Battlefield.map(bf => bf.cardId)];
        const p2Yard = [...game.gameState.player2Yard, ...game.gameState.player2Battlefield.map(bf => bf.cardId)];
        
        const mapBreakdownToSchema = (breakdowns: CardPowerBreakdown[]) => breakdowns.map(b => ({
          cardId: b.card.id,
          cardName: b.card.name,
          basePower: b.basePower,
          buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
          debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
          finalPower: b.finalPower,
          traitName: b.traitInfo?.trait,
          traitValue: b.traitInfo?.value,
        }));
        
        const combatLog = {
          player1Cards: mapBreakdownToSchema(player1Breakdown),
          player2Cards: mapBreakdownToSchema(player2Breakdown),
          player1Total: p1Power,
          player2Total: p2Power,
          damage,
          winner: p1Power > p2Power ? "player1" as const : p2Power > p1Power ? "player2" as const : "tie" as const,
          turn: game.currentTurn,
        };
        
        const newGameState = {
          ...game.gameState,
          player1Battlefield: [],
          player2Battlefield: [],
          player1Yard: p1Yard,
          player2Yard: p2Yard,
          lastCombatLog: combatLog,
          combatHistory: [...(game.gameState.combatHistory || []), combatLog],
          player1AbilityBuffs: [],
          player2AbilityBuffs: [],
          player1ExtraDeploy: 0,
          player2ExtraDeploy: 0,
          player1BlockedEffects: false,
          player2BlockedEffects: false,
          player1NegateAndHalve: false,
          player2NegateAndHalve: false,
          player1ProtectedElement: undefined,
          player2ProtectedElement: undefined,
        };
        
        let status = game.status;
        let winnerId = game.winnerId;
        
        if (newP1HP <= 0) {
          status = "completed";
          winnerId = game.player2Id;
        } else if (newP2HP <= 0) {
          status = "completed";
          winnerId = game.player1Id;
        }
        
        updateGameMutation.mutate({
          currentPhase: "end",
          currentTurn: game.currentTurn + 1,
          player1HP: newP1HP,
          player2HP: newP2HP,
          player1VictoryPoints: newP1VP,
          player2VictoryPoints: newP2VP,
          player1WithdrawalPoints: newP1WP,
          player2WithdrawalPoints: newP2WP,
          gameState: newGameState,
          status,
          winnerId,
        });
      } else if (game.currentPhase === "end") {
        updateGameMutation.mutate({
          currentPhase: "draw",
          activePlayer: game.player1Id,
        });
      }
    };
    
    executeAITurn();
  }, [game, gameId, allCards, allCommanders, updateGameMutation, updateGameMutation.isPending, toast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (combatTimerRef.current) {
        clearInterval(combatTimerRef.current);
      }
      if (combatPhaseTimerRef.current) {
        clearInterval(combatPhaseTimerRef.current);
      }
    };
  }, []);

  // Start 30-second combat phase timer in practice mode when entering combat phase
  useEffect(() => {
    const isPractice = game?.gameType === "practice";
    const isInCombatPhase = game?.currentPhase === "combat";
    
    if (isPractice && isInCombatPhase && !combatPhaseTimerActive) {
      // Start the 30-second countdown
      setCombatPhaseTimer(30);
      setCombatPhaseTimerActive(true);
      
      if (combatPhaseTimerRef.current) {
        clearInterval(combatPhaseTimerRef.current);
      }
      
      combatPhaseTimerRef.current = setInterval(() => {
        setCombatPhaseTimer(prev => {
          if (prev <= 1) {
            if (combatPhaseTimerRef.current) {
              clearInterval(combatPhaseTimerRef.current);
              combatPhaseTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    // Reset timer state when leaving combat phase
    if (!isInCombatPhase && combatPhaseTimerActive) {
      setCombatPhaseTimerActive(false);
      if (combatPhaseTimerRef.current) {
        clearInterval(combatPhaseTimerRef.current);
        combatPhaseTimerRef.current = null;
      }
    }
  }, [game?.gameType, game?.currentPhase, combatPhaseTimerActive]);

  // Ref to hold the handleCalculation function (defined after loading check)
  const handleCalculationRef = useRef<(() => void) | null>(null);
  
  // Ref to hold the handleCombat function for auto-advance when timer expires
  const handleCombatRef = useRef<(() => void) | null>(null);
  
  // When combat phase timer expires in practice mode, auto-reveal cards
  useEffect(() => {
    const isPractice = game?.gameType === "practice";
    const isInCombatPhase = game?.currentPhase === "combat";
    
    if (isPractice && combatPhaseTimer === 0 && combatPhaseTimerActive && isInCombatPhase) {
      // Timer expired - clear state and trigger reveal
      setCombatPhaseTimerActive(false);
      if (handleCombatRef.current) {
        handleCombatRef.current();
      }
    }
  }, [combatPhaseTimer, combatPhaseTimerActive, game?.gameType, game?.currentPhase]);
  
  // State for triggering auto-advance after timer expires
  const [pendingCalculation, setPendingCalculation] = useState(false);
  
  // When timer expires, set pending calculation flag
  useEffect(() => {
    if (combatTimer === 0 && showCombatResults && combatBreakdown && game?.currentPhase === "calculation") {
      setShowCombatResults(false);
      setPendingCalculation(true);
    }
  }, [combatTimer, showCombatResults, combatBreakdown, game?.currentPhase]);
  
  // Handle pending calculation by calling handleCalculation via ref
  useEffect(() => {
    if (pendingCalculation && handleCalculationRef.current) {
      setPendingCalculation(false);
      handleCalculationRef.current();
    }
  }, [pendingCalculation]);

  if (isLoading || !game) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleActivateAbility = (ability: CommanderAbility) => {
    if (!game || !myCommander) return;

    if (isMultiplayer && gameId) {
      const currentPhase = useServerState ? serverState.currentPhase : game.currentPhase;
      if (ability.phase !== currentPhase) {
        toast({ title: `This ability can only be used during ${ability.phase} phase`, variant: "destructive" });
        return;
      }
      if (myVP < ability.victoryCost || myWP < ability.withdrawalCost) {
        toast({ title: "Not enough points to use this ability!", variant: "destructive" });
        return;
      }
      sendGameAction(gameId, "use_ability", { abilityId: ability.id });
      toast({ title: `Used ${ability.name}!` });
      return;
    }

    if (!isMyTurn && !isMultiplayer) return;
    if (ability.phase !== effectivePhase) {
      toast({ title: `This ability can only be used during ${ability.phase} phase`, variant: "destructive" });
      return;
    }
    
    const currentVP = myVP;
    const currentWP = myWP;
    
    if (currentVP < ability.victoryCost || currentWP < ability.withdrawalCost) {
      toast({ title: "Not enough points to use this ability!", variant: "destructive" });
      return;
    }
    
    const newVP = currentVP - ability.victoryCost;
    const newWP = currentWP - ability.withdrawalCost;
    
    const newGameState = { ...game.gameState };
    let effectDescription = "";
    
    const effect = ability.effect;
    const myHandKey = isPlayer1 ? 'player1Hand' : 'player2Hand';
    const myDeckKey = isPlayer1 ? 'player1Deck' : 'player2Deck';
    const myBFKey = isPlayer1 ? 'player1Battlefield' : 'player2Battlefield';
    
    const myBuffsKey = isPlayer1 ? 'player1AbilityBuffs' : 'player2AbilityBuffs';
    const oppBuffsKey = isPlayer1 ? 'player2AbilityBuffs' : 'player1AbilityBuffs';
    const myExtraDeployKey = isPlayer1 ? 'player1ExtraDeploy' : 'player2ExtraDeploy';
    const myBlockedKey = isPlayer1 ? 'player1BlockedEffects' : 'player2BlockedEffects';
    const oppBlockedKey = isPlayer1 ? 'player2BlockedEffects' : 'player1BlockedEffects';
    const myNegateKey = isPlayer1 ? 'player1NegateAndHalve' : 'player2NegateAndHalve';
    const myProtectKey = isPlayer1 ? 'player1ProtectedElement' : 'player2ProtectedElement';

    switch (effect.type) {
      case "direct_damage": {
        const dmg = effect.value || 4;
        effectDescription = `Dealt ${dmg} direct damage to opponent!`;
        break;
      }
      case "element_power_damage": {
        const elementCards = (newGameState[myBFKey] as BattlefieldCard[])
          .map(bf => getCardById(bf.cardId))
          .filter(c => c && c.element === myCommander.element);
        const totalPower = elementCards.reduce((sum, c) => sum + (c?.power || 0), 0);
        effectDescription = `Dealt ${totalPower} damage (total ${myCommander.element} power) to opponent!`;
        break;
      }
      case "buff_element_unit": {
        const buffValue = effect.value || 4;
        const targetEl = (effect.target || myCommander.element).toLowerCase();
        const currentBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentBuffs, { targetElement: targetEl, amount: buffValue, type: "buff" }];
        effectDescription = `Buffed ${targetEl} units with +${buffValue} power this battle!`;
        break;
      }
      case "extra_deploy": {
        const current = ((newGameState as any)[myExtraDeployKey] as number) || 0;
        (newGameState as any)[myExtraDeployKey] = current + (effect.value || 1);
        effectDescription = `Can deploy ${effect.value || 1} extra ${effect.target} unit this turn!`;
        break;
      }
      case "cycle_element_cards": {
        const cycleHand = [...(newGameState[myHandKey] as string[])];
        const elementName = effect.target || myCommander.element.toLowerCase();
        const elementCards = cycleHand.filter(cardId => {
          const card = getCardById(cardId);
          return card && card.element.toLowerCase() === elementName.toLowerCase();
        });
        const count = elementCards.length;
        const remainingHand = cycleHand.filter(id => !elementCards.includes(id));
        const cycleDeck = [...(newGameState[myDeckKey] as string[]), ...elementCards];
        for (let i = cycleDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cycleDeck[i], cycleDeck[j]] = [cycleDeck[j], cycleDeck[i]];
        }
        const drawn = cycleDeck.splice(0, Math.min(count, cycleDeck.length));
        (newGameState as any)[myHandKey] = [...remainingHand, ...drawn];
        (newGameState as any)[myDeckKey] = cycleDeck;
        effectDescription = `Cycled ${count} ${elementName} cards from hand into deck, drew ${drawn.length} new cards!`;
        break;
      }
      case "block_effects": {
        (newGameState as any)[oppBlockedKey] = true;
        effectDescription = `Blocked effects of enemy non-${myCommander.element} units this combat!`;
        break;
      }
      case "negate_and_halve": {
        (newGameState as any)[myNegateKey] = true;
        effectDescription = `Negated all enemy effects and halved non-${myCommander.element} enemy strength!`;
        break;
      }
      case "healing_factor": {
        const healValue = effect.value || 4;
        const targetEl2 = (effect.target || myCommander.element).toLowerCase();
        const currentBuffs2 = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentBuffs2, { targetElement: targetEl2, amount: healValue, type: "heal" }];
        effectDescription = `Applied +${healValue} healing factor to ${targetEl2} units!`;
        break;
      }
      case "draw_cards": {
        const drawCount = effect.value || 2;
        const drawDeck = [...(newGameState[myDeckKey] as string[])];
        const drawHand = [...(newGameState[myHandKey] as string[])];
        const actualDraw = Math.min(drawCount, drawDeck.length);
        for (let i = 0; i < actualDraw; i++) {
          drawHand.push(drawDeck.shift()!);
        }
        (newGameState as any)[myHandKey] = drawHand;
        (newGameState as any)[myDeckKey] = drawDeck;
        effectDescription = `Drew ${actualDraw} extra cards!`;
        break;
      }
      case "protect_element": {
        const protectEl = (effect.target || myCommander.element).toLowerCase();
        (newGameState as any)[myProtectKey] = protectEl;
        effectDescription = `Protected ${protectEl} units from damage this combat!`;
        break;
      }
      case "debuff_enemy": {
        const debuffValue = effect.value || 3;
        const currentOppBuffs = (newGameState as any)[oppBuffsKey] || [];
        (newGameState as any)[oppBuffsKey] = [...currentOppBuffs, { targetElement: "all", amount: -debuffValue, type: "debuff" }];
        effectDescription = `Debuffed all enemy units by -${debuffValue} power!`;
        break;
      }
      case "swap_units": {
        const swapBF = [...(newGameState[myBFKey] as BattlefieldCard[])];
        const swapHand = [...(newGameState[myHandKey] as string[])];
        if (swapBF.length > 0 && swapHand.length > 0) {
          const removedBF = swapBF.pop()!;
          const addedFromHand = swapHand.pop()!;
          swapHand.push(removedBF.cardId);
          swapBF.push({ cardId: addedFromHand, faceDown: true });
          (newGameState as any)[myBFKey] = swapBF;
          (newGameState as any)[myHandKey] = swapHand;
          const swappedOut = getCardById(removedBF.cardId);
          const swappedIn = getCardById(addedFromHand);
          effectDescription = `Swapped ${swappedOut?.name || 'unit'} with ${swappedIn?.name || 'unit'} from hand!`;
        } else {
          effectDescription = `No units available to swap!`;
        }
        break;
      }
      case "revive_unit": {
        const myYardKey = isPlayer1 ? 'player1Yard' : 'player2Yard';
        const yard = [...(newGameState[myYardKey] as string[])];
        const reviveHand = [...(newGameState[myHandKey] as string[])];
        if (yard.length > 0) {
          const revived = yard.pop()!;
          reviveHand.push(revived);
          (newGameState as any)[myYardKey] = yard;
          (newGameState as any)[myHandKey] = reviveHand;
          const revivedCard = getCardById(revived);
          effectDescription = `Revived ${revivedCard?.name || 'a unit'} from the discard pile!`;
        } else {
          effectDescription = `No units in discard pile to revive!`;
        }
        break;
      }
      case "growth_buff": {
        const growthValue = effect.value || 2;
        const growthEl = (effect.target || myCommander.element).toLowerCase();
        const currentGrowthBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentGrowthBuffs, { targetElement: growthEl, amount: growthValue, type: "growth" }];
        effectDescription = `Applied +${growthValue} growth buff to ${growthEl} units!`;
        break;
      }
      case "prevent_ward": {
        const protEl = (effect.target || myCommander.element).toLowerCase();
        (newGameState as any)[myProtectKey] = protEl;
        effectDescription = `Protected ${protEl} units from going to the medical ward this turn!`;
        break;
      }
      case "destroy_unit": {
        const oppBFKey = isPlayer1 ? 'player2Battlefield' : 'player1Battlefield';
        const oppYardKey = isPlayer1 ? 'player2Yard' : 'player1Yard';
        const oppBF = [...(newGameState[oppBFKey] as BattlefieldCard[])];
        const oppYard = [...(newGameState[oppYardKey] as string[])];
        const nonElementCards = oppBF.filter(bf => {
          const c = getCardById(bf.cardId);
          return c && c.element.toLowerCase() !== myCommander.element.toLowerCase();
        });
        if (nonElementCards.length > 0) {
          const target = nonElementCards[0];
          const targetCard = getCardById(target.cardId);
          const newOppBF = oppBF.filter(bf => bf.cardId !== target.cardId);
          oppYard.push(target.cardId);
          (newGameState as any)[oppBFKey] = newOppBF;
          (newGameState as any)[oppYardKey] = oppYard;
          effectDescription = `Destroyed ${targetCard?.name || 'enemy unit'} and sent it to the medical ward!`;
        } else {
          effectDescription = `No valid enemy units to destroy!`;
        }
        break;
      }
      case "add_shield": {
        const shieldValue = effect.value || 4;
        const shieldEl = (effect.target || myCommander.element).toLowerCase();
        const currentShieldBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentShieldBuffs, { targetElement: shieldEl, amount: shieldValue, type: "shield" }];
        effectDescription = `Added +${shieldValue} shield to ${shieldEl} units!`;
        break;
      }
      case "reduce_power": {
        const reduceValue = effect.value || 4;
        const currentReduceDebuffs = (newGameState as any)[oppBuffsKey] || [];
        const oppElement = myCommander.element.toLowerCase();
        (newGameState as any)[oppBuffsKey] = [...currentReduceDebuffs, { targetElement: "all_non_" + oppElement, amount: -reduceValue, type: "reduce" }];
        effectDescription = `Reduced a non-${myCommander.element} enemy unit's power by ${reduceValue}!`;
        break;
      }
      case "first_strike": {
        const fsValue = effect.value || 3;
        const fsEl = (effect.target || myCommander.element).toLowerCase();
        const currentFSBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentFSBuffs, { targetElement: fsEl, amount: fsValue, type: "first_strike" }];
        effectDescription = `${myCommander.element} units attack first with +${fsValue} power bonus!`;
        break;
      }
      case "add_evasion": {
        const shieldValue = effect.value || 4;
        const shieldEl = (effect.target || myCommander.element).toLowerCase();
        const currentShieldBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentShieldBuffs, { targetElement: shieldEl, amount: shieldValue, type: "shield" }];
        effectDescription = `Added +${shieldValue} shield to ${shieldEl} units!`;
        break;
      }
      case "set_power": {
        const setPowerValue = effect.value || 1;
        const oppBFKey2 = isPlayer1 ? 'player2Battlefield' : 'player1Battlefield';
        const oppBF2 = [...(newGameState[oppBFKey2] as BattlefieldCard[])];
        const nonElCards = oppBF2.filter(bf => {
          const c = getCardById(bf.cardId);
          return c && c.element.toLowerCase() !== myCommander.element.toLowerCase();
        });
        if (nonElCards.length > 0) {
          const target = nonElCards[0];
          const targetCard = getCardById(target.cardId);
          const newBF = oppBF2.map(bf => {
            if (bf.cardId === target.cardId) {
              return { ...bf, modifiedPower: setPowerValue };
            }
            return bf;
          });
          (newGameState as any)[oppBFKey2] = newBF;
          effectDescription = `Reduced ${targetCard?.name || 'enemy unit'}'s power to ${setPowerValue}!`;
        } else {
          effectDescription = `No valid enemy units to target!`;
        }
        break;
      }
      case "restore_from_ward": {
        const restoreCount = effect.value || 3;
        const myYardKey2 = isPlayer1 ? 'player1Yard' : 'player2Yard';
        const yard2 = [...(newGameState[myYardKey2] as string[])];
        const myDeck2 = [...(newGameState[myDeckKey] as string[])];
        const toRestore = Math.min(restoreCount, yard2.length);
        for (let i = 0; i < toRestore; i++) {
          const restored = yard2.pop()!;
          myDeck2.push(restored);
        }
        for (let i = myDeck2.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [myDeck2[i], myDeck2[j]] = [myDeck2[j], myDeck2[i]];
        }
        (newGameState as any)[myYardKey2] = yard2;
        (newGameState as any)[myDeckKey] = myDeck2;
        effectDescription = `Returned ${toRestore} unit(s) from medical ward to deck!`;
        break;
      }
      case "heal_and_buff": {
        const healAmount = effect.value || 4;
        const healBuffEl = (effect.target || myCommander.element).toLowerCase();
        const currentHealBuffs = (newGameState as any)[myBuffsKey] || [];
        (newGameState as any)[myBuffsKey] = [...currentHealBuffs, { targetElement: healBuffEl, amount: 2, type: "heal_buff" }];
        effectDescription = `Healed ${healAmount} HP and buffed ${healBuffEl} units with +2 power!`;
        break;
      }
      default:
        effectDescription = `Used ability: ${ability.name}`;
    }
    
    const abilityLogEntry = {
      turn: effectiveTurn,
      phase: effectivePhase,
      playerId: user?.id || "",
      abilityId: ability.id,
      abilityName: ability.name,
      commanderName: myCommander.name,
      victoryCost: ability.victoryCost,
      withdrawalCost: ability.withdrawalCost,
      effectDescription,
    };
    
    newGameState.abilityLog = [...(newGameState.abilityLog || []), abilityLogEntry];
    
    const updates: Partial<Game> = {
      gameState: newGameState,
    };
    
    if (isPlayer1) {
      updates.player1VictoryPoints = newVP;
      updates.player1WithdrawalPoints = newWP;
    } else {
      updates.player2VictoryPoints = newVP;
      updates.player2WithdrawalPoints = newWP;
    }
    
    if (effect.type === "direct_damage") {
      const dmg = effect.value || 4;
      if (isPlayer1) {
        updates.player2HP = game.player2HP - dmg;
      } else {
        updates.player1HP = game.player1HP - dmg;
      }
    }
    if (effect.type === "element_power_damage") {
      const elementCards = (newGameState[myBFKey] as BattlefieldCard[])
        .map(bf => getCardById(bf.cardId))
        .filter(c => c && c.element === myCommander.element);
      const totalPower = elementCards.reduce((sum, c) => sum + (c?.power || 0), 0);
      if (isPlayer1) {
        updates.player2HP = game.player2HP - totalPower;
      } else {
        updates.player1HP = game.player1HP - totalPower;
      }
    }
    if (effect.type === "heal_and_buff") {
      const healHP = effect.value || 4;
      if (isPlayer1) {
        updates.player1HP = Math.min(30, game.player1HP + healHP);
      } else {
        updates.player2HP = Math.min(30, game.player2HP + healHP);
      }
    }
    
    updateGameMutation.mutate(updates);
    setUsedAbilitiesThisTurn(prev => { const next = new Set(Array.from(prev)); next.add(ability.id); return next; });
    toast({ title: `${ability.name}: ${effectDescription}` });
  };

  const handleCardSelect = (cardId: string) => {
    if (effectivePhase !== "deployment" || (!isMyTurn && !isMultiplayer)) return;
    
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId));
    } else if (selectedCards.length < cardsToDeploy) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleDraw = () => {
    const currentPhase = useServerState ? serverState.currentPhase : game.currentPhase;
    if (currentPhase !== "draw") return;

    if (isMultiplayer && gameId) {
      if (useServerState && serverState.myHasDrawn) {
        toast({ title: "You already drew this turn!", variant: "destructive" });
        return;
      }
      sendGameAction(gameId, "draw", {});
      toast({ title: `Drawing cards...` });
      return;
    }

    if (!isMyTurn) return;

    const myDeck = isPlayer1 ? [...game.gameState.player1Deck] : [...game.gameState.player2Deck];
    const myNewHand = [...myHand];
    
    if (myDeck.length < cardsToDraw) {
      toast({ title: "Not enough cards to draw!", variant: "destructive" });
      return;
    }

    for (let i = 0; i < cardsToDraw; i++) {
      myNewHand.push(myDeck.shift()!);
    }

    const newGameState = { ...game.gameState };
    if (isPlayer1) {
      newGameState.player1Hand = myNewHand;
      newGameState.player1Deck = myDeck;
      newGameState.player1Battlefield = [];
      newGameState.player2Battlefield = [];
    } else {
      newGameState.player2Hand = myNewHand;
      newGameState.player2Deck = myDeck;
      newGameState.player1Battlefield = [];
      newGameState.player2Battlefield = [];
    }

    const isPractice = game.gameType === "practice";
    if (isPractice) {
      const aiDeck = [...newGameState.player2Deck];
      const aiHand = [...newGameState.player2Hand];
      
      if (aiDeck.length >= cardsToDraw) {
        for (let i = 0; i < cardsToDraw; i++) {
          aiHand.push(aiDeck.shift()!);
        }
        newGameState.player2Hand = aiHand;
        newGameState.player2Deck = aiDeck;
      }
    }

    updateGameMutation.mutate({
      currentPhase: "deployment",
      gameState: newGameState,
    });
    toast({ title: `Drew ${cardsToDraw} cards!` });
  };

  const handleDeploy = () => {
    if (selectedCards.length !== cardsToDeploy) {
      toast({ title: `Select ${cardsToDeploy} cards to deploy`, variant: "destructive" });
      return;
    }

    if (isMultiplayer && gameId) {
      sendGameAction(gameId, "deploy", { cardIds: selectedCards });
      setSelectedCards([]);
      setWaitingForOpponent(true);
      toast({ title: "Cards deployed! Waiting for opponent..." });
      return;
    }

    const newHand = myHand.filter((id) => !selectedCards.includes(id));
    const newBattlefield: BattlefieldCard[] = selectedCards.map((cardId) => ({
      cardId,
      faceDown: true,
    }));

    const newGameState = { ...game.gameState };
    if (isPlayer1) {
      newGameState.player1Hand = newHand;
      newGameState.player1Battlefield = newBattlefield;
    } else {
      newGameState.player2Hand = newHand;
      newGameState.player2Battlefield = newBattlefield;
    }

    const isPractice = game.gameType === "practice";
    
    if (isPractice && isPlayer1) {
      const aiHand = [...newGameState.player2Hand];
      const aiDifficulty = game.aiDifficulty || "medium";
      
      if (aiHand.length >= cardsToDeploy) {
        let aiSelectedCards: string[] = [];
        
        if (aiDifficulty === "easy") {
          const shuffled = [...aiHand].sort(() => Math.random() - 0.5);
          aiSelectedCards = shuffled.slice(0, cardsToDeploy);
        } else if (aiDifficulty === "medium") {
          const cardsWithPower = aiHand.map(cardId => {
            const baseCardId = getCardIdFromInstance(cardId);
            const card = allCards.find(c => c.id === baseCardId);
            return { cardId, power: card?.power || 0 };
          });
          cardsWithPower.sort((a, b) => b.power - a.power);
          aiSelectedCards = cardsWithPower.slice(0, cardsToDeploy).map(c => c.cardId);
        } else {
          const cardsWithPower = aiHand.map(cardId => {
            const baseCardId = getCardIdFromInstance(cardId);
            const card = allCards.find(c => c.id === baseCardId);
            return { cardId, power: card?.power || 0 };
          });
          const mid = Math.floor(cardsWithPower.length / 2);
          cardsWithPower.sort((a, b) => b.power - a.power);
          const topCards = cardsWithPower.slice(0, mid);
          const bottomCards = cardsWithPower.slice(mid);
          
          if (topCards.length > 0 && bottomCards.length > 0) {
            const numFromTop = Math.ceil(cardsToDeploy / 2);
            const numFromBottom = cardsToDeploy - numFromTop;
            const selectedTop = topCards.slice(0, numFromTop).map(c => c.cardId);
            const shuffledBottom = [...bottomCards].sort(() => Math.random() - 0.5);
            const selectedBottom = shuffledBottom.slice(0, numFromBottom).map(c => c.cardId);
            aiSelectedCards = [...selectedTop, ...selectedBottom];
          } else {
            aiSelectedCards = cardsWithPower.slice(0, cardsToDeploy).map(c => c.cardId);
          }
        }
        
        newGameState.player2Hand = aiHand.filter(id => !aiSelectedCards.includes(id));
        newGameState.player2Battlefield = aiSelectedCards.map(cardId => ({
          cardId,
          faceDown: true,
        }));
      }
    }

    const opponentBF = isPlayer1 ? newGameState.player2Battlefield : newGameState.player1Battlefield;
    const bothDeployed = opponentBF.length === cardsToDeploy;
    const nextPhase = bothDeployed ? "combat" : "deployment";
    
    const opponentId = isPlayer1 ? game.player2Id! : game.player1Id;
    const nextActivePlayer = bothDeployed 
      ? (isPractice ? "player-ai" : user?.id) 
      : opponentId;

    updateGameMutation.mutate({
      currentPhase: nextPhase,
      activePlayer: nextActivePlayer,
      gameState: newGameState,
    });
    setSelectedCards([]);
    toast({ title: "Cards deployed!" });
  };

  const handleEndTurnMultiplayer = () => {
    if (!isMultiplayer || !gameId) return;
    sendGameAction(gameId, "end_turn", {});
    setWaitingForOpponent(true);
    toast({ title: "Turn ended. Waiting for opponent..." });
  };

  const handleCombat = () => {
    if (isMultiplayer) {
      handleEndTurnMultiplayer();
      return;
    }
    const newGameState = { ...game.gameState };
    newGameState.player1Battlefield = newGameState.player1Battlefield.map((bf) => ({ ...bf, faceDown: false }));
    newGameState.player2Battlefield = newGameState.player2Battlefield.map((bf) => ({ ...bf, faceDown: false }));

    // Calculate power breakdowns for combat results display
    const p1Cards = mapBattlefieldToCards(newGameState.player1Battlefield, getCardById);
    const p2Cards = mapBattlefieldToCards(newGameState.player2Battlefield, getCardById);
    
    const gs2 = newGameState;
    const player1Breakdown = calculateBattlePower(
      p1Cards, p2Cards, getCardById,
      gs2.player1AbilityBuffs, gs2.player1BlockedEffects, gs2.player2NegateAndHalve, gs2.player1ProtectedElement
    );
    const player2Breakdown = calculateBattlePower(
      p2Cards, p1Cards, getCardById,
      gs2.player2AbilityBuffs, gs2.player2BlockedEffects, gs2.player1NegateAndHalve, gs2.player2ProtectedElement
    );
    
    const player1Total = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const player2Total = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const summary = generateCombatLog(
      player1Breakdown, player2Breakdown, player1Total, player2Total,
      gs2.player1AbilityBuffs || [], gs2.player2AbilityBuffs || [],
      (game.gameState as any).abilityLog || [], game.currentTurn
    );
    
    setCombatBreakdown({ player1: player1Breakdown, player2: player2Breakdown });
    setCombatSummary(summary);
    setShowCombatResults(true);
    setCombatTimer(30);
    
    // Start the 30-second timer
    if (combatTimerRef.current) {
      clearInterval(combatTimerRef.current);
    }
    combatTimerRef.current = setInterval(() => {
      setCombatTimer(prev => {
        if (prev <= 1) {
          if (combatTimerRef.current) {
            clearInterval(combatTimerRef.current);
            combatTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    updateGameMutation.mutate({
      currentPhase: "calculation",
      gameState: newGameState,
    });
    toast({ title: "Cards revealed! Review combat results." });
  };

  // Assign handleCombat to ref for auto-advance
  handleCombatRef.current = handleCombat;

  const skipCombatTimer = () => {
    if (combatTimerRef.current) {
      clearInterval(combatTimerRef.current);
      combatTimerRef.current = null;
    }
    setCombatTimer(0);
  };

  const skipCombatPhaseTimer = () => {
    if (combatPhaseTimerRef.current) {
      clearInterval(combatPhaseTimerRef.current);
      combatPhaseTimerRef.current = null;
    }
    setCombatPhaseTimerActive(false);
    setCombatPhaseTimer(0);
    handleCombat();
  };

  const handleCalculation = () => {
    if (isMultiplayer) {
      setShowCombatResults(false);
      setCombatBreakdown(null);
      setCombatSummary(null);
      return;
    }
    let player1Breakdown = combatBreakdown?.player1;
    let player2Breakdown = combatBreakdown?.player2;
    let currentSummary = combatSummary;

    
    if (!player1Breakdown || !player2Breakdown) {
      const p1Cards = mapBattlefieldToCards(game.gameState.player1Battlefield, getCardById);
      const p2Cards = mapBattlefieldToCards(game.gameState.player2Battlefield, getCardById);
      const gs3 = game.gameState;
      player1Breakdown = calculateBattlePower(
        p1Cards, p2Cards, getCardById,
        gs3.player1AbilityBuffs, gs3.player1BlockedEffects, gs3.player2NegateAndHalve, gs3.player1ProtectedElement
      );
      player2Breakdown = calculateBattlePower(
        p2Cards, p1Cards, getCardById,
        gs3.player2AbilityBuffs, gs3.player2BlockedEffects, gs3.player1NegateAndHalve, gs3.player2ProtectedElement
      );
      const p1T = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
      const p2T = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
      currentSummary = generateCombatLog(
        player1Breakdown, player2Breakdown, p1T, p2T,
        gs3.player1AbilityBuffs || [], gs3.player2AbilityBuffs || [],
        (gs3 as any).abilityLog || [], game.currentTurn
      );
    }
    
    const p1Power = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const p2Power = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);

    let newP1HP = game.player1HP;
    let newP2HP = game.player2HP;
    let newP1VP = game.player1VictoryPoints;
    let newP2VP = game.player2VictoryPoints;
    let newP1WP = game.player1WithdrawalPoints;
    let newP2WP = game.player2WithdrawalPoints;

    if (currentSummary) {
      newP1HP = Math.min(GAME_CONSTANTS.STARTING_HP, newP1HP + currentSummary.player1Healing);
      newP2HP = Math.min(GAME_CONSTANTS.STARTING_HP, newP2HP + currentSummary.player2Healing);
      newP1HP -= currentSummary.finalDamageToPlayer1;
      newP2HP -= currentSummary.finalDamageToPlayer2;

      const p1WonRound = currentSummary.finalDamageToPlayer2 > 0 && currentSummary.finalDamageToPlayer1 === 0;
      const p2WonRound = currentSummary.finalDamageToPlayer1 > 0 && currentSummary.finalDamageToPlayer2 === 0;
      const tiedRound = (currentSummary.finalDamageToPlayer1 === 0 && currentSummary.finalDamageToPlayer2 === 0) || 
                         (currentSummary.finalDamageToPlayer1 > 0 && currentSummary.finalDamageToPlayer2 > 0);

      if (p1WonRound) {
        newP1VP += 1;
        newP2WP += 1;
        const totalDmg = currentSummary.finalDamageToPlayer2;
        toast({ title: `Player 1 wins! ${totalDmg} damage dealt.` });
      } else if (p2WonRound) {
        newP2VP += 1;
        newP1WP += 1;
        const totalDmg = currentSummary.finalDamageToPlayer1;
        toast({ title: `Player 2 wins! ${totalDmg} damage dealt.` });
      } else {
        newP1VP += 1;
        newP2VP += 1;
        newP1WP += 1;
        newP2WP += 1;
        toast({ title: "Draw! Both players get +1 Advance and +1 Withdraw." });
      }
    } else {
      const damage = Math.abs(p1Power - p2Power);
      if (p1Power > p2Power) {
        newP2HP -= damage;
        newP1VP += 1;
        newP2WP += 1;
        toast({ title: `Player 1 wins! ${damage} damage dealt.` });
      } else if (p2Power > p1Power) {
        newP1HP -= damage;
        newP2VP += 1;
        newP1WP += 1;
        toast({ title: `Player 2 wins! ${damage} damage dealt.` });
      } else {
        newP1VP += 1;
        newP2VP += 1;
        newP1WP += 1;
        newP2WP += 1;
        toast({ title: "Draw! Both players get +1 Advance and +1 Withdraw." });
      }
    }

    const p1Yard = [...game.gameState.player1Yard, ...game.gameState.player1Battlefield.map((bf) => bf.cardId)];
    const p2Yard = [...game.gameState.player2Yard, ...game.gameState.player2Battlefield.map((bf) => bf.cardId)];

    const newGameState = {
      ...game.gameState,
      player1Battlefield: [],
      player2Battlefield: [],
      player1Yard: p1Yard,
      player2Yard: p2Yard,
      player1AbilityBuffs: [],
      player2AbilityBuffs: [],
      player1ExtraDeploy: 0,
      player2ExtraDeploy: 0,
      player1BlockedEffects: false,
      player2BlockedEffects: false,
      player1NegateAndHalve: false,
      player2NegateAndHalve: false,
      player1ProtectedElement: undefined,
      player2ProtectedElement: undefined,
    };

    let status = game.status;
    let winnerId = game.winnerId;

    if (newP1HP <= 0) {
      status = "completed";
      winnerId = game.player2Id;
      toast({ title: "Game Over! Player 2 wins!", variant: "default" });
    } else if (newP2HP <= 0) {
      status = "completed";
      winnerId = game.player1Id;
      toast({ title: "Game Over! You win!", variant: "default" });
    }

    const mapBreakdownToSchema = (breakdowns: CardPowerBreakdown[]) => breakdowns.map(b => ({
      cardId: b.card.id,
      cardName: b.card.name,
      basePower: b.basePower,
      buffBonus: b.buffBonuses.reduce((s, bb) => s + bb.amount, 0),
      debuffPenalty: b.debuffPenalties.reduce((s, dp) => s + dp.amount, 0),
      finalPower: b.finalPower,
      traitName: b.traitInfo?.trait,
      traitValue: b.traitInfo?.value,
    }));
    
    const roundWinner = p1Power > p2Power ? "player1" as const : p2Power > p1Power ? "player2" as const : "tie" as const;
    const p1NetDmg = currentSummary?.finalDamageToPlayer1 || 0;
    const p2NetDmg = currentSummary?.finalDamageToPlayer2 || 0;
    const loserNetDmg = roundWinner === "player1" ? p2NetDmg : roundWinner === "player2" ? p1NetDmg : 0;
    const combatLog = {
      player1Cards: mapBreakdownToSchema(player1Breakdown),
      player2Cards: mapBreakdownToSchema(player2Breakdown),
      player1Total: p1Power,
      player2Total: p2Power,
      damage: loserNetDmg,
      winner: roundWinner,
      turn: game.currentTurn,
      abilityEffects: currentSummary?.abilityEffects || [],
      player1QuickStrikeDamage: currentSummary?.player1QuickStrikeDamage || 0,
      player2QuickStrikeDamage: currentSummary?.player2QuickStrikeDamage || 0,
      player1GuardianBlocked: currentSummary?.player1GuardianBlocked || 0,
      player2GuardianBlocked: currentSummary?.player2GuardianBlocked || 0,
      player1Healing: currentSummary?.player1Healing || 0,
      player2Healing: currentSummary?.player2Healing || 0,
      player1CardsDrawn: currentSummary?.player1CardsDrawn || 0,
      player2CardsDrawn: currentSummary?.player2CardsDrawn || 0,
      player1NetDmg: p1NetDmg,
      player2NetDmg: p2NetDmg,
    };
    
    newGameState.lastCombatLog = combatLog;
    newGameState.combatHistory = [...(game.gameState.combatHistory || []), combatLog];
    
    // Reset combat results state
    setShowCombatResults(false);
    setCombatBreakdown(null);
    setCombatSummary(null);

    updateGameMutation.mutate({
      currentPhase: "end",
      currentTurn: game.currentTurn + 1,
      player1HP: newP1HP,
      player2HP: newP2HP,
      player1VictoryPoints: newP1VP,
      player2VictoryPoints: newP2VP,
      player1WithdrawalPoints: newP1WP,
      player2WithdrawalPoints: newP2WP,
      gameState: newGameState,
      status,
      winnerId,
    });
  };
  
  // Store handleCalculation in ref for use by auto-advance useEffect
  handleCalculationRef.current = handleCalculation;

  const handleEndPhase = () => {
    if (isMultiplayer) {
      return;
    }
    updateGameMutation.mutate({
      currentPhase: "draw",
      currentTurn: game.currentTurn + 1,
      activePlayer: game.player1Id,
      gameState: {
        ...game.gameState,
        player1HasDrawn: false,
        player2HasDrawn: false,
      },
    });
  };

  if (effectiveStatus === "completed" || game.status === "completed") {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center p-6">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
            <p className="text-purple-200 text-lg mb-6">
              {(effectiveWinnerId || game.winnerId) === user?.id ? "You won!" : "You lost!"}
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate("/practice")} data-testid="button-back-to-practice">
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
              <Button onClick={() => navigate("/")} data-testid="button-go-home">
                Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-2 relative overflow-hidden game-board-compact">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto flex flex-col h-full gap-1.5 relative z-10 main-game-column">
        <div className="flex items-center justify-between flex-shrink-0 gap-2 top-status-bar">
          <div className="flex items-center gap-2">
            {opponentCommander && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOpponentCommanderDialog(true)}
                className="border-red-500/40 text-red-300 gap-1"
                data-testid="button-opponent-commander"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{opponentCommander.name}</span>
                <span className="sm:hidden">Cmdr</span>
              </Button>
            )}
            <AnimatedHPBar current={opponentHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={false} label="Opponent" previousHP={previousOpponentHP} />
            <VictoryWithdrawalCounter 
              victories={opponentVP} 
              withdrawals={opponentWP} 
              isPlayer={false} 
            />
            {isMultiplayer && spectatorCount > 0 && (
              <Badge variant="outline" className="text-purple-300 border-purple-500/30">
                <Eye className="w-3 h-3 mr-1" />
                {spectatorCount} watching
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={`${gameMode === "accelerated" ? "text-orange-300 border-orange-500/40 bg-orange-500/10" : "text-cyan-300 border-cyan-500/40 bg-cyan-500/10"}`}
              data-testid="badge-game-mode"
            >
              <Zap className="w-3 h-3 mr-1" />
              {cardsToDraw}/{cardsToDeploy}
            </Badge>
          </div>
          <PhaseIndicator 
            currentPhase={effectivePhase} 
            isMyTurn={isMyTurn} 
            turn={effectiveTurn}
            combatHistoryCount={(useServerState ? serverState.combatHistory : game.gameState.combatHistory)?.length || 0}
            onViewCombatHistory={() => setShowCombatHistoryDialog(true)}
          />
          <div className="flex items-center gap-2">
            <VictoryWithdrawalCounter 
              victories={myVP} 
              withdrawals={myWP} 
              isPlayer={true} 
            />
            <AnimatedHPBar current={myHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={true} label="You" previousHP={previousMyHP} />
            {myCommander && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMyCommanderDialog(true)}
                className="border-green-500/40 text-green-300 gap-1"
                data-testid="button-my-commander"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{myCommander.name}</span>
                <span className="sm:hidden">Cmdr</span>
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              {isMultiplayer && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setChatOpen(!chatOpen)}
                  data-testid="button-toggle-chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate(isMultiplayer ? "/lobby" : "/practice")}>
                Leave
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-lg border border-purple-500/10 px-3 py-1.5 flex-shrink-0 opponent-hand-zone">
          <div className="flex items-center justify-between mb-1">
            <span className="text-purple-300 text-[10px] font-medium uppercase tracking-wider">Opponent's Hand</span>
            <div className="flex items-center gap-2 text-[10px] text-purple-400">
              <span>{opponentHandSize} cards</span>
              <span className="opacity-50">|</span>
              <span>Deck: {opponentDeckSize}</span>
            </div>
          </div>
          <div className="flex gap-1 justify-center items-center">
            {Array(Math.min(opponentHandSize, 10)).fill(0).map((_, i) => (
              <div 
                key={i} 
                className="w-8 h-12 rounded bg-gradient-to-br from-purple-800 to-purple-950 border border-purple-500/30 shadow-lg opponent-facedown-card"
                style={{ transform: `rotate(${(i - Math.floor(opponentHandSize / 2)) * 2}deg)` }}
              />
            ))}
            {opponentHandSize > 10 && (
              <Badge variant="secondary" className="text-[10px]">+{opponentHandSize - 10}</Badge>
            )}
          </div>
        </div>

        <BattlefieldZone 
          cards={opponentBattlefield} 
          isOpponent={true} 
          allCards={allCards}
          onPreview={setPreviewCard}
        />

        <div className="flex justify-center items-center gap-2 flex-shrink-0 action-buttons-row">
          <Card className="bg-purple-900/50 border-purple-500/30 px-3 py-2 action-card">
            <div className="flex items-center gap-3">
              {opponentDisconnected && isMultiplayer && (
                <div className="flex items-center gap-2 text-red-300" data-testid="text-opponent-disconnected">
                  <div className="animate-pulse w-2 h-2 rounded-full bg-red-400"></div>
                  <span className="text-sm">
                    Opponent disconnected. Reconnecting... ({disconnectCountdown}s)
                  </span>
                </div>
              )}
              {waitingForOpponent && isMultiplayer && !opponentDisconnected && (
                <div className="flex items-center gap-2 text-amber-300" data-testid="text-waiting-opponent">
                  <div className="animate-pulse w-2 h-2 rounded-full bg-amber-400"></div>
                  <span className="text-sm">
                    Waiting for opponent to {effectivePhase === "draw" ? "draw cards" : effectivePhase === "deployment" ? "deploy cards" : "end turn"}...
                  </span>
                </div>
              )}
              {effectivePhase === "draw" && (isMyTurn || isMultiplayer) && !(useServerState && serverState.myHasDrawn) && (
                <Button onClick={handleDraw} className="bg-gradient-to-r from-cyan-600 to-blue-600" data-testid="button-draw">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Draw Cards
                </Button>
              )}
              {effectivePhase === "deployment" && (isMyTurn || (isMultiplayer && !(useServerState && serverState.myHasDeployed))) && (
                <Button 
                  onClick={handleDeploy} 
                  disabled={selectedCards.length !== cardsToDeploy}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                  data-testid="button-deploy"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Deploy ({selectedCards.length}/{cardsToDeploy})
                </Button>
              )}
              {effectivePhase === "combat" && (isMyTurn || game.gameType === "practice" || isMultiplayer) && (
                <div className="flex items-center gap-3">
                  {game.gameType === "practice" && combatPhaseTimerActive && (
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-800/80 border border-amber-500/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300 font-mono text-sm">
                          Review: {combatPhaseTimer}s
                        </span>
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={game.gameType === "practice" && combatPhaseTimerActive ? skipCombatPhaseTimer : handleCombat} 
                    className="bg-gradient-to-r from-red-600 to-orange-600" 
                    data-testid="button-combat"
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    {isMultiplayer ? "End Turn" : game.gameType === "practice" && combatPhaseTimerActive ? "Skip & Reveal" : "Reveal Cards"}
                  </Button>
                </div>
              )}
              {effectivePhase === "calculation" && isMyTurn && !showCombatResults && !isMultiplayer && (
                <Button onClick={handleCalculation} className="bg-gradient-to-r from-yellow-600 to-orange-600" data-testid="button-calculate">
                  <Trophy className="w-4 h-4 mr-2" />
                  Calculate Damage
                </Button>
              )}
              {effectivePhase === "end" && isMyTurn && !isMultiplayer && (
                <Button onClick={handleEndPhase} className="bg-gradient-to-r from-green-600 to-teal-600" data-testid="button-end">
                  <Flag className="w-4 h-4 mr-2" />
                  End Turn
                </Button>
              )}
              {!isMyTurn && !isMultiplayer && (
                <p className="text-purple-300">Waiting for opponent...</p>
              )}
            </div>
          </Card>
          {/* Combat Log Button - To the right of turn action card, visible in all phases */}
          {game.gameState.lastCombatLog && (
            <Button 
              size="lg"
              onClick={() => setShowCombatLogDialog(true)}
              className="bg-red-600 text-white font-bold border-2 border-red-400 shadow-lg shadow-red-500/50 animate-pulse"
              data-testid="button-view-combat-log"
            >
              <Swords className="w-5 h-5 mr-2" />
              Combat Log
            </Button>
          )}
          {game.gameState.abilityLog && game.gameState.abilityLog.length > 0 && (
            <Button 
              size="lg"
              onClick={() => setShowAbilityLogDialog(true)}
              className="bg-amber-600 text-white font-bold border-2 border-amber-400 shadow-lg shadow-amber-500/50"
              data-testid="button-view-ability-log"
            >
              <Scroll className="w-5 h-5 mr-2" />
              Ability Log
            </Button>
          )}
        </div>

        <BattlefieldZone 
          cards={myBattlefield} 
          isOpponent={false} 
          allCards={allCards}
          onPreview={setPreviewCard}
          newlyDeployedCards={newlyDeployedCards}
        />

        {/* Combat Results Panel */}
        {showCombatResults && combatBreakdown && (effectivePhase === "calculation" || (isMultiplayer && showCombatResults)) && (
          <CombatResultPanel
            player1Breakdown={combatBreakdown.player1}
            player2Breakdown={combatBreakdown.player2}
            combatSummary={combatSummary}
            timer={combatTimer}
            onSkip={skipCombatTimer}
            isPlayer1={isPlayer1}
          />
        )}

        <div className="rounded-lg border-2 px-3 py-2 transition-colors duration-300 flex-shrink-0 min-h-0 player-hand-zone"
          style={{
            background: handView === "units" 
              ? "linear-gradient(to top, rgba(20, 83, 45, 0.1), rgba(30, 41, 59, 0.3))" 
              : "linear-gradient(to top, rgba(120, 53, 15, 0.1), rgba(30, 41, 59, 0.3))",
            borderColor: handView === "units" ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5 gap-2 hand-toggle-bar">
            <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50" data-testid="hand-view-toggle">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  handView === "units" 
                    ? "bg-green-600/80 text-green-100 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setHandView("units")}
                data-testid="button-hand-view-units"
              >
                <Swords className="w-3.5 h-3.5" />
                Unit Cards
                <Badge className="bg-green-800/60 text-green-200 text-[9px] px-1 py-0 ml-0.5">
                  {myHand.length}
                </Badge>
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  handView === "abilities" 
                    ? "bg-amber-600/80 text-amber-100 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setHandView("abilities")}
                data-testid="button-hand-view-abilities"
              >
                <Scroll className="w-3.5 h-3.5" />
                {myCommander ? myCommander.name : "Abilities"}
                {myCommander && (
                  <Badge className="bg-amber-800/60 text-amber-200 text-[9px] px-1 py-0 ml-0.5">
                    {myCommander.abilities.length}
                  </Badge>
                )}
              </button>
            </div>
            
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {handView === "units" ? (
                <>
                  <span className="text-green-400 font-medium">{myHand.length} cards</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-green-400/70">Deck: {myDeckSize}</span>
                  {effectivePhase === "deployment" && (isMyTurn || isMultiplayer) && (
                    <Badge className="bg-purple-500/50 text-xs">
                      Select {cardsToDeploy - selectedCards.length} more
                    </Badge>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 font-bold" data-testid="text-my-victory-points">{myVP}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flag className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400 font-bold" data-testid="text-my-withdrawal-points">{myWP}</span>
                  </div>
                  {myCommander && (
                    <Badge variant="outline" className="text-amber-300 border-amber-500/30 text-[10px]">
                      {myCommander.element}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {handView === "units" ? (
            <div className="flex gap-1.5 flex-wrap justify-center items-center" data-testid="unit-hand-cards">
              {myHand.map((cardId) => {
                const card = getCardById(cardId);
                if (!card) return null;
                const isPlayable = effectivePhase === "deployment" && (isMyTurn || isMultiplayer);
                return (
                  <MiniCard 
                    key={cardId} 
                    card={card} 
                    selected={selectedCards.includes(cardId)}
                    playable={isPlayable && !selectedCards.includes(cardId) && selectedCards.length < cardsToDeploy}
                    isNewlyPlayed={newlyDrawnCards.has(cardId)}
                    onClick={() => handleCardSelect(cardId)}
                    onPreview={() => setPreviewCard(card)}
                  />
                );
              })}
              {myHand.length === 0 && (
                <div className="text-green-400/50 text-sm italic">No cards in hand</div>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5 flex-wrap justify-center items-center" data-testid="ability-hand-cards">
              {myCommander ? (
                myCommander.abilities.map((ability) => {
                  const canAfford = myVP >= ability.victoryCost && myWP >= ability.withdrawalCost;
                  const isCorrectPhase = ability.phase === effectivePhase;
                  return (
                    <AbilityCard
                      key={ability.id}
                      ability={ability}
                      commanderElement={myCommander.element}
                      canAfford={canAfford}
                      isCorrectPhase={isCorrectPhase}
                      isMyTurn={isMyTurn}
                      usedThisTurn={usedAbilitiesThisTurn.has(ability.id)}
                      onActivate={() => handleActivateAbility(ability)}
                      onPreview={() => setPreviewAbility(ability)}
                    />
                  );
                })
              ) : (
                <div className="text-amber-400/50 text-sm italic">No commander equipped</div>
              )}
            </div>
          )}
        </div>
      </div>
      <CardPreviewDialog 
        card={previewCard} 
        open={!!previewCard} 
        onClose={() => setPreviewCard(null)} 
      />
      <AbilityPreviewDialog
        ability={previewAbility}
        commanderElement={myCommander?.element || null}
        open={!!previewAbility}
        onClose={() => setPreviewAbility(null)}
      />
      <CommanderInfoDialog
        commander={myCommander}
        open={showMyCommanderDialog}
        onClose={() => setShowMyCommanderDialog(false)}
        label="Your Commander"
      />
      <CommanderInfoDialog
        commander={opponentCommander}
        open={showOpponentCommanderDialog}
        onClose={() => setShowOpponentCommanderDialog(false)}
        label="Opponent's Commander"
      />
      {chatOpen && isMultiplayer && (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-slate-800 border border-purple-500/30 rounded-lg shadow-xl flex flex-col z-50">
          <div className="flex items-center justify-between p-3 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="text-white font-medium">Game Chat</span>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => setChatOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3" ref={chatScrollRef}>
            <div className="space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-purple-400 text-sm text-center">No messages yet</p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className={`font-medium ${msg.senderId === user?.id ? 'text-green-400' : 'text-purple-400'}`}>
                      {msg.senderName}:
                    </span>{" "}
                    <span className="text-white">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-2 border-t border-purple-500/20">
            <div className="flex gap-1 mb-2 flex-wrap">
              {[
                { icon: Trophy, text: "GG" },
                { icon: Swords, text: "Nice!" },
                { icon: Heart, text: "Thanks" },
                { icon: RotateCcw, text: "Thinking" },
                { icon: Flag, text: "Hurry!" },
                { icon: Shield, text: "Sorry" },
              ].map((emote) => {
                const Icon = emote.icon;
                return (
                  <Button
                    key={emote.text}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs hover:bg-purple-500/20 gap-1"
                    onClick={() => {
                      sendGameMessage(gameId!, emote.text);
                      const newMsg: ChatMessage = {
                        id: Date.now().toString(),
                        message: emote.text,
                        senderId: user?.id || "",
                        senderName: user?.firstName || "You",
                        createdAt: new Date().toISOString(),
                      };
                      setChatMessages((prev) => [...prev, newMsg]);
                    }}
                    data-testid={`emote-${emote.text.toLowerCase().replace(/[^a-z]/g, '')}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{emote.text}</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                className="bg-slate-900/50 border-purple-500/30 text-white text-sm h-8"
                data-testid="input-game-chat"
              />
              <Button 
                size="icon" 
                className="h-8 w-8"
                onClick={handleSendChat}
                disabled={!chatMessage.trim()}
                data-testid="button-send-game-chat"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={showCombatLogDialog} onOpenChange={setShowCombatLogDialog}>
        <DialogContent className="bg-slate-900 border-red-500/50 max-w-3xl max-h-[85vh] overflow-hidden" data-testid="dialog-combat-log">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-xl">
              <Swords className="w-6 h-6 text-red-500" />
              Combat Calculation Log - Turn {game.gameState.lastCombatLog?.turn || '?'}
            </DialogTitle>
          </DialogHeader>
          {game.gameState.lastCombatLog && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4 font-mono text-sm">
                {/* Step 1: Cards Deployed */}
                <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                  <div className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                    <span className="bg-cyan-500 text-black px-2 py-0.5 rounded text-xs">STEP 1</span>
                    Cards Deployed
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-green-400 text-xs mb-2 font-bold">YOUR CARDS:</div>
                      {(isPlayer1 ? game.gameState.lastCombatLog.player1Cards : game.gameState.lastCombatLog.player2Cards).map((card, i) => (
                        <div key={i} className="bg-green-900/30 border border-green-700/50 rounded p-2 mb-2" data-testid={`combat-log-your-card-${i}`}>
                          <div className="text-green-300 font-bold">{card.cardName}</div>
                          <div className="text-slate-400 text-xs mt-1">
                            <div>Card ID: <span className="text-slate-300">{card.cardId}</span></div>
                            <div>Base Power: <span className="text-yellow-400 font-bold">{card.basePower}</span></div>
                            {card.traitName && <div>Trait: <span className="text-purple-400">{card.traitName}</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-red-400 text-xs mb-2 font-bold">OPPONENT CARDS:</div>
                      {(isPlayer1 ? game.gameState.lastCombatLog.player2Cards : game.gameState.lastCombatLog.player1Cards).map((card, i) => (
                        <div key={i} className="bg-red-900/30 border border-red-700/50 rounded p-2 mb-2" data-testid={`combat-log-enemy-card-${i}`}>
                          <div className="text-red-300 font-bold">{card.cardName}</div>
                          <div className="text-slate-400 text-xs mt-1">
                            <div>Card ID: <span className="text-slate-300">{card.cardId}</span></div>
                            <div>Base Power: <span className="text-yellow-400 font-bold">{card.basePower}</span></div>
                            {card.traitName && <div>Trait: <span className="text-purple-400">{card.traitName}</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 2: Calculate Modifiers */}
                <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                  <div className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                    <span className="bg-purple-500 text-black px-2 py-0.5 rounded text-xs">STEP 2</span>
                    Apply Modifiers
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-green-400 text-xs mb-2 font-bold">YOUR MODIFIERS:</div>
                      {(isPlayer1 ? game.gameState.lastCombatLog.player1Cards : game.gameState.lastCombatLog.player2Cards).map((card, i) => (
                        <div key={i} className="bg-slate-700/50 rounded p-2 mb-2 text-xs">
                          <div className="text-green-300 font-medium mb-1">{card.cardName}</div>
                          <div className="space-y-0.5">
                            <div className="text-slate-400">Base Power: <span className="text-yellow-400">{card.basePower}</span></div>
                            {card.buffBonus !== 0 && (
                              <div className="text-cyan-400">+ Buff Bonus: <span className="font-bold">+{card.buffBonus}</span></div>
                            )}
                            {card.debuffPenalty !== 0 && (
                              <div className="text-orange-400">- Debuff Penalty: <span className="font-bold">-{card.debuffPenalty}</span></div>
                            )}
                            {card.traitName && card.traitValue && (
                              <div className="text-purple-400 mt-1 border-t border-slate-600 pt-1">Trait: <span className="font-bold">{card.traitName} ({card.traitValue})</span></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-red-400 text-xs mb-2 font-bold">OPPONENT MODIFIERS:</div>
                      {(isPlayer1 ? game.gameState.lastCombatLog.player2Cards : game.gameState.lastCombatLog.player1Cards).map((card, i) => (
                        <div key={i} className="bg-slate-700/50 rounded p-2 mb-2 text-xs">
                          <div className="text-red-300 font-medium mb-1">{card.cardName}</div>
                          <div className="space-y-0.5">
                            <div className="text-slate-400">Base Power: <span className="text-yellow-400">{card.basePower}</span></div>
                            {card.buffBonus !== 0 && (
                              <div className="text-cyan-400">+ Buff Bonus: <span className="font-bold">+{card.buffBonus}</span></div>
                            )}
                            {card.debuffPenalty !== 0 && (
                              <div className="text-orange-400">- Debuff Penalty: <span className="font-bold">-{card.debuffPenalty}</span></div>
                            )}
                            {card.traitName && card.traitValue && (
                              <div className="text-purple-400 mt-1 border-t border-slate-600 pt-1">Trait: <span className="font-bold">{card.traitName} ({card.traitValue})</span></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 3: Quick Strike Damage */}
                {(() => {
                  const log = game.gameState.lastCombatLog;
                  const yourQS = isPlayer1 ? (log.player1QuickStrikeDamage || 0) : (log.player2QuickStrikeDamage || 0);
                  const enemyQS = isPlayer1 ? (log.player2QuickStrikeDamage || 0) : (log.player1QuickStrikeDamage || 0);
                  const yourCards = isPlayer1 ? log.player1Cards : log.player2Cards;
                  const enemyCards = isPlayer1 ? log.player2Cards : log.player1Cards;
                  const yourQSCards = yourCards.filter(c => c.traitName === "Quick Strike" && c.traitValue);
                  const enemyQSCards = enemyCards.filter(c => c.traitName === "Quick Strike" && c.traitValue);
                  const hasQuickStrike = yourQS > 0 || enemyQS > 0 || yourQSCards.length > 0 || enemyQSCards.length > 0;
                  if (!hasQuickStrike) return null;
                  return (
                    <div className="bg-slate-800/80 border border-yellow-500/50 rounded-lg p-4" data-testid="combat-log-quick-strike-step">
                      <div className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                        <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs">STEP 3</span>
                        Quick Strike - Direct HP Damage
                      </div>
                      <div className="text-xs text-slate-400 mb-3">Quick Strike bypasses combat power — it deals direct HP damage regardless of who wins!</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3">
                          <div className="text-green-400 text-xs mb-2 font-bold">YOUR QUICK STRIKE:</div>
                          {yourQSCards.length > 0 ? yourQSCards.map((card, i) => (
                            <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                              <span>{card.cardName}:</span>
                              <span className="text-yellow-400 font-bold">{card.traitValue} direct dmg to opponent</span>
                            </div>
                          )) : (
                            <div className="text-xs text-slate-500">No Quick Strike cards</div>
                          )}
                          {yourQS > 0 && (
                            <div className="border-t border-green-500/30 mt-2 pt-2 flex justify-between font-bold text-yellow-300">
                              <span>TOTAL TO OPPONENT:</span>
                              <span>{yourQS} HP</span>
                            </div>
                          )}
                        </div>
                        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
                          <div className="text-red-400 text-xs mb-2 font-bold">OPPONENT QUICK STRIKE:</div>
                          {enemyQSCards.length > 0 ? enemyQSCards.map((card, i) => (
                            <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                              <span>{card.cardName}:</span>
                              <span className="text-yellow-400 font-bold">{card.traitValue} direct dmg to you</span>
                            </div>
                          )) : (
                            <div className="text-xs text-slate-500">No Quick Strike cards</div>
                          )}
                          {enemyQS > 0 && (
                            <div className="border-t border-red-500/30 mt-2 pt-2 flex justify-between font-bold text-yellow-300">
                              <span>TOTAL TO YOU:</span>
                              <span>{enemyQS} HP</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 4: Calculate Final Power */}
                {(() => {
                  const hasQS = (game.gameState.lastCombatLog.player1QuickStrikeDamage || 0) > 0 || (game.gameState.lastCombatLog.player2QuickStrikeDamage || 0) > 0;
                  const stepNum = hasQS ? 4 : 3;
                  return (
                    <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                      <div className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                        <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs">STEP {stepNum}</span>
                        Calculate Final Power
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3">
                          <div className="text-green-400 text-xs mb-2 font-bold">YOUR POWER CALCULATION:</div>
                          {(isPlayer1 ? game.gameState.lastCombatLog.player1Cards : game.gameState.lastCombatLog.player2Cards).map((card, i) => (
                            <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                              <span>{card.cardName}:</span>
                              <span className="text-green-400 font-bold">
                                {card.basePower} {card.buffBonus !== 0 ? `+${card.buffBonus}` : ''} {card.debuffPenalty !== 0 ? `-${card.debuffPenalty}` : ''} = {card.finalPower}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-green-500/30 mt-2 pt-2 flex justify-between font-bold text-green-300">
                            <span>TOTAL:</span>
                            <span>{isPlayer1 ? game.gameState.lastCombatLog.player1Total : game.gameState.lastCombatLog.player2Total}</span>
                          </div>
                        </div>
                        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
                          <div className="text-red-400 text-xs mb-2 font-bold">OPPONENT POWER CALCULATION:</div>
                          {(isPlayer1 ? game.gameState.lastCombatLog.player2Cards : game.gameState.lastCombatLog.player1Cards).map((card, i) => (
                            <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                              <span>{card.cardName}:</span>
                              <span className="text-red-400 font-bold">
                                {card.basePower} {card.buffBonus !== 0 ? `+${card.buffBonus}` : ''} {card.debuffPenalty !== 0 ? `-${card.debuffPenalty}` : ''} = {card.finalPower}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-red-500/30 mt-2 pt-2 flex justify-between font-bold text-red-300">
                            <span>TOTAL:</span>
                            <span>{isPlayer1 ? game.gameState.lastCombatLog.player2Total : game.gameState.lastCombatLog.player1Total}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 5: Determine Winner & Full Damage Breakdown */}
                {(() => {
                  const log = game.gameState.lastCombatLog;
                  const hasQS = (log.player1QuickStrikeDamage || 0) > 0 || (log.player2QuickStrikeDamage || 0) > 0;
                  const stepNum = hasQS ? 5 : 4;
                  const yourTotal = isPlayer1 ? log.player1Total : log.player2Total;
                  const enemyTotal = isPlayer1 ? log.player2Total : log.player1Total;
                  const rawPowerDiff = Math.abs(yourTotal - enemyTotal);
                  const yourQS = isPlayer1 ? (log.player1QuickStrikeDamage || 0) : (log.player2QuickStrikeDamage || 0);
                  const enemyQS = isPlayer1 ? (log.player2QuickStrikeDamage || 0) : (log.player1QuickStrikeDamage || 0);
                  const yourGuardian = isPlayer1 ? (log.player1GuardianBlocked || 0) : (log.player2GuardianBlocked || 0);
                  const enemyGuardian = isPlayer1 ? (log.player2GuardianBlocked || 0) : (log.player1GuardianBlocked || 0);
                  const yourHealing = isPlayer1 ? (log.player1Healing || 0) : (log.player2Healing || 0);
                  const enemyHealing = isPlayer1 ? (log.player2Healing || 0) : (log.player1Healing || 0);
                  const yourNetDmg = isPlayer1 ? (log.player1NetDmg || 0) : (log.player2NetDmg || 0);
                  const enemyNetDmg = isPlayer1 ? (log.player2NetDmg || 0) : (log.player1NetDmg || 0);
                  const youWin = (isPlayer1 && log.winner === "player1") || (!isPlayer1 && log.winner === "player2");
                  const isTie = log.winner === "tie";
                  const winnerQS = youWin ? yourQS : enemyQS;
                  const loserGuard = youWin ? enemyGuardian : yourGuardian;
                  const loserNetDmg = youWin ? enemyNetDmg : yourNetDmg;
                  const winnerNetDmg = youWin ? yourNetDmg : enemyNetDmg;
                  const hasBreakdown = yourQS > 0 || enemyQS > 0 || yourGuardian > 0 || enemyGuardian > 0;
                  const breakdownParts: string[] = [];
                  if (rawPowerDiff > 0 && !isTie) breakdownParts.push(`${rawPowerDiff} power`);
                  if (winnerQS > 0 && !isTie) breakdownParts.push(`+${winnerQS} QS`);
                  if (loserGuard > 0 && !isTie) breakdownParts.push(`-${loserGuard} blk`);
                  const breakdownLine = breakdownParts.length > 1 ? breakdownParts.join(' ') : '';

                  return (
                    <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                      <div className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                        <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-xs">STEP {stepNum}</span>
                        Determine Winner & Damage
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                        <div className="text-lg mb-2">
                          <span className="text-green-400 font-bold">{yourTotal}</span>
                          <span className="text-slate-400 mx-3">vs</span>
                          <span className="text-red-400 font-bold">{enemyTotal}</span>
                        </div>
                        {isTie ? (
                          <>
                            <div className="text-yellow-400 text-xl font-bold">
                              {(yourQS > 0 || enemyQS > 0) ? "DRAW — Quick Strike damage still resolves!" : "DRAW - No damage dealt"}
                            </div>
                            {(yourQS > 0 || enemyQS > 0) && (
                              <div className="text-slate-300 mt-2 text-sm">
                                You dealt <span className="text-green-400 font-bold">{yourNetDmg > 0 ? yourNetDmg : Math.max(0, yourQS - enemyGuardian)}</span> · Opponent dealt <span className="text-red-400 font-bold">{enemyNetDmg > 0 ? enemyNetDmg : Math.max(0, enemyQS - yourGuardian)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className={`text-2xl font-bold ${youWin ? "text-green-400" : "text-red-400"}`}>
                              {youWin ? "YOU WIN THIS ROUND!" : "OPPONENT WINS THIS ROUND!"}
                            </div>
                            <div className="text-slate-300 mt-2">
                              <span className="text-amber-400 font-bold text-xl">{loserNetDmg} dmg</span>
                            </div>
                            {breakdownLine && (
                              <div className="text-slate-400 text-sm mt-1">
                                ({breakdownLine})
                              </div>
                            )}
                            {winnerNetDmg > 0 && (
                              <div className="text-yellow-400 text-sm mt-1">
                                +{winnerNetDmg} QS back
                              </div>
                            )}
                          </>
                        )}

                        {hasBreakdown && (
                          <div className="mt-4 border-t border-slate-600 pt-4">
                            <div className="text-xs text-slate-400 mb-2 font-bold uppercase">Full Damage Breakdown</div>
                            <div className="grid grid-cols-2 gap-4 text-left text-xs">
                              <div className="bg-green-900/20 border border-green-700/30 rounded p-2">
                                <div className="text-green-400 font-bold mb-1">DAMAGE YOU DEAL:</div>
                                {youWin && !isTie && rawPowerDiff > 0 && <div className="text-slate-300">Power win: <span className="text-amber-400 font-bold">{rawPowerDiff}</span></div>}
                                {yourQS > 0 && <div className="text-slate-300">Your Quick Strike: <span className="text-yellow-400 font-bold">+{yourQS}</span></div>}
                                {enemyGuardian > 0 && <div className="text-slate-300">Enemy blocks: <span className="text-blue-400 font-bold">-{enemyGuardian}</span></div>}
                                <div className="border-t border-green-500/30 mt-1 pt-1 text-green-300 font-bold">Total: {enemyNetDmg} HP to opponent</div>
                              </div>
                              <div className="bg-red-900/20 border border-red-700/30 rounded p-2">
                                <div className="text-red-400 font-bold mb-1">DAMAGE YOU TAKE:</div>
                                {!youWin && !isTie && rawPowerDiff > 0 && <div className="text-slate-300">Power loss: <span className="text-amber-400 font-bold">{rawPowerDiff}</span></div>}
                                {enemyQS > 0 && <div className="text-slate-300">Enemy Quick Strike: <span className="text-yellow-400 font-bold">+{enemyQS}</span></div>}
                                {yourGuardian > 0 && <div className="text-slate-300">Your blocks: <span className="text-blue-400 font-bold">-{yourGuardian}</span></div>}
                                <div className="border-t border-red-500/30 mt-1 pt-1 text-red-300 font-bold">Total: {yourNetDmg} HP to you</div>
                              </div>
                            </div>
                            {(yourHealing > 0 || enemyHealing > 0) && (
                              <div className="mt-2 text-xs">
                                {yourHealing > 0 && <div className="text-emerald-400">You heal: +{yourHealing} HP</div>}
                                {enemyHealing > 0 && <div className="text-emerald-400">Opponent heals: +{enemyHealing} HP</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {game.gameState.lastCombatLog?.abilityEffects && game.gameState.lastCombatLog.abilityEffects.length > 0 && (
                  <div className="bg-slate-800/80 border border-amber-500/30 rounded-lg p-4" data-testid="combat-log-ability-effects">
                    <div className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                      <span className="bg-amber-600 text-black px-2 py-0.5 rounded text-xs">STEP {((game.gameState.lastCombatLog.player1QuickStrikeDamage || 0) > 0 || (game.gameState.lastCombatLog.player2QuickStrikeDamage || 0) > 0) ? 6 : 5}</span>
                      Commander Ability Effects This Round
                    </div>
                    <div className="space-y-2">
                      {game.gameState.lastCombatLog.abilityEffects.map((ae, i) => {
                        const isYou = (isPlayer1 && ae.playerSide === game.player1Id) || (!isPlayer1 && ae.playerSide === game.player2Id);
                        return (
                          <div key={i} className={`rounded p-2 text-xs border ${isYou ? 'bg-green-900/30 border-green-700/50' : 'bg-red-900/30 border-red-700/50'}`} data-testid={`combat-log-ability-${i}`}>
                            <div className={`font-bold ${isYou ? 'text-green-300' : 'text-red-300'}`}>
                              {isYou ? 'YOU' : 'OPPONENT'}: {ae.abilityName}
                            </div>
                            <div className="text-slate-400 mt-0.5">
                              {ae.effectDescription}
                              {ae.phase && <span className="text-amber-400/70 ml-2">({ae.phase} phase)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showAbilityLogDialog} onOpenChange={setShowAbilityLogDialog}>
        <DialogContent className="bg-slate-900 border-amber-500/50 max-w-2xl max-h-[85vh] overflow-hidden" data-testid="dialog-ability-log">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-xl">
              <Scroll className="w-6 h-6 text-amber-500" />
              Commander Ability Log
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-2">
              {(game.gameState.abilityLog || []).map((entry, index) => (
                <div key={index} className="bg-slate-800/80 border border-amber-500/20 rounded-lg p-3" data-testid={`ability-log-entry-${index}`}>
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-amber-300 border-amber-500/30 text-xs">
                      Turn {entry.turn} - {entry.phase}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {entry.victoryCost > 0 && (
                        <Badge className="bg-green-600/60 text-[10px]">
                          <Trophy className="w-2.5 h-2.5 mr-0.5" />-{entry.victoryCost}
                        </Badge>
                      )}
                      {entry.withdrawalCost > 0 && (
                        <Badge className="bg-blue-600/60 text-[10px]">
                          <Flag className="w-2.5 h-2.5 mr-0.5" />-{entry.withdrawalCost}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-amber-300 font-bold text-sm">{entry.abilityName}</div>
                  <div className="text-slate-400 text-xs">{entry.commanderName}</div>
                  <div className="text-slate-300 text-xs mt-1">{entry.effectDescription}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {/* Combat History Dialog */}
      <Dialog open={showCombatHistoryDialog} onOpenChange={(open) => {
        setShowCombatHistoryDialog(open);
        if (!open) setSelectedHistoryRound(null);
      }}>
        <DialogContent className="bg-slate-800 border-cyan-500/30 max-w-2xl max-h-[80vh] overflow-hidden" data-testid="dialog-combat-history">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              Combat History - All Rounds
            </DialogTitle>
          </DialogHeader>
          {game.gameState.combatHistory && game.gameState.combatHistory.length > 0 ? (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-2">
                {game.gameState.combatHistory.map((log, index) => {
                  const yourTotal = isPlayer1 ? log.player1Total : log.player2Total;
                  const enemyTotal = isPlayer1 ? log.player2Total : log.player1Total;
                  const youWon = (isPlayer1 && log.winner === "player1") || (!isPlayer1 && log.winner === "player2");
                  const isTie = log.winner === "tie";
                  const rawPD = Math.abs(yourTotal - enemyTotal);
                  const yQS = isPlayer1 ? (log.player1QuickStrikeDamage || 0) : (log.player2QuickStrikeDamage || 0);
                  const eQS = isPlayer1 ? (log.player2QuickStrikeDamage || 0) : (log.player1QuickStrikeDamage || 0);
                  const yGuard = isPlayer1 ? (log.player1GuardianBlocked || 0) : (log.player2GuardianBlocked || 0);
                  const eGuard = isPlayer1 ? (log.player2GuardianBlocked || 0) : (log.player1GuardianBlocked || 0);
                  const yHeal = isPlayer1 ? (log.player1Healing || 0) : (log.player2Healing || 0);
                  const eHeal = isPlayer1 ? (log.player2Healing || 0) : (log.player1Healing || 0);
                  const yNetDmg = isPlayer1 ? (log.player1NetDmg || 0) : (log.player2NetDmg || 0);
                  const eNetDmg = isPlayer1 ? (log.player2NetDmg || 0) : (log.player1NetDmg || 0);
                  const wQS = youWon ? yQS : eQS;
                  const lGuard = youWon ? eGuard : yGuard;
                  const loserNetDmg = youWon ? eNetDmg : yNetDmg;
                  const winnerNetDmg = youWon ? yNetDmg : eNetDmg;
                  const brkParts: string[] = [];
                  if (!isTie && rawPD > 0) brkParts.push(`${rawPD} power`);
                  if (!isTie && wQS > 0) brkParts.push(`+${wQS} QS`);
                  if (!isTie && lGuard > 0) brkParts.push(`-${lGuard} blk`);
                  const brkLine = brkParts.length > 1 ? `(${brkParts.join(' ')})` : '';
                  const hasTraits = yQS > 0 || eQS > 0 || yGuard > 0 || eGuard > 0 || yHeal > 0 || eHeal > 0;

                  return (
                    <div key={index}>
                      <button
                        onClick={() => setSelectedHistoryRound(selectedHistoryRound === index ? null : index)}
                        className={`w-full p-3 rounded-lg border transition-all text-left ${
                          selectedHistoryRound === index 
                            ? 'bg-slate-700/50 border-cyan-500/50' 
                            : 'bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50'
                        }`}
                        data-testid={`combat-history-round-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-cyan-300 border-cyan-500/30">
                              Turn {log.turn}
                            </Badge>
                            <span className={`font-medium ${
                              isTie ? 'text-yellow-300' : youWon ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {isTie ? (yQS > 0 || eQS > 0 ? 'Draw (QS)' : 'Draw') : youWon ? 'Won' : 'Lost'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-400">You: {yourTotal}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="text-red-400">Enemy: {enemyTotal}</span>
                            {!isTie && (
                              <Badge className={youWon ? 'bg-green-600/50' : 'bg-red-600/50'}>
                                {loserNetDmg} dmg {brkLine}
                              </Badge>
                            )}
                            {!isTie && winnerNetDmg > 0 && (
                              <Badge className="bg-yellow-600/50">
                                +{winnerNetDmg} QS back
                              </Badge>
                            )}
                          </div>
                        </div>
                        {hasTraits && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {yQS > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">QS You: {yQS}</span>}
                            {eQS > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">QS Opp: {eQS}</span>}
                            {yGuard > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Guard You: {yGuard}</span>}
                            {eGuard > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Guard Opp: {eGuard}</span>}
                            {yHeal > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Heal You: {yHeal}</span>}
                            {eHeal > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Heal Opp: {eHeal}</span>}
                          </div>
                        )}
                      </button>
                      
                      {selectedHistoryRound === index && (
                        <div className="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 animate-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-3">
                              <h4 className="text-green-400 text-sm font-medium mb-2">Your Cards</h4>
                              {(isPlayer1 ? log.player1Cards : log.player2Cards).map((card, i) => (
                                <div key={i} className="text-xs text-slate-300 mb-1">
                                  <span className="font-medium">{card.cardName}</span>
                                  <span className="text-slate-500 ml-1">
                                    Base: {card.basePower}
                                    {card.buffBonus !== 0 && <span className="text-cyan-400"> +{card.buffBonus}</span>}
                                    {card.debuffPenalty !== 0 && <span className="text-orange-400"> -{card.debuffPenalty}</span>}
                                  </span>
                                  <span className="text-green-400 ml-1">= {card.finalPower}</span>
                                  {card.traitName && card.traitValue && (
                                    <span className="text-purple-400 ml-2">({card.traitName}: {card.traitValue})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3">
                              <h4 className="text-red-400 text-sm font-medium mb-2">Opponent's Cards</h4>
                              {(isPlayer1 ? log.player2Cards : log.player1Cards).map((card, i) => (
                                <div key={i} className="text-xs text-slate-300 mb-1">
                                  <span className="font-medium">{card.cardName}</span>
                                  <span className="text-slate-500 ml-1">
                                    Base: {card.basePower}
                                    {card.buffBonus !== 0 && <span className="text-cyan-400"> +{card.buffBonus}</span>}
                                    {card.debuffPenalty !== 0 && <span className="text-orange-400"> -{card.debuffPenalty}</span>}
                                  </span>
                                  <span className="text-red-400 ml-1">= {card.finalPower}</span>
                                  {card.traitName && card.traitValue && (
                                    <span className="text-purple-400 ml-2">({card.traitName}: {card.traitValue})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center text-slate-400 py-8">
              No combat rounds recorded yet. Complete a combat phase to see history.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
