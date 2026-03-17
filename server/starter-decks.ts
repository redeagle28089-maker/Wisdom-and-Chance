import { db } from "./db";
import { userDecks } from "@shared/schema";
import { eq } from "drizzle-orm";

const STARTER_DECKS = [
  { name: "Pyros's Inferno", commanderId: "commander-fire", element: "fire" },
  { name: "Aquara's Depths", commanderId: "commander-water", element: "water" },
  { name: "Terran's Fortress", commanderId: "commander-earth", element: "earth" },
  { name: "Zephyros's Storm", commanderId: "commander-air", element: "air" },
  { name: "Gaia's Grove", commanderId: "commander-nature", element: "nature" },
];

function buildCardIds(element: string): string[] {
  const ids: string[] = [];
  for (let power = 1; power <= 10; power++) {
    for (let variant = 0; variant < 4; variant++) {
      ids.push(`card-${element}-${power}-${variant}`);
    }
  }
  return ids;
}

export async function seedStarterDecks(userId: string): Promise<void> {
  const existingDecks = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(eq(userDecks.userId, userId))
    .limit(1);

  if (existingDecks.length > 0) return;

  const deckInserts = STARTER_DECKS.map((deck) => ({
    userId,
    name: deck.name,
    commanderId: deck.commanderId,
    cardIds: buildCardIds(deck.element),
  }));

  await db.insert(userDecks).values(deckInserts);
  console.log(`[starter-decks] Created 5 starter decks for user ${userId}`);
}
