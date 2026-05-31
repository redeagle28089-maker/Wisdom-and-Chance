---
name: Unit traits (14 total)
description: Full trait list, Banish Zone mechanic, and test coverage notes.
---

## Trait list (shared/schema.ts TRAITS array)
Original 4: Quick Strike, Care Package, Restoration, Guardian
New 10: Infiltrator, Hold the Line, Rally, Saboteur, Steadfast, Tactician, Flanking, Vanguard, Reserve, Last Stand

## Banish Zone
Cards with Reserve/Infiltrator/Hold-the-Line go to Banish (not discard) after combat. Exposed as `player1Banish`/`player2Banish` in gameState, counts in `myBanishCount`/`opponentBanishCount` in sanitized state. Visualised as violet dashed zone with ✦ icon in game-board.

## Combat trait mechanics
- **Last Stand**: always contributes `traitValue` direct damage to opponent pilot, even if the unit loses — bypass Guardian.
- **Infiltrator**: winning unit stays on battlefield with `persisted: true` for one extra round.
- **Hold the Line**: unit survives with `persisted: true, modifiedPower: 1` for one extra round.
- **Reserve**: once-per-game deploy from yard; card goes to Banish after combat, not yard.
- **Flanking**: grants +1 to maxDeploy for the deployment phase when in hand.
- **Vanguard**: auto-deploys the top-of-deck card if its power ≤ vanguard's power.
- **Rally**: amplifies friendly buff card bonuses by `traitValue`.
- **Saboteur**: amplifies friendly debuff card maluses by `traitValue`.
- **Steadfast**: reduces incoming debuffs by `traitValue`.
- **Tactician**: amplifies own unit's power by `traitValue` for each active buff.

## Test coverage
`scripts/test-new-traits.mjs` — 10 checkpoints. CPs 2–9 require cards with new traits in the DB (create via Admin AI Generator). CP7 (Banish persistence) and CP10 (schema) pass without new DB cards.

**Why CPs fail without DB cards:** trait logic is validated server-side but the test creates games using existing cards. Once admin generates cards with new trait values, re-run the script.
