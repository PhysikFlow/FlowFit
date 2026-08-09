import { Platform } from "./core/platform.js?v=build-20260809-6";
import { Store } from "./core/store.js?v=build-20260809-6";
import { Theme } from "./core/theme.js?v=build-20260809-6";
import { svgIcon } from "./core/icons.js?v=build-20260809-6";
import { LEGACY_REMOTE_THEME_KEY, LOCAL_BRAND_ASSETS_KEY, REMOTE_THEME_KEY } from "./core/brand-theme.js?v=build-20260809-6";
import { authRepository } from "./data/repositories/auth-repository.js?v=build-20260809-6";
import { studentRepository } from "./data/repositories/student-repository.js?v=build-20260809-6";
import { themeRepository } from "./data/repositories/theme-repository.js?v=build-20260809-6";
import { PUBLISHED_WORKOUTS_KEY, workoutDateInputValue, workoutRepository } from "./data/repositories/workout-repository.js?v=build-20260809-6";
import { sessionRepository } from "./data/repositories/session-repository.js?v=build-20260809-6";

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const onboarding = document.querySelector("[data-onboarding]");
const onboardingForm = document.querySelector("[data-onboarding-form]");
const accessAppButton = document.querySelector("[data-access-app]");
const authStatus = document.querySelector("[data-auth-status]");
const finishStatus = document.querySelector("[data-finish-status]");
const authTitle = document.querySelector("[data-auth-title]");
const authCopy = document.querySelector("[data-auth-copy]");
const authSubmit = document.querySelector("[data-auth-submit]");
const authSecondary = document.querySelector("[data-auth-secondary]");
const oauthLabel = document.querySelector("[data-oauth-label]");
const toast = document.querySelector("[data-toast]");
const headerNotificationButton = document.querySelector(".notification-button");
const homeWorkoutAction = document.querySelector("[data-home-workout-action]");
const homeWorkoutLabel = document.querySelector("[data-home-workout-label]");
const sessionDock = document.querySelector("[data-session-dock]");
const sessionDockTitle = document.querySelector("[data-session-dock-title]");
const sessionDockCopy = document.querySelector("[data-session-dock-copy]");
const sessionCta = document.querySelector("[data-session-cta]");
const finishDisclosure = document.querySelector("[data-finish-disclosure]");
const finishReadiness = document.querySelector("[data-finish-readiness]");
const progressDisclosure = document.querySelector("[data-progress-disclosure]");
const scheduleDisclosure = document.querySelector("[data-schedule-disclosure]");
const accentInput = document.querySelector("[data-accent]");
const brandInput = document.querySelector("[data-brand-input]");
const taglineInput = document.querySelector("[data-tagline-input]");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
let toastTimer;
let restTimerId;
let restRemaining = 0;
const SET_CLICK_DEBOUNCE_MS = 2000;
const setClickLocks = new Set();
const compactWorkoutQuery = window.matchMedia("(max-width: 767px)");
let focusedExerciseId = "";
const emptyStudent = {
  id: "student-empty",
  name: "Aluno",
  initials: "AL",
  goal: "Sem objetivo cadastrado",
  status: "Sem vínculo ativo",
  plan: "Sem plano",
  since: "hoje",
  coach: "Personal",
  frequency: "Sem frequência cadastrada"
};
const emptyWorkout = {
  id: "workout-empty",
  code: "-",
  title: "Nenhum treino publicado",
  focus: "Aguardando prescrição do personal",
  estimatedMinutes: 0,
  lastDoneLabel: "novo",
  exercises: []
};
const scheduleItems = [];
const notificationItems = [];
let currentStudent = emptyStudent;
let currentWorkout = emptyWorkout;
let studentAccesses = [];
let availableWorkouts = [];
let upcomingWorkouts = [];
let currentSessionStartedAt = new Date().toISOString();
const PENDING_INVITE_KEY = "flowfit.pending-student-invite";
const ACTIVE_STUDENT_KEY = "flowfit.active-student";
const ACTIVE_WORKOUT_KEY = "flowfit.active-workout";

const getInviteContext = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return { token: params.get("invite")?.trim() || "" };
  } catch {
    return { token: "" };
  }
};

const captureInviteToken = () => {
  const token = getInviteContext().token;
  if (token) {
    Platform.storage.set(PENDING_INVITE_KEY, {
      token,
      expiresAt: Date.now() + (30 * 60 * 1000)
    });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // O token continua disponivel no cache temporario.
    }
    return token;
  }
  const pending = Platform.storage.get(PENDING_INVITE_KEY, null);
  if (!pending?.token || Number(pending.expiresAt || 0) <= Date.now()) {
    Platform.storage.remove(PENDING_INVITE_KEY);
    return "";
  }
  return String(pending.token);
};

let pendingInviteToken = captureInviteToken();
const getInviteToken = () => pendingInviteToken;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const parseTotalSets = (exercise) => {
  const match = String(exercise.prescription || "").match(/\d+/);
  return Number.parseInt(match?.[0] || "1", 10) || 1;
};

const parseRestSeconds = (exercise) => Number.parseInt(exercise.rest, 10) || 45;

const parseLoadKg = (value) => Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.]/g, "")) || 0;

const parseReps = (exercise) => {
  const match = String(exercise.prescription || "").match(/x\s*(\d+)/i);
  return Number.parseInt(match?.[1] || "10", 10) || 10;
};

const getCurrentExercises = () => Array.isArray(currentWorkout.exercises) ? currentWorkout.exercises : [];

const getTotalSets = () => getCurrentExercises().reduce((sum, exercise) => sum + parseTotalSets(exercise), 0);

const formatVolume = (value) => `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`;

const formatDecimal = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const formatShortDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(date));

const formatDateTime = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date || "Sem data");
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

const formatWorkoutAvailability = (value) => {
  const dateKey = workoutDateInputValue(value);
  if (!dateKey) return "em breve";
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};

const formatScheduleTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "Sem horário");
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

const formatMonthYear = (date) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(date));

const formatDelta = (current, previous, unit) => {
  if (previous === undefined) return `0 ${unit}`;
  const delta = Number(current) - Number(previous);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta)} ${unit}`;
};

const deltaTone = (current, previous) => {
  const delta = Number(current) - Number(previous);
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
};

const notificationActionPage = {
  "Ver treino": "workout",
  "Abrir agenda": "schedule",
  "Ver agenda": "schedule",
  "Ver evolucao": "progress"
};

const scheduleIconByType = {
  Treino: "dumbbell",
  Mensagem: "message",
  Avaliacao: "ruler"
};

const notificationIconByType = {
  Treino: "dumbbell",
  Agenda: "calendar",
  Avaliacao: "ruler",
  Evolucao: "chart",
  Lembrete: "bell",
  Mensagem: "message"
};

const effortLabelByValue = {
  easy: "Leve",
  ok: "Na medida",
  hard: "Pesado"
};

const pageExists = (name) => pages.some((page) => page.dataset.page === name);

const navigate = (name, updateHash = true) => {
  const destination = pageExists(name) ? name : "home";
  pages.forEach((page) => page.classList.toggle("is-active", page.dataset.page === destination));
  navItems.forEach((item) => {
    const active = item.dataset.nav === destination;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (updateHash) history.replaceState(null, "", `#${destination}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const showToast = (message) => {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
};

