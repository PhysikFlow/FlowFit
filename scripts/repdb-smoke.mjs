import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REPDB_CATALOG_URL,
  REPDB_VERSION,
  createRepdbMetadata,
  filterRepdbExercises,
  getRepdbPosterUrl,
  getRepdbPoseUrls,
  normalizeRepdbMetadata
} from "../appAluno/js/data/repdb/repdb-catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const fixture = {
  id: "arnold-press",
  name_en: "Arnold Press",
  body_part: "shoulders",
  equipment: "dumbbell",
  primary_muscles: ["anterior_deltoid"],
  images: {
    flat: {
      start: "images/flat/arnold-press-start.webp",
      peak: "images/flat/arnold-press-peak.webp"
    }
  }
};

const metadata = createRepdbMetadata(fixture);
assert.equal(REPDB_VERSION, "2026.8.0");
assert.match(REPDB_CATALOG_URL, /@repdb\/exercises@2026[.]8[.]0\/exercises[.]json$/);
assert.equal(metadata.provider, "repdb");
assert.equal(metadata.exerciseId, fixture.id);
assert.match(getRepdbPosterUrl(metadata), /arnold-press-peak[.]webp$/);
assert.deepEqual(Object.keys(getRepdbPoseUrls(metadata)).sort(), ["peak", "start"]);
assert.deepEqual(normalizeRepdbMetadata({ ...metadata, version: "latest" }), {});
assert.deepEqual(normalizeRepdbMetadata({
  ...metadata,
  poses: { start: "https://example.com/untrusted.webp" }
}), {});

const searchable = [{
  id: fixture.id,
  searchText: "arnold press anterior deltoid shoulders dumbbell",
  bodyPart: "shoulders",
  equipment: "dumbbell"
}];
assert.equal(filterRepdbExercises(searchable, { query: "arnold", equipment: "dumbbell" }).length, 1);
assert.equal(filterRepdbExercises(searchable, { bodyPart: "chest" }).length, 0);

const repository = read("appAluno/js/data/repositories/workout-repository.js");
const professor = read("appProfessor/js/app.js");
const student = read("appAluno/js/app.js");
const migration = read("supabase/migrations/20260823120000_flowfit_repdb_media_metadata.sql");
const professorSw = read("appProfessor/sw.js");
const studentSw = read("appAluno/sw.js");

assert.match(repository, /media_metadata/);
assert.match(repository, /media-metadata-migration-required/);
assert.match(professor, /data-open-repdb-picker/);
assert.match(student, /prefers-reduced-motion: reduce/);
assert.match(student, /stopRunnerRepdbMedia/);
assert.match(migration, /add column if not exists media_metadata jsonb/);
assert.match(migration, /exercise_repdb_media_mismatch/);
[professorSw, studentSw].forEach((serviceWorker) => {
  assert.match(serviceWorker, /REPDB_CACHE_LIMIT = 81/);
  assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /isRepdbRequest\(requestUrl\)/);
});

console.log("repdb-smoke: adaptador, persistência, runner e cache aprovados");

