#!/usr/bin/env node
import WebSocket from "ws";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const WS_BASE = BASE.replace(/^http/, "ws");

const log = (tag, ...args) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] ${tag}`, ...args);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

class TestClient {
  constructor(label) { this.label = label; this.events = []; }

  async login(email) {
    log(this.label, `login as ${email}`);
    const r = await api("/api/mobile/auth/login", "POST", {
      email, firstName: this.label, lastName: "Test",
    });
    this.token = r.token;
    this.userId = r.user.id;
    this.email = r.user.email;
    log(this.label, `userId=${this.userId}`);
  }

  async getDecks() {
    const decks = await api("/api/user-decks", "GET", null, this.token);
    this.deck = decks[0];
    if (!this.deck) throw new Error(`${this.label} has no decks!`);
    log(this.label, `deck "${this.deck.name}" (${this.deck.cardIds?.length} cards)`);
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
        } catch (e) {}
      });
      this.ws.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
  }

  send(type, payload) { this.ws.send(JSON.stringify({ type, payload })); }

  // Snapshot event count NOW so we only look at events arriving after this point.
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

  latestState() { return this.events.findLast(e => e.type === "game_state")?.payload; }

  close() { try { this.ws?.close(); } catch {} }
}

async function main() {
  console.log("\n=== Multiplayer End-to-End Test ===\n");
  const stamp = Date.now();
  const p1 = new TestClient("P1");
  const p2 = new TestClient("P2");

  let pass = 0, fail = 0;
  const checkpoint = async (label, fn) => {
    try { await fn(); log("PASS", label); pass++; }
    catch (e) { log("FAIL", label, "→", e.message); fail++; throw e; }
  };

  let roomId, gameId;
  try {
    await checkpoint("1. Both players authenticate (mobile JWT)", async () => {
      await Promise.all([
        p1.login(`mp-test-p1-${stamp}@test.local`),
        p2.login(`mp-test-p2-${stamp}@test.local`),
      ]);
    });

    await checkpoint("2. Both have starter decks", async () => {
      await Promise.all([p1.getDecks(), p2.getDecks()]);
    });

    await checkpoint("3. Both connect WebSocket via JWT", async () => {
      await Promise.all([p1.connectWS(), p2.connectWS()]);
    });

    await checkpoint("4. P1 creates room", async () => {
      const room = await api("/api/rooms", "POST", { name: `Test ${stamp}` }, p1.token);
      roomId = room.id;
    });

    await checkpoint("5. P2 joins room via API (becomes guest)", async () => {
      const r = await api(`/api/rooms/${roomId}/join`, "POST", {}, p2.token);
      if (r.guestId !== p2.userId) throw new Error("guestId mismatch");
    });

    await checkpoint("6. Both join room over WS (no auth error)", async () => {
      const m1 = p1.mark(); const m2 = p2.mark();
      p1.send("join_room", { roomId });
      p2.send("join_room", { roomId });
      await sleep(300);
      const errs = [...p1.events.slice(m1), ...p2.events.slice(m2)].filter(e => e.type === "error");
      if (errs.length) throw new Error("WS join_room error: " + JSON.stringify(errs));
    });

    await checkpoint("7. Both ready up with deck selected", async () => {
      await api(`/api/rooms/${roomId}/ready`, "POST", { ready: true, deckId: p1.deck.id }, p1.token);
      await api(`/api/rooms/${roomId}/ready`, "POST", { ready: true, deckId: p2.deck.id }, p2.token);
      const r = await api(`/api/rooms/${roomId}`, "GET", null, p1.token);
      if (!r.hostReady || !r.guestReady) throw new Error("not both ready");
    });

    await checkpoint("8. P1 starts game (server creates engine state)", async () => {
      const game = await api(`/api/rooms/${roomId}/start`, "POST", {}, p1.token);
      gameId = game.id;
      log("GAME", `gameId=${gameId} phase=${game.currentPhase} HP=${game.player1HP}/${game.player2HP}`);
      if (game.status !== "in_progress") throw new Error(`status=${game.status}`);
    });

    await checkpoint("9. Both join game over WS (initial game_state)", async () => {
      const m1 = p1.mark(); const m2 = p2.mark();
      p1.send("join_game", { gameId });
      p2.send("join_game", { gameId });
      await Promise.all([
        p1.waitForAfter(m1, e => e.type === "game_state", 3000, "P1 game_state"),
        p2.waitForAfter(m2, e => e.type === "game_state", 3000, "P2 game_state"),
      ]);
      const s1 = p1.latestState(); const s2 = p2.latestState();
      log("STATE", `P1: hand=${s1.myHand.length} HP=${s1.myHP} phase=${s1.currentPhase} turn=${s1.currentTurn} isP1=${s1.isPlayer1}`);
      log("STATE", `P2: hand=${s2.myHand.length} HP=${s2.myHP} phase=${s2.currentPhase} turn=${s2.currentTurn} isP1=${s2.isPlayer1}`);
      if (s1.myHand.length !== 5 || s2.myHand.length !== 5) throw new Error("starting hand wrong");
      if (s1.currentPhase !== "draw") throw new Error(`expected draw phase, got ${s1.currentPhase}`);
      if (s1.currentTurn !== 1) throw new Error(`expected turn 1, got ${s1.currentTurn}`);
    });

    await checkpoint("10. Both players draw (advances phase to deployment)", async () => {
      const m1 = p1.mark();
      p1.send("game_action", { gameId, action: "draw" });
      const r1 = await p1.waitForAfter(m1, e => e.type === "game_state" && e.payload.myHasDrawn, 3000, "P1 drew");
      log("DRAW", `P1 hand=${r1.payload.myHand.length} hasDrawn=${r1.payload.myHasDrawn} phase=${r1.payload.currentPhase}`);
      if (r1.payload.myHand.length !== 7) throw new Error(`P1 hand should be 7 (drew 2), got ${r1.payload.myHand.length}`);

      const m2 = p2.mark();
      p2.send("game_action", { gameId, action: "draw" });
      const r2 = await p2.waitForAfter(m2, e => e.type === "game_state" && e.payload.myHasDrawn, 3000, "P2 drew");
      log("DRAW", `P2 hand=${r2.payload.myHand.length} hasDrawn=${r2.payload.myHasDrawn} phase=${r2.payload.currentPhase}`);
      if (r2.payload.myHand.length !== 7) throw new Error(`P2 hand should be 7, got ${r2.payload.myHand.length}`);
      if (r2.payload.currentPhase !== "deployment") throw new Error(`expected deployment phase after both draw, got ${r2.payload.currentPhase}`);
    });

    await checkpoint("11. Both deploy 2 cards (standard mode)", async () => {
      // Use latest state AFTER draw so we have current hands
      const s1 = p1.latestState(); const s2 = p2.latestState();
      const cards1 = s1.myHand.slice(0, 2);
      const cards2 = s2.myHand.slice(0, 2);
      log("DEPLOY", `P1 deploying [${cards1.join(", ")}]`);
      log("DEPLOY", `P2 deploying [${cards2.join(", ")}]`);

      const m1 = p1.mark();
      p1.send("game_action", { gameId, action: "deploy", data: { cardIds: cards1 } });
      const r1 = await p1.waitForAfter(m1, e => (e.type === "game_state" && e.payload.myHasDeployed) || e.type === "game_error", 3000, "P1 deploy");
      if (r1.type === "game_error") throw new Error("P1 deploy: " + JSON.stringify(r1.payload));
      log("DEPLOY", `P1 battlefield=${r1.payload.myBattlefield.length} hand=${r1.payload.myHand.length}`);

      const m2 = p2.mark();
      p2.send("game_action", { gameId, action: "deploy", data: { cardIds: cards2 } });
      const r2 = await p2.waitForAfter(m2, e => (e.type === "game_state" && e.payload.myHasDeployed) || e.type === "game_error", 3000, "P2 deploy");
      if (r2.type === "game_error") throw new Error("P2 deploy: " + JSON.stringify(r2.payload));
      log("DEPLOY", `P2 battlefield=${r2.payload.myBattlefield.length} hand=${r2.payload.myHand.length} phase=${r2.payload.currentPhase}`);
    });

    await checkpoint("12. State isolation: neither player can see the other's hand", async () => {
      const s1 = p1.latestState(); const s2 = p2.latestState();
      // P1's view should expose its own hand but only opponent COUNT, not contents
      if (s1.opponentHand !== undefined || s1.opponentDeck !== undefined) {
        throw new Error("P1 sees opponent hand/deck contents — state leak!");
      }
      if (s2.opponentHand !== undefined || s2.opponentDeck !== undefined) {
        throw new Error("P2 sees opponent hand/deck contents — state leak!");
      }
      if (typeof s1.opponentHandCount !== "number" || typeof s2.opponentHandCount !== "number") {
        throw new Error("opponentHandCount missing");
      }
      // Battlefield cards face-down during deployment should be hidden (cardId === "hidden")
      log("ISOLATION", `P1 sees only opponentHandCount=${s1.opponentHandCount}, opponentDeckCount=${s1.opponentDeckCount}`);
    });

    await checkpoint("13. Both end turn → combat resolves → new turn starts", async () => {
      const m1 = p1.mark(); const m2 = p2.mark();
      p1.send("game_action", { gameId, action: "end_turn" });
      p2.send("game_action", { gameId, action: "end_turn" });

      // Wait for combat_result on either player
      const combat = await p1.waitForAfter(m1, e => e.type === "combat_result", 4000, "combat_result");
      log("COMBAT", `winner=${combat.payload.winner} damage=${combat.payload.damage} P1cards=${combat.payload.player1Breakdown?.length} P2cards=${combat.payload.player2Breakdown?.length}`);

      // Wait for fresh game_state advancing to turn 2
      await sleep(300);
      const s1 = p1.latestState(); const s2 = p2.latestState();
      log("TURN2", `P1: HP=${s1.myHP} VP=${s1.myVP} phase=${s1.currentPhase} turn=${s1.currentTurn} hand=${s1.myHand.length}`);
      log("TURN2", `P2: HP=${s2.myHP} VP=${s2.myVP} phase=${s2.currentPhase} turn=${s2.currentTurn} hand=${s2.myHand.length}`);
      if (s1.currentTurn !== 2) throw new Error(`expected turn 2, got ${s1.currentTurn}`);
      if (s1.currentPhase !== "draw") throw new Error(`expected draw phase, got ${s1.currentPhase}`);
      if (s1.myHasDrawn || s1.myHasDeployed || s1.myTurnEnded) throw new Error("turn flags not reset");
    });

    await checkpoint("14. P2 forfeits → game ends with P1 winning", async () => {
      const m1 = p1.mark();
      p2.send("game_action", { gameId, action: "forfeit" });
      const ev = await p1.waitForAfter(m1, e => e.type === "game_over", 4000, "game_over for P1");
      log("END", `winnerId=${ev.payload.winnerId} (${ev.payload.winnerId === p1.userId ? "P1 ✓" : "P2 ✗"}) reason=${ev.payload.reason}`);
      if (ev.payload.winnerId !== p1.userId) throw new Error("Expected P1 to win");
    });

    await checkpoint("15. Game persisted to DB with winner", async () => {
      const game = await api(`/api/games/${gameId}`, "GET", null, p1.token);
      log("DB", `status=${game.status} winnerId=${game.winnerId === p1.userId ? "P1" : game.winnerId === p2.userId ? "P2" : "?"}`);
      if (game.status !== "completed") throw new Error(`status=${game.status}`);
      if (game.winnerId !== p1.userId) throw new Error("DB winner wrong");
    });

  } catch (e) {
    log("ABORT", "stopped:", e.message);
  } finally {
    p1.close(); p2.close();
    await sleep(200);
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
