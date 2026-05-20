#!/usr/bin/env node
/**
 * Practice-mode smoke test — PR-CP1 through PR-CP8
 *
 * Tests practice game creation, phase progression, battlefield-effect
 * integration, AI difficulty variants, state isolation, and cleanup.
 *
 * Usage:  node scripts/test-practice-mode.mjs
 * Requires: dev server running on http://localhost:5000
 *
 * Side-effects: creates + deletes practice games; leaves
 * `pm-test-*@test.local` users behind (safe for dev DB).
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const STAMP = Date.now();

const log = (tag, ...args) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] ${tag}`, ...args);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function apiOk(path, method = "GET", body, token) {
  const r = await api(path, method, body, token);
  if (!r.ok) {
    throw new Error(
      `${method} ${path} → ${r.status}: ${
        typeof r.data === "string" ? r.data : JSON.stringify(r.data)
      }`
    );
  }
  return r.data;
}

async function loginMobile(email) {
  const r = await apiOk("/api/mobile/auth/login", "POST", {
    email,
    firstName: "PracticeTest",
    lastName: "User",
  });
  return r;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createCardInstances(cardIds) {
  const counts = {};
  return cardIds.map((id) => {
    counts[id] = (counts[id] || 0) + 1;
    return `${id}::${counts[id]}`;
  });
}

function buildInitialGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderId) {
  const p1Deck = shuffle(createCardInstances(playerCardIds));
  const p2Deck = shuffle(createCardInstances(aiCardIds));
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
    player1CommanderId: playerCommanderId,
    player2CommanderId: aiCommanderId,
  };
}

let pass = 0;
let fail = 0;
const createdGameIds = [];

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

async function main() {
  console.log("\n=== Practice Mode Smoke Test ===\n");

  // --- Bootstrap: one test user for the whole suite ---
  const user = await loginMobile(`pm-test-main-${STAMP}@test.local`);
  const token = user.token;
  const userId = user.user.id;
  log("AUTH", `userId=${userId} email=${user.user.email}`);

  let allCards = [];
  let allCommanders = [];
  let allFieldCards = [];
  let playerDeckId = null;
  let playerCardIds = [];
  let playerCommanderId = null;

  // ---------------------------------------------------------------
  // PR-CP1: API health — cards, commanders, battlefield field cards
  // ---------------------------------------------------------------
  await checkpoint("PR-CP1: API health (cards / commanders / battlefield-cards endpoints)", async () => {
    const cards = await apiOk("/api/cards", "GET", null, token);
    if (!Array.isArray(cards) || cards.length < 40)
      throw new Error(`Expected ≥40 cards, got ${Array.isArray(cards) ? cards.length : cards}`);

    const commanders = await apiOk("/api/commanders", "GET", null, token);
    if (!Array.isArray(commanders) || commanders.length < 1)
      throw new Error(`Expected ≥1 commanders, got ${Array.isArray(commanders) ? commanders.length : commanders}`);

    const fieldCards = await api("/api/cards/battlefield", "GET", null, token);
    if (!fieldCards.ok)
      throw new Error(`GET /api/cards/battlefield → ${fieldCards.status}`);
    if (!Array.isArray(fieldCards.data))
      throw new Error(`Expected array from /api/cards/battlefield, got ${typeof fieldCards.data}`);

    allCards = cards;
    allCommanders = commanders;
    allFieldCards = fieldCards.data;
    log("PR-CP1", `cards=${allCards.length} commanders=${allCommanders.length} fieldCards=${allFieldCards.length}`);
  });

  if (!allCards.length || !allCommanders.length) {
    log("ABORT", "No cards/commanders — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // ---------------------------------------------------------------
  // Get the player's deck (created automatically as starter deck)
  // ---------------------------------------------------------------
  const userDecks = await apiOk("/api/user-decks", "GET", null, token);
  if (!userDecks.length) throw new Error("Test user has no decks — starter deck grant failed?");
  const deck = userDecks[0];
  playerDeckId = deck.id;
  playerCardIds = deck.cardIds;
  playerCommanderId = deck.commanderId;
  log("DECK", `deckId=${playerDeckId} cards=${playerCardIds.length} commander=${playerCommanderId}`);

  const aiCommanderObj = allCommanders.find((c) => c.id !== playerCommanderId) || allCommanders[0];
  const aiCardIds = shuffle(allCards.filter((c) => !c.isCommander).map((c) => c.id)).slice(0, 40);

  // ---------------------------------------------------------------
  // PR-CP2: Create a practice game (Easy AI) — field validation
  // ---------------------------------------------------------------
  let gameId = null;
  await checkpoint("PR-CP2: Create practice game (Easy AI) via POST /api/games", async () => {
    const gameState = buildInitialGameState(
      playerCardIds,
      aiCardIds,
      playerCommanderId,
      aiCommanderObj.id
    );
    const body = {
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
      gameState,
      gameHistory: [],
    };
    const game = await apiOk("/api/games", "POST", body, token);

    if (!game.id) throw new Error("No id in response");
    if (game.player1Id !== userId) throw new Error(`player1Id mismatch: ${game.player1Id}`);
    if (game.gameType !== "practice") throw new Error(`gameType=${game.gameType}`);
    if (game.aiDifficulty !== "easy") throw new Error(`aiDifficulty=${game.aiDifficulty}`);
    if (game.currentPhase !== "draw") throw new Error(`currentPhase=${game.currentPhase}`);
    if (game.player1HP !== 40 || game.player2HP !== 40)
      throw new Error(`HP mismatch: ${game.player1HP}/${game.player2HP}`);

    gameId = game.id;
    createdGameIds.push(gameId);
    log("PR-CP2", `gameId=${gameId} phase=${game.currentPhase} HP=${game.player1HP}/${game.player2HP} diff=${game.aiDifficulty}`);
  });

  if (!gameId) {
    log("ABORT", "Game creation failed — cannot continue");
    console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // ---------------------------------------------------------------
  // PR-CP3: Draw phase → deployment — PATCH with drawn cards
  // ---------------------------------------------------------------
  await checkpoint("PR-CP3: Draw phase → PATCH advances to deployment with hands grown by 2", async () => {
    const g = await apiOk(`/api/games/${gameId}`, "GET", null, token);
    const gs = g.gameState;

    if (gs.player1Deck.length < 2)
      throw new Error(`P1 deck too short: ${gs.player1Deck.length}`);

    const p1Deck = [...gs.player1Deck];
    const p1Hand = [...gs.player1Hand, ...p1Deck.splice(0, 2)];
    const p2Deck = [...gs.player2Deck];
    const p2Hand = [...gs.player2Hand, ...p2Deck.splice(0, 2)];

    const updated = await apiOk(`/api/games/${gameId}`, "PATCH", {
      currentPhase: "deployment",
      gameState: {
        ...gs,
        player1Hand: p1Hand,
        player1Deck: p1Deck,
        player2Hand: p2Hand,
        player2Deck: p2Deck,
        player1Battlefield: [],
        player2Battlefield: [],
        player1HasDrawn: true,
        player2HasDrawn: true,
      },
    }, token);

    if (updated.currentPhase !== "deployment")
      throw new Error(`phase=${updated.currentPhase}, expected deployment`);
    if (updated.gameState.player1Hand.length !== 7)
      throw new Error(`P1 hand=${updated.gameState.player1Hand.length}, expected 7`);
    if (updated.gameState.player2Hand.length !== 7)
      throw new Error(`P2 hand=${updated.gameState.player2Hand.length}, expected 7`);

    log("PR-CP3", `phase=${updated.currentPhase} P1hand=${updated.gameState.player1Hand.length} P2hand=${updated.gameState.player2Hand.length}`);
  });

  // ---------------------------------------------------------------
  // PR-CP4: Deploy phase → combat — PATCH with deployed cards
  // ---------------------------------------------------------------
  await checkpoint("PR-CP4: Deploy phase → PATCH advances to combat with 2 cards on each side's battlefield", async () => {
    const g = await apiOk(`/api/games/${gameId}`, "GET", null, token);
    const gs = g.gameState;

    if (gs.player1Hand.length < 2) throw new Error(`P1 hand too small: ${gs.player1Hand.length}`);
    if (gs.player2Hand.length < 2) throw new Error(`P2 hand too small: ${gs.player2Hand.length}`);

    const p1Deploy = gs.player1Hand.slice(0, 2);
    const p2Deploy = gs.player2Hand.slice(0, 2);

    const updated = await apiOk(`/api/games/${gameId}`, "PATCH", {
      currentPhase: "combat",
      gameState: {
        ...gs,
        player1Hand: gs.player1Hand.slice(2),
        player2Hand: gs.player2Hand.slice(2),
        player1Battlefield: p1Deploy.map((cardId) => ({ cardId, faceDown: true })),
        player2Battlefield: p2Deploy.map((cardId) => ({ cardId, faceDown: true })),
      },
    }, token);

    if (updated.currentPhase !== "combat")
      throw new Error(`phase=${updated.currentPhase}, expected combat`);
    if (updated.gameState.player1Battlefield.length !== 2)
      throw new Error(`P1 battlefield=${updated.gameState.player1Battlefield.length}`);
    if (updated.gameState.player2Battlefield.length !== 2)
      throw new Error(`P2 battlefield=${updated.gameState.player2Battlefield.length}`);

    log("PR-CP4", `phase=${updated.currentPhase} P1bf=${updated.gameState.player1Battlefield.length} P2bf=${updated.gameState.player2Battlefield.length}`);
  });

  // ---------------------------------------------------------------
  // PR-CP5: Resolve combat → turn 2 (PATCH to draw phase, increment turn)
  // ---------------------------------------------------------------
  await checkpoint("PR-CP5: Combat resolution → new turn — PATCH to draw phase with turn counter incremented", async () => {
    const g = await apiOk(`/api/games/${gameId}`, "GET", null, token);
    const gs = g.gameState;

    const turnBefore = g.currentTurn;

    const updated = await apiOk(`/api/games/${gameId}`, "PATCH", {
      currentPhase: "draw",
      currentTurn: turnBefore + 1,
      activePlayer: userId,
      gameState: {
        ...gs,
        player1Battlefield: [],
        player2Battlefield: [],
        player1HasDrawn: false,
        player2HasDrawn: false,
      },
    }, token);

    if (updated.currentPhase !== "draw")
      throw new Error(`phase=${updated.currentPhase}, expected draw`);
    if (updated.currentTurn !== turnBefore + 1)
      throw new Error(`turn=${updated.currentTurn}, expected ${turnBefore + 1}`);

    log("PR-CP5", `phase=${updated.currentPhase} turn=${updated.currentTurn} (was ${turnBefore})`);
  });

  // ---------------------------------------------------------------
  // PR-CP6: Full game simulations (Easy / Medium / Hard) — create,
  // fast-forward to a winner, verify DB persists winnerId.
  // ---------------------------------------------------------------
  await checkpoint("PR-CP6: Full game simulation across Easy / Medium / Hard — winner persisted to DB", async () => {
    const difficulties = ["easy", "medium", "hard"];

    for (const diff of difficulties) {
      const gs0 = buildInitialGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
      const gRes = await apiOk("/api/games", "POST", {
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
        aiDifficulty: diff,
        winnerId: null,
        gameState: gs0,
        gameHistory: [],
      }, token);

      const gid = gRes.id;
      createdGameIds.push(gid);

      // Fast-forward the game: play up to 20 turns then declare a winner.
      // This exercises create → multi-turn PATCH cycle without replicating
      // full client-side AI logic (which runs in the browser).
      const MAX_TURNS = 20;
      let currentGame = await apiOk(`/api/games/${gid}`, "GET", null, token);
      let simulatedTurns = 0;

      while (currentGame.status === "in_progress" && simulatedTurns < MAX_TURNS) {
        const gs = currentGame.gameState;
        const turn = currentGame.currentTurn;

        // Draw 2 for each side (if deck allows)
        const p1Deck = [...gs.player1Deck];
        const p2Deck = [...gs.player2Deck];
        const p1Hand = [...gs.player1Hand];
        const p2Hand = [...gs.player2Hand];

        if (p1Deck.length >= 2) p1Hand.push(...p1Deck.splice(0, 2));
        if (p2Deck.length >= 2) p2Hand.push(...p2Deck.splice(0, 2));

        // Deploy 2 from each hand (or as many as available)
        const p1Deploy = p1Hand.splice(0, Math.min(2, p1Hand.length));
        const p2Deploy = p2Hand.splice(0, Math.min(2, p2Hand.length));

        // Simulate combat: P1 wins if it has ≥ P2 power (simple sum by index)
        const p1Power = p1Deploy.length;
        const p2Power = p2Deploy.length;
        const damage = Math.abs(p1Power - p2Power) + 1;
        let p1HP = currentGame.player1HP;
        let p2HP = currentGame.player2HP;

        if (p1Power >= p2Power) {
          p2HP = Math.max(0, p2HP - damage);
        } else {
          p1HP = Math.max(0, p1HP - damage);
        }

        const isOver = p1HP <= 0 || p2HP <= 0;
        const winner = isOver ? (p1HP > p2HP ? userId : "player-ai") : null;

        currentGame = await apiOk(`/api/games/${gid}`, "PATCH", {
          currentPhase: isOver ? "end" : "draw",
          currentTurn: isOver ? turn : turn + 1,
          activePlayer: userId,
          status: isOver ? "completed" : "in_progress",
          winnerId: winner,
          player1HP: p1HP,
          player2HP: p2HP,
          gameState: {
            ...gs,
            player1Hand: p1Hand,
            player1Deck: p1Deck,
            player2Hand: p2Hand,
            player2Deck: p2Deck,
            player1Battlefield: [],
            player2Battlefield: [],
            player1HasDrawn: false,
            player2HasDrawn: false,
          },
        }, token);

        simulatedTurns++;
      }

      // If not naturally ended, force a winner
      if (currentGame.status !== "completed") {
        currentGame = await apiOk(`/api/games/${gid}`, "PATCH", {
          status: "completed",
          winnerId: userId,
          currentPhase: "end",
        }, token);
      }

      // Verify DB persists winner
      const persisted = await apiOk(`/api/games/${gid}`, "GET", null, token);
      if (persisted.status !== "completed")
        throw new Error(`[${diff}] status=${persisted.status}, expected completed`);
      if (!persisted.winnerId)
        throw new Error(`[${diff}] winnerId is null after completion`);

      log(
        "PR-CP6",
        `[${diff}] gid=${gid} turns=${simulatedTurns} winner=${persisted.winnerId === userId ? "player" : "AI"} P1HP=${persisted.player1HP} P2HP=${persisted.player2HP}`
      );
    }
  });

  // ---------------------------------------------------------------
  // PR-CP7: Battlefield field cards — save deck, verify API,
  //         verify field card data is accessible and effects are valid.
  // ---------------------------------------------------------------
  await checkpoint("PR-CP7: Battlefield field cards — save deck + verify card effects are valid", async () => {
    // Field cards may not be seeded yet — skip gracefully if none available.
    const fcRes = await api("/api/cards/battlefield", "GET", null, token);
    if (!fcRes.ok) throw new Error(`GET /api/cards/battlefield → ${fcRes.status}`);

    const fieldCards = fcRes.data;
    if (!Array.isArray(fieldCards)) throw new Error("Expected array from /api/cards/battlefield");

    if (fieldCards.length === 0) {
      log("PR-CP7", "No field cards seeded — skipping deck-save sub-check (field cards absent)");
      return;
    }

    // Validate field card structure
    for (const fc of fieldCards) {
      if (!fc.id || !fc.name) throw new Error(`Field card missing id/name: ${JSON.stringify(fc)}`);
      if (!Array.isArray(fc.effects)) throw new Error(`Field card ${fc.id} missing effects array`);
      for (const eff of fc.effects) {
        if (!eff.type) throw new Error(`Effect in ${fc.id} missing type`);
        const validTypes = ["element_buff", "element_debuff", "all_units_debuff", "deploy_limit_override", "unique_effect"];
        if (!validTypes.includes(eff.type))
          throw new Error(`Field card ${fc.id} has unknown effect type: ${eff.type}`);
      }
    }

    log("PR-CP7", `${fieldCards.length} field card(s) validated — effects OK`);

    // Save a battlefield deck (7 cards, reusing with wrap-around)
    if (fieldCards.length >= 1) {
      const deck7 = Array.from({ length: 7 }, (_, i) => fieldCards[i % fieldCards.length].id);
      const saveRes = await api("/api/decks/battlefield", "PUT", { cardIds: deck7 }, token);
      if (!saveRes.ok)
        throw new Error(`PUT /api/decks/battlefield → ${saveRes.status}: ${JSON.stringify(saveRes.data)}`);

      const saved = saveRes.data;
      if (!Array.isArray(saved.cardIds) || saved.cardIds.length !== 7)
        throw new Error(`Expected 7 cardIds in response, got: ${JSON.stringify(saved.cardIds)}`);

      log("PR-CP7", `battlefield deck saved: [${saved.cardIds.join(", ")}]`);

      // Verify the deck persists via GET
      const getRes = await api("/api/decks/battlefield", "GET", null, token);
      if (!getRes.ok)
        throw new Error(`GET /api/decks/battlefield → ${getRes.status}: ${JSON.stringify(getRes.data)}`);
      if (!Array.isArray(getRes.data.cardIds) || getRes.data.cardIds.length !== 7)
        throw new Error(`Persisted battlefield deck has ${getRes.data.cardIds?.length} cards, expected 7`);

      log("PR-CP7", `battlefield deck GET verified: ${getRes.data.cardIds.length} cards`);
    }
  });

  // ---------------------------------------------------------------
  // PR-CP8: State isolation + cleanup
  //
  // Isolation contract:
  //   - PATCH /api/games/:id is blocked for in-progress multiplayer
  //     games (only practice games can be patched via HTTP).
  //   - Practice game state correctly exposes per-player hand arrays
  //     (expected — single-player mode) and carries no extraneous fields.
  //   - DELETE /api/games/:id removes the record; subsequent GET → 404.
  // ---------------------------------------------------------------
  await checkpoint("PR-CP8: State isolation (multiplayer PATCH guard) and cleanup via DELETE", async () => {
    // --- Verify practice game state has expected isolation fields ---
    const g = await apiOk(`/api/games/${gameId}`, "GET", null, token);
    if (!g.gameState || !Array.isArray(g.gameState.player1Hand))
      throw new Error("Practice game missing player1Hand in gameState");
    // Practice mode intentionally exposes both sides — just confirm no
    // unexpected extra leak like a password or private token field.
    const unexpectedFields = ["password", "secret", "privateKey", "sessionToken"];
    for (const f of unexpectedFields) {
      if (f in g)
        throw new Error(`Unexpected sensitive field "${f}" in game response`);
    }

    // --- Create a fake multiplayer-style game and verify PATCH is blocked ---
    const mpGs = buildInitialGameState(playerCardIds, aiCardIds, playerCommanderId, aiCommanderObj.id);
    const mpGame = await apiOk("/api/games", "POST", {
      player1Id: userId,
      player2Id: "player-ai",
      player1DeckId: playerDeckId,
      player2DeckId: aiCommanderObj.id,
      player1HP: 40, player2HP: 40,
      player1VictoryPoints: 0, player2VictoryPoints: 0,
      player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
      currentPhase: "draw", currentTurn: 1, activePlayer: userId,
      status: "in_progress",
      gameType: "multiplayer",  // <-- multiplayer
      gameMode: "standard",
      aiDifficulty: null,
      winnerId: null,
      gameState: mpGs,
      gameHistory: [],
    }, token);
    createdGameIds.push(mpGame.id);

    // PATCH on an in-progress multiplayer game must be 403
    const patchRes = await api(`/api/games/${mpGame.id}`, "PATCH", { currentPhase: "deployment" }, token);
    if (patchRes.ok) {
      throw new Error(`PATCH on in-progress multiplayer game returned ${patchRes.status} — expected 403`);
    }
    if (patchRes.status !== 403)
      throw new Error(`Expected 403 for multiplayer PATCH, got ${patchRes.status}`);

    log("PR-CP8", `Multiplayer PATCH correctly blocked with ${patchRes.status}`);

    // --- Cleanup: delete all games created in this test run ---
    let deleted = 0;
    for (const gid of createdGameIds) {
      const delRes = await api(`/api/games/${gid}`, "DELETE", null, token);
      if (delRes.ok || delRes.status === 404) {
        deleted++;
      } else {
        log("PR-CP8", `Warning: DELETE /api/games/${gid} → ${delRes.status}`);
      }
    }

    // Verify the first practice game is gone
    const gone = await api(`/api/games/${gameId}`, "GET", null, token);
    if (gone.ok)
      throw new Error(`Game ${gameId} still accessible after DELETE`);
    if (gone.status !== 404)
      throw new Error(`Expected 404 after delete, got ${gone.status}`);

    log("PR-CP8", `Deleted ${deleted}/${createdGameIds.length} game(s); first game correctly returns 404`);
  });

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
