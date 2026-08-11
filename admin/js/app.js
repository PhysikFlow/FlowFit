import { svgIcon } from "../../appAluno/js/core/icons.js?v=build-20260809-6";
import { authRepository } from "../../appAluno/js/data/repositories/auth-repository.js?v=build-20260811-2";
import { adminRepository } from "./admin-repository.js?v=build-20260811-2";

const STATUS_LABELS = Object.freeze({
  pending: "Aguardando aprovação",
  trial: "Em teste",
  active: "Ativo",
  past_due: "Pagamento atrasado",
  suspended: "Suspenso",
  cancelled: "Cancelado"
});

const authGate = document.querySelector("[data-auth-gate]");
const authForm = document.querySelector("[data-auth-form]");
const authSessionCheck = document.querySelector("[data-auth-session-check]");
const authStatus = document.querySelector("[data-auth-status]");
const authSubmit = document.querySelector("[data-auth-submit]");
const gateSignOut = document.querySelector("[data-auth-gate-sign-out]");
const filterForm = document.querySelector("[data-filter-form]");
const coachRows = document.querySelector("[data-coach-rows]");
const coachCards = document.querySelector("[data-coach-cards]");
const listStatus = document.querySelector("[data-list-status]");
const drawer = document.querySelector("[data-detail-drawer]");
const drawerBackdrop = document.querySelector("[data-drawer-backdrop]");
const detailForm = document.querySelector("[data-detail-form]");
const detailStatus = document.querySelector("[data-detail-status]");
const toast = document.querySelector("[data-toast]");

let coaches = [];
let selectedCoach = null;
let searchTimer;
let toastTimer;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatDate = (value, fallback = "Sem data") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
};

const formatDateTime = (value, fallback = "Sem registro") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const formatPlan = (value) => {
  const plan = String(value || "").trim();
  return !plan || plan.toLowerCase() === "plano piloto" ? "Plano inicial" : plan;
};

const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const setStatus = (target, message, state = "") => {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-warning", state === "warning");
  target.classList.toggle("is-synced", state === "synced");
};

const showToast = (message) => {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
};

const setAuthLocked = (locked) => {
  authGate?.classList.toggle("is-hidden", !locked);
  document.body.classList.toggle("is-auth-locked", locked);
};

const setAuthChecking = (checking) => {
  if (authSessionCheck) authSessionCheck.hidden = !checking;
  if (authForm) authForm.hidden = checking;
  authGate?.setAttribute("aria-busy", String(checking));
};

