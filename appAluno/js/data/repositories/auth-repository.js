import { getSupabase } from "../../core/supabase.js";

const PROFILES_TABLE = "profiles";

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

const normalizeName = (value, fallback = "Usuario") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const profileFromRow = (row) => row ? {
  userId: row.user_id,
  role: row.role,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
} : null;

export const authRepository = {
  async getClient() {
    return getSupabase();
  },

  async getSession() {
    const client = await getSupabase();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session || null;
  },

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  async getProfile() {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return null;

    const { data, error } = await client
      .from(PROFILES_TABLE)
      .select("user_id, role, name, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return null;
    return profileFromRow(data);
  },

  async ensureProfile({ role = "student", name } = {}) {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { synced: false, profile: null, reason: "not-authenticated" };

    const safeRole = role === "coach" ? "coach" : "student";
    const safeName = normalizeName(name, user.email || "Usuario");
    const existing = await this.getProfile();

    if (existing) {
      if (existing.role !== safeRole) return { synced: true, profile: existing, roleMismatch: true };

      const { data, error } = await client
        .from(PROFILES_TABLE)
        .update({ name: safeName, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select("user_id, role, name, created_at, updated_at")
        .maybeSingle();

      return { synced: !error, error, profile: profileFromRow(data) || existing };
    }

    const { data, error } = await client
      .from(PROFILES_TABLE)
      .insert({
        user_id: user.id,
        role: safeRole,
        name: safeName,
        updated_at: new Date().toISOString()
      })
      .select("user_id, role, name, created_at, updated_at")
      .maybeSingle();

    return { synced: !error, error, profile: profileFromRow(data) };
  },

  async signIn({ email, password, role, name } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Supabase nao configurado." };

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: String(password || "")
    });

    if (error) return { ok: false, error, message: error.message };

    const profileResult = await this.ensureProfile({ role, name });
    if (profileResult.roleMismatch) {
      await client.auth.signOut();
      return { ok: false, message: "Esta conta ja existe com outro tipo de acesso." };
    }

    return { ok: true, session: data.session, user: data.user, profile: profileResult.profile };
  },

  async signUp({ email, password, role, name } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Supabase nao configurado." };

    const safeName = normalizeName(name, normalizeEmail(email));
    const { data, error } = await client.auth.signUp({
      email: normalizeEmail(email),
      password: String(password || ""),
      options: { data: { display_name: safeName } }
    });

    if (error) return { ok: false, error, message: error.message };

    const session = data.session || await this.getSession();
    if (!session) {
      return {
        ok: true,
        pendingEmailConfirmation: true,
        user: data.user,
        message: "Conta criada. Confirme o email e depois entre novamente."
      };
    }

    const profileResult = await this.ensureProfile({ role, name: safeName });
    return { ok: true, session, user: data.user, profile: profileResult.profile };
  },

  async signOut() {
    const client = await getSupabase();
    if (!client) return;
    await client.auth.signOut();
  },

  async getAuthContext() {
    const session = await this.getSession();
    if (!session?.user) return null;
    const profile = await this.getProfile();
    return {
      session,
      user: session.user,
      profile,
      role: profile?.role || null,
      coachId: session.user.id,
      email: normalizeEmail(session.user.email)
    };
  },

  async onAuthStateChange(callback) {
    const client = await getSupabase();
    if (!client) return { data: { subscription: { unsubscribe() {} } } };
    return client.auth.onAuthStateChange(callback);
  }
};
