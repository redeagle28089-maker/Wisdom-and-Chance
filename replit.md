# Wisdom & Chance TCG

## Overview
Wisdom & Chance TCG is a tactical trading card game simulator designed to provide a rich and engaging experience for players. It features deck building, practice battles against AI, and real-time multiplayer functionality. The project's vision is to create a fully immersive card game universe where players can master elemental powers, craft strategic decks, and compete in a dynamic online environment. Key capabilities include Google authentication, a robust multiplayer system with friends and rooms, and a comprehensive card database.

## User Preferences
I prefer clear and concise communication. For coding, I favor functional programming paradigms where applicable and maintainable. When developing, I appreciate an iterative approach with frequent, small commits. Please ask before making any major architectural changes or decisions that might significantly alter the project's direction.

## System Architecture

### UI/UX Decisions
The game features a dark fantasy themed UI, utilizing element-specific color schemes. Shadcn UI components provide a consistent and modern aesthetic. The design includes various card sizes (standard, 'xl' for databases/deck builders, and larger for commanders) to optimize visual information. The application is designed as a Progressive Web App (PWA) for installability and mobile accessibility, including responsive app icons.

### Technical Implementations
The application is built with a React 18 frontend, leveraging Tailwind CSS for styling and Wouter for routing. State management and data fetching are handled by TanStack Query. The backend is an Express.js server written in TypeScript. Real-time communication for multiplayer functionality is managed via WebSockets. Authentication is handled through Replit Auth, supporting Google/GitHub/email logins via OIDC, with user data and sessions persisted in a PostgreSQL database. JWT-based authentication is implemented for mobile API readiness, including refresh token mechanisms.

