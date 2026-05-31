---
name: Unit traits — Banish Zone + 10 new traits
description: Non-obvious rules for the new traits and Banish Zone that future work must stay consistent with.
---

## Banish Zone is permanent — cards never return
Cards that go to Banish (Reserve after combat, Infiltrator/Hold-the-Line after their persistence round) cannot be retrieved. This is intentional — do not add "return from Banish" without a game-design decision.

**Why:** Banish is the counterbalance for the power advantage these traits provide (surviving one extra round or dealing guaranteed damage).

## Last Stand bypasses Guardian
Last Stand damage is applied after the Guardian shield absorption calculation, so Guardian cannot block it. This is intentional and must be preserved in any combat refactor.

## Reserve once-per-game flag lives in gameState
`player1UsedReserve` / `player2UsedReserve` on the gameState object. The engine reads this flag and rejects a second Reserve deploy. If you add new once-per-game mechanics, follow the same pattern.

## Test script requires DB cards
`scripts/test-new-traits.mjs` CPs 2–9 skip gracefully with a warning when no cards with new trait names exist in the DB. They only assert when matching cards are found. This is by design — trait schema is compile-time verified (CP10), and combat-path CPs require the admin to generate cards via the AI Generator first.