const setStatus = (target, message, state = "") => {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-synced", state === "synced");
  target.classList.toggle("is-warning", state === "warning");
};

const setAuthStatus = (message, state = "") => setStatus(authStatus, message, state);
const setFinishStatus = (message, state = "") => setStatus(finishStatus, message, state);

const getAuthRedirectUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  if (pendingInviteToken) url.searchParams.set("invite", pendingInviteToken);
  return url.href;
};

const syncAuthMode = (_mode = "access", { preserveStatus = false } = {}) => {
  if (onboardingForm) onboardingForm.dataset.authMode = "access";
  if (authTitle) authTitle.textContent = pendingInviteToken ? "Ativar acesso do aluno" : "Acessar meus treinos";
  if (authCopy) authCopy.textContent = pendingInviteToken
    ? "Confirme o email do convite para ativar seu acesso."
    : "Use o mesmo email cadastrado pelo seu personal.";
  if (authSubmit) authSubmit.textContent = "Enviar link de acesso";
  if (authSecondary) authSecondary.textContent = "";
  if (oauthLabel) oauthLabel.textContent = "Continuar com Google";
  const passwordInput = onboardingForm?.querySelector('input[name="password"]');
  const nameInput = onboardingForm?.querySelector('input[name="name"]');
  if (passwordInput) passwordInput.disabled = true;
  if (nameInput) nameInput.disabled = true;
  if (!preserveStatus) {
    setAuthStatus(pendingInviteToken ? "Convite detectado. Confirme sua identidade para ativar o acesso." : "", "");
  }
};

const scheduleLabelByType = {
  Treino: "Treino",
  Mensagem: "Mensagem",
  Avaliacao: "Avaliação"
};

const getProviderLabel = () => "Google";

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

const syncThemeControls = () => {
  if (accentInput) accentInput.value = Theme.value.accent;
  if (brandInput) brandInput.value = Theme.value.brandName;
  if (taglineInput) taglineInput.value = Theme.value.tagline;
  document.querySelectorAll("[data-brand-name]").forEach((item) => { item.textContent = Theme.value.brandName; });
  document.querySelectorAll("[data-brand-tagline]").forEach((item) => { item.textContent = Theme.value.tagline; });
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === Theme.value.mode));
  syncBrandAssets();
};

const setImageOrText = (target, dataUrl, fallback, alt) => {
  if (!target) return;
  if (!dataUrl) {
    target.textContent = fallback;
    return;
  }

  const image = document.createElement("img");
  image.src = dataUrl;
  image.alt = alt;
  target.replaceChildren(image);
};

const syncBrandAssets = () => {
  const assets = Platform.storage.get(LOCAL_BRAND_ASSETS_KEY, {});
  const logoFallback = (Theme.value.brandName || "FlowFit").slice(0, 2).toUpperCase();
  document.querySelectorAll("[data-brand-logo]").forEach((target) => {
    setImageOrText(target, assets.logoDataUrl, logoFallback, "Logo local da marca");
  });
  document.querySelectorAll("[data-coach-photo]").forEach((target) => {
    setImageOrText(target, assets.photoDataUrl, "PF", "Foto local do personal");
  });
};

const applyPublishedBrandTheme = async () => {
  try {
    const remote = await themeRepository.fetchBrandTheme(currentStudent?.coachId || "");
    if (!remote?.accent || !remote?.brandName) {
      Theme.reset();
      syncThemeControls();
      return;
    }
    Theme.apply(remote);
    syncThemeControls();
  } catch {
    // Mantem o tema local atual se o repositório remoto/cache falhar.
  }
};

const refreshPublishedWorkout = async ({ silent = false } = {}) => {
  const previousWorkoutId = currentWorkout.id;
  const result = await workoutRepository.fetchWorkoutsForCurrentStudent(currentStudent);
  availableWorkouts = result.workouts || [];
  upcomingWorkouts = result.upcomingWorkouts || [];
  const preferredWorkoutId = Platform.storage.get(`${ACTIVE_WORKOUT_KEY}:${currentStudent.id}`, "");
  currentWorkout = availableWorkouts.find((workout) => workout.id === previousWorkoutId)
    || availableWorkouts.find((workout) => workout.id === preferredWorkoutId)
    || availableWorkouts[0]
    || emptyWorkout;
  if (currentWorkout.id !== emptyWorkout.id) {
    Platform.storage.set(`${ACTIVE_WORKOUT_KEY}:${currentStudent.id}`, currentWorkout.id);
  }

  const changed = currentWorkout.id !== previousWorkoutId;
  if (changed) {
    focusedExerciseId = "";
    setClickLocks.clear();
    stopRestTimer();
    currentSessionStartedAt = new Date().toISOString();
    if (!silent && currentWorkout.id !== emptyWorkout.id) Platform.notify("Seu personal publicou um novo treino.");
  }
  if (changed || result.synced) renderAll();
  return result;
};

const syncOnboarding = () => {
  document.body.classList.toggle("has-onboarding", !Store.state.onboarded);
  onboarding?.classList.toggle("is-hidden", Store.state.onboarded);
};

const resetScopedDisclosureState = () => {
  if (progressDisclosure) delete progressDisclosure.dataset.initialized;
};

const activateStudentStore = () => {
  Store.useScope(currentStudent.id);
  resetScopedDisclosureState();
  Store.completeOnboarding({
    name: currentStudent.name,
    goal: currentStudent.goal,
    frequency: currentStudent.frequency
  });
};

const activateAnonymousStore = () => {
  Store.useScope("anonymous");
  Store.resetOnboarding();
  resetScopedDisclosureState();
};

const markRuntimeReady = () => {
  accessAppButton?.removeAttribute("aria-busy");
  accessAppButton?.setAttribute("data-ready", "true");
};

const toRuntimeStudent = (student, authContext) => {
  if (!student) {
    const name = authContext?.profile?.name || authContext?.email || "Aluno";
    return {
      ...emptyStudent,
      id: authContext?.user?.id || emptyStudent.id,
      name,
      initials: name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AL"
    };
  }

  return {
    ...emptyStudent,
    ...student,
    since: student.createdAt ? formatMonthYear(student.createdAt) : "hoje",
    coach: student.coachName || "Personal",
    frequency: student.plan || "Atendimento"
  };
};

const renderStudent = () => {
  const student = currentStudent || emptyStudent;
  document.querySelectorAll("[data-student-name]").forEach((item) => { item.textContent = student.name; });
  document.querySelectorAll("[data-student-initials]").forEach((item) => { item.textContent = student.initials; });
  document.querySelector("[data-student-since]").textContent = `Aluno desde ${String(student.since || "hoje").toLowerCase()}`;
  document.querySelector("[data-student-plan]").textContent = student.plan || "Sem plano";
  document.querySelector("[data-coach-name]").textContent = student.coach;
  document.querySelector("[data-profile-goal]").textContent = student.goal || "Não informado";
  document.querySelector("[data-profile-status]").textContent = student.status || "Não informado";
};