Key features include:
- **Deck Builder:** Allows users to create and manage decks with validation rules (40 cards, specific power distribution, max 3 copies of any card). Decks are saved to the user's account in PostgreSQL.
- **AI Deck Suggestion System:** Integrates the Gemini 2.5 Flash model to provide AI-generated deck recommendations based on selected commander and playstyle (Aggressive/Defensive/Balanced).
- **Multiplayer System:** Supports a game lobby, room creation (public/private), pre-game waiting areas with deck selection, and a ready system. Real-time game synchronization, in-game chat, and spectator mode are all powered by WebSockets. A friend system allows users to send requests, track online status, and manage connections. **PvP games use a server-authoritative game engine** (`server/gameEngine.ts`) — the server validates all player actions, resolves combat, and sends sanitized state to each player. Both players act simultaneously during draw/deployment phases. The `PATCH /api/games/:id` endpoint is blocked for multiplayer games.
- **Practice Mode:** Users can play against an AI opponent with adjustable difficulty levels (Easy, Medium, Hard).
- **Admin Tools:** An admin-only interface allows for AI-powered card art generation using the Gemini 2.5 Flash Image model. This includes generating art only, stats only, or complete cards, with options for reference image uploads and toggling stat generation. An image database allows for browsing, managing, and applying artwork to cards.
- **Engagement Systems:** Includes achievements, daily challenges with XP rewards, a global leaderboard with ELO rating tiers, and in-game emotes.
- **Game Mechanics:** Implements a turn-based battle system with five distinct phases (Draw, Deployment, Combat, Calculation, End) and specific victory conditions.
- **Data Storage:** While game data is primarily handled in-memory using a `MemStorage` class during active gameplay, user-specific data like saved decks, friends, and user profiles are persistently stored in a PostgreSQL database. Card/commander image mappings are persisted in `card_image_mappings` and `commander_image_mappings` PostgreSQL tables, and automatically loaded into memory on server startup via `storage.initialize()`.
- **Server Game Engine:** `server/gameEngine.ts` — authoritative game engine for PvP multiplayer. Manages active games in memory (`Map<string, ActiveGameState>`), validates all player actions (draw/deploy/ability/end_turn), resolves combat with full power calculation (buffs, debuffs, traits), handles disconnection (60s reconnect window with auto-forfeit), and sends sanitized game state per-player via WebSocket. Practice/AI mode is unaffected and continues using client-side logic.
- **Multiplayer Test Harness:** `scripts/test-multiplayer.mjs` — happy-path E2E smoke test (NOT full multiplayer validation). Run with `node scripts/test-multiplayer.mjs` against a running dev server. Creates two test users via mobile JWT, opens both WebSockets, runs full lobby/room/ready/start flow, plays through draw → deploy → end_turn → combat → turn 2, asserts opponent-hand state isolation, then forfeits and verifies persisted winner. All 15 checkpoints passing as of 2026-05-02. **What this DOES NOT test**: disconnect/reconnect (60s timer), spectators, shield/first_strike combat, natural HP=0 win, invalid action/wrong-phase enforcement, deck validation. **DB side effect**: leaves `mp-test-*@test.local` users + decks + completed games behind — run only against dev DB. Note: standard mode draws 2 cards/turn and requires deploying exactly 2; sanitized state field names are `currentPhase`/`currentTurn` (not `phase`/`turn`).
- **Multiplayer Hardening Test (v2.6.1):** `scripts/test-multiplayer-hardening.mjs` — failure-mode coverage on top of the happy-path test. 31 checkpoints covering: spectator rejection (no `game_state` leak, no `game_action` accepted), spectator receives `room_message` broadcasts, invalid action enforcement (end-turn-before-draw, double draw, deploy-not-in-hand, deploy too few, deploy too many, double forfeit), concurrent deploy convergence, concurrent `end_turn` resolves combat exactly once (no double-resolution under message races), duplicate `end_turn` after combat returns phase error, trait surfacing (Quick Strike / Guardian / Care Package), 3 commander abilities (`extra_deploy`/`direct_damage`/`buff_element_unit` for fire commander), disconnect-with-forfeit and reconnect-cancels-forfeit (uses tunable `MP_DISCONNECT_TIMEOUT_MS`), host promotion when host leaves a waiting room, last occupant leaves → room is deleted from DB, and stale-room cleanup endpoint. Self-cleans `mp-hard-*@test.local` users and their cascading FK rows via direct `pg` connection at start and end of run. **Requires:** server running, `DATABASE_URL` set, admin account `redeagle28089@gmail.com` exists (mobile login is idempotent). All 31 checkpoints passing as of 2026-05-02.
- **Multiplayer hardening fixes (v2.6.1):** `gameEngine.processEndTurn` now rejects when phase is not `deployment` or `combat`, and uses an atomic `combatResolving` flag on `ActivePvPGame` to prevent racing/duplicate `end_turn` messages from re-entering `resolveCombat` (the resolver has many awaits before it flips `currentPhase`, so without this guard a second `end_turn` could trigger combat twice). `gameEngine.forfeitGame` rejects when `status !== "in_progress"` or sender is not a participant. `gameEngine.handleDisconnect` reads timeout fresh from `process.env.MP_DISCONNECT_TIMEOUT_MS` (default 60000ms) so tests can shorten it. `websocket.handleGameAction` explicitly rejects non-participants (spectators / strangers) with `"Not a participant in this game"` instead of silently treating them as Player 2. The disconnect→forfeit `onForfeit` callback now calls `gameEngine.removeGame(gameId)` so completed games are evicted from the in-memory map.
- **Admin endpoints (v2.6.1):** `POST /api/admin/cleanup-stale-rooms` (admin-only) — accepts `{ olderThanHours?: number }` (default 24) and deletes `game_rooms` rows where `status='waiting'` AND `guest_id IS NULL` AND `created_at < cutoff`. `POST /api/admin/test/disconnect-timeout` (admin-only) — accepts `{ ms: number }` between 100 and 120000 and sets `process.env.MP_DISCONNECT_TIMEOUT_MS` for future disconnects (used by the hardening test).
- **Commander Ability System:** 4 categories of abilities: (1) Group Buffs/Debuffs, (2) Trait Activation (first_strike/shield/heal), (3) Trait-Like Group Effects, (4) Extra Deployments. AbilityBuff types `shield`, `first_strike`, and `heal` have special combat mechanics beyond power modification — shield blocks damage, first_strike deals pre-combat damage, heal restores HP. See `.local/skills/commander-abilities/SKILL.md` for the authoritative guideline.
- **Combat Log Enhancement:** Combat logs now include an `abilityEffects` field (array of `{ playerSide, abilityName, effectDescription, phase }`) showing which commander abilities were active during each combat round. The UI displays this as Step 5 in the combat log dialog.
- **Commander Info Buttons:** Game board has two "Commander" buttons — one showing your commander's details/abilities, one showing your opponent's. Both available during gameplay in practice and multiplayer modes.

