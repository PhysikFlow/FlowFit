import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatPrescription, normalizeWorkoutDocument, parseQuickEntry } from "../appAluno/js/data/training-domain.js";

const rows = parseQuickEntry("Supino reto 4x10 90s\nCrucifixo\t3\t12-15\t60s", "test");
assert.equal(rows.length, 2);
assert.deepEqual([rows[0].name, rows[0].sets, rows[0].reps, rows[0].rest], ["Supino reto", 4, "10", "90s"]);
assert.deepEqual([rows[1].name, rows[1].sets, rows[1].reps, rows[1].rest], ["Crucifixo", 3, "12-15", "60s"]);
assert.equal(formatPrescription(4, "8-10"), "4 x 8-10");

const document = normalizeWorkoutDocument({
  id: "workout-1", title: "Treino literal", exercises: [{ name: "Remada", sets: 4, reps: "8", blockType: "superset", blockId: "A" }]
});
assert.equal(document.title, "Treino literal");
assert.equal(document.exercises[0].prescription, "4 x 8");
assert.equal(document.exercises[0].blockType, "superset");

const migration = readFileSync(new URL("../supabase/migrations/20260823180000_flowfit_programming_domain.sql", import.meta.url), "utf8");
[
  "create table if not exists public.exercise_definitions",
  "create table if not exists public.workout_templates",
  "create table if not exists public.program_templates",
  "create table if not exists public.program_assignments",
  "create table if not exists public.workout_revisions",
  "publish_student_workout_v2",
  "sync_workout_session_v2",
  "prescription_snapshot"
].forEach((fragment) => assert.ok(migration.includes(fragment), `Migration sem ${fragment}`));

const professor = readFileSync(new URL("../appProfessor/js/app.js", import.meta.url), "utf8");
assert.ok(professor.includes("parseQuickEntry"));
assert.ok(professor.includes("syncPendingWorkoutPublishes"));
assert.ok(professor.includes("data-assign-program"));
assert.ok(!professor.includes("Treino salvo como rascunho. Verifique a conexão"));

console.log("training-domain-smoke: domínio, entrada rápida, revisões, programas e fila aprovados");
