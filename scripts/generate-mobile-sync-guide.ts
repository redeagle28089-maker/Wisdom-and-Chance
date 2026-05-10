import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 60, left: 50, right: 50 },
  info: {
    Title: "Wisdom & Chance TCG — Mobile Sync Guide & Feature Roadmap",
    Author: "W&C Development Team",
    Subject: "Mobile development guide, API contracts, and feature roadmap",
    CreationDate: new Date(),
  },
});

const outputPath = path.join(process.cwd(), "WC_Mobile_Sync_Guide.pdf");
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const COLORS = {
  title: "#1a1a2e",
  heading: "#16213e",
  subheading: "#0f3460",
  body: "#333333",
  accent: "#7c3aed",
  muted: "#666666",
  tableHeader: "#e8e0ff",
  tableBorder: "#d1d5db",
  codeBackground: "#f3f4f6",
  link: "#2563eb",
  green: "#059669",
  red: "#dc2626",
  orange: "#d97706",
  blue: "#2563eb",
};

let pageNum = 0;

function title(text: string) {
  doc.fontSize(24).font("Helvetica-Bold").fillColor(COLORS.title).text(text);
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(COLORS.accent).lineWidth(2).stroke();
  doc.moveDown(0.8);
}

function h1(text: string) {
  ensureSpace(40);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(COLORS.heading).text(text);
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(250, doc.y).strokeColor(COLORS.accent).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function h2(text: string) {
  ensureSpace(30);
  doc.fontSize(14).font("Helvetica-Bold").fillColor(COLORS.subheading).text(text);
  doc.moveDown(0.3);
}

function h3(text: string) {
  ensureSpace(25);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.subheading).text(text);
  doc.moveDown(0.2);
}

function body(text: string) {
  doc.fontSize(10).font("Helvetica").fillColor(COLORS.body).text(text, { lineGap: 3 });
  doc.moveDown(0.3);
}

function bullet(text: string, indent = 0) {
  const x = 60 + indent * 15;
  doc.fontSize(10).font("Helvetica").fillColor(COLORS.body);
  doc.text(`•  ${text}`, x, doc.y, { lineGap: 2, width: doc.page.width - x - 50 });
  doc.moveDown(0.15);
}

function code(text: string) {
  ensureSpace(20);
  const y = doc.y;
  const w = doc.page.width - 100;
  const lines = text.split("\n");
  const lineH = 12;
  const h = lines.length * lineH + 16;
  doc.save();
  doc.roundedRect(50, y, w, h, 4).fill(COLORS.codeBackground);
  doc.fontSize(8.5).font("Courier").fillColor("#111827");
  lines.forEach((line, i) => {
    doc.text(line, 58, y + 8 + i * lineH, { width: w - 16 });
  });
  doc.restore();
  doc.y = y + h + 8;
}

function table(headers: string[], rows: string[][]) {
  ensureSpace(30 + rows.length * 18);
  const colW = (doc.page.width - 100) / headers.length;
  const startX = 50;
  let y = doc.y;

  doc.save();
  doc.rect(startX, y, colW * headers.length, 20).fill(COLORS.tableHeader);
  headers.forEach((h, i) => {
    doc.fontSize(9).font("Helvetica-Bold").fillColor(COLORS.heading);
    doc.text(h, startX + i * colW + 4, y + 5, { width: colW - 8 });
  });
  y += 20;

  rows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      doc.rect(startX, y, colW * headers.length, 18).fill("#f9fafb");
    }
    row.forEach((cell, ci) => {
      doc.fontSize(8.5).font("Helvetica").fillColor(COLORS.body);
      doc.text(cell, startX + ci * colW + 4, y + 4, { width: colW - 8 });
    });
    y += 18;
  });

  doc.rect(startX, doc.y, colW * headers.length, y - doc.y).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();
  doc.restore();
  doc.y = y + 8;
}

function ensureSpace(needed: number) {
  if (doc.y + needed > doc.page.height - 80) {
    doc.addPage();
  }
}

function badge(text: string, color: string) {
  const w = doc.widthOfString(text) + 12;
  doc.save();
  doc.roundedRect(doc.x, doc.y, w, 16, 3).fill(color);
  doc.fontSize(8).font("Helvetica-Bold").fillColor("white").text(text, doc.x + 6, doc.y + 3);
  doc.restore();
  doc.moveDown(0.3);
}

