#!/usr/bin/env node
/**
 * Smoke test for the admin AI batch generator (task #57).
 *
 *   • Logs in as the admin via mobile JWT
 *   • Fetches the canonical allowed-effects list from the server
 *   • POSTs /api/admin/generate-cards for kind=unit and kind=commander
 *   • Asserts the server returned candidates and that every commander effect.type
 *     is in the implemented effect set the server itself reports
 *   • Saves one of each via /api/admin/generated-cards/save and confirms the row
 *     appears via GET /api/cards/:id or /api/commanders/:id
 *
 * Self-contained: imports nothing from `shared/` (which is TypeScript) so it
 * runs as plain Node. Requires: server on TEST_BASE_URL (default
 * http://localhost:5000) and the admin email account redeagle28089@gmail.com.
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "redeagle28089@gmail.com";
const STAMP = Date.now();

const log = (...args) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}]`, ...args);
};
let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    log(`PASS ${name}`);
  } else {
    failed++;
    log(`FAIL ${name}`, detail || "");
  }
}

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
  return { ok: res.ok, status: res.status, data };
}

function looksLikeUnitCandidate(c) {
  return c
    && typeof c.name === "string"
    && typeof c.element === "string"
    && Number.isInteger(c.power)
    && (c.trait === null || typeof c.trait === "string")
    && Number.isInteger(c.buffModifier)
    && Number.isInteger(c.debuffModifier);
}

function looksLikeCommanderCandidate(c) {
  return c
    && typeof c.name === "string"
    && typeof c.title === "string"
    && typeof c.element === "string"
    && Array.isArray(c.abilities)
    && c.abilities.length >= 1
    && c.abilities.every(
      (a) =>
        typeof a.name === "string" &&
        typeof a.phase === "string" &&
        Number.isFinite(a.victoryCost) &&
        Number.isFinite(a.withdrawalCost) &&
        a.effect &&
        typeof a.effect.type === "string"
    );
}

async function main() {
  log(`AI generator smoke test → ${BASE}`);

  // 1. Admin login
  const loginRes = await api("/api/mobile/auth/login", "POST", {
    email: ADMIN_EMAIL,
    firstName: "Admin",
    lastName: "Smoke",
  });
  if (!loginRes.ok) {
    log("Admin login failed:", loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  log(`Logged in as ${loginRes.data.user.email}`);

  const adminCheck = await api("/api/admin/check", "GET", null, token);
  check(
    "admin/check returns isAdmin=true",
    adminCheck.data?.isAdmin === true,
    JSON.stringify(adminCheck.data)
  );

  // 2. Fetch canonical allowed-effects list from the server
  const effectsRes = await api("/api/admin/allowed-effects", "GET", null, token);
  check(
    "GET /api/admin/allowed-effects returns a non-empty array",
    effectsRes.ok && Array.isArray(effectsRes.data?.effects) && effectsRes.data.effects.length > 0,
    `status=${effectsRes.status} body=${JSON.stringify(effectsRes.data).slice(0, 200)}`
  );
  const ALLOWED_TYPES = new Set((effectsRes.data?.effects || []).map((e) => e.type));
  log(`Server reports ${ALLOWED_TYPES.size} implemented effect types.`);

  // 3. Unauthenticated rejection
  const noAuth = await api("/api/admin/generate-cards", "POST", { kind: "unit", count: 1 });
  check("unauthenticated request rejected (401)", noAuth.status === 401, `status=${noAuth.status}`);

  // 4. Bad payload validation
  const badReq = await api("/api/admin/generate-cards", "POST", { kind: "unit", count: 99 }, token);
  check("count > 10 rejected (400)", badReq.status === 400, `status=${badReq.status}`);
  const badKind = await api("/api/admin/generate-cards", "POST", { kind: "spell", count: 1 }, token);
  check("invalid kind rejected (400)", badKind.status === 400, `status=${badKind.status}`);

  // 5. Generate units
  log("Generating 2 fire units…");
  const unitsRes = await api("/api/admin/generate-cards", "POST", {
    kind: "unit",
    count: 2,
    element: "Fire",
    powerRange: [4, 8],
    stylePrompt: "Smoke-test units",
  }, token);
  check(
    "unit generation responded 200",
    unitsRes.ok,
    `status=${unitsRes.status} body=${JSON.stringify(unitsRes.data).slice(0, 300)}`
  );

  let savedUnitId = null;
  if (unitsRes.ok) {
    const unitCands = unitsRes.data.candidates || [];
    log(`Got ${unitCands.length} valid unit candidates (${unitsRes.data.rejectedCount} rejected of ${unitsRes.data.totalReturnedByAi})`);
    check("at least one valid unit candidate", unitCands.length > 0);
    const allShapeOk = unitCands.every(looksLikeUnitCandidate);
    check("every unit candidate has the expected shape", allShapeOk);
    const allFire = unitCands.every((c) => c.element === "Fire");
    check("element filter respected (all Fire)", allFire);

    // Save first unit
    if (unitCands.length > 0) {
      const tagged = { ...unitCands[0], name: `[smoke-${STAMP}] ${unitCands[0].name}` };
      const saveRes = await api("/api/admin/generated-cards/save", "POST", {
        kind: "unit",
        payload: tagged,
      }, token);
      check("saving unit returns 201", saveRes.status === 201, `status=${saveRes.status}`);
      savedUnitId = saveRes.data?.record?.id;
      check("saved unit has id", !!savedUnitId);

      if (savedUnitId) {
        const fetched = await api(`/api/cards/${savedUnitId}`, "GET", null, token);
        check(
          "saved unit returned by GET /api/cards/:id",
          fetched.ok && fetched.data?.id === savedUnitId,
          JSON.stringify(fetched.data).slice(0, 200)
        );
      }
    }
  }

  // 6. Generate commanders
  log("Generating 1 commander…");
  const cmdRes = await api("/api/admin/generate-cards", "POST", {
    kind: "commander",
    count: 1,
    element: "Water",
    costRange: [0, 2],
    stylePrompt: "Smoke-test commander",
  }, token);
  check(
    "commander generation responded 200",
    cmdRes.ok,
    `status=${cmdRes.status} body=${JSON.stringify(cmdRes.data).slice(0, 300)}`
  );

  let savedCmdId = null;
  if (cmdRes.ok) {
    const cmdCands = cmdRes.data.candidates || [];
    log(`Got ${cmdCands.length} valid commander candidates (${cmdRes.data.rejectedCount} rejected of ${cmdRes.data.totalReturnedByAi})`);
    check("at least one valid commander candidate", cmdCands.length > 0);
    const allShapeOk = cmdCands.every(looksLikeCommanderCandidate);
    check("every commander candidate has the expected shape", allShapeOk);

    let allEffectsImplemented = true;
    for (const cand of cmdCands) {
      for (const ab of cand.abilities) {
        if (!ALLOWED_TYPES.has(ab.effect.type)) {
          allEffectsImplemented = false;
          log(`  ability "${ab.name}" uses unimplemented effect ${ab.effect.type}`);
        }
      }
    }
    check("every ability.effect.type is in the implemented set", allEffectsImplemented);

    if (cmdCands.length > 0) {
      const tagged = { ...cmdCands[0], name: `[smoke-${STAMP}] ${cmdCands[0].name}` };
      const saveRes = await api("/api/admin/generated-cards/save", "POST", {
        kind: "commander",
        payload: tagged,
      }, token);
      check("saving commander returns 201", saveRes.status === 201, `status=${saveRes.status}`);
      savedCmdId = saveRes.data?.record?.id;
      check("saved commander has id", !!savedCmdId);

      if (savedCmdId) {
        const fetched = await api(`/api/commanders/${savedCmdId}`, "GET", null, token);
        check(
          "saved commander returned by GET /api/commanders/:id",
          fetched.ok && fetched.data?.id === savedCmdId
        );
      }
    }
  }

  log("");
  log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log("FATAL", err);
  process.exit(1);
});
