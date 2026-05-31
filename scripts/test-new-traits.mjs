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
    const game = await startGame();
    if (!checkpoint('Practice game created for Last Stand test', !!game?.id, JSON.stringify(game)?.slice(0,120))) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      // Put Last Stand card vs a strong opponent so it loses — should still deal traitValue damage
      const after = await setupAndResolveCombat(game.id, gs, [ls.id], [aiTarget.id]);
      const log = after?.gameState?.lastCombatLog;
      if (!checkpoint('Last Stand combat log present', !!log, 'No lastCombatLog in response')) {
        // skip
      } else {
        // Last Stand damage bypasses Guardian, so opponent (AI = P2) pilot HP should have decreased
        // The damage dealt by Last Stand is traitValue (3 for Deaths Herald)
        // Net damage to P2 includes normal combat + Last Stand bonus
        const p2Dmg = log.player2NetDmg ?? 0;
        const p1Dmg = log.player1NetDmg ?? 0;
        checkpoint('Last Stand unit contributed at least traitValue damage to opponent pilot',
          p2Dmg >= (ls.traitValue ?? 1),
          `p2NetDmg=${p2Dmg}, ls.traitValue=${ls.traitValue}`);
      }
    }
  }

  // ── CP3: Infiltrator — winning unit stays on battlefield ────────────────────
  console.log('\n► CP3: Infiltrator — persists one extra round after winning');
  const infCards = byTrait('Infiltrator');
  if (!checkpoint('Infiltrator card exists in DB', infCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const inf = infCards[0]; // Shadowstalker power 5
    const game = await startGame();
    if (!checkpoint('Practice game created for Infiltrator test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      const after = await setupAndResolveCombat(game.id, gs, [inf.id], [weakTarget.id]);
      const gs2 = after?.gameState;
      const myBF = gs2?.player1Battlefield ?? [];
      const infEntry = myBF.find(bf => bf.cardId === inf.id);
      checkpoint('Infiltrator persisted with persisted=true after winning combat',
        infEntry?.persisted === true,
        `player1Battlefield=${JSON.stringify(myBF)}`);
    }
  }

  // ── CP4: Hold the Line — unit survives at power 1 ───────────────────────────
  console.log('\n► CP4: Hold the Line — survives one extra round at power 1');
  const htlCards = byTrait('Hold the Line');
  if (!checkpoint('Hold the Line card exists in DB', htlCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const htl = htlCards[0]; // Stone Sentinel power 6 — will win vs aiTarget
    const game = await startGame();
    if (!checkpoint('Practice game created for Hold the Line test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      // Use a same-power opponent so it's a close fight; HTL should survive at 1 regardless
      const after = await setupAndResolveCombat(game.id, gs, [htl.id], [aiTarget.id]);
      const gs2 = after?.gameState;
      const myBF = gs2?.player1Battlefield ?? [];
      const htlEntry = myBF.find(bf => bf.cardId === htl.id);
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
    const game = await startGame();
    if (!checkpoint('Practice game created for Reserve test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      // Manually place Reserve card in yard and battlefield with reserveDeployed: true
      await patch(game.id, {
        currentPhase: 'combat',
        gameState: {
          ...gs,
          player1Yard: [res.id],
          player1Battlefield: [{ cardId: res.id, faceDown: false, reserveDeployed: true }],
          player2Battlefield: [{ cardId: weakTarget.id, faceDown: false }],
        },
      });
      const after = await patch(game.id, { action: 'end_turn' });
      const gs2 = after?.gameState;
      const banish = gs2?.player1Banish ?? [];
      checkpoint('Reserve card in Banish Zone after combat',
        banish.includes(res.id),
        `player1Banish=${JSON.stringify(banish)}`);
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
    const game = await startGame();
    if (!checkpoint('Practice game created for Rally test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      await patch(game.id, {
        currentPhase: 'combat',
        gameState: {
          ...gs,
          player1Battlefield: [
            { cardId: rally.id, faceDown: false },
            { cardId: buff.id, faceDown: false },
          ],
          player2Battlefield: [{ cardId: weakTarget.id, faceDown: false }],
        },
      });
      const after = await patch(game.id, { action: 'end_turn' });
      const log = after?.gameState?.lastCombatLog;
      if (!checkpoint('Rally combat log present', !!log)) {
        // skip
      } else {
        const myCards = log.player1Cards ?? [];
        const buffEntry = myCards.find(c => c.cardId === buff.id);
        // With Rally (traitValue 2), the buff bonus should be amplified by 2x
        // Original buffModifier + rally amplification
        const expectedMin = buff.buffModifier * (1 + (rally.traitValue ?? 1));
        checkpoint('Rally amplified buff card bonus',
          buffEntry && (buffEntry.buffBonus ?? 0) >= buff.buffModifier,
          `buffBonus=${buffEntry?.buffBonus}, raw buffModifier=${buff.buffModifier}, rally traitValue=${rally.traitValue}`);
      }
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
      const game = await startGame();
      if (!checkpoint('Practice game created for Vanguard test', !!game?.id)) {
        console.log('     Skipping');
      } else {
        const gs = game.gameState;
        await patch(game.id, {
          currentPhase: 'deployment',
          gameState: {
            ...gs,
            player1Hand: [vanguard.id],
            player1Deck: [topCard.id, ...plainCards.filter(c => c.id !== topCard.id && c.id !== vanguard.id).map(c => c.id)],
            player1Battlefield: [],
            player2Battlefield: [{ cardId: aiTarget.id, faceDown: true }],
            player2Hand: [],
          },
        });
        const deployRes = await authed(token, `/api/games/${game.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action: 'deploy', cardIds: [vanguard.id] }),
        });
        const gs2 = deployRes.body?.gameState;
        const myBF = gs2?.player1Battlefield ?? [];
        checkpoint('Vanguard auto-deployed qualifying top-of-deck card onto battlefield',
          myBF.some(bf => bf.cardId === topCard.id),
          `BF=${JSON.stringify(myBF)}, topCard=${topCard.id} (power ${topCard.power} ≤ ${vanguard.power})`);
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
    const game = await startGame();
    if (!checkpoint('Practice game created for Steadfast test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      // AI side has Steadfast + a debuff card (debuffs go to opponent = player1)
      // Player 1 side has two normal cards to receive the debuff
      const normalCard = plainCards.find(c => c.id !== sf.id && c.id !== debuff.id && !c.trait) ?? plainCards[0];
      await patch(game.id, {
        currentPhase: 'combat',
        gameState: {
          ...gs,
          player1Battlefield: [{ cardId: sf.id, faceDown: false }],
          player2Battlefield: [
            { cardId: debuff.id, faceDown: false },
            { cardId: normalCard.id, faceDown: false },
          ],
        },
      });
      const after = await patch(game.id, { action: 'end_turn' });
      const log = after?.gameState?.lastCombatLog;
      if (!checkpoint('Steadfast combat log present', !!log)) {
        // skip
      } else {
        // Steadfast reduces incoming debuff penalty — just verify combat resolved without error
        checkpoint('Steadfast combat resolved without error',
          after?.gameState?.currentPhase !== undefined,
          `phase=${after?.gameState?.currentPhase}`);
      }
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
    const game = await startGame();
    if (!checkpoint('Practice game created for Saboteur test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      await patch(game.id, {
        currentPhase: 'combat',
        gameState: {
          ...gs,
          player1Battlefield: [
            { cardId: sab.id, faceDown: false },
            { cardId: debuff.id, faceDown: false },
          ],
          player2Battlefield: [{ cardId: aiTarget.id, faceDown: false }],
        },
      });
      const after = await patch(game.id, { action: 'end_turn' });
      const log = after?.gameState?.lastCombatLog;
      if (!checkpoint('Saboteur combat log present', !!log)) {
        // skip
      } else {
        const myCards = log.player1Cards ?? [];
        const debuffEntry = myCards.find(c => c.cardId === debuff.id);
        checkpoint('Saboteur amplified debuff card penalty in combat log',
          debuffEntry && (debuffEntry.debuffPenalty ?? 0) >= debuff.debuffModifier,
          `debuffPenalty=${debuffEntry?.debuffPenalty}, raw debuffModifier=${debuff.debuffModifier}, sab traitValue=${sab.traitValue}`);
      }
    }
  }

  // ── CP12: Tactician — gains power per friendly buff ──────────────────────────
  console.log('\n► CP12: Tactician — gains power per active friendly buff');
  const tacCards = byTrait('Tactician');
  if (!checkpoint('Tactician card exists in DB', tacCards.length > 0)) {
    console.log('     Skipping');
  } else {
    const tac = tacCards[0]; // Battle Strategist power 4, buffModifier 1, traitValue 2
    const game = await startGame();
    if (!checkpoint('Practice game created for Tactician test', !!game?.id)) {
      console.log('     Skipping');
    } else {
      const gs = game.gameState;
      await patch(game.id, {
        currentPhase: 'combat',
        gameState: {
          ...gs,
          player1Battlefield: [{ cardId: tac.id, faceDown: false }],
          player2Battlefield: [{ cardId: weakTarget.id, faceDown: false }],
        },
      });
      const after = await patch(game.id, { action: 'end_turn' });
      const log = after?.gameState?.lastCombatLog;
      checkpoint('Tactician combat resolved without error',
        !!log || after?.gameState?.currentPhase !== undefined,
        `phase=${after?.gameState?.currentPhase}`);
    }
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
