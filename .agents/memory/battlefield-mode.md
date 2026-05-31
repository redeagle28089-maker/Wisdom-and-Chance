---
name: Battlefield Mode architecture
description: Durable design decisions for Battlefield Mode that aren't obvious from reading the code.
---

## Single-card-per-round, not two
One player flips one FieldCard per round (alternating `battlefieldFlipPlayer`). The original spec said "both players flip," but the engine was settled on a single flip alternating between players — this is what all tests validate. Do not change to two simultaneous cards without updating the test suite.

**Why:** Simplifies state (one `activeFieldCard`) and prevents effect stacking conflicts between two simultaneous field cards.

## Phase order is battlefield → draw, not draw → battlefield
The `battlefield` phase fires before draw each round. The flip player sends `{ action: "battlefield_flip" }`. After that, both players proceed to draw normally.

**Why:** Field-card effects (e.g. deploy_limit_override, all_units_debuff) must be known before the draw/deploy decision so players can adapt their strategy that round.

## Spectator isolation
Spectators receive `spectator_battlefield_update` (not `game_state`) after the flip. Sending `game_state` to spectators would leak hand/deck info.

## Validation gate
Room start rejects if either player lacks a saved 7-card battlefield deck. This check fires server-side in `multiplayerRoutes.ts`, not client-side.
