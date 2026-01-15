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
  cardArt: string;
  commanderArt: string;
}> = {
  Fire: { 
    icon: Flame, 
    color: "text-red-500", 
    bgColor: "bg-gradient-to-br from-red-600 to-orange-600", 
    borderColor: "border-red-500/50",
    cardArt: fireCardArt,
    commanderArt: fireCommanderArt,
  },
  Water: { 
    icon: Droplet, 
    color: "text-blue-500", 
    bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600", 
    borderColor: "border-blue-500/50",
    cardArt: waterCardArt,
    commanderArt: waterCommanderArt,
  },
  Earth: { 
    icon: Mountain, 
    color: "text-amber-500", 
    bgColor: "bg-gradient-to-br from-amber-700 to-yellow-600", 
    borderColor: "border-amber-500/50",
    cardArt: earthCardArt,
    commanderArt: earthCommanderArt,
  },
  Air: { 
    icon: Wind, 
    color: "text-green-400", 
    bgColor: "bg-gradient-to-br from-green-400 to-teal-400", 
    borderColor: "border-green-400/50",
    cardArt: airCardArt,
    commanderArt: airCommanderArt,
  },
  Nature: { 
    icon: Leaf, 
    color: "text-emerald-500", 
    bgColor: "bg-gradient-to-br from-green-700 to-emerald-600", 
    borderColor: "border-emerald-500/50",
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
  const ElementIcon = config.icon;
  const TraitIcon = card.trait ? traitIcons[card.trait] : null;

  const sizeClasses = {
    sm: "w-20",
    md: "w-full",
    lg: "w-48",
  };

  if (faceDown) {
    return (
      <div
        className={`relative ${sizeClasses[size]} aspect-[3/4] rounded-lg border-2 border-purple-500/50 overflow-hidden shadow-lg bg-gradient-to-br from-purple-900 to-slate-900`}
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
      className={`relative ${sizeClasses[size]} aspect-[3/4] rounded-lg border-2 ${config.borderColor} overflow-hidden shadow-lg transition-all duration-200
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
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      <div className="relative h-full p-2 flex flex-col">
        <div className="flex justify-between items-start">
          <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg border border-white/20">
            {card.power}
          </div>
          <div className="flex gap-1">
            {TraitIcon && (
              <div className="w-6 h-6 bg-black/60 rounded flex items-center justify-center border border-yellow-400/30">
                <TraitIcon className="w-4 h-4 text-yellow-400" />
              </div>
            )}
            <div className="w-6 h-6 bg-black/60 rounded flex items-center justify-center border border-white/20">
              <ElementIcon className={`w-4 h-4 ${config.color}`} />
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <div className="bg-black/70 rounded px-2 py-1 backdrop-blur-sm">
            <h3 className="text-white font-bold text-xs truncate">{card.name}</h3>
          </div>
          <div className="flex justify-between mt-1 gap-1">
            {card.buffModifier > 0 && (
              <Badge variant="secondary" className="bg-green-600/90 text-white text-xs px-1 border border-green-400/30">
                +{card.buffModifier}
              </Badge>
            )}
            {card.debuffModifier > 0 && (
              <Badge variant="secondary" className="bg-red-600/90 text-white text-xs px-1 ml-auto border border-red-400/30">
                -{card.debuffModifier}
              </Badge>
            )}
          </div>
        </div>
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
      className={`relative ${sizeClasses[size]} aspect-[3/4] rounded-lg border-2 ${config.borderColor} overflow-hidden shadow-xl transition-all duration-200
        ${onClick ? "cursor-pointer hover-elevate" : ""}
        ${selected ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : ""}
      `}
      data-testid={`commander-${commander.id}`}
    >
      <img 
        src={commander.imageUrl || config.commanderArt} 
        alt={commander.name}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start">
        <div className="px-2 py-1 bg-yellow-500/90 rounded text-xs font-bold text-black border border-yellow-300">
          COMMANDER
        </div>
        <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center border border-white/20">
          <ElementIcon className={`w-5 h-5 ${config.color}`} />
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="bg-black/80 rounded-lg p-2 backdrop-blur-sm border border-white/10">
          <h3 className="text-white font-bold text-sm">{commander.name}</h3>
          <p className="text-purple-300 text-xs italic">{commander.title}</p>
        </div>
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
        className="w-72 p-0 bg-slate-900 border-2 border-purple-500/50 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="relative">
          <img 
            src={card.imageUrl || config.cardArt} 
            alt={card.name}
            className="w-full h-36 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <div className={`w-10 h-10 ${config.bgColor} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/30`}>
              {card.power}
            </div>
          </div>
          <div className="absolute top-2 right-2 flex gap-1">
            <div className={`px-2 py-1 ${config.bgColor} rounded text-xs font-bold text-white flex items-center gap-1`}>
              <ElementIcon className="w-3 h-3" />
              {card.element}
            </div>
          </div>
        </div>
        
        <div className="p-3 space-y-3">
          <div>
            <h3 className="text-white font-bold text-lg">{card.name}</h3>
            <p className="text-purple-300 text-sm">Unit Card</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/30 text-center">
              <p className="text-purple-200/70 text-xs mb-1">Power Rank</p>
              <span className="text-purple-300 font-bold text-xl">{card.power}</span>
            </div>
            <div className={`p-2 ${config.bgColor}/10 rounded-lg border ${config.bgColor.replace('bg-', 'border-')}/30 text-center`}>
              <p className="text-slate-300/70 text-xs mb-1">Element</p>
              <div className="flex items-center justify-center gap-1">
                <ElementIcon className={`w-4 h-4 ${config.color}`} />
                <span className={`${config.color} font-bold`}>{card.element}</span>
              </div>
            </div>
          </div>

          {card.trait && (
            <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              {TraitIcon && <TraitIcon className="w-4 h-4 text-yellow-400" />}
              <div>
                <p className="text-yellow-200/70 text-xs">Trait</p>
                <p className="text-yellow-400 font-medium text-sm">{card.trait}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className={`flex-1 p-2 rounded-lg border text-center ${card.buffModifier > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
              <p className={`text-xs mb-1 ${card.buffModifier > 0 ? 'text-green-200/70' : 'text-slate-400'}`}>Buff</p>
              <div className="flex items-center justify-center gap-1">
                <Swords className={`w-4 h-4 ${card.buffModifier > 0 ? 'text-green-400' : 'text-slate-500'}`} />
                <span className={`font-bold text-lg ${card.buffModifier > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                  {card.buffModifier > 0 ? `+${card.buffModifier}` : '0'}
                </span>
              </div>
            </div>
            <div className={`flex-1 p-2 rounded-lg border text-center ${card.debuffModifier > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
              <p className={`text-xs mb-1 ${card.debuffModifier > 0 ? 'text-red-200/70' : 'text-slate-400'}`}>Debuff</p>
              <div className="flex items-center justify-center gap-1">
                <Shield className={`w-4 h-4 ${card.debuffModifier > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                <span className={`font-bold text-lg ${card.debuffModifier > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {card.debuffModifier > 0 ? `-${card.debuffModifier}` : '0'}
                </span>
              </div>
            </div>
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
        className="w-80 p-0 bg-slate-900 border-2 border-yellow-500/50 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="relative">
          <img 
            src={commander.imageUrl || config.commanderArt} 
            alt={commander.name}
            className="w-full h-44 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          <div className="absolute top-2 left-2">
            <Badge className="bg-yellow-500 text-black font-bold border border-yellow-300">
              <Crown className="w-3 h-3 mr-1" />
              COMMANDER
            </Badge>
          </div>
          <div className="absolute top-2 right-2">
            <div className={`px-2 py-1 ${config.bgColor} rounded text-xs font-bold text-white flex items-center gap-1`}>
              <ElementIcon className="w-3 h-3" />
              {commander.element}
            </div>
          </div>
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="text-white font-bold text-xl drop-shadow-lg">{commander.name}</h3>
            <p className="text-purple-300 text-sm italic drop-shadow-lg">{commander.title}</p>
          </div>
        </div>
        
        <div className="p-3 space-y-3">
          <div>
            <h4 className="text-purple-300 text-xs uppercase tracking-wider font-semibold mb-2">Commander Abilities</h4>
            <div className="space-y-2">
              {commander.abilities.map((ability, index) => (
                <div key={index} className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <p className="text-yellow-400 font-medium text-sm">{ability.name}</p>
                  <p className="text-purple-200 text-xs mt-1">{ability.description}</p>
                  {(ability.victoryCost > 0 || ability.withdrawalCost > 0) && (
                    <div className="flex gap-2 mt-1">
                      {ability.victoryCost > 0 && (
                        <span className="text-green-400 text-xs">Victory: {ability.victoryCost}</span>
                      )}
                      {ability.withdrawalCost > 0 && (
                        <span className="text-red-400 text-xs">Defeat: {ability.withdrawalCost}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
