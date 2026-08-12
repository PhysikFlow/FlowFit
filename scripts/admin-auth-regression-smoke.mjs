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

assert.match(professorApp, /showAuthenticatedAccessState\(\{/);
assert.match(professorApp, /status: coachAccess\.status \|\| "error"/);
assert.match(professorApp, /email: authContext\?\.email \|\| session\.user\.email/);
assert.match(professorCss, /data-account-state="blocked"/);
assert.match(professorIndex, /app\.css\?v=build-20260812-2/);
assert.match(professorIndex, /app\.js\?v=build-20260812-2/);
assert.match(professorWorker, /flowfit-professor-v32/);

console.log("admin-auth-regression-smoke: RPC e feedback pending aprovados");