### System Design Choices
- **API Structure:** A clear separation of concerns is maintained with dedicated API endpoints for authentication, game data, user-specific decks, friend management, room management, and admin functions.
- **Unified Authentication:** All /api endpoints support both session cookies (web) and JWT Bearer tokens (mobile). A middleware in routes.ts intercepts Bearer tokens, verifies them via jsonwebtoken, and populates req.user with the same claims structure as session auth. This makes every endpoint work seamlessly for both web and mobile clients.
- **CORS:** The server uses the `cors` middleware to allow cross-origin requests from any origin with credentials, enabling mobile app connectivity.
- **WebSocket Security:** WebSocket connections are secured using both session-based authentication (cookies) and JWT token authentication (via ?token= query parameter). Authorization checks are implemented for joining rooms and games.
- **Error Handling:** OIDC authentication is manually implemented using `fetch` to mitigate bundling issues, ensuring robust JWT signature and claim validation.
- **PWA Capabilities:** Full PWA support with manifest.json, service worker (sw.js), app icons (192x192 and 512x512), offline caching, and an in-app install prompt component (PWAInstallPrompt) with iOS Safari "Add to Home Screen" guide.

### Mobile API Readiness
- **API Docs:** Available at GET /api/docs - comprehensive JSON documentation of all endpoints, WebSocket events, and game rules.
- **Admin Sync Endpoint:** GET /api/admin/sync?code=4838 — Returns complete app data dump (all cards, commanders, game constants, database schemas, API endpoints, WebSocket events, game mechanics) for mobile app development. Protected by access code, no auth required.
- **Mobile Auth Flow:** POST /api/mobile/auth/login with email to get JWT token (7-day expiry). Token refresh via POST /api/mobile/auth/refresh.
- **WebSocket Mobile:** Connect with `wss://wisdom-and-chance.replit.app/ws?token=<jwt>` for real-time multiplayer.
- **Image Download Endpoints:** GET /api/cards/:id/image and GET /api/commanders/:id/image return binary image files for any authenticated user. GET /api/admin/card-images/:id/download returns a downloadable image file (admin only). GET /api/admin/card-images/bulk/download-manifest returns a JSON manifest of all images with download URLs (admin only).
- **Key Files:** server/unifiedAuth.ts (JWT middleware), server/mobileAuth.ts (mobile auth endpoints), server/apiDocs.ts (API documentation).

### Economy & Collection System (v2.3.0)
- **Currencies:** Gold (earned from matches), Gems (premium, reserved), Dust (from disenchanting, used for crafting).
- **Rarity System:** Derived from card power — Common (1-3), Rare (4-6), Epic (7-8), Legendary (9-10). Affects craft costs, disenchant values, and pack pull rates.
- **Starter Rewards:** 500 gold + 2 copies of every Common+Rare card (power 1-5).
- **Pack Opening:** 100 gold per pack, 5 cards each with rarity-weighted pulls (60/25/10/5%).
- **Crafting/Disenchanting:** Craft any card with dust (40/100/400/1600 by rarity). Disenchant owned copies for dust (5/20/100/400 by rarity).
- **Match Rewards:** Win=30 gold, Loss=10, Draw=15, Forfeit win=15. Auto-granted after multiplayer matches.
- **Feature Flag:** Gated by `economy_enabled` feature flag. Deck builder shows ownership badges and limits when enabled.
- **Shop System:** 7 pack types (Standard 100g/100gems, Premium 250g/250gems, Fire/Water/Earth/Air/Nature 150g/150gems each). All packs purchasable with gold or gems. Element packs filter by element. Premium guarantees Rare+. Daily deal auto-generates with 15-30% discount, rotates daily at UTC midnight.
- **Pack Opening Animation:** 3D card flip reveal with rarity glow effects (gray/blue/purple/gold). NEW badge for first-time pulls. Click to reveal individual cards or reveal all at once.
- **Daily Deals:** Stored in `daily_deals` table. Auto-generated on first request each day. Random pack + random 15-30% discount + random featured card.
- **Endpoints:** GET /api/currencies, GET /api/collection, POST /api/packs/open, POST /api/cards/craft, POST /api/cards/disenchant, POST /api/collection/starter, GET /api/shop/catalog, GET /api/shop/daily-deals, POST /api/shop/purchase.
- **Key Files:** shared/models/economy.ts (DB schema + constants + pack types), server/economyService.ts (shared helpers), server/routes.ts (endpoints), server/websocket.ts (reward hooks), client/src/pages/shop.tsx, client/src/pages/pack-opening.tsx.

