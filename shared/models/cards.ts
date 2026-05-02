import { z } from "zod";

export const ALLOWED_ABILITY_EFFECTS = [
  {
    type: "direct_damage",
    description: "Deal direct damage to the opposing player.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "none",
  },
  {
    type: "element_power_damage",
    description: "Deal damage equal to your total commander-element unit power to the opposing player.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "buff_element_unit",
    description: "Add a +value buff to all friendly units of the target element this battle.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "element",
  },
  {
    type: "extra_deploy",
    description: "Grant +value extra deployment slots this turn.",
    acceptsValue: true,
    defaultValue: 1,
    targetMode: "none",
  },
  {
    type: "cycle_element_cards",
    description: "Shuffle target-element cards in your hand back into your deck and draw the same number.",
    acceptsValue: false,
    targetMode: "element",
  },
  {
    type: "block_effects",
    description: "Block all enemy commander effects until your next turn.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "negate_and_halve",
    description: "Negate enemy commander effects and halve non-commander-element unit power next combat.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "healing_factor",
    description: "Add a healing factor of value to friendly target-element units this battle.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "element",
  },
  {
    type: "draw_cards",
    description: "Draw value extra cards from your deck.",
    acceptsValue: true,
    defaultValue: 2,
    targetMode: "none",
  },
  {
    type: "protect_element",
    description: "Protect friendly target-element units from enemy effects this battle.",
    acceptsValue: false,
    targetMode: "element",
  },
  {
    type: "debuff_enemy",
    description: "Debuff all enemy units by -value this battle.",
    acceptsValue: true,
    defaultValue: 3,
    targetMode: "none",
  },
  {
    type: "swap_units",
    description: "Swap one unit on your battlefield with one unit in your hand.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "revive_unit",
    description: "Revive the most recent unit from your yard back to your hand.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "growth_buff",
    description: "Add a growing +value buff to friendly target-element units this battle.",
    acceptsValue: true,
    defaultValue: 2,
    targetMode: "element",
  },
  {
    type: "prevent_ward",
    description: "Prevent the target element from being sent to the medical ward this battle.",
    acceptsValue: false,
    targetMode: "element",
  },
  {
    type: "destroy_unit",
    description: "Destroy one non-commander-element enemy unit on the battlefield.",
    acceptsValue: false,
    targetMode: "none",
  },
  {
    type: "add_shield",
    description: "Add a +value shield to friendly target-element units this battle.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "element",
  },
  {
    type: "reduce_power",
    description: "Reduce all non-commander-element enemy unit power by -value this battle.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "none",
  },
  {
    type: "first_strike",
    description: "Grant first-strike +value damage to friendly target-element units this battle.",
    acceptsValue: true,
    defaultValue: 3,
    targetMode: "element",
  },
  {
    type: "add_evasion",
    description: "Grant +value evasion (shield) to friendly target-element units this battle.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "element",
  },
  {
    type: "set_power",
    description: "Set one non-commander-element enemy unit's power to value.",
    acceptsValue: true,
    defaultValue: 1,
    targetMode: "none",
  },
  {
    type: "restore_from_ward",
    description: "Restore value units from your yard back to your deck.",
    acceptsValue: true,
    defaultValue: 3,
    targetMode: "none",
  },
  {
    type: "heal_and_buff",
    description: "Heal value HP and add a +2 heal-buff to friendly target-element units.",
    acceptsValue: true,
    defaultValue: 4,
    targetMode: "element",
  },
] as const;

export type AllowedAbilityEffect = typeof ALLOWED_ABILITY_EFFECTS[number];
export type AbilityEffectType = AllowedAbilityEffect["type"];

export const ABILITY_EFFECT_TYPES = ALLOWED_ABILITY_EFFECTS.map(e => e.type) as [AbilityEffectType, ...AbilityEffectType[]];

const ABILITY_EFFECT_BY_TYPE: Record<string, AllowedAbilityEffect> = Object.fromEntries(
  ALLOWED_ABILITY_EFFECTS.map(e => [e.type, e])
);

const ELEMENT_TARGETS = ["fire", "water", "earth", "air", "nature"] as const;

export const commanderAbilityEffectSchema = z
  .object({
    type: z.enum(ABILITY_EFFECT_TYPES),
    value: z.number().int().min(0).max(20).optional(),
    target: z.string().optional(),
  })
  .superRefine((effect, ctx) => {
    const spec = ABILITY_EFFECT_BY_TYPE[effect.type];
    if (!spec) return;

    if (spec.acceptsValue) {
      if (effect.value === undefined || effect.value < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `Effect '${effect.type}' requires a positive integer value (1-20).`,
        });
      }
    }

    if (spec.targetMode === "element" && effect.target !== undefined) {
      const t = effect.target.toLowerCase();
      if (!(ELEMENT_TARGETS as readonly string[]).includes(t)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target"],
          message: `Effect '${effect.type}' target must be one of: ${ELEMENT_TARGETS.join(", ")}.`,
        });
      }
    }
  });

export type CommanderAbilityEffect = z.infer<typeof commanderAbilityEffectSchema>;
