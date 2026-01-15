import { Badge } from "@/components/ui/badge";
import { Flame, Droplet, Mountain, Wind, Leaf, Zap, Plus, Heart, Shield } from "lucide-react";
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
