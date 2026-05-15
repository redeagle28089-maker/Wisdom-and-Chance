import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FieldCard, FieldCardEffect } from "@shared/schema";
import { FIELD_CARD_UNIQUE_EFFECT_LABELS } from "@shared/schema";
import { Mountain, Swords, Droplets, Flame, Wind, Leaf, Globe } from "lucide-react";
import { landTraitIcons } from "@/components/game-card";

function effectSummary(effect: FieldCardEffect): string {
  switch (effect.type) {
    case "deploy_limit_override":
      return `Deploy limit: ${effect.value}`;
    case "element_buff":
      return `All ${effect.element} +${effect.value}`;
    case "element_debuff":
      return `All ${effect.element} −${effect.value}`;
    case "all_units_debuff":
      return `All units −${effect.value}`;
    case "unique_effect":
      return FIELD_CARD_UNIQUE_EFFECT_LABELS[effect.key];
    default:
      return "";
  }
}

function ElementIcon({ element, className }: { element: string; className?: string }) {
  const cls = className ?? "w-3 h-3";
  switch (element) {
    case "Fire": return <Flame className={cls} />;
    case "Water": return <Droplets className={cls} />;
    case "Earth": return <Mountain className={cls} />;
    case "Air": return <Wind className={cls} />;
    case "Nature": return <Leaf className={cls} />;
    default: return <Globe className={cls} />;
  }
}

function UniqueEffectIcon({ effectKey, className }: { effectKey: string; className?: string }) {
  const cls = className ?? "w-3 h-3";
  const entry = landTraitIcons[effectKey];
  if (entry) {
    const Icon = entry.icon;
    return <Icon className={cls} />;
  }
  return <Swords className={cls} />;
}

function EffectPill({ effect }: { effect: FieldCardEffect }) {
  if (effect.type === "deploy_limit_override") {
    return (
      <div className="flex items-center gap-1 bg-amber-700/70 text-amber-100 rounded-sm px-1.5 py-0.5 text-[10px] font-bold">
        <Swords className="w-2.5 h-2.5" />
        <span>Deploy {effect.value}</span>
      </div>
    );
  }
  if (effect.type === "element_buff") {
    return (
      <div className="flex items-center gap-1 bg-emerald-700/70 text-emerald-100 rounded-sm px-1.5 py-0.5 text-[10px] font-bold">
        <ElementIcon element={effect.element} className="w-2.5 h-2.5" />
        <span>+{effect.value}</span>
      </div>
    );
  }
  if (effect.type === "element_debuff") {
    return (
      <div className="flex items-center gap-1 bg-red-800/70 text-red-100 rounded-sm px-1.5 py-0.5 text-[10px] font-bold">
        <ElementIcon element={effect.element} className="w-2.5 h-2.5" />
        <span>−{effect.value}</span>
      </div>
    );
  }
  if (effect.type === "all_units_debuff") {
    return (
      <div className="flex items-center gap-1 bg-red-900/70 text-red-200 rounded-sm px-1.5 py-0.5 text-[10px] font-bold">
        <Globe className="w-2.5 h-2.5" />
        <span>All −{effect.value}</span>
      </div>
    );
  }
  if (effect.type === "unique_effect") {
    return (
      <div
        className="flex items-center justify-center bg-purple-700/70 text-purple-100 rounded-sm px-1.5 py-0.5"
        title={FIELD_CARD_UNIQUE_EFFECT_LABELS[effect.key]}
      >
        <UniqueEffectIcon effectKey={effect.key} className="w-3 h-3" />
      </div>
    );
  }
  return null;
}

interface BattlefieldFieldCardProps {
  card: FieldCard;
  size?: "sm" | "md" | "xl";
  onClick?: () => void;
  selected?: boolean;
  showBothSidesBadge?: boolean;
}

