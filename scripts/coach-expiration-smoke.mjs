import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/automatic-coach-expiration.sql");
const schema = read("supabase/schema.sql");
const adminApp = read("admin/js/app.js");
const adminRepository = read("admin/js/admin-repository.js");
const professorApp = read("appProfessor/js/app.js");

for (const sql of [migration, schema]) {
  assert.match(sql, /access_expires_on date/i);
  assert.match(sql, /at time zone 'America\/Sao_Paulo'/i);
  assert.match(sql, /local_today <= .*access_expires_on/i);
  assert.match(sql, /local_today = .*access_expires_on \+ 1/i);
  assert.match(sql, /else 'expired'/i);
  assert.match(sql, /effective_status in \('trial', 'active', 'past_due', 'grace'\)/i);
  assert.match(sql, /coach_status in \('pending', 'suspended', 'cancelled'\)/i);
  assert.match(sql, /drop function if exists public\.admin_update_coach\(uuid, text, text, timestamptz, text, text\)/i);
  assert.match(sql, /p_access_expires_on date/i);
}

assert.match(adminApp, /type="date"|accessExpiresOn/);
assert.doesNotMatch(adminApp, /new Date\(values\.accessExpires/);
assert.match(adminRepository, /p_access_expires_on/);
assert.doesNotMatch(adminRepository, /p_access_expires_at/);
assert.match(professorApp, /getOwnCoachAccess\(\)/);
assert.match(professorApp, /next_transition_at/);
assert.match(professorApp, /window\.addEventListener\("focus"/);
assert.match(professorApp, /visibilitychange/);

const addDays = (isoDate, days) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

assert.equal(addDays("2026-01-31", 1), "2026-02-01");
assert.equal(addDays("2026-02-28", 1), "2026-03-01");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");
assert.equal(addDays("2026-12-31", 2), "2027-01-02");

console.log("coach-expiration-smoke: regra, fronteiras e integrações aprovadas");