### Ranked Seasons & Battle Pass (v2.4.0)
- **Seasons:** Server-driven seasons with configurable duration (default 30 days). Auto-seeds Season 1 on startup if none exists.
- **Ranked Tiers:** Bronze (0+), Silver (1100+), Gold (1300+), Platinum (1500+), Diamond (1700+), Master (2000+). Based on ELO rating from `player_ratings` table.
- **Season Rewards:** End-of-season rewards based on peak tier achieved — Gold, Packs, and Dust scale with tier rank.
- **Season History:** Stored per player with peak/final rating, tier, games played, wins.
- **Battle Pass:** 50-level reward track per season. Rewards: gold, gems, dust, and card packs at milestone levels (10, 20, 30, 40, 50).
- **Battle Pass XP:** Earned from match wins (+100), daily challenges (+150), weekly challenges (+300), achievements (+200).
- **Weekly Challenges:** 3 per week per season (win_games, play_element, deal_damage). Refresh on server schedule. Grant gold + battle pass XP.
- **Feature Flags:** Gated by `ranked_seasons`, `battle_pass`, `weekly_challenges` flags.
- **DB Tables:** seasons, season_history, battle_pass_levels, player_battle_pass, weekly_challenges, player_weekly_challenges.
- **Endpoints:** GET /api/season/current, GET /api/season/rewards, GET /api/season/player-rank, GET /api/season/history, GET /api/battlepass, POST /api/battlepass/claim, GET /api/weekly-challenges, POST /api/weekly-challenges/:id/claim.
- **Key Files:** shared/models/economy.ts (schema + constants), server/routes.ts (endpoints + seeding), client/src/pages/season.tsx, client/src/pages/battle-pass.tsx.

### Payment System (v2.5.0)
- **Payment Providers:** Stripe (Card + Google Pay via Stripe Checkout) and PayPal (PayPal REST API).
- **PayPal Receiving Account:** reagle2808@aol.com
- **Pricing Rule:** All USD prices are whole dollars only (no cents). Currency conversion: 100 gold or gems = $1.
- **Product Catalog:** Seeded from PURCHASE_PRODUCTS_SEED in shared/models/economy.ts. Stored in `purchase_products` table.
  - Gem Packs: $1 (100), $4 (550), $8 (1,400), $18 (3,600), $35 (8,000) — real money only.
  - Premium Pack Bundles, Element Mega Pack, Legendary Hunt Pack — USD or gold/gems.
  - Premium Battle Pass ($5 / 500 gold / 500 gems), Starter Bundle ($10, one-time), Season Pass Bundle ($15).
- **Purchase Flow:** Player selects product → chooses payment method (Stripe/PayPal/Gold/Gems) → payment processed → items fulfilled atomically.
- **Premium Battle Pass:** `premiumUnlocked` boolean on `player_battle_pass` table. Set to true when Premium BP or Season Pass Bundle purchased.
- **Transaction History:** All purchases (real money + currency) tracked in `purchase_transactions` table.
- **Security:** Server-side payment verification, idempotent fulfillment (paymentId uniqueness), atomic DB transactions.
- **Env Vars Required:** PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY (or VITE_STRIPE_PUBLISHABLE_KEY), optional STRIPE_WEBHOOK_SECRET, PAYPAL_API_URL.
- **Endpoints:** POST /api/payments/purchase (unified: gold/gems/stripe/paypal), GET /api/payments/products, GET /api/payments/config, POST /api/payments/purchase-currency, POST /api/payments/paypal/create-order, POST /api/payments/paypal/capture-order, POST /api/payments/stripe/create-checkout, GET /api/payments/stripe/verify-session, POST /api/payments/stripe/webhook, GET /api/payments/history, POST /api/payments/check-purchased (supports batch with productIds array).
- **Purchase History Page:** `/purchase-history` route shows all past transactions with payment method, status, and cost.
- **Currency Toggle:** Pack purchases support gold/gems toggle in the confirmation dialog, defaulting to whichever currency the player can afford.
- **Key Files:** server/paymentService.ts, server/paymentRoutes.ts, shared/models/economy.ts (schema + product seed), client/src/pages/shop.tsx (Premium Store tab), client/src/pages/purchase-history.tsx.

