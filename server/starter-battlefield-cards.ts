import { db } from "./db";
import { battlefieldCards } from "@shared/schema";
import { sql } from "drizzle-orm";

const STARTER_FIELD_CARDS = [
  {
    id: "bf-volcanic-surge",
    name: "Volcanic Surge",
    description: "The earth trembles and volcanic energy surges across the field, empowering Fire units on both sides.",
    effects: [{ type: "element_buff", element: "Fire", value: 2 }],
  },
  {
    id: "bf-tidal-crash",
    name: "Tidal Crash",
    description: "Crashing tidal waves flood the battlefield, boosting Water units while dousing Fire.",
    effects: [
      { type: "element_buff", element: "Water", value: 2 },
      { type: "element_debuff", element: "Fire", value: 1 },
    ],
  },
  {
    id: "bf-sacred-ground",
    name: "Sacred Ground",
    description: "Hallowed terrain pulses with restorative energy, doubling all healing effects across the field.",
    effects: [{ type: "unique_effect", key: "heal_doubled" }],
  },
  {
    id: "bf-narrow-pass",
    name: "Narrow Pass",
    description: "A tight mountain corridor forces both armies to deploy only a single unit per turn.",
    effects: [{ type: "deploy_limit_override", value: 1 }],
  },
  {
    id: "bf-grand-cannon",
    name: "Grand Cannon",
    description: "Open plains and a commanding position allow both commanders to deploy up to four units each turn.",
    effects: [{ type: "deploy_limit_override", value: 4 }],
  },
  {
    id: "bf-open-field",
    name: "Open Field",
    description: "Featureless terrain offers no cover, rendering Guardian abilities useless for both sides.",
    effects: [{ type: "unique_effect", key: "guardian_disabled" }],
  },
  {
    id: "bf-elemental-storm",
    name: "Elemental Storm",
    description: "A raging storm of conflicting elemental energies weakens every unit on the field.",
    effects: [{ type: "all_units_debuff", value: 1 }],
  },
];

export async function seedBattlefieldCards(): Promise<void> {
  try {
    for (const card of STARTER_FIELD_CARDS) {
      await db.execute(sql`
        INSERT INTO battlefield_cards (id, name, description, effects, image_url, created_at)
        VALUES (
          ${card.id},
          ${card.name},
          ${card.description},
          ${JSON.stringify(card.effects)}::jsonb,
          NULL,
          now()
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
    console.log(`[starter-battlefield-cards] Seeded ${STARTER_FIELD_CARDS.length} starter battlefield cards`);
  } catch (error) {
    console.error("[starter-battlefield-cards] Failed to seed battlefield cards:", error);
  }
}