const renderAccessSelectors = () => {
  const coachField = document.querySelector("[data-coach-selector-field]");
  const coachSelect = document.querySelector("[data-coach-selector]");
  if (coachField && coachSelect) {
    coachField.hidden = studentAccesses.length <= 1;
    coachSelect.innerHTML = studentAccesses.map((student) => `
      <option value="${escapeHtml(student.id)}" ${student.id === currentStudent.id ? "selected" : ""}>
        ${escapeHtml(student.coachName || "Personal")}
      </option>
    `).join("");
  }

  const picker = document.querySelector("[data-workout-picker]");
  const options = document.querySelector("[data-workout-options]");
  const count = document.querySelector("[data-available-workout-count]");
  if (picker) picker.hidden = availableWorkouts.length === 0;
  if (count) count.textContent = `${availableWorkouts.length} ${availableWorkouts.length === 1 ? "disponível" : "disponíveis"}`;
  if (options) {
    options.innerHTML = availableWorkouts.map((workout) => `
      <button class="workout-choice ${workout.id === currentWorkout.id ? "is-active" : ""}" type="button" data-select-workout="${escapeHtml(workout.id)}">
        <strong>Treino ${escapeHtml(workout.code)}</strong>
        <span>${escapeHtml(workout.title)}</span>
        <small>${escapeHtml(workout.estimatedMinutes)} min - ${escapeHtml(workout.exercises.length)} exercícios</small>
      </button>
    `).join("");
  }
};

const renderHome = () => {
  const upcomingWorkout = upcomingWorkouts[0] || null;
  const hasWorkout = currentWorkout.id !== emptyWorkout.id;
  const availabilityLabel = upcomingWorkout ? formatWorkoutAvailability(upcomingWorkout.startsAt) : "";
  document.querySelector("[data-home-workout]").textContent = hasWorkout
    ? `Treino ${currentWorkout.code}`
    : upcomingWorkout ? `Agendado para ${availabilityLabel}` : "Sem treino ativo";
  document.querySelector("[data-home-title]").textContent = hasWorkout
    ? "Seu próximo treino está aqui."
    : upcomingWorkout ? "Próximo treino agendado." : "Aguardando seu primeiro treino.";
  document.querySelector("[data-home-summary]").textContent =
    !hasWorkout
      ? upcomingWorkout
        ? `Treino ${upcomingWorkout.code} - ${upcomingWorkout.title} será liberado em ${availabilityLabel}.`
        : "Seu personal ainda não publicou um treino para você."
      : `${currentWorkout.title} - ${getCurrentExercises().length} exercícios - cerca de ${currentWorkout.estimatedMinutes} minutos.`;
  const sessions = Store.state.sessions || [];
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentSessions = sessions.filter((session) => {
    const finishedAt = new Date(session.finishedAt || session.date || 0).getTime();
    return Number.isFinite(finishedAt) && finishedAt >= sevenDaysAgo;
  });
  const doneWorkouts = recentSessions.length;
  const volumeKg = recentSessions.reduce((sum, session) => sum + Number(session.volumeKg || session.volume || 0), 0);
  const completedSets = recentSessions.reduce((sum, session) => sum + Number(session.completedSets || session.sets || 0), 0);
  document.querySelector("[data-stat-done]").textContent = doneWorkouts;
  document.querySelector("[data-stat-volume]").textContent = formatVolume(volumeKg);
  document.querySelector("[data-stat-sets]").textContent = completedSets;
  const currentCompletedSets = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  if (homeWorkoutAction) {
    homeWorkoutAction.disabled = !hasWorkout;
  }
  if (homeWorkoutLabel) {
    homeWorkoutLabel.textContent = hasWorkout
      ? currentCompletedSets > 0 ? "Continuar treino" : "Começar treino"
      : upcomingWorkout ? `Disponível em ${availabilityLabel}` : "Aguardando treino";
  }
  document.querySelector("[data-workout-title]").textContent = hasWorkout
    ? currentWorkout.title
    : upcomingWorkout ? `Treino ${upcomingWorkout.code} - ${upcomingWorkout.title}` : currentWorkout.title;
  document.querySelector("[data-workout-focus]").textContent = hasWorkout
    ? currentWorkout.focus
    : upcomingWorkout ? `Disponível em ${availabilityLabel}` : currentWorkout.focus;
  document.querySelector("[data-workout-plan-title]").textContent = currentWorkout.id === emptyWorkout.id ? "Sem treino ativo" : `Treino ${currentWorkout.code} - ${currentWorkout.title}`;
  document.querySelector("[data-workout-last]").textContent = currentWorkout.lastDoneLabel === "novo" ? "Ainda não executado" : `Última execução ${currentWorkout.lastDoneLabel}`;
  document.querySelector("[data-workout-minutes]").textContent = `${currentWorkout.estimatedMinutes} min`;
  document.querySelector("[data-workout-exercise-count]").textContent = `${getCurrentExercises().length} exercícios`;
  document.querySelector("[data-workout-set-count]").textContent = `${getTotalSets()} séries`;
  document.querySelectorAll("[data-active-workout-only]").forEach((element) => {
    element.hidden = !hasWorkout;
  });
};

const renderWorkoutProgress = () => {
  const exercises = getCurrentExercises();
  const totalSets = getTotalSets();
  const done = exercises.reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  const percent = totalSets > 0 ? Math.round((done / totalSets) * 100) : 0;
  document.querySelector("[data-session-count]").textContent = `${done}/${totalSets} séries`;
  document.querySelector("[data-session-progress]").style.setProperty("--progress", `${percent}%`);
  document.querySelector("[data-finish]").disabled = totalSets === 0 || done < totalSets;
  const isReady = totalSets > 0 && done >= totalSets;
  const nextExercise = exercises.find((exercise) => Store.getExerciseDone(exercise.id) < parseTotalSets(exercise));
  const nextDone = nextExercise ? Store.getExerciseDone(nextExercise.id) : 0;
  const nextTotal = nextExercise ? parseTotalSets(nextExercise) : 0;
  if (sessionDock) sessionDock.hidden = totalSets === 0;
  if (sessionDockTitle) sessionDockTitle.textContent = isReady ? "Treino completo" : nextExercise?.name || "Próxima série";
  if (sessionDockCopy) sessionDockCopy.textContent = isReady
    ? `${done} séries concluídas`
    : `Série ${nextDone + 1} de ${nextTotal} · ${done}/${totalSets} no treino`;
  if (sessionCta) sessionCta.textContent = isReady ? "Finalizar" : "Continuar";
  if (finishReadiness) finishReadiness.textContent = isReady ? "Pronto" : `${Math.max(0, totalSets - done)} restantes`;
  if (finishDisclosure) finishDisclosure.classList.toggle("is-ready", isReady);
  if (!isReady && finishDisclosure?.open) finishDisclosure.open = false;
};

const getWorkoutVolume = () => getCurrentExercises().reduce((sum, exercise) => {
  const done = Store.getExerciseDone(exercise.id);
  const log = Store.getExerciseLog(exercise.id, {
    load: parseLoadKg(exercise.load),
    reps: parseReps(exercise)
  });
  return sum + (done * Number(log.load || 0) * Number(log.reps || 0));
}, 0);

const getFinishFeedback = () => {
  const form = document.querySelector("[data-finish-feedback]");
  const data = form ? new FormData(form) : new FormData();
  return {
    effort: String(data.get("effort") || "ok"),
    pain: String(data.get("pain") || "none"),
    note: String(data.get("note") || "").trim()
  };
};

