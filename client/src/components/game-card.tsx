import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Flame, Droplet, Mountain, Wind, Leaf, Zap, Plus, Minus, Heart, Shield, Swords, Crown, HeartHandshake } from "lucide-react";
import type { ComponentType } from "react";
import type { Card as CardType, Element, Commander } from "@shared/schema";
import { ShieldC } from "@/components/shield-c";

import fireCardArt from "@assets/generated_images/fire_element_card_art.png";
import waterCardArt from "@assets/generated_images/water_element_card_art.png";
import earthCardArt from "@assets/generated_images/earth_element_card_art.png";
import airCardArt from "@assets/generated_images/air_element_card_art.png";
import natureCardArt from "@assets/generated_images/nature_element_card_art.png";

import fireCommanderArt from "@assets/generated_images/fire_commander_portrait.png";
import waterCommanderArt from "@assets/generated_images/water_commander_portrait.png";
import earthCommanderArt from "@assets/generated_images/earth_commander_portrait.png";
import airCommanderArt from "@assets/generated_images/air_commander_portrait.png";
import natureCommanderArt from "@assets/generated_images/nature_commander_portrait.png";

export const elementConfig: Record<Element, { 
  icon: typeof Flame; 
  color: string; 
  bgColor: string; 
  borderColor: string;
  solidBorder: string;
  cardArt: string;
  commanderArt: string;
  headerBg: string;
}> = {
  Fire: { 
    icon: Flame, 
    color: "text-red-500", 
    bgColor: "bg-gradient-to-br from-red-600 to-orange-600", 
    borderColor: "border-red-500/50",
    solidBorder: "border-red-500",
    headerBg: "bg-red-600",
    cardArt: fireCardArt,
    commanderArt: fireCommanderArt,
  },
  Water: { 
    icon: Droplet, 
    color: "text-blue-500", 
    bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600", 
    borderColor: "border-blue-500/50",
    solidBorder: "border-blue-500",
    headerBg: "bg-blue-600",
    cardArt: waterCardArt,
    commanderArt: waterCommanderArt,
  },
  Earth: { 
    icon: Mountain, 
    color: "text-amber-500", 
    bgColor: "bg-gradient-to-br from-amber-700 to-yellow-600", 
    borderColor: "border-amber-500/50",
    solidBorder: "border-orange-500",
    headerBg: "bg-orange-600",
    cardArt: earthCardArt,
    commanderArt: earthCommanderArt,
  },
  Air: { 
    icon: Wind, 
    color: "text-cyan-400", 
    bgColor: "bg-gradient-to-br from-cyan-400 to-teal-400", 
    borderColor: "border-cyan-400/50",
    solidBorder: "border-cyan-400",
    headerBg: "bg-cyan-600",
    cardArt: airCardArt,
    commanderArt: airCommanderArt,
  },
  Nature: { 
    icon: Leaf, 
    color: "text-green-500", 
    bgColor: "bg-gradient-to-br from-green-700 to-emerald-600", 
    borderColor: "border-green-500/50",
    solidBorder: "border-green-500",
    headerBg: "bg-green-600",
    cardArt: natureCardArt,
    commanderArt: natureCommanderArt,
  },
};

export const traitIcons: Record<string, typeof Zap> = {
  "Quick Strike": Zap,
  "Care Package": Plus,
  "Restoration": Heart,
  "Guardian": Shield,
};

// Land/field-card-only trait icons — structurally separate from card traits.
// hasNumber: false means no numeric slot is shown alongside the icon.
// Future land traits that carry a value should set hasNumber: true.
export const landTraitIcons: Record<string, { icon: ComponentType<{ className?: string }>; hasNumber: boolean }> = {
  "heal_doubled":       { icon: HeartHandshake, hasNumber: false },
  "guardian_disabled":  { icon: ShieldC,        hasNumber: false },
};

export const buffDebuffColorMap: Record<string, { bg: string; text: string; border: string }> = {
  Red: { bg: "bg-red-500/90", text: "text-white", border: "border-red-300/50" },
  Blue: { bg: "bg-blue-500/90", text: "text-white", border: "border-blue-300/50" },
  Amber: { bg: "bg-amber-500/90", text: "text-white", border: "border-amber-300/50" },
  Green: { bg: "bg-green-500/90", text: "text-white", border: "border-green-300/50" },
  Black: { bg: "bg-slate-800/90", text: "text-white", border: "border-slate-500/50" },
};

interface GameCardProps {
  card: CardType;
  size?: "sm" | "md" | "lg" | "xl";
  showArt?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
}

export function GameCard({ 
  card, 
  size = "md", 
  showArt = true, 
  onClick,
  selected = false,
  disabled = false,
  faceDown = false,
}: GameCardProps) {
  const config = elementConfig[card.element];
  const TraitIcon = card.trait ? traitIcons[card.trait] : null;

  // Standard card sizes - w-24 h-36 (96×144px) matches game board sizing
  const sizeClasses = {
    sm: "w-20 h-30",      // 80×120px - compact size
    md: "w-24 h-36",      // 96×144px - game board standard (default)
    lg: "w-32 h-48",      // 128×192px - larger display
    xl: "w-36 h-54",      // 144×216px - 50% bigger for Card Database/Deck Builder
  };

  if (faceDown) {
    return (
      <div
        className={`relative ${sizeClasses[size]} rounded-lg border-4 border-purple-600 overflow-hidden shadow-lg bg-gradient-to-br from-purple-900 to-slate-900`}
        data-testid={`card-${card.id}-facedown`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
            <span className="text-2xl text-purple-300">?</span>
          </div>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.5)_100%)]" />
      </div>
    );
  }

  // Get buff/debuff colors
  const buffColorStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
  const debuffColorStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`${sizeClasses[size]} rounded-lg border-2 ${config.solidBorder} overflow-hidden shadow-lg transition-all duration-200 bg-slate-900 flex flex-col
        ${onClick && !disabled ? "cursor-pointer hover-elevate" : ""}
        ${selected ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      data-testid={`card-${card.id}`}
    >
      {/* Header row with power and trait - fixed compact height */}
      <div className="flex items-center justify-between gap-1 px-1 py-0.5 bg-slate-800 shrink-0">
        <div className="min-w-5 h-5 px-1 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-xs border border-white/20" data-testid={`card-power-${card.id}`}>
          {card.power}
        </div>
        <div className={`min-w-5 h-5 px-1 rounded flex items-center justify-center font-bold text-[10px] gap-0.5 ${
          card.trait 
            ? 'bg-purple-600 text-white' 
            : 'bg-slate-700 text-slate-400'
        }`} data-testid={`card-trait-${card.id}`}>
          <span>{card.trait ? (card.traitValue ?? 1) : 0}</span>
          {TraitIcon && <TraitIcon className="w-2.5 h-2.5" />}
        </div>
      </div>
      
      {/* Full artwork section - fills remaining space, no overlays */}
      <div className="flex-1 min-h-0 relative">
        {showArt ? (
          <img 
            src={card.imageUrl || config.cardArt} 
            alt={card.element}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 ${config.bgColor} opacity-90`} />
        )}
      </div>
      
      {/* Footer with buff/debuff row - fixed compact height */}
      <div className="flex items-center gap-0.5 px-0.5 py-0.5 bg-slate-800 shrink-0">
        <div className={`flex-1 h-4 rounded-sm flex items-center justify-center font-bold text-[10px] ${
          card.buffModifier > 0 
            ? buffColorStyle ? `${buffColorStyle.bg} ${buffColorStyle.text}` : 'bg-cyan-600 text-white'
            : 'bg-slate-700 text-slate-400'
        }`} data-testid={`card-buff-${card.id}`}>
          +{card.buffModifier}
        </div>
        <div className={`flex-1 h-4 rounded-sm flex items-center justify-center font-bold text-[10px] ${
          card.debuffModifier > 0 
            ? debuffColorStyle ? `${debuffColorStyle.bg} ${debuffColorStyle.text}` : 'bg-orange-600 text-white'
            : 'bg-slate-700 text-slate-400'
        }`} data-testid={`card-debuff-${card.id}`}>
          -{card.debuffModifier}
        </div>
      </div>
      
      {/* Card name and UNIT label at bottom - fixed compact height */}
      <div className="bg-slate-900 py-0.5 text-center shrink-0">
        <p className="text-white font-semibold text-[9px] leading-tight truncate px-1">{card.name}</p>
        <span className="text-purple-300 font-bold text-[8px] tracking-wider">UNIT</span>
      </div>
    </div>
  );
}

interface CommanderCardProps {
  commander: Commander;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  selected?: boolean;
}

export function CommanderCard({ 
  commander, 
  size = "md", 
  onClick,
  selected = false,
}: CommanderCardProps) {
  const config = elementConfig[commander.element];
  const ElementIcon = config.icon;

  // Standard commander sizes - w-32 h-48 (128×192px) matches proportions
  const sizeClasses = {
    sm: "w-24 h-36",      // 96×144px - compact
    md: "w-32 h-48",      // 128×192px - standard (default)
    lg: "w-40 h-60",      // 160×240px - larger display
    xl: "w-48 h-72",      // 192×288px - 50% bigger for Card Database/Deck Builder
  };

  return (
    <div
      onClick={onClick}
      className={`relative ${sizeClasses[size]} rounded-xl overflow-hidden shadow-xl transition-all duration-200 bg-slate-800
        ${onClick ? "cursor-pointer hover-elevate" : ""}
        ${selected ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : ""}
      `}
      data-testid={`commander-${commander.id}`}
    >
      {/* Full artwork as background - fills entire card */}
      <img 
        src={commander.imageUrl || config.commanderArt} 
        alt={commander.name}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Top header bar with element - compact overlay */}
      <div className={`absolute top-0 left-0 right-0 ${config.headerBg} px-2 py-1 flex items-center gap-1.5 bg-opacity-90`}>
        <ElementIcon className="w-3 h-3 text-white" />
        <span className="text-white text-[10px] font-bold uppercase tracking-wide truncate">
          {commander.element} Commander
        </span>
      </div>
      
      {/* Bottom overlay with name and abilities - gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8 pb-2 px-2">
        {/* Commander name and title */}
        <h3 className="text-white font-bold text-sm leading-tight truncate">{commander.name}</h3>
        <p className="text-slate-300 text-[10px] truncate mb-1.5">{commander.title}</p>
        
        {/* Abilities as compact row of badges */}
        <div className="flex flex-wrap gap-1">
          {commander.abilities.slice(0, 3).map((ability, index) => (
            <Badge 
              key={index} 
              className="bg-purple-600/90 text-white text-[8px] px-1.5 py-0 h-4 truncate max-w-full"
            >
              {ability.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CardWithPopupProps extends GameCardProps {
  enablePopup?: boolean;
}

export function CardWithPopup({ enablePopup = true, ...props }: CardWithPopupProps) {
  const { card, onClick, disabled } = props;
  const config = elementConfig[card.element];
  const TraitIcon = card.trait ? traitIcons[card.trait] : null;

  if (!enablePopup || disabled) {
    return <GameCard {...props} />;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div data-testid={`card-popup-trigger-${card.id}`}>
          <GameCard {...props} onClick={onClick ?? (() => {})} />
        </div>
      </DialogTrigger>
      <DialogContent 
        className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-0 bg-slate-800 border-2 border-slate-600 shadow-2xl rounded-xl"
        data-testid="card-popup-dialog"
      >
        <DialogTitle className="sr-only">{card.name} Card Details</DialogTitle>
        
        {/* Header with card name and power */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex-1">
            <h3 className="text-white font-bold text-2xl" data-testid="card-popup-name">{card.name}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={`${config.headerBg} text-white text-sm px-3 py-1`} data-testid="card-popup-element">
                {card.element.toUpperCase()}
              </Badge>
              <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                WARRIOR
              </Badge>
              <Badge className="bg-orange-500 text-white text-sm px-3 py-1" data-testid="card-popup-rank">
                Rank {card.power}
              </Badge>
            </div>
          </div>
          <div className="bg-slate-700 rounded-xl px-6 py-3 text-center min-w-20" data-testid="card-popup-power">
            <span className="text-white font-bold text-4xl">{card.power}</span>
            <p className="text-slate-400 text-sm mt-1">Power</p>
          </div>
        </div>
        
        {/* Artwork - object-cover fills the frame (50% bigger than before) */}
        <div className="px-6 py-2 pt-[8px] pb-[8px]">
          <div className="rounded-xl overflow-hidden border-2 border-slate-600">
            <img 
              src={card.imageUrl || config.cardArt} 
              alt={card.name}
              className="w-full h-84 object-cover"
            />
          </div>
        </div>
        
        {/* Description */}
        <div className="px-6 py-3" data-testid="card-popup-description">
          <p className="text-slate-300 text-base leading-relaxed">
            {card.description || `A powerful ${card.element} unit wielding elemental forces. Each strike is a testament to mastery over ${card.element.toLowerCase()}, inflicting both physical and magical damage.`}
          </p>
        </div>

        {/* Trait section */}
        {card.trait && (
          <div className="mx-6 my-2 p-4 bg-slate-700/50 rounded-xl border border-slate-600" data-testid="card-popup-trait">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {TraitIcon && <TraitIcon className="w-6 h-6 text-yellow-400" />}
                <div>
                  <h4 className="text-white font-bold text-lg" data-testid="card-popup-trait-name">{card.trait}</h4>
                  <p className="text-slate-400 text-sm">Special Trait Ability</p>
                </div>
              </div>
              <Badge className="bg-yellow-600 text-white text-lg px-4 py-2 rounded-full" data-testid="card-popup-trait-value">
                {card.traitValue || 1}
              </Badge>
            </div>
          </div>
        )}

        {/* Buff/Debuff boxes at bottom (uses card's element colors) */}
        <div className="flex gap-4 p-6 pt-3">
          {(() => {
            const buffStyle = card.buffColor && buffDebuffColorMap[card.buffColor];
            return (
              <div className={`flex-1 p-4 rounded-xl ${buffStyle ? buffStyle.bg : config.headerBg}`} data-testid="card-popup-buff">
                <span className="text-white font-bold text-2xl">+{card.buffModifier}</span>
                <p className="text-white/80 text-sm mt-1">Buff: {card.buffColor?.toLowerCase() || card.element.toLowerCase()}</p>
              </div>
            );
          })()}
          {(() => {
            const debuffStyle = card.debuffColor && buffDebuffColorMap[card.debuffColor];
            return (
              <div className={`flex-1 p-4 rounded-xl ${debuffStyle ? debuffStyle.bg : 'bg-orange-600'}`} data-testid="card-popup-debuff">
                <span className="text-white font-bold text-2xl">-{card.debuffModifier}</span>
                <p className="text-white/80 text-sm mt-1">Debuff: {card.debuffColor?.toLowerCase() || card.element.toLowerCase()}</p>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getTargetLabel(target: string, effectType: string): string {
  if (!target) return "";

  if (target === "opponent") return "All Enemies";
  if (target === "deck") return "Your Deck";

  if (target.startsWith("enemy_non_")) {
    const elPart = target.replace("enemy_non_", "");
    const elName = elPart === "element" ? "Element" : elPart.charAt(0).toUpperCase() + elPart.slice(1);
    return `Single Non-${elName} Enemy`;
  }

  const elements = ["fire", "water", "earth", "air", "nature"];
  if (elements.includes(target.toLowerCase())) {
    const elName = target.charAt(0).toUpperCase() + target.slice(1);
    const allTargetEffects = ["first_strike", "cycle_element_cards", "prevent_ward"];
    if (allTargetEffects.includes(effectType)) return `All Friendly ${elName}`;
    if (effectType === "extra_deploy") return `Friendly ${elName} (Hand)`;
    return `Friendly ${elName} Unit`;
  }

  return target.charAt(0).toUpperCase() + target.slice(1);
}

interface CommanderWithPopupProps extends CommanderCardProps {
  enablePopup?: boolean;
}

export function CommanderWithPopup({ enablePopup = true, ...props }: CommanderWithPopupProps) {
  const { commander, onClick } = props;
  const config = elementConfig[commander.element];
  const ElementIcon = config.icon;

  if (!enablePopup) {
    return <CommanderCard {...props} />;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div data-testid={`commander-popup-trigger-${commander.id}`}>
          <CommanderCard {...props} onClick={onClick ?? (() => {})} />
        </div>
      </DialogTrigger>
      <DialogContent 
        className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-0 bg-slate-800 border-2 border-yellow-500/50 shadow-2xl rounded-xl"
        data-testid="commander-popup-dialog"
      >
        <DialogTitle className="sr-only">{commander.name} Commander Details</DialogTitle>
          
          {/* Header with element color */}
          <div className={`${config.headerBg} px-6 py-4 flex items-center gap-4`}>
            <ElementIcon className="w-8 h-8 text-white" />
            <div>
              <h3 className="text-white font-bold text-2xl" data-testid="commander-popup-name">{commander.name}</h3>
              <span className="text-white/80 text-sm uppercase tracking-wide" data-testid="commander-popup-element">
                {commander.element} Commander
              </span>
            </div>
          </div>

          {/* Commander artwork - object-cover fills the frame (50% bigger than before) */}
          <div className="relative">
            <img 
              src={commander.imageUrl || config.commanderArt} 
              alt={commander.name}
              className="w-full h-84 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-transparent to-transparent" />
          </div>

          {/* Title */}
          <div className="px-6 py-2 -mt-8 relative z-10">
            <Badge className="bg-yellow-600 text-white text-sm px-4 py-1" data-testid="commander-popup-title">
              {commander.title}
            </Badge>
          </div>

          {/* Description */}
          <div className="px-6 py-3 bg-slate-800" data-testid="commander-popup-description">
            <p className="text-slate-300 text-base leading-relaxed">
              {commander.description}
            </p>
          </div>
          
          {/* Abilities */}
          <div className="px-6 py-4 bg-slate-900/50 space-y-3" data-testid="commander-popup-abilities">
            <h4 className="text-purple-300 text-sm uppercase tracking-wider font-semibold">Commander Abilities</h4>
            {commander.abilities.map((ability, index) => {
              const costParts: string[] = [];
              if (ability.victoryCost > 0) costParts.push(`${ability.victoryCost} Advance`);
              if (ability.withdrawalCost > 0) costParts.push(`${ability.withdrawalCost} Withdraw`);
              const costLabel = costParts.length > 0 ? costParts.join(" + ") : "Free";

              const targetLabel = getTargetLabel(ability.effect.target || "", ability.effect.type || "");

              return (
                <div key={index} className="p-4 bg-slate-800/50 rounded-xl border border-slate-600" data-testid={`commander-popup-ability-${index}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-yellow-400 font-bold text-base" data-testid={`commander-popup-ability-name-${index}`}>{ability.name}</span>
                    <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5" data-testid={`commander-popup-ability-cost-${index}`}>
                      {costLabel}
                    </Badge>
                    {ability.phase && (
                      <Badge className={`text-white text-xs px-2 py-0.5 ${
                        ability.phase === "deployment" ? "bg-green-600" :
                        ability.phase === "combat" ? "bg-red-600" :
                        ability.phase === "draw" ? "bg-blue-600" :
                        ability.phase === "end" ? "bg-amber-600" : "bg-slate-600"
                      }`}>
                        {ability.phase.charAt(0).toUpperCase() + ability.phase.slice(1)} Phase
                      </Badge>
                    )}
                    {targetLabel && (
                      <Badge className={`text-xs px-2 py-0.5 ${
                        targetLabel.includes("Enemy") ? "bg-red-700 text-white" :
                        targetLabel.includes("Friendly") ? "bg-emerald-700 text-white" :
                        "bg-cyan-700 text-white"
                      }`} data-testid={`commander-popup-ability-target-${index}`}>
                        {targetLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed" data-testid={`commander-popup-ability-desc-${index}`}>{ability.description}</p>
                </div>
              );
            })}
          </div>
        </DialogContent>
    </Dialog>
  );
}

interface DeckBuilderCardProps {
  card: CardType;
  count: number;
  maxCopies: number;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function DeckBuilderCard({ 
  card, 
  count, 
  maxCopies, 
  canAdd, 
  onAdd, 
  onRemove 
}: DeckBuilderCardProps) {
  return (
    <div className="relative group" data-testid={`deck-card-wrapper-${card.id}`}>
      <CardWithPopup card={card} size="xl" />

      <div className="absolute bottom-1 left-1 pointer-events-none">
        <Badge 
          variant="secondary" 
          className={`text-xs font-bold pointer-events-auto ${count > 0 ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          data-testid={`deck-count-${card.id}`}
        >
          {count}/{maxCopies}
        </Badge>
      </div>

      <div className="absolute -bottom-1 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <Button
          size="sm"
          variant="destructive"
          className="rounded-full pointer-events-auto shadow-lg"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={count === 0}
          data-testid={`remove-${card.id}`}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="default"
          className="rounded-full pointer-events-auto shadow-lg"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          disabled={!canAdd}
          data-testid={`add-${card.id}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