### Database Backup
- **Admin Export Endpoint:** GET /api/admin/database-export — Admin-only endpoint that exports all database tables as JSON. Add `?save=true` to also save a backup file to `backups/` directory. Image data is included in file backups.
- **SQL Backups:** Full SQL dumps can be created via `pg_dump` and are stored in the `backups/` directory. These include all data including card images.
- **GitHub Backup:** The project is connected to GitHub for code version control. Database backup files in `backups/` can be committed and pushed to GitHub for offsite storage.

### Monorepo Structure (v2.6.0)
This project is a monorepo containing both the web app and mobile app:
- **`/client`** — React web frontend (live at wisdom-and-chance.replit.app)
- **`/server`** — Shared Express.js backend serving both web and mobile apps
- **`/shared`** — Shared TypeScript types and schemas (used by both apps)
- **`/mobile`** — Expo/React Native mobile app (deploys to Google Play and Apple App Store via EAS Build)

Both apps connect to the same server and database. The web app connects directly (same origin), the mobile app connects remotely to `https://wisdom-and-chance.replit.app/api/...` using JWT auth.

- **Mobile Framework:** Expo SDK 54 with React Native 0.81, TypeScript, expo-router for navigation
- **Mobile Auth:** JWT Bearer tokens via `/api/mobile/auth/login` and `/api/mobile/auth/refresh`
- **Mobile API Client:** `mobile/lib/api.ts` — all API calls with auth token management
- **Mobile Key Files:** `mobile/app/` (screens), `mobile/components/` (shared components), `mobile/lib/` (API, auth, game engine, WebSocket)
- **App Store Deployment:** Use `eas build --platform ios/android` from `/mobile` folder, then `eas submit` to publish
- **Mobile Preview:** Visit `/mobile` on the web app (port 5000) to see the mobile app in a phone-frame preview within the Replit preview pane. The preview loads the Expo web version (port 8080) in an iframe.
- **Workflows:** "Start application" runs the web server (port 5000). "Start mobile app" runs Expo dev server (port 8080).
- **EAS Project:** Published to Expo as `@redeagle2808/wisdom-chance-tcg` (project ID: 5b6489bb-213d-4142-91aa-56f3ac338aaf). Use `eas update --branch preview` from `/mobile` to push OTA updates.
- **GitHub:** Single repo at `github.com/redeagle28089-maker/Wisdom-and-Chance`. Original mobile repo archived at `github.com/redeagle28089-maker/wisdom-and-chance-mobile`.

## External Dependencies

- **PostgreSQL:** Primary database for persistent user data, saved decks, friend lists, and game statistics.
- **Replit Auth:** Used for user authentication, providing seamless integration with Google, GitHub, and email login providers via OIDC.
- **Google Gemini 2.5 Flash Model:** Utilized for AI deck suggestions and AI-powered card art generation in admin tools.
- **React 18:** Frontend framework.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **Shadcn UI:** Reusable UI components.
- **Wouter:** Lightweight React router.
- **TanStack Query:** For data fetching and state management.
- **Express.js:** Backend web framework.
- **TypeScript:** Programming language for both frontend and backend.
- **Stripe:** Payment processing for credit/debit cards and Google Pay via Stripe Checkout.
- **PayPal:** Payment processing via PayPal REST API. Payments route to reagle2808@aol.com.
- **MemStorage:** In-memory storage solution used for active game state during a session.
- **Expo SDK 54:** Mobile app framework for building iOS and Android apps.
- **React Native 0.81:** Cross-platform mobile UI framework (used via Expo).
- **Expo Router:** File-based routing for the mobile app.