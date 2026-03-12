# Wisdom & Chance TCG — Feature Roadmap Plan
## Comprehensive Guide to Reaching Feature Parity with Popular Digital TCGs
### Prepared: March 6, 2026

---

## HOW TO USE THIS DOCUMENT

Hand this document back to your AI builder (Replit Agent or any other) and say:
**"Implement [Phase X] from this roadmap plan."**

Each phase is self-contained with full technical details. Phases should be built in order since later phases depend on earlier ones.

---

## CURRENT STATE SUMMARY

### What Already Exists:
- 50 unit cards across 5 elements (Fire, Water, Earth, Air, Nature), power levels 1-10
- 10 commanders with unique abilities across 4 categories
- Deck building with validation (40 cards, power distribution rules, max 3 copies)
- Practice mode vs AI (Easy/Medium/Hard difficulty)
- Real-time multiplayer (rooms, matchmaking, spectator mode, in-game chat)
- Ranked ladder with ELO rating system and tiers (Bronze through Master)
- Friend system with requests, messaging, online status
- Achievements system with 5 categories
- Daily challenges with XP rewards
- Player stats tracking (level, XP, win streaks, damage dealt)
- Admin tools for AI card art generation (Gemini)
- Commander ability system with 4 categories and special combat mechanics
- Combat logs with ability effect tracking
- PWA support for mobile
- JWT auth for mobile API readiness
- Database backup system

### What's Missing (compared to Hearthstone, Marvel Snap, Magic Arena, Yu-Gi-Oh):
- No card ownership / collection system (everyone has all cards)
- No in-game currency
- No card pack opening experience
- No crafting system
- No card rarity tiers
- No season/battle pass
- No card variants (foil/animated/alt art)
- No tutorial / onboarding
- No pre-built starter decks
- No match history / replay
- No guilds / alliances
- No sound effects or music
- No card play animations
- No limited-time game modes
- No tournament system
- No draft/arena mode
- No cosmetic shop

---

## PHASE 1: CARD COLLECTION & ECONOMY FOUNDATION
**Priority: CRITICAL — This is the core progression loop**
**Estimated complexity: Large**

### 1A: Card Rarity System

**Goal:** Add rarity tiers to all cards so some cards are harder to get than others.

**Database Changes (shared/schema.ts):**
- Add `rarity` field to card schema: `"common" | "uncommon" | "rare" | "epic" | "legendary"`
- Suggested distribution for 50 cards: 20 Common, 14 Uncommon, 9 Rare, 5 Epic, 2 Legendary
- Higher power cards should generally be higher rarity but not always (keep some surprises)

**Card Data Updates (server/storage.ts):**
- Assign rarity to every existing card
- Higher rarity = better traits, stronger buff/debuff combos, or unique abilities
- Commanders should all be "legendary" rarity

**UI Updates:**
- Color-code card borders by rarity: Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold/orange)
- Add rarity label/icon to all card displays (card database, deck builder, game board)
- Add rarity filter to card database page

**Sync Endpoint:**
- Include rarity field in card data and document rarity tiers

---

### 1B: Player Card Collection (Inventory)

**Goal:** Players start with a basic set of cards and earn more over time. Deck building is limited to owned cards.

**Database Changes (shared/schema.ts):**
- New table: `player_cards`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `cardId` (varchar, references card ID)
  - `quantity` (integer, default 1) — how many copies the player owns
  - `acquiredAt` (timestamp)
  - Unique constraint on (userId, cardId)

**API Endpoints (server/routes.ts):**
- `GET /api/collection` — returns authenticated user's card collection with quantities
- `POST /api/collection/add` — admin endpoint to grant cards to a player
- Card collection should be returned alongside card data so UI knows what player owns

**Starter Collection:**
- When a new user registers, automatically grant them a starter collection:
  - All 20 Common cards (quantity 2-3 each)
  - 6-8 random Uncommon cards (quantity 1-2 each)
  - 2-3 random Rare cards (quantity 1 each)
  - 1 random Epic card
  - Total: enough cards to build 1-2 viable 40-card decks
- Also grant 1 random commander

**Deck Builder Updates:**
- Only show owned cards in deck builder (grayed-out unowned cards with "Not Owned" label)
- Show quantity available vs quantity used in deck
- Prevent adding more copies than owned

**Card Database Updates:**
- Show owned/unowned status on each card
- Show quantity owned
- Filter: "Owned" / "Not Owned" / "All"

