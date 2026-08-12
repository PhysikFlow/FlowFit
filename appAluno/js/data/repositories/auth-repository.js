import { getSupabase } from "../../core/supabase.js?v=build-20260812-5";

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
const ROLE_RANK = Object.freeze({
  [AUTH_ROLES.STUDENT]: 1,
  [AUTH_ROLES.COACH]: 2,
  [AUTH_ROLES.ADMIN]: 3
});
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

const roleRank = (role) => ROLE_RANK[normalizeRole(role, "")] || 0;

const roleAtLeast = (actualRole, requiredRole) => {
  const actualRank = roleRank(actualRole);
  const requiredRank = roleRank(requiredRole);
  return actualRank > 0 && requiredRank > 0 && actualRank >= requiredRank;
};

const roleLabel = (role) => {
  if (role === AUTH_ROLES.ADMIN) return "administrador";
  if (role === AUTH_ROLES.COACH) return "professor";
  if (role === AUTH_ROLES.STUDENT) return "aluno";
  return "acesso";
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

let authRedirectPromise = null;

const getAuthRedirectParams = () => {
  try {
    const url = new URL(globalThis.location?.href || "");
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    return {
      code: url.searchParams.get("code") || "",
      error: url.searchParams.get("error_description")
        || hash.get("error_description")
        || url.searchParams.get("error")
        || hash.get("error")
        || "",
      errorCode: url.searchParams.get("error_code") || hash.get("error_code") || "",
      accessToken: hash.get("access_token") || "",
      refreshToken: hash.get("refresh_token") || ""
    };
  } catch {
    return { code: "", error: "", errorCode: "", accessToken: "", refreshToken: "" };
  }
};

const clearAuthRedirectParams = () => {
  try {
    const url = new URL(globalThis.location?.href || "");
    ["code", "error", "error_code", "error_description"].forEach((key) => url.searchParams.delete(key));
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    ["access_token", "refresh_token", "expires_at", "expires_in", "provider_token", "token_type", "type", "error", "error_code", "error_description"]
      .forEach((key) => hash.delete(key));
    url.hash = hash.toString() ? `#${hash.toString()}` : "";
    globalThis.history?.replaceState(globalThis.history.state, "", url.href);
  } catch {
    // A sessao continua valida mesmo quando o navegador impede a limpeza do URL.
  }
};

const exchangeAuthRedirect = async (client) => {
  const params = getAuthRedirectParams();
  if (!params.code && !params.accessToken && !params.error) return null;

  if (!authRedirectPromise) {
    authRedirectPromise = (async () => {
      if (params.error) {
        const error = new Error(params.error);
        error.code = params.errorCode || "oauth_callback_error";
        throw error;
      }

      const result = params.code
        ? await client.auth.exchangeCodeForSession(params.code)
        : await client.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken
        });

      if (result.error) throw result.error;
      clearAuthRedirectParams();
      return result.data?.session || null;
    })();
  }

  return authRedirectPromise;
};

const isProfileConflict = (error) => {
  const message = String(error?.message || "");
  return error?.code === "23505"
    || /duplicate key/i.test(message)
    || /already exists/i.test(message);
};

