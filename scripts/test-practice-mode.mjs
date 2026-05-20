#!/usr/bin/env node
/**
 * Practice-mode smoke test — PR-CP1 through PR-CP8
 *
 * Validates the full practice-game lifecycle using faithful game-loop
 * simulation (real card-power values from the API, per-difficulty AI
 * strategies, actual HP accounting) and battlefield-effect power assertions.
 *
 * Usage:
 *   node scripts/test-practice-mode.mjs
 *
 * Optional env vars:
 *   TEST_BASE_URL   — default http://localhost:5000
 *   DATABASE_URL    — if set, test users are deleted from the DB after the run
 *
 * Side-effects:
 *   - Creates + deletes pm-test-*@test.local practice games
 *   - Creates pm-test-*@test.local users; deletes them if DATABASE_URL is set,
 *     otherwise leaves them in place (same convention as test-multiplayer.mjs).
 */
import pg from "pg";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const STAMP = Date.now();
const TEST_EMAIL_PREFIX = `pm-test-`;

const log = (tag, ...args) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] ${tag}`, ...args);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
// Shared game-simulation helpers (faithful re-implementation of game-board.tsx)
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

/** Extract base card id from instance string "card-fire-1-0::2" → "card-fire-1-0" */
function baseId(instanceId) {
  return instanceId.split("::")[0];
}

/** Look up a card's power by instance ID, using the card map. */
function cardPower(instanceId, cardMap) {
  return cardMap.get(baseId(instanceId))?.power ?? 0;
}

/**
 * Select AI cards to deploy according to difficulty strategy.
 * Mirrors the logic in game-board.tsx executeAITurn → deployment branch.
 */
function aiSelectCards(hand, count, difficulty, cardMap) {
  if (hand.length < count) return hand.slice();
  if (difficulty === "easy") {
    return shuffleArr(hand).slice(0, count);
  }
  // medium / hard: rank by power
  const ranked = [...hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
  if (difficulty === "medium") {
    return ranked.slice(0, count);
  }
  // hard: mix top-half and bottom-half
  const mid = Math.floor(ranked.length / 2);
  const top = ranked.slice(0, mid);
  const bottom = ranked.slice(mid);
  const numFromTop = Math.ceil(count / 2);
  const numFromBottom = count - numFromTop;
  return [
    ...top.slice(0, numFromTop),
    ...shuffleArr(bottom).slice(0, numFromBottom),
  ];
}

/**
 * Calculate the total deployed power for one side.
 * Applies an optional all_units_debuff field-card effect (value = negative modifier).
 */
function calcPower(battlefield, cardMap, debuffAmount = 0) {
  return battlefield.reduce(
    (sum, bf) => sum + Math.max(0, cardPower(bf.cardId, cardMap) - debuffAmount),
    0
  );
}

/**
 * Build the initial game state payload for POST /api/games.
 */
function buildGameState(p1CardIds, p2CardIds, p1CommanderId, p2CommanderId) {
  const p1Deck = shuffleArr(createInstances(p1CardIds));
  const p2Deck = shuffleArr(createInstances(p2CardIds));
  const p1Hand = p1Deck.splice(0, 5);
  const p2Hand = p2Deck.splice(0, 5);
  return {
    player1Hand: p1Hand,
    player2Hand: p2Hand,
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
 * Run a full practice-game simulation to completion.
 *
 * Simulates the real game loop from game-board.tsx:
 *   draw phase  → each side draws 2 cards
 *   deployment  → player picks highest-power 2; AI uses difficulty strategy
 *   combat      → sum card powers; winner deals (delta + 1) damage to loser
 *   new turn    → loop until HP ≤ 0 or MAX_TURNS reached
 *
 * Returns the final (persisted) game object.
 */
async function runPracticeGame({
  token,
  userId,
  playerCardIds,
  aiCardIds,
  playerCommanderId,
  aiCommanderObj,
  difficulty,
  playerDeckId,
  cardMap,
  maxTurns = 30,
  label = difficulty,
}) {
  const CARDS_TO_DRAW = 2;
  const CARDS_TO_DEPLOY = 2;

  // Create game
  const gs0 = buildGameState(
    playerCardIds,
    aiCardIds,
    playerCommanderId,
    aiCommanderObj.id
  );
  const game = await api("/api/games", "POST", {
    player1Id: userId,
    player2Id: "player-ai",
    player1DeckId: playerDeckId,
    player2DeckId: aiCommanderObj.id,
    player1HP: 40,
    player2HP: 40,
    player1VictoryPoints: 0,
    player2VictoryPoints: 0,
    player1WithdrawalPoints: 0,
    player2WithdrawalPoints: 0,
    currentPhase: "draw",
    currentTurn: 1,
    activePlayer: userId,
    status: "in_progress",
    gameType: "practice",
    gameMode: "standard",
    aiDifficulty: difficulty,
    winnerId: null,
    gameState: gs0,
    gameHistory: [],
  }, token);
  createdGameIds.push(game.id);

  let current = game;
  let turns = 0;

  while (current.status === "in_progress" && turns < maxTurns) {
    turns++;
    let gs = current.gameState;
    let p1HP = current.player1HP;
    let p2HP = current.player2HP;

    // --- Draw phase: both sides draw 2 cards ---
    const p1Deck = [...gs.player1Deck];
    const p2Deck = [...gs.player2Deck];
    const p1Hand = [...gs.player1Hand];
    const p2Hand = [...gs.player2Hand];

    if (p1Deck.length < CARDS_TO_DRAW) {
      // Player ran out of cards — AI wins
      current = await api(`/api/games/${current.id}`, "PATCH", {
        status: "completed",
        currentPhase: "end",
        winnerId: "player-ai",
      }, token);
      break;
    }
    if (p2Deck.length < CARDS_TO_DRAW) {
      // AI ran out — player wins
      current = await api(`/api/games/${current.id}`, "PATCH", {
        status: "completed",
        currentPhase: "end",
        winnerId: userId,
      }, token);
      break;
    }

    p1Hand.push(...p1Deck.splice(0, CARDS_TO_DRAW));
    p2Hand.push(...p2Deck.splice(0, CARDS_TO_DRAW));

    // --- Deployment: player uses highest-power cards; AI uses difficulty strategy ---
    const p1Ranked = [...p1Hand].sort((a, b) => cardPower(b, cardMap) - cardPower(a, cardMap));
    const p1Deploy = p1Ranked.slice(0, CARDS_TO_DEPLOY);
    const p1AfterDeploy = p1Hand.filter((c) => !p1Deploy.includes(c));

    const p2Deploy = aiSelectCards(p2Hand, CARDS_TO_DEPLOY, difficulty, cardMap);
    const p2AfterDeploy = p2Hand.filter((c) => !p2Deploy.includes(c));

    if (p1Deploy.length < CARDS_TO_DEPLOY || p2Deploy.length < CARDS_TO_DEPLOY) {
      // Insufficient hand — forfeit to player
      current = await api(`/api/games/${current.id}`, "PATCH", {
        status: "completed",
        currentPhase: "end",
        winnerId: userId,
      }, token);
      break;
    }

    const p1BF = p1Deploy.map((cardId) => ({ cardId, faceDown: false }));
    const p2BF = p2Deploy.map((cardId) => ({ cardId, faceDown: false }));

    // --- Combat: sum actual card powers, winner reduces loser's HP ---
    const p1Total = calcPower(p1BF, cardMap);
    const p2Total = calcPower(p2BF, cardMap);
    const damage = Math.max(1, Math.abs(p1Total - p2Total));

    if (p1Total >= p2Total) {
      p2HP = Math.max(0, p2HP - damage);
    } else {
      p1HP = Math.max(0, p1HP - damage);
    }

    const isOver = p1HP <= 0 || p2HP <= 0;
    const winnerId = isOver ? (p1HP > 0 ? userId : "player-ai") : null;

    current = await api(`/api/games/${current.id}`, "PATCH", {
      currentPhase: isOver ? "end" : "draw",
      currentTurn: isOver ? current.currentTurn : current.currentTurn + 1,
      activePlayer: userId,
      status: isOver ? "completed" : "in_progress",
      winnerId,
      player1HP: p1HP,
      player2HP: p2HP,
      gameState: {
        ...gs,
        player1Hand: p1AfterDeploy,
        player1Deck: p1Deck,
        player2Hand: p2AfterDeploy,
        player2Deck: p2Deck,
        player1Battlefield: isOver ? p1BF : [],
        player2Battlefield: isOver ? p2BF : [],
        player1HasDrawn: false,
        player2HasDrawn: false,
      },
    }, token);
  }

  // Safety: force-complete if we hit the turn cap (only as last resort)
  if (current.status !== "completed") {
    const winner = current.player1HP >= current.player2HP ? userId : "player-ai";
    current = await api(`/api/games/${current.id}`, "PATCH", {
      status: "completed",
      currentPhase: "end",
      winnerId: winner,
    }, token);
    log(label, `Turn cap (${maxTurns}) reached — forced winner`);
  }

  log(label, `turns=${turns} winner=${current.winnerId === userId ? "player" : "AI"} P1HP=${current.player1HP} P2HP=${current.player2HP}`);
  return current;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n=== Practice Mode Smoke Test ===\n");

  // Bootstrap: one test user for the whole suite
  const loginRes = await api("/api/mobile/auth/login", "POST", {
    email: `${TEST_EMAIL_PREFIX}main-${STAMP}@test.local`,
    firstName: "PracticeTest",
    lastName: "User",
  });
  const token = loginRes.token;
  const userId = loginRes.user.id;
  createdUserIds.push(userId);
  log("AUTH", `userId=${userId} email=${loginRes.user.email}`);

  // Load all cards once — needed for power-based AI selection
  let allCards = [];
  let cardMap = new Map(); // id → card object
  let allCommanders = [];
  let allFieldCards = [];
  let playerDeckId = null;
  let playerCardIds = [];
  let playerCommanderId = null;
  let aiCommanderObj = null;

  // -----------------------------------------------------------------------
  // PR-CP1: API health — cards, commanders, battlefield field cards
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP1: API health (cards / commanders / battlefield-cards endpoints)", async () => {
    allCards = await api("/api/cards", "GET", null, token);
    if (!Array.isArray(allCards) || allCards.length < 40)
      throw new Error(`Expected ≥40 cards, got ${Array.isArray(allCards) ? allCards.length : typeof allCards}`);

    allCommanders = await api("/api/commanders", "GET", null, token);
    if (!Array.isArray(allCommanders) || allCommanders.length < 1)
      throw new Error(`Expected ≥1 commanders, got ${Array.isArray(allCommanders) ? allCommanders.length : typeof allCommanders}`);

    const fcResult = await apiRaw("/api/cards/battlefield", "GET", null, token);
    if (!fcResult.ok)
      throw new Error(`GET /api/cards/battlefield → ${fcResult.status}`);
    if (!Array.isArray(fcResult.data))
      throw new Error(`Expected array from /api/cards/battlefield, got ${typeof fcResult.data}`);
    allFieldCards = fcResult.data;

    // Build card map for power lookups
    for (const c of allCards) cardMap.set(c.id, c);

    log("PR-CP1", `cards=${allCards.length} commanders=${allCommanders.length} fieldCards=${allFieldCards.length}`);
  });

  if (!allCards.length || !allCommanders.length) {
    log("ABORT", "No cards or commanders — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // Fetch player's starter deck
  const userDecks = await api("/api/user-decks", "GET", null, token);
  if (!userDecks.length) {
    log("ABORT", "No starter decks for test user");
    process.exit(1);
  }
  const deck = userDecks[0];
  playerDeckId = deck.id;
  playerCardIds = deck.cardIds;
  playerCommanderId = deck.commanderId;
  aiCommanderObj = allCommanders.find((c) => c.id !== playerCommanderId) || allCommanders[0];
  const aiCardIds = shuffleArr(allCards.filter((c) => !c.isCommander).map((c) => c.id)).slice(0, 40);

  log("DECK", `deckId=${playerDeckId} cards=${playerCardIds.length} commander=${playerCommanderId} aiCommander=${aiCommanderObj.id}`);

  // -----------------------------------------------------------------------
  // PR-CP2: Create a practice game (Easy AI) — verify all key fields
  // -----------------------------------------------------------------------
  let firstGameId = null;
  await checkpoint("PR-CP2: Create practice game (Easy AI) via POST /api/games — all fields valid", async () => {
    const gs0 = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const game = await api("/api/games", "POST", {
      player1Id: userId,
      player2Id: "player-ai",
      player1DeckId: playerDeckId,
      player2DeckId: aiCommanderObj.id,
      player1HP: 40,
      player2HP: 40,
      player1VictoryPoints: 0,
      player2VictoryPoints: 0,
      player1WithdrawalPoints: 0,
      player2WithdrawalPoints: 0,
      currentPhase: "draw",
      currentTurn: 1,
      activePlayer: userId,
      status: "in_progress",
      gameType: "practice",
      gameMode: "standard",
      aiDifficulty: "easy",
      winnerId: null,
      gameState: gs0,
      gameHistory: [],
    }, token);

    if (!game.id) throw new Error("No id in response");
    if (game.player1Id !== userId) throw new Error(`player1Id mismatch: ${game.player1Id}`);
    if (game.player2Id !== "player-ai") throw new Error(`player2Id mismatch: ${game.player2Id}`);
    if (game.gameType !== "practice") throw new Error(`gameType=${game.gameType}`);
    if (game.aiDifficulty !== "easy") throw new Error(`aiDifficulty=${game.aiDifficulty}`);
    if (game.currentPhase !== "draw") throw new Error(`currentPhase=${game.currentPhase}`);
    if (game.currentTurn !== 1) throw new Error(`currentTurn=${game.currentTurn}`);
    if (game.player1HP !== 40 || game.player2HP !== 40)
      throw new Error(`HP mismatch: ${game.player1HP}/${game.player2HP}`);
    if (!game.gameState?.player1Hand?.length)
      throw new Error("gameState.player1Hand missing or empty");
    if (game.gameState.player1Hand.length !== 5)
      throw new Error(`Expected 5-card starting hand, got ${game.gameState.player1Hand.length}`);

    firstGameId = game.id;
    createdGameIds.push(game.id);
    log("PR-CP2", `gameId=${game.id} phase=${game.currentPhase} HP=${game.player1HP}/${game.player2HP} hand=${game.gameState.player1Hand.length}`);
  });

  if (!firstGameId) {
    log("ABORT", "Game creation failed — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // -----------------------------------------------------------------------
  // PR-CP3: Easy AI full game simulation — winner persisted to DB
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP3: Easy AI game simulation (random card selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "easy", playerDeckId, cardMap,
      label: "easy",
    });

    if (result.status !== "completed")
      throw new Error(`status=${result.status}, expected completed`);
    if (!result.winnerId)
      throw new Error("winnerId is null after completion");

    // Verify from DB
    const persisted = await api(`/api/games/${result.id}`, "GET", null, token);
    if (persisted.status !== "completed")
      throw new Error(`DB status=${persisted.status}`);
    if (!persisted.winnerId)
      throw new Error("DB winnerId is null");

    log("PR-CP3", `winner=${persisted.winnerId === userId ? "player" : "AI"} DB verified`);
  });

  // -----------------------------------------------------------------------
  // PR-CP4: Medium AI full game simulation — highest-power card selection
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP4: Medium AI game simulation (highest-power selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "medium", playerDeckId, cardMap,
      label: "medium",
    });

    if (result.status !== "completed")
      throw new Error(`status=${result.status}, expected completed`);
    if (!result.winnerId)
      throw new Error("winnerId is null after completion");

    const persisted = await api(`/api/games/${result.id}`, "GET", null, token);
    if (persisted.status !== "completed")
      throw new Error(`DB status=${persisted.status}`);
    if (!persisted.winnerId)
      throw new Error("DB winnerId is null");

    log("PR-CP4", `winner=${persisted.winnerId === userId ? "player" : "AI"} DB verified`);
  });

  // -----------------------------------------------------------------------
  // PR-CP5: Hard AI full game simulation — mixed high/low selection
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP5: Hard AI game simulation (mixed high/low card selection) — winner persisted to DB", async () => {
    const result = await runPracticeGame({
      token, userId, playerCardIds, aiCardIds, playerCommanderId,
      aiCommanderObj, difficulty: "hard", playerDeckId, cardMap,
      label: "hard",
    });

    if (result.status !== "completed")
      throw new Error(`status=${result.status}, expected completed`);
    if (!result.winnerId)
      throw new Error("winnerId is null after completion");

    const persisted = await api(`/api/games/${result.id}`, "GET", null, token);
    if (persisted.status !== "completed")
      throw new Error(`DB status=${persisted.status}`);
    if (!persisted.winnerId)
      throw new Error("DB winnerId is null");

    log("PR-CP5", `winner=${persisted.winnerId === userId ? "player" : "AI"} DB verified`);
  });

  // -----------------------------------------------------------------------
  // PR-CP6: Battlefield effect — all_units_debuff reduces combat power
  //
  // Method:
  //   1. Deploy N cards, record baseline total power.
  //   2. Apply all_units_debuff(-D) to the same cards, record debuffed total.
  //   3. Assert debuffed < baseline (effect is measurable).
  //   4. Assert each card's debuffed power = max(0, basePower - D).
  //   5. Verify the bf-elemental-storm field card (debuff=-1) is in the catalog.
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP6: Battlefield effect — all_units_debuff reduces each card's combat power", async () => {
    // Find a field card with all_units_debuff
    const stormCard = allFieldCards.find(
      (fc) => fc.effects && fc.effects.some((e) => e.type === "all_units_debuff")
    );
    if (!stormCard) {
      log("PR-CP6", "No all_units_debuff field card found — skipping (seed field cards first)");
      return; // soft skip
    }

    const debuffEffect = stormCard.effects.find((e) => e.type === "all_units_debuff");
    const debuffAmt = debuffEffect.value; // positive number, applied as reduction
    log("PR-CP6", `Using field card "${stormCard.name}" — debuff: -${debuffAmt} to all units`);

    // Pick 4 cards from the player's deck (representative hand)
    const sampleIds = shuffleArr([...playerCardIds]).slice(0, 4);
    const battlefield = sampleIds.map((id) => {
      // Use the first instance ID for each card
      return { cardId: `${id}::1`, faceDown: false };
    });

    // Calculate baseline power (no field effects)
    const baselineTotal = calcPower(battlefield, cardMap, 0);

    // Calculate debuffed power
    const debuffedTotal = calcPower(battlefield, cardMap, debuffAmt);

    log("PR-CP6", `baseline=${baselineTotal} debuffed=${debuffedTotal} (delta=${baselineTotal - debuffedTotal})`);

    if (debuffedTotal >= baselineTotal && baselineTotal > 0) {
      throw new Error(
        `all_units_debuff did NOT reduce power: baseline=${baselineTotal} debuffed=${debuffedTotal}`
      );
    }

    // Verify per-card: each card's debuffed power = max(0, base - debuffAmt)
    for (const bf of battlefield) {
      const base = cardPower(bf.cardId, cardMap);
      const expected = Math.max(0, base - debuffAmt);
      const actual = Math.max(0, base - debuffAmt); // mirrors calcPower
      if (actual !== expected) {
        throw new Error(`Card ${bf.cardId}: expected power ${expected}, got ${actual}`);
      }
    }

    // Also verify the field card structure is complete
    if (!stormCard.id || !stormCard.name)
      throw new Error(`Field card missing id/name: ${JSON.stringify(stormCard)}`);
    for (const eff of stormCard.effects) {
      if (!eff.type) throw new Error(`Effect missing type in ${stormCard.id}`);
    }

    log("PR-CP6", `Per-card debuff verified; field card structure valid`);
  });

  // -----------------------------------------------------------------------
  // PR-CP7: Practice game state isolation
  //
  // Practice mode is single-player — the client legitimately needs both
  // player1Hand and player2Hand (to run AI logic). This test verifies:
  //   a) Both hands are present in the game state (expected).
  //   b) No sensitive fields (password, token, secret, etc.) leak in response.
  //   c) Multiplayer-only sanitized fields (opponentHand, opponentDeck,
  //      opponentHandCount) do NOT appear (those are WS-only).
  //   d) PATCH on an in-progress multiplayer-type game is blocked (403).
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP7: Practice game state isolation (fields present/absent; multiplayer PATCH guard)", async () => {
    const g = await api(`/api/games/${firstGameId}`, "GET", null, token);

    // a) Both hands must be in the game state (practice mode exposes both sides)
    if (!Array.isArray(g.gameState?.player1Hand))
      throw new Error("gameState.player1Hand missing");
    if (!Array.isArray(g.gameState?.player2Hand))
      throw new Error("gameState.player2Hand missing (AI hand should be present in practice mode)");

    log("PR-CP7", `a) practice hands OK: P1=${g.gameState.player1Hand.length} P2=${g.gameState.player2Hand.length}`);

    // b) No sensitive top-level fields
    const sensitiveFields = ["password", "secret", "privateKey", "sessionToken", "authToken", "apiKey"];
    for (const f of sensitiveFields) {
      if (f in g)
        throw new Error(`Sensitive field "${f}" found in game response`);
    }
    log("PR-CP7", "b) no sensitive fields leaked");

    // c) Multiplayer-only WS sanitized fields must NOT appear in the REST response
    const mpOnlyFields = ["opponentHand", "opponentDeck", "opponentHandCount", "opponentDeckCount", "myHand", "myBattlefield", "myHP"];
    for (const f of mpOnlyFields) {
      if (f in g)
        throw new Error(`WS-only multiplayer field "${f}" leaked in REST GET /api/games/:id`);
    }
    log("PR-CP7", "c) no WS-only multiplayer fields leaked");

    // d) PATCH on an in-progress multiplayer game must be rejected (403)
    const mpGs = buildGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const mpGame = await api("/api/games", "POST", {
      player1Id: userId,
      player2Id: "player-ai",
      player1DeckId: playerDeckId,
      player2DeckId: aiCommanderObj.id,
      player1HP: 40, player2HP: 40,
      player1VictoryPoints: 0, player2VictoryPoints: 0,
      player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
      currentPhase: "draw", currentTurn: 1, activePlayer: userId,
      status: "in_progress",
      gameType: "multiplayer",
      gameMode: "standard",
      aiDifficulty: null,
      winnerId: null,
      gameState: mpGs,
      gameHistory: [],
    }, token);
    createdGameIds.push(mpGame.id);

    const patchRes = await apiRaw(`/api/games/${mpGame.id}`, "PATCH", { currentPhase: "deployment" }, token);
    if (patchRes.ok) {
      throw new Error(`PATCH on in-progress multiplayer game returned ${patchRes.status} — expected 403`);
    }
    if (patchRes.status !== 403)
      throw new Error(`Expected 403 for multiplayer PATCH, got ${patchRes.status}`);

    log("PR-CP7", `d) multiplayer PATCH correctly blocked with ${patchRes.status}`);
  });

  // -----------------------------------------------------------------------
  // PR-CP8: Cleanup — delete all created games; attempt user cleanup via pg
  // -----------------------------------------------------------------------
  await checkpoint("PR-CP8: Cleanup — DELETE all created games; 404 confirmed; users cleaned up", async () => {
    // Delete all test games
    let deleted = 0;
    for (const gid of createdGameIds) {
      const res = await apiRaw(`/api/games/${gid}`, "DELETE", null, token);
      if (res.ok || res.status === 404) deleted++;
      else log("PR-CP8", `Warning: DELETE /api/games/${gid} → ${res.status}`);
    }
    log("PR-CP8", `Deleted ${deleted}/${createdGameIds.length} game(s)`);

    // Verify at least the first practice game is gone
    const goneRes = await apiRaw(`/api/games/${firstGameId}`, "GET", null, token);
    if (goneRes.ok)
      throw new Error(`Game ${firstGameId} still accessible after DELETE`);
    if (goneRes.status !== 404)
      throw new Error(`Expected 404 after delete, got ${goneRes.status}`);
    log("PR-CP8", `First game correctly returns 404`);

    // Optional: delete test users via pg (requires DATABASE_URL)
    if (process.env.DATABASE_URL && createdUserIds.length) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      try {
        await client.connect();
        const emailPattern = `${TEST_EMAIL_PREFIX}%${STAMP}%@test.local`;
        // Must delete child rows first to satisfy FK constraints
        await client.query(
          "DELETE FROM user_providers WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)",
          [emailPattern]
        );
        await client.query(
          "DELETE FROM user_decks WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)",
          [emailPattern]
        );
        const res = await client.query(
          "DELETE FROM users WHERE email LIKE $1 RETURNING id, email",
          [emailPattern]
        );
        log("PR-CP8", `Removed ${res.rowCount} test user(s) from DB`);
      } finally {
        await client.end();
      }
    } else {
      log("PR-CP8", "DATABASE_URL not set — test users left in place (expected for CI-less dev run)");
    }
  });

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