---

### 1C: In-Game Currency

**Goal:** Give players a currency they earn from playing and spend on card packs.

**Database Changes (shared/schema.ts):**
- New table: `player_wallet`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id, unique)
  - `gold` (integer, default 0) — primary earned currency
  - `gems` (integer, default 0) — premium currency (future monetization, not implemented yet)
  - `dust` (integer, default 0) — crafting currency from breaking down cards
  - `updatedAt` (timestamp)

- New table: `currency_transactions`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `currencyType` (varchar: "gold" | "gems" | "dust")
  - `amount` (integer, positive = earned, negative = spent)
  - `source` (varchar: "match_win" | "match_loss" | "daily_challenge" | "achievement" | "pack_purchase" | "card_craft" | "card_disenchant" | "daily_login" | "admin_grant")
  - `description` (text)
  - `createdAt` (timestamp)

**Currency Earning Rates:**
- Win a practice match: +10 Gold
- Lose a practice match: +3 Gold
- Win a multiplayer match: +25 Gold
- Lose a multiplayer match: +8 Gold
- Complete daily challenge: +15 Gold (on top of XP)
- Achievement unlock: +20-100 Gold depending on difficulty
- Daily login bonus: +5 Gold (first match of the day)
- Level up: +50 Gold

**API Endpoints:**
- `GET /api/wallet` — returns player's currency balances
- `POST /api/wallet/spend` — spend currency (validated server-side)
- `GET /api/wallet/history` — transaction history

**UI:**
- Gold/Dust display in the header/navbar (always visible)
- Transaction history page accessible from profile
- Currency earned notification after each match

---

### 1D: Card Pack System

**Goal:** Players spend gold to buy card packs and open them with an exciting reveal experience.

**Pack Types & Costs:**
- **Basic Pack** (100 Gold): 5 cards — guaranteed at least 1 Uncommon or better
- **Premium Pack** (250 Gold): 5 cards — guaranteed at least 1 Rare or better
- **Element Pack** (150 Gold): 5 cards — all from a specific element, guaranteed 1 Uncommon+
- **Legendary Pack** (500 Gold): 5 cards — guaranteed at least 1 Epic, small chance of Legendary

**Pack Opening Odds (per card slot in Basic Pack):**
- Common: 70%
- Uncommon: 20%
- Rare: 8%
- Epic: 1.8%
- Legendary: 0.2%
- Pity timer: Guarantee at least 1 Epic every 30 packs, 1 Legendary every 100 packs

**Database Changes:**
- New table: `pack_openings`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `packType` (varchar)
  - `cardsReceived` (jsonb — array of {cardId, rarity, isNew})
  - `goldSpent` (integer)
  - `openedAt` (timestamp)

- New table: `pity_tracker`
  - `userId` (varchar PK, FK -> users.id)
  - `packsSinceEpic` (integer, default 0)
  - `packsSinceLegendary` (integer, default 0)

**API Endpoints:**
- `GET /api/shop/packs` — list available pack types with costs
- `POST /api/shop/buy-pack` — purchase a pack (deducts gold, returns cards)
- `GET /api/shop/open-history` — pack opening history

**Pack Opening UI (new page: /shop or /packs):**
- Show available pack types with costs
- Buy button (grayed out if insufficient gold)
- Pack opening animation:
  1. Show pack image/graphic
  2. Click/tap to open
  3. Cards flip over one by one with rarity glow effects
  4. New cards get a "NEW!" badge
  5. Duplicate cards show "+1" to existing count
  6. Summary at end: cards received, dust value of duplicates
- Option to "Quick Open" (skip animation, show results)

---

### 1E: Card Crafting System

**Goal:** Players can break down (disenchant) unwanted cards into Dust, then use Dust to craft specific cards they want.

**Disenchant Values (Dust received):**
- Common: 5 Dust
- Uncommon: 20 Dust
- Rare: 100 Dust
- Epic: 400 Dust
- Legendary: 1600 Dust

**Crafting Costs (Dust spent):**
- Common: 40 Dust
- Uncommon: 100 Dust
- Rare: 400 Dust
- Epic: 1600 Dust
- Legendary: 3200 Dust

**API Endpoints:**
- `POST /api/craft/disenchant` — break down a card (must own > 0 quantity, reduces by 1)
- `POST /api/craft/create` — craft a card (must have enough dust, adds 1 to collection)