// ===================== COVER PAGE =====================
doc.moveDown(6);
doc.fontSize(32).font("Helvetica-Bold").fillColor(COLORS.accent).text("Wisdom & Chance TCG", { align: "center" });
doc.moveDown(0.3);
doc.fontSize(20).font("Helvetica").fillColor(COLORS.heading).text("Mobile Sync Guide &\nFeature Roadmap", { align: "center" });
doc.moveDown(1);
doc.fontSize(12).fillColor(COLORS.muted).text("API Version 2.3.0  |  March 2026", { align: "center" });
doc.moveDown(0.5);
doc.fontSize(10).fillColor(COLORS.muted).text("For the Mobile Development Team", { align: "center" });
doc.moveDown(3);
doc.fontSize(9).fillColor(COLORS.muted).text("Base URL: https://wisdom-and-chance-2.replit.app", { align: "center" });
doc.text("WebSocket: wss://wisdom-and-chance-2.replit.app/ws", { align: "center" });

// ===================== TABLE OF CONTENTS =====================
doc.addPage();
title("Table of Contents");
const toc = [
  "1. Current Feature Inventory",
  "2. Gap Analysis vs Major CCGs",
  "3. Server-Sync Architecture Guide",
  "4. API Contracts & Versioning",
  "5. Economy System (Implemented)",
  "6. Upcoming Features & Roadmap",
  "7. WebSocket Contract",
  "8. Data Flow Diagrams",
  "9. Mobile-Specific Recommendations",
  "10. Appendix: Quick Reference",
];
toc.forEach((item) => {
  doc.fontSize(11).font("Helvetica").fillColor(COLORS.link).text(item, 70);
  doc.moveDown(0.3);
});

// ===================== SECTION 1: CURRENT FEATURE INVENTORY =====================
doc.addPage();
title("1. Current Feature Inventory");

h2("1.1 Core Game Systems");
table(
  ["Feature", "Status", "Platform", "Notes"],
  [
    ["200 Unit Cards (5 elements)", "Live", "Web + API", "Power 1-10, traits, buffs/debuffs"],
    ["10 Commanders", "Live", "Web + API", "4 ability categories"],
    ["Deck Builder", "Live", "Web + API", "40 cards, power distribution rules"],
    ["Practice vs AI", "Live", "Web + API", "Easy/Medium/Hard difficulty"],
    ["Card Database", "Live", "Web + API", "Browse all cards with filters"],
    ["Card Art (AI)", "Live", "Admin", "Gemini 2.5 Flash image generation"],
    ["Rarity System", "Live", "Web + API", "Common/Rare/Epic/Legendary from power"],
  ]
);

h2("1.2 Multiplayer & Social");
table(
  ["Feature", "Status", "Platform", "Notes"],
  [
    ["Real-time PvP", "Live", "Web + WS", "Server-authoritative engine"],
    ["Game Rooms", "Live", "Web + API + WS", "Public/private, spectator support"],
    ["Matchmaking", "Live", "Web + WS", "ELO-based queue"],
    ["In-game Chat", "Live", "Web + WS", "Room + game chat"],
    ["Spectator Mode", "Live", "Web + WS", "Watch live games"],
    ["Friend System", "Live", "Web + API", "Requests, online status"],
    ["Emotes", "Live", "Web + WS", "In-game reactions"],
  ]
);

h2("1.3 Progression & Engagement");
table(
  ["Feature", "Status", "Platform", "Notes"],
  [
    ["Achievements", "Live", "Web + API", "5 categories, XP + gold rewards"],
    ["Daily Challenges", "Live", "Web + API", "Rotating daily goals"],
    ["Leaderboard", "Live", "Web + API", "ELO tiers: Bronze to Master"],
    ["Player Stats", "Live", "Web + API", "Level, XP, streaks, favorites"],
    ["Economy System", "Built", "Web + API", "Feature-flagged, ready to enable"],
    ["Collection System", "Built", "Web + API", "Card ownership, starter grants"],
  ]
);

h2("1.4 Infrastructure");
table(
  ["Feature", "Status", "Notes"],
  [
    ["Unified Auth", "Live", "Session cookies (web) + JWT Bearer (mobile)"],
    ["Mobile Auth", "Live", "POST /api/mobile/auth/login with JWT (7-day)"],
    ["Feature Flags", "Live", "Server-controlled, 15+ flags"],
    ["API Docs", "Live", "GET /api/docs — full JSON reference"],
    ["Admin Sync", "Live", "GET /api/admin/sync (code-protected)"],
    ["PWA Support", "Live", "Manifest, service worker, icons"],
    ["Database Backups", "Live", "Admin export + pg_dump"],
    ["Health Check", "Live", "GET /api/health"],
  ]
);

// ===================== SECTION 2: GAP ANALYSIS =====================
doc.addPage();
title("2. Gap Analysis vs Major CCGs");

