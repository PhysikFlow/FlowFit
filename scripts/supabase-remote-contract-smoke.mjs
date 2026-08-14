import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = fs.readFileSync(path.join(root, "appAluno/js/config.js"), "utf8");
const readConfig = (name) => config.match(new RegExp(`${name}\\s*=\\s*[\\"']([^\\"']+)`))?.[1] || "";
const supabaseUrl = process.env.SUPABASE_URL || readConfig("SUPABASE_URL");
const publishableKey = process.env.SUPABASE_ANON_KEY || readConfig("SUPABASE_ANON_KEY");
const testJwt = String(process.env.SUPABASE_TEST_JWT || "").trim();
const requireAuthContract = process.env.SUPABASE_REQUIRE_AUTH_CONTRACT === "1";

if (!supabaseUrl || !publishableKey) {
  console.error("supabase-remote-contract-smoke: SUPABASE_URL/SUPABASE_ANON_KEY ausentes");
  process.exit(2);
}

const anonHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal"
};
const authHeaders = testJwt
  ? { ...anonHeaders, Authorization: `Bearer ${testJwt}` }
  : null;

const checks = [];
const skipped = [];
const add = (name, passed, detail = "") => checks.push({ name, passed, detail });
const skip = (name, detail) => skipped.push({ name, detail });

const request = async (pathname, options = {}, headers = anonHeaders) => {
  try {
    const response = await fetch(`${supabaseUrl}${pathname}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* resposta não JSON */ }
    return { ok: true, status: response.status, text, body };
  } catch (error) {
    return { ok: false, status: 0, text: String(error?.message || error), body: null };
  }
};

const bodyText = (result) => String(result.text || "").toLowerCase();
const isPostgrestRouteFailure = (result) => (
  result.status === 401
  || result.status === 403
  || result.status === 404
  || result.status >= 500
  || /pgrst202|function .* does not exist|could not find the function|permission denied for function/i.test(result.text)
);
const reportStatus = (result) => result.ok ? String(result.status) : `network:${result.status}`;

const expect = (name, result, predicate, detail = "") => {
  add(name, result.ok && predicate(result), `${reportStatus(result)}${detail ? ` · ${detail}` : ""}`);
};

// Anonymous access must be denied. A 404/500 is not accepted as a security pass:
// it would hide a missing/malformed endpoint behind a permissive assertion.
for (const [name, pathname, payload] of [
  ["sync_workout_session", "/rest/v1/rpc/sync_workout_session", { p_session: {}, p_set_logs: [], p_feedback: {} }],
  ["publish_student_workout", "/rest/v1/rpc/publish_student_workout", { p_workout: {}, p_exercises: [] }],
  ["claim_student_access", "/rest/v1/rpc/claim_student_access", { p_token: null }]
]) {
  const result = await request(pathname, { method: "POST", body: JSON.stringify(payload) });
  expect(
    `RPC ${name} bloqueada para anon sem mascarar ausência da função`,
    result,
    (value) => value.status === 401,
    "status esperado: 401"
  );
  if (result.status === 401 && !/permission denied|jwt|not authenticated|authentication/i.test(bodyText(result))) {
    checks.at(-1).passed = false;
    checks.at(-1).detail += " · corpo não identifica bloqueio de autenticação/permissão";
  }
}

const publicInvite = await request("/rest/v1/rpc/validate_student_invite", {
  method: "POST",
  body: JSON.stringify({ p_token: "not-a-uuid", p_email: null })
});
expect(
  "validate_student_invite aceita chamada pública controlada",
  publicInvite,
  (value) => value.status === 200
    && Array.isArray(value.body)
    && value.body.length === 1
    && value.body[0]?.valid === false
    && value.body[0]?.email_matches === false
    && value.body[0]?.reason === "not-found",
  "payload malformado deve retornar resultado neutro"
);

for (const [name, select] of [
  ["workout_exercises", "id,workout_id,media_type"],
  ["workout_set_logs", "id,workout_exercise_id,discomfort,discomfort_note"]
]) {
  const result = await request(`/rest/v1/${name}?select=${select}&limit=0`);
  expect(
    `REST ${name} não expõe dados para anon`,
    result,
    (value) => value.status === 401 && /permission denied|grant select|not authorized/i.test(bodyText(value)),
    "status esperado: 401 com RLS/grant negado"
  );
}

if (authHeaders) {
  // With a real JWT, column selection must produce a valid REST response. This
  // is intentionally opt-in: no test credential is created or stored here.
  for (const [name, select] of [
    ["workout_exercises.media_type", "id,workout_id,media_type"],
    ["workout_set_logs.individual_fields", "id,workout_exercise_id,discomfort,discomfort_note"]
  ]) {
    const table = name.startsWith("workout_exercises") ? "workout_exercises" : "workout_set_logs";
    const result = await request(`/rest/v1/${table}?select=${select}&limit=0`, {}, authHeaders);
    expect(
      `REST autenticado reconhece ${name}`,
      result,
      (value) => value.status === 200 && Array.isArray(value.body) && !isPostgrestRouteFailure(value),
      "status esperado: 200"
    );
  }

  // An authenticated but incomplete payload must reach the RPC and return a
  // domain validation error, never a route/permission error or a 5xx.
  for (const [name, pathname, payload] of [
    ["sync_workout_session", "/rest/v1/rpc/sync_workout_session", { p_session: {}, p_set_logs: [], p_feedback: {} }],
    ["publish_student_workout", "/rest/v1/rpc/publish_student_workout", { p_workout: {}, p_exercises: [] }],
    ["claim_student_access", "/rest/v1/rpc/claim_student_access", { p_token: null }]
  ]) {
    const result = await request(pathname, { method: "POST", body: JSON.stringify(payload) }, authHeaders);
    expect(
      `RPC ${name} autenticada rejeita payload incompleto no domínio`,
      result,
      (value) => value.status >= 400 && value.status < 500 && !isPostgrestRouteFailure(value),
      "status esperado: erro 4xx de validação/autorização"
    );
  }
} else {
  skip("contrato autenticado de colunas e RPCs", "defina SUPABASE_TEST_JWT para executar sem criar credenciais");
  if (requireAuthContract) {
    console.error("supabase-remote-contract-smoke: SUPABASE_REQUIRE_AUTH_CONTRACT=1 exige SUPABASE_TEST_JWT");
    process.exit(2);
  }
}

const failed = checks.filter((check) => !check.passed);
if (failed.length) {
  console.error(`supabase-remote-contract-smoke: ${failed.length} falha(s)`);
  failed.forEach((check) => console.error(`- ${check.name} (${check.detail})`));
  process.exit(1);
}

console.log(`supabase-remote-contract-smoke: ${checks.length} invariantes aprovados`);
if (skipped.length) {
  skipped.forEach((item) => console.log(`SKIP - ${item.name}: ${item.detail}`));
}