**UI (in Card Database or new Crafting page):**
- "Disenchant" button on owned cards (shows dust value)
- "Craft" button on unowned cards (shows dust cost)
- Bulk disenchant: "Disenchant All Extras" button (breaks down copies beyond 3, since max 3 per deck)
- Confirmation dialog before disenchanting

---

## PHASE 2: SEASON PASS & ENHANCED PROGRESSION
**Priority: HIGH — Drives daily engagement**
**Estimated complexity: Medium-Large**

### 2A: Season System

**Goal:** Monthly seasons that reset certain progress and introduce themed content.

**Database Changes:**
- New table: `seasons`
  - `id` (varchar PK, UUID)
  - `name` (varchar, e.g., "Season 1: Flames of Dawn")
  - `startDate` (timestamp)
  - `endDate` (timestamp)
  - `theme` (varchar — element or lore theme)
  - `isActive` (boolean)

**Season Features:**
- Each season lasts ~30 days
- Season name and countdown timer displayed in UI
- At season end: ranked ratings soft-reset (move 50% toward 1000)
- Season-end rewards based on final rank tier

---

### 2B: Battle Pass (Season Pass)

**Goal:** A tiered reward track with 30 levels that players progress through during the season.

**Database Changes:**
- New table: `battle_pass_tiers`
  - `id` (varchar PK)
  - `seasonId` (varchar FK -> seasons.id)
  - `tier` (integer, 1-30)
  - `freeReward` (jsonb — {type: "gold|pack|card|cosmetic", value: ...})
  - `premiumReward` (jsonb — same structure, null for free-only tiers)
  - `xpRequired` (integer — cumulative XP needed to reach this tier)

- New table: `player_battle_pass`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `seasonId` (varchar FK -> seasons.id)
  - `currentTier` (integer, default 0)
  - `currentXp` (integer, default 0)
  - `isPremium` (boolean, default false)
  - `claimedTiers` (jsonb — array of claimed tier numbers)

**Reward Structure (30 tiers):**
- Free track: Gold, basic packs, common/uncommon cards at various tiers
- Premium track: More gold, premium packs, rare+ cards, exclusive card variants, cosmetics
- Tier 30 (final): Exclusive legendary card variant (premium) / large gold reward (free)

**XP Sources (same XP that drives levels):**
- Match wins, daily challenges, achievements all contribute
- Approximately 1 tier per day of active play

**Battle Pass UI (new page or tab):**
- Visual tier track showing all 30 levels
- Current progress bar between tiers
- Free vs Premium reward comparison
- Claim buttons for reached tiers
- "Upgrade to Premium" button (future monetization)

---

### 2C: Daily Login Rewards

**Goal:** Incentivize daily app opens with escalating rewards.

**Database Changes:**
- New table: `daily_login_rewards`
  - `userId` (varchar FK -> users.id)
  - `lastLoginDate` (date)
  - `consecutiveDays` (integer, default 0)
  - `totalLoginDays` (integer, default 0)
  - `claimedToday` (boolean, default false)

**Reward Calendar (7-day cycle, resets weekly):**
- Day 1: 10 Gold
- Day 2: 15 Gold
- Day 3: 1 Basic Pack
- Day 4: 25 Gold
- Day 5: 1 Element Pack (random element)
- Day 6: 50 Gold
- Day 7: 1 Premium Pack + 50 Gold

**UI:**
- Login reward popup on first daily visit
- Calendar view showing 7-day cycle with current day highlighted
- Streak counter

---

## PHASE 3: COSMETICS & CARD VARIANTS
**Priority: MEDIUM — Adds collectibility and future monetization**
**Estimated complexity: Medium**

### 3A: Card Variants (Cosmetic Versions)

**Goal:** Alternate visual versions of cards that look cooler but have identical stats.

**Variant Types:**
- **Standard** — default card appearance (everyone has this)
- **Foil/Holographic** — shimmering border effect (CSS animation)
- **Golden** — gold-tinted card with particle effects
- **Animated** — subtle animation on the card art (CSS keyframes)
- **Full Art** — card art extends to fill the entire card (no stat box background)

**Database Changes:**
- New table: `card_variants`
  - `id` (varchar PK, UUID)
  - `cardId` (varchar, references card ID)
  - `variantType` (varchar: "foil" | "golden" | "animated" | "full_art")
  - `imageUrl` (text, nullable — override image, or null to use base card image with CSS effect)

