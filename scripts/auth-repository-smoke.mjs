import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sourcePath = new URL("../appAluno/js/data/repositories/auth-repository.js", import.meta.url);
const source = readFileSync(sourcePath, "utf8")
  .replace(/^import .*?;\s*/u, "const getSupabase = () => globalThis.__getSupabase();\n")
  .replaceAll("export const ", "const ")
  .concat("\nglobalThis.__authRepository = authRepository;\n");

const context = vm.createContext({
  console,
  URL,
  globalThis: null
});
context.globalThis = context;
vm.runInContext(source, context, { filename: "auth-repository.js" });

const authRepository = context.__authRepository;
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "professor@example.com",
  user_metadata: { display_name: "Professor Teste" }
};
const session = { access_token: "test-only", user };

const profileRow = (role = "coach") => ({
  user_id: user.id,
  role,
  name: "Professor Teste",
  coach_status: "pending",
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: "2026-08-11T00:00:00.000Z"
});

const missingProvisionRpc = {
  data: null,
  error: { code: "PGRST202", message: "Could not find the function public.ensure_own_profile" }
};

const createClient = ({ reads = [], inserts = [], rpcs = [], signUpResult = null } = {}) => {
  const insertedPayloads = [];
  const rpcCalls = [];
  let signedOut = false;
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signUp: async () => signUpResult || ({ data: { session, user }, error: null }),
      signOut: async () => {
        signedOut = true;
        return { error: null };
      }
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      return rpcs.shift() || missingProvisionRpc;
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => reads.shift() || { data: null, error: null }
              };
            }
          };
        },
        insert(payload) {
          insertedPayloads.push(payload);
          return {
            select() {
              return {
                maybeSingle: async () => inserts.shift() || { data: null, error: null }
              };
            }
          };
        }
      };
    }
  };
  return { client, insertedPayloads, rpcCalls, wasSignedOut: () => signedOut };
};

const runWithClient = async (setup, operation) => {
  context.__getSupabase = async () => setup.client;
  return operation();
};

{
  const setup = createClient({
    rpcs: [{ data: profileRow(), error: null }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({
    role: "coach",
    name: "Professor Teste",
    coachStatus: "pending"
  }));
  assert.equal(result.synced, true);
  assert.equal(result.provisionedBy, "rpc");
  assert.equal(result.profile.role, "coach");
  assert.equal(setup.rpcCalls[0].name, "ensure_own_profile");
  assert.equal(setup.rpcCalls[0].args.p_requested_role, "coach");
  assert.equal(setup.insertedPayloads.length, 0);
}

{
  const setup = createClient({
    reads: [{ data: null, error: null }],
    inserts: [{ data: profileRow(), error: null }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({
    role: "coach",
    name: "Professor Teste",
    coachStatus: "pending"
  }));
  assert.equal(result.synced, true);
  assert.equal(result.profile.role, "coach");
  assert.equal(setup.insertedPayloads[0].coach_status, "pending");
}

{
  const setup = createClient({
    rpcs: [{ data: profileRow("coach"), error: null }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({ role: "coach" }));
  assert.equal(result.synced, true);
  assert.equal(result.profile.role, "coach");
  assert.equal(result.roleMismatch, undefined);
}

{
  const rpcError = { code: "P0001", message: "profile backend unavailable" };
  const setup = createClient({
    rpcs: [{ data: null, error: rpcError }],
    reads: [{ data: null, error: null }],
    inserts: [{ data: profileRow(), error: null }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({ role: "coach" }));
  assert.equal(result.synced, false);
  assert.equal(result.reason, "profile-write-failed");
  assert.equal(result.error.code, rpcError.code);
  assert.equal(setup.insertedPayloads.length, 0);
}

{
  const setup = createClient({
    reads: [
      { data: null, error: null },
      { data: profileRow(), error: null }
    ],
    inserts: [{ data: null, error: { code: "23505", message: "duplicate key" } }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({ role: "coach" }));
  assert.equal(result.synced, true);
  assert.equal(result.recovered, true);
  assert.equal(result.profile.role, "coach");
}

{
  const profileError = { code: "PGRST000", message: "database unavailable" };
  const setup = createClient({
    reads: [{ data: null, error: null }],
    inserts: [{ data: null, error: profileError }]
  });
  const result = await runWithClient(setup, () => authRepository.signUp({
    email: user.email,
    password: "test-only-password",
    role: "coach",
    coachStatus: "pending"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.authenticated, true);
  assert.equal(result.profileIncomplete, true);
  assert.equal(result.profileError.code, profileError.code);
}

{
  const setup = createClient({
    signUpResult: { data: { session: null, user }, error: null }
  });
  const result = await runWithClient(setup, () => authRepository.signUp({
    email: user.email,
    password: "test-only-password",
    role: "coach"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.pendingEmailConfirmation, true);
}

{
  const setup = createClient({
    reads: [{ data: profileRow("student"), error: null }]
  });
  const result = await runWithClient(setup, () => authRepository.ensureProfile({ role: "coach" }));
  assert.equal(result.roleMismatch, true);
  assert.equal(result.existingRole, "student");
}

const profileMigration = readFileSync(
  new URL("../supabase/provision-auth-profiles.sql", import.meta.url),
  "utf8"
);
const studentLinkGuard = profileMigration.indexOf("v_requested_role = 'student' and not exists");
const studentProvision = profileMigration.indexOf("perform public.ensure_own_profile('student', v_profile_name)");
const accessCountGuard = profileMigration.indexOf("if v_access_count = 0 then");
assert.ok(profileMigration.includes("v_requested_role not in ('student', 'coach')"));
assert.ok(profileMigration.includes("on conflict (user_id) do update"));
assert.ok(profileMigration.includes("current_profile.role = 'student' and excluded.role = 'coach'"));
assert.ok(profileMigration.includes("revoke all on function public.ensure_own_profile(text, text) from public, anon, authenticated"));
assert.ok(studentLinkGuard > 0 && accessCountGuard > 0 && studentProvision > accessCountGuard);

console.log("auth-repository-smoke: 8 cenários e invariantes SQL aprovados");
