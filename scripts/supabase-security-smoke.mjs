import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sqlFiles = readdirSync(new URL("../supabase/", import.meta.url))
  .filter((name) => name.endsWith(".sql"));

for (const name of sqlFiles) {
  const sql = read(`supabase/${name}`);
  assert.doesNotMatch(sql, /set\s+search_path\s*=\s*public\s*,\s*pg_temp/i, name);

  const definitions = [...sql.matchAll(
    /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi
  )];
  for (const definition of definitions) {
    const functionName = definition[1];
    const bodyStart = sql.indexOf("as $$", definition.index);
    const header = sql.slice(definition.index, bodyStart > -1 ? bodyStart : definition.index + 1000);
    if (/security\s+definer/i.test(header)) {
      assert.match(
        header,
        /set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i,
        `${name}: ${functionName} SECURITY DEFINER sem search_path endurecido`
      );
    }
    assert.match(
      sql,
      new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(`, "i"),
      `${name}: ${functionName} precisa de REVOKE explicito`
    );
  }

}

const hardening = read("supabase/harden-database-default-privileges.sql");
assert.match(hardening, /revoke create on schema public from public, anon, authenticated/i);
assert.match(hardening, /alter default privileges in schema public[\s\S]*revoke execute on functions from public, anon, authenticated/i);
assert.match(hardening, /alter function %s set search_path to pg_catalog, public/i);
assert.match(hardening, /flowfit_definers_without_hardened_search_path/i);

const schema = read("supabase/schema.sql");
assert.match(schema, /revoke create on schema public from public, anon, authenticated/i);
assert.match(schema, /alter default privileges in schema public[\s\S]*revoke execute on functions from public, anon, authenticated/i);

const coachReadMigration = read("supabase/enforce-coach-read-status.sql");
const protectedSelectPolicies = [
  "brand_theme_select_authenticated",
  "students_select_authenticated_owner",
  "workout_plans_select_authenticated_owner",
  "workout_exercises_select_authenticated_owner",
  "workout_sessions_select_authenticated_owner",
  "workout_set_logs_select_authenticated_owner",
  "workout_feedback_select_authenticated_owner"
];
for (const policy of protectedSelectPolicies) {
  const policyPattern = new RegExp(
    `create\\s+policy\\s+"${policy}"[\\s\\S]*?using\\s*\\([\\s\\S]*?coach_id\\s*=\\s*\\(select auth\\.uid\\(\\)\\)::text[\\s\\S]*?and \\(select public\\.can_operate_as_coach\\(\\)\\)`,
    "i"
  );
  assert.match(coachReadMigration, policyPattern, `${policy} precisa bloquear leitura do coach inativo`);
  assert.match(schema, policyPattern, `${policy} precisa estar consolidada no schema`);
}

console.log(`supabase-security-smoke: ${sqlFiles.length} arquivos SQL aprovados`);