- New table: `player_card_variants`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `cardId` (varchar)
  - `variantType` (varchar)
  - `acquiredAt` (timestamp)

**Acquisition:**
- Foil variants: Small chance from any pack (5% per card)
- Golden variants: Battle pass rewards, achievement rewards
- Animated/Full Art: Crafting with Dust (2x normal craft cost), special event rewards

**UI:**
- Variant selector in deck builder (choose which version of a card to display)
- Variant showcase in card database
- Visual effects on game board when variant cards are played

---

### 3B: Player Customization

**Goal:** Cosmetic options for player identity.

**Cosmetic Items:**
- **Card Backs** — custom card back designs (shown to opponent during deployment phase)
- **Board Themes** — different game board backgrounds/colors
- **Player Titles** — displayed next to player name ("Dragon Slayer", "Elemental Master", etc.)
- **Profile Frames** — decorative frames around profile picture

**Database Changes:**
- New table: `cosmetic_items`
  - `id` (varchar PK, UUID)
  - `name` (varchar)
  - `type` (varchar: "card_back" | "board_theme" | "title" | "profile_frame")
  - `imageUrl` (text, nullable)
  - `cssClass` (varchar, nullable)
  - `cost` (integer — gold cost, 0 = earned from achievements)
  - `source` (varchar: "shop" | "achievement" | "battle_pass" | "event")

- New table: `player_cosmetics`
  - `id` (varchar PK, UUID)
  - `userId` (varchar FK -> users.id)
  - `cosmeticId` (varchar FK -> cosmetic_items.id)
  - `isEquipped` (boolean, default false)
  - `acquiredAt` (timestamp)

---

## PHASE 4: SOCIAL & COMPETITIVE FEATURES
**Priority: MEDIUM — Community building**
**Estimated complexity: Medium**

### 4A: Guilds / Alliances

**Goal:** Players form teams, compete together, and earn shared rewards.

**Database Changes:**
- New table: `guilds`
  - `id` (varchar PK, UUID)
  - `name` (varchar, unique)
  - `description` (text)
  - `leaderId` (varchar FK -> users.id)
  - `memberCount` (integer, default 1)
  - `maxMembers` (integer, default 30)
  - `level` (integer, default 1)
  - `totalXp` (integer, default 0)
  - `createdAt` (timestamp)

- New table: `guild_members`
  - `id` (varchar PK, UUID)
  - `guildId` (varchar FK -> guilds.id)
  - `userId` (varchar FK -> users.id)
  - `role` (varchar: "leader" | "officer" | "member")
  - `joinedAt` (timestamp)

- New table: `guild_challenges`
  - Weekly guild-wide goals (e.g., "Guild members collectively win 100 matches")
  - Rewards distributed to all members

**Features:**
- Create/join guilds
- Guild chat (WebSocket channel)
- Guild leaderboard
- Weekly guild challenges with shared rewards
- Guild vs Guild matchmaking (future)

---

### 4B: Match History & Statistics

**Goal:** Let players review past games and track detailed performance.

**Database Changes:**
- New table: `match_history`
  - `id` (varchar PK, UUID)
  - `gameId` (varchar)
  - `player1Id` (varchar FK -> users.id)
  - `player2Id` (varchar FK -> users.id)
  - `winnerId` (varchar FK -> users.id, nullable)
  - `player1Commander` (varchar)
  - `player2Commander` (varchar)
  - `player1DeckName` (varchar)
  - `player2DeckName` (varchar)
  - `totalTurns` (integer)
  - `finalP1HP` (integer)
  - `finalP2HP` (integer)
  - `gameMode` (varchar: "practice" | "casual" | "ranked")
  - `ratingChange` (integer, nullable)
  - `goldEarned` (integer)
  - `xpEarned` (integer)
  - `combatLogs` (jsonb — array of all combat logs from the game)
  - `duration` (integer — seconds)
  - `completedAt` (timestamp)

**UI (new page: /match-history):**
- List of recent matches with win/loss indicator
- Click to expand: full combat log replay, cards played, commander abilities used
- Filters: by game mode, date range, opponent
- Statistics dashboard: win rate by element, favorite commander performance, rating history graph

---

### 4C: Tournament System

**Goal:** Organized competitive events with brackets and prizes.

