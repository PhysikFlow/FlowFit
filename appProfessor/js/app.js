import { svgIcon } from "../../appAluno/js/core/icons.js";
import { DEFAULT_BRAND_THEME, applyThemeTokens, normalizeBrandTheme } from "../../appAluno/js/core/brand-theme.js";
import { STUDENTS_KEY, createStudentFromProfessorForm, studentRepository } from "../../appAluno/js/data/repositories/student-repository.js";
import { authRepository } from "../../appAluno/js/data/repositories/auth-repository.js";
import { themeRepository } from "../../appAluno/js/data/repositories/theme-repository.js";
import { PUBLISHED_WORKOUTS_KEY, createWorkoutFromProfessorForm, parseExerciseLine, workoutRepository } from "../../appAluno/js/data/repositories/workout-repository.js";

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const jumpButtons = [...document.querySelectorAll("[data-nav-jump]")];
const title = document.querySelector("[data-page-title]");
const toast = document.querySelector("[data-toast]");
const brandInput = document.querySelector("[data-brand-input]");
const taglineInput = document.querySelector("[data-tagline-input]");
const accentInput = document.querySelector("[data-accent-input]");
const modeButtons = [...document.querySelectorAll("[data-mode-choice]")];
const themeStatus = document.querySelector("[data-theme-status]");
const studentSyncStatus = document.querySelector("[data-student-sync-status]");
const workoutForm = document.querySelector("[data-workout-form]");
const previewExercises = document.querySelector("[data-preview-exercises]");
const previewSets = document.querySelector("[data-preview-sets]");
const previewMinutes = document.querySelector("[data-preview-minutes]");
const previewList = document.querySelector("[data-preview-list]");
const workoutSyncStatus = document.querySelector("[data-workout-sync-status]");
const authGate = document.querySelector("[data-auth-gate]");
const authForm = document.querySelector("[data-auth-form]");
const authStatus = document.querySelector("[data-auth-status]");
const authUser = document.querySelector("[data-auth-user]");
const coachProfileForm = document.querySelector("[data-coach-profile-form]");
const coachProfileStatus = document.querySelector("[data-coach-profile-status]");
const coachNameInput = document.querySelector("[data-coach-name-input]");
const coachHeadlineInput = document.querySelector("[data-coach-headline-input]");

let toastTimer;
let themeSaveTimer;
let students = studentRepository.listStudents();
let workouts = workoutRepository.listPublishedWorkouts();
let dataStatus = "Local";
let authContext = null;
let authAction = "signin";

const $ = (selector) => document.querySelector(selector);

const setText = (selector, value) => {
  const target = $(selector);
  if (target) target.textContent = value;
};

const setAllText = (selector, value) => {
  document.querySelectorAll(selector).forEach((target) => {
    target.textContent = value;
  });
};

const setHtml = (selector, value) => {
  const target = $(selector);
  if (target) target.innerHTML = value;
  return target;
};

const pageTitles = {
  dashboard: "Dashboard",
  students: "Alunos",
  workouts: "Treinos",
  messages: "Comunicação",
  business: "Negócio",
  appearance: "Aparência",
  profile: "Perfil"
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const initialsFromName = (value) => {
  const parts = String(value || "Personal")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "PF").toUpperCase();
};

const setStatus = (target, message, state = "") => {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-synced", state === "synced");
  target.classList.toggle("is-warning", state === "warning");
};

const setThemeStatus = (message, state = "") => setStatus(themeStatus, message, state);
const setStudentSyncStatus = (message, state = "") => setStatus(studentSyncStatus, message, state);
const setWorkoutSyncStatus = (message, state = "") => setStatus(workoutSyncStatus, message, state);
const setAuthStatus = (message, state = "") => setStatus(authStatus, message, state);
const setCoachProfileStatus = (message, state = "") => setStatus(coachProfileStatus, message, state);

const getAuthRedirectUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.href;
};

const getProviderLabel = (provider) => provider === "apple" ? "Apple" : "Google";

const handleOAuthSignIn = async (provider) => {
  const label = getProviderLabel(provider);
  setAuthStatus(`Abrindo login com ${label}...`, "");
  const result = await authRepository.signInWithOAuth({
    provider,
    redirectTo: getAuthRedirectUrl()
  });

  if (!result.ok) {
    setAuthStatus(result.message || `Não foi possível abrir login com ${label}.`, "warning");
  }
};