body("Comparison against Hearthstone, MTG Arena, and Master Duel. Features are categorized by implementation priority.");

h2("2.1 Tier 1 — Critical (Core Progression Loop)");
table(
  ["Feature", "Hearthstone", "MTG Arena", "Master Duel", "W&C Status"],
  [
    ["Card Rarity", "Yes (6 tiers)", "Yes (4 tiers)", "Yes (4 tiers)", "DONE (4 tiers)"],
    ["Card Collection", "Yes", "Yes", "Yes", "DONE (flagged)"],
    ["In-game Currency", "Gold/Dust", "Gold/Gems", "Gems/CP", "DONE (flagged)"],
    ["Pack Opening", "Animated", "Animated", "Animated", "Basic (next)"],
    ["Crafting/Disenchant", "Dust system", "Wildcards", "CP crafting", "DONE (flagged)"],
    ["Shop / Store", "Yes", "Yes", "Yes", "Not built (next)"],
    ["Starter Decks", "Free decks", "Color decks", "Starter + Solo", "Starter done"],
  ]
);

h2("2.2 Tier 2 — High (Daily Engagement)");
table(
  ["Feature", "Hearthstone", "MTG Arena", "Master Duel", "W&C Status"],
  [
    ["Seasons", "Monthly", "Monthly", "Monthly", "Planned"],
    ["Battle Pass", "Tavern Pass", "Mastery Pass", "Duel Pass", "Planned"],
    ["Daily Login", "Quest-based", "Daily rewards", "Daily login", "Not built"],
    ["Match History", "Recent games", "Yes", "Duel Log", "Not built"],
    ["Tutorials", "Interactive", "Color challenge", "Solo Mode", "Basic"],
  ]
);

h2("2.3 Tier 3 — Medium (Collectibility & Monetization)");
table(
  ["Feature", "Hearthstone", "MTG Arena", "Master Duel", "W&C Status"],
  [
    ["Card Variants", "Golden/Diamond", "Styles/Alt art", "Royal/Prismatic", "Not built"],
    ["Cosmetics", "Hero skins", "Pets/Sleeves", "Mates/Fields", "Not built"],
    ["Premium Currency", "Runestones", "Gems", "Gems", "Gems reserved"],
    ["Tournaments", "Battlegrounds", "Events", "Duelist Cup", "Not built"],
    ["Draft/Arena", "Arena mode", "Draft/Sealed", "N/A", "Not built"],
  ]
);

h2("2.4 Tier 4 — Nice to Have");
table(
  ["Feature", "Status", "Notes"],
  [
    ["Sound/Music", "Not built", "Audio engine + asset pipeline"],
    ["Card Animations", "Not built", "Play/attack/death VFX"],
    ["Guilds/Alliances", "Not built", "Social feature"],
    ["Limited-time Modes", "Not built", "Seasonal game variants"],
    ["Replays", "Not built", "Match recording/playback"],
  ]
);

// ===================== SECTION 3: SERVER-SYNC ARCHITECTURE =====================
doc.addPage();
title("3. Server-Sync Architecture Guide");

h2("3.1 Thin Client Principles");
body("The mobile app should be a thin client that relies on the server as the single source of truth for all game state and data.");
bullet("Never trust client-side calculations for currency, collection, or game state");
bullet("All mutations go through server API — server validates and returns canonical state");
bullet("Card data, commanders, and game constants come from the server (cache locally)");
bullet("Feature flags control what UI to show — always respect GET /api/config");
bullet("Game logic is server-authoritative — clients send actions, server resolves them");

h2("3.2 Feature Flags");
body("Every major feature is gated by a boolean flag returned from GET /api/config. The mobile app MUST check these before rendering UI sections.");
doc.moveDown(0.2);
code(
`GET /api/config → response.features
{
  "economy_enabled": false,       // Currencies, collection, rewards
  "collection_enabled": false,    // Card ownership system
  "shop_enabled": false,          // In-game shop
  "pack_opening_enabled": false,  // Pack purchase/opening
  "crafting_enabled": false,      // Card crafting/disenchanting
  "ranked_seasons": false,        // Seasonal ranking
  "battle_pass": false,           // Season pass rewards
  "weekly_challenges": false,     // Weekly challenge goals
  "emotes": false,                // In-game reactions
  "spectator_mode": true,         // Watch live games
  "practice_mode": true,          // Practice vs AI
  "multiplayer": true,            // PvP, rooms, matchmaking
  "friends_system": true,         // Friend requests, status
  "daily_challenges": true,       // Daily goals
  "achievements": true,           // Achievement tracking
  "leaderboard": true             // ELO rankings
}`
);