const buildWorkoutSessionPayload = () => {
  const sessionId = `session-${Date.now()}`;
  const finishedAt = new Date().toISOString();
  const startedAt = currentSessionStartedAt || finishedAt;
  const setLogs = getCurrentExercises().map((exercise, index) => {
    const completedSets = Store.getExerciseDone(exercise.id);
    const log = Store.getExerciseLog(exercise.id, {
      load: parseLoadKg(exercise.load),
      reps: parseReps(exercise)
    });
    const loadKg = Number(log.load || 0);
    const reps = Number(log.reps || 0);
    return {
      id: `${sessionId}-set-${String(index + 1).padStart(2, "0")}`,
      sessionId,
      coachId: currentWorkout.coachId || currentStudent.coachId || "",
      workoutId: currentWorkout.id,
      exerciseId: exercise.id,
      position: index,
      exerciseName: exercise.name,
      target: exercise.target,
      prescription: exercise.prescription,
      plannedSets: parseTotalSets(exercise),
      completedSets,
      loadKg,
      reps,
      volumeKg: completedSets * loadKg * reps,
      rir: exercise.rir,
      notes: exercise.notes
    };
  });
  const completedSets = setLogs.reduce((sum, log) => sum + log.completedSets, 0);
  const volumeKg = setLogs.reduce((sum, log) => sum + log.volumeKg, 0);
  const feedback = getFinishFeedback();

  return {
    id: sessionId,
    coachId: currentWorkout.coachId || currentStudent.coachId || "",
    studentId: currentStudent.id,
    studentKey: currentStudent.studentKey || currentWorkout.studentKey || "",
    studentEmail: currentStudent.email || "",
    workoutId: currentWorkout.id,
    workoutCode: currentWorkout.code,
    workoutTitle: currentWorkout.title,
    workoutVersion: currentWorkout.version || 1,
    totalSets: getTotalSets(),
    completedSets,
    volumeKg: Math.round(volumeKg),
    durationSeconds: Math.max(0, Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)),
    startedAt,
    finishedAt,
    feedback: {
      id: `${sessionId}-feedback`,
      sessionId,
      coachId: currentWorkout.coachId || currentStudent.coachId || "",
      studentId: currentStudent.id,
      ...feedback
    },
    setLogs
  };
};

const renderRestTimer = () => {
  const timer = document.querySelector("[data-rest-timer]");
  const label = document.querySelector("[data-rest-label]");
  timer.hidden = restRemaining <= 0;
  timer.classList.toggle("is-active", restRemaining > 0);
  label.textContent = restRemaining > 0 ? `${restRemaining}s restantes` : "Descanso concluído";
};

const stopRestTimer = () => {
  clearInterval(restTimerId);
  restTimerId = null;
  restRemaining = 0;
  renderRestTimer();
};

const startRestTimer = (seconds) => {
  clearInterval(restTimerId);
  restRemaining = seconds;
  renderRestTimer();
  restTimerId = setInterval(() => {
    restRemaining -= 1;
    if (restRemaining <= 0) {
      stopRestTimer();
      Platform.notify("Descanso finalizado. Próxima série liberada.");
      return;
    }
    renderRestTimer();
  }, 1000);
};

const lockSetButton = (exerciseId, button) => {
  setClickLocks.add(exerciseId);
  document.querySelectorAll(`[data-set="${exerciseId}"], [data-undo-set="${exerciseId}"]`).forEach((currentButton) => {
    currentButton.disabled = true;
    currentButton.classList.add("is-locked");
  });
  button.disabled = true;

  window.setTimeout(() => {
    setClickLocks.delete(exerciseId);
    const setButton = document.querySelector(`[data-set="${exerciseId}"]`);
    const undoButton = document.querySelector(`[data-undo-set="${exerciseId}"]`);
    setButton?.removeAttribute("disabled");
    setButton?.classList.remove("is-locked");
    if (undoButton) {
      undoButton.disabled = Store.getExerciseDone(exerciseId) <= 0;
      undoButton.classList.remove("is-locked");
    }
  }, SET_CLICK_DEBOUNCE_MS);
};

const playSetFeedback = (button) => {
  const exerciseCard = button.closest(".exercise");
  button.classList.remove("is-pressing");
  exerciseCard?.classList.remove("is-pressing");
  void button.offsetWidth;
  button.classList.add("is-pressing");
  exerciseCard?.classList.add("is-pressing");

  window.setTimeout(() => {
    button.classList.remove("is-pressing");
    exerciseCard?.classList.remove("is-pressing");
  }, 720);
};

const renderExercises = () => {
  const list = document.querySelector("[data-exercise-list]");
  const exercises = getCurrentExercises();
  if (!exercises.length) {
    list.innerHTML = `<article class="empty-state card"><strong>Nenhum exercício publicado.</strong><small>Peça ao personal para revisar este treino.</small></article>`;
    renderWorkoutProgress();
    return;
  }
  const nextExerciseId = exercises.find((exercise) => Store.getExerciseDone(exercise.id) < parseTotalSets(exercise))?.id;
  const fallbackFocusedId = exercises.some((exercise) => exercise.id === focusedExerciseId)
    ? focusedExerciseId
    : nextExerciseId;
  list.innerHTML = exercises.map((exercise, index) => {
    const total = parseTotalSets(exercise);
    const done = Store.getExerciseDone(exercise.id);
    const isComplete = done >= total;
    const isNext = exercise.id === nextExerciseId;
    const log = Store.getExerciseLog(exercise.id, {
      load: parseLoadKg(exercise.load),
      reps: parseReps(exercise)
    });
    const label = isComplete ? "Concluído" : `Registrar ${done + 1}/${total}`;
    const locked = setClickLocks.has(exercise.id);
    const isExpanded = !compactWorkoutQuery.matches || exercise.id === fallbackFocusedId;
    return `
      <article class="exercise card ${isComplete ? "is-complete" : ""} ${isNext ? "is-next" : ""} ${isExpanded ? "is-expanded" : ""}" data-exercise-id="${escapeHtml(exercise.id)}" ${isNext ? 'aria-current="step"' : ""}>
        <button class="exercise__summary" type="button" data-focus-exercise="${escapeHtml(exercise.id)}" aria-expanded="${String(isExpanded)}" tabindex="${compactWorkoutQuery.matches ? "0" : "-1"}">
          <span class="exercise__number">${String(index + 1).padStart(2, "0")}</span>
          <span class="exercise__heading">
            <strong>${escapeHtml(exercise.name)}</strong>
            <small>${escapeHtml(exercise.prescription)} · descanso ${escapeHtml(exercise.rest)}</small>
          </span>
          <span class="exercise__summary-state">
            <span class="chip" data-exercise-progress="${escapeHtml(exercise.id)}">${done}/${total}</span>
            <span class="exercise__chevron">${svgIcon("chevron-down")}</span>
          </span>
        </button>
        <div class="exercise__details" ${isExpanded ? "" : "hidden"}>
          <div class="exercise__meta">
            <span>${escapeHtml(exercise.target)}</span>
            <span>RIR ${escapeHtml(exercise.rir)}</span>
            <span>${escapeHtml(exercise.tempo)}</span>
          </div>
          <div class="set-log" aria-label="Registro rápido de ${escapeHtml(exercise.name)}">
            <label>Carga <input type="number" inputmode="decimal" min="0" step="0.5" value="${escapeHtml(log.load)}" data-log-load="${escapeHtml(exercise.id)}" aria-label="Carga usada em ${escapeHtml(exercise.name)}" /></label>
            <label>Reps <input type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(log.reps)}" data-log-reps="${escapeHtml(exercise.id)}" aria-label="Repetições por série em ${escapeHtml(exercise.name)}" /></label>
          </div>
          ${exercise.notes ? `<small>${escapeHtml(exercise.notes)}</small>` : ""}
        </div>
        <div class="exercise__actions" ${isExpanded ? "" : "hidden"}>
          <button class="set-button ${isComplete ? "is-done" : ""} ${locked ? "is-locked" : ""}" type="button" data-set="${escapeHtml(exercise.id)}" data-total="${total}" aria-label="Registrar série de ${escapeHtml(exercise.name)}" ${locked ? "disabled" : ""}>
            ${label}
          </button>
          <button class="exercise__undo" type="button" data-undo-set="${escapeHtml(exercise.id)}" aria-label="Corrigir última série de ${escapeHtml(exercise.name)}" ${done === 0 || locked ? "disabled" : ""}>Corrigir</button>
        </div>
      </article>
    `;
  }).join("");
  renderWorkoutProgress();
};

