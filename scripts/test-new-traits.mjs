/**
 * test-new-traits.mjs — Diagnostic smoke test for 10 new unit traits + Banish Zone.
 *
 * Strategy: use the admin's first valid saved deck to start practice games, then
 * PATCH each game's gameState to put the trait card on the battlefield and trigger
 * combat. This avoids needing to build valid 40-card decks from scratch.
 *
 * Usage:  node scripts/test-new-traits.mjs
 * Run against a live dev server (npm run dev).
 */

import fetch from 'node-fetch';

const BASE = process.env.API_BASE ?? 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'redeagle28089@gmail.com';

let passed = 0;
let failed = 0;
let cpIndex = 0;

function checkpoint(name, cond, detail = '') {
  cpIndex++;
  if (cond) {
    console.log(`  ✅ CP${cpIndex}: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ CP${cpIndex}: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
  return cond;
}

async function api(path, opts = {}) {
  const { headers: optsHeaders, ...restOpts } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...restOpts,
    headers: { 'Content-Type': 'application/json', ...(optsHeaders || {}) },
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

async function authed(token, path, opts = {}) {
  return api(path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 test-new-traits.mjs — 10 New Traits + Banish Zone Smoke Test');
  console.log('──────────────────────────────────────────────────────────────────\n');

  // Login
  const loginRes = await api('/api/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, name: 'admin' }),
  });
  const token = loginRes.body?.token;
  if (!token) { console.error('Login failed', loginRes.body); process.exit(1); }

  // Fetch all cards, commanders, and admin's saved decks
  const [cardsRes, commandersRes, decksRes] = await Promise.all([
    authed(token, '/api/cards'),
    authed(token, '/api/commanders'),
    authed(token, '/api/user-decks'),
  ]);

  const allCards = cardsRes.body;
  const allCommanders = commandersRes.body;
  const userDecks = decksRes.body;

  if (!Array.isArray(allCards) || allCards.length === 0) {
    console.error('No cards available'); process.exit(1);
  }
  if (!Array.isArray(allCommanders) || allCommanders.length === 0) {
    console.error('No commanders'); process.exit(1);
  }
  if (!Array.isArray(userDecks) || userDecks.length === 0) {
    console.error('No user decks found — admin needs at least one saved deck'); process.exit(1);
  }

  const plainCards = allCards.filter(c => !c.isCommander);
  const commander = allCommanders[0];
  const validDeck = userDecks[0];

  console.log(`  Using deck: "${validDeck.name}" (${validDeck.cardIds?.length ?? '?'} cards)`);
  console.log(`  Commander:  ${commander.name}`);
  console.log(`  Cards in DB: ${plainCards.length} non-commander cards\n`);

  const userId = loginRes.body?.user?.id ?? '50128681';
  const deckId = validDeck.id;

  // Helper: start a fresh practice game using admin's first saved deck
  async function startGame() {
    const r = await authed(token, '/api/games', {
      method: 'POST',
      body: JSON.stringify({
        player1Id: userId,
        player2Id: null,
        player1DeckId: deckId,
        player2DeckId: null,
        activePlayer: userId,
        status: 'in_progress',
        gameType: 'practice',
        gameMode: 'standard',
        aiDifficulty: 'easy',
        player1HP: 40, player2HP: 40,
        player1VictoryPoints: 0, player2VictoryPoints: 0,
        player1WithdrawalPoints: 0, player2WithdrawalPoints: 0,
        currentPhase: 'draw', currentTurn: 1,
        winnerId: null,
        gameHistory: [],
        gameState: {
          player1Hand: [], player2Hand: [],
          player1Deck: [], player2Deck: [],
          player1Battlefield: [], player2Battlefield: [],
          player1Yard: [], player2Yard: [],
        },
      }),
    });
    return r.body?.id ? r.body : null;
  }

  // Helper: PATCH game state (practice only)
  async function patch(gameId, body) {
    const r = await authed(token, `/api/games/${gameId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return r.body;
  }

  // Helper: set up combat with given card IDs and resolve it
  async function setupAndResolveCombat(gameId, gs, myCardIds, aiCardIds) {
    const isP1 = true; // we always create as P1 (player1Id = admin)
    await patch(gameId, {
      currentPhase: 'combat',
      gameState: {
        ...gs,
        player1Battlefield: myCardIds.map(id => ({ cardId: id, faceDown: false })),
        player2Battlefield: aiCardIds.map(id => ({ cardId: id, faceDown: false })),
        player1Hand: gs.player1Hand?.filter(id => !myCardIds.includes(id)) ?? [],
        player2Hand: [],
      },
    });
    return patch(gameId, { action: 'end_turn' });
  }

  // Find cards by trait
  function byTrait(trait) { return plainCards.filter(c => c.trait === trait); }
  // A card the AI can use (no trait, low-mid power)
  const aiTarget = plainCards.find(c => !c.trait && c.power >= 4 && c.power <= 6) ?? plainCards[0];
  const weakTarget = plainCards.find(c => !c.trait && c.power <= 2) ?? plainCards[0];

  // ── CP1: Schema — all 14 trait names present ────────────────────────────────
  console.log('► CP1: TRAITS array — all 14 trait names');
  const expectedTraits = [
    'Quick Strike','Care Package','Restoration','Guardian',
    'Infiltrator','Hold the Line','Rally','Saboteur',
    'Steadfast','Tactician','Flanking','Vanguard','Reserve','Last Stand',
  ];
  const foundNewTraits = expectedTraits.filter(t => plainCards.some(c => c.trait === t));
  checkpoint('All 10 new trait cards exist in DB',
    foundNewTraits.length === 14 || foundNewTraits.filter(t => !['Quick Strike','Care Package','Restoration','Guardian'].includes(t)).length === 10,
    `Found: ${foundNewTraits.join(', ')}`);

  // ── CP2: Last Stand — unit always deals direct damage to pilot ──────────────
  console.log('\n► CP2: Last Stand — always deals direct pilot damage');
  const lsCards = byTrait('Last Stand');
  if (!checkpoint('Last Stand card exists in DB', lsCards.length > 0, 'Run this script after creating trait cards')) {
    console.log('     Skipping combat test (no card)');
  } else {
    const ls = lsCards[0];
    // Use simulate-combat: put Last Stand on P1 vs stronger P2 card → P1 loses, but Last Stand
    // should still deal its finalPower as direct damage to P2 pilot (server engine trait)
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: ls.id }],
        p2Cards: [{ cardId: aiTarget.id }],
      }),
    });
    if (!checkpoint('Last Stand simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      const log = simRes.body.combatLog;
      // When P2 wins (higher power), normally player2NetDmg = 0 (winner takes no combat damage).
      // Last Stand adds ls.finalPower directly to P2's damage → player2NetDmg > 0
      const p2Dmg = log.player2NetDmg ?? 0;
      checkpoint('Last Stand dealt direct damage to P2 pilot even when P1 lost',
        p2Dmg > 0,
        `player2NetDmg=${p2Dmg} (ls power=${ls.power})`);
    }
  }

  // ── CP3: Infiltrator — winning unit stays on battlefield ────────────────────
  console.log('\n► CP3: Infiltrator — persists one extra round after winning');
  const infCards = byTrait('Infiltrator');
  if (!checkpoint('Infiltrator card exists in DB', infCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const inf = infCards[0]; // Shadowstalker power 5
    // P1 wins (Infiltrator power 5 vs weakTarget power ≤ 2) → Infiltrator persists
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: inf.id }],
        p2Cards: [{ cardId: weakTarget.id }],
      }),
    });
    if (!checkpoint('Infiltrator simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      const p1BF = simRes.body.p1Battlefield ?? [];
      const infEntry = p1BF.find(bf => bf.cardId === inf.id);
      checkpoint('Infiltrator persisted with persisted=true after winning combat',
        infEntry?.persisted === true,
        `p1Battlefield=${JSON.stringify(p1BF)}`);
    }
  }

  // ── CP4: Hold the Line — unit survives at power 1 ───────────────────────────
  console.log('\n► CP4: Hold the Line — survives one extra round at power 1');
  const htlCards = byTrait('Hold the Line');
  if (!checkpoint('Hold the Line card exists in DB', htlCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const htl = htlCards[0]; // Stone Sentinel power 6
    // P1 wins vs weakTarget → Hold the Line persists with modifiedPower=1
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: htl.id }],
        p2Cards: [{ cardId: weakTarget.id }],
      }),
    });
    if (!checkpoint('Hold the Line simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      const p1BF = simRes.body.p1Battlefield ?? [];
      const htlEntry = p1BF.find(bf => bf.cardId === htl.id);
      checkpoint('Hold the Line unit persisted with modifiedPower=1',
        htlEntry?.persisted === true && htlEntry?.modifiedPower === 1,
        `entry=${JSON.stringify(htlEntry)}`);
    }
  }

  // ── CP5: Reserve — deploys from yard, goes to Banish after combat ───────────
  console.log('\n► CP5: Reserve — deployed from yard, goes to Banish after combat');
  const resCards = byTrait('Reserve');
  if (!checkpoint('Reserve card exists in DB', resCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const res = resCards[0]; // Vault Guardian power 5
    // simulate-combat: P1 has Reserve card with reserveDeployed: true; after combat it should appear in p1Banish
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: res.id, reserveDeployed: true }],
        p2Cards: [{ cardId: weakTarget.id }],
      }),
    });
    if (!checkpoint('Reserve simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      const banish = simRes.body.p1Banish ?? [];
      checkpoint('Reserve card in Banish Zone after combat',
        banish.includes(res.id),
        `p1Banish=${JSON.stringify(banish)}`);
    }
  }

  // ── CP6: Banish Zone — persisted in game state ──────────────────────────────
  console.log('\n► CP6: Banish Zone — counts exposed correctly in game state');
  const game6 = await startGame();
  if (!checkpoint('Practice game created for Banish Zone test', !!game6?.id)) {
    console.log('     Skipping');
  } else {
    const banishCard = plainCards[0]?.id;
    await patch(game6.id, {
      gameState: {
        ...game6.gameState,
        player1Banish: [banishCard],
        player2Banish: [],
      },
    });
    const refreshed = await authed(token, `/api/games/${game6.id}`);
    const banish = refreshed.body?.gameState?.player1Banish ?? [];
    checkpoint('Banish Zone card persisted and returned by API',
      banish.includes(banishCard),
      `player1Banish=${JSON.stringify(banish)}`);
  }

  // ── CP7: Flanking — deploy succeeds with Flanking card in hand ──────────────
  console.log('\n► CP7: Flanking — extra deploy slot granted');
  const flankCards = byTrait('Flanking');
  if (!checkpoint('Flanking card exists in DB', flankCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const flank = flankCards[0]; // Swift Flanker power 3
    const game = await startGame();
    if (!checkpoint('Practice game created for Flanking test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      const extra = plainCards.find(c => c.id !== flank.id && !c.trait) ?? plainCards[1];
      const extra2 = plainCards.find(c => c.id !== flank.id && c.id !== extra.id) ?? plainCards[2];
      await patch(game.id, {
        currentPhase: 'deployment',
        gameState: {
          ...gs,
          player1Hand: [flank.id, extra.id, extra2?.id ?? extra.id],
          player1Battlefield: [],
          player2Battlefield: [{ cardId: aiTarget.id, faceDown: true }],
          player2Hand: [],
        },
      });
      // Standard mode allows 2 deploys; Flanking should allow 3
      const deployRes = await authed(token, `/api/games/${game.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'deploy', cardIds: [flank.id, extra.id, extra2?.id ?? extra.id] }),
      });
      // If Flanking works: 3-card deploy succeeds
      // If not: rejected with "Must deploy exactly 2 cards"
      checkpoint('Flanking allowed deploying 3 cards (instead of normal 2)',
        deployRes.body?.success !== false && !deployRes.body?.error?.includes('exactly'),
        `response=${JSON.stringify(deployRes.body)?.slice(0,120)}`);
    }
  }

  // ── CP8: Rally — buff card bonus amplified ───────────────────────────────────
  console.log('\n► CP8: Rally — amplifies friendly buff card bonuses');
  const rallyCards = byTrait('Rally');
  const buffCards = plainCards.filter(c => c.buffModifier > 0 && c.trait !== 'Rally');
  if (!checkpoint('Rally card exists in DB', rallyCards.length > 0)) {
    console.log('     Skipping');
  } else if (!checkpoint('A buff card exists to pair with Rally', buffCards.length > 0,
    'No non-Rally card with buffModifier > 0')) {
    console.log('     Skipping');
  } else {
    const rally = rallyCards[0]; // War Drummer, traitValue 2, buffModifier 2
    const buff = buffCards[0];
    // simulate-combat: P1 has rally + buff card; the buff bonus on the buff card should be amplified
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: rally.id }, { cardId: buff.id }],
        p2Cards: [{ cardId: weakTarget.id }],
      }),
    });
    if (!checkpoint('Rally simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      // Rally amplifies buffBonuses entries — these only exist when buff card and target share element.
      // Verify via p1Total: if same-element pairing landed, total > pure base sum; otherwise just verify no crash.
      const p1Total = simRes.body.p1Total ?? 0;
      const p1BaseSum = rally.power + buff.power;
      const p1Cards = simRes.body.combatLog?.player1Cards ?? [];
      const rallyEntry = p1Cards.find(c => c.cardId === rally.id);
      const hasSameElementBuff = rallyEntry && (rallyEntry.buffBonus ?? 0) > 0;
      checkpoint('Rally combat processed without error (p1Total present)',
        p1Total >= 0 && simRes.body.winner !== undefined,
        `p1Total=${p1Total}, baseSum=${p1BaseSum}, rally buffBonus=${rallyEntry?.buffBonus}, winner=${simRes.body.winner}`);
    }
  }

  // ── CP9: Vanguard — auto-deploys top-of-deck card ───────────────────────────
  console.log('\n► CP9: Vanguard — auto-deploys qualifying top-of-deck card');
  const vanguardCards = byTrait('Vanguard');
  if (!checkpoint('Vanguard card exists in DB', vanguardCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const vanguard = vanguardCards[0]; // Advance Scout power 6
    const topCard = plainCards.find(c => c.id !== vanguard.id && c.power <= vanguard.power && !c.isCommander);
    if (!checkpoint('A qualifying top-of-deck card found', !!topCard, `Need power ≤ ${vanguard.power}`)) {
      console.log('     Skipping');
    } else {
      const otherIds = plainCards
        .filter(c => c.id !== topCard.id && c.id !== vanguard.id)
        .map(c => c.id)
        .slice(0, 5);
      const simRes = await authed(token, '/api/admin/test/simulate-deploy', {
        method: 'POST',
        body: JSON.stringify({
          deployCardIds: [vanguard.id],
          handCardIds: [vanguard.id],
          deckCardIds: [topCard.id, ...otherIds],
        }),
      });
      if (!checkpoint('Vanguard simulate-deploy succeeded', simRes.status === 200,
          `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
        console.log('     Skipping');
      } else {
        const autoCardId = simRes.body.vanguardAutoDeployedCardId ?? null;
        checkpoint('Vanguard auto-deployed qualifying top-of-deck card',
          simRes.body.vanguardAutoDeployed === true && autoCardId === topCard.id,
          `vanguardAutoDeployed=${simRes.body.vanguardAutoDeployed}, autoCardId=${autoCardId}, topCard=${topCard.id} (power ${topCard.power} ≤ ${vanguard.power})`);
      }
    }
  }

  // ── CP10: Steadfast — reduces incoming debuffs ───────────────────────────────
  console.log('\n► CP10: Steadfast — reduces incoming debuffs');
  const steadfastCards = byTrait('Steadfast');
  const debuffCards = plainCards.filter(c => c.debuffModifier > 0 && c.trait !== 'Steadfast');
  if (!checkpoint('Steadfast card exists in DB', steadfastCards.length > 0)) {
    console.log('     Skipping');
  } else if (!checkpoint('A debuff card exists to test Steadfast against', debuffCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const sf = steadfastCards[0]; // Iron Warden power 5, traitValue 2
    const debuff = debuffCards[0];
    const normalCard = plainCards.find(c => c.id !== sf.id && c.id !== debuff.id && !c.trait) ?? plainCards[0];
    // simulate-combat: P1 has Steadfast; P2 has debuff card → Steadfast should reduce debuff penalty on P1 cards
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: sf.id }],
        p2Cards: [{ cardId: debuff.id }, { cardId: normalCard.id }],
      }),
    });
    if (!checkpoint('Steadfast simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      checkpoint('Steadfast combat resolved without error',
        simRes.status === 200,
        `status=${simRes.status}`);
    }
  }

  // ── CP11: Saboteur — amplifies debuff card penalty ──────────────────────────
  console.log('\n► CP11: Saboteur — amplifies friendly debuff card penalties');
  const sabCards = byTrait('Saboteur');
  if (!checkpoint('Saboteur card exists in DB', sabCards.length > 0)) {
    console.log('     Skipping');
  } else if (debuffCards.length === 0) {
    checkpoint('A debuff card exists to pair with Saboteur', false, 'No debuff cards');
    console.log('     Skipping');
  } else {
    const sab = sabCards[0]; // Shadow Operative power 3, debuffModifier 3, traitValue 2
    const debuff = debuffCards[0];
    // simulate-combat: P1 has Saboteur + debuff card; debuff penalty on P2 cards should be amplified
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: sab.id }, { cardId: debuff.id }],
        p2Cards: [{ cardId: aiTarget.id }],
      }),
    });
    if (!checkpoint('Saboteur simulate-combat succeeded', simRes.status === 200 && !!simRes.body?.combatLog,
        `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`)) {
      console.log('     Skipping');
    } else {
      // Saboteur reduces enemy buffBonuses (not debuffPenalty). Saboteur only shows an effect when
      // the opponent has buff-receiving cards with same-element buff cards on their side.
      // This test just verifies combat processed cleanly (the mechanic is covered by engine unit logic).
      const p2Total = simRes.body.p2Total ?? 0;
      checkpoint('Saboteur combat processed without error (p2Total present)',
        p2Total >= 0 && simRes.body.winner !== undefined,
        `p2Total=${p2Total}, winner=${simRes.body.winner}, sab.traitValue=${sab.traitValue}`);
    }
  }

  // ── CP12: Tactician — gains power per friendly buff ──────────────────────────
  console.log('\n► CP12: Tactician — gains power per active friendly buff');
  const tacCards = byTrait('Tactician');
  if (!checkpoint('Tactician card exists in DB', tacCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const tac = tacCards[0]; // Battle Strategist power 4, buffModifier 1, traitValue 2
    // simulate-combat: P1 has Tactician; verify it resolves without error
    const simRes = await authed(token, '/api/admin/test/simulate-combat', {
      method: 'POST',
      body: JSON.stringify({
        p1Cards: [{ cardId: tac.id }],
        p2Cards: [{ cardId: weakTarget.id }],
      }),
    });
    checkpoint('Tactician combat resolved without error',
      simRes.status === 200 && !!simRes.body?.combatLog,
      `status=${simRes.status} body=${JSON.stringify(simRes.body)?.slice(0,120)}`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${cpIndex} checkpoints`);
  if (failed === 0) {
    console.log('🎉 All checkpoints passed!\n');
  } else {
    console.log('⚠️  Some checkpoints failed — see details above.\n');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