const setAuthLocked = (locked) => {
  authGate?.classList.toggle("is-hidden", !locked);
  document.body.classList.toggle("is-auth-locked", locked);
};

const readTheme = () => ({
  brandName: brandInput?.value?.trim() || DEFAULT_BRAND_THEME.brandName,
  tagline: taglineInput?.value?.trim() || DEFAULT_BRAND_THEME.tagline,
  accent: accentInput?.value || DEFAULT_BRAND_THEME.accent,
  mode: document.documentElement.dataset.mode || DEFAULT_BRAND_THEME.mode
});

const fillThemeInputs = (theme) => {
  const normalized = normalizeBrandTheme(theme);
  if (brandInput) brandInput.value = normalized.brandName;
  if (taglineInput) taglineInput.value = normalized.tagline;
  if (accentInput) accentInput.value = normalized.accent;
  return normalized;
};

const saveThemeNow = async ({ silent = false } = {}) => {
  clearTimeout(themeSaveTimer);
  setThemeStatus("Salvando marca branca...", "");
  const result = await themeRepository.saveBrandTheme(readTheme());
  const message = result.synced
    ? "Marca branca sincronizada com Supabase."
    : "Marca branca salva localmente. Verifique a conexão com Supabase.";
  setThemeStatus(message, result.synced ? "synced" : "warning");
  if (!silent) showToast(result.synced ? "Tema sincronizado." : "Tema salvo localmente.");
  return result;
};

const queueThemeSave = () => {
  clearTimeout(themeSaveTimer);
  setThemeStatus("Alteração pendente. Salvamento automático em instantes.", "");
  themeSaveTimer = setTimeout(() => saveThemeNow({ silent: true }), 700);
};

const showToast = (message) => {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
};

