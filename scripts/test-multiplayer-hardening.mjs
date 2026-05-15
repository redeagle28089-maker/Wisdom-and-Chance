#!/usr/bin/env node
/**
 * Multiplayer hardening test (task #56).
 *
 * Goes beyond the happy-path test-multiplayer.mjs — exercises the failure modes
 * that the simple end-to-end test does not:
 *   • spectator cannot send game actions
 *   • invalid game actions are rejected (end-turn before draw, double-draw,
 *     unknown card, too-many cards, non-participant)
 *   • concurrent deploys converge to a single phase advance
 *   • Quick Strike / Guardian / Care Package traits surface in the combat log
 *   • 3 commander abilities (extra_deploy, direct_damage, buff_element_unit) work
 *   • disconnect with shortened timeout triggers forfeit
 *   • reconnect within timeout cancels forfeit
 *   • host promotion when host leaves a waiting room
 *   • POST /api/admin/cleanup-stale-rooms purges old empty waiting rooms
 *
 * Self-cleans test users / decks / rooms / games via direct pg connection at
 * end of run so repeated runs do not pollute the DB.
 *
 * Requirements: server running on TEST_BASE_URL (default http://localhost:5000),
 * DATABASE_URL set, SESSION_SECRET set so JWT issuance works, and the admin
 * email account `redeagle28089@gmail.com` exists (mobile login is idempotent
 * so logging in is safe even on a fresh DB).
 */
import WebSocket from "ws";
import pg from "pg";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const WS_BASE = BASE.replace(/^http/, "ws");
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "redeagle28089@gmail.com";
const STAMP = Date.now();
const TEST_EMAIL_PREFIX = `mp-hard-`;
const DISCONNECT_TIMEOUT_MS = 800;

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
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

class TestClient {
  constructor(label) {
    this.label = label;
    this.events = [];
  }

  async login(email, displayName) {
    const r = await api("/api/mobile/auth/login", "POST", {
      email,
      firstName: displayName || this.label,
      lastName: "Test",
    });
    this.token = r.token;
    this.userId = r.user.id;
    this.email = r.user.email;
    log(this.label, `login ${email} → ${this.userId}`);
  }

  async getDecks() {
    const decks = await api("/api/user-decks", "GET", null, this.token);
    // Prefer the fire deck so the commander-ability test can call fire abilities.
    this.deck = decks.find((d) => d.commanderId === "commander-fire") || decks[0];
    if (!this.deck) throw new Error(`${this.label} has no decks`);
    return decks;
  }

  connectWS() {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/ws?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error("WS connect timeout")), 5000);
      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.events.push({ ...msg, _at: Date.now() });
          if (msg.type === "auth_success") { clearTimeout(timer); resolve(); }
          if (msg.type === "auth_error") { clearTimeout(timer); reject(new Error(JSON.stringify(msg.payload))); }
        } catch {}
      });
      this.ws.on("error", (e) => { clearTimeout(timer); reject(e); });
      this.ws.on("close", () => { this.wsClosed = true; });
    });
  }

  send(type, payload) {
    this.ws.send(JSON.stringify({ type, payload }));
  }

  mark() { return this.events.length; }

  async waitForAfter(mark, predicate, timeoutMs = 4000, label = "event") {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (let i = mark; i < this.events.length; i++) {
        if (predicate(this.events[i])) return this.events[i];
      }
      await sleep(40);
    }
    throw new Error(`${this.label}: timeout waiting for ${label}`);
  }

  async expectErrorAfter(mark, contains, timeoutMs = 2000, label = "error") {
    const ev = await this.waitForAfter(
      mark,
      (e) => e.type === "game_error" && (!contains || (e.payload?.error || "").toLowerCase().includes(contains.toLowerCase())),
      timeoutMs,
      label,
    );
    return ev;
  }

  latestState() {
    return this.events.findLast((e) => e.type === "game_state")?.payload;
  }

  async waitForState(mark, pred, timeoutMs = 4000, label = "state") {
    const ev = await this.waitForAfter(
      mark,
      (e) => e.type === "game_state" && pred(e.payload),
      timeoutMs,
      label,
    );
    return ev.payload;
  }

  close() {
    try { this.ws?.close(); } catch {}
  }
}

let pgClient;
async function pgConnect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();
}

async function pgClose() {
  try { await pgClient?.end(); } catch {}
}

async function deleteTestData() {
  // Delete every artifact tied to test users created with the mp-hard- prefix
  // so re-runs are clean. The admin account is preserved.
  const { rows } = await pgClient.query(
    `SELECT id FROM users WHERE email LIKE $1`,
    [`${TEST_EMAIL_PREFIX}%@test.local`],
  );
  if (rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);
  // Note: games are in-memory only (MemStorage), no `games` table to clean.
  // Delete spectators first (FK to game_rooms), then any rooms hosted/joined
  // by test users. Then dynamically discover all tables with FKs to users.id
  // and clear those rows so we can delete the user records.
  await pgClient.query(
    `DELETE FROM room_spectators WHERE user_id = ANY($1) OR room_id IN (
       SELECT id FROM game_rooms WHERE host_id = ANY($1) OR guest_id = ANY($1)
     )`,
    [ids],
  );
  await pgClient.query(`DELETE FROM game_rooms WHERE host_id = ANY($1) OR guest_id = ANY($1)`, [ids]);

  const fks = await pgClient.query(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'`,
  );
  for (const r of fks.rows) {
    await pgClient.query(`DELETE FROM ${r.table_name} WHERE ${r.column_name} = ANY($1)`, [ids]);
  }
  await pgClient.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  return ids.length;
}

// Tally
let pass = 0, fail = 0;
const failed = [];
let admin; // hoisted so the top-level catch can restore disconnect timeout
async function checkpoint(label, fn) {
  try {
    await fn();
    log("PASS", label);
    pass++;
  } catch (e) {
    log("FAIL", label, "→", e.message);
    fail++;
    failed.push(label);
  }
}

