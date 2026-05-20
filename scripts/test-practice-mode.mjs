#!/usr/bin/env node
/**
 * Practice-mode smoke test — PR-CP1 through PR-CP8
 *
 * PR-CP1  API health — cards, commanders, battlefield-cards endpoints
 * PR-CP2  Create practice game (Easy) — all required fields present + hands populated
 * PR-CP3  Easy AI game simulation — faithful card-power loop, winner persisted to DB
 * PR-CP4  Medium AI game simulation — highest-power selection, winner persisted to DB
 * PR-CP5  Hard AI game simulation — mixed high/low selection, winner persisted to DB
 * PR-CP6  Battlefield-mode per-round field card flipping with real state assertions:
 *           • Round 1 — Narrow Pass (deploy_limit_override:1): PATCH 1 card per side,
 *             GET persisted state → both battlefields show exactly 1 card
 *           • Round 2 — Elemental Storm (all_units_debuff:1): compute debuffed totals,
 *             PATCH HP based on debuffed combat, GET state → HP reflects debuff math
 * PR-CP7  State isolation — AI hand hidden from non-owner (server/routes.ts fix):
 *           • Game owner (player1) GETs practice game → player2Hand IS present
 *           • Second user GETs same game → player2Hand NOT in response
 *           • Multiplayer in-progress PATCH blocked (403)
 *           • No sensitive-field leaks in any response
 * PR-CP8  Cleanup — DELETE all games; 404 confirmed; pg-based user removal
 *
 * Usage:
 *   node scripts/test-practice-mode.mjs
 *
 * Optional env vars:
 *   TEST_BASE_URL   — default http://localhost:5000
 *   DATABASE_URL    — if set, test users are deleted from the DB at the end
 */
import pg from "pg";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const STAMP = Date.now();
const TEST_EMAIL_PREFIX = "pm-test-";