h2("3.3 Versioned API");
body("The server returns apiVersion in GET /api/config. The mobile app should:");
bullet("Store its own minimum supported API version");
bullet("Compare against server's apiVersion on launch");
bullet("If server version < mobile minimum, show 'server update pending' notice");
bullet("If mobile version < server's minClientVersion, force app update prompt");

h2("3.4 Authentication Flow");
code(
`1. Mobile calls POST /api/mobile/auth/login { email, provider }
2. Server returns { token: "JWT...", user: {...} }
3. Store JWT securely (Keychain/Keystore)
4. Include "Authorization: Bearer <token>" on all requests
5. Token expires in 7 days
6. Before expiry: POST /api/mobile/auth/refresh → new token
7. On 401: redirect to login screen`
);

h2("3.5 Data Sync Strategy");
body("Recommended caching and sync approach for mobile:");
doc.moveDown(0.2);
table(
  ["Data Type", "Cache Duration", "Sync Trigger", "Strategy"],
  [
    ["Cards/Commanders", "24 hours", "App launch", "Cache aggressively, rarely changes"],
    ["Config/Flags", "5 minutes", "App launch + resume", "Short cache, affects UI"],
    ["Collection", "On mutation", "Pack open, craft, disenchant", "Invalidate on write"],
    ["Currencies", "On mutation", "Any economy action", "Invalidate on write"],
    ["Decks", "On mutation", "Create/edit/delete", "Invalidate on write"],
    ["Friends", "2 minutes", "Friend list view", "Moderate cache"],
    ["Leaderboard", "5 minutes", "Leaderboard view", "Moderate cache"],
    ["Game State", "Never cache", "WebSocket real-time", "Always live via WS"],
  ]
);

// ===================== SECTION 4: API CONTRACTS =====================
doc.addPage();
title("4. API Contracts & Versioning");

h2("4.1 Base Configuration");
code(
`Base URL: https://wisdom-and-chance-2.replit.app
API Prefix: /api
Auth Header: Authorization: Bearer <jwt_token>
Content-Type: application/json
Current Version: 2.3.0`
);

h2("4.2 Authentication Endpoints");
table(
  ["Method", "Path", "Auth", "Description"],
  [
    ["POST", "/api/mobile/auth/login", "No", "Get JWT token (7-day expiry)"],
    ["POST", "/api/mobile/auth/refresh", "Yes", "Refresh JWT token"],
    ["GET", "/api/mobile/auth/me", "Yes", "Get current user info"],
    ["GET", "/api/auth/user", "Yes", "Get auth user (both web/mobile)"],
  ]
);

h2("4.3 Public Endpoints (No Auth)");
table(
  ["Method", "Path", "Description"],
  [
    ["GET", "/api/health", "Health check + DB status"],
    ["GET", "/api/config", "Feature flags, version, maintenance"],
    ["GET", "/api/cards", "All 200 cards with rarity"],
    ["GET", "/api/cards/:id", "Single card by ID"],
    ["GET", "/api/cards/element/:element", "Cards by element"],
    ["GET", "/api/commanders", "All 10 commanders"],
    ["GET", "/api/commanders/:id", "Single commander"],
    ["GET", "/api/achievements", "All achievements"],
    ["GET", "/api/daily-challenges", "Today's challenges"],
    ["GET", "/api/leaderboard", "Top 100 by ELO"],
    ["GET", "/api/rooms", "Public waiting rooms"],
    ["GET", "/api/docs", "Full API reference (JSON)"],
  ]
);

h2("4.4 Protected Endpoints (Auth Required)");
table(
  ["Method", "Path", "Description"],
  [
    ["PATCH", "/api/user/profile", "Update profile info"],
    ["GET", "/api/user-decks", "List user's saved decks"],
    ["POST", "/api/user-decks", "Create deck (40 cards, validated)"],
    ["PATCH", "/api/user-decks/:id", "Update deck"],
    ["DELETE", "/api/user-decks/:id", "Delete deck"],
    ["GET", "/api/player-stats", "Player stats (level, XP, streaks)"],
    ["GET", "/api/player-achievements", "User's achievement progress"],
    ["GET", "/api/player-challenges", "User's challenge progress"],
    ["POST", "/api/player-challenges/:id/claim", "Claim challenge reward"],
  ]
);