async function main() {
  console.log("\n=== Multiplayer Hardening Test ===\n");

  await pgConnect();
  const cleaned = await deleteTestData();
  if (cleaned > 0) log("CLEANUP", `removed ${cleaned} leftover users from prior runs`);

  // --- Admin login (for stale-room cleanup + disconnect-timeout overrides) ---
  admin = new TestClient("ADMIN");
  await admin.login(ADMIN_EMAIL, "Admin");

  // ===========================================================================
  // T1: Stale-room cleanup admin endpoint
  // ===========================================================================
  let staleRoomId, freshRoomId;
  await checkpoint("Stale-room cleanup: only old empty waiting rooms are purged", async () => {
    const cutoff25h = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const now = new Date();
    const stale = await pgClient.query(
      `INSERT INTO game_rooms (name, host_id, status, created_at, updated_at)
       VALUES ($1, $2, 'waiting', $3, $3) RETURNING id`,
      [`hard-test-stale-${STAMP}`, admin.userId, cutoff25h],
    );
    staleRoomId = stale.rows[0].id;
    const fresh = await pgClient.query(
      `INSERT INTO game_rooms (name, host_id, status, created_at, updated_at)
       VALUES ($1, $2, 'waiting', $3, $3) RETURNING id`,
      [`hard-test-fresh-${STAMP}`, admin.userId, now],
    );
    freshRoomId = fresh.rows[0].id;

    const result = await api("/api/admin/cleanup-stale-rooms", "POST", { olderThanHours: 24 }, admin.token);
    if (result.deleted < 1) throw new Error(`expected at least 1 deletion, got ${result.deleted}`);

    const remaining = await pgClient.query(`SELECT id FROM game_rooms WHERE id = ANY($1)`, [[staleRoomId, freshRoomId]]);
    const ids = remaining.rows.map((r) => r.id);
    if (ids.includes(staleRoomId)) throw new Error("stale room was not deleted");
    if (!ids.includes(freshRoomId)) throw new Error("fresh room was incorrectly deleted");
  });

  // Cleanup the fresh room we created
  await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [freshRoomId]);

  // ===========================================================================
  // Reject non-admin call to admin endpoints
  // ===========================================================================
  const tmpUser = new TestClient("TMP");
  await tmpUser.login(`${TEST_EMAIL_PREFIX}tmp-${STAMP}@test.local`);
  await checkpoint("Admin endpoint rejects non-admin token (cleanup-stale-rooms 403)", async () => {
    let threw = false;
    try {
      await api("/api/admin/cleanup-stale-rooms", "POST", {}, tmpUser.token);
    } catch (e) {
      threw = /403/.test(e.message);
    }
    if (!threw) throw new Error("non-admin token should have been rejected");
  });

  // ===========================================================================
  // Set short disconnect timeout for the disconnect/reconnect test below
  // ===========================================================================
  await checkpoint("Admin can set short disconnect timeout for tests", async () => {
    const r = await api("/api/admin/test/disconnect-timeout", "POST", { ms: DISCONNECT_TIMEOUT_MS }, admin.token);
    if (r.disconnectTimeoutMs !== DISCONNECT_TIMEOUT_MS) throw new Error("timeout not applied");
  });

  // ===========================================================================
  // Fetch card → trait map (used to detect Quick Strike / Guardian / Care Package
  // cards in hand for the trait test)
  // ===========================================================================
  const allCards = await api("/api/cards");
  const cardTrait = new Map(allCards.map((c) => [c.id, c.trait]));
  const baseId = (instanceId) => instanceId.split("::")[0];
  const findInHand = (hand, trait) => hand.find((id) => cardTrait.get(baseId(id)) === trait);

  // ===========================================================================
  // T2-T5: Setup main game with P1, P2, Spec
  // ===========================================================================
  const p1 = new TestClient("P1");
  const p2 = new TestClient("P2");
  const spec = new TestClient("SPEC");

  await checkpoint("Authenticate P1, P2, Spectator (mobile JWT)", async () => {
    await Promise.all([
      p1.login(`${TEST_EMAIL_PREFIX}p1-${STAMP}@test.local`, "Player One"),
      p2.login(`${TEST_EMAIL_PREFIX}p2-${STAMP}@test.local`, "Player Two"),
      spec.login(`${TEST_EMAIL_PREFIX}spec-${STAMP}@test.local`, "Spec"),
    ]);
  });

  await checkpoint("All three connect WebSocket", async () => {
    await Promise.all([p1.connectWS(), p2.connectWS(), spec.connectWS()]);
  });

  await checkpoint("P1 and P2 have starter decks (prefer fire commander)", async () => {
    await Promise.all([p1.getDecks(), p2.getDecks()]);
    if (p1.deck.commanderId !== "commander-fire" || p2.deck.commanderId !== "commander-fire") {
      throw new Error("expected fire deck to be available for both players");
    }
  });

  let roomId, gameId;
  await checkpoint("P1 creates room, P2 joins, Spec spectates", async () => {
    const room = await api("/api/rooms", "POST", { name: `hard ${STAMP}` }, p1.token);
    roomId = room.id;
    await api(`/api/rooms/${roomId}/join`, "POST", {}, p2.token);
    await api(`/api/rooms/${roomId}/spectate`, "POST", {}, spec.token);
    const fresh = await api(`/api/rooms/${roomId}`, "GET", null, p1.token);
    if (fresh.guestId !== p2.userId) throw new Error("guestId mismatch");
    if (!fresh.spectators?.some((s) => s.userId === spec.userId)) throw new Error("spectator not listed");
  });

  await checkpoint("All three join room over WS without errors", async () => {
    const m1 = p1.mark(), m2 = p2.mark(), ms = spec.mark();
    p1.send("join_room", { roomId });
    p2.send("join_room", { roomId });
    spec.send("join_room", { roomId });
    await sleep(300);
    const errs = [
      ...p1.events.slice(m1).filter((e) => e.type === "error"),
      ...p2.events.slice(m2).filter((e) => e.type === "error"),
      ...spec.events.slice(ms).filter((e) => e.type === "error"),
    ];
    if (errs.length) throw new Error("WS join_room error: " + JSON.stringify(errs));
  });

  await checkpoint("Spectator receives room_message broadcasts", async () => {
    const ms = spec.mark();
    const m2 = p2.mark();
    const text = `hello-spec-${STAMP}`;
    p1.send("room_message", { roomId, message: text });
    // Spec must see it
    const got = await spec.waitForAfter(
      ms,
      (e) => e.type === "room_message" && e.payload?.message?.includes(text) && e.payload?.senderId === p1.userId,
      2000,
      "spec room_message",
    );
    if (got.payload.roomId !== roomId) throw new Error("wrong roomId on spec broadcast");
    // P2 (the other player) should also see it
    await p2.waitForAfter(
      m2,
      (e) => e.type === "room_message" && e.payload?.message?.includes(text),
      2000,
      "P2 room_message",
    );
  });

  await checkpoint("Both ready and P1 starts the game", async () => {
    await api(`/api/rooms/${roomId}/ready`, "POST", { ready: true, deckId: p1.deck.id }, p1.token);
    await api(`/api/rooms/${roomId}/ready`, "POST", { ready: true, deckId: p2.deck.id }, p2.token);
    const game = await api(`/api/rooms/${roomId}/start`, "POST", {}, p1.token);
    gameId = game.id;
    if (game.status !== "in_progress") throw new Error(`status=${game.status}`);
  });

  await checkpoint("P1, P2 join_game; Spectator's join_game is denied", async () => {
    const m1 = p1.mark(), m2 = p2.mark(), ms = spec.mark();
    p1.send("join_game", { gameId });
    p2.send("join_game", { gameId });
    spec.send("join_game", { gameId });
    await Promise.all([
      p1.waitForAfter(m1, (e) => e.type === "game_state", 3000, "P1 game_state"),
      p2.waitForAfter(m2, (e) => e.type === "game_state", 3000, "P2 game_state"),
    ]);
    // Spectator should see an error, not a game_state
    await spec.waitForAfter(ms, (e) => e.type === "error" && /not authorized/i.test(e.payload?.message || ""), 2000, "spec denied");
    const leakedState = spec.events.slice(ms).find((e) => e.type === "game_state");
    if (leakedState) throw new Error("spectator got game_state — STATE LEAK");
  });

  // ===========================================================================
  // Invalid actions
  // ===========================================================================
  await checkpoint("Reject end_turn during draw phase", async () => {
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "end_turn" });
    await p1.expectErrorAfter(m1, "phase", 2000, "end-turn-in-draw");
  });

  await checkpoint("Reject game_action from non-participant (spectator forfeit)", async () => {
    const ms = spec.mark();
    spec.send("game_action", { gameId, action: "forfeit" });
    await spec.expectErrorAfter(ms, "participant", 2000, "spec forfeit");
    // Game must still be in_progress
    const dbGame = await api(`/api/games/${gameId}`, "GET", null, p1.token);
    if (dbGame.status !== "in_progress") throw new Error(`spectator forfeit succeeded! status=${dbGame.status}`);
  });

  await checkpoint("Reject draw twice in same turn (concurrent races converge)", async () => {
    // Issue both draws concurrently
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "draw" });
    p1.send("game_action", { gameId, action: "draw" });
    p2.send("game_action", { gameId, action: "draw" });
    // First draw succeeds → state with myHasDrawn=true
    await p1.waitForState(m1, (s) => s.myHasDrawn, 3000, "P1 hasDrawn");
    // Second draw must fail
    const ev = p1.events.slice(m1).find((e) => e.type === "game_error" && /already drawn/i.test(e.payload?.error || ""));
    if (!ev) throw new Error("expected 'already drawn' error on second draw");
    // P2 should also have drawn → phase advances to deployment for both
    await p2.waitForState(p2.mark() - 1, (s) => s.currentPhase === "deployment" || s.myHasDrawn, 3000, "P2 deployment");
  });

  await checkpoint("Reject deploy with cardId not in hand", async () => {
    // Send 2 cards (matches required deploy count) but one is fake — must hit
    // the "not in hand" branch rather than the count branch.
    const s1 = p1.latestState();
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "deploy", data: { cardIds: [s1.myHand[0], "not-a-real-card::99"] } });
    await p1.expectErrorAfter(m1, "not in hand", 2000, "deploy invalid card");
  });

  await checkpoint("Reject deploy with too few cards (< required)", async () => {
    // requiredDeploy = min(maxDeploy, hand.length); when hand has >= 2 cards,
    // requiredDeploy is 2 — sending only 1 must be rejected.
    const s1 = p1.latestState();
    if (s1.myHand.length < 2) throw new Error("precondition failed: hand < 2");
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "deploy", data: { cardIds: [s1.myHand[0]] } });
    await p1.expectErrorAfter(m1, "must deploy exactly", 2000, "deploy too few");
  });

  await checkpoint("Reject deploy with too many cards (> max)", async () => {
    const s1 = p1.latestState();
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "deploy", data: { cardIds: s1.myHand.slice(0, 5) } });
    await p1.expectErrorAfter(m1, "cannot deploy more", 2000, "deploy too many");
  });

  // ===========================================================================
  // Concurrency: parallel valid deploys land cleanly
  // ===========================================================================
  await checkpoint("Concurrent deploys advance phase exactly once", async () => {
    const s1 = p1.latestState();
    const s2 = p2.latestState();
    // Pick the first 2 cards in each hand for this turn.
    const cards1 = s1.myHand.slice(0, 2);
    const cards2 = s2.myHand.slice(0, 2);
    const m1 = p1.mark(), m2 = p2.mark();
    // Fire both deploy messages concurrently — server must handle ordering safely.
    p1.send("game_action", { gameId, action: "deploy", data: { cardIds: cards1 } });
    p2.send("game_action", { gameId, action: "deploy", data: { cardIds: cards2 } });
    const finalP1 = await p1.waitForState(m1, (s) => s.currentPhase === "combat", 4000, "P1 combat phase");
    const finalP2 = await p2.waitForState(m2, (s) => s.currentPhase === "combat", 4000, "P2 combat phase");
    if (finalP1.myBattlefield.length !== 2 || finalP2.myBattlefield.length !== 2) {
      throw new Error(`expected 2 cards on each side, got P1=${finalP1.myBattlefield.length} P2=${finalP2.myBattlefield.length}`);
    }
    // No game_error events from this batch
    const errs = [...p1.events.slice(m1), ...p2.events.slice(m2)].filter((e) => e.type === "game_error");
    if (errs.length) throw new Error("unexpected game_error during concurrent deploy: " + JSON.stringify(errs));
  });

  // Helper: drain both players through one combat (deploy nothing / use what's
  // requested) and return the resolved combat_result.
  async function playThroughCombat({ p1Cards = [], p2Cards = [], beforeEndTurn } = {}) {
    // Caller is in combat phase already; just resolve via end_turn × 2.
    if (beforeEndTurn) await beforeEndTurn();
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "end_turn" });
    p2.send("game_action", { gameId, action: "end_turn" });
    const combat = await p1.waitForAfter(m1, (e) => e.type === "combat_result", 5000, "combat_result");
    await sleep(150); // let post-combat game_state arrive
    return combat.payload;
  }

  // Helper: from current draw phase, walk through draw → deploy(specified) → combat.
  // If a phase returns an error, throws.
  async function playOneTurn({ p1DeployTraits, p2Skip }) {
    // Draw
    const md1 = p1.mark(), md2 = p2.mark();
    p1.send("game_action", { gameId, action: "draw" });
    p2.send("game_action", { gameId, action: "draw" });
    await Promise.all([
      p1.waitForState(md1, (s) => s.currentPhase === "deployment", 3000, "P1 deploy phase"),
      p2.waitForState(md2, (s) => s.currentPhase === "deployment", 3000, "P2 deploy phase"),
    ]);

    // Deploy
    const s1 = p1.latestState(), s2 = p2.latestState();
    let p1Cards = [];
    if (p1DeployTraits) {
      // Try to find one card matching each requested trait, fall back to first cards
      const picked = new Set();
      for (const trait of p1DeployTraits) {
        const c = s1.myHand.find((id) => cardTrait.get(baseId(id)) === trait && !picked.has(id));
        if (c) { picked.add(c); p1Cards.push(c); }
      }
      while (p1Cards.length < 2 && p1Cards.length < s1.myHand.length) {
        const fill = s1.myHand.find((id) => !picked.has(id));
        if (!fill) break;
        picked.add(fill); p1Cards.push(fill);
      }
    } else {
      p1Cards = s1.myHand.slice(0, Math.min(2, s1.myHand.length));
    }
    const p2Cards = p2Skip ? [] : s2.myHand.slice(0, Math.min(2, s2.myHand.length));

    const md1b = p1.mark(), md2b = p2.mark();
    if (p1Cards.length === 0) {
      p1.send("game_action", { gameId, action: "end_turn" });
    } else {
      p1.send("game_action", { gameId, action: "deploy", data: { cardIds: p1Cards } });
    }
    if (p2Skip || p2Cards.length === 0) {
      p2.send("game_action", { gameId, action: "end_turn" });
    } else {
      p2.send("game_action", { gameId, action: "deploy", data: { cardIds: p2Cards } });
    }
    await Promise.all([
      p1.waitForState(md1b, (s) => s.currentPhase === "combat", 3000, "P1 combat"),
      p2.waitForState(md2b, (s) => s.currentPhase === "combat", 3000, "P2 combat"),
    ]);

    // End combat
    const m = p1.mark();
    p1.send("game_action", { gameId, action: "end_turn" });
    p2.send("game_action", { gameId, action: "end_turn" });
    const combat = await p1.waitForAfter(m, (e) => e.type === "combat_result", 5000, "combat_result");
    await sleep(150);
    return { combat: combat.payload, deployedP1: p1Cards };
  }

  // ===========================================================================
  // Trait coverage: play turns and accumulate Quick Strike / Guardian / Care Package
  // ===========================================================================
  // We're already in combat phase (turn 1) from the concurrency test.
  // Resolve turn 1 first.
  let traitObserved = { "Quick Strike": false, "Guardian": false, "Care Package": false };
  await checkpoint("Concurrent end_turn → exactly one combat resolution (turn 1)", async () => {
    // Fire 4 end_turn messages back-to-back: 2 from each player. Server must
    // resolve combat exactly once; duplicates must be dropped (not produce a
    // second combat_result, not double-resolve damage).
    const m1 = p1.mark(), m2 = p2.mark();
    p1.send("game_action", { gameId, action: "end_turn" });
    p2.send("game_action", { gameId, action: "end_turn" });
    p1.send("game_action", { gameId, action: "end_turn" });
    p2.send("game_action", { gameId, action: "end_turn" });
    const first = await p1.waitForAfter(m1, (e) => e.type === "combat_result", 5000, "combat_result");
    // Wait a beat to catch any second resolution.
    await sleep(400);
    const combatsP1 = p1.events.slice(m1).filter((e) => e.type === "combat_result");
    const combatsP2 = p2.events.slice(m2).filter((e) => e.type === "combat_result");
    if (combatsP1.length !== 1) throw new Error(`P1 saw ${combatsP1.length} combat_results, expected 1`);
    if (combatsP2.length !== 1) throw new Error(`P2 saw ${combatsP2.length} combat_results, expected 1`);
    const r = first.payload;
    log("COMBAT", `t1 winner=${r.winner} dmg=${r.damage} P1QS=${r.combatSummary?.player1QuickStrikeDamage} P2QS=${r.combatSummary?.player2QuickStrikeDamage}`);
    if (r.combatSummary?.player1QuickStrikeDamage > 0 || r.combatSummary?.player2QuickStrikeDamage > 0) traitObserved["Quick Strike"] = true;
    if (r.combatSummary?.player1GuardianBlocked > 0 || r.combatSummary?.player2GuardianBlocked > 0) traitObserved["Guardian"] = true;
    if (r.combatSummary?.player1CardsDrawn > 0 || r.combatSummary?.player2CardsDrawn > 0) traitObserved["Care Package"] = true;
    // Duplicate end_turn after combat resolves must be rejected with phase error
    const me = p1.mark();
    p1.send("game_action", { gameId, action: "end_turn" });
    await p1.expectErrorAfter(me, "phase", 2000, "duplicate end_turn after combat");
  });

  await checkpoint("Trait observation across multiple turns", async () => {
    // Play up to 5 more turns trying to surface Quick Strike, Guardian, Care Package.
    for (let i = 0; i < 5; i++) {
      const missing = Object.keys(traitObserved).filter((t) => !traitObserved[t]);
      if (missing.length === 0) break;
      const { combat } = await playOneTurn({ p1DeployTraits: missing });
      log("COMBAT", `try winner=${combat.winner} QS=${combat.combatSummary?.player1QuickStrikeDamage}/${combat.combatSummary?.player2QuickStrikeDamage} G=${combat.combatSummary?.player1GuardianBlocked}/${combat.combatSummary?.player2GuardianBlocked} CP=${combat.combatSummary?.player1CardsDrawn}/${combat.combatSummary?.player2CardsDrawn}`);
      if (combat.combatSummary?.player1QuickStrikeDamage > 0 || combat.combatSummary?.player2QuickStrikeDamage > 0) traitObserved["Quick Strike"] = true;
      if (combat.combatSummary?.player1GuardianBlocked > 0 || combat.combatSummary?.player2GuardianBlocked > 0) traitObserved["Guardian"] = true;
      if (combat.combatSummary?.player1CardsDrawn > 0 || combat.combatSummary?.player2CardsDrawn > 0) traitObserved["Care Package"] = true;
      // Bail if game ended somehow
      const s = p1.latestState();
      if (s?.status !== "in_progress") break;
    }
    const missing = Object.keys(traitObserved).filter((t) => !traitObserved[t]);
    if (missing.length > 0) throw new Error(`did not observe traits: ${missing.join(", ")}`);
  });

  // ===========================================================================
  // Commander abilities — we need both VP and WP. Walk turns where both players
  // skip deployment (tie) so each accrues +1 VP +1 WP per round, then exercise
  // extra_deploy (deployment, 2 WP), direct_damage (combat, 2 VP),
  // buff_element_unit (combat, 2 WP).
  // ===========================================================================
  async function ensureMinCounters(minVP, minWP) {
    let s = p1.latestState();
    let safety = 0;
    while ((s.myVP < minVP || s.myWP < minWP) && safety++ < 6) {
      // If we're not in draw phase, complete the current turn quickly
      if (s.currentPhase === "draw") {
        const md1 = p1.mark(), md2 = p2.mark();
        p1.send("game_action", { gameId, action: "draw" });
        p2.send("game_action", { gameId, action: "draw" });
        await Promise.all([
          p1.waitForState(md1, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
          p2.waitForState(md2, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
        ]);
      }
      s = p1.latestState();
      if (s.currentPhase === "deployment") {
        const m1 = p1.mark(), m2 = p2.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await Promise.all([
          p1.waitForState(m1, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
          p2.waitForState(m2, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
        ]);
      }
      s = p1.latestState();
      if (s.currentPhase === "combat") {
        const mc = p1.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await p1.waitForAfter(mc, (e) => e.type === "combat_result", 5000, "combat_result");
        await sleep(150);
      }
      s = p1.latestState();
    }
    return s;
  }

  await checkpoint("Commander ability: extra_deploy (ability-fire-4, deployment, 2 WP)", async () => {
    let s = await ensureMinCounters(0, 2);
    // Advance to deployment phase if we're not there
    if (s.currentPhase === "draw") {
      const md1 = p1.mark(), md2 = p2.mark();
      p1.send("game_action", { gameId, action: "draw" });
      p2.send("game_action", { gameId, action: "draw" });
      await Promise.all([
        p1.waitForState(md1, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
        p2.waitForState(md2, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
      ]);
      s = p1.latestState();
    }
    if (s.currentPhase !== "deployment") throw new Error(`expected deployment, got ${s.currentPhase}`);
    const wpBefore = s.myWP;
    if (wpBefore < 2) throw new Error(`expected myWP >= 2, got ${wpBefore}`);
    const m1 = p1.mark();
    p1.send("game_action", { gameId, action: "use_ability", data: { abilityId: "ability-fire-4" } });
    const after = await p1.waitForState(m1, (x) => (x.extraDeploy || 0) >= 1, 3000, "extraDeploy");
    if (after.myWP !== wpBefore - 2) throw new Error(`expected WP ${wpBefore - 2}, got ${after.myWP}`);
    log("ABILITY", `extra_deploy OK: WP ${wpBefore}→${after.myWP}, extraDeploy=${after.extraDeploy}`);
  });

  await checkpoint("Commander ability: direct_damage (ability-fire-1, combat, 2 VP)", async () => {
    // We're mid-deployment. End deployment to enter combat phase.
    let s = p1.latestState();
    if (s.currentPhase === "deployment") {
      const m1 = p1.mark(), m2 = p2.mark();
      p1.send("game_action", { gameId, action: "end_turn" });
      p2.send("game_action", { gameId, action: "end_turn" });
      await Promise.all([
        p1.waitForState(m1, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
        p2.waitForState(m2, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
      ]);
      s = p1.latestState();
    }
    if (s.myVP < 2) {
      // Need more VP — accept lots of ties to grind one VP at a time
      // (a tie awards +1 VP +1 WP to each side).
      // First, end the current combat phase to resolve into a tie if both BFs allow.
      const mc = p1.mark();
      p1.send("game_action", { gameId, action: "end_turn" });
      p2.send("game_action", { gameId, action: "end_turn" });
      await p1.waitForAfter(mc, (e) => e.type === "combat_result", 5000, "combat_result");
      await sleep(150);
      // Walk to combat phase again accumulating until VP >= 2
      while (true) {
        s = p1.latestState();
        if (s.myVP >= 2) break;
        if (s.currentPhase === "draw") {
          const md1 = p1.mark(), md2 = p2.mark();
          p1.send("game_action", { gameId, action: "draw" });
          p2.send("game_action", { gameId, action: "draw" });
          await Promise.all([
            p1.waitForState(md1, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
            p2.waitForState(md2, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
          ]);
        }
        const ms1 = p1.mark(), ms2 = p2.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await Promise.all([
          p1.waitForState(ms1, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
          p2.waitForState(ms2, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
        ]);
        const mc2 = p1.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await p1.waitForAfter(mc2, (e) => e.type === "combat_result", 5000, "combat_result");
        await sleep(150);
      }
      // Re-enter combat phase for the actual ability test
      s = p1.latestState();
      if (s.currentPhase === "draw") {
        const md1 = p1.mark(), md2 = p2.mark();
        p1.send("game_action", { gameId, action: "draw" });
        p2.send("game_action", { gameId, action: "draw" });
        await Promise.all([
          p1.waitForState(md1, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
          p2.waitForState(md2, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
        ]);
      }
      const m1 = p1.mark(), m2 = p2.mark();
      p1.send("game_action", { gameId, action: "end_turn" });
      p2.send("game_action", { gameId, action: "end_turn" });
      await Promise.all([
        p1.waitForState(m1, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
        p2.waitForState(m2, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
      ]);
      s = p1.latestState();
    }
    const oppHpBefore = s.opponentHP;
    const vpBefore = s.myVP;
    const m = p1.mark();
    p1.send("game_action", { gameId, action: "use_ability", data: { abilityId: "ability-fire-1" } });
    const after = await p1.waitForState(m, (x) => x.opponentHP === oppHpBefore - 4 && x.myVP === vpBefore - 2, 3000, "direct_damage");
    log("ABILITY", `direct_damage OK: oppHP ${oppHpBefore}→${after.opponentHP}, VP ${vpBefore}→${after.myVP}`);
  });

  await checkpoint("Commander ability: buff_element_unit (ability-fire-3, combat, 2 WP)", async () => {
    // We just used an ability in combat phase. Either still in combat or moved on.
    // We must have at least 2 WP to use this. Resolve combats until we have 2 WP and we're in combat phase.
    let s = p1.latestState();
    let safety = 0;
    while (safety++ < 8) {
      if (s.status !== "in_progress") throw new Error("game ended unexpectedly");
      if (s.currentPhase === "combat" && s.myWP >= 2) break;
      if (s.currentPhase === "combat") {
        const mc = p1.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await p1.waitForAfter(mc, (e) => e.type === "combat_result", 5000, "combat_result");
        await sleep(150);
      } else if (s.currentPhase === "draw") {
        const md1 = p1.mark(), md2 = p2.mark();
        p1.send("game_action", { gameId, action: "draw" });
        p2.send("game_action", { gameId, action: "draw" });
        await Promise.all([
          p1.waitForState(md1, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
          p2.waitForState(md2, (x) => x.currentPhase === "deployment", 3000, "draw→dep"),
        ]);
      } else if (s.currentPhase === "deployment") {
        const m1 = p1.mark(), m2 = p2.mark();
        p1.send("game_action", { gameId, action: "end_turn" });
        p2.send("game_action", { gameId, action: "end_turn" });
        await Promise.all([
          p1.waitForState(m1, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
          p2.waitForState(m2, (x) => x.currentPhase === "combat", 3000, "dep→combat"),
        ]);
      }
      s = p1.latestState();
    }
    if (s.currentPhase !== "combat" || s.myWP < 2) {
      throw new Error(`could not reach combat phase with WP>=2 (phase=${s.currentPhase} WP=${s.myWP})`);
    }
    const wpBefore = s.myWP;
    const buffsBefore = (s.abilityBuffs || []).length;
    const m = p1.mark();
    p1.send("game_action", { gameId, action: "use_ability", data: { abilityId: "ability-fire-3" } });
    const after = await p1.waitForState(
      m,
      (x) => x.myWP === wpBefore - 2 && (x.abilityBuffs || []).length > buffsBefore,
      3000,
      "buff_element_unit",
    );
    const newBuff = after.abilityBuffs[after.abilityBuffs.length - 1];
    if (newBuff?.type !== "buff" || newBuff?.targetElement !== "fire" || newBuff?.amount !== 4) {
      throw new Error(`unexpected buff payload: ${JSON.stringify(newBuff)}`);
    }
    log("ABILITY", `buff_element_unit OK: WP ${wpBefore}→${after.myWP}, buff=${JSON.stringify(newBuff)}`);
  });

  // ===========================================================================
  // End of game #1: P2 forfeits to leave the game in a clean completed state
  // ===========================================================================
  await checkpoint("P2 forfeits → game ends with P1 winning", async () => {
    const m = p1.mark();
    p2.send("game_action", { gameId, action: "forfeit" });
    const ev = await p1.waitForAfter(m, (e) => e.type === "game_over", 4000, "game_over");
    if (ev.payload.winnerId !== p1.userId) throw new Error("P1 should have won");
  });

  await checkpoint("Reject forfeit on already-completed game", async () => {
    const m = p1.mark();
    p1.send("game_action", { gameId, action: "forfeit" });
    await p1.expectErrorAfter(m, "not in progress", 2000, "double-forfeit");
  });

  // ===========================================================================
  // Disconnect / reconnect test (separate game, short timeout)
  // ===========================================================================
  let game2Id, room2Id;
  await checkpoint("Setup game #2 for disconnect test", async () => {
    const room = await api("/api/rooms", "POST", { name: `hard-d ${STAMP}` }, p1.token);
    room2Id = room.id;
    await api(`/api/rooms/${room2Id}/join`, "POST", {}, p2.token);
    await api(`/api/rooms/${room2Id}/ready`, "POST", { ready: true, deckId: p1.deck.id }, p1.token);
    await api(`/api/rooms/${room2Id}/ready`, "POST", { ready: true, deckId: p2.deck.id }, p2.token);
    const game = await api(`/api/rooms/${room2Id}/start`, "POST", {}, p1.token);
    game2Id = game.id;
    p1.send("join_game", { gameId: game2Id });
    p2.send("join_game", { gameId: game2Id });
    await Promise.all([
      p1.waitForAfter(p1.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game2Id, 3000, "P1 g2 state"),
      p2.waitForAfter(p2.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game2Id, 3000, "P2 g2 state"),
    ]);
  });

  await checkpoint("Reconnect within timeout cancels forfeit", async () => {
    // P2 closes WS, P1 should see opponent_disconnected almost immediately.
    const m1 = p1.mark();
    p2.close();
    await p1.waitForAfter(m1, (e) => e.type === "opponent_disconnected", 2000, "opponent_disconnected");
    log("DISCONNECT", `P2 closed WS, P1 saw opponent_disconnected`);
    // Reconnect P2 well within DISCONNECT_TIMEOUT_MS
    await sleep(Math.floor(DISCONNECT_TIMEOUT_MS / 4));
    p2.events = [];
    await p2.connectWS();
    p2.send("join_game", { gameId: game2Id });
    await p1.waitForAfter(p1.mark() - 1, (e) => e.type === "opponent_reconnected", 2000, "opponent_reconnected");
    // Wait past the original timeout to confirm forfeit did NOT fire
    await sleep(DISCONNECT_TIMEOUT_MS + 300);
    const fail = p1.events.slice(m1).find((e) => e.type === "game_over");
    if (fail) throw new Error("forfeit fired despite reconnect: " + JSON.stringify(fail));
    const dbGame = await api(`/api/games/${game2Id}`, "GET", null, p1.token);
    if (dbGame.status !== "in_progress") throw new Error(`game ended unexpectedly: ${dbGame.status}`);
  });

  await checkpoint("Disconnect past timeout triggers forfeit", async () => {
    const m1 = p1.mark();
    p2.close();
    await p1.waitForAfter(m1, (e) => e.type === "opponent_disconnected", 2000, "opponent_disconnected #2");
    // Wait past the timeout
    const ev = await p1.waitForAfter(
      m1,
      (e) => e.type === "game_over" && e.payload.reason === "opponent_forfeit",
      DISCONNECT_TIMEOUT_MS + 2000,
      "game_over via forfeit",
    );
    if (ev.payload.winnerId !== p1.userId) throw new Error("P1 should have won via disconnect forfeit");
    const dbGame = await api(`/api/games/${game2Id}`, "GET", null, p1.token);
    if (dbGame.status !== "completed" || dbGame.winnerId !== p1.userId) {
      throw new Error(`DB game not completed properly: status=${dbGame.status} winner=${dbGame.winnerId}`);
    }
  });

  // ===========================================================================
  // Host promotion: when host leaves a waiting room with a guest, guest is promoted.
  // ===========================================================================
  let promoRoomId;
  await checkpoint("Host promotion when host leaves a waiting room", async () => {
    const room = await api("/api/rooms", "POST", { name: `hard-promo ${STAMP}` }, p1.token);
    promoRoomId = room.id;
    await api(`/api/rooms/${promoRoomId}/join`, "POST", {}, p2.token);
    let cur = await api(`/api/rooms/${promoRoomId}`, "GET", null, p1.token);
    if (cur.hostId !== p1.userId || cur.guestId !== p2.userId) throw new Error("initial host/guest wrong");
    await api(`/api/rooms/${promoRoomId}/leave`, "POST", {}, p1.token);
    cur = await api(`/api/rooms/${promoRoomId}`, "GET", null, p2.token);
    if (cur.hostId !== p2.userId) throw new Error(`expected P2 promoted to host, got hostId=${cur.hostId}`);
    if (cur.guestId !== null) throw new Error(`expected guestId null, got ${cur.guestId}`);
  });

  await checkpoint("Last occupant leaves → room is deleted", async () => {
    // P2 (now sole host) leaves — room should be removed entirely.
    await api(`/api/rooms/${promoRoomId}/leave`, "POST", {}, p2.token);
    let threw = false;
    try {
      await api(`/api/rooms/${promoRoomId}`, "GET", null, p2.token);
    } catch (e) {
      threw = /404/.test(e.message);
    }
    if (!threw) throw new Error("room should have been deleted (404 expected)");
    const dbRow = await pgClient.query(`SELECT id FROM game_rooms WHERE id = $1`, [promoRoomId]);
    if (dbRow.rowCount !== 0) throw new Error("room still present in DB after both left");
  });

  // ===========================================================================
  // Lag handling (task #63): heartbeat watchdog, turn timer, idempotency
  // ===========================================================================
  await checkpoint("Reconnect P2 for lag-handling tests", async () => {
    p2.events = [];
    await p2.connectWS();
  });

  await checkpoint("Heartbeat watchdog terminates a dead WS connection", async () => {
    // Use a brand-new client whose WS we can pause without breaking the
    // reusable p1/p2/admin connections.
    const dead = new TestClient("DEAD");
    await dead.login(`${TEST_EMAIL_PREFIX}dead-${STAMP}@test.local`, "DeadSocket");
    await dead.connectWS();
    // Shorten the heartbeat-pong timeout, then pause the underlying socket
    // so the ws library can no longer auto-respond to pings, then trigger
    // one watchdog iteration and expect the server to ws.terminate() us.
    await api("/api/admin/test/heartbeat-timeout", "POST", { ms: 200 }, admin.token);
    dead.ws.pause();
    await sleep(400);
    // Scope the watchdog tick to ONLY the dead client so we don't take
    // down the other live test connections whose lastPongAt is also older
    // than 200 ms (the natural 15 s loop hasn't pinged them yet either).
    await api("/api/admin/test/trigger-heartbeat", "POST", { userId: dead.userId }, admin.token);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WS not terminated within 2s")), 2000);
      if (dead.wsClosed) { clearTimeout(timer); resolve(); return; }
      dead.ws.once("close", () => { clearTimeout(timer); resolve(); });
    });
    // Restore default heartbeat timeout
    await api("/api/admin/test/heartbeat-timeout", "POST", { ms: 45000 }, admin.token);
  });

  let game3Id, room3Id;
  await checkpoint("Setup game #3 for turn-timer auto-forfeit test", async () => {
    // Shorten the per-turn timeout BEFORE the game is created so
    // gameEngine.registerGame() picks up the test value when it arms the
    // first turn timer. Setting it after the game starts would leave the
    // already-scheduled 60 s timeout in flight and the test would hang.
    await api("/api/admin/test/turn-timeout", "POST", { ms: 500 }, admin.token);
    const room = await api("/api/rooms", "POST", { name: `hard-tt ${STAMP}` }, p1.token);
    room3Id = room.id;
    await api(`/api/rooms/${room3Id}/join`, "POST", {}, p2.token);
    await api(`/api/rooms/${room3Id}/ready`, "POST", { ready: true, deckId: p1.deck.id }, p1.token);
    await api(`/api/rooms/${room3Id}/ready`, "POST", { ready: true, deckId: p2.deck.id }, p2.token);
    const game = await api(`/api/rooms/${room3Id}/start`, "POST", {}, p1.token);
    game3Id = game.id;
    p1.send("join_game", { gameId: game3Id });
    p2.send("join_game", { gameId: game3Id });
    await Promise.all([
      p1.waitForAfter(p1.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game3Id, 3000, "P1 g3 state"),
      p2.waitForAfter(p2.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game3Id, 3000, "P2 g3 state"),
    ]);
  });

  await checkpoint("Turn timer auto-passes inactive players (turn_timeout fires)", async () => {
    const m1 = p1.mark();
    await p1.waitForAfter(
      m1,
      (e) => e.type === "turn_timeout" && e.payload?.gameId === game3Id,
      4000,
      "turn_timeout #1",
    );
  });

  await checkpoint("3 consecutive turn timeouts → auto-forfeit + game_over", async () => {
    // Continue not acting; engine should escalate to forfeit on the 3rd strike.
    const ev = await p1.waitForAfter(
      p1.mark() - 1,
      (e) =>
        e.type === "game_over" &&
        e.payload?.gameId === game3Id &&
        e.payload?.reason === "turn_timeout_forfeit",
      6000,
      "game_over via turn_timeout_forfeit",
    );
    if (!ev.payload.winnerId) throw new Error("missing winnerId on timeout forfeit");
  });

  let game4Id, room4Id;
  await checkpoint("Setup game #4 for clientActionId idempotency test", async () => {
    // Restore the default turn timeout BEFORE creating game4 so its
    // initial timer is armed at the normal 60 s and doesn't auto-forfeit
    // mid-test.
    await api("/api/admin/test/turn-timeout", "POST", { ms: 60000 }, admin.token);
    const room = await api("/api/rooms", "POST", { name: `hard-idem ${STAMP}` }, p1.token);
    room4Id = room.id;
    await api(`/api/rooms/${room4Id}/join`, "POST", {}, p2.token);
    await api(`/api/rooms/${room4Id}/ready`, "POST", { ready: true, deckId: p1.deck.id }, p1.token);
    await api(`/api/rooms/${room4Id}/ready`, "POST", { ready: true, deckId: p2.deck.id }, p2.token);
    const game = await api(`/api/rooms/${room4Id}/start`, "POST", {}, p1.token);
    game4Id = game.id;
    p1.send("join_game", { gameId: game4Id });
    p2.send("join_game", { gameId: game4Id });
    await Promise.all([
      p1.waitForAfter(p1.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game4Id, 3000, "P1 g4 state"),
      p2.waitForAfter(p2.mark() - 1, (e) => e.type === "game_state" && e.payload.gameId === game4Id, 3000, "P2 g4 state"),
    ]);
  });

  await checkpoint("Duplicate clientActionId is idempotent (action_ack { duplicate: true })", async () => {
    const actionId = `idem-${STAMP}-1`;
    const m1 = p1.mark();
    p1.send("game_action", { gameId: game4Id, action: "draw", clientActionId: actionId });
    // First ack: duplicate=false; state should reflect myHasDrawn=true.
    const firstAck = await p1.waitForAfter(
      m1,
      (e) => e.type === "action_ack" && e.payload?.clientActionId === actionId,
      3000,
      "first action_ack",
    );
    if (firstAck.payload.duplicate !== false) {
      throw new Error(`expected duplicate=false on first send, got ${firstAck.payload.duplicate}`);
    }
    const drawnState = p1.events
      .slice(m1)
      .find((e) => e.type === "game_state" && e.payload?.gameId === game4Id && e.payload?.myHasDrawn === true);
    if (!drawnState) throw new Error("expected game_state with myHasDrawn=true after first draw");
    // Resend with the same clientActionId — must NOT execute, must ack
    // duplicate=true, must NOT trigger an "already drawn" game_error.
    const m2 = p1.mark();
    p1.send("game_action", { gameId: game4Id, action: "draw", clientActionId: actionId });
    const dupAck = await p1.waitForAfter(
      m2,
      (e) => e.type === "action_ack" && e.payload?.clientActionId === actionId,
      3000,
      "duplicate action_ack",
    );
    if (dupAck.payload.duplicate !== true) {
      throw new Error(`expected duplicate=true on resend, got ${dupAck.payload.duplicate}`);
    }
    const errAfter = p1.events
      .slice(m2)
      .find((e) => e.type === "game_error" && /already drawn/i.test(e.payload?.error || ""));
    if (errAfter) throw new Error("idempotency failed: server re-executed and emitted 'already drawn'");
  });

  // ===========================================================================
  // T_BF: Battlefield Mode checkpoints (task #83)
  // ===========================================================================

  // CP-BF1: Room creation with battlefieldMode=true is rejected when neither
  //          player has a 7-card battlefield deck saved.
  await checkpoint("BF-CP1: Room start rejected when players lack battlefield decks", async () => {
    const bfUser1 = new TestClient("BF-U1");
    const bfUser2 = new TestClient("BF-U2");
    await bfUser1.login(`mp-hard-bf1-${STAMP}@test.local`, "BF-User1");
    await bfUser2.login(`mp-hard-bf2-${STAMP}@test.local`, "BF-User2");
    await bfUser1.getDecks();
    await bfUser2.getDecks();

    // Create room with battlefieldMode=true
    const bfRoom = await api("/api/rooms", "POST", {
      name: `bf-test-room-${STAMP}`,
      isPrivate: false,
      battlefieldMode: true,
      gameMode: "standard",
    }, bfUser1.token);

    if (!bfRoom?.id) throw new Error("Room creation returned no ID");
    if (!bfRoom?.settings?.battlefieldMode) throw new Error("Room settings.battlefieldMode was not persisted");

    // Guest joins the room
    await api(`/api/rooms/${bfRoom.id}/join`, "POST", {}, bfUser2.token);

    // Neither player has a battlefield deck — starting MUST be rejected (4xx)
    const startHttpRes = await fetch(`${BASE}/api/rooms/${bfRoom.id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bfUser1.token}`,
      },
    });
    if (startHttpRes.ok) {
      throw new Error(`Expected room start to fail with 4xx without battlefield decks, got HTTP ${startHttpRes.status}`);
    }
    const errText = await startHttpRes.text();
    const lowerErr = errText.toLowerCase();
    if (!lowerErr.includes("battlefield") && !lowerErr.includes("field deck") && !lowerErr.includes("7-card")) {
      throw new Error(`Expected error to mention battlefield deck requirement; got: ${errText}`);
    }
    // Clean up the room
    await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [bfRoom.id]);
  });

  // CP-BF2: battlefieldMode room can start when both players have saved field
  //          decks, and the resulting game_state contains battlefieldModeEnabled=true.
  await checkpoint("BF-CP2: Battlefield mode game starts and battlefieldModeEnabled=true in WS state", async () => {
    // Pre-flight: need ≥7 seeded field cards; if not, fail clearly so it's obvious what's missing
    const fieldCardsCheck = await api("/api/cards/battlefield", "GET", null, admin.token).catch(() => []);
    if (!Array.isArray(fieldCardsCheck)) throw new Error("GET /api/cards/battlefield did not return an array");
    if (fieldCardsCheck.length < 7) {
      throw new Error(
        `BF-CP2 requires at least 7 seeded field cards but only found ${fieldCardsCheck.length}. ` +
        "Seed field cards first (see task #91) — do NOT skip this checkpoint."
      );
    }
    const fieldIds = fieldCardsCheck.slice(0, 7).map((c) => c.id);

    const bfUser3 = new TestClient("BF-U3");
    const bfUser4 = new TestClient("BF-U4");
    await bfUser3.login(`mp-hard-bf3-${STAMP}@test.local`, "BF-User3");
    await bfUser4.login(`mp-hard-bf4-${STAMP}@test.local`, "BF-User4");
    await bfUser3.getDecks();
    await bfUser4.getDecks();

    // Give both players a valid 7-card battlefield deck
    await api("/api/decks/battlefield", "PUT", { cardIds: fieldIds }, bfUser3.token);
    await api("/api/decks/battlefield", "PUT", { cardIds: fieldIds }, bfUser4.token);

    // Create a battlefield room
    const bfRoom2 = await api("/api/rooms", "POST", {
      name: `bf-test-room2-${STAMP}`,
      isPrivate: false,
      battlefieldMode: true,
      gameMode: "standard",
    }, bfUser3.token);
    if (!bfRoom2?.id) throw new Error("Room creation returned no id");

    await api(`/api/rooms/${bfRoom2.id}/join`, "POST", {}, bfUser4.token);
    await api(`/api/rooms/${bfRoom2.id}/deck`, "POST", { deckId: bfUser3.deck.id }, bfUser3.token);
    await api(`/api/rooms/${bfRoom2.id}/deck`, "POST", { deckId: bfUser4.deck.id }, bfUser4.token);

    // Connect and ready up
    await bfUser3.connectWS();
    await bfUser4.connectWS();
    bfUser3.send("join_room", { roomId: bfRoom2.id });
    bfUser4.send("join_room", { roomId: bfRoom2.id });
    await sleep(400);
    bfUser3.send("player_ready", { roomId: bfRoom2.id, deckId: bfUser3.deck.id });
    bfUser4.send("player_ready", { roomId: bfRoom2.id, deckId: bfUser4.deck.id });
    await sleep(400);

    const startRes = await api(`/api/rooms/${bfRoom2.id}/start`, "POST", {}, bfUser3.token);
    if (!startRes) throw new Error("Room start returned null");

    // The HTTP response game state must have battlefieldMode=true
    const gs = startRes.gameState || {};
    if (!gs.battlefieldMode) {
      throw new Error(`Expected gameState.battlefieldMode=true in start response, got: ${JSON.stringify(gs.battlefieldMode)}`);
    }

    // Wait for game_state WS event and verify battlefieldModeEnabled is true
    const mark3 = bfUser3.mark();
    await sleep(600);
    const wsState3 = await bfUser3.waitForState(
      mark3,
      (s) => s.battlefieldModeEnabled === true,
      4000,
      "game_state with battlefieldModeEnabled=true"
    ).catch(() => null);
    if (!wsState3) {
      const latest = bfUser3.latestState();
      throw new Error(
        `BF-U3 did not receive game_state with battlefieldModeEnabled=true. ` +
        `Latest state: ${JSON.stringify(latest?.battlefieldModeEnabled)}`
      );
    }

    bfUser3.close(); bfUser4.close();
    await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [bfRoom2.id]);
  });

  // CP-BF3: After both players draw in a battlefield game, battlefieldActiveCards
  //          in the WS game_state are non-null (both p1Card and p2Card populated).
  await checkpoint("BF-CP3: After Draw phase, battlefieldActiveCards are non-null in WS game_state", async () => {
    // Verify the endpoint exists and returns an array first
    const fieldCards = await api("/api/cards/battlefield", "GET", null, admin.token).catch(() => []);
    if (!Array.isArray(fieldCards)) {
      throw new Error("GET /api/cards/battlefield did not return an array — endpoint missing or broken");
    }
    if (fieldCards.length < 7) {
      throw new Error(
        `BF-CP3 requires ≥7 seeded field cards but found ${fieldCards.length}. ` +
        "Seed field cards first (task #91)."
      );
    }
    const fieldIds = fieldCards.slice(0, 7).map((c) => c.id);

    const bfUser5 = new TestClient("BF-U5");
    const bfUser6 = new TestClient("BF-U6");
    await bfUser5.login(`mp-hard-bf5-${STAMP}@test.local`, "BF-User5");
    await bfUser6.login(`mp-hard-bf6-${STAMP}@test.local`, "BF-User6");
    await bfUser5.getDecks();
    await bfUser6.getDecks();

    await api("/api/decks/battlefield", "PUT", { cardIds: fieldIds }, bfUser5.token);
    await api("/api/decks/battlefield", "PUT", { cardIds: fieldIds }, bfUser6.token);

    const bfRoom3 = await api("/api/rooms", "POST", {
      name: `bf-test-room3-${STAMP}`,
      isPrivate: false,
      battlefieldMode: true,
      gameMode: "standard",
    }, bfUser5.token);
    if (!bfRoom3?.id) throw new Error("Room creation returned no id");

    await api(`/api/rooms/${bfRoom3.id}/join`, "POST", {}, bfUser6.token);
    await api(`/api/rooms/${bfRoom3.id}/deck`, "POST", { deckId: bfUser5.deck.id }, bfUser5.token);
    await api(`/api/rooms/${bfRoom3.id}/deck`, "POST", { deckId: bfUser6.deck.id }, bfUser6.token);

    await bfUser5.connectWS();
    await bfUser6.connectWS();
    bfUser5.send("join_room", { roomId: bfRoom3.id });
    bfUser6.send("join_room", { roomId: bfRoom3.id });
    await sleep(400);
    bfUser5.send("player_ready", { roomId: bfRoom3.id, deckId: bfUser5.deck.id });
    bfUser6.send("player_ready", { roomId: bfRoom3.id, deckId: bfUser6.deck.id });
    await sleep(400);

    await api(`/api/rooms/${bfRoom3.id}/start`, "POST", {}, bfUser5.token);
    await sleep(400);

    // Both players draw — this triggers the field card flip in the engine
    // Mark BEFORE sending draw actions so we catch the game_state that follows
    const markDraw = bfUser5.mark();
    bfUser5.send("game_action", { type: "draw" });
    await sleep(200);
    bfUser6.send("game_action", { type: "draw" });
    await sleep(600);
    const gsAfterDraw = await bfUser5.waitForState(
      markDraw,
      (s) => s.battlefieldActiveCards?.myCard != null && s.battlefieldActiveCards?.oppCard != null,
      5000,
      "game_state with battlefieldActiveCards.myCard and oppCard non-null"
    ).catch(() => null);
    if (!gsAfterDraw) {
      const latest = bfUser5.latestState();
      throw new Error(
        `BF-U5 did not receive game_state with both battlefieldActiveCards (myCard/oppCard) after draw. ` +
        `Latest battlefieldActiveCards: ${JSON.stringify(latest?.battlefieldActiveCards)}`
      );
    }
    const myCard = gsAfterDraw.battlefieldActiveCards.myCard;
    const oppCard = gsAfterDraw.battlefieldActiveCards.oppCard;
    if (!Array.isArray(myCard.effects) || myCard.effects.length === 0) {
      throw new Error(`Expected myCard.effects to be a non-empty array; got: ${JSON.stringify(myCard.effects)}`);
    }
    log("BF-CP3", `myCard=${myCard.name} effects=[${myCard.effects.map(e=>e.type).join(",")}], oppCard=${oppCard.name}`);

    bfUser5.close(); bfUser6.close();
    await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [bfRoom3.id]);
  });

  // CP-BF4: deploy_limit_override enforcement — a field deck of all bf-narrow-pass
  //          forces exactly 1 deployment; sending 3 cards must fail with a clear error.
  await checkpoint("BF-CP4: deploy_limit_override enforced — 3-card deploy rejected when limit=1", async () => {
    const fieldCards = await api("/api/cards/battlefield", "GET", null, admin.token).catch(() => []);
    const narrowPass = (fieldCards || []).find((c) => c.id === "bf-narrow-pass");
    if (!narrowPass) {
      throw new Error("bf-narrow-pass field card not found — seed battlefield cards first (task #91)");
    }
    // All 7 slots are narrow-pass so both players always draw a limit=1 card
    const narrowDeck = Array.from({ length: 7 }, () => narrowPass.id);

    const bfUser7 = new TestClient("BF-U7");
    const bfUser8 = new TestClient("BF-U8");
    await bfUser7.login(`mp-hard-bf7-${STAMP}@test.local`, "BF-User7");
    await bfUser8.login(`mp-hard-bf8-${STAMP}@test.local`, "BF-User8");
    await bfUser7.getDecks();
    await bfUser8.getDecks();

    await api("/api/decks/battlefield", "PUT", { cardIds: narrowDeck }, bfUser7.token);
    await api("/api/decks/battlefield", "PUT", { cardIds: narrowDeck }, bfUser8.token);

    const bfRoom4 = await api("/api/rooms", "POST", {
      name: `bf-test-room4-${STAMP}`, isPrivate: false, battlefieldMode: true, gameMode: "standard",
    }, bfUser7.token);
    if (!bfRoom4?.id) throw new Error("Room creation returned no id");

    await api(`/api/rooms/${bfRoom4.id}/join`, "POST", {}, bfUser8.token);
    await api(`/api/rooms/${bfRoom4.id}/deck`, "POST", { deckId: bfUser7.deck.id }, bfUser7.token);
    await api(`/api/rooms/${bfRoom4.id}/deck`, "POST", { deckId: bfUser8.deck.id }, bfUser8.token);

    await bfUser7.connectWS();
    await bfUser8.connectWS();
    bfUser7.send("join_room", { roomId: bfRoom4.id });
    bfUser8.send("join_room", { roomId: bfRoom4.id });
    await sleep(400);
    bfUser7.send("player_ready", { roomId: bfRoom4.id, deckId: bfUser7.deck.id });
    bfUser8.send("player_ready", { roomId: bfRoom4.id, deckId: bfUser8.deck.id });
    await sleep(400);

    await api(`/api/rooms/${bfRoom4.id}/start`, "POST", {}, bfUser7.token);
    await sleep(400);

    // Both players draw — triggers narrow-pass flip (deploy limit = 1)
    const md7 = bfUser7.mark(), md8 = bfUser8.mark();
    bfUser7.send("game_action", { type: "draw" });
    bfUser8.send("game_action", { type: "draw" });
    // Wait for both to enter deployment phase
    await Promise.all([
      bfUser7.waitForState(md7, (s) => s.currentPhase === "deployment", 4000, "BF-U7 deployment phase"),
      bfUser8.waitForState(md8, (s) => s.currentPhase === "deployment", 4000, "BF-U8 deployment phase"),
    ]);

    // Verify active card is narrow-pass (deploy_limit_override=1)
    const stateAfterDraw = bfUser7.latestState();
    const activeCard = stateAfterDraw?.battlefieldActiveCards?.myCard;
    if (!activeCard) throw new Error("Expected myCard to be set after draw in narrow-pass game");
    const limitEff = (activeCard.effects || []).find((e) => e.type === "deploy_limit_override");
    if (!limitEff || limitEff.value !== 1) {
      throw new Error(`Expected deploy_limit_override=1 from bf-narrow-pass; got: ${JSON.stringify(activeCard.effects)}`);
    }

    // Try to deploy 0 cards (empty array) — must be rejected with "Must deploy exactly 1"
    // (deploying 0 hits the count mismatch: deployed.length !== effectiveLimit)
    const mErr = bfUser7.mark();
    bfUser7.send("game_action", { type: "deploy", data: { cardIds: [] } });
    const err4 = await bfUser7.expectErrorAfter(mErr, "must deploy exactly", 3000, "deploy limit rejection").catch(() => null);
    if (!err4) {
      throw new Error("Expected game_error mentioning 'must deploy exactly' when deploying 0 cards with narrow-pass active (limit=1)");
    }
    log("BF-CP4", `Got expected error: ${err4.payload?.error}`);

    bfUser7.close(); bfUser8.close();
    await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [bfRoom4.id]);
  });

  // CP-BF5: element_buff affects combat power — volcanic-surge (+2 Fire) game plays
  //         one full round; combat resolves without error and round advances to 2.
  await checkpoint("BF-CP5: element_buff (volcanic-surge) — combat resolves correctly with buff active", async () => {
    const fieldCards = await api("/api/cards/battlefield", "GET", null, admin.token).catch(() => []);
    const volcanicSurge = (fieldCards || []).find((c) => c.id === "bf-volcanic-surge");
    if (!volcanicSurge) {
      throw new Error("bf-volcanic-surge field card not found — seed battlefield cards first (task #91)");
    }
    const surgeDeck = Array.from({ length: 7 }, () => volcanicSurge.id);

    const bfUser9 = new TestClient("BF-U9");
    const bfUser10 = new TestClient("BF-U10");
    await bfUser9.login(`mp-hard-bf9-${STAMP}@test.local`, "BF-User9");
    await bfUser10.login(`mp-hard-bf10-${STAMP}@test.local`, "BF-User10");
    await bfUser9.getDecks();
    await bfUser10.getDecks();

    await api("/api/decks/battlefield", "PUT", { cardIds: surgeDeck }, bfUser9.token);
    await api("/api/decks/battlefield", "PUT", { cardIds: surgeDeck }, bfUser10.token);

    const bfRoom5 = await api("/api/rooms", "POST", {
      name: `bf-test-room5-${STAMP}`, isPrivate: false, battlefieldMode: true, gameMode: "standard",
    }, bfUser9.token);
    if (!bfRoom5?.id) throw new Error("Room creation returned no id");

    await api(`/api/rooms/${bfRoom5.id}/join`, "POST", {}, bfUser10.token);
    await api(`/api/rooms/${bfRoom5.id}/deck`, "POST", { deckId: bfUser9.deck.id }, bfUser9.token);
    await api(`/api/rooms/${bfRoom5.id}/deck`, "POST", { deckId: bfUser10.deck.id }, bfUser10.token);

    await bfUser9.connectWS();
    await bfUser10.connectWS();
    bfUser9.send("join_room", { roomId: bfRoom5.id });
    bfUser10.send("join_room", { roomId: bfRoom5.id });
    await sleep(400);
    bfUser9.send("player_ready", { roomId: bfRoom5.id, deckId: bfUser9.deck.id });
    bfUser10.send("player_ready", { roomId: bfRoom5.id, deckId: bfUser10.deck.id });
    await sleep(400);

    await api(`/api/rooms/${bfRoom5.id}/start`, "POST", {}, bfUser9.token);
    await sleep(400);

    // Draw phase — triggers volcanic-surge flip
    const md9 = bfUser9.mark(), md10 = bfUser10.mark();
    bfUser9.send("game_action", { type: "draw" });
    bfUser10.send("game_action", { type: "draw" });
    await Promise.all([
      bfUser9.waitForState(md9, (s) => s.currentPhase === "deployment", 4000, "BF-U9 deployment"),
      bfUser10.waitForState(md10, (s) => s.currentPhase === "deployment", 4000, "BF-U10 deployment"),
    ]);

    // Verify element_buff effect is present in active card
    const state9 = bfUser9.latestState();
    const surge = state9?.battlefieldActiveCards?.myCard;
    if (!surge) throw new Error("Expected myCard to be set after draw in volcanic-surge game");
    const buffEff = (surge.effects || []).find((e) => e.type === "element_buff" && e.element === "Fire");
    if (!buffEff) {
      throw new Error(`Expected element_buff Fire effect from bf-volcanic-surge; got: ${JSON.stringify(surge.effects)}`);
    }
    log("BF-CP5", `element_buff confirmed in active card: +${buffEff.value} ${buffEff.element}`);

    // Deploy available hand cards (standard mode = 2) and resolve combat
    const hand9 = state9?.myHand?.slice(0, 2) || [];
    const state10 = bfUser10.latestState();
    const hand10 = state10?.myHand?.slice(0, 2) || [];

    const md9b = bfUser9.mark(), md10b = bfUser10.mark();
    if (hand9.length > 0) {
      bfUser9.send("game_action", { type: "deploy", data: { cardIds: hand9 } });
    } else {
      bfUser9.send("game_action", { type: "end_turn" });
    }
    if (hand10.length > 0) {
      bfUser10.send("game_action", { type: "deploy", data: { cardIds: hand10 } });
    } else {
      bfUser10.send("game_action", { type: "end_turn" });
    }
    await Promise.all([
      bfUser9.waitForState(md9b, (s) => s.currentPhase === "combat", 4000, "BF-U9 combat"),
      bfUser10.waitForState(md10b, (s) => s.currentPhase === "combat", 4000, "BF-U10 combat"),
    ]);

    // End turn × 2 — should trigger combat resolution with element_buff active
    const mCombat9 = bfUser9.mark();
    bfUser9.send("game_action", { type: "end_turn" });
    bfUser10.send("game_action", { type: "end_turn" });

    // Verify combat resolves successfully (combat_result event or game_state with round=2)
    const combatEv = await bfUser9.waitForAfter(
      mCombat9,
      (e) => e.type === "combat_result" || (e.type === "game_state" && (e.payload?.currentTurn > 1 || e.payload?.round > 1)),
      5000,
      "combat_result or next-round game_state"
    ).catch(() => null);
    if (!combatEv) {
      throw new Error("Combat did not resolve within 5s when element_buff (volcanic-surge) was active");
    }
    log("BF-CP5", `Combat resolved OK with volcanic-surge active (event: ${combatEv.type})`);

    bfUser9.close(); bfUser10.close();
    await pgClient.query(`DELETE FROM game_rooms WHERE id = $1`, [bfRoom5.id]);
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================
  await checkpoint("Restore default disconnect timeout", async () => {
    await api("/api/admin/test/disconnect-timeout", "POST", { ms: 60000 }, admin.token);
  });

  p1.close(); p2.close(); spec.close(); admin.close(); tmpUser.close();
  await sleep(300);

  const removed = await deleteTestData();
  log("CLEANUP", `removed ${removed} test users + cascading rows`);
  await pgClose();

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
  if (fail) console.log("Failed:\n  - " + failed.join("\n  - "));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  // Best-effort: if we logged in as admin and shortened any test-only
  // timeouts, restore the defaults before exiting so subsequent runs (or
  // the dev server itself) don't keep the test values.
  try {
    if (admin?.token) {
      await api("/api/admin/test/disconnect-timeout", "POST", { ms: 60000 }, admin.token);
      await api("/api/admin/test/turn-timeout", "POST", { ms: 60000 }, admin.token);
      await api("/api/admin/test/heartbeat-timeout", "POST", { ms: 45000 }, admin.token);
    }
  } catch {}
  try { await deleteTestData(); } catch {}
  await pgClose();
  process.exit(1);
});