export function BattlefieldFieldCard({ card, size = "md", onClick, selected, showBothSidesBadge }: BattlefieldFieldCardProps) {
  const hasDeployLimit = card.effects.some(e => e.type === "deploy_limit_override");
  const deployLimitEffect = card.effects.find(e => e.type === "deploy_limit_override");
  const deployLimitValue = deployLimitEffect?.type === "deploy_limit_override" ? deployLimitEffect.value : null;

  const hasUniqueEffect = card.effects.some(e => e.type === "unique_effect");
  const uniqueEffect = card.effects.find(e => e.type === "unique_effect");

  const widths: Record<string, string> = { sm: "w-[72px]", md: "w-[88px]", xl: "w-[130px]" };
  const heights: Record<string, string> = { sm: "h-[100px]", md: "h-[122px]", xl: "h-[180px]" };
  const nameSize: Record<string, string> = { sm: "text-[8px]", md: "text-[9px]", xl: "text-[11px]" };
  const cornerSize: Record<string, string> = { sm: "text-[9px] h-4 min-w-4", md: "text-[10px] h-5 min-w-5", xl: "text-xs h-6 min-w-6" };

  const cardContent = (
    <div
      className={`
        relative flex flex-col bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900
        border-2 rounded-lg overflow-hidden cursor-pointer select-none
        transition-all duration-150
        ${selected ? "border-teal-400 ring-2 ring-teal-400/50 shadow-lg shadow-teal-500/20" : "border-teal-600/50 hover:border-teal-400/80"}
        ${widths[size]} ${heights[size]}
      `}
      onClick={onClick}
      data-testid={`battlefield-card-${card.id}`}
    >
      {/* Art area / background */}
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 via-slate-800/60 to-indigo-900/40" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-slate-900/60" />

      {/* Header row */}
      <div className="relative flex items-center justify-between px-0.5 py-0.5 shrink-0">
        {/* Upper-left: deploy limit number (or "?" for non-limit cards) */}
        <div
          className={`${cornerSize[size]} px-1 rounded flex items-center justify-center font-bold
            ${hasDeployLimit ? "bg-amber-600 text-amber-100" : "bg-slate-800/80 text-slate-400"}
          `}
          title={hasDeployLimit ? `Deploy limit: ${deployLimitValue}` : "No deploy limit change"}
          data-testid={`battlefield-card-deploy-${card.id}`}
        >
          {hasDeployLimit ? deployLimitValue : "—"}
        </div>

        {/* Upper-right: unique effect icon or empty */}
        <div
          className={`${cornerSize[size]} px-1 rounded flex items-center justify-center
            ${hasUniqueEffect ? "bg-purple-700 text-purple-100" : "bg-transparent"}
          `}
        >
          {hasUniqueEffect && uniqueEffect?.type === "unique_effect" && (
            <UniqueEffectIcon effectKey={uniqueEffect.key} className="w-2.5 h-2.5" />
          )}
        </div>
      </div>

      {/* Middle spacer */}
      <div className="flex-1" />

      {/* Name */}
      <div className="relative px-1 pb-0.5">
        <p className={`text-white font-bold leading-tight text-center ${nameSize[size]}`} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
          {card.name}
        </p>
      </div>

      {/* Affects-both badge (optional) */}
      {showBothSidesBadge && (
        <div className="relative px-1 pb-0.5 flex justify-center">
          <span className="text-[8px] text-teal-300/80 font-medium">affects both sides</span>
        </div>
      )}

      {/* Effects row */}
      <div className="relative flex flex-wrap gap-0.5 px-0.5 pb-0.5 justify-center">
        {card.effects.map((effect, i) => (
          <EffectPill key={i} effect={effect} />
        ))}
      </div>
    </div>
  );

  const tooltipText = card.effects.map(effectSummary).join(" • ");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-slate-900 border-teal-500/30">
          <p className="font-bold text-teal-300 mb-1">{card.name}</p>
          <p className="text-slate-300 text-xs mb-2">{card.description}</p>
          <p className="text-teal-200 text-xs font-medium">{tooltipText}</p>
          <p className="text-slate-500 text-[10px] mt-1 italic">Affects both players</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