h2("4.5 Multiplayer & Room Endpoints");
table(
  ["Method", "Path", "Description"],
  [
    ["POST", "/api/rooms", "Create game room"],
    ["POST", "/api/rooms/:id/join", "Join a room"],
    ["POST", "/api/rooms/:id/leave", "Leave a room"],
    ["POST", "/api/rooms/:id/ready", "Toggle ready status"],
    ["POST", "/api/rooms/:id/start", "Start game (host only)"],
    ["POST", "/api/rooms/:id/spectate", "Join as spectator"],
    ["DELETE", "/api/rooms/:id/spectate", "Leave spectating"],
    ["GET", "/api/rooms/:id/messages", "Get room chat history"],
    ["POST", "/api/rooms/:id/messages", "Send room chat message"],
    ["GET", "/api/live-matches", "Active matches for spectating"],
  ]
);

h2("4.6 Friend System Endpoints");
table(
  ["Method", "Path", "Description"],
  [
    ["GET", "/api/friends", "List accepted friends"],
    ["GET", "/api/friend-requests", "List pending requests"],
    ["POST", "/api/friend-requests", "Send friend request"],
    ["POST", "/api/friend-requests/:id/accept", "Accept request"],
    ["POST", "/api/friend-requests/:id/decline", "Decline request"],
  ]
);

// ===================== SECTION 5: ECONOMY SYSTEM =====================
doc.addPage();
title("5. Economy System (Implemented)");

body("The economy system is fully built and feature-flagged behind 'economy_enabled'. When enabled, it adds currencies, card ownership, pack opening, crafting, and disenchanting.");

h2("5.1 Rarity System");
table(
  ["Rarity", "Power Range", "Pack Weight", "Craft Cost (Dust)", "Disenchant (Dust)"],
  [
    ["Common", "1-3", "60%", "40", "5"],
    ["Rare", "4-6", "25%", "100", "20"],
    ["Epic", "7-8", "10%", "400", "100"],
    ["Legendary", "9-10", "5%", "1,600", "400"],
  ]
);

h2("5.2 Currency Constants");
table(
  ["Constant", "Value", "Notes"],
  [
    ["Starter Gold", "500", "Granted on first login"],
    ["Pack Cost", "100 gold", "5 cards per pack"],
    ["Match Win", "30 gold", "Auto-granted via WebSocket"],
    ["Match Loss", "10 gold", "Auto-granted via WebSocket"],
    ["Match Draw", "15 gold", "Auto-granted via WebSocket"],
    ["Forfeit Win", "15 gold", "Opponent disconnected"],
    ["Daily Challenge", "25 gold", "On claim (economy_enabled)"],
    ["Achievement", "50 gold", "One-time per achievement"],
  ]
);

h2("5.3 Economy Endpoints");
table(
  ["Method", "Path", "Description"],
  [
    ["GET", "/api/currencies", "Get gold/gems/dust balances"],
    ["GET", "/api/collection", "Get owned cards with quantities"],
    ["POST", "/api/packs/open", "Buy & open pack (100 gold)"],
    ["POST", "/api/cards/craft", "Craft card with dust"],
    ["POST", "/api/cards/disenchant", "Disenchant for dust"],
    ["POST", "/api/collection/starter", "Claim starter (idempotent)"],
    ["POST", "/api/achievements/:id/claim", "Claim achievement gold"],
  ]
);

h2("5.4 Starter Collection");
body("On first login (web or mobile), players receive:");
bullet("500 Gold");
bullet("2 copies of every power 1-5 card (Common + Rare) across all 5 elements");
bullet("This is tracked by a 'starterClaimed' flag — calling /api/collection/starter is idempotent");

h2("5.5 Pack Opening Response");
code(
`POST /api/packs/open
Response: {
  "cards": [
    { "cardId": "card-fire-3-2", "rarity": "Common", "isNew": true },
    { "cardId": "card-water-7-1", "rarity": "Epic", "isNew": false },
    ...
  ],
  "costGold": 100,
  "remainingGold": 400
}`
);

h2("5.6 Deck Ownership Validation");
body("When economy is enabled, deck create/update validates that the player owns sufficient copies of each card. The server rejects decks containing cards the player doesn't own.");

// ===================== SECTION 6: UPCOMING FEATURES =====================
doc.addPage();
title("6. Upcoming Features & Roadmap");

h2("6.1 Next Up: Shop & Pack Opening Experience");
body("Feature flag: shop_enabled, pack_opening_enabled");
bullet("Visual shop page with pack types and pricing");
bullet("Pack opening animation (card flip reveal with rarity glow)");
bullet("Multiple pack types: Basic (100g), Premium (250g), Element (150g)");
bullet("Purchase history and pack opening log");
bullet("API: GET /api/shop/packs, POST /api/shop/buy-pack");

