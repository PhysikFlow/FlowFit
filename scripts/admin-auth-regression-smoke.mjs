import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sqlFiles = [
  "supabase/admin-console.sql",
  "supabase/fix-coach-capability-admin-listing.sql",
  "supabase/schema.sql",
  "supabase/fix-admin-update-coach-ambiguity.sql"
];

for (const path of sqlFiles) {
  const sql = read(path);
  assert.match(sql, /on conflict on constraint coach_admin_settings_pkey do update/i, path);
  assert.doesNotMatch(sql, /on conflict\s*\(coach_id\)\s*do update/i, path);
}

const migration = read("supabase/fix-admin-update-coach-ambiguity.sql");
assert.match(migration, /if not public\.is_platform_admin\(\)/i);
assert.match(migration, /for update of p/i);
assert.match(migration, /insert into public\.coach_admin_history/i);
assert.match(migration, /grant execute on function public\.admin_update_coach/i);

const professorApp = read("appProfessor/js/app.js");
const professorCss = read("appProfessor/css/app.css");
const professorIndex = read("appProfessor/index.html");
const professorWorker = read("appProfessor/sw.js");
const studentApp = read("appAluno/js/app.js");
const studentWorker = read("appAluno/sw.js");
const supabaseClient = read("appAluno/js/core/supabase.js");
const authRepository = read("appAluno/js/data/repositories/auth-repository.js");

assert.match(professorApp, /showAuthenticatedAccessState\(\{/);
assert.match(professorApp, /status: coachAccess\.status \|\| "error"/);
assert.match(professorApp, /email: authContext\?\.email \|\| session\.user\.email/);
assert.match(professorApp, /const professorAuthReturn =/);
assert.match(professorApp, /for \(const delay of \[150, 350, 700\]\)/);
assert.match(professorApp, /O login do Google voltou ao FlowFit, mas nenhuma sessão válida foi criada/);
assert.match(professorApp, /url\.search = ""/);
assert.match(professorCss, /data-account-state="blocked"/);
assert.match(professorIndex, /app\.css\?v=build-20260812-3/);
assert.match(professorIndex, /app\.js\?v=build-20260813-1/);
assert.match(professorWorker, /flowfit-professor-v39/);
assert.match(studentWorker, /flowfit-aluno-v62/);
for (const worker of [professorWorker, studentWorker]) {
  assert.match(worker, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(worker, /new Request\(url, \{ cache: "reload" \}\)/);
  assert.match(worker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(worker, /url\.pathname\.endsWith\("\.html"\)/);
  assert.match(worker, /url\.pathname\.endsWith\("\.css"\)/);
}
assert.match(professorApp, /updateViaCache: "none"/);
assert.match(studentApp, /updateViaCache: "none"/);
assert.match(supabaseClient, /storageKey: AUTH_STORAGE_KEY/);
assert.match(supabaseClient, /LEGACY_AUTH_STORAGE_KEY/);
assert.match(supabaseClient, /removeItem\(LEGACY_AUTH_STORAGE_KEY\)/);
assert.match(supabaseClient, /detectSessionInUrl: false/);
assert.match(supabaseClient, /flowType: "pkce"/);
assert.match(supabaseClient, /\/appprofessor/);
assert.match(supabaseClient, /\/admin/);
assert.match(authRepository, /exchangeCodeForSession\(params\.code\)/);
assert.match(authRepository, /prompt: "select_account"/);
assert.match(authRepository, /signOut\(\{ scope: "local" \}\)/);
assert.match(authRepository, /client\.rpc\("get_own_coach_access"\)/);
assert.match(professorApp, /effective_status/);
assert.match(professorApp, /dia de carência/);
assert.match(professorApp, /visibilitychange/);
assert.match(professorApp, /authStateVersion \+= 1/);
assert.match(professorApp, /if \(isSigningOut \|\| !authenticatedSessionDetected\)/);
assert.match(professorApp, /syncAuthMode\("signin"\);[\s\S]*setAuthChecking\(false\);/);

console.log("admin-auth-regression-smoke: RPC e feedback pending aprovados");
