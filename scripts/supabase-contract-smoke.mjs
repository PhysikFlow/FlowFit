import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const repository = read("appAluno/js/data/repositories/workout-repository.js");
const sessions = read("appAluno/js/data/repositories/session-repository.js");
const migrationDir = path.join(root, "supabase", "migrations");
const migrations = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const latestMigration = migrations.at(-1) || "";
const migration = latestMigration ? read(path.join("supabase", "migrations", latestMigration)) : "";

const checks = [
  ["frontend lê media_type", repository.includes("media_type")],
  ["frontend envia workout_exercise_id", sessions.includes("workout_exercise_id")],
  ["frontend envia discomfort", sessions.includes("discomfort")],
  ["frontend chama sync_workout_session", sessions.includes('rpc("sync_workout_session"')],
  ["migration adiciona media_type", migration.includes("add column if not exists media_type")],
  ["migration adiciona workout_exercise_id", migration.includes("add column if not exists workout_exercise_id")],
  ["migration adiciona discomfort", migration.includes("add column if not exists discomfort")],
  ["migration define sync_workout_session", migration.includes("create or replace function public.sync_workout_session")],
  ["migration revoga sync de anon", migration.includes("revoke all on function public.sync_workout_session")],
  ["migration mantém search_path seguro", migration.includes("set search_path = pg_catalog, public")]
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error(`supabase-contract-smoke: ${failed.length} falha(s)`);
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(`supabase-contract-smoke: ${checks.length} invariantes locais aprovados (${latestMigration})`);
