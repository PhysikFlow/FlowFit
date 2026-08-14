import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = fs.readFileSync(path.join(root, "appAluno/js/config.js"), "utf8");
const readConfig = (name) => config.match(new RegExp(`${name}\\s*=\\s*[\\\"']([^\\\"']+)`))?.[1] || "";
const supabaseUrl = process.env.SUPABASE_URL || readConfig("SUPABASE_URL");
const publishableKey = process.env.SUPABASE_ANON_KEY || readConfig("SUPABASE_ANON_KEY");

if (!supabaseUrl || !publishableKey) {
  console.error("supabase-remote-contract-smoke: SUPABASE_URL/SUPABASE_ANON_KEY ausentes");
  process.exit(2);
}

const headers = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal"
};

const request = async (pathname, options = {}) => {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  return { response, body: await response.text() };
};

const checks = [];
const add = (name, passed, detail = "") => checks.push({ name, passed, detail });

const columns = await request("/rest/v1/workout_exercises?select=media_type&limit=0");
add(
  "REST reconhece workout_exercises.media_type",
  !/column .*media_type.*does not exist|could not find the column .*media_type/i.test(columns.body),
  `${columns.response.status}`
);

const sync = await request("/rest/v1/rpc/sync_workout_session", {
  method: "POST",
  body: JSON.stringify({ p_session: {}, p_set_logs: [], p_feedback: {} })
});
add(
  "RPC sync_workout_session existe",
  !/could not find the function|function .* does not exist|PGRST202/i.test(sync.body),
  `${sync.response.status}`
);

const publish = await request("/rest/v1/rpc/publish_student_workout", {
  method: "POST",
  body: JSON.stringify({ p_workout: {}, p_exercises: [] })
});
add(
  "RPC publish_student_workout existe",
  !/could not find the function|function .* does not exist|PGRST202/i.test(publish.body),
  `${publish.response.status}`
);

const invite = await request("/rest/v1/rpc/validate_student_invite", {
  method: "POST",
  body: JSON.stringify({ p_token: "not-a-uuid", p_email: null })
});
add(
  "RPC validate_student_invite rejeita token malformado sem erro 5xx",
  invite.response.status < 500 && /not-found/i.test(invite.body),
  `${invite.response.status}`
);

const failed = checks.filter((check) => !check.passed);
if (failed.length) {
  console.error(`supabase-remote-contract-smoke: ${failed.length} falha(s)`);
  failed.forEach((check) => console.error(`- ${check.name} (${check.detail})`));
  process.exit(1);
}

console.log(`supabase-remote-contract-smoke: ${checks.length} invariantes remotos aprovados`);
