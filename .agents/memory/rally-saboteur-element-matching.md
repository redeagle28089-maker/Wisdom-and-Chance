---
name: Rally/Saboteur element matching
description: Buff/debuff card mechanics are element-gated; cross-element pairings show no effect in breakdown fields.
---

Unit card buff/debuff mechanics are **element-gated** at the engine level (`server/gameEngine.ts` `computePower`):

- **Buff cards** (`buffModifier > 0`): only buff friendly cards whose `element` matches the buff card's `buffColor → colorToElement` mapping.
- **Debuff cards** (`debuffModifier > 0`): only debuff enemy cards whose `element` matches the debuff card's `debuffColor → colorToElement` mapping.

**Rally** (traitValue N): amplifies existing `buffBonuses` entries for each card on the side. If no buff card shares an element with any friendly card, `buffBonuses` is empty and Rally has no visible effect in the per-card breakdown.

**Saboteur** (traitValue N): reduces enemy `buffBonuses` entries. Only visible when the opponent has buff-receiving cards of the right element.

**Test implication**: assertions on `buffBonus`/`debuffPenalty` per-card breakdown fields will show 0 unless the test explicitly pairs same-element cards. Prefer asserting on `p1Total`/`p2Total` or the combat resolved cleanly (`winner !== undefined`).
