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

const createClient = ({ reads = [], inserts = [], signUpResult = null } = {}) => {
  const insertedPayloads = [];
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
  return { client, insertedPayloads, wasSignedOut: () => signedOut };
};

const runWithClient = async (setup, operation) => {
  context.__getSupabase = async () => setup.client;
  return operation();
};

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

console.log("auth-repository-smoke: 5 cenários aprovados");