const navigate = (name, updateHash = true) => {
  const destination = pages.some((page) => page.dataset.page === name) ? name : "dashboard";
  pages.forEach((page) => page.classList.toggle("is-active", page.dataset.page === destination));
  navItems.forEach((item) => {
    const active = item.dataset.nav === destination;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (title) title.textContent = pageTitles[destination] || "Painel";
  if (updateHash) history.replaceState(null, "", `#${destination}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const focusWorkoutForm = () => {
  workoutForm?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => workoutForm?.querySelector("select, input, textarea")?.focus(), 260);
};

const formatUpdatedAt = (value) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const parseSets = (prescription) => {
  const match = String(prescription || "").match(/\d+/);
  return Number.parseInt(match?.[0] || "0", 10) || 0;
};

const getWorkoutBlocks = (workout) => {
  if (Array.isArray(workout.exercises) && workout.exercises.length) {
    return workout.exercises.map((exercise) => `${exercise.name} ${exercise.prescription}`).slice(0, 6);
  }
  return ["Sem exercícios cadastrados"];
};

const getPublishedWorkoutForStudent = (student) => workouts.find((workout) => workout.studentKey === student.studentKey);

const syncStudentWorkout = (workout) => {
  students = students.map((student) => {
    if (student.studentKey !== workout.studentKey) return student;
    return {
      ...student,
      workout: `Treino ${workout.code} - ${workout.title}`,
      nextAction: "Ver treino publicado",
      updatedAt: workout.updatedAt
    };
  });
};

const applyStudents = (nextStudents) => {
  students = [...nextStudents].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  workouts.forEach(syncStudentWorkout);
  renderStudents();
  renderDashboard();
};

const applyPublishedWorkouts = (publishedWorkouts = workoutRepository.listPublishedWorkouts()) => {
  workouts = [...publishedWorkouts].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  workouts.forEach(syncStudentWorkout);
  renderStudents();
  renderWorkouts();
  renderDashboard();
};

const refreshStudents = async ({ silent = false } = {}) => {
  if (!silent) setStudentSyncStatus("Buscando alunos...", "");
  const result = await studentRepository.fetchStudents();
  dataStatus = result.synced ? "Online" : "Local";
  applyStudents(result.students);
  setStudentSyncStatus(
    result.synced ? "Alunos sincronizados com Supabase." : "Alunos em modo local. Verifique Supabase/rede.",
    result.synced ? "synced" : "warning"
  );
  return result;
};

const refreshPublishedWorkouts = async ({ silent = false } = {}) => {
  if (!silent) setWorkoutSyncStatus("Buscando treinos publicados...", "");
  const result = await workoutRepository.fetchPublishedWorkouts();
  dataStatus = result.synced ? "Online" : dataStatus;
  applyPublishedWorkouts(result.workouts);
  setWorkoutSyncStatus(
    result.synced ? "Treinos sincronizados com Supabase." : "Treinos em modo local. Verifique Supabase/rede.",
    result.synced ? "synced" : "warning"
  );
  return result;
};

const renderIcons = () => {
  document.querySelectorAll("[data-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.icon);
  });
  setHtml("[data-brand-icon]", svgIcon("dumbbell"));
};

const renderCoachProfile = () => {
  const profile = authContext?.profile;
  const fallbackName = authContext?.user?.user_metadata?.display_name || authContext?.email || "Personal";
  const name = profile?.name || fallbackName;
  const headline = profile?.headline || "Perfil do personal";
  const email = authContext?.email || "Entre para sincronizar";

  setAllText("[data-coach-name]", name);
  setAllText("[data-coach-headline]", headline);
  setAllText("[data-coach-email]", email);
  setAllText("[data-coach-initials]", initialsFromName(name));
  setText("[data-auth-user]", authContext?.email || "");
  if (authUser) authUser.title = authContext?.email || "";

  if (coachNameInput && document.activeElement !== coachNameInput) coachNameInput.value = profile?.name || "";
  if (coachHeadlineInput && document.activeElement !== coachHeadlineInput) coachHeadlineInput.value = profile?.headline || "";
};

const renderTasks = () => {
  const target = document.querySelector("[data-task-list]");
  if (!target) return;
  const withoutWorkout = students.filter((student) => !getPublishedWorkoutForStudent(student));
  const checkinPending = students.filter((student) => student.status === "Aguardando check-in");
  const paymentPending = students.filter((student) => student.status === "Inadimplente");
  const tasks = [];

  if (!students.length) {
    tasks.push({ type: "Alunos", title: "Cadastre o primeiro aluno", detail: "Use a tela Alunos para iniciar a base real do painel." });
  }
  if (withoutWorkout.length) {
    tasks.push({ type: "Treinos", title: `${withoutWorkout.length} aluno(s) sem treino publicado`, detail: "Publique um treino para liberar a visualização no app do aluno." });
  }
  if (checkinPending.length) {
    tasks.push({ type: "Check-in", title: `${checkinPending.length} check-in(s) pendente(s)`, detail: "Revise os alunos marcados como aguardando check-in." });
  }
  if (paymentPending.length) {
    tasks.push({ type: "Financeiro", title: `${paymentPending.length} aluno(s) inadimplente(s)`, detail: "Controle manual até o módulo financeiro ser ativado." });
  }

  if (!tasks.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhuma pendência operacional.</strong><small>Alunos ativos possuem treino publicado.</small></article>`;
    return;
  }

  target.innerHTML = tasks.map((task) => `
    <article class="task-row">
      <span class="chip">${escapeHtml(task.type)}</span>
      <div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.detail)}</small></div>
    </article>
  `).join("");
};

const renderActivities = () => {
  const target = document.querySelector("[data-activity-list]");
  if (!target) return;
  const activities = [
    ...workouts.map((workout) => ({
      icon: "dumbbell",
      title: `Treino publicado para ${workout.owner}`,
      detail: `${workout.title} - ${formatUpdatedAt(workout.updatedAt)}`,
      time: workout.updatedAt
    })),
    ...students.map((student) => ({
      icon: "users",
      title: `Aluno salvo: ${student.name}`,
      detail: `${student.status} - ${formatUpdatedAt(student.updatedAt)}`,
      time: student.updatedAt
    }))
  ]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 6);

  if (!activities.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhuma atividade registrada.</strong><small>Cadastre um aluno ou publique um treino para preencher este painel.</small></article>`;
    return;
  }

  target.innerHTML = activities.map((item) => `
    <article class="activity-row">
      <span class="surface-icon">${svgIcon(item.icon)}</span>
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
    </article>
  `).join("");
};

const renderDashboard = () => {
  const activeStudents = students.filter((student) => student.status !== "Inadimplente").length;
  const pendingCount = students.filter((student) => student.status !== "Ativo" || !getPublishedWorkoutForStudent(student)).length;
  setText("[data-kpi-students]", activeStudents);
  setText("[data-kpi-workouts]", workouts.length);
  setText("[data-kpi-pending]", pendingCount);
  setText("[data-kpi-sync]", dataStatus);
  renderTasks();
  renderActivities();
};

const renderStudentOptions = () => {
  const select = document.querySelector("[data-student-options]");
  const submitButton = workoutForm?.querySelector("button[type='submit']");
  if (!select) return;
  if (!students.length) {
    select.innerHTML = `<option value="">Cadastre um aluno primeiro</option>`;
    select.disabled = true;
    if (submitButton) submitButton.disabled = true;
    return;
  }

  const previousValue = select.value;
  select.disabled = false;
  if (submitButton) submitButton.disabled = false;
  select.innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}${student.email ? ` - ${escapeHtml(student.email)}` : ""}</option>`).join("");
  if (students.some((student) => student.id === previousValue)) select.value = previousValue;
};

const renderStudents = () => {
  const target = document.querySelector("[data-student-list]");
  if (!target) {
    renderStudentOptions();
    renderWorkoutPreview();
    return;
  }
  if (!students.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhum aluno cadastrado.</strong><small>Use o formulário acima para criar o primeiro aluno real.</small></article>`;
    renderStudentOptions();
    renderWorkoutPreview();
    return;
  }

  target.innerHTML = students.map((student) => `
    <article class="student-card card">
      <span class="avatar">${escapeHtml(student.initials)}</span>
      <div class="student-card__main">
        <div>
          <h2>${escapeHtml(student.name)}</h2>
          <p>${escapeHtml(student.goal)} - ${escapeHtml(student.plan)}</p>
        </div>
        <span class="chip">${escapeHtml(student.status)}</span>
      </div>
      <div class="student-card__meta">
        <span>${escapeHtml(student.workout)}</span>
        <span>${student.adherence}% aderência</span>
      </div>
      <div class="progress-track" aria-label="${student.adherence} por cento de aderência"><span style="--progress: ${student.adherence}%"></span></div>
      <button class="button button--quiet button--block" type="button" data-student-action="${escapeHtml(student.id)}">
        ${escapeHtml(student.nextAction)} ${svgIcon("arrow-right")}
      </button>
    </article>
  `).join("");
  renderStudentOptions();
  renderWorkoutPreview();
};

const getWorkoutDraft = () => {
  if (!workoutForm) return { exercises: [], totalSets: 0, estimatedMinutes: 0 };
  const data = new FormData(workoutForm);
  const lines = String(data.get("blocks") || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  const exercises = lines.map((line, index) => ({
    ...parseExerciseLine(line, index, "draft"),
    parsed: /\d+\s*x\s*.+/i.test(line)
  }));
  const totalSets = exercises.reduce((sum, exercise) => sum + parseSets(exercise.prescription), 0);

  return {
    exercises,
    totalSets,
    estimatedMinutes: exercises.length ? Math.max(28, exercises.length * 7) : 0
  };
};

const renderWorkoutPreview = () => {
  if (!previewList || !previewExercises || !previewSets || !previewMinutes) return;
  const draft = getWorkoutDraft();
  previewExercises.textContent = draft.exercises.length;
  previewSets.textContent = draft.totalSets;
  previewMinutes.textContent = draft.estimatedMinutes;

  if (!students.length) {
    previewList.innerHTML = `<article class="empty-state"><strong>Cadastre um aluno primeiro.</strong><small>Depois selecione o aluno e publique o treino.</small></article>`;
    return;
  }

  if (!draft.exercises.length) {
    previewList.innerHTML = `<article class="empty-state"><strong>Nenhum exercício informado.</strong><small>Cole uma lista no formato: Supino reto 4x10.</small></article>`;
    return;
  }

  previewList.innerHTML = draft.exercises.map((exercise, index) => `
    <article class="workout-preview__item">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(exercise.name)}</strong>
        <small>${escapeHtml(exercise.prescription)} - ${escapeHtml(exercise.rest)} descanso</small>
      </div>
      <em>${exercise.parsed ? "ok" : "estimado"}</em>
    </article>
  `).join("");
};

const renderWorkouts = () => {
  const target = document.querySelector("[data-workout-list]");
  setText("[data-workout-count]", `${workouts.length} itens`);
  if (!target) return;
  if (!workouts.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhum treino publicado.</strong><small>Crie um treino para um aluno para iniciar a operação.</small></article>`;
    return;
  }

  target.innerHTML = workouts.map((workout) => {
    const blocks = getWorkoutBlocks(workout).map(escapeHtml).join(" - ");
    return `
      <article class="workout-card card workout-card--published">
        <span class="surface-icon">${svgIcon("dumbbell")}</span>
        <div>
          <div class="workout-card__meta-line">
            <span class="eyebrow">${escapeHtml(workout.owner || "Aluno")}</span>
            <span class="chip">Publicado</span>
          </div>
          <h2>${escapeHtml(workout.title)}</h2>
          <p>${blocks}</p>
          <small>Atualizado: ${escapeHtml(formatUpdatedAt(workout.updatedAt))}</small>
        </div>
        <button class="icon-button" type="button" aria-label="Editar ${escapeHtml(workout.title)}" data-workout-action="${escapeHtml(workout.id)}">
          ${svgIcon("chevron-right")}
        </button>
      </article>
    `;
  }).join("");
};

