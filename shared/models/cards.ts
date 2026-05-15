import { z } from "zod";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    // Optional second numeric parameter used by effects that need two configurable
    // values (e.g. heal_and_buff uses `value` for the heal amount and
    // `secondaryValue` for the buff amount granted to target-element units).
    secondaryValue: z.number().int().min(0).max(20).optional(),
  })
  .superRefine((effect, ctx) => {
    const spec = ABILITY_EFFECT_BY_TYPE[effect.type];
    if (!spec) return;

    // ----- value -----
    if (spec.acceptsValue) {
      if (effect.value === undefined || effect.value < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `Effect '${effect.type}' requires a positive integer value (1-20).`,
        });
      }
    } else if (effect.value !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `Effect '${effect.type}' does not accept a value field.`,
      });
    }

    // ----- target -----
    if (spec.targetMode === "element") {
      if (effect.target === undefined || effect.target === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target"],
          message: `Effect '${effect.type}' requires a target element (one of: ${ELEMENT_TARGETS.join(", ")}).`,
        });
      } else {
        const t = effect.target.toLowerCase();
        if (!(ELEMENT_TARGETS as readonly string[]).includes(t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["target"],
            message: `Effect '${effect.type}' target must be one of: ${ELEMENT_TARGETS.join(", ")}.`,
          });
        }
      }
    } else if (spec.targetMode === "none" && effect.target !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target"],
        message: `Effect '${effect.type}' does not accept a target field.`,
      });
    }
  });

export type CommanderAbilityEffect = z.infer<typeof commanderAbilityEffectSchema>;

// ─── Battlefield (Field) Card types ──────────────────────────────────────────

export const FIELD_CARD_UNIQUE_EFFECTS = ["heal_doubled", "guardian_disabled"] as const;
export type FieldCardUniqueEffect = typeof FIELD_CARD_UNIQUE_EFFECTS[number];

export const FIELD_CARD_UNIQUE_EFFECT_LABELS: Record<FieldCardUniqueEffect, string> = {
  heal_doubled: "All healing doubled",
  guardian_disabled: "Guardian trait disabled",
};

const ELEMENTS_LOWERCASE = ["Fire", "Water", "Earth", "Air", "Nature"] as const;

export const fieldCardEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("deploy_limit_override"), value: z.number().int().min(1).max(4) }),
  z.object({ type: z.literal("element_buff"), element: z.enum(ELEMENTS_LOWERCASE), value: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("element_debuff"), element: z.enum(ELEMENTS_LOWERCASE), value: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("all_units_debuff"), value: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("unique_effect"), key: z.enum(FIELD_CARD_UNIQUE_EFFECTS) }),
]);

export type FieldCardEffect = z.infer<typeof fieldCardEffectSchema>;

export const fieldCardSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  effects: z.array(fieldCardEffectSchema).min(1).max(5),
  imageUrl: z.string().optional(),
});

export type FieldCard = z.infer<typeof fieldCardSchema>;
export const insertFieldCardSchema = fieldCardSchema.omit({ id: true });
export type InsertFieldCard = z.infer<typeof insertFieldCardSchema>;

// Drizzle table for battlefield cards
export const battlefieldCards = pgTable("battlefield_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  effects: jsonb("effects").notNull().default(sql`'[]'::jsonb`),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Drizzle table for each player's saved battlefield deck (exactly 7 card IDs)
export const playerBattlefieldDecks = pgTable("player_battlefield_decks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  cardIds: jsonb("card_ids").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Persisted card and commander tables. These hold AI-generated entries created
// via the admin generator so they survive server restarts. The seeded built-in
// cards/commanders continue to live in `MemStorage` only; on startup we hydrate
// the in-memory maps with the rows below so existing read paths keep working.
export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  element: varchar("element").notNull(),
  power: integer("power").notNull(),
  rarity: varchar("rarity"),
  trait: varchar("trait"),
  traitValue: integer("trait_value"),
  buffModifier: integer("buff_modifier").notNull().default(0),
  buffColor: varchar("buff_color"),
  debuffModifier: integer("debuff_modifier").notNull().default(0),
  debuffColor: varchar("debuff_color"),
  description: text("description"),
  imageUrl: text("image_url"),
  isCommander: boolean("is_commander").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CardRow = typeof cards.$inferSelect;

export const commanders = pgTable("commanders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  element: varchar("element").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  abilities: jsonb("abilities").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CommanderRow = typeof commanders.$inferSelect;