const renderProgress = () => {
  const entries = Store.getProgressEntries([]);
  const historySection = document.querySelector("[data-progress-history]");
  if (progressDisclosure && progressDisclosure.dataset.initialized !== "true") {
    progressDisclosure.open = entries.length === 0;
    progressDisclosure.dataset.initialized = "true";
  }
  if (historySection) historySection.hidden = entries.length === 0;
  if (!entries.length) {
    document.querySelector("[data-chart]").replaceChildren();
    document.querySelector("[data-metric-list]").replaceChildren();
    document.querySelector("[data-measurement-history]").replaceChildren();
    return;
  }
  const recentEntries = entries.slice(-7);
  const latest = entries.at(-1);
  const weights = recentEntries.map((entry) => entry.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const span = Math.max(maxWeight - minWeight, 1);
  const metricDefinitions = [
    { field: "weight", icon: "scale", label: "Peso", unit: "kg" },
    { field: "waist", icon: "ruler", label: "Cintura", unit: "cm" },
    { field: "arm", icon: "weight", label: "Braço", unit: "cm" }
  ];
  const metrics = metricDefinitions
    .filter(({ field }) => Number(latest[field]) > 0)
    .map((metric) => {
      const previousEntry = [...entries].slice(0, -1).reverse().find((entry) => Number(entry[metric.field]) > 0);
      const previousValue = previousEntry?.[metric.field];
      return {
        ...metric,
        helper: "Registro atual",
        value: `${formatDecimal(latest[metric.field])} ${metric.unit}`,
        delta: previousValue === undefined ? "Primeiro registro" : formatDelta(latest[metric.field], previousValue, metric.unit),
        tone: previousValue === undefined ? "neutral" : deltaTone(latest[metric.field], previousValue)
      };
    });

  document.querySelector("[data-chart]").innerHTML = recentEntries.map((entry) => {
    const height = 28 + Math.round(((entry.weight - minWeight) / span) * 63);
    return `<span style="--height: ${height}%"><small>${formatShortDate(entry.date)}</small></span>`;
  }).join("");
  document.querySelector("[data-measurements-date]").textContent = formatShortDate(latest.date);
  document.querySelector("[data-metric-list]").innerHTML = metrics.map((metric) => `
    <article class="metric card">
      <span class="surface-icon">${svgIcon(metric.icon)}</span>
      <div><strong>${metric.label}</strong><small>${metric.helper}</small></div>
      <div class="metric__value" data-delta-tone="${metric.tone}"><strong>${metric.value}</strong><small>${metric.delta}</small></div>
    </article>
  `).join("");
  document.querySelector("[data-measurement-history]").innerHTML = [...entries].reverse().slice(0, 6).map((entry) => {
    const complementaryMeasures = [
      Number(entry.waist) > 0 ? `Cintura ${formatDecimal(entry.waist)} cm` : "",
      Number(entry.arm) > 0 ? `Braço ${formatDecimal(entry.arm)} cm` : ""
    ].filter(Boolean);
    return `
      <article class="measurement-row card">
        <span class="surface-icon">${svgIcon("ruler")}</span>
        <div><strong>${formatShortDate(entry.date)}</strong><small>Peso ${formatDecimal(entry.weight)} kg</small></div>
        ${complementaryMeasures.map((measure) => `<span>${measure}</span>`).join("")}
      </article>
    `;
  }).join("");
};

const renderSchedule = () => {
  const filter = Store.state.scheduleFilter || "Todos";
  const workoutItems = upcomingWorkouts.map((workout) => ({
    id: `published-${workout.id}`,
    type: "Treino",
    title: `Treino ${workout.code} - ${workout.title}`,
    detail: workout.focus,
    time: workout.startsAt,
    source: "personal"
  }));
  const items = [...workoutItems, ...Store.getScheduleItems(scheduleItems)]
    .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
  const visibleItems = filter === "Todos" ? items : items.filter((item) => item.type === filter);
  const pendingCount = items.filter((item) => item.source === "personal" || !Store.isReminderDone(item.id)).length;
  document.querySelector("[data-schedule-count]").textContent = `${pendingCount} ${pendingCount === 1 ? "próximo" : "próximos"}`;
  document.querySelectorAll("[data-schedule-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scheduleFilter === filter);
  });
  if (!visibleItems.length) {
    document.querySelector("[data-schedule-list]").innerHTML =
      items.length
        ? `<article class="empty-state card"><strong>Nenhum item neste filtro.</strong><small>Escolha outra categoria para continuar.</small></article>`
        : `<article class="empty-state card"><strong>Agenda livre.</strong><small>Adicione um lembrete quando precisar.</small></article>`;
    return;
  }
  document.querySelector("[data-schedule-list]").innerHTML = visibleItems.map((item) => {
    const fromPersonal = item.source === "personal";
    const done = !fromPersonal && Store.isReminderDone(item.id);
    return `
      <article class="schedule-item card ${done ? "is-muted" : ""}">
        <span class="surface-icon">${svgIcon(scheduleIconByType[item.type] || "calendar")}</span>
        <div>
          <span class="chip">${escapeHtml(scheduleLabelByType[item.type] || item.type)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.detail)}</p>
          <small>${fromPersonal ? `Disponível em ${escapeHtml(formatWorkoutAvailability(item.time))}` : escapeHtml(formatScheduleTime(item.time))}</small>
        </div>
        ${fromPersonal
          ? `<span class="chip">Agendado</span>`
          : `<button class="icon-button" type="button" data-reminder="${escapeHtml(item.id)}" aria-label="${done ? "Reativar" : "Dispensar"} lembrete">
              ${done ? svgIcon("refresh") : svgIcon("check")}
            </button>`}
      </article>
    `;
  }).join("");
};

