import { getSupabase } from "../../appAluno/js/core/supabase.js?v=build-20260811-2";
import { authRepository } from "../../appAluno/js/data/repositories/auth-repository.js?v=build-20260811-3";

const messageFromError = (error, fallback) => {
  const message = String(error?.message || "").trim();
  if (message.includes("Acesso administrativo não autorizado")) {
    return "Esta conta não tem permissão para acessar a administração.";
  }
  return message || fallback;
};

const rpc = async (name, params, fallback) => {
  const client = await getSupabase();
  if (!client) return { ok: false, data: null, message: "Serviço indisponível no momento." };
  const { data, error } = await client.rpc(name, params);
  if (error) return { ok: false, data: null, error, message: messageFromError(error, fallback) };
  return { ok: true, data };
};

export const adminRepository = {
  async signIn({ email, password } = {}) {
    const client = await getSupabase();
    if (!client) return { ok: false, message: "Serviço indisponível no momento." };
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "")
    });
    if (error) {
      return { ok: false, error, message: authRepository.translateAuthError(error, "Não foi possível entrar.") };
    }
    return { ok: true, session: data.session, user: data.user };
  },

  getOverview() {
    return rpc("admin_get_overview", undefined, "Não foi possível carregar os indicadores.");
  },

  listCoaches({ search = "", status = "" } = {}) {
    return rpc("admin_list_coaches", {
      p_search: String(search || "").trim(),
      p_status: String(status || "").trim() || null
    }, "Não foi possível carregar os personals.");
  },

  getCoach(coachId) {
    return rpc("admin_get_coach", { p_coach_id: coachId }, "Não foi possível carregar o personal.");
  },

  listHistory(coachId) {
    return rpc("admin_list_coach_history", { p_coach_id: coachId }, "Não foi possível carregar o histórico.");
  },

  updateCoach({ coachId, status, plan, accessExpiresAt, adminNotes, statusNote } = {}) {
    return rpc("admin_update_coach", {
      p_coach_id: coachId,
      p_status: status,
      p_plan: plan,
      p_access_expires_at: accessExpiresAt || null,
      p_admin_notes: adminNotes,
      p_status_note: statusNote
    }, "Não foi possível salvar as alterações.");
  }
};