h2("6.2 Ranked Seasons");
body("Feature flag: ranked_seasons");
bullet("Monthly seasons with themes (e.g., 'Season 1: Flames of Dawn')");
bullet("ELO soft-reset at season end (50% toward 1000)");
bullet("Season-end rewards based on final tier");
bullet("Season countdown timer synced with server time");
bullet("API: GET /api/seasons/current, GET /api/seasons/:id/rewards");

h2("6.3 Battle Pass");
body("Feature flag: battle_pass");
bullet("30-tier reward track per season");
bullet("Free track: Gold, basic packs, common/rare cards");
bullet("Premium track: More gold, premium packs, exclusive cards");
bullet("XP from matches, challenges, achievements drives progression");
bullet("API: GET /api/battle-pass, POST /api/battle-pass/claim/:tier");

h2("6.4 Daily Login Rewards");
body("7-day reward cycle with escalating rewards:");
bullet("Day 1: 10 Gold → Day 7: Premium Pack + 50 Gold");
bullet("Streak counter and calendar UI");
bullet("API: POST /api/daily-login/claim");

h2("6.5 Card Variants & Cosmetics");
body("Future monetization layer:");
bullet("Foil, animated, and alt-art card variants");
bullet("Same stats, different visuals");
bullet("Obtainable through packs, crafting, or shop");
bullet("Premium currency (Gems) for direct purchase");

h2("6.6 Implementation Priority Order");
table(
  ["Phase", "Features", "Estimated Timeline", "Dependencies"],
  [
    ["Phase 1", "Shop + Pack Animation", "Next sprint", "Economy system (done)"],
    ["Phase 2", "Seasons + Battle Pass", "Following sprint", "Shop (phase 1)"],
    ["Phase 3", "Daily Login + Variants", "After phase 2", "Seasons (phase 2)"],
    ["Phase 4", "Tournaments + Draft", "Future", "Stable economy"],
  ]
);

// ===================== SECTION 7: WEBSOCKET CONTRACT =====================
doc.addPage();
title("7. WebSocket Contract");

h2("7.1 Connection");
code(
`// Mobile WebSocket connection
const ws = new WebSocket(
  "wss://wisdom-and-chance-2.replit.app/ws?token=<jwt_token>"
);

// Web uses session cookies automatically
// Mobile MUST pass JWT via query parameter`
);

h2("7.2 Client → Server Events (from /api/docs)");
table(
  ["Event", "Payload", "Description"],
  [
    ["join_room", "{ roomId }", "Subscribe to room updates"],
    ["leave_room", "{ roomId }", "Unsubscribe from room"],
    ["join_game", "{ gameId }", "Subscribe to game state updates"],
    ["leave_game", "{ gameId }", "Unsubscribe from game updates"],
    ["room_message", "{ roomId, message }", "Send chat message in room"],
    ["game_message", "{ gameId, message }", "Send chat message in game"],
    ["game_action", "{ gameId, action }", "Broadcast game state changes"],
  ]
);

body("Additional events supported by the server (not in /api/docs but functional):");
bullet("player_ready — { roomId, ready, deckId? } — toggle ready + select deck");
bullet("game_start — { roomId } — request game start (host)");
bullet("room_update — { roomId } — request room state refresh");
bullet("ping — {} — heartbeat keepalive");
bullet("auth — { token } — authenticate (alternative to query param)");

h2("7.3 Server → Client Events (from /api/docs)");
table(
  ["Event", "Payload", "Description"],
  [
    ["auth_success", "{ userId, displayName }", "Auth confirmed, ready to send"],
    ["auth_error", "{ message }", "Auth failed, will disconnect"],
    ["room_update", "Room state object", "Room state changed"],
    ["player_joined", "{ roomId, userId }", "Player joined room"],
    ["player_left", "{ roomId, userId }", "Player left room"],
    ["player_ready_update", "{ roomId, userId, ready, deckId }", "Ready status changed"],
    ["game_start", "{ roomId, gameId }", "Game started — navigate to game"],
    ["game_action", "Game action object", "Game state update from other player"],
    ["chat_message", "{ roomId, senderId, message, createdAt }", "Chat message in room"],
    ["game_message", "{ userId, displayName, message, timestamp }", "Chat message in game"],
    ["friend_message", "{ id, senderId, receiverId, message }", "Friend direct message"],
    ["friend_request", "{ requestId, senderId }", "Incoming friend request"],
    ["friend_request_accepted", "{ requestId, friendId }", "Request accepted"],
    ["presence_update", "{ userId, status }", "Friend online/offline"],
    ["spectator_joined", "{ roomId, userId }", "Spectator joined"],
    ["spectator_left", "{ roomId, userId }", "Spectator left"],
  ]
);