const renderNotifications = () => {
  const unreadCount = notificationItems.filter((item) => !Store.isNotificationRead(item.id)).length;
  if (headerNotificationButton) headerNotificationButton.hidden = notificationItems.length === 0;
  document.querySelector("[data-notification-count]").textContent = unreadCount;
  document.querySelector("[data-notification-count]").classList.toggle("is-hidden", unreadCount === 0);
  if (!notificationItems.length) {
    document.querySelector("[data-notification-list]").innerHTML =
      `<article class="empty-state card"><strong>Nenhum aviso por enquanto.</strong><small>Quando houver algo novo, aparecerá aqui.</small></article>`;
    return;
  }
  document.querySelector("[data-notification-list]").innerHTML = notificationItems.map((item) => {
    const read = Store.isNotificationRead(item.id);
    return `
      <article class="notification-item card ${read ? "is-read" : ""}">
        <div class="notification-item__content">
          <span class="surface-icon">${svgIcon(notificationIconByType[item.type] || "bell")}</span>
          <div>
            <span class="chip">${item.type}</span>
            <h3>${item.title}</h3>
            <p>${item.detail}</p>
            <small>${item.time}</small>
          </div>
        </div>
        <button class="button button--quiet" type="button" data-notification="${item.id}" data-notification-action="${item.action}">
          ${item.action} ${svgIcon("arrow-right")}
        </button>
      </article>
    `;
  }).join("");
};

