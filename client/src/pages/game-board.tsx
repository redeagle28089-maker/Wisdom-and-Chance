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
import { Heart, Swords, Trophy, Flag, ArrowRight, Shield, Flame, Droplet, Mountain, Wind, Leaf, RotateCcw, LogIn, MessageSquare, Eye, Send, X, Zap, Sparkles, Plus, Scroll, History } from "lucide-react";
import type { Game, Card as CardType, Element, BattlefieldCard, GameMode } from "@shared/schema";
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
}

function calculateBattlePower(
  friendlyCards: CardType[],
  enemyCards: CardType[],
  getCardById: (id: string) => CardType | undefined
): CardPowerBreakdown[] {
  return friendlyCards.map(card => {
    const basePower = card.power;
    const buffBonuses: { fromCard: CardType; amount: number }[] = [];
    const debuffPenalties: { fromCard: CardType; amount: number }[] = [];
    
    // Buffs from OTHER friendly cards that match this card's element
    friendlyCards.forEach(friendlyCard => {
      if (friendlyCard.id !== card.id && friendlyCard.buffModifier > 0 && friendlyCard.buffColor) {
        const buffElement = colorToElement[friendlyCard.buffColor];
        if (buffElement === card.element) {
          buffBonuses.push({ fromCard: friendlyCard, amount: friendlyCard.buffModifier });
        }
      }
    });
    
    // Debuffs from enemy cards that target this card's element
    enemyCards.forEach(enemyCard => {
      if (enemyCard.debuffModifier > 0 && enemyCard.debuffColor) {
        const debuffElement = colorToElement[enemyCard.debuffColor];
        if (debuffElement === card.element) {
          debuffPenalties.push({ fromCard: enemyCard, amount: enemyCard.debuffModifier });
        }
      }
    });
    
    const totalBuffs = buffBonuses.reduce((sum, b) => sum + b.amount, 0);
    const totalDebuffs = debuffPenalties.reduce((sum, d) => sum + d.amount, 0);
    const finalPower = Math.max(0, basePower + totalBuffs - totalDebuffs);
    
    const traitInfo = card.trait && card.traitValue !== null 
      ? { trait: card.trait, value: card.traitValue }
      : null;
    
    return {
      card,
      basePower,
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
  player2Total: number
): CombatSummary {
  const log: CombatLogEntry[] = [];
  let step = 1;
  
  // Track trait effects
  let player1QuickStrikeDamage = 0;
  let player2QuickStrikeDamage = 0;
  let player1GuardianBlocked = 0;
  let player2GuardianBlocked = 0;
  let player1Healing = 0;
  let player2Healing = 0;
  let player1CardsDrawn = 0;
  let player2CardsDrawn = 0;

  // Phase 1: Quick Strike (attacks first, deals damage before normal combat)
  const player1QuickStrikers = player1Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike");
  const player2QuickStrikers = player2Breakdown.filter(b => b.traitInfo?.trait === "Quick Strike");
  
  if (player1QuickStrikers.length > 0 || player2QuickStrikers.length > 0) {
    log.push({
      step: step++,
      phase: "quick_strike",
      description: "Quick Strike Phase - Fast attackers deal damage first!",
      icon: "zap",
      actor: "system"
    });
    
    player1QuickStrikers.forEach(b => {
      const damage = b.traitInfo!.value;
      player1QuickStrikeDamage += damage;
      log.push({
        step: step++,
        phase: "quick_strike",
        description: `[P1] ${b.card.name} strikes first! Deals ${damage} damage to P2.`,
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
        description: `[P2] ${b.card.name} strikes first! Deals ${damage} damage to P1.`,
        icon: "zap",
        actor: "player2",
        cardName: b.card.name,
        traitName: "Quick Strike",
        value: damage,
        targetAffected: "player1_hp"
      });
    });
  }

  // Phase 2: Power Calculation
  log.push({
    step: step++,
    phase: "power_calculation",
    description: "Power Calculation - Comparing total battlefield power...",
    icon: "calculator",
    actor: "system"
  });

  // Show power breakdown for each side (neutral perspective)
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

  // Phase 5: Restoration (healing)
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

  // Phase 6: Care Package (card draw)
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
    log
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
    <div className={`flex gap-2 p-2 rounded-lg ${isPlayer ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`} data-testid={`${isPlayer ? 'player' : 'opponent'}-counters`}>
      <div className="flex items-center gap-1" title="Advances (Victories)">
        <Trophy className="w-4 h-4 text-green-400" />
        <span className="text-green-300 font-bold text-sm" data-testid={`${isPlayer ? 'player' : 'opponent'}-victories`}>
          {victories}
        </span>
      </div>
      <div className="flex items-center gap-1" title="Withdrawals (Defeats)">
        <Flag className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 font-bold text-sm" data-testid={`${isPlayer ? 'player' : 'opponent'}-withdrawals`}>
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
    <div className={`relative rounded-xl overflow-hidden ${isPlayer ? 'bg-slate-800/80' : 'bg-slate-800/60'} border ${isPlayer ? 'border-green-500/30' : 'border-red-500/30'} p-3 min-w-[180px] ${shaking ? 'animate-damage-shake' : ''}`}>
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
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={`w-5 h-5 ${isPlayer ? 'text-green-400' : 'text-red-400'} ${isCritical ? 'animate-pulse' : ''}`} />
          <span className="text-white/70 text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-2xl font-bold transition-all ${isCritical ? 'text-red-400 animate-pulse' : shaking ? 'text-red-300 scale-110' : 'text-white'}`}>
            {current}
          </span>
          <span className="text-white/40 text-sm">/{max}</span>
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
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-xs">
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
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
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
      <span className={`text-sm font-medium bg-gradient-to-r ${phaseColors[currentPhase]} bg-clip-text text-transparent`}>
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
        className={`w-16 h-24 rounded-lg bg-gradient-to-br from-purple-800 to-purple-900 border-2 border-purple-500/50 flex items-center justify-center shadow-lg transition-all duration-300 ${isOnBattlefield ? 'animate-pulse' : ''}`}
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
      className={`relative w-16 h-24 rounded-lg ${config.bgColor} border-2 transition-all duration-200 cursor-pointer group
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
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-[slowPulse_2s_ease-in-out_infinite] z-20 opacity-80" />
      )}
      
      {/* Power/Rank badge - top left (always visible) */}
      <div className="absolute top-1 left-1 w-5 h-5 bg-slate-900/90 rounded flex items-center justify-center border border-white/30 z-10">
        <span className="text-white font-bold text-[10px]">{card.power}</span>
      </div>
      
      {/* Trait value badge - top right (always visible with icon) */}
      {(() => {
        const TraitIcon = card.trait ? traitIconsMap[card.trait] || Zap : null;
        return (
          <div className={`absolute top-1 right-1 h-5 px-0.5 rounded flex items-center justify-center gap-0.5 z-10 ${
            card.trait ? 'bg-purple-600/90 border border-purple-400/50' : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[8px] ${card.trait ? 'text-white' : 'text-slate-400'}`}>{card.trait ? (card.traitValue ?? 1) : 0}</span>
            {TraitIcon && <TraitIcon className="w-2.5 h-2.5 text-white" />}
          </div>
        );
      })()}
      
      {/* Buff indicator - bottom left (always visible - uses card's buff color) */}
      {(() => {
        const buffStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
        return (
          <div className={`absolute bottom-5 left-1 w-5 h-4 rounded flex items-center justify-center z-10 ${
            card.buffModifier > 0 
              ? buffStyle ? `${buffStyle.bg} ${buffStyle.border}` : 'bg-cyan-500/90 border border-cyan-300/50'
              : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[7px] ${card.buffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>+{card.buffModifier}</span>
          </div>
        );
      })()}
      
      {/* Debuff indicator - bottom right (always visible - uses card's debuff color) */}
      {(() => {
        const debuffStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];
        return (
          <div className={`absolute bottom-5 right-1 w-5 h-4 rounded flex items-center justify-center z-10 ${
            card.debuffModifier > 0 
              ? debuffStyle ? `${debuffStyle.bg} ${debuffStyle.border}` : 'bg-orange-500/90 border border-orange-300/50'
              : 'bg-slate-700/80 border border-slate-500/30'
          }`}>
            <span className={`font-bold text-[7px] ${card.debuffModifier > 0 ? 'text-white' : 'text-slate-400'}`}>-{card.debuffModifier}</span>
          </div>
        );
      })()}
      
      {/* Card name at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 py-0.5 text-center rounded-b-lg z-10">
        <p className="text-white text-[7px] truncate px-0.5 font-medium">{card.name.split(' ')[0]}</p>
      </div>
      {isHovered && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 px-2 py-0.5 rounded text-[9px] text-white whitespace-nowrap z-20 border border-purple-500/30">
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
    <div className="bg-slate-900/95 border border-purple-500/30 rounded-xl p-4 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  <span>Quick Strike: {yourQuickStrike} dmg to enemy</span>
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
                  <span>Quick Strike: {enemyQuickStrike} dmg to you</span>
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
    <div className={`relative rounded-xl border-2 ${isOpponent ? 'border-red-500/20 bg-gradient-to-b from-red-900/10 to-slate-800/30' : 'border-green-500/20 bg-gradient-to-t from-green-900/10 to-slate-800/30'} p-4`}>
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_${isOpponent ? '0%' : '100%'},_var(--tw-gradient-from)_0%,_transparent_70%)] ${isOpponent ? 'from-red-500/5' : 'from-green-500/5'}`} />
      </div>
      <p className={`${isOpponent ? 'text-red-300' : 'text-green-300'} text-xs font-medium mb-3 text-center uppercase tracking-wider`}>
        {isOpponent ? "Opponent's Field" : "Your Field"}
      </p>
      <div className="flex gap-3 justify-center min-h-[100px] items-center">
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
  const [selectedHistoryRound, setSelectedHistoryRound] = useState<number | null>(null);
  const combatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previousHandRef = useRef<string[] | null>(null);
  const previousBattlefieldRef = useRef<string[] | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const aiExecutingRef = useRef<string | null>(null);

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

  const getCardById = (instanceId: string) => {
    const cardId = getCardIdFromInstance(instanceId);
    return allCards.find((c) => c.id === cardId);
  };

  const isPlayer1 = game ? game.player1Id === user?.id : false;
  const myHP = game ? (isPlayer1 ? game.player1HP : game.player2HP) : GAME_CONSTANTS.STARTING_HP;
  const opponentHP = game ? (isPlayer1 ? game.player2HP : game.player1HP) : GAME_CONSTANTS.STARTING_HP;
  const myHand = game ? (isPlayer1 ? game.gameState.player1Hand : game.gameState.player2Hand) : [];
  const opponentHandSize = game ? (isPlayer1 ? game.gameState.player2Hand.length : game.gameState.player1Hand.length) : 0;
  const myBattlefield = game ? (isPlayer1 ? game.gameState.player1Battlefield : game.gameState.player2Battlefield) : [];
  const opponentBattlefield = game ? (isPlayer1 ? game.gameState.player2Battlefield : game.gameState.player1Battlefield) : [];
  const myDeckSize = game ? (isPlayer1 ? game.gameState.player1Deck.length : game.gameState.player2Deck.length) : 0;
  const opponentDeckSize = game ? (isPlayer1 ? game.gameState.player2Deck.length : game.gameState.player1Deck.length) : 0;
  const isMyTurn = game ? game.activePlayer === user?.id : false;
  
  // Get game mode config (draw/deploy counts)
  const gameMode: GameMode = game?.gameMode || "standard";
  const modeConfig = GAME_MODE_CONFIG[gameMode];
  const cardsToDraw = modeConfig.cardsToDraw;
  const cardsToDeploy = modeConfig.cardsToDeploy;

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
        const newGameState = { ...game.gameState };
        newGameState.player1Battlefield = newGameState.player1Battlefield.map(bf => ({ ...bf, faceDown: false }));
        newGameState.player2Battlefield = newGameState.player2Battlefield.map(bf => ({ ...bf, faceDown: false }));
        
        updateGameMutation.mutate({
          currentPhase: "calculation",
          gameState: newGameState,
        });
      } else if (game.currentPhase === "calculation") {
        const p1Cards = game.gameState.player1Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
        const p2Cards = game.gameState.player2Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
        
        const player1Breakdown = calculateBattlePower(p1Cards, p2Cards, getCardById);
        const player2Breakdown = calculateBattlePower(p2Cards, p1Cards, getCardById);
        
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
  }, [game, gameId, allCards, updateGameMutation, updateGameMutation.isPending, toast]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (combatTimerRef.current) {
        clearInterval(combatTimerRef.current);
      }
    };
  }, []);

  // Ref to hold the handleCalculation function (defined after loading check)
  const handleCalculationRef = useRef<(() => void) | null>(null);
  
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

  const handleCardSelect = (cardId: string) => {
    if (game.currentPhase !== "deployment" || !isMyTurn) return;
    
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId));
    } else if (selectedCards.length < cardsToDeploy) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleDraw = () => {
    if (game.currentPhase !== "draw" || !isMyTurn) return;

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

    // In practice mode, also have AI draw simultaneously
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
    toast({ title: "Drew 2 cards!" });
  };

  const handleDeploy = () => {
    if (selectedCards.length !== cardsToDeploy) {
      toast({ title: `Select ${cardsToDeploy} cards to deploy`, variant: "destructive" });
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
    
    // In practice mode, have AI deploy simultaneously
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
            // Mix high and low power cards based on cardsToDeploy
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

  const handleCombat = () => {
    const newGameState = { ...game.gameState };
    newGameState.player1Battlefield = newGameState.player1Battlefield.map((bf) => ({ ...bf, faceDown: false }));
    newGameState.player2Battlefield = newGameState.player2Battlefield.map((bf) => ({ ...bf, faceDown: false }));

    // Calculate power breakdowns for combat results display
    const p1Cards = newGameState.player1Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
    const p2Cards = newGameState.player2Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
    
    const player1Breakdown = calculateBattlePower(p1Cards, p2Cards, getCardById);
    const player2Breakdown = calculateBattlePower(p2Cards, p1Cards, getCardById);
    
    const player1Total = player1Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const player2Total = player2Breakdown.reduce((sum, b) => sum + b.finalPower, 0);
    const summary = generateCombatLog(player1Breakdown, player2Breakdown, player1Total, player2Total);
    
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

  const skipCombatTimer = () => {
    if (combatTimerRef.current) {
      clearInterval(combatTimerRef.current);
      combatTimerRef.current = null;
    }
    setCombatTimer(0);
  };

  const handleCalculation = () => {
    // Use the calculated breakdown if available, otherwise calculate now
    let player1Breakdown = combatBreakdown?.player1;
    let player2Breakdown = combatBreakdown?.player2;

    
    if (!player1Breakdown || !player2Breakdown) {
      const p1Cards = game.gameState.player1Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
      const p2Cards = game.gameState.player2Battlefield.map(bf => getCardById(bf.cardId)).filter(Boolean) as CardType[];
      player1Breakdown = calculateBattlePower(p1Cards, p2Cards, getCardById);
      player2Breakdown = calculateBattlePower(p2Cards, p1Cards, getCardById);
    }
    
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
      toast({ title: `Player 1 wins! ${damage} damage dealt.` });
    } else if (p2Power > p1Power) {
      newP1HP -= damage;
      newP2VP += 1;
      newP1WP += 1;
      toast({ title: `Player 2 wins! ${damage} damage dealt.` });
    } else {
      // Tie - both get +1 advance and +1 withdraw
      newP1VP += 1;
      newP2VP += 1;
      newP1WP += 1;
      newP2WP += 1;
      toast({ title: "Draw! Both players get +1 Advance and +1 Withdraw." });
    }

    const p1Yard = [...game.gameState.player1Yard, ...game.gameState.player1Battlefield.map((bf) => bf.cardId)];
    const p2Yard = [...game.gameState.player2Yard, ...game.gameState.player2Battlefield.map((bf) => bf.cardId)];

    const newGameState = {
      ...game.gameState,
      player1Battlefield: [],
      player2Battlefield: [],
      player1Yard: p1Yard,
      player2Yard: p2Yard,
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

    // Save combat log to game state for persistence
    // Map CardPowerBreakdown to schema format
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
    updateGameMutation.mutate({
      currentPhase: "draw",
      activePlayer: game.activePlayer === game.player1Id ? game.player2Id! : game.player1Id,
    });
  };

  if (game.status === "completed") {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center p-6">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
            <p className="text-purple-200 text-lg mb-6">
              {game.winnerId === user?.id ? "You won!" : "You lost!"}
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
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnimatedHPBar current={opponentHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={false} label="Opponent" previousHP={previousOpponentHP} />
            <VictoryWithdrawalCounter 
              victories={isPlayer1 ? game.player2VictoryPoints : game.player1VictoryPoints} 
              withdrawals={isPlayer1 ? game.player2WithdrawalPoints : game.player1WithdrawalPoints} 
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
            currentPhase={game.currentPhase} 
            isMyTurn={isMyTurn} 
            turn={game.currentTurn}
            combatHistoryCount={game.gameState.combatHistory?.length || 0}
            onViewCombatHistory={() => setShowCombatHistoryDialog(true)}
          />
          <div className="flex items-center gap-3">
            <VictoryWithdrawalCounter 
              victories={isPlayer1 ? game.player1VictoryPoints : game.player2VictoryPoints} 
              withdrawals={isPlayer1 ? game.player1WithdrawalPoints : game.player2WithdrawalPoints} 
              isPlayer={true} 
            />
            <AnimatedHPBar current={myHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={true} label="You" previousHP={previousMyHP} />
            <div className="flex items-center gap-2">
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

        <div className="bg-slate-800/30 rounded-xl border border-purple-500/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-300 text-xs font-medium uppercase tracking-wider">Opponent's Hand</span>
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <span>{opponentHandSize} cards</span>
              <span className="opacity-50">|</span>
              <span>Deck: {opponentDeckSize}</span>
            </div>
          </div>
          <div className="flex gap-1.5 justify-center min-h-[80px] items-center">
            {Array(Math.min(opponentHandSize, 10)).fill(0).map((_, i) => (
              <div 
                key={i} 
                className="w-10 h-16 rounded-lg bg-gradient-to-br from-purple-800 to-purple-950 border border-purple-500/30 shadow-lg transform transition-all hover:-translate-y-1"
                style={{ transform: `rotate(${(i - Math.floor(opponentHandSize / 2)) * 2}deg)` }}
              />
            ))}
            {opponentHandSize > 10 && (
              <Badge variant="secondary" className="text-xs">+{opponentHandSize - 10}</Badge>
            )}
          </div>
        </div>

        <BattlefieldZone 
          cards={opponentBattlefield} 
          isOpponent={true} 
          allCards={allCards}
          onPreview={setPreviewCard}
        />

        <div className="flex justify-center items-center gap-4">
          <Card className="bg-purple-900/50 border-purple-500/30 p-4">
            <div className="flex items-center gap-4">
              {game.currentPhase === "draw" && isMyTurn && (
                <Button onClick={handleDraw} className="bg-gradient-to-r from-cyan-600 to-blue-600" data-testid="button-draw">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Draw Cards
                </Button>
              )}
              {game.currentPhase === "deployment" && isMyTurn && (
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
              {game.currentPhase === "combat" && isMyTurn && (
                <Button onClick={handleCombat} className="bg-gradient-to-r from-red-600 to-orange-600" data-testid="button-combat">
                  <Swords className="w-4 h-4 mr-2" />
                  Reveal Cards
                </Button>
              )}
              {game.currentPhase === "calculation" && isMyTurn && !showCombatResults && (
                <Button onClick={handleCalculation} className="bg-gradient-to-r from-yellow-600 to-orange-600" data-testid="button-calculate">
                  <Trophy className="w-4 h-4 mr-2" />
                  Calculate Damage
                </Button>
              )}
              {game.currentPhase === "end" && isMyTurn && (
                <Button onClick={handleEndPhase} className="bg-gradient-to-r from-green-600 to-teal-600" data-testid="button-end">
                  <Flag className="w-4 h-4 mr-2" />
                  End Turn
                </Button>
              )}
              {!isMyTurn && (
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
        </div>

        <BattlefieldZone 
          cards={myBattlefield} 
          isOpponent={false} 
          allCards={allCards}
          onPreview={setPreviewCard}
          newlyDeployedCards={newlyDeployedCards}
        />

        {/* Combat Results Panel */}
        {showCombatResults && combatBreakdown && game.currentPhase === "calculation" && (
          <CombatResultPanel
            player1Breakdown={combatBreakdown.player1}
            player2Breakdown={combatBreakdown.player2}
            combatSummary={combatSummary}
            timer={combatTimer}
            onSkip={skipCombatTimer}
            isPlayer1={isPlayer1}
          />
        )}

        <div className="bg-gradient-to-t from-green-900/10 to-slate-800/30 rounded-xl border-2 border-green-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-green-300 text-xs font-medium uppercase tracking-wider">Your Hand</span>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span className="font-medium">{myHand.length} cards</span>
              <span className="opacity-50">|</span>
              <span>Deck: {myDeckSize}</span>
              {game.currentPhase === "deployment" && isMyTurn && (
                <Badge className="bg-purple-500/50 text-xs ml-2">
                  Select {cardsToDeploy - selectedCards.length} more
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-center min-h-[100px] items-center">
            {myHand.map((cardId) => {
              const card = getCardById(cardId);
              if (!card) return null;
              const isPlayable = game.currentPhase === "deployment" && isMyTurn;
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
        </div>
      </div>
      <CardPreviewDialog 
        card={previewCard} 
        open={!!previewCard} 
        onClose={() => setPreviewCard(null)} 
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

                {/* Step 3: Calculate Final Power */}
                <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                  <div className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                    <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs">STEP 3</span>
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

                {/* Step 4: Determine Winner */}
                <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4">
                  <div className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                    <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-xs">STEP 4</span>
                    Determine Winner & Damage
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <div className="text-lg mb-2">
                      <span className="text-green-400 font-bold">{isPlayer1 ? game.gameState.lastCombatLog.player1Total : game.gameState.lastCombatLog.player2Total}</span>
                      <span className="text-slate-400 mx-3">vs</span>
                      <span className="text-red-400 font-bold">{isPlayer1 ? game.gameState.lastCombatLog.player2Total : game.gameState.lastCombatLog.player1Total}</span>
                    </div>
                    {game.gameState.lastCombatLog.winner === "tie" ? (
                      <div className="text-yellow-400 text-xl font-bold">DRAW - No damage dealt</div>
                    ) : (
                      <>
                        <div className={`text-2xl font-bold ${
                          (isPlayer1 && game.gameState.lastCombatLog.winner === "player1") || 
                          (!isPlayer1 && game.gameState.lastCombatLog.winner === "player2") 
                            ? "text-green-400" 
                            : "text-red-400"
                        }`}>
                          {(isPlayer1 && game.gameState.lastCombatLog.winner === "player1") || 
                           (!isPlayer1 && game.gameState.lastCombatLog.winner === "player2") 
                            ? "YOU WIN THIS ROUND!" 
                            : "OPPONENT WINS THIS ROUND!"}
                        </div>
                        <div className="text-slate-300 mt-2">
                          Damage = |{isPlayer1 ? game.gameState.lastCombatLog.player1Total : game.gameState.lastCombatLog.player2Total} - {isPlayer1 ? game.gameState.lastCombatLog.player2Total : game.gameState.lastCombatLog.player1Total}| = <span className="text-amber-400 font-bold text-xl">{game.gameState.lastCombatLog.damage} HP</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
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
                              {isTie ? 'Draw' : youWon ? 'Won' : 'Lost'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-400">You: {yourTotal}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="text-red-400">Enemy: {enemyTotal}</span>
                            {!isTie && (
                              <Badge className={youWon ? 'bg-green-600/50' : 'bg-red-600/50'}>
                                {log.damage} dmg
                              </Badge>
                            )}
                          </div>
                        </div>
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