const isMissingProfileProvisionRpc = (error) => {
  const message = String(error?.message || "");
  return error?.code === "PGRST202"
    || error?.code === "42883"
    || /could not find the function .*ensure_own_profile/i.test(message)
    || /function .*ensure_own_profile.* does not exist/i.test(message);
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
      message: "Conta autenticada, mas o perfil não carregou. Recarregue a página ou tente novamente mais tarde."
    };
  }

  if (profile.role === AUTH_ROLES.ADMIN) {
    return {
      ok: true,
      status: COACH_STATUS.ACTIVE,
      admin: true,
      warning: false,
      message: ""
    };
  }

  if (!roleAtLeast(profile.role, AUTH_ROLES.COACH)) {
    return {
      ok: false,
      reason: "wrong-role",
      message: "Esta conta não é de professor. Use o app do aluno ou entre com outro email."
    };
  }

  const status = normalizeCoachStatus(profile.coachStatus);
  const statusNote = normalizeText(profile.coachStatusNote);
  if (COACH_ALLOWED_STATUSES.has(status)) {
    const defaultMessage = status === COACH_STATUS.PAST_DUE
      ? "Seu pagamento está pendente. O uso continua liberado enquanto você regulariza o acesso."
      : "";
    return {
      ok: true,
      status,
      warning: status === COACH_STATUS.PAST_DUE,
      message: statusNote || defaultMessage
    };
  }

  const messages = {
    [COACH_STATUS.PENDING]: "Seu cadastro de personal está aguardando aprovação.",
    [COACH_STATUS.SUSPENDED]: "Seu acesso de personal está suspenso.",
    [COACH_STATUS.CANCELLED]: "Esta conta de personal foi cancelada."
  };

  return {
    ok: false,
    reason: "coach-status-blocked",
    status,
    message: statusNote || messages[status] || "Seu acesso de personal não está ativo."
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

  canAccessRole(profileOrContext, requiredRole) {
    const role = profileOrContext?.role || profileOrContext?.profile?.role || "";
    return roleAtLeast(role, requiredRole);
  },

  canAccessAdmin(profileOrContext) {
    return this.canAccessRole(profileOrContext, AUTH_ROLES.ADMIN);
  },

  canAccessCoach(profileOrContext) {
    return this.canAccessRole(profileOrContext, AUTH_ROLES.COACH);
  },

  canAccessStudent(profileOrContext) {
    return this.canAccessRole(profileOrContext, AUTH_ROLES.STUDENT);
  },

  getRoleLabel(role) {
    return roleLabel(role);
  },

  canWriteAsCoach(authContext) {
    return Boolean(authContext?.user && buildCoachAccess(authContext.profile).ok);
  },

  async getClient() {
    return getSupabase();
  },

  async getSession() {
    const client = await getSupabase();
    if (!client) return null;
    const redirectSession = await exchangeAuthRedirect(client);
    if (redirectSession) return redirectSession;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  },

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  async getProfileResult() {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { profile: null, error: null, reason: "not-authenticated" };

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

    if (error) return { profile: null, error };
    return { profile: profileFromRow(data), error: null };
  },

  async getProfile() {
    const result = await this.getProfileResult();
    return result.profile;
  },

  async ensureProfile({ role = AUTH_ROLES.STUDENT, name, createIfMissing = true, coachStatus = COACH_STATUS.PENDING } = {}) {
    const client = await getSupabase();
    const user = await this.getUser();
    if (!client || !user) return { synced: false, profile: null, reason: "not-authenticated" };

    const safeRole = normalizeRole(role);
    const safeName = normalizeName(name, user.email || "Usuário");

    // O backend é a fonte autoritativa para criar/reparar profiles. Isso cobre
    // OAuth e link mágico, que não carregam flowfit_requested_role nos metadados
    // do provedor, e torna duas abas/callbacks concorrentes idempotentes.
    if (createIfMissing) {
      const provision = await client.rpc("ensure_own_profile", {
        p_requested_role: safeRole,
        p_name: safeName
      });

      if (!provision.error) {
        const row = Array.isArray(provision.data) ? provision.data[0] : provision.data;
        const profile = profileFromRow(row);
        if (!profile) {
          return {
            synced: false,
            profile: null,
            reason: "profile-write-failed",
            error: new Error("ensure_own_profile returned no profile")
          };
        }
        if (!roleAtLeast(profile.role, safeRole)) {
          return {
            synced: true,
            profile,
            roleMismatch: true,
            existingRole: profile.role,
            requestedRole: safeRole
          };
        }
        return { synced: true, profile, provisionedBy: "rpc" };
      }

      // Compatibilidade durante o deploy: o frontend novo ainda funciona por
      // INSERT direto apenas quando a migration da RPC ainda não foi aplicada.
      // Qualquer outro erro da RPC é preservado e nunca mascarado por fallback.
      if (!isMissingProfileProvisionRpc(provision.error)) {
        return {
          synced: false,
          profile: null,
          reason: "profile-write-failed",
          error: provision.error
        };
      }
    }

    const existingResult = await this.getProfileResult();
    if (existingResult.error) {
      return {
        synced: false,
        profile: null,
        reason: "profile-read-failed",
        error: existingResult.error
      };
    }
    const existing = existingResult.profile;

    if (existing) {
      if (!roleAtLeast(existing.role, safeRole)) {
        return {
          synced: true,
          profile: existing,
          roleMismatch: true,
          existingRole: existing.role,
          requestedRole: safeRole
        };
      }
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

    // Duas abas ou dois callbacks de autenticação podem tentar reparar o
    // mesmo perfil ao mesmo tempo. O conflito de chave significa que uma delas
    // venceu a corrida; releia o registro em vez de tratar a conta como quebrada.
    if (isProfileConflict(error)) {
      const recovered = await this.getProfileResult();
      if (recovered.profile) {
        if (!roleAtLeast(recovered.profile.role, safeRole)) {
          return {
            synced: true,
            profile: recovered.profile,
            roleMismatch: true,
            existingRole: recovered.profile.role,
            requestedRole: safeRole
          };
        }
        return { synced: true, profile: recovered.profile, recovered: true };
      }
      if (recovered.error) error = recovered.error;
    }

    return {
      synced: !error,
      error,
      profile: profileFromRow(data),
      reason: error ? "profile-write-failed" : undefined
    };
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
      await client.auth.signOut({ scope: "local" });
      return {
        ok: false,
        message: `Esta conta já existe como ${roleLabel(profileResult.existingRole)} e não pode acessar como ${roleLabel(profileResult.requestedRole)}.`
      };
    }

    return {
      ok: true,
      authenticated: true,
      session: data.session,
      user: data.user,
      profile: profileResult.profile,
      profileIncomplete: !profileResult.synced,
      profileError: profileResult.error || null
    };
  },

  async signUp({ email, password, role, name, redirectTo, createProfile = true, coachStatus = COACH_STATUS.PENDING } = {}) {
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
      await client.auth.signOut({ scope: "local" });
      return {
        ok: false,
        message: `Esta conta já existe como ${roleLabel(profileResult.existingRole)} e não pode acessar como ${roleLabel(profileResult.requestedRole)}.`
      };
    }

    return {
      ok: true,
      authenticated: true,
      session,
      user: data.user,
      profile: profileResult.profile,
      profileIncomplete: !profileResult.synced,
      profileError: profileResult.error || null
    };
  },

  async signInWithOAuth({ provider, redirectTo } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível." };

    const safeProvider = String(provider || "").trim().toLowerCase();
    if (!["google"].includes(safeProvider)) {
      return { ok: false, message: "Provedor de login inválido." };
    }

    // A troca de conta deve afetar somente a plataforma atual. Com storageKey
    // separado, este logout local nao encerra admin/professor/aluno entre si.
    const current = await client.auth.getSession();
    if (current.data?.session) {
      const localSignOut = await client.auth.signOut({ scope: "local" });
      if (localSignOut.error) {
        return { ok: false, error: localSignOut.error, message: authMessage(localSignOut.error) };
      }
    }

    const { data, error } = await client.auth.signInWithOAuth({
      provider: safeProvider,
      options: {
        redirectTo: normalizeRedirectUrl(redirectTo),
        queryParams: { prompt: "select_account" }
      }
    });

    if (error) return { ok: false, error, message: authMessage(error) };
    return { ok: true, data };
  },

  async signInWithMagicLink({ email, redirectTo } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "ServiÃ§o indisponÃ­vel." };

    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return { ok: false, message: "Informe seu email para receber o link de acesso." };

    const { data, error } = await client.auth.signInWithOtp({
      email: safeEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: normalizeRedirectUrl(redirectTo)
      }
    });

    if (error) return { ok: false, error, message: authMessage(error, "NÃ£o foi possÃ­vel enviar o link de acesso.") };
    return {
      ok: true,
      data,
      message: "Enviamos um link de acesso para seu email. Ele funciona tanto no primeiro acesso quanto nos prÃ³ximos."
    };
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
    await client.auth.signOut({ scope: "local" });
  },

  async getAuthContext() {
    const session = await this.getSession();
    if (!session?.user) return null;
    const profileResult = await this.getProfileResult();
    const profile = profileResult.profile;
    return {
      session,
      user: session.user,
      profile,
      profileError: profileResult.error || null,
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