const renderHistory = () => {
  const sessions = Store.state.sessions || [];
  const target = document.querySelector("[data-history-list]");
  if (!sessions.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhum treino concluído.</strong><small>Conclua o treino de hoje para enviar o primeiro feedback ao professor.</small></article>`;
    return;
  }
  target.innerHTML = sessions.map((session) => `
    <article class="history-row card ${session.syncStatus === "synced" ? "is-synced" : "is-pending"}">
      <span class="surface-icon">${svgIcon("trophy")}</span>
      <div>
        <strong>${escapeHtml(session.workoutTitle || session.title)}</strong>
        <small>${escapeHtml(formatDateTime(session.finishedAt))} · ${escapeHtml(effortLabelByValue[session.feedback?.effort] || "Sem avaliação")}</small>
      </div>
      <span class="chip">${session.completedSets || session.sets || 0}/${session.totalSets || session.sets || 0} séries</span>
      <small class="history-row__sync">${formatVolume(session.volumeKg || session.volume || 0)} de volume · ${session.syncStatus === "synced" ? "Enviado ao professor" : "Envio pendente"}</small>
    </article>
  `).join("");
};

const renderAll = () => {
  renderStudent();
  renderAccessSelectors();
  renderHome();
  renderExercises();
  renderProgress();
  renderSchedule();
  renderNotifications();
  renderHistory();
};

const retryPendingSessions = async () => {
  if (!currentStudent?.id || !currentStudent?.coachId) return 0;
  try {
    const result = await sessionRepository.syncPendingSessions({
      studentId: currentStudent.id,
      coachId: currentStudent.coachId
    });
    result.sessions.forEach((session) => Store.addSession(session));
    return result.syncedCount;
  } catch {
    return 0;
  }
};

const startAuthenticatedApp = async () => {
  const session = await authRepository.getSession();
  if (!session?.user) {
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    syncAuthMode("signin");
    return false;
  }

  const authContextBeforeClaim = await authRepository.getAuthContext();
  if (authContextBeforeClaim?.role && !authRepository.canAccessStudent(authContextBeforeClaim)) {
    await authRepository.signOut();
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    syncAuthMode("signin", { preserveStatus: true });
    setAuthStatus("Esta conta não tem permissão para acessar a área do aluno.", "warning");
    return false;
  }

  const accessToken = getInviteToken();
  const accessClaim = await studentRepository.claimAccess(accessToken);
  if (!accessClaim.claimed) {
    await authRepository.signOut();
    if (accessToken) {
      pendingInviteToken = "";
      Platform.storage.remove(PENDING_INVITE_KEY);
    }
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    studentAccesses = [];
    availableWorkouts = [];
    upcomingWorkouts = [];
    renderAll();
    syncOnboarding();
    syncAuthMode("signin", { preserveStatus: true });
    setAuthStatus(
      accessToken
        ? "Este convite é inválido, expirou ou pertence a outro email. Peça um novo link ao personal."
        : "Este email ainda não foi cadastrado por um personal. Nenhum acesso ao FlowFit foi criado.",
      "warning"
    );
    return false;
  }

  pendingInviteToken = "";
  Platform.storage.remove(PENDING_INVITE_KEY);
  const claimedStudentId = accessToken ? accessClaim.studentId || "" : "";
  let linkedStudentResult = null;
  if (!authContextBeforeClaim?.profile) {
    linkedStudentResult = await studentRepository.fetchCurrentStudent({ preferredStudentId: claimedStudentId });
    if (!linkedStudentResult.student) {
      await authRepository.signOut();
      activateAnonymousStore();
      currentStudent = emptyStudent;
      currentWorkout = emptyWorkout;
      renderAll();
      syncOnboarding();
      syncAuthMode("signin", { preserveStatus: true });
      setAuthStatus("Primeiro acesso exige o link de convite enviado pelo seu personal.", "warning");
      return false;
    }
  }

  let authContext = await authRepository.getAuthContext();
  if (linkedStudentResult?.student && authContext?.user && !authContext.role) {
    // claim_student_access e atomico e so retorna sucesso depois de criar o
    // profile student. Nao bloqueia o aluno por atraso na leitura seguinte.
    authContext = {
      ...authContext,
      role: "student",
      profile: {
        userId: authContext.user.id,
        role: "student",
        name: session.user.user_metadata?.display_name || session.user.email
      }
    };
  }
  if (!authRepository.canAccessStudent(authContext)) {
    await authRepository.signOut();
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    syncAuthMode("signin", { preserveStatus: true });
    setAuthStatus("A conta autenticada não tem permissão para acessar a área do aluno.", "warning");
    return false;
  }

  const studentResult = linkedStudentResult || await studentRepository.fetchCurrentStudent({
    preferredStudentId: claimedStudentId
  });
  if (!studentResult.student) {
    await authRepository.signOut();
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    syncAuthMode("signin", { preserveStatus: true });
    setAuthStatus("Sua conta não tem nenhum aluno vinculado. Abra o convite enviado pelo personal.", "warning");
    Platform.notify("Peça ao personal para enviar um novo link de convite.");
    return false;
  }

  studentAccesses = (studentResult.students || [studentResult.student]).filter(Boolean);
  const storedStudentId = Platform.storage.get(`${ACTIVE_STUDENT_KEY}:${session.user.id}`, "");
  const selectedStudent = studentAccesses.find((student) => student.id === claimedStudentId)
    || studentAccesses.find((student) => student.id === storedStudentId)
    || studentResult.student;
  currentStudent = toRuntimeStudent(selectedStudent, authContext);
  Platform.storage.set(`${ACTIVE_STUDENT_KEY}:${session.user.id}`, currentStudent.id);
  activateStudentStore();

  currentWorkout = emptyWorkout;
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
  const retriedSessions = await retryPendingSessions();
  renderAll();
  syncOnboarding();
  navigate(location.hash.slice(1) || "home", false);

  if (studentResult.multiple) {
    setAuthStatus("Acesso ativo. Use o seletor no perfil para alternar entre seus personais.", "synced");
  } else {
    setAuthStatus("Acesso ativo. Treino carregado.", "synced");
  }
  if (retriedSessions > 0) {
    Platform.notify(`${retriedSessions} ${retriedSessions === 1 ? "treino pendente enviado" : "treinos pendentes enviados"}.`);
  }

  return true;
};

const switchStudentAccess = async (studentId) => {
  const student = studentAccesses.find((item) => item.id === studentId);
  if (!student || student.id === currentStudent.id) return;
  const authContext = await authRepository.getAuthContext();
  currentStudent = toRuntimeStudent(student, authContext);
  Platform.storage.set(`${ACTIVE_STUDENT_KEY}:${authContext?.user?.id || "user"}`, currentStudent.id);
  activateStudentStore();
  availableWorkouts = [];
  upcomingWorkouts = [];
  currentWorkout = emptyWorkout;
  focusedExerciseId = "";
  setClickLocks.clear();
  stopRestTimer();
  currentSessionStartedAt = new Date().toISOString();
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
  const retriedSessions = await retryPendingSessions();
  renderAll();
  if (retriedSessions > 0) {
    Platform.notify(`Personal ativo: ${currentStudent.coach}. ${retriedSessions} ${retriedSessions === 1 ? "treino pendente enviado" : "treinos pendentes enviados"}.`);
  } else {
    Platform.notify(`Personal ativo: ${currentStudent.coach}.`);
  }
};

const selectWorkout = (workoutId) => {
  const workout = availableWorkouts.find((item) => item.id === workoutId);
  if (!workout || workout.id === currentWorkout.id) return;
  currentWorkout = workout;
  Platform.storage.set(`${ACTIVE_WORKOUT_KEY}:${currentStudent.id}`, workout.id);
  focusedExerciseId = "";
  setClickLocks.clear();
  stopRestTimer();
  currentSessionStartedAt = new Date().toISOString();
  renderAll();
  Platform.notify(`Treino ${workout.code} selecionado.`);
};

navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(item.dataset.nav);
}));

document.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.go)));

document.addEventListener("click", (event) => {
  const exerciseFocusButton = event.target.closest("[data-focus-exercise]");
  if (exerciseFocusButton && compactWorkoutQuery.matches) {
    focusedExerciseId = exerciseFocusButton.dataset.focusExercise;
    renderExercises();
    window.setTimeout(() => document.querySelector(`[data-exercise-id="${focusedExerciseId}"] [data-log-load]`)?.focus(), 40);
    return;
  }

  const workoutChoice = event.target.closest("[data-select-workout]");
  if (workoutChoice) {
    selectWorkout(workoutChoice.dataset.selectWorkout);
    return;
  }

  const filterButton = event.target.closest("[data-schedule-filter]");
  if (filterButton) {
    Store.setScheduleFilter(filterButton.dataset.scheduleFilter);
    renderSchedule();
  }

  const undoSetButton = event.target.closest("[data-undo-set]");
  if (undoSetButton) {
    const exerciseId = undoSetButton.dataset.undoSet;
    if (setClickLocks.has(exerciseId)) return;
    const current = Store.getExerciseDone(exerciseId);
    if (current <= 0) return;
    lockSetButton(exerciseId, undoSetButton);
    Store.setExerciseDone(exerciseId, current - 1);
    stopRestTimer();
    renderExercises();
    renderHome();
    Platform.vibrate(18);
    Platform.notify("Última série removida.");
    return;
  }

  const setButton = event.target.closest("[data-set]");
  if (setButton) {
    const exerciseId = setButton.dataset.set;
    if (setClickLocks.has(exerciseId)) return;
    const exercise = getCurrentExercises().find((item) => item.id === exerciseId);
    if (!exercise) return;
    const total = parseTotalSets(exercise);
    const current = Store.getExerciseDone(exercise.id);
    if (current >= total) {
      Platform.notify("Exercício concluído. Use Corrigir para alterar.");
      return;
    }
    const next = current + 1;
    lockSetButton(exercise.id, setButton);
    playSetFeedback(setButton);
    Store.setExerciseDone(exercise.id, next);
    setButton.textContent = next >= total ? "Concluído" : `Registrar ${next + 1}/${total}`;
    setButton.classList.toggle("is-done", next >= total);
    const exerciseCard = setButton.closest(".exercise");
    exerciseCard?.classList.toggle("is-complete", next >= total);
    const exerciseProgress = exerciseCard?.querySelector("[data-exercise-progress]");
    if (exerciseProgress) exerciseProgress.textContent = `${next}/${total}`;
    renderWorkoutProgress();
    renderHome();
    Platform.vibrate(25);
    const completedWorkoutSets = getCurrentExercises().reduce((sum, item) => sum + Store.getExerciseDone(item.id), 0);
    if (completedWorkoutSets < getTotalSets()) startRestTimer(parseRestSeconds(exercise));
    else stopRestTimer();
    if (next >= total) {
      Platform.notify("Exercício concluído. Boa!");
      if (compactWorkoutQuery.matches) {
        window.setTimeout(() => {
          if (Store.getExerciseDone(exercise.id) < total) return;
          focusedExerciseId = "";
          renderExercises();
        }, 760);
      }
    }
  }

  const reminderButton = event.target.closest("[data-reminder]");
  if (reminderButton) {
    Store.toggleReminder(reminderButton.dataset.reminder);
    renderSchedule();
    Platform.notify("Agenda atualizada neste aparelho.");
  }

  const notificationButton = event.target.closest("[data-notification]");
  if (notificationButton) {
    Store.markNotificationRead(notificationButton.dataset.notification);
    renderNotifications();
    navigate(notificationActionPage[notificationButton.dataset.notificationAction] || "notifications");
  }
});

document.addEventListener("input", (event) => {
  const loadInput = event.target.closest("[data-log-load]");
  if (loadInput) {
    Store.setExerciseLog(loadInput.dataset.logLoad, { load: Number(loadInput.value || 0) });
  }

  const repsInput = event.target.closest("[data-log-reps]");
  if (repsInput) {
    Store.setExerciseLog(repsInput.dataset.logReps, { reps: Number(repsInput.value || 0) });
  }
});

document.querySelector("[data-coach-selector]")?.addEventListener("change", (event) => {
  switchStudentAccess(event.currentTarget.value);
});

document.querySelector("[data-progress-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  Store.addProgressEntry({
    id: `measure-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    weight: Number(data.get("weight") || 0),
    waist: data.get("waist") ? Number(data.get("waist")) : null,
    arm: data.get("arm") ? Number(data.get("arm")) : null
  });
  event.currentTarget.reset();
  if (progressDisclosure) progressDisclosure.open = false;
  renderProgress();
  Platform.notify("Check-in salvo.");
});

document.querySelector("[data-schedule-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
    Store.addScheduleItem({
      id: `custom-schedule-${Date.now()}`,
      time: String(data.get("time") || "Hoje"),
      title: String(data.get("title") || "Novo lembrete"),
      detail: "Lembrete criado.",
      type: String(data.get("type") || "Treino")
    });
  Store.setScheduleFilter("Todos");
  event.currentTarget.reset();
  if (scheduleDisclosure) scheduleDisclosure.open = false;
  renderSchedule();
  Platform.notify("Lembrete adicionado.");
});