const renderMessages = () => {
  const target = document.querySelector("[data-message-list]");
  if (!target) return;
  target.innerHTML = `<article class="empty-state card"><strong>Nenhuma mensagem conectada.</strong><small>O módulo de comunicação precisa de autenticação antes de receber conversas reais.</small></article>`;
};

const applyTheme = ({ brand, tagline, accent, mode } = {}) => {
  const nextTheme = applyThemeTokens({
    brandName: brand ?? brandInput?.value ?? DEFAULT_BRAND_THEME.brandName,
    tagline: tagline ?? taglineInput?.value ?? DEFAULT_BRAND_THEME.tagline,
    accent: accent ?? accentInput?.value ?? DEFAULT_BRAND_THEME.accent,
    mode: mode ?? document.documentElement.dataset.mode
  });
  document.title = `${nextTheme.brandName} - Professor`;
  document.querySelectorAll("[data-brand-name]").forEach((item) => { item.textContent = nextTheme.brandName; });
  setText("[data-preview-brand]", nextTheme.brandName);
  setText("[data-preview-tagline]", nextTheme.tagline);
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.modeChoice === nextTheme.mode));
};

const renderAll = () => {
  renderIcons();
  renderCoachProfile();
  renderStudents();
  renderWorkouts();
  renderMessages();
  renderDashboard();
  applyTheme();
};

navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(item.dataset.nav);
}));

jumpButtons.forEach((button) => button.addEventListener("click", () => {
  navigate(button.dataset.navJump);
  if (button.hasAttribute("data-focus-workout-form")) focusWorkoutForm();
}));

document.querySelector("[data-scroll-workout-form]")?.addEventListener("click", (event) => {
  event.preventDefault();
  focusWorkoutForm();
});

document.querySelector("[data-student-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authContext?.user) {
    showToast("Entre como professor antes de cadastrar alunos.");
    setAuthLocked(true);
    return;
  }
  const student = createStudentFromProfessorForm(Object.fromEntries(new FormData(event.currentTarget)));
  const savedStudent = studentRepository.saveStudent({ ...student, coachId: authContext.coachId });
  applyStudents([savedStudent, ...students.filter((item) => item.id !== savedStudent.id)]);
  setStudentSyncStatus("Aluno salvo localmente. Sincronizando com Supabase...", "");
  showToast("Aluno salvo.");

  const result = await studentRepository.syncStudent(savedStudent);
  setStudentSyncStatus(
    result.synced ? "Aluno sincronizado com Supabase." : "Aluno salvo localmente. Supabase indisponível.",
    result.synced ? "synced" : "warning"
  );
  if (result.synced) showToast("Aluno sincronizado.");
  event.currentTarget.reset();
});

workoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authContext?.user) {
    showToast("Entre como professor antes de publicar treinos.");
    setAuthLocked(true);
    return;
  }
  if (!students.length) {
    showToast("Cadastre um aluno antes de publicar treino.");
    return;
  }

  const data = new FormData(event.currentTarget);
  if (!String(data.get("blocks") || "").trim()) {
    showToast("Informe pelo menos um exercício.");
    return;
  }

  const workout = createWorkoutFromProfessorForm({
    student: students.find((student) => student.id === data.get("student")),
    coachId: authContext.coachId,
    title: data.get("title"),
    template: data.get("template"),
    blocks: data.get("blocks")
  });
  const savedWorkout = workoutRepository.savePublishedWorkout(workout);
  const linkedStudent = students.find((student) => student.id === savedWorkout.studentId);
  if (linkedStudent) {
    studentRepository.saveStudent({
      ...linkedStudent,
      workout: `Treino ${savedWorkout.code} - ${savedWorkout.title}`,
      nextAction: "Ver treino publicado",
      updatedAt: savedWorkout.updatedAt
    });
  }

  applyPublishedWorkouts([savedWorkout, ...workouts.filter((item) => item.id !== savedWorkout.id)]);
  setWorkoutSyncStatus("Treino salvo localmente. Sincronizando com Supabase...", "");
  showToast("Treino publicado.");

  const result = await workoutRepository.syncPublishedWorkout(savedWorkout, linkedStudent);
  setWorkoutSyncStatus(
    result.synced ? "Treino sincronizado com Supabase." : "Treino salvo localmente. Supabase indisponível.",
    result.synced ? "synced" : "warning"
  );
  if (result.synced) showToast("Treino sincronizado.");
  renderWorkoutPreview();
});

workoutForm?.addEventListener("input", renderWorkoutPreview);
workoutForm?.addEventListener("change", renderWorkoutPreview);

brandInput?.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
taglineInput?.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
accentInput?.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
modeButtons.forEach((button) => button.addEventListener("click", () => { applyTheme({ mode: button.dataset.modeChoice }); queueThemeSave(); }));
document.querySelector("[data-save-theme]")?.addEventListener("click", () => saveThemeNow());
document.querySelector("[data-reset-theme]")?.addEventListener("click", () => {
  fillThemeInputs(DEFAULT_BRAND_THEME);
  applyTheme({ mode: DEFAULT_BRAND_THEME.mode });
  saveThemeNow();
  showToast("Tema restaurado.");
});

coachProfileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authContext?.user) {
    showToast("Entre como professor antes de editar o perfil.");
    setAuthLocked(true);
    return;
  }

  const data = Object.fromEntries(new FormData(event.currentTarget));
  setCoachProfileStatus("Salvando perfil...", "");
  const result = await authRepository.updateProfile({
    name: data.name,
    headline: data.headline
  });

  if (!result.synced || !result.profile) {
    setCoachProfileStatus(result.error?.message || "Não foi possível sincronizar o perfil.", "warning");
    showToast("Perfil não sincronizado.");
    return;
  }

  authContext = {
    ...authContext,
    profile: {
      ...authContext.profile,
      ...result.profile,
      headline: result.partial ? authContext.profile?.headline || "" : result.profile.headline
    }
  };
  renderCoachProfile();
  setCoachProfileStatus(
    result.partial ? "Nome salvo. Rode o schema.sql atualizado para salvar a descrição curta." : "Perfil sincronizado com Supabase.",
    result.partial ? "warning" : "synced"
  );
  showToast("Perfil atualizado.");
});

document.addEventListener("click", (event) => {
  const studentAction = event.target.closest("[data-student-action]");
  if (studentAction) {
    const student = students.find((item) => item.id === studentAction.dataset.studentAction);
    navigate("workouts");
    if (student) {
      const studentSelect = document.querySelector("[data-student-options]");
      if (studentSelect) studentSelect.value = student.id;
      renderWorkoutPreview();
    }
    focusWorkoutForm();
  }

  if (event.target.closest("[data-workout-action]")) {
    showToast("Edição detalhada de treino ainda não implementada.");
  }
});