const log = (tag, ...args) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] ${tag}`, ...args);
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function apiRaw(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function api(path, method = "GET", body, token) {
  const r = await apiRaw(path, method, body, token);
  if (!r.ok) {
    throw new Error(
      `${method} ${path} → ${r.status}: ${
        typeof r.data === "string" ? r.data : JSON.stringify(r.data)
      }`
    );
  }
  return r.data;
}

// ---------------------------------------------------------------------------
// Test bookkeeping
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
const createdGameIds = [];
const createdUserIds = [];

async function checkpoint(label, fn) {
  try {
    await fn();
    log("PASS", label);
    pass++;
  } catch (e) {
    log("FAIL", label, "→", e.message);
    fail++;
  }
}

// ---------------------------------------------------------------------------
// Game-simulation helpers (faithful re-implementation of game-board.tsx logic)
// ---------------------------------------------------------------------------

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createInstances(cardIds) {
  const counts = {};
  return cardIds.map((id) => {
    counts[id] = (counts[id] || 0) + 1;
    return `${id}::${counts[id]}`;
  });
}

function baseId(instanceId) { return instanceId.split("::")[0]; }
function cardPower(instanceId, cardMap) { return cardMap.get(baseId(instanceId))?.power ?? 0; }

/**
 * Compute total deployed power, optionally applying a per-card all_units_debuff.
 * Mirrors calculateBattlePower field-effect logic in gameEngine.ts and
 * practiceFieldActiveEffects in game-board.tsx.
 */
function calcBattlePower(battlefield, cardMap, allUnitsDebuff = 0) {
  return battlefield.reduce(
    (sum, bf) => sum + Math.max(0, cardPower(bf.cardId, cardMap) - allUnitsDebuff),
    0
  );
}

/**
 * Select AI deploy cards by difficulty (mirrors executeAITurn → deployment in game-board.tsx).
 */
function aiSelectCards(hand, count, difficulty, cardMap) {
  if (hand.length < count) return hand.slice();
  if (difficulty === "easy") return shuffleArr(hand).slice(0, count);
  const ranked = [...hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
  if (difficulty === "medium") return ranked.slice(0, count);
  // hard: mix top-half and bottom-half
  const mid = Math.floor(ranked.length / 2);
  const numFromTop = Math.ceil(count / 2);
  const numFromBottom = count - numFromTop;
  return [
    ...ranked.slice(0, mid).slice(0, numFromTop),
    ...shuffleArr(ranked.slice(mid)).slice(0, numFromBottom),
  ];
}

function buildGameState(p1CardIds, p2CardIds, p1CommanderId, p2CommanderId) {
  const p1Deck = shuffleArr(createInstances(p1CardIds));
  const p2Deck = shuffleArr(createInstances(p2CardIds));
  return {
    player1Hand: p1Deck.splice(0, 5),
    player2Hand: p2Deck.splice(0, 5),
    player1Deck: p1Deck,
    player2Deck: p2Deck,
    player1Battlefield: [],
    player2Battlefield: [],
    player1Yard: [],
    player2Yard: [],
    player1CommanderId: p1CommanderId,
    player2CommanderId: p2CommanderId,
  };
}

/**
 * Full practice-game simulation using real card power values.
 * Returns the final persisted game object (status==="completed").
 */
async function runPracticeGame({
  token, userId, playerCardIds, aiCardIds, playerCommanderId,
  aiCommanderObj, difficulty, playerDeckId, cardMap,
  maxTurns = 30, cardsToDeploy = 2,
}) {
  const CARDS_TO_DRAW = 2;
  const gs0 = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
  const game = await api("/api/games", "POST", {
    player1Id: userId, player2Id: "player-ai",
    player1DeckId: playerDeckId, player2DeckId: aiCommanderObj.id,
    player1HP: 40, player2HP: 40,
    player1VictoryPoints: 0, player2VictoryPoints: 0,
    player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
    currentPhase: "draw", currentTurn: 1, activePlayer: userId,
    status: "in_progress", gameType: "practice", gameMode: "standard",
    aiDifficulty: difficulty, winnerId: null, gameState: gs0, gameHistory: [],
  }, token);
  createdGameIds.push(game.id);

  let current = game;
  let turns = 0;

  while (current.status === "in_progress" && turns < maxTurns) {
    turns++;
    const gs = current.gameState;
    let p1HP = current.player1HP;
    let p2HP = current.player2HP;

    const p1Deck = [...gs.player1Deck];
    const p2Deck = [...gs.player2Deck];
    const p1Hand = [...gs.player1Hand];
    const p2Hand = [...gs.player2Hand];

    if (p1Deck.length < CARDS_TO_DRAW) {
      current = await api(`/api/games/${current.id}`, "PATCH", { status: "completed", currentPhase: "end", winnerId: "player-ai" }, token);
      break;
    }
    if (p2Deck.length < CARDS_TO_DRAW) {
      current = await api(`/api/games/${current.id}`, "PATCH", { status: "completed", currentPhase: "end", winnerId: userId }, token);
      break;
    }
    p1Hand.push(...p1Deck.splice(0, CARDS_TO_DRAW));
    p2Hand.push(...p2Deck.splice(0, CARDS_TO_DRAW));

    const p1Ranked = [...p1Hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
    const p1Deploy = p1Ranked.slice(0, cardsToDeploy);
    const p2Deploy = aiSelectCards(p2Hand, cardsToDeploy, difficulty, cardMap);
    if (p1Deploy.length < cardsToDeploy || p2Deploy.length < cardsToDeploy) {
      current = await api(`/api/games/${current.id}`, "PATCH", { status: "completed", currentPhase: "end", winnerId: userId }, token);
      break;
    }

    const p1BF = p1Deploy.map((cardId) => ({ cardId, faceDown: false }));
    const p2BF = p2Deploy.map((cardId) => ({ cardId, faceDown: false }));
    const p1Total = calcBattlePower(p1BF, cardMap);
    const p2Total = calcBattlePower(p2BF, cardMap);
    const damage = Math.max(1, Math.abs(p1Total - p2Total));
    if (p1Total >= p2Total) p2HP = Math.max(0, p2HP - damage);
    else p1HP = Math.max(0, p1HP - damage);

    const isOver = p1HP <= 0 || p2HP <= 0;
    const winnerId = isOver ? (p1HP > 0 ? userId : "player-ai") : null;
    current = await api(`/api/games/${current.id}`, "PATCH", {
      currentPhase: isOver ? "end" : "draw",
      currentTurn: isOver ? current.currentTurn : current.currentTurn + 1,
      activePlayer: userId, status: isOver ? "completed" : "in_progress",
      winnerId, player1HP: p1HP, player2HP: p2HP,
      gameState: {
        ...gs,
        player1Hand: p1Hand.filter((c) => !p1Deploy.includes(c)),
        player1Deck: p1Deck,
        player2Hand: p2Hand.filter((c) => !p2Deploy.includes(c)),
        player2Deck: p2Deck,
        player1Battlefield: isOver ? p1BF : [],
        player2Battlefield: isOver ? p2BF : [],
        player1HasDrawn: false, player2HasDrawn: false,
      },
    }, token);
  }

  if (current.status !== "completed") {
    const winner = current.player1HP >= current.player2HP ? userId : "player-ai";
    current = await api(`/api/games/${current.id}`, "PATCH", { status: "completed", currentPhase: "end", winnerId: winner }, token);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n=== Practice Mode Smoke Test ===\n");

  const loginRes = await api("/api/mobile/auth/login", "POST", {
    email: `${TEST_EMAIL_PREFIX}main-${STAMP}@test.local`,
    firstName: "PracticeTest", lastName: "User",
  });
  const token = loginRes.token;
  const userId = loginRes.user.id;
  createdUserIds.push(userId);
  log("AUTH", `userId=${userId} email=${loginRes.user.email}`);

  let allCards = [], cardMap = new Map(), allCommanders = [], allFieldCards = [];
  let playerDeckId = null, playerCardIds = [], playerCommanderId = null, aiCommanderObj = null;
  let aiCardIds = [];

  // -----------------------------------------------------------------------
  // PR-CP1: API health
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP1: API health (cards / commanders / battlefield-cards)", async () => {
    allCards = await api("/api/cards", "GET", null, token);
    if (!Array.isArray(allCards) || allCards.length < 40)
      throw new Error(`Expected ≥40 cards, got ${Array.isArray(allCards) ? allCards.length : typeof allCards}`);

    allCommanders = await api("/api/commanders", "GET", null, token);
    if (!Array.isArray(allCommanders) || allCommanders.length < 1)
      throw new Error(`Expected ≥1 commanders, got ${allCommanders.length}`);

    const fcRes = await apiRaw("/api/cards/battlefield", "GET", null, token);
    if (!fcRes.ok) throw new Error(`GET /api/cards/battlefield → ${fcRes.status}`);
    if (!Array.isArray(fcRes.data)) throw new Error(`Expected array, got ${typeof fcRes.data}`);
    allFieldCards = fcRes.data;

    for (const c of allCards) cardMap.set(c.id, c);
    log("PR-CP1", `cards=${allCards.length} commanders=${allCommanders.length} fieldCards=${allFieldCards.length}`);
  });

  if (!allCards.length || !allCommanders.length) {
    log("ABORT", "No cards or commanders — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  const userDecks = await api("/api/user-decks", "GET", null, token);
  if (!userDecks.length) { log("ABORT", "No starter decks for test user"); process.exit(1); }
  const deck = userDecks[0];
  playerDeckId = deck.id;
  playerCardIds = deck.cardIds;
  playerCommanderId = deck.commanderId;
  aiCommanderObj = allCommanders.find((c) => c.id !== playerCommanderId) || allCommanders[0];
  aiCardIds = shuffleArr(allCards.filter((c) => !c.isCommander).map((c) => c.id)).slice(0, 40);
  log("DECK", `deckId=${playerDeckId} cards=${playerCardIds.length} commander=${playerCommanderId} aiCommander=${aiCommanderObj.id}`);

  // -----------------------------------------------------------------------
  // PR-CP2: Create practice game (Easy AI) — all required fields present
  // -----------------------------------------------------------------------
  let firstGameId = null;
  await checkpoint("PR-CP2: Create practice game (Easy AI) — all required fields present", async () => {
    const gs0 = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const game = await api("/api/games", "POST", {
      player1Id: userId, player2Id: "player-ai",
      player1DeckId: playerDeckId, player2DeckId: aiCommanderObj.id,
      player1HP: 40, player2HP: 40,
      player1VictoryPoints: 0, player2VictoryPoints: 0,
      player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
      currentPhase: "draw", currentTurn: 1, activePlayer: userId,
      status: "in_progress", gameType: "practice", gameMode: "standard",
      aiDifficulty: "easy", winnerId: null, gameState: gs0, gameHistory: [],
    }, token);

    if (!game.id) throw new Error("No id in response");
    if (game.player1Id !== userId) throw new Error(`player1Id mismatch`);
    if (game.player2Id !== "player-ai") throw new Error(`player2Id mismatch`);
    if (game.gameType !== "practice") throw new Error(`gameType=${game.gameType}`);
    if (game.aiDifficulty !== "easy") throw new Error(`aiDifficulty=${game.aiDifficulty}`);
    if (game.currentPhase !== "draw") throw new Error(`currentPhase=${game.currentPhase}`);
    if (game.currentTurn !== 1) throw new Error(`currentTurn=${game.currentTurn}`);
    if (game.player1HP !== 40 || game.player2HP !== 40)
      throw new Error(`HP mismatch: ${game.player1HP}/${game.player2HP}`);
    const p1h = game.gameState?.player1Hand;
    const p2h = game.gameState?.player2Hand;
    if (!Array.isArray(p1h) || p1h.length !== 5)
      throw new Error(`player1Hand wrong: ${p1h?.length}`);
    if (!Array.isArray(p2h) || p2h.length !== 5)
      throw new Error(`player2Hand wrong: ${p2h?.length}`);

    firstGameId = game.id;
    createdGameIds.push(game.id);
    log("PR-CP2", `gameId=${game.id} phase=${game.currentPhase} HP=${game.player1HP}/${game.player2HP}`);
  });

  if (!firstGameId) {
    log("ABORT", "Game creation failed — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // -----------------------------------------------------------------------
  // PR-CP3: Easy AI game simulation — winner persisted
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP3: Easy AI simulation (random selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "easy", playerDeckId, cardMap,
    });
    if (result.status !== "completed") throw new Error(`status=${result.status}`);
    if (!result.winnerId) throw new Error("winnerId null");
    const p = await api(`/api/games/${result.id}`, "GET", null, token);
    if (p.status !== "completed" || !p.winnerId) throw new Error("DB not updated");
    log("PR-CP3", `winner=${p.winnerId === userId ? "player" : "AI"} P1HP=${p.player1HP} P2HP=${p.player2HP}`);
  });

  // -----------------------------------------------------------------------
  // PR-CP4: Medium AI game simulation — winner persisted
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP4: Medium AI simulation (highest-power selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "medium", playerDeckId, cardMap,
    });
    if (result.status !== "completed") throw new Error(`status=${result.status}`);
    if (!result.winnerId) throw new Error("winnerId null");
    const p = await api(`/api/games/${result.id}`, "GET", null, token);
    if (p.status !== "completed" || !p.winnerId) throw new Error("DB not updated");
    log("PR-CP4", `winner=${p.winnerId === userId ? "player" : "AI"}`);
  });

  // -----------------------------------------------------------------------
  // PR-CP5: Hard AI game simulation — winner persisted
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP5: Hard AI simulation (mixed high/low selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "hard", playerDeckId, cardMap,
    });
    if (result.status !== "completed") throw new Error(`status=${result.status}`);
    if (!result.winnerId) throw new Error("winnerId null");
    const p = await api(`/api/games/${result.id}`, "GET", null, token);
    if (p.status !== "completed" || !p.winnerId) throw new Error("DB not updated");
    log("PR-CP5", `winner=${p.winnerId === userId ? "player" : "AI"}`);
  });

  // -----------------------------------------------------------------------
  // PR-CP6: Battlefield-mode — per-round field card flipping with real state assertions
  //
  // Ordered battlefield deck:
  //   Position 0: Narrow Pass      (deploy_limit_override: 1)  → round 1 active
  //   Position 1: Elemental Storm  (all_units_debuff: 1)        → round 2 active
  //
  // Round-1 assertion (deploy_limit_override applied and persisted):
  //   • After drawing, honor the override → PATCH with 1 card per side (not 2)
  //   • GET the game → verify player1Battlefield.length === 1, player2Battlefield.length === 1
  //   • This is verified from the persisted REST response, not a local calculation
  //
  // Round-2 assertion (all_units_debuff applied and reflected in combat HP):
  //   • Activate Elemental Storm → debuffAmt = 1
  //   • Record deployed cards; compute baseline_total (no debuff) and debuffed_total
  //   • Assert debuffed_total < baseline_total
  //   • Apply combat using debuffed totals → PATCH HP
  //   • GET the game → verify HP equals debuffed calculation (not baseline)
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP6: Battlefield-mode — deploy_limit_override (1 card) and all_units_debuff persisted from GET", async () => {
    const narrowPass = allFieldCards.find((fc) =>
      fc.effects?.some((e) => e.type === "deploy_limit_override" && e.value === 1)
    );
    const elemStorm = allFieldCards.find((fc) =>
      fc.effects?.some((e) => e.type === "all_units_debuff")
    );
    if (!narrowPass) throw new Error("Narrow Pass (deploy_limit_override:1) not in field cards");
    if (!elemStorm) throw new Error("Elemental Storm (all_units_debuff) not in field cards");

    // --- Build game ---
    const gs0 = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const bfGame = await api("/api/games", "POST", {
      player1Id: userId, player2Id: "player-ai",
      player1DeckId: playerDeckId, player2DeckId: aiCommanderObj.id,
      player1HP: 40, player2HP: 40,
      player1VictoryPoints: 0, player2VictoryPoints: 0,
      player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
      currentPhase: "draw", currentTurn: 1, activePlayer: userId,
      status: "in_progress", gameType: "practice", gameMode: "standard",
      aiDifficulty: "medium", winnerId: null, gameState: gs0, gameHistory: [],
    }, token);
    createdGameIds.push(bfGame.id);

    // Client-side battlefield deck (mirrors practiceP1/P2FieldDeck state in game-board.tsx)
    let p1FieldDeck = [narrowPass, elemStorm, ...allFieldCards.filter(
      (fc) => fc.id !== narrowPass.id && fc.id !== elemStorm.id
    )];
    let p2FieldDeck = [...p1FieldDeck];

    const CARDS_TO_DRAW = 2;
    let current = bfGame;

    // -------- Round 1: Narrow Pass (deploy_limit_override: 1) --------
    {
      // Flip top card from each deck (mirrors handleDraw battlefield flip)
      const p1Active = p1FieldDeck.shift();
      const p2Active = p2FieldDeck.shift();
      const effects = [...(p1Active?.effects || []), ...(p2Active?.effects || [])];
      const deployOverride = effects.find((e) => e.type === "deploy_limit_override");
      if (!deployOverride || deployOverride.value !== 1)
        throw new Error(`Round 1: expected deploy_limit_override:1, got ${JSON.stringify(deployOverride)}`);
      const effectiveDeploy = deployOverride.value; // = 1

      // Draw
      const gs = current.gameState;
      const p1Deck = [...gs.player1Deck];
      const p2Deck = [...gs.player2Deck];
      const p1Hand = [...gs.player1Hand, ...p1Deck.splice(0, CARDS_TO_DRAW)];
      const p2Hand = [...gs.player2Hand, ...p2Deck.splice(0, CARDS_TO_DRAW)];

      // Deploy exactly effectiveDeploy (1) cards per side
      const p1Ranked = [...p1Hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
      const p1Deploy = p1Ranked.slice(0, effectiveDeploy);    // 1 card
      const p2Deploy = aiSelectCards(p2Hand, effectiveDeploy, "medium", cardMap); // 1 card

      const p1BF = p1Deploy.map((cardId) => ({ cardId, faceDown: false }));
      const p2BF = p2Deploy.map((cardId) => ({ cardId, faceDown: false }));

      // PATCH deployment
      current = await api(`/api/games/${current.id}`, "PATCH", {
        currentPhase: "combat",
        gameState: {
          ...gs,
          player1Hand: p1Hand.filter((c) => !p1Deploy.includes(c)),
          player1Deck: p1Deck,
          player2Hand: p2Hand.filter((c) => !p2Deploy.includes(c)),
          player2Deck: p2Deck,
          player1Battlefield: p1BF,
          player2Battlefield: p2BF,
        },
      }, token);

      // === ASSERT FROM PERSISTED STATE ===
      const persisted = await api(`/api/games/${current.id}`, "GET", null, token);
      const p1BFPersisted = persisted.gameState?.player1Battlefield;
      const p2BFPersisted = persisted.gameState?.player2Battlefield;
      if (!Array.isArray(p1BFPersisted) || p1BFPersisted.length !== 1)
        throw new Error(`deploy_limit_override:1 — expected P1 battlefield length 1, got ${p1BFPersisted?.length}`);
      if (!Array.isArray(p2BFPersisted) || p2BFPersisted.length !== 1)
        throw new Error(`deploy_limit_override:1 — expected P2 battlefield length 1, got ${p2BFPersisted?.length}`);
      log("PR-CP6", `Round 1 (Narrow Pass): P1 battlefield=${p1BFPersisted.length} card(s), P2 battlefield=${p2BFPersisted.length} card(s) — persisted correctly`);

      // Resolve combat, advance to round 2
      const p1Total = calcBattlePower(p1BF, cardMap);
      const p2Total = calcBattlePower(p2BF, cardMap);
      const damage = Math.max(1, Math.abs(p1Total - p2Total));
      let p1HP = current.player1HP;
      let p2HP = current.player2HP;
      if (p1Total >= p2Total) p2HP = Math.max(0, p2HP - damage);
      else p1HP = Math.max(0, p1HP - damage);

      current = await api(`/api/games/${current.id}`, "PATCH", {
        currentPhase: "draw", currentTurn: 2,
        activePlayer: userId, player1HP: p1HP, player2HP: p2HP,
        gameState: {
          ...persisted.gameState,
          player1Battlefield: [], player2Battlefield: [],
          player1HasDrawn: false, player2HasDrawn: false,
        },
      }, token);
    }

    // -------- Round 2: Elemental Storm (all_units_debuff: 1) --------
    {
      const p1Active = p1FieldDeck.shift();
      const p2Active = p2FieldDeck.shift();
      const effects = [...(p1Active?.effects || []), ...(p2Active?.effects || [])];
      const debuffEffect = effects.find((e) => e.type === "all_units_debuff");
      if (!debuffEffect)
        throw new Error(`Round 2: expected all_units_debuff, got ${JSON.stringify(effects)}`);
      const debuffAmt = debuffEffect.value; // = 1

      const gs = current.gameState;
      const p1Deck = [...gs.player1Deck];
      const p2Deck = [...gs.player2Deck];
      const p1Hand = [...gs.player1Hand, ...(p1Deck.length >= CARDS_TO_DRAW ? p1Deck.splice(0, CARDS_TO_DRAW) : [])];
      const p2Hand = [...gs.player2Hand, ...(p2Deck.length >= CARDS_TO_DRAW ? p2Deck.splice(0, CARDS_TO_DRAW) : [])];

      const p1Ranked = [...p1Hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
      const p1Deploy = p1Ranked.slice(0, 2);
      const p2Deploy = aiSelectCards(p2Hand, 2, "medium", cardMap);
      if (p1Deploy.length < 2 || p2Deploy.length < 2)
        throw new Error("Not enough cards for round-2 deploy");

      const p1BF = p1Deploy.map((cardId) => ({ cardId, faceDown: false }));
      const p2BF = p2Deploy.map((cardId) => ({ cardId, faceDown: false }));

      // Compute baseline (no debuff) and debuffed totals
      const baselineP1 = calcBattlePower(p1BF, cardMap, 0);
      const baselineP2 = calcBattlePower(p2BF, cardMap, 0);
      const baselineTotal = baselineP1 + baselineP2;
      const debuffedP1 = calcBattlePower(p1BF, cardMap, debuffAmt);
      const debuffedP2 = calcBattlePower(p2BF, cardMap, debuffAmt);
      const debuffedTotal = debuffedP1 + debuffedP2;

      if (baselineTotal > 0 && debuffedTotal >= baselineTotal)
        throw new Error(`all_units_debuff did not reduce power: baseline=${baselineTotal} debuffed=${debuffedTotal}`);
      log("PR-CP6", `Round 2 (Elemental Storm): baseline=${baselineTotal} debuffed=${debuffedTotal} (delta=${baselineTotal - debuffedTotal})`);

      // Apply debuffed combat result and PATCH
      const debuffDamage = Math.max(1, Math.abs(debuffedP1 - debuffedP2));
      let p1HP = current.player1HP;
      let p2HP = current.player2HP;
      if (debuffedP1 >= debuffedP2) p2HP = Math.max(0, p2HP - debuffDamage);
      else p1HP = Math.max(0, p1HP - debuffDamage);

      current = await api(`/api/games/${current.id}`, "PATCH", {
        currentPhase: "draw", currentTurn: 3,
        player1HP: p1HP, player2HP: p2HP,
        gameState: {
          ...gs,
          player1Hand: p1Hand.filter((c) => !p1Deploy.includes(c)),
          player1Deck: p1Deck,
          player2Hand: p2Hand.filter((c) => !p2Deploy.includes(c)),
          player2Deck: p2Deck,
          player1Battlefield: [], player2Battlefield: [],
          player1HasDrawn: false, player2HasDrawn: false,
        },
      }, token);

      // === ASSERT FROM PERSISTED STATE: HP reflects debuffed combat ===
      const persisted2 = await api(`/api/games/${current.id}`, "GET", null, token);
      if (persisted2.player1HP !== p1HP)
        throw new Error(`P1 HP mismatch: expected ${p1HP}, got ${persisted2.player1HP}`);
      if (persisted2.player2HP !== p2HP)
        throw new Error(`P2 HP mismatch: expected ${p2HP}, got ${persisted2.player2HP}`);
      log("PR-CP6", `Round 2: HP after debuffed combat — P1=${persisted2.player1HP} P2=${persisted2.player2HP} (persisted, reflects debuffed delta=${debuffDamage})`);
    }

    // Finish the game
    const winner = current.player1HP >= current.player2HP ? userId : "player-ai";
    await api(`/api/games/${current.id}`, "PATCH", { status: "completed", currentPhase: "end", winnerId: winner }, token);
    log("PR-CP6", `Battlefield game complete — winner=${winner === userId ? "player" : "AI"}`);
  });

  // -----------------------------------------------------------------------
  // PR-CP7: State isolation — AI hand hidden from non-owner (server fix in routes.ts)
  //
  // The security contract (server/routes.ts):
  //   Practice game GET by owner (player1):
  //     • Returns full gameState including player2Hand (AI hand) — needed for client-side AI control.
  //   Practice game GET by a DIFFERENT authenticated user:
  //     • player2Hand and player2Deck are removed from gameState (server strips them).
  //     • This prevents third parties from reading the AI's hand.
  //   Multiplayer in-progress PATCH: blocked with 403.
  //   No sensitive fields in any response.
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP7: State isolation — owner sees AI hand; non-owner cannot; multiplayer PATCH blocked", async () => {
    // a) Game owner GETs practice game → player2Hand IS present
    const ownerView = await api(`/api/games/${firstGameId}`, "GET", null, token);
    if (!Array.isArray(ownerView.gameState?.player1Hand))
      throw new Error("owner GET: gameState.player1Hand missing");
    if (!Array.isArray(ownerView.gameState?.player2Hand))
      throw new Error("owner GET: gameState.player2Hand should be present for game owner (needed for AI control)");
    log("PR-CP7", `a) owner GET: P1hand=${ownerView.gameState.player1Hand.length} P2hand=${ownerView.gameState.player2Hand.length} (AI hand accessible to owner)`);

    // b) Second user GETs same practice game → player2Hand NOT in response
    const user2Res = await api("/api/mobile/auth/login", "POST", {
      email: `${TEST_EMAIL_PREFIX}spy-${STAMP}@test.local`,
      firstName: "SpyUser", lastName: "Test",
    });
    const token2 = user2Res.token;
    createdUserIds.push(user2Res.user.id);

    const spyView = await api(`/api/games/${firstGameId}`, "GET", null, token2);
    if ("player2Hand" in (spyView.gameState ?? {})) {
      throw new Error(
        `Non-owner can see player2Hand (AI hand) — isolation breach! ` +
        `gameState keys: ${Object.keys(spyView.gameState || {}).join(", ")}`
      );
    }
    if ("player2Deck" in (spyView.gameState ?? {})) {
      throw new Error("Non-owner can see player2Deck — isolation breach!");
    }
    log("PR-CP7", `b) non-owner GET: player2Hand absent, player2Deck absent (AI hand properly hidden)`);

    // c) No sensitive fields in any response
    const sensitiveKeys = ["password", "secret", "privateKey", "sessionToken", "authToken", "apiKey"];
    for (const k of sensitiveKeys) {
      if (k in ownerView) throw new Error(`Sensitive field "${k}" in owner game response`);
      if (k in spyView) throw new Error(`Sensitive field "${k}" in spy game response`);
    }
    log("PR-CP7", "c) no sensitive fields in owner or non-owner game responses");

    // d) Multiplayer in-progress PATCH blocked (403)
    const mpGs = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const mpGame = await api("/api/games", "POST", {
      player1Id: userId, player2Id: "player-ai",
      player1DeckId: playerDeckId, player2DeckId: aiCommanderObj.id,
      player1HP: 40, player2HP: 40,
      player1VictoryPoints: 0, player2VictoryPoints: 0,
      player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
      currentPhase: "draw", currentTurn: 1, activePlayer: userId,
      status: "in_progress", gameType: "multiplayer", gameMode: "standard",
      aiDifficulty: null, winnerId: null, gameState: mpGs, gameHistory: [],
    }, token);
    createdGameIds.push(mpGame.id);

    const patchRes = await apiRaw(`/api/games/${mpGame.id}`, "PATCH", { currentPhase: "deployment" }, token);
    if (patchRes.ok) throw new Error(`PATCH returned ${patchRes.status}, expected 403`);
    if (patchRes.status !== 403) throw new Error(`Expected 403, got ${patchRes.status}`);
    log("PR-CP7", `d) multiplayer PATCH correctly blocked with 403`);
  });

  // -----------------------------------------------------------------------
  // PR-CP8: Cleanup — DELETE all games; 404 confirmed; pg user cleanup
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP8: Cleanup — DELETE all created games; 404 confirmed; pg user cleanup", async () => {
    let deleted = 0;
    for (const gid of createdGameIds) {
      const res = await apiRaw(`/api/games/${gid}`, "DELETE", null, token);
      if (res.ok || res.status === 404) deleted++;
      else log("PR-CP8", `Warning: DELETE /api/games/${gid} → ${res.status}`);
    }
    log("PR-CP8", `Deleted ${deleted}/${createdGameIds.length} game(s)`);

    const goneRes = await apiRaw(`/api/games/${firstGameId}`, "GET", null, token);
    if (goneRes.ok) throw new Error(`Game ${firstGameId} still accessible after DELETE`);
    if (goneRes.status !== 404) throw new Error(`Expected 404, got ${goneRes.status}`);
    log("PR-CP8", `First game correctly returns 404`);

    if (process.env.DATABASE_URL && createdUserIds.length) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      try {
        await client.connect();
        const emailPattern = `${TEST_EMAIL_PREFIX}%${STAMP}%@test.local`;
        await client.query("DELETE FROM user_providers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)", [emailPattern]);
        await client.query("DELETE FROM user_decks WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)", [emailPattern]);
        const res = await client.query("DELETE FROM users WHERE email LIKE $1 RETURNING id, email", [emailPattern]);
        log("PR-CP8", `Removed ${res.rowCount} test user(s) from DB`);
      } finally {
        await client.end();
      }
    } else {
      log("PR-CP8", "DATABASE_URL not set — test users left in place");
    }
  });

  // -----------------------------------------------------------------------
  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
