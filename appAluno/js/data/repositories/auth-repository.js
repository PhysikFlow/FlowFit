import { getSupabase } from "../../core/supabase.js";

const PROFILES_TABLE = "profiles";
const PROFILE_COLUMNS_BASE = "user_id, role, name, created_at, updated_at";
const PROFILE_COLUMNS_LEGACY_EXTENDED = "user_id, role, name, headline, created_at, updated_at";
const PROFILE_COLUMNS_EXTENDED = [
  "user_id",
  "role",
  "name",
  "headline",
  "bio",
  "city",
  "contact_email",
  "phone",
  "whatsapp",
  "cref",
  "created_at",
  "updated_at"
].join(", ");

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

const normalizeText = (value) => String(value ?? "").trim();

const normalizeName = (value, fallback = "Usuário") => {
  const text = normalizeText(value);
  return text || fallback;
};

const normalizeRedirectUrl = (value) => {
  try {
    const url = new URL(String(value || globalThis.location?.href || ""));
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
};

const profileFromRow = (row) => row ? {
  userId: row.user_id,
  role: row.role,
  name: row.name,
  headline: row.headline || "",
  bio: row.bio || "",
  city: row.city || "",
  contactEmail: row.contact_email || "",
  phone: row.phone || "",
  whatsapp: row.whatsapp || "",
  cref: row.cref || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
} : null;

const isMissingProfileColumn = (error) => {
  const message = String(error?.message || "");
  return error?.code === "42703"
    || error?.code === "PGRST204"
    || /column .* does not exist/i.test(message)
    || /could not find .* column/i.test(message);
};

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

    let { data, error } = await client
      .from(PROFILES_TABLE)
      .select(PROFILE_COLUMNS_EXTENDED)
      .eq("user_id", user.id)
      .maybeSingle();

    if (isMissingProfileColumn(error)) {
      const fallback = await client
        .from(PROFILES_TABLE)
        .select(PROFILE_COLUMNS_LEGACY_EXTENDED)
        .eq("user_id", user.id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;

      if (isMissingProfileColumn(error)) {
        const baseFallback = await client
          .from(PROFILES_TABLE)
          .select(PROFILE_COLUMNS_BASE)
          .eq("user_id", user.id)
          .maybeSingle();
        data = baseFallback.data;
        error = baseFallback.error;
      }
    }

    if (error) return null;
    return profileFromRow(data);
  },

  async ensureProfile({ role = "student", name } = {}) {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { synced: false, profile: null, reason: "not-authenticated" };

    const safeRole = role === "coach" ? "coach" : "student";
    const safeName = normalizeName(name, user.email || "Usuário");
    const existing = await this.getProfile();

    if (existing) {
      if (existing.role !== safeRole) return { synced: true, profile: existing, roleMismatch: true };
      return { synced: true, profile: existing };
    }

    const { data, error } = await client
      .from(PROFILES_TABLE)
      .insert({
        user_id: user.id,
        role: safeRole,
        name: safeName,
        updated_at: new Date().toISOString()
      })
      .select(PROFILE_COLUMNS_BASE)
      .maybeSingle();

    return { synced: !error, error, profile: profileFromRow(data) };
  },

  async updateProfile({ name, headline, bio, city, contactEmail, phone, whatsapp, cref } = {}) {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { synced: false, profile: null, reason: "not-authenticated" };

    const safeName = normalizeName(name, user.email || "Usuário");
    const safeHeadline = normalizeText(headline);
    const now = new Date().toISOString();
    let { data, error } = await client
      .from(PROFILES_TABLE)
      .update({
        name: safeName,
        headline: safeHeadline,
        bio: normalizeText(bio),
        city: normalizeText(city),
        contact_email: normalizeEmail(contactEmail),
        phone: normalizeText(phone),
        whatsapp: normalizeText(whatsapp),
        cref: normalizeText(cref),
        updated_at: now
      })
      .eq("user_id", user.id)
      .select(PROFILE_COLUMNS_EXTENDED)
      .maybeSingle();

    let partial = false;
    if (isMissingProfileColumn(error)) {
      partial = true;
      const fallback = await client
        .from(PROFILES_TABLE)
        .update({ name: safeName, headline: safeHeadline, updated_at: now })
        .eq("user_id", user.id)
        .select(PROFILE_COLUMNS_LEGACY_EXTENDED)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;

      if (isMissingProfileColumn(error)) {
        const baseFallback = await client
          .from(PROFILES_TABLE)
          .update({ name: safeName, updated_at: now })
          .eq("user_id", user.id)
          .select(PROFILE_COLUMNS_BASE)
          .maybeSingle();
        data = baseFallback.data;
        error = baseFallback.error;
      }
    }

    return { synced: !error, error, partial, profile: profileFromRow(data) };
  },

  async signIn({ email, password, role, name } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: String(password || "")
    });

    if (error) return { ok: false, error, message: error.message };

    const profileResult = await this.ensureProfile({ role, name });
    if (profileResult.roleMismatch) {
      await client.auth.signOut();
      return { ok: false, message: "Esta conta já existe com outro tipo de acesso." };
    }

    return { ok: true, session: data.session, user: data.user, profile: profileResult.profile };
  },

  async signUp({ email, password, role, name, redirectTo } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const safeName = normalizeName(name, normalizeEmail(email));
    const { data, error } = await client.auth.signUp({
      email: normalizeEmail(email),
      password: String(password || ""),
      options: {
        data: { display_name: safeName },
        emailRedirectTo: normalizeRedirectUrl(redirectTo)
      }
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

  async signInWithOAuth({ provider, redirectTo } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const safeProvider = String(provider || "").trim().toLowerCase();
    if (!["google"].includes(safeProvider)) {
      return { ok: false, message: "Provedor de login inválido." };
    }

    const { data, error } = await client.auth.signInWithOAuth({
      provider: safeProvider,
      options: {
        redirectTo: normalizeRedirectUrl(redirectTo)
      }
    });

    if (error) return { ok: false, error, message: error.message };
    return { ok: true, data };
  },

  async resetPassword({ email, redirectTo } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return { ok: false, message: "Informe seu email para recuperar a senha." };

    const { data, error } = await client.auth.resetPasswordForEmail(safeEmail, {
      redirectTo: normalizeRedirectUrl(redirectTo)
    });

    if (error) return { ok: false, error, message: error.message };
    return { ok: true, data };
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