**Database Changes:**
- New table: `tournaments`
  - `id` (varchar PK, UUID)
  - `name` (varchar)
  - `format` (varchar: "single_elimination" | "double_elimination" | "swiss")
  - `maxPlayers` (integer)
  - `currentPlayers` (integer, default 0)
  - `status` (varchar: "registration" | "in_progress" | "completed")
  - `entryFee` (integer — gold cost, 0 = free)
  - `prizes` (jsonb — {1st: {gold, packs}, 2nd: {...}, ...})
  - `startTime` (timestamp)
  - `createdAt` (timestamp)

- New table: `tournament_participants`
  - `id` (varchar PK, UUID)
  - `tournamentId` (varchar FK -> tournaments.id)
  - `userId` (varchar FK -> users.id)
  - `deckId` (varchar FK -> user_decks.id)
  - `seed` (integer)
  - `eliminatedRound` (integer, nullable)

- New table: `tournament_matches`
  - `id` (varchar PK, UUID)
  - `tournamentId` (varchar FK -> tournaments.id)
  - `round` (integer)
  - `matchNumber` (integer)
  - `player1Id` (varchar FK -> users.id)
  - `player2Id` (varchar FK -> users.id, nullable — bye)
  - `winnerId` (varchar FK -> users.id, nullable)
  - `gameId` (varchar, nullable)
  - `status` (varchar: "pending" | "in_progress" | "completed")

**Features:**
- Admin can create tournaments
- Players register and lock in a deck
- Auto-generated brackets
- Real-time bracket display
- Prize distribution on completion

---

## PHASE 5: ONBOARDING & NEW PLAYER EXPERIENCE
**Priority: HIGH for retention — but can be built after core economy**
**Estimated complexity: Medium**

### 5A: Interactive Tutorial

**Goal:** Teach new players how to play through a guided match.

**Implementation:**
- New page: `/tutorial`
- Step-by-step guided practice match with tooltip overlays
- Pre-built decks for both sides (player + AI)
- Steps:
  1. Welcome & card anatomy explanation
  2. Draw phase — explain drawing cards
  3. Deployment phase — guided card placement
  4. Combat phase — explain power comparison
  5. Commander abilities — show how to activate
  6. Victory conditions — explain HP and damage
  7. Deck building basics — show the deck builder
- Skip option for experienced players
- Reward for completing tutorial: 200 Gold + 2 Basic Packs
- Track completion in player profile so it only shows once

### 5B: Pre-Built Starter Decks

**Goal:** Give new players ready-to-use decks so they can play immediately.

**Implementation:**
- 5 pre-built decks (one per element focus)
- Automatically given to new players alongside starter card collection
- Labeled as "Starter Deck" with a special icon
- Players can modify but not delete starter decks
- Each deck uses only Common/Uncommon cards from the starter collection

---

## PHASE 6: AUDIO & VISUAL POLISH
**Priority: MEDIUM — Adds atmosphere and feel**
**Estimated complexity: Medium**

### 6A: Sound Effects

**Sound Categories:**
- **UI Sounds:** Button clicks, card hover, page transitions, notification chimes
- **Gameplay Sounds:** Card deploy (thud), card flip (whoosh), combat clash, damage hit, healing sparkle, ability activation
- **Music:** Background ambient music (different tracks for menu, deck building, battle)
- **Victory/Defeat:** Fanfare for wins, somber tone for losses

**Implementation:**
- Use HTML5 Audio API or Howler.js library
- Sound files: MP3 format, keep total size under 5MB
- Volume controls in settings (master, music, SFX)
- Mute toggle in game board header
- AI can generate royalty-free sound effects, or use free sound libraries

### 6B: Card Play Animations

**Animation Types:**
- Card draw: Slide in from deck
- Card deploy: Flip animation (face-down to face-up)
- Combat: Cards clash with particle effects
- Damage: Screen shake + red flash
- Healing: Green glow effect
- Ability activation: Element-colored burst effect
- Victory: Confetti/fireworks

**Implementation:**
- CSS animations + Framer Motion library (already common in React projects)
- Keep animations short (0.3-0.8 seconds) so gameplay stays snappy
- "Reduce Animations" toggle in settings for accessibility

---

## PHASE 7: ADDITIONAL GAME MODES
**Priority: LOWER — Adds variety after core is solid**
**Estimated complexity: Large**

### 7A: Draft/Arena Mode

**Goal:** Players pick cards one at a time from random offerings to build a temporary deck, then compete.