body("Additional server events (not in /api/docs but emitted by the engine):");
bullet("game_state — full sanitized game state (per-player view)");
bullet("game_over — { winner, reason, goldReward? } — game ended + rewards");
bullet("error — { message } — server error notification");

h2("7.4 Game Action Types");
code(
`game_action message format:
{
  type: "game_action",
  payload: {
    gameId: "uuid",
    action: "draw" | "deploy" | "end_turn" | "use_ability" | "forfeit",
    data: { ...action-specific fields }  // optional
  }
}

draw:        { gameId, action: "draw" }
deploy:      { gameId, action: "deploy", data: { cardIds: ["card-fire-3-2"] } }
use_ability: { gameId, action: "use_ability", data: { abilityId: "..." } }
end_turn:    { gameId, action: "end_turn" }
forfeit:     { gameId, action: "forfeit" }`
);

h2("7.5 Reconnection Handling");
body("The server allows 60-second reconnection window for disconnected players:");
bullet("If a player disconnects during a game, their opponent gets a 60s countdown");
bullet("Reconnecting within 60s resumes the game — server sends full game_state");
bullet("After 60s, the disconnected player auto-forfeits");
bullet("Mobile should implement exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s)");

// ===================== SECTION 8: DATA FLOW DIAGRAMS =====================
doc.addPage();
title("8. Data Flow Diagrams");

h2("8.1 Economy Transaction Flow");
code(
`┌─────────┐    POST /api/packs/open    ┌──────────┐
│  Mobile  │ ──────────────────────────►│  Server  │
│  Client  │                            │          │
│          │◄──────────────────────────│          │
└─────────┘  { cards[], remainingGold } └──────────┘
                                             │
                                    ┌────────┼────────┐
                                    │        │        │
                               Check gold  Deduct  Add cards
                               >= 100     gold    to collection
                               (WHERE)    (atomic) (upsert)
                                    │        │        │
                                    └────────┼────────┘
                                             │
                                        ┌────▼────┐
                                        │   DB    │
                                        └─────────┘`
);

h2("8.2 Match Reward Flow");
code(
`┌──────────┐  game_action   ┌──────────┐  game_over   ┌──────────┐
│ Player A │◄──────────────►│  Server  │─────────────►│ Player B │
└──────────┘                │  Engine  │              └──────────┘
                            └────┬─────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
               Record game  Grant gold   Grant gold
               to database  to winner    to loser
                    │        (30 gold)   (10 gold)
                    │            │            │
                    └────────────┼────────────┘
                                 │
                           ┌─────▼─────┐
                           │    DB     │
                           └───────────┘
Note: Gold only granted when economy_enabled = true`
);

h2("8.3 Authentication Flow");
code(
`┌──────────┐                        ┌──────────┐
│  Mobile  │  POST /api/mobile/     │  Server  │
│   App    │  auth/login            │          │
│          │───────────────────────►│          │
│          │  { email, provider }   │          │
│          │                        │          │
│          │◄───────────────────────│          │
│          │  { token, user }       │          │
│          │                        │          │
│  Store   │  Bearer <token>        │  Verify  │
│  in      │  on all requests       │  JWT on  │
│  Keychain│───────────────────────►│  every   │
│          │                        │  request │
└──────────┘                        └──────────┘

Token refresh: POST /api/mobile/auth/refresh
Returns new 7-day token. Call before expiry.`
);

h2("8.4 Season Progression (Planned)");
code(
`Match Win/Challenge Complete/Achievement Unlock
              │
              ▼
         Grant XP to player
              │
              ▼
    Check Battle Pass tier
    (currentXp >= tierThreshold?)
              │
         ┌────┴────┐
         │ Yes     │ No
         ▼         ▼
   Unlock tier   Continue
   rewards       playing
   (notify)
              │
              ▼
    Season End → Soft-reset ELO
                 → Grant tier rewards
                 → Archive to history`
);

// ===================== SECTION 9: MOBILE RECOMMENDATIONS =====================
doc.addPage();
title("9. Mobile-Specific Recommendations");

h2("9.1 Offline Caching Strategy");
bullet("Cache card data and commanders in local storage (SQLite/AsyncStorage)");
bullet("Cache user's decks for offline viewing (not editing)");
bullet("Cache leaderboard and friend list with timestamps");
bullet("Show cached data immediately, refresh in background");
bullet("Never cache game state — always require live connection for play");
bullet("Cache feature flags for 5 minutes max");

h2("9.2 Push Notification Hooks");
body("The server can be extended with push notification triggers for:");
bullet("Friend request received");
bullet("Challenge/match invitation");
bullet("Daily challenge refresh (midnight UTC)");
bullet("Season ending soon (24h, 1h warnings)");
bullet("Battle pass tier unlocked");
bullet("Achievement completed");
body("Mobile should register device token via future endpoint: POST /api/push/register");

