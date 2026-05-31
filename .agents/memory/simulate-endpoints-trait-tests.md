---
name: Simulate endpoints for trait tests
description: Why PATCH /api/games/:id fails for combat trait tests, and the correct approach.
---

Practice-mode games use client-side combat resolution — the server's `PATCH /api/games/:id` endpoint with `action: 'end_turn'` does NOT invoke `ServerGameEngine` for practice games. Any test that patches a practice game to resolve combat will see zero trait effects.

**Correct approach**: use the admin simulate endpoints added to `server/routes.ts`:
- `POST /api/admin/test/simulate-combat` — body `{ p1Cards: [{cardId, reserveDeployed?}], p2Cards: [...] }` → returns `{ combatLog, p1Battlefield, p2Battlefield, p1Yard, p2Yard, p1Banish, p2Banish, winner, p1Total, p2Total, p1Breakdown, p2Breakdown }`
- `POST /api/admin/test/simulate-deploy` — body `{ deployCardIds, handCardIds, deckCardIds }` → returns `{ battlefield, hand, deck, extraDeploySlots, vanguardAutoDeployed, vanguardAutoDeployedCardId }`

These call `ServerGameEngine.simulateCombat()` / `simulateDeploy()` directly, bypassing practice game state.

**Why:** Practice mode is designed to be client-authoritative (game state lives in React state, not server DB). Only multiplayer uses the server engine. Trait mechanics seeded in the DB are invisible to PATCH-based practice tests.