const badge = (status) => `<span class="status-badge" data-status="${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;

const renderIcons = () => {
  document.querySelectorAll("[data-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.icon);
  });
};

const renderOverview = (overview = {}) => {
  Object.keys(STATUS_LABELS).forEach((status) => {
    const target = document.querySelector(`[data-count="${status}"]`);
    if (target) target.textContent = Number(overview[status] || 0).toLocaleString("pt-BR");
  });
};

const renderCoaches = () => {
  document.querySelector("[data-list-count]").textContent = coaches.length.toLocaleString("pt-BR");
  if (!coaches.length) {
    coachRows.innerHTML = '<tr><td colspan="7" class="table-empty">Nenhum personal corresponde aos filtros.</td></tr>';
    coachCards.innerHTML = '<p class="empty-copy">Nenhum personal corresponde aos filtros.</p>';
    return;
  }

  coachRows.innerHTML = coaches.map((coach) => `
    <tr data-coach-id="${escapeHtml(coach.coach_id)}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(coach.name)}">
      <td><span class="identity-cell"><strong>${escapeHtml(coach.name)}</strong><small>${escapeHtml(coach.email)}</small></span></td>
      <td>${escapeHtml(formatDate(coach.registered_at))}</td>
      <td>${Number(coach.student_count || 0).toLocaleString("pt-BR")}</td>
      <td>${escapeHtml(formatPlan(coach.plan))}</td>
      <td>${escapeHtml(formatDate(coach.access_expires_at, "Sem vencimento"))}</td>
      <td>${badge(coach.status)}</td>
      <td class="open-cell">Abrir</td>
    </tr>
  `).join("");

  coachCards.innerHTML = coaches.map((coach) => `
    <article class="coach-card" data-coach-id="${escapeHtml(coach.coach_id)}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(coach.name)}">
      <div class="coach-card__head">
        <span class="identity-cell"><strong>${escapeHtml(coach.name)}</strong><small>${escapeHtml(coach.email)}</small></span>
        <span class="coach-card__status">${badge(coach.status)}<span class="coach-card__open" aria-hidden="true">›</span></span>
      </div>
      <div class="coach-card__meta"><span>${Number(coach.student_count || 0)} alunos</span><span>${escapeHtml(formatPlan(coach.plan))}</span><span>${escapeHtml(coach.access_expires_at ? `Vence ${formatDate(coach.access_expires_at)}` : "Sem vencimento")}</span></div>
    </article>
  `).join("");
};

const loadOverview = async () => {
  const result = await adminRepository.getOverview();
  if (!result.ok) return result;
  renderOverview(result.data?.[0] || {});
  return result;
};

const loadCoaches = async () => {
  const values = Object.fromEntries(new FormData(filterForm));
  setStatus(listStatus, "Atualizando lista...");
  const result = await adminRepository.listCoaches(values);
  if (!result.ok) {
    setStatus(listStatus, result.message, "warning");
    return result;
  }
  coaches = result.data || [];
  renderCoaches();
  setStatus(listStatus, "Lista atualizada.", "synced");
  return result;
};

const refreshDashboard = async ({ notify = false } = {}) => {
  const [overview, list] = await Promise.all([loadOverview(), loadCoaches()]);
  if (!overview.ok || !list.ok) return overview.ok ? list : overview;
  if (notify) showToast("Dados administrativos atualizados.");
  return { ok: true };
};

const renderHistory = (items = []) => {
  const target = document.querySelector("[data-history-list]");
  if (!items.length) {
    target.innerHTML = '<p class="empty-copy">Nenhuma alteração administrativa registrada.</p>';
    return;
  }
  target.innerHTML = items.map((item) => `
    <article class="history-item">
      <strong>${escapeHtml(item.action)}</strong>
      <p>${escapeHtml(item.actor_email)}</p>
      <small>${escapeHtml(formatDateTime(item.created_at))}</small>
    </article>
  `).join("");
};

const renderCoachDetail = (coach) => {
  selectedCoach = coach;
  document.querySelector("[data-detail-name]").textContent = coach.name;
  document.querySelector("[data-detail-email]").textContent = coach.email;
  document.querySelector("[data-detail-summary]").innerHTML = `
    <span class="summary-item"><small>Alunos</small><strong>${Number(coach.student_count || 0).toLocaleString("pt-BR")}</strong></span>
    <span class="summary-item"><small>Cadastro</small><strong>${escapeHtml(formatDate(coach.registered_at))}</strong></span>
    <span class="summary-item"><small>Último login</small><strong>${escapeHtml(formatDateTime(coach.last_sign_in_at))}</strong></span>
    <span class="summary-item"><small>Cidade</small><strong>${escapeHtml(coach.city || "Não informada")}</strong></span>
    <span class="summary-item"><small>CREF</small><strong>${escapeHtml(coach.cref || "Não informado")}</strong></span>
    <span class="summary-item"><small>Contato</small><strong>${escapeHtml(coach.phone || coach.whatsapp || "Não informado")}</strong></span>
  `;
  detailForm.elements.coachId.value = coach.coach_id;
  detailForm.elements.status.value = coach.status;
  detailForm.elements.plan.value = formatPlan(coach.plan);
  detailForm.elements.accessExpiresAt.value = toLocalInput(coach.access_expires_at);
  detailForm.elements.statusNote.value = coach.status_note || "";
  detailForm.elements.adminNotes.value = coach.admin_notes || "";
  setStatus(detailStatus, "As alterações ficam registradas no histórico.");
};

const openCoach = async (coachId) => {
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  document.body.classList.add("has-drawer");
  document.querySelector("[data-detail-name]").textContent = "Carregando...";
  const [detail, history] = await Promise.all([
    adminRepository.getCoach(coachId),
    adminRepository.listHistory(coachId)
  ]);
  if (!detail.ok || !detail.data?.[0]) {
    setStatus(detailStatus, detail.message || "Personal não encontrado.", "warning");
    showToast(detail.message || "Não foi possível abrir o personal.");
    return;
  }
  renderCoachDetail(detail.data[0]);
  renderHistory(history.ok ? history.data : []);
};

const closeDrawer = () => {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.hidden = true;
  document.body.classList.remove("has-drawer");
  selectedCoach = null;
};

const saveDetail = async ({ targetStatus } = {}) => {
  const values = Object.fromEntries(new FormData(detailForm));
  if (targetStatus) detailForm.elements.status.value = targetStatus;
  const status = targetStatus || values.status;
  setStatus(detailStatus, "Salvando alterações...");
  const result = await adminRepository.updateCoach({
    coachId: values.coachId,
    status,
    plan: values.plan,
    accessExpiresAt: values.accessExpiresAt ? new Date(values.accessExpiresAt).toISOString() : null,
    adminNotes: values.adminNotes,
    statusNote: values.statusNote
  });
  if (!result.ok) {
    setStatus(detailStatus, result.message, "warning");
    return;
  }
  setStatus(detailStatus, "Alterações salvas.", "synced");
  showToast("Personal atualizado.");
  await Promise.all([refreshDashboard(), openCoach(values.coachId)]);
};

const startAdmin = async () => {
  setAuthChecking(true);
  const session = await authRepository.getSession();
  if (!session?.user) {
    setAuthLocked(true);
    setAuthChecking(false);
    gateSignOut.hidden = true;
    return;
  }
  document.querySelector("[data-auth-user]").textContent = session.user.email || "Administrador";
  setStatus(authStatus, "Validando permissão administrativa...");
  const result = await refreshDashboard();
  if (!result.ok) {
    setAuthLocked(true);
    setAuthChecking(false);
    gateSignOut.hidden = false;
    setStatus(authStatus, result.message, "warning");
    return;
  }
  gateSignOut.hidden = true;
  setAuthLocked(false);
  setAuthChecking(false);
};

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  setStatus(authStatus, "Entrando...");
  const result = await adminRepository.signIn(Object.fromEntries(new FormData(event.currentTarget)));
  authSubmit.disabled = false;
  if (!result.ok) {
    setStatus(authStatus, result.message, "warning");
    return;
  }
  await startAdmin();
});

authForm?.addEventListener("click", async (event) => {
  const oauth = event.target.closest("[data-oauth-provider]");
  if (!oauth) return;
  setStatus(authStatus, "Abrindo login com Google...");
  const result = await authRepository.signInWithOAuth({
    provider: oauth.dataset.oauthProvider,
    redirectTo: new URL(location.pathname, location.origin).href
  });
  if (!result.ok) setStatus(authStatus, result.message, "warning");
});

const signOut = async () => {
  await authRepository.signOut();
  coaches = [];
  renderCoaches();
  closeDrawer();
  setAuthLocked(true);
  setAuthChecking(false);
  gateSignOut.hidden = true;
  setStatus(authStatus, "Sessão encerrada.");
};

document.querySelector("[data-sign-out]")?.addEventListener("click", signOut);
gateSignOut?.addEventListener("click", signOut);
document.querySelector("[data-refresh]")?.addEventListener("click", () => refreshDashboard({ notify: true }));
document.querySelector("[data-close-drawer]")?.addEventListener("click", closeDrawer);
drawerBackdrop?.addEventListener("click", closeDrawer);

filterForm?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadCoaches, 250);
});
filterForm?.addEventListener("change", loadCoaches);

const coachTargetFromEvent = (event) => event.target.closest("[data-coach-id]")?.dataset.coachId;
document.querySelector("[data-coach-rows]")?.addEventListener("click", (event) => {
  const coachId = coachTargetFromEvent(event);
  if (coachId) openCoach(coachId);
});
document.querySelector("[data-coach-cards]")?.addEventListener("click", (event) => {
  const coachId = coachTargetFromEvent(event);
  if (coachId) openCoach(coachId);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-coach-id]")) {
    event.preventDefault();
    openCoach(event.target.dataset.coachId);
  }
});

detailForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveDetail();
});

renderIcons();
startAdmin().catch((error) => {
  console.error("Falha ao iniciar administração", error);
  setAuthLocked(true);
  setAuthChecking(false);
  setStatus(authStatus, "Não foi possível iniciar a administração. Recarregue a página.", "warning");
});
