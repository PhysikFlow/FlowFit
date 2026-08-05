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
  "coach_status",
  "coach_trial_ends_at",
  "coach_status_note",
  "created_at",
  "updated_at"
].join(", ");

export const AUTH_ROLES = Object.freeze({
  ADMIN: "admin",
  COACH: "coach",
  STUDENT: "student"
});

export const COACH_STATUS = Object.freeze({
  PENDING: "pending",
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled"
});

const VALID_ROLES = new Set(Object.values(AUTH_ROLES));
const VALID_COACH_STATUSES = new Set(Object.values(COACH_STATUS));
const COACH_ALLOWED_STATUSES = new Set([
  COACH_STATUS.TRIAL,
  COACH_STATUS.ACTIVE,
  COACH_STATUS.PAST_DUE
]);

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

const normalizeText = (value) => String(value ?? "").trim();

const normalizeName = (value, fallback = "Usuário") => {
  const text = normalizeText(value);
  return text || fallback;
};

const normalizeRole = (value, fallback = AUTH_ROLES.STUDENT) => {
  const role = normalizeText(value).toLowerCase();
  return VALID_ROLES.has(role) ? role : fallback;
};

const normalizeCoachStatus = (value, fallback = COACH_STATUS.TRIAL) => {
  const status = normalizeText(value).toLowerCase();
  return VALID_COACH_STATUSES.has(status) ? status : fallback;
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
  coachStatus: normalizeCoachStatus(row.coach_status),
  coachTrialEndsAt: row.coach_trial_ends_at || "",
  coachStatusNote: row.coach_status_note || "",
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

const authMessage = (error, fallback = "Não foi possível autenticar.") => {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.status || "").toLowerCase();

  if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "Confirme seu email antes de entrar.";
  }
  if (code.includes("user_already_exists") || message.includes("already registered") || message.includes("already exists")) {
    return "Já existe uma conta com este email. Entre ou use “Esqueci minha senha”.";
  }
  if (message.includes("password") && (message.includes("6") || message.includes("characters") || message.includes("weak"))) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }
  if (message.includes("invalid email")) {
    return "Informe um email válido.";
  }
  if (code.includes("rate") || message.includes("rate limit") || message.includes("too many")) {
    return "Muitas tentativas. Tente novamente em alguns minutos.";
  }
  if (message.includes("provider") || message.includes("redirect")) {
    return "Login social indisponível. Verifique a configuração do provedor.";
  }

  return fallback;
};

const buildCoachAccess = (profile) => {
  if (!profile) {
    return {
      ok: false,
      reason: "profile-missing",
      message: "Conta autenticada, mas o perfil não carregou. Rode o SQL atualizado e recarregue a página."
    };
  }

  if (profile.role !== AUTH_ROLES.COACH) {
    return {
      ok: false,
      reason: "wrong-role",
      message: "Esta conta não é de professor. Use o app do aluno ou entre com outro email."
    };
  }

  const status = normalizeCoachStatus(profile.coachStatus);
  if (COACH_ALLOWED_STATUSES.has(status)) return { ok: true, status };

  const messages = {
    [COACH_STATUS.PENDING]: "Seu cadastro de personal está aguardando liberação.",
    [COACH_STATUS.SUSPENDED]: "Seu acesso de personal está suspenso.",
    [COACH_STATUS.CANCELLED]: "Esta conta de personal foi cancelada."
  };

  return {
    ok: false,
    reason: "coach-status-blocked",
    status,
    message: messages[status] || "Seu acesso de personal não está ativo."
  };
};

export const authRepository = {
  roles: AUTH_ROLES,
  coachStatus: COACH_STATUS,

  translateAuthError(error, fallback) {
    return authMessage(error, fallback);
  },

  getCoachAccess(profile) {
    return buildCoachAccess(profile);
  },

  canWriteAsCoach(authContext) {
    return authContext?.role === AUTH_ROLES.COACH && buildCoachAccess(authContext.profile).ok;
  },

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

  async ensureProfile({ role = AUTH_ROLES.STUDENT, name, createIfMissing = true, coachStatus = COACH_STATUS.TRIAL } = {}) {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { synced: false, profile: null, reason: "not-authenticated" };

    const safeRole = normalizeRole(role);
    const safeName = normalizeName(name, user.email || "Usuário");
    const existing = await this.getProfile();

    if (existing) {
      if (existing.role !== safeRole) return { synced: true, profile: existing, roleMismatch: true };
      return { synced: true, profile: existing };
    }

    if (!createIfMissing) {
      return { synced: false, profile: null, reason: "profile-missing" };
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      role: safeRole,
      name: safeName,
      updated_at: now
    };

    if (safeRole === AUTH_ROLES.COACH) {
      payload.coach_status = normalizeCoachStatus(coachStatus);
    }

    let { data, error } = await client
      .from(PROFILES_TABLE)
      .insert(payload)
      .select(PROFILE_COLUMNS_EXTENDED)
      .maybeSingle();

    if (isMissingProfileColumn(error)) {
      const fallback = await client
        .from(PROFILES_TABLE)
        .insert({
          user_id: user.id,
          role: safeRole,
          name: safeName,
          updated_at: now
        })
        .select(PROFILE_COLUMNS_BASE)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

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

  async signIn({ email, password, role, name, createProfile = true } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: String(password || "")
    });

    if (error) return { ok: false, error, message: authMessage(error) };

    const profileResult = await this.ensureProfile({ role, name, createIfMissing: createProfile });
    if (profileResult.roleMismatch) {
      await client.auth.signOut();
      return { ok: false, message: "Esta conta já existe com outro tipo de acesso." };
    }

    return { ok: true, session: data.session, user: data.user, profile: profileResult.profile };
  },

  async signUp({ email, password, role, name, redirectTo, createProfile = true, coachStatus = COACH_STATUS.TRIAL } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const safeName = normalizeName(name, normalizeEmail(email));
    const safeRole = normalizeRole(role);
    const { data, error } = await client.auth.signUp({
      email: normalizeEmail(email),
      password: String(password || ""),
      options: {
        data: { display_name: safeName, flowfit_requested_role: safeRole },
        emailRedirectTo: normalizeRedirectUrl(redirectTo)
      }
    });

    if (error) return { ok: false, error, message: authMessage(error) };

    const session = data.session || null;
    if (!session) {
      return {
        ok: true,
        pendingEmailConfirmation: true,
        user: data.user,
        message: "Confira seu email para confirmar o acesso. Se esta conta já existia, entre ou use “Esqueci minha senha”."
      };
    }

    if (!createProfile) {
      return { ok: true, session, user: data.user, profile: null };
    }

    const profileResult = await this.ensureProfile({ role: safeRole, name: safeName, coachStatus });
    if (profileResult.roleMismatch) {
      await client.auth.signOut();
      return { ok: false, message: "Esta conta já existe com outro tipo de acesso." };
    }

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

    if (error) return { ok: false, error, message: authMessage(error) };
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

    if (error) return { ok: false, error, message: authMessage(error, "Não foi possível enviar a recuperação de senha.") };
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