**Rules:**
- Pay entry fee (150 Gold)
- Presented with 3 random cards, pick 1 — repeat 40 times to build a deck
- Pick a commander from 3 random choices
- Play matches until 3 losses or 12 wins
- Rewards scale with wins (more wins = better prizes)

### 7B: Limited-Time Event Modes

**Goal:** Special game modes that rotate weekly/monthly.

**Example Modes:**
- **Element Wars:** Only one element allowed per deck
- **Power Surge:** All cards get +2 power
- **No Traits:** Card traits are disabled
- **Commander Chaos:** Random commander assigned at game start
- **Mirror Match:** Both players use the same randomly generated deck
- **Speed Mode:** 10-second turn timers

---

## PHASE 8: EXPANSION CONTENT
**Priority: ONGOING — Keeps the game fresh long-term**
**Estimated complexity: Varies**

### 8A: New Card Expansions

**Cadence:** Add 10-20 new cards every 1-2 months

**Expansion Structure:**
- Theme (lore-based, e.g., "Tides of Chaos", "Flames Reborn")
- New keyword/mechanic per expansion
- Mix of rarities
- At least 1 new commander per expansion

### 8B: New Mechanics Ideas

**Potential New Traits:**
- **Poisonous:** Deals damage at end of each turn the card is deployed
- **Lifesteal:** Player heals for damage this card deals
- **Taunt:** Must be targeted first by opponent abilities
- **Stealth:** Cannot be targeted by abilities for 1 turn
- **Evolve:** Gains +1 power each turn it survives

**Potential New Commander Ability Types:**
- **Card Transformation:** Change a card's element mid-game
- **Graveyard Recall:** Bring back a card from the yard
- **Sacrifice:** Destroy your own card for a powerful effect

---

## IMPLEMENTATION ORDER RECOMMENDATION

| Order | Phase | Description | Why This Order |
|-------|-------|-------------|----------------|
| 1st | Phase 1A | Card Rarity | Foundation for everything else |
| 2nd | Phase 1B | Card Collection | Enables ownership-based deck building |
| 3rd | Phase 1C | Currency System | Players need gold to buy packs |
| 4th | Phase 1D | Card Pack System | Core engagement loop |
| 5th | Phase 1E | Crafting System | Completes the economy cycle |
| 6th | Phase 5A-B | Tutorial & Starters | Help new players with the new system |
| 7th | Phase 2A-C | Season Pass & Login | Daily engagement drivers |
| 8th | Phase 4B | Match History | Players want to track progress |
| 9th | Phase 3A-B | Cosmetics & Variants | Collectibility and visual appeal |
| 10th | Phase 6A-B | Audio & Animations | Polish and atmosphere |
| 11th | Phase 4A | Guilds | Community building |
| 12th | Phase 4C | Tournaments | Competitive scene |
| 13th | Phase 7A-B | Draft & Events | Variety and replayability |
| 14th | Phase 8A-B | Expansions | Long-term content |

---

## NOTES FOR AI BUILDERS

- All database changes should use Drizzle ORM with `varchar` primary keys and `gen_random_uuid()` defaults (matching existing schema patterns)
- All API endpoints should support both session cookies (web) and JWT Bearer tokens (mobile)
- Use the existing admin middleware (`isAdmin`) for admin-only endpoints
- Update the sync endpoint (`GET /api/admin/sync?code=4838`) after each phase with new schemas and endpoints
- Update `replit.md` after each phase
- Run `npm run db:push` to apply schema changes (never write manual SQL migrations)
- The mobile app will need matching updates after each phase — provide sync endpoint documentation
- Existing card data is in `server/storage.ts` — card definitions should remain there but with new fields added
- Test with the existing practice mode and multiplayer to ensure nothing breaks

---

## EXISTING TECHNICAL REFERENCE

- **Frontend:** React 18, Tailwind CSS, Shadcn UI, Wouter router, TanStack Query
- **Backend:** Express.js, TypeScript, Drizzle ORM
- **Database:** PostgreSQL
- **Auth:** Replit Auth (OIDC) + JWT for mobile
- **Real-time:** WebSockets for multiplayer
- **AI:** Google Gemini 2.5 Flash for card art and deck suggestions
- **Admin email:** redeagle28089@gmail.com
- **Sync code:** 4838

---

*End of Roadmap Plan — Wisdom & Chance TCG v2.2.0*
