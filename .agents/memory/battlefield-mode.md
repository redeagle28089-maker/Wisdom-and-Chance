---
name: Battlefield Mode architecture
description: Key design decisions and gotchas for the Battlefield Mode feature.
---

## Rule
One player flips one card per round (alternating `battlefieldFlipPlayer`); only that card's effects apply for the whole round. Not two cards simultaneously.

**Why:** The original spec said "both players' cards flip" but the engine settled on a single flip per round alternating between players — this is what the test suite validates.

**How to apply:** `active.activeFieldCard` is a single `FieldCard | null`, not an array. `battlefieldActiveCards` in sanitized state wraps it with `{ card, flippedByPlayerId }`.

## Phase order
`battlefield → draw → deployment → combat → (repeat)`

The `battlefield` phase fires **before** draw each round, not after. The flip player sends `game_action { action: "battlefield_flip" }`.

## Spectator events
Spectators receive `spectator_battlefield_update` (not `game_state`) after the flip, containing `activeCard` and `battlefieldModeEnabled`.

## Validation
Room start rejects if either player lacks a saved 7-card battlefield deck (`/api/decks/battlefield` PUT to save, GET /api/cards/battlefield for pool).

## Key files
- `server/gameEngine.ts` — `processBattlefieldPhase`, `calculateBattlePower`, `resolveCombat`
- `server/multiplayerRoutes.ts` — room creation + start validation
- `client/src/pages/game-board.tsx` — `BattlefieldZone` component, practice mode flip via `handleDraw`
- `scripts/test-multiplayer-hardening.mjs` — BF-CP1 through BF-CP6