h2("9.3 Reconnection Handling");
bullet("Implement WebSocket heartbeat (ping every 30s)");
bullet("Exponential backoff on disconnect: 1s → 2s → 4s → 8s → max 30s");
bullet("On reconnect during active game: server auto-sends full game_state");
bullet("60-second window before auto-forfeit — show reconnection countdown to user");
bullet("On reconnect outside game: re-fetch /api/config, re-establish presence");

h2("9.4 Image Handling");
bullet("Card images available at: GET /api/cards/:id/image");
bullet("Commander images at: GET /api/commanders/:id/image");
bullet("Cache images aggressively — they rarely change");
bullet("Use placeholder/skeleton images while loading");
bullet("Consider progressive image loading for card database");

h2("9.5 Error Handling");
body("Standard error response format:");
code(
`{
  "message": "Human-readable error description",
  "error": "Error type identifier"  // optional
}

Common status codes:
  400 — Validation error (check message for details)
  401 — Token expired or invalid (redirect to login)
  403 — Not authorized for this resource
  404 — Resource not found
  429 — Rate limited (back off and retry)
  500 — Server error (show generic error, retry)
  503 — Maintenance mode (check /api/config)`
);

h2("9.6 Performance Tips");
bullet("Batch API calls on app launch: /api/config + /api/cards + /api/auth/user");
bullet("Use ETag/If-None-Match headers for card data caching");
bullet("Paginate leaderboard requests (server returns top 100)");
bullet("Debounce deck save calls (500ms delay after last edit)");
bullet("Pre-fetch next game state on opponent's turn");

// ===================== SECTION 10: APPENDIX =====================
doc.addPage();
title("10. Appendix: Quick Reference");

h2("10.1 Card ID Format");
code(`card-{element}-{power}-{variant}\nExamples: card-fire-3-2, card-water-7-1, card-earth-10-0`);

h2("10.2 Element List");
code(`Fire | Water | Earth | Air | Nature\n(5 elements, 40 cards each = 200 total)`);

h2("10.3 Deck Validation Rules");
table(
  ["Rule", "Value"],
  [
    ["Total cards", "Exactly 40"],
    ["Cards per power rank", "4 (ranks 1-10)"],
    ["Max copies per card", "3"],
    ["Commander required", "Yes (1 per deck)"],
    ["Ownership check", "When economy_enabled=true"],
  ]
);

h2("10.4 ELO Rating Tiers");
table(
  ["Tier", "Rating Range"],
  [
    ["Bronze", "< 800"],
    ["Silver", "800 – 999"],
    ["Gold", "1000 – 1199"],
    ["Platinum", "1200 – 1399"],
    ["Diamond", "1400 – 1599"],
    ["Master", "1600+"],
  ]
);

h2("10.5 Game Constants");
code(
`Starting HP: 40
Cards per hand: 5 (initial draw)
Deployment slots: 4 per side
Turn phases: Draw → Deploy → Combat → Calculate → End
Max power per card: 10
Buff/Debuff colors: Red, Blue, Green, Yellow, Purple`
);

h2("10.6 Key Server Files (For Reference)");
table(
  ["File", "Purpose"],
  [
    ["server/apiDocs.ts", "Full API documentation (JSON)"],
    ["server/routes.ts", "All REST endpoints"],
    ["server/websocket.ts", "WebSocket event handling"],
    ["server/gameEngine.ts", "Server-authoritative game engine"],
    ["server/economyService.ts", "Economy helpers (grantGold, etc.)"],
    ["server/multiplayerRoutes.ts", "Multiplayer & social endpoints"],
    ["server/mobileAuth.ts", "Mobile JWT auth"],
    ["shared/schema.ts", "DB schema + types"],
    ["shared/models/economy.ts", "Economy tables + constants"],
  ]
);

h2("10.7 Admin Endpoints (For Debugging)");
body("Note: Admin endpoints require admin authentication. Contact the project owner for access codes.");
table(
  ["Method", "Path", "Description"],
  [
    ["GET", "/api/admin/sync", "Full data dump (code-protected)"],
    ["GET", "/api/admin/feature-flags", "View all feature flags"],
    ["PATCH", "/api/admin/feature-flags/:key", "Toggle a feature flag"],
    ["GET", "/api/admin/database-export", "Export all DB tables as JSON"],
  ]
);

doc.end();

stream.on("finish", () => {
  console.log(`PDF generated: ${outputPath}`);
  console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
});
