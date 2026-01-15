import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Flame, Droplet, Mountain, Wind, Leaf, Zap, Plus, Heart, Shield, Swords, Crown } from "lucide-react";
import type { Card as CardType, Element, Commander } from "@shared/schema";

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

interface GameCardProps {
  card: CardType;
  size?: "sm" | "md" | "lg";
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

  const sizeClasses = {
    sm: "w-20",
    md: "w-full",
    lg: "w-48",
  };

  if (faceDown) {
    return (
      <div
        className={`relative ${sizeClasses[size]} aspect-[3/4] rounded-lg border-4 border-purple-600 overflow-hidden shadow-lg bg-gradient-to-br from-purple-900 to-slate-900`}
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

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`relative ${sizeClasses[size]} aspect-[3/4] rounded-lg border-4 ${config.solidBorder} overflow-hidden shadow-lg transition-all duration-200
        ${onClick && !disabled ? "cursor-pointer hover-elevate" : ""}
        ${selected ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      data-testid={`card-${card.id}`}
    >
      {showArt ? (
        <img 
          src={card.imageUrl || config.cardArt} 
          alt={card.element}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={`absolute inset-0 ${config.bgColor} opacity-90`} />
      )}
      
      {/* Power badge - top left */}
      <div className="absolute top-1.5 left-1.5 min-w-7 h-7 px-1.5 bg-slate-900/90 rounded flex items-center justify-center text-white font-bold text-sm shadow-lg border border-white/30">
        {card.power}
      </div>
      
      {/* Trait value badge - top right (shows traitValue + trait icon when card has a trait) */}
      {card.trait && card.traitValue !== null && (
        <div className="absolute top-1.5 right-1.5 min-w-7 h-7 px-1.5 bg-white/95 rounded flex items-center justify-center text-slate-900 font-bold text-xs shadow-lg gap-0.5">
          <span>{card.traitValue}</span>
          {TraitIcon && <TraitIcon className="w-3 h-3" />}
        </div>
      )}
      
      {/* Buff badge - bottom left */}
      <div className="absolute bottom-7 left-1.5 min-w-7 h-6 px-1.5 bg-green-500 rounded flex items-center justify-center text-white font-bold text-xs shadow-lg">
        +{card.buffModifier}
      </div>
      
      {/* Debuff badge - bottom right */}
      <div className="absolute bottom-7 right-1.5 min-w-7 h-6 px-1.5 bg-red-500 rounded flex items-center justify-center text-white font-bold text-xs shadow-lg">
        -{card.debuffModifier}
      </div>
      
      {/* UNIT label at bottom center */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 py-1.5 text-center">
        <span className="text-white font-bold text-xs tracking-wider">UNIT</span>
      </div>
    </div>
  );
}

interface CommanderCardProps {
  commander: Commander;
  size?: "sm" | "md" | "lg";
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

  const sizeClasses = {
    sm: "w-24",
    md: "w-full",
    lg: "w-56",
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
      {/* Header bar with element color */}
      <div className={`${config.headerBg} px-3 py-2 flex items-center gap-2`}>
        <ElementIcon className="w-4 h-4 text-white" />
        <span className="text-white text-xs font-bold uppercase tracking-wide">
          {commander.element} Commander
        </span>
      </div>
      
      {/* Commander name */}
      <div className="px-3 py-2 bg-slate-800">
        <h3 className="text-white font-bold text-sm">{commander.name}</h3>
        <p className="text-slate-400 text-xs">{commander.title}</p>
      </div>
      
      {/* Commander artwork */}
      <div className="relative aspect-video">
        <img 
          src={commander.imageUrl || config.commanderArt} 
          alt={commander.name}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Description */}
      <div className="px-3 py-2 bg-slate-800">
        <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
          {commander.description}
        </p>
      </div>
      
      {/* Abilities list */}
      <div className="px-3 py-2 bg-slate-900/50 space-y-1.5">
        {commander.abilities.slice(0, 3).map((ability, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-white text-xs font-medium flex-1">{ability.name}</span>
            <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0 h-4">
              P {ability.victoryCost || ability.withdrawalCost || 1}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardWithPopupProps extends GameCardProps {
  enablePopup?: boolean;
}

export function CardWithPopup({ enablePopup = true, ...props }: CardWithPopupProps) {
  const { card } = props;
  const config = elementConfig[card.element];
  const ElementIcon = config.icon;
  const TraitIcon = card.trait ? traitIcons[card.trait] : null;

  if (!enablePopup) {
    return <GameCard {...props} />;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <GameCard {...props} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-0 bg-slate-800 border-0 shadow-2xl z-50 rounded-xl overflow-hidden animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        {/* Header with card name and power */}
        <div className="flex items-start justify-between p-4 pb-2">
          <div>
            <h3 className="text-white font-bold text-lg">{card.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge className={`${config.headerBg} text-white text-xs px-2 py-0.5`}>
                {card.element.toUpperCase()}
              </Badge>
              <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5">
                WARRIOR
              </Badge>
              <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5">
                Rank {card.power}
              </Badge>
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg px-4 py-2 text-center min-w-16">
            <span className="text-white font-bold text-2xl">{card.power}</span>
            <p className="text-slate-400 text-xs">Power</p>
          </div>
        </div>
        
        {/* Artwork */}
        <div className="px-4 py-2">
          <div className="rounded-lg overflow-hidden">
            <img 
              src={card.imageUrl || config.cardArt} 
              alt={card.name}
              className="w-full h-44 object-cover"
            />
          </div>
        </div>
        
        {/* Description */}
        <div className="px-4 py-2">
          <p className="text-slate-300 text-sm leading-relaxed">
            {card.description || `A powerful ${card.element} unit wielding elemental forces. Each strike is a testament to mastery over ${card.element.toLowerCase()}, inflicting both physical and magical damage.`}
          </p>
        </div>

        {/* Trait section */}
        {card.trait && (
          <div className="mx-4 my-2 p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold text-sm uppercase tracking-wide">{card.trait}</h4>
                <p className="text-slate-400 text-xs">Special Trait Ability</p>
              </div>
              <Badge className="bg-slate-600 text-white text-sm px-3 py-1 rounded-full">
                {card.traitValue || 1}
              </Badge>
            </div>
          </div>
        )}

        {/* Buff/Debuff boxes at bottom */}
        <div className="flex gap-2 p-4 pt-2">
          <div className={`flex-1 p-3 rounded-lg ${config.headerBg}`}>
            <span className="text-white font-bold text-lg">+{card.buffModifier}</span>
            <p className="text-white/80 text-xs">Buff: {card.element.toLowerCase()}</p>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-red-800">
            <span className="text-white font-bold text-lg">-{card.debuffModifier}</span>
            <p className="text-white/80 text-xs">Debuff: {card.element.toLowerCase()}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface CommanderWithPopupProps extends CommanderCardProps {
  enablePopup?: boolean;
}

export function CommanderWithPopup({ enablePopup = true, ...props }: CommanderWithPopupProps) {
  const { commander } = props;
  const config = elementConfig[commander.element];
  const ElementIcon = config.icon;

  if (!enablePopup) {
    return <CommanderCard {...props} />;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <CommanderCard {...props} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-0 bg-slate-800 border-2 border-yellow-500/50 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        {/* Header with element color */}
        <div className={`${config.headerBg} px-4 py-2 flex items-center gap-2`}>
          <ElementIcon className="w-5 h-5 text-white" />
          <div>
            <h3 className="text-white font-bold text-lg">{commander.name}</h3>
            <span className="text-white/80 text-xs uppercase tracking-wide">
              {commander.element} Commander
            </span>
          </div>
        </div>

        {/* Artwork */}
        <div className="relative">
          <img 
            src={commander.imageUrl || config.commanderArt} 
            alt={commander.name}
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-transparent to-transparent" />
        </div>

        {/* Description */}
        <div className="px-4 py-3 bg-slate-800">
          <p className="text-slate-300 text-sm leading-relaxed">
            {commander.description}
          </p>
        </div>
        
        {/* Abilities */}
        <div className="px-4 py-3 bg-slate-900/50 space-y-2">
          <h4 className="text-purple-300 text-xs uppercase tracking-wider font-semibold">Commander Abilities</h4>
          {commander.abilities.map((ability, index) => (
            <div key={index} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-400 font-medium text-sm">{ability.name}</span>
                <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0 h-4">
                  P {ability.victoryCost || ability.withdrawalCost || 1}
                </Badge>
                {ability.phase === "deployment" && (
                  <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 h-4">
                    deployment
                  </Badge>
                )}
              </div>
              <p className="text-slate-400 text-xs">{ability.description}</p>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