window.addEventListener("hashchange", () => navigate(location.hash.slice(1), false));
window.addEventListener("storage", (event) => {
  if (event.key === PUBLISHED_WORKOUTS_KEY) {
    applyPublishedWorkouts(workoutRepository.listPublishedWorkouts());
    setWorkoutSyncStatus("Treinos atualizados por outra aba.", "synced");
  }
  if (event.key === STUDENTS_KEY) {
    applyStudents(studentRepository.listStudents());
    setStudentSyncStatus("Alunos atualizados por outra aba.", "synced");
  }
});

authForm?.addEventListener("click", async (event) => {
  const oauthButton = event.target.closest("[data-oauth-provider]");
  if (oauthButton) {
    event.preventDefault();
    await handleOAuthSignIn(oauthButton.dataset.oauthProvider);
    return;
  }

  const button = event.target.closest("[data-auth-action]");
  if (button) authAction = button.dataset.authAction;
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  setAuthStatus(authAction === "signup" ? "Criando conta de professor..." : "Entrando...", "");

  const result = authAction === "signup"
    ? await authRepository.signUp({ ...data, role: "coach", redirectTo: getAuthRedirectUrl() })
    : await authRepository.signIn({ ...data, role: "coach" });

  if (!result.ok) {
    setAuthStatus(result.message || "Não foi possível autenticar.", "warning");
    return;
  }

  if (result.pendingEmailConfirmation) {
    setAuthStatus(result.message, "warning");
    return;
  }

  setAuthStatus("Conta autenticada.", "synced");
  await startAuthenticatedPanel();
});

document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
  await authRepository.signOut();
  authContext = null;
  students = [];
  workouts = [];
  dataStatus = "Local";
  renderAll();
  setAuthLocked(true);
  setAuthStatus("Sessão encerrada. Entre novamente para ver dados reais.", "");
});

const startAuthenticatedPanel = async () => {
  const session = await authRepository.getSession();
  if (!session?.user) {
    setAuthLocked(true);
    setAuthStatus("Entre ou crie uma conta de professor para sincronizar dados reais.", "");
    return;
  }

  const profileResult = await authRepository.ensureProfile({
    role: "coach",
    name: session.user.user_metadata?.display_name || session.user.email
  });
  if (!profileResult.synced && !profileResult.profile) {
    setAuthLocked(true);
    setAuthStatus("Login ok, mas o banco ainda não aceitou profiles. Rode supabase/schema.sql no SQL Editor.", "warning");
    return;
  }
  authContext = await authRepository.getAuthContext();

  if (authContext?.role !== "coach") {
    setAuthLocked(true);
    setAuthStatus("Esta conta não é de professor. Use o app do aluno ou crie uma conta de professor.", "warning");
    return;
  }

  setAuthLocked(false);
  setText("[data-auth-user]", authContext.email);
  if (authUser) authUser.title = authContext.email;
  students = [];
  workouts = [];
  renderAll();

  await Promise.allSettled([
    refreshStudents({ silent: true }),
    refreshPublishedWorkouts({ silent: true })
  ]);

  const remote = await themeRepository.fetchBrandTheme();
  if (!remote) {
    setThemeStatus("Sem tema publicado ainda. Use Salvar e aplicar para criar o primeiro.", "");
    return;
  }
  fillThemeInputs(remote);
  applyTheme({ mode: remote.mode });
  setThemeStatus("Tema publicado carregado para edição.", "synced");
};

const boot = async () => {
  renderAll();
  navigate(location.hash.slice(1) || "dashboard", false);
  window.FlowFitProfessorReady = true;
  await startAuthenticatedPanel();
};

boot().catch((error) => {
  console.error("Falha ao iniciar appProfessor", error);
  window.FlowFitProfessorErrors = window.FlowFitProfessorErrors || [];
  window.FlowFitProfessorErrors.push(String(error?.message || error));
  document.body?.setAttribute("data-professor-error", String(error?.message || error).slice(0, 180));
  window.FlowFitProfessorReady = false;
  showToast("Falha ao iniciar painel. Recarregue a página.");
});
