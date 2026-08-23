import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const repository = read("appAluno/js/data/repositories/workout-repository.js");
const sessions = read("appAluno/js/data/repositories/session-repository.js");
const themeRepository = read("appAluno/js/data/repositories/theme-repository.js");
const professorAssets = read("appProfessor/js/screens/appearance/local-assets-editor.js");
const schema = read("supabase/schema.sql");
const remoteSmoke = read("scripts/supabase-remote-contract-smoke.mjs");
const migrationDir = path.join(root, "supabase", "migrations");
const migrations = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const latestMigration = migrations.at(-1) || "";
const migration = migrations
  .map((name) => read(path.join("supabase", "migrations", name)))
  .join("\n");

const checks = [
  ["frontend lê media_type", repository.includes("media_type")],
  ["frontend lê e envia media_metadata", repository.includes("media_metadata") && repository.includes("mediaMetadata")],
  ["frontend envia workout_exercise_id", sessions.includes("workout_exercise_id")],
  ["frontend envia discomfort", sessions.includes("discomfort")],
  ["frontend chama sync_workout_session", sessions.includes('rpc("sync_workout_session"')],
  ["migration adiciona media_type", migration.includes("add column if not exists media_type")],
  ["migration adiciona e valida media_metadata", migration.includes("add column if not exists media_metadata") && migration.includes("exercise_repdb_media_mismatch")],
  ["migration adiciona workout_exercise_id", migration.includes("add column if not exists workout_exercise_id")],
  ["migration adiciona discomfort", migration.includes("add column if not exists discomfort")],
  ["migration define sync_workout_session", migration.includes("create or replace function public.sync_workout_session")],
  ["migration rejeita exercício fora do treino", migration.includes("raise exception 'exercise_not_in_workout'")],
  ["migration aceita ocorrência sintética", migration.includes("-occurrence-[0-9]+$")],
  ["migration documenta compatibilidade legada", migration.includes("v_is_legacy_log")],
  ["migration revoga sync de anon", migration.includes("revoke all on function public.sync_workout_session")],
  ["migration mantém search_path seguro", migration.includes("set search_path = pg_catalog, public")],
  ["schema possui caminhos de assets da marca", schema.includes("logo_path") && schema.includes("photo_path") && schema.includes("logo_frame_enabled")],
  ["migration cria bucket público de assets", migration.includes("flowfit-brand-assets") && migration.includes("image/webp")],
  ["migration restringe upload ao professor", migration.includes("can_operate_as_coach()") && migration.includes("flowfit_brand_assets_insert_own")],
  ["frontend publica e remove assets", themeRepository.includes("uploadBrandAsset") && themeRepository.includes("removeBrandAsset")],
  ["editor mantém fallback local quando upload falha", professorAssets.includes("publicação pendente") && professorAssets.includes("writeLocalBrandAssets")],
  ["editor migra assets locais legados", professorAssets.includes("syncLegacyBrandAssets") && professorAssets.includes("fetch(asset.source)")],
  ["schema é bootstrap e não migration incremental", schema.includes("use exclusivamente as migrations")],
  ["schema não remove índice legado", !schema.includes("drop index if exists public.workout_set_logs_session_exercise_set_idx")],
  ["smoke remoto exige status HTTP", remoteSmoke.includes("value.status === 401") && remoteSmoke.includes("value.status === 200")],
  ["smoke remoto diferencia 401, 404 e 5xx", remoteSmoke.includes("value.status === 401") && remoteSmoke.includes("value.status >= 400 && value.status < 500") && remoteSmoke.includes("value.status === 200")],
  ["smoke remoto falha se contrato autenticado obrigatório não tiver JWT", remoteSmoke.includes("SUPABASE_REQUIRE_AUTH_CONTRACT=1") && remoteSmoke.includes("SUPABASE_TEST_JWT")]
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error(`supabase-contract-smoke: ${failed.length} falha(s)`);
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(`supabase-contract-smoke: ${checks.length} invariantes locais aprovados (${latestMigration})`);