sessionCta?.addEventListener("click", () => {
  const totalSets = getTotalSets();
  const done = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  if (totalSets > 0 && done >= totalSets) {
    if (finishDisclosure) finishDisclosure.open = true;
    finishDisclosure?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => document.querySelector("[data-feedback-effort]")?.focus(), 320);
    return;
  }

  const nextExercise = getCurrentExercises().find((exercise) => Store.getExerciseDone(exercise.id) < parseTotalSets(exercise));
  if (nextExercise && compactWorkoutQuery.matches) {
    focusedExerciseId = nextExercise.id;
    renderExercises();
  }
  const nextSet = document.querySelector(".exercise .set-button:not(.is-done)");
  nextSet?.closest(".exercise")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => nextSet?.focus(), 320);
});

document.querySelector("[data-finish]")?.addEventListener("click", async (event) => {
  const totalSets = getTotalSets();
  const done = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  if (done < totalSets) {
    Platform.notify("Registre todas as séries antes de finalizar.");
    return;
  }
  const finishButton = event.currentTarget;
  finishButton.disabled = true;
  setFinishStatus("Finalizando treino e enviando ao professor...", "");
  const session = buildWorkoutSessionPayload();
  Store.addSession(session);
  Store.resetWorkout(currentWorkout.id);
  focusedExerciseId = "";
  stopRestTimer();
  renderAll();
  const result = await sessionRepository.syncSession(session);
  if (result.session) Store.addSession(result.session);
  renderAll();
  currentSessionStartedAt = new Date().toISOString();
  document.querySelector("[data-finish-feedback]")?.reset();
  setFinishStatus(
    result.synced
      ? "Treino enviado ao professor com cargas, reps e feedback."
      : result.session?.syncMessage || result.error?.message || "Treino salvo localmente; envio pendente.",
    result.synced ? "synced" : "warning"
  );
  finishButton.disabled = false;
  Platform.vibrate([40, 40, 80]);
  Platform.notify(result.synced ? "Treino concluído e enviado ao professor!" : "Treino concluído. Envio pendente.");
  navigate("progress");
});

document.querySelector("[data-reset-workout]")?.addEventListener("click", () => {
  const completedSets = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  if (completedSets > 0 && !window.confirm("Reiniciar este treino e apagar as séries registradas?")) return;
  Store.resetWorkout(currentWorkout.id);
  focusedExerciseId = "";
  currentSessionStartedAt = new Date().toISOString();
  renderExercises();
  Platform.notify("Registro do treino atual reiniciado.");
});

document.querySelector("[data-skip-rest]")?.addEventListener("click", () => {
  stopRestTimer();
  Platform.notify("Descanso encerrado.");
});

onboardingForm?.addEventListener("click", async (event) => {
  const oauthButton = event.target.closest("[data-oauth-provider]");
  if (oauthButton) {
    event.preventDefault();
    await handleOAuthSignIn(oauthButton.dataset.oauthProvider);
    return;
  }

});

onboardingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(onboardingForm));
  setAuthStatus("Enviando link seguro...", "");

  const inviteToken = getInviteToken();
  if (inviteToken) {
    const inviteResult = await studentRepository.validateInvite({ token: inviteToken, email: data.email });
    if (!inviteResult.valid || !inviteResult.emailMatches) {
      if (inviteResult.reason !== "email-mismatch") {
        pendingInviteToken = "";
        Platform.storage.remove(PENDING_INVITE_KEY);
        syncAuthMode("access", { preserveStatus: true });
      }
      setAuthStatus("Convite inválido, expirado ou usado com um email diferente do cadastrado pelo personal.", "warning");
      return;
    }
  }

  const result = await authRepository.signInWithMagicLink({
    email: data.email,
    redirectTo: getAuthRedirectUrl()
  });

  if (!result.ok) {
    setAuthStatus(result.message || "Não foi possível enviar o link de acesso.", "warning");
    return;
  }
  setAuthStatus(result.message, "synced");
});

const signOut = async () => {
  await authRepository.signOut();
  activateAnonymousStore();
  Theme.reset();
  currentStudent = emptyStudent;
  currentWorkout = emptyWorkout;
  studentAccesses = [];
  availableWorkouts = [];
  upcomingWorkouts = [];
  focusedExerciseId = "";
  setClickLocks.clear();
  stopRestTimer();
  renderAll();
  syncOnboarding();
  syncAuthMode("signin");
  setAuthStatus("Sessão encerrada.", "");
  Platform.notify("Sessão encerrada.");
};

document.querySelector("[data-reset-onboarding]")?.addEventListener("click", signOut);

document.querySelector("[data-mark-all-read]")?.addEventListener("click", () => {
  Store.markAllNotificationsRead(notificationItems.map((item) => item.id));
  renderNotifications();
  Platform.notify("Todas as notificações foram marcadas como lidas.");
});

accentInput?.addEventListener("input", () => Theme.apply({ accent: accentInput.value }));
brandInput?.addEventListener("input", () => Theme.apply({ brandName: brandInput.value.trim() || "FlowFit" }));
taglineInput?.addEventListener("input", () => Theme.apply({ tagline: taglineInput.value.trim() || "Seu treino, no seu ritmo" }));
modeButtons.forEach((button) => button.addEventListener("click", () => Theme.apply({ mode: button.dataset.mode })));
const handleWorkoutDensityChange = () => {
  focusedExerciseId = "";
  renderExercises();
};
if (compactWorkoutQuery.addEventListener) compactWorkoutQuery.addEventListener("change", handleWorkoutDensityChange);
else compactWorkoutQuery.addListener?.(handleWorkoutDensityChange);
document.querySelector("[data-theme-reset]")?.addEventListener("click", () => {
  Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, {});
  Theme.reset();
  syncThemeControls();
  Platform.notify("Aparência original restaurada.");
});

window.addEventListener("hashchange", () => navigate(location.hash.slice(1), false));
window.addEventListener("app:notify", (event) => showToast(event.detail));
window.addEventListener("app:theme", syncThemeControls);
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith(REMOTE_THEME_KEY) || event.key === LEGACY_REMOTE_THEME_KEY) applyPublishedBrandTheme();
  if (event.key === LOCAL_BRAND_ASSETS_KEY) syncBrandAssets();
  if (event.key === PUBLISHED_WORKOUTS_KEY) {
    refreshPublishedWorkout();
  }
});

let foregroundRefreshAt = 0;
const refreshOnForeground = async () => {
  if (!Store.state.onboarded || !currentStudent?.coachId || Date.now() - foregroundRefreshAt < 1500) return;
  foregroundRefreshAt = Date.now();
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
};

window.addEventListener("pageshow", refreshOnForeground);
window.addEventListener("focus", refreshOnForeground);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshOnForeground();
});

syncAuthMode(getInviteToken() ? "signup" : "signin");
Theme.reset();
syncThemeControls();
renderAll();
renderRestTimer();
navigate(location.hash.slice(1) || "home", false);

if (Platform.canUseServiceWorker() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

startAuthenticatedApp().finally(() => {
  markRuntimeReady();
});
