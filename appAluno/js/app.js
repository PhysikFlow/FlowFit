import { Platform } from "./core/platform.js?v=build-20260813-1";
import { SESSION_PHASE, Store } from "./core/store.js?v=build-20260813-1";
import { Theme } from "./core/theme.js?v=build-20260813-1";
import { svgIcon } from "./core/icons.js?v=build-20260810-7";
import { LEGACY_REMOTE_THEME_KEY, LOCAL_BRAND_ASSETS_KEY, REMOTE_THEME_KEY } from "./core/brand-theme.js?v=build-20260809-7";
import { authRepository } from "./data/repositories/auth-repository.js?v=build-20260812-6";
import { studentRepository } from "./data/repositories/student-repository.js?v=build-20260813-2";
import { themeRepository } from "./data/repositories/theme-repository.js?v=build-20260813-1";
import { PUBLISHED_WORKOUTS_KEY, workoutDateInputValue, workoutRepository } from "./data/repositories/workout-repository.js?v=build-20260813-2";
import { sessionRepository } from "./data/repositories/session-repository.js?v=build-20260813-1";

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const appShell = document.querySelector(".app");
const onboarding = document.querySelector("[data-onboarding]");
const onboardingForm = document.querySelector("[data-onboarding-form]");
const authSessionCheck = document.querySelector("[data-auth-session-check]");
const authContent = document.querySelector("[data-auth-content]");
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
const workoutRunner = document.querySelector("[data-workout-runner]");
const runnerActionBar = document.querySelector("[data-runner-action-bar]");
const runnerSwipeFeedback = document.querySelector("[data-runner-swipe-feedback]");
const exerciseSheet = document.querySelector("[data-exercise-sheet]");
const infoDialog = document.querySelector("[data-info-dialog]");
const discomfortDialog = document.querySelector("[data-discomfort-dialog]");
const pauseDialog = document.querySelector("[data-pause-dialog]");
const discomfortForm = document.querySelector("[data-discomfort-form]");
const progressDisclosure = document.querySelector("[data-progress-disclosure]");
const scheduleDisclosure = document.querySelector("[data-schedule-disclosure]");
const accentInput = document.querySelector("[data-accent]");
const brandInput = document.querySelector("[data-brand-input]");
const taglineInput = document.querySelector("[data-tagline-input]");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
let toastTimer;
let runnerTickId;
let wakeLockSentinel = null;
const SET_CLICK_DEBOUNCE_MS = 2000;
const SET_TRANSITION_MS = 720;
const RUNNER_ADJUST_HOLD_DELAY_MS = 420;
const RUNNER_ADJUST_REPEAT_MS = 110;
const setClickLocks = new Set();
let runnerSwipe = null;
let runnerAdjustHold = null;
let suppressedRunnerAdjustButton = null;
let suppressRunnerAdjustClickUntil = 0;
let suppressRunnerClickUntil = 0;
let appNavSwipe = null;
let suppressAppClickUntil = 0;
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
let previousSessions = [];
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

const normalizeExerciseName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const getActiveSession = () => {
  const session = Store.getActiveSession();
  if (!session || session.studentId !== currentStudent.id) return null;
  return session;
};

const getSessionExercises = (session = getActiveSession()) => (
  Array.isArray(session?.workoutSnapshot?.exercises) ? session.workoutSnapshot.exercises : []
);

const getSessionEntries = (session = getActiveSession()) => (
  Array.isArray(session?.setEntries) ? session.setEntries : []
);

const getLastSessionEntry = (session = getActiveSession()) => getSessionEntries(session)
  .reduce((latest, entry) => {
    if (!latest) return entry;
    const latestTime = new Date(latest.completedAt || 0).getTime() || 0;
    const entryTime = new Date(entry.completedAt || 0).getTime() || 0;
    return entryTime >= latestTime ? entry : latest;
  }, null);

const occurrenceId = (exercise) => exercise?.workoutExerciseId || exercise?.id || "";

const getExerciseEntries = (workoutExerciseId, session = getActiveSession()) => getSessionEntries(session)
  .filter((entry) => (entry.workoutExerciseId || entry.exerciseId) === workoutExerciseId)
  .sort((a, b) => Number(a.setNumber || 0) - Number(b.setNumber || 0));

const getCompletedSetCount = (exerciseId, session = getActiveSession()) => getExerciseEntries(exerciseId, session).length;

const getCompletedSessionSets = (session = getActiveSession()) => getSessionEntries(session).length;

const getSessionTotalSets = (session = getActiveSession()) => getSessionExercises(session)
  .reduce((sum, exercise) => sum + parseTotalSets(exercise), 0);

const findSessionExercise = (workoutExerciseId, session = getActiveSession()) => getSessionExercises(session)
  .find((exercise) => occurrenceId(exercise) === workoutExerciseId) || null;

const getNextIncompleteTarget = (session = getActiveSession(), afterExerciseId = "") => {
  const exercises = getSessionExercises(session);
  if (!exercises.length) return null;
  const startIndex = Math.max(0, exercises.findIndex((exercise) => occurrenceId(exercise) === afterExerciseId));
  const ordered = [...exercises.slice(startIndex), ...exercises.slice(0, startIndex)];
  for (const exercise of ordered) {
    const completedNumbers = new Set(getExerciseEntries(occurrenceId(exercise), session).map((entry) => Number(entry.setNumber)));
    const total = parseTotalSets(exercise);
    for (let setNumber = 1; setNumber <= total; setNumber += 1) {
      if (!completedNumbers.has(setNumber)) return { exercise, setNumber };
    }
  }
  return null;
};

const findPreviousSet = (exercise, setNumber) => {
  for (const session of previousSessions) {
    if (session.status !== "completed" && session.status !== "partial") continue;
    const historicalExerciseId = exercise.exerciseId || exercise.id;
    const exactLogs = (session.setLogs || []).filter((log) => log.exerciseId === historicalExerciseId);
    const nameLogs = (session.setLogs || []).filter((log) => (
      normalizeExerciseName(log.exerciseName) === normalizeExerciseName(exercise.name)
    ));
    const logs = exactLogs.length ? exactLogs : nameLogs;
    const individual = logs.find((log) => Number(log.setNumber) === Number(setNumber));
    if (individual) return individual;
    const legacy = logs.find((log) => !log.setNumber && Number(log.completedSets || 0) >= Number(setNumber));
    if (legacy) return legacy;
  }
  return null;
};

const findPreviousExerciseLogs = (exercise) => {
  for (const session of previousSessions) {
    if (!["completed", "partial"].includes(session.status)) continue;
    const historicalExerciseId = exercise.exerciseId || exercise.id;
    const exactLogs = (session.setLogs || []).filter((log) => log.exerciseId === historicalExerciseId);
    const nameLogs = (session.setLogs || []).filter((log) => (
      normalizeExerciseName(log.exerciseName) === normalizeExerciseName(exercise.name)
    ));
    const logs = exactLogs.length ? exactLogs : nameLogs;
    if (logs.length) return [...logs].sort((a, b) => Number(a.setNumber || 0) - Number(b.setNumber || 0));
  }
  return [];
};

const createStableId = (prefix) => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getElapsedSeconds = (session, now = Date.now()) => {
  const startedAt = new Date(session?.startedAt || now).getTime();
  const pausedAt = session?.pausedAt ? new Date(session.pausedAt).getTime() : null;
  const activeUntil = Number.isFinite(pausedAt) ? pausedAt : now;
  return Math.max(0, Math.floor((activeUntil - startedAt) / 1000) - Number(session?.pausedDurationSeconds || 0));
};

const pauseActiveSession = (session = getActiveSession()) => {
  if (!session || session.phase === SESSION_PHASE.PAUSED) return session;
  return Store.updateActiveSession({
    phase: SESSION_PHASE.PAUSED,
    resumePhase: session.phase,
    pausedAt: new Date().toISOString()
  });
};

const resumeActiveSession = (session = getActiveSession()) => {
  if (!session || session.phase !== SESSION_PHASE.PAUSED) return session;
  const pausedAt = new Date(session.pausedAt || Date.now()).getTime();
  const pausedFor = Number.isFinite(pausedAt) ? Math.max(0, Math.floor((Date.now() - pausedAt) / 1000)) : 0;
  let phase = session.resumePhase || SESSION_PHASE.ACTIVE_SET;
  if (phase === SESSION_PHASE.TRANSITIONING && new Date(session.transitionEndsAt || 0).getTime() <= Date.now()) {
    phase = session.pendingExerciseId ? SESSION_PHASE.RESTING : SESSION_PHASE.AWAITING_SUMMARY;
  }
  if (phase === SESSION_PHASE.RESTING && new Date(session.restEndsAt || 0).getTime() <= Date.now()) {
    phase = session.pendingExerciseId || session.currentExerciseId
      ? SESSION_PHASE.ACTIVE_SET
      : SESSION_PHASE.AWAITING_SUMMARY;
  }
  return Store.updateActiveSession({
    phase,
    resumePhase: null,
    pausedAt: null,
    pausedDurationSeconds: Number(session.pausedDurationSeconds || 0) + pausedFor,
    transitionEndsAt: phase === SESSION_PHASE.TRANSITIONING ? session.transitionEndsAt : null,
    restEndsAt: phase === SESSION_PHASE.RESTING ? session.restEndsAt : null,
    pendingExerciseId: [SESSION_PHASE.TRANSITIONING, SESSION_PHASE.RESTING].includes(phase) ? session.pendingExerciseId : null,
    pendingSetNumber: [SESSION_PHASE.TRANSITIONING, SESSION_PHASE.RESTING].includes(phase) ? session.pendingSetNumber : null
  });
};

const createSessionSnapshot = (workout) => {
  const exercises = workout.exercises || [];
  const occurrenceCounts = new Map();
  exercises.forEach((exercise) => {
    const baseId = exercise.workoutExerciseId || exercise.id || "";
    occurrenceCounts.set(baseId, Number(occurrenceCounts.get(baseId) || 0) + 1);
  });
  return {
    id: workout.id,
    code: workout.code,
    title: workout.title,
    focus: workout.focus,
    version: workout.version || 1,
    exercises: exercises.map((exercise, index) => {
      const baseId = exercise.workoutExerciseId || exercise.id || `${workout.id}-item-${index + 1}`;
      return {
        ...exercise,
        workoutExerciseId: Number(occurrenceCounts.get(baseId) || 0) > 1
          ? `${baseId}-occurrence-${index + 1}`
          : baseId,
        exerciseId: exercise.exerciseId || exercise.id || ""
      };
    })
  };
};

const createActiveSession = (workout) => {
  const workoutSnapshot = createSessionSnapshot(workout);
  const firstExercise = workoutSnapshot.exercises?.[0];
  const session = {
    id: createStableId("session"),
    coachId: workout.coachId || currentStudent.coachId || "",
    studentId: currentStudent.id,
    studentKey: currentStudent.studentKey || workout.studentKey || "",
    studentEmail: currentStudent.email || "",
    workoutId: workout.id,
    workoutVersion: workout.version || 1,
    workoutSnapshot,
    startedAt: new Date().toISOString(),
    schemaVersion: 2,
    phase: SESSION_PHASE.ACTIVE_SET,
    syncStatus: "local",
    currentExerciseId: occurrenceId(firstExercise),
    currentSetNumber: 1,
    restEndsAt: null,
    transitionEndsAt: null,
    pendingExerciseId: null,
    pendingSetNumber: null,
    pausedAt: null,
    pausedDurationSeconds: 0,
    setEntries: []
  };

  const legacyDone = Store.state.activeWorkoutId === workout.id ? Store.state.setLogs || {} : {};
  Object.entries(legacyDone).forEach(([exerciseId, count]) => {
    const exerciseIndex = workout.exercises.findIndex((item) => item.id === exerciseId);
    const exercise = workoutSnapshot.exercises[exerciseIndex];
    if (!exercise) return;
    const log = Store.getExerciseLog(exerciseId, {
      load: parseLoadKg(exercise.load),
      reps: parseReps(exercise)
    });
    for (let setNumber = 1; setNumber <= Math.min(Number(count || 0), parseTotalSets(exercise)); setNumber += 1) {
      session.setEntries.push({
        workoutExerciseId: occurrenceId(exercise),
        exerciseId: exercise.exerciseId || exercise.id,
        exercisePosition: exerciseIndex,
        exerciseName: exercise.name,
        setNumber,
        setKind: "working",
        loadKg: Number(log.load || 0),
        reps: Number(log.reps || 0),
        completedAt: new Date().toISOString()
      });
    }
  });
  const next = getNextIncompleteTarget(session, occurrenceId(firstExercise));
  if (next) {
    session.currentExerciseId = occurrenceId(next.exercise);
    session.currentSetNumber = next.setNumber;
  }
  return Store.startActiveSession(session);
};

const formatVolume = (value) => `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`;

const formatDecimal = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const formatSetPerformance = (loadKg, reps) => Number(loadKg) > 0
  ? `${formatDecimal(loadKg)} kg × ${Number(reps || 0)}`
  : `${Number(reps || 0)} reps`;

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
  if (name === "workout/session" && getActiveSession()) {
    const session = getActiveSession();
    if (session.phase === SESSION_PHASE.PAUSED) resumeActiveSession(session);
    document.body.classList.add("has-workout-runner");
    workoutRunner.hidden = false;
    workoutRunner.setAttribute("aria-hidden", "false");
    if (updateHash) history.pushState(null, "", "#workout/session");
    renderWorkoutRunner();
    startRunnerTicker();
    requestRunnerWakeLock();
    window.scrollTo({ top: 0 });
    return;
  }
  if (!workoutRunner.hidden) {
    const session = getActiveSession();
    if ([SESSION_PHASE.ACTIVE_SET, SESSION_PHASE.TRANSITIONING, SESSION_PHASE.RESTING].includes(session?.phase)) {
      pauseActiveSession(session);
    }
    document.body.classList.remove("has-workout-runner");
    workoutRunner.hidden = true;
    workoutRunner.setAttribute("aria-hidden", "true");
    stopRunnerTicker();
    releaseRunnerWakeLock();
  }
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

const setAuthChecking = (checking) => {
  if (authSessionCheck) authSessionCheck.hidden = !checking;
  if (authContent) authContent.hidden = checking;
  onboarding?.setAttribute("aria-busy", String(checking));
};

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
  try {
    const result = await authRepository.signInWithOAuth({
      provider,
      redirectTo: getAuthRedirectUrl()
    });

    if (!result.ok) {
      setAuthStatus(result.message || `Não foi possível abrir login com ${label}.`, "warning");
    }
  } catch (error) {
    console.error("[FlowFit][aluno][oauth-start] Falha ao iniciar o login social.", error);
    setAuthStatus(`Não foi possível abrir login com ${label}. Tente novamente.`, "warning");
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

const activateStudentStore = async () => {
  Store.useScope(currentStudent.id);
  await Store.restoreActiveSession();
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
  if (picker) picker.hidden = availableWorkouts.length <= 1;
  if (count) count.textContent = `${availableWorkouts.length} ${availableWorkouts.length === 1 ? "disponível" : "disponíveis"}`;
  if (options) {
    options.innerHTML = availableWorkouts.map((workout) => `
      <button class="workout-choice ${workout.id === currentWorkout.id ? "is-active" : ""}" type="button" data-select-workout="${escapeHtml(workout.id)}">
        <strong>${escapeHtml(workout.title)}</strong>
        <span>${escapeHtml(workout.focus)}</span>
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
    ? "Treino disponível"
    : upcomingWorkout ? `Agendado para ${availabilityLabel}` : "Sem treino ativo";
  document.querySelector("[data-home-title]").textContent = hasWorkout
    ? currentWorkout.title
    : upcomingWorkout ? upcomingWorkout.title : "Aguardando seu primeiro treino.";
  document.querySelector("[data-home-summary]").textContent =
    !hasWorkout
      ? upcomingWorkout
        ? `${upcomingWorkout.title} será liberado em ${availabilityLabel}.`
        : "Seu personal ainda não publicou um treino para você."
      : `${currentWorkout.focus ? `${currentWorkout.focus} · ` : ""}${getCurrentExercises().length} exercícios · ~${currentWorkout.estimatedMinutes} min`;
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
  const activeSession = getActiveSession();
  const currentCompletedSets = activeSession?.workoutId === currentWorkout.id ? getCompletedSessionSets(activeSession) : 0;
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
    : upcomingWorkout ? upcomingWorkout.title : "Treino";
  document.querySelector("[data-workout-focus]").textContent = hasWorkout
    ? currentWorkout.focus
    : upcomingWorkout ? `Disponível em ${availabilityLabel}` : currentWorkout.focus;
  document.querySelector("[data-workout-plan-title]").textContent = currentWorkout.id === emptyWorkout.id ? "Sem treino ativo" : currentWorkout.title;
  document.querySelector("[data-workout-last]").textContent = currentWorkout.lastDoneLabel === "novo" ? "Ainda não executado" : `Última execução ${currentWorkout.lastDoneLabel}`;
  document.querySelector("[data-workout-minutes]").textContent = `${currentWorkout.estimatedMinutes} min`;
  document.querySelector("[data-workout-exercise-count]").textContent = `${getCurrentExercises().length} exercícios`;
  document.querySelector("[data-workout-set-count]").textContent = `${getTotalSets()} séries`;
  document.querySelectorAll("[data-active-workout-only]").forEach((element) => {
    element.hidden = !hasWorkout;
  });
};

const renderWorkoutProgress = () => {
  const activeSession = getActiveSession();
  const belongsToCurrentWorkout = activeSession?.workoutId === currentWorkout.id;
  const totalSets = belongsToCurrentWorkout ? getSessionTotalSets(activeSession) : getTotalSets();
  const done = belongsToCurrentWorkout ? getCompletedSessionSets(activeSession) : 0;
  const percent = totalSets > 0 ? Math.round((done / totalSets) * 100) : 0;
  document.querySelector("[data-session-count]").textContent = `${done}/${totalSets} séries`;
  document.querySelector("[data-session-progress]").style.setProperty("--progress", `${percent}%`);
  document.querySelector("[data-session-progress-track]")?.setAttribute("aria-valuenow", String(percent));
  const startButton = document.querySelector("[data-start-workout]");
  if (startButton) {
    startButton.disabled = totalSets === 0;
    startButton.textContent = belongsToCurrentWorkout ? "Continuar treino" : "Começar treino";
  }
};

const getWorkoutVolume = (session = getActiveSession()) => getSessionEntries(session)
  .reduce((sum, entry) => sum + (Number(entry.loadKg || 0) * Number(entry.reps || 0)), 0);

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
  const activeSession = getActiveSession();
  if (!activeSession) return null;
  const sessionId = activeSession.id;
  const finishedAt = new Date().toISOString();
  const startedAt = activeSession.startedAt || finishedAt;
  const exercises = getSessionExercises(activeSession);
  const setLogs = getSessionEntries(activeSession).map((entry) => {
    const workoutExerciseId = entry.workoutExerciseId || entry.exerciseId;
    const exercise = exercises.find((item) => occurrenceId(item) === workoutExerciseId) || {};
    const index = Math.max(0, exercises.findIndex((item) => occurrenceId(item) === workoutExerciseId));
    const loadKg = Number(entry.loadKg || 0);
    const reps = Number(entry.reps || 0);
    const exerciseFeedback = activeSession.exerciseFeedback?.[`${workoutExerciseId}:${entry.setNumber}`]
      || activeSession.exerciseFeedback?.[workoutExerciseId]
      || {};
    return {
      id: `${sessionId}-ex-${String(index + 1).padStart(2, "0")}-set-${String(entry.setNumber).padStart(2, "0")}`,
      sessionId,
      coachId: activeSession.coachId,
      workoutId: activeSession.workoutId,
      workoutExerciseId,
      exerciseId: exercise.exerciseId || entry.exerciseId || workoutExerciseId,
      position: index,
      exerciseName: exercise.name || entry.exerciseName,
      target: exercise.target || "Personalizado",
      prescription: exercise.prescription || "",
      plannedSets: parseTotalSets(exercise),
      completedSets: 1,
      loadKg,
      reps,
      volumeKg: loadKg * reps,
      rir: exercise.rir,
      notes: exercise.notes,
      setNumber: Number(entry.setNumber),
      setKind: entry.setKind || "working",
      completedAt: entry.completedAt || finishedAt,
      discomfort: exerciseFeedback.severity || "none",
      discomfortNote: [exerciseFeedback.region, exerciseFeedback.note].filter(Boolean).join(" · ")
    };
  });
  const completedSets = setLogs.length;
  const volumeKg = setLogs.reduce((sum, log) => sum + log.volumeKg, 0);
  const feedback = getFinishFeedback();
  const exercisePain = Object.values(activeSession.exerciseFeedback || {}).some((item) => item?.severity === "pain")
    ? "pain"
    : Object.values(activeSession.exerciseFeedback || {}).some((item) => item?.severity === "mild") ? "mild" : "none";
  if (feedback.pain === "none" && exercisePain !== "none") feedback.pain = exercisePain;
  const totalSets = getSessionTotalSets(activeSession);
  const snapshot = activeSession.workoutSnapshot || {};

  return {
    id: sessionId,
    coachId: activeSession.coachId,
    studentId: currentStudent.id,
    studentKey: activeSession.studentKey,
    studentEmail: currentStudent.email || "",
    workoutId: activeSession.workoutId,
    workoutCode: snapshot.code || "A",
    workoutTitle: snapshot.title || "Treino",
    workoutVersion: snapshot.version || activeSession.workoutVersion || 1,
    status: completedSets >= totalSets ? "completed" : "partial",
    totalSets,
    completedSets,
    volumeKg: Math.round(volumeKg),
    durationSeconds: getElapsedSeconds(activeSession, new Date(finishedAt).getTime()),
    startedAt,
    finishedAt,
    feedback: {
      id: `${sessionId}-feedback`,
      sessionId,
      coachId: activeSession.coachId,
      studentId: currentStudent.id,
      ...feedback
    },
    setLogs
  };
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

const renderLegacyExercises = () => {
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

const renderExercises = () => {
  const list = document.querySelector("[data-exercise-list]");
  const exercises = getCurrentExercises();
  if (!exercises.length) {
    list.innerHTML = `<article class="empty-state card"><strong>Nenhum exercício publicado.</strong><small>Peça ao personal para revisar este treino.</small></article>`;
    renderWorkoutProgress();
    return;
  }
  const activeSession = getActiveSession();
  const belongsToCurrentWorkout = activeSession?.workoutId === currentWorkout.id;
  list.innerHTML = exercises.map((exercise, index) => {
    const done = belongsToCurrentWorkout ? getCompletedSetCount(occurrenceId(exercise), activeSession) : 0;
    const total = parseTotalSets(exercise);
    return `
      <article class="exercise-overview card ${done >= total ? "is-complete" : ""}">
        <span class="exercise__number">${String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>${escapeHtml(exercise.name)}</strong>
          <small>${escapeHtml(exercise.prescription)} · ${escapeHtml(exercise.rest)} de descanso</small>
          ${exercise.instructions ? `<p>${escapeHtml(exercise.instructions)}</p>` : ""}
        </div>
        <span class="exercise-overview__state">${exercise.mediaUrl ? svgIcon("play") : ""}<b>${done}/${total}</b></span>
      </article>
    `;
  }).join("");
  renderWorkoutProgress();
};

const formatClock = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const getYouTubeVideoId = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }
  return "";
};

const renderRunnerMedia = (exercise) => {
  const target = document.querySelector("[data-runner-media]");
  const source = String(exercise.mediaUrl || "").trim();
  target.replaceChildren();
  target.hidden = !source;
  if (!source) return;
  let url;
  try {
    url = new URL(source);
  } catch {
    target.hidden = true;
    return;
  }
  if (url.protocol !== "https:") {
    target.hidden = true;
    return;
  }

  const declaredType = String(exercise.mediaType || "").toLowerCase();
  const extension = url.pathname.split(".").pop()?.toLowerCase() || "";
  const youtubeId = getYouTubeVideoId(source);
  const mediaType = ["image", "gif", "video", "youtube", "external"].includes(declaredType)
    ? declaredType
    : youtubeId ? "youtube"
      : ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(extension) ? "image"
        : ["mp4", "webm", "ogv"].includes(extension) ? "video" : "external";
  if (mediaType === "youtube" && youtubeId && /^[a-zA-Z0-9_-]{6,20}$/.test(youtubeId)) {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1&modestbranding=1&iv_load_policy=3`;
    iframe.title = `Demonstração de ${exercise.name}`;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    target.append(iframe);
    return;
  }

  if (["image", "gif"].includes(mediaType)) {
    const image = document.createElement("img");
    image.src = source;
    image.alt = `Demonstração de ${exercise.name}`;
    image.loading = "eager";
    target.append(image);
    return;
  }
  if (mediaType === "video") {
    const video = document.createElement("video");
    video.src = source;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = "metadata";
    target.append(video);
    return;
  }

  const link = document.createElement("a");
  link.className = "button button--quiet";
  link.href = source;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Abrir demonstração";
  target.append(link);
};

const getProgressionExerciseIds = (session = getActiveSession()) => {
  const progressed = new Set();
  getSessionEntries(session).forEach((entry) => {
    const workoutExerciseId = entry.workoutExerciseId || entry.exerciseId;
    const exercise = findSessionExercise(workoutExerciseId, session);
    if (!exercise) return;
    const previous = findPreviousSet(exercise, entry.setNumber);
    if (!previous) return;
    const load = Number(entry.loadKg || 0);
    const reps = Number(entry.reps || 0);
    const previousLoad = Number(previous.loadKg || 0);
    const previousReps = Number(previous.reps || 0);
    if ((load > previousLoad && reps >= previousReps) || (load >= previousLoad && reps > previousReps)) {
      progressed.add(workoutExerciseId);
    }
  });
  return progressed;
};

const renderRunnerExerciseSheet = (session) => {
  const target = document.querySelector("[data-runner-exercise-list]");
  target.innerHTML = getSessionExercises(session).map((exercise, index) => {
    const workoutExerciseId = occurrenceId(exercise);
    const entries = getExerciseEntries(workoutExerciseId, session);
    const total = parseTotalSets(exercise);
    const active = workoutExerciseId === session.currentExerciseId;
    return `
      <article class="runner-sheet__exercise ${active ? "is-active" : ""} ${entries.length >= total ? "is-complete" : ""}">
        <button type="button" data-runner-jump="${escapeHtml(workoutExerciseId)}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(exercise.prescription)} · ${entries.length}/${total} séries</small></div>
          <b>${entries.length >= total ? "✓" : `${entries.length}/${total}`}</b>
        </button>
        ${entries.length ? `<div class="runner-sheet__sets">${entries.map((entry) => `<button type="button" data-edit-completed-set="${escapeHtml(workoutExerciseId)}" data-edit-set-number="${entry.setNumber}">S${entry.setNumber} · ${formatSetPerformance(entry.loadKg, entry.reps)}</button>`).join("")}</div>` : ""}
      </article>
    `;
  }).join("");
};

const renderRunnerReview = (session) => {
  const done = getCompletedSessionSets(session);
  const total = getSessionTotalSets(session);
  const duration = getElapsedSeconds(session);
  document.querySelector("[data-review-duration]").textContent = duration < 60 ? "<1 min" : `${Math.round(duration / 60)} min`;
  document.querySelector("[data-review-sets]").textContent = `${done}/${total}`;
  document.querySelector("[data-review-volume]").textContent = `${Math.round(getWorkoutVolume(session)).toLocaleString("pt-BR")} kg`;
  document.querySelector("[data-review-exercises]").textContent = new Set(getSessionEntries(session)
    .map((entry) => entry.workoutExerciseId || entry.exerciseId)).size;
  const progressionIds = getProgressionExerciseIds(session);
  const progressionNames = getSessionExercises(session)
    .filter((exercise) => progressionIds.has(occurrenceId(exercise)))
    .map((exercise) => exercise.name);
  document.querySelector("[data-review-progressions]").textContent = progressionIds.size;
  const progressionList = document.querySelector("[data-review-progression-list]");
  progressionList.hidden = progressionNames.length === 0;
  progressionList.textContent = progressionNames.length
    ? `Melhor desempenho que na última sessão em ${progressionNames.join(", ")}.`
    : "";
  document.querySelector("[data-review-status-copy]").textContent = done >= total
    ? "Todas as séries foram concluídas."
    : `Treino parcial: ${total - done} série(s) não realizada(s).`;
  const finishButton = document.querySelector("[data-finish]");
  if (finishButton) finishButton.textContent = session.phase === SESSION_PHASE.PENDING_SYNC
    ? "Tentar enviar novamente"
    : "Enviar e concluir";
};

const renderRunnerPerformanceHint = (exercise, setNumber) => {
  const target = document.querySelector("[data-runner-performance]");
  if (!target || !exercise) return;
  const previous = findPreviousSet(exercise, setNumber);
  const loadValue = document.querySelector("[data-runner-load]")?.value;
  const repsValue = document.querySelector("[data-runner-reps]")?.value;
  const load = loadValue === "" ? null : Number(loadValue);
  const reps = repsValue === "" ? null : Number(repsValue);
  const isBetter = previous && load !== null && reps !== null
    && ((load > Number(previous.loadKg || 0) && reps >= Number(previous.reps || 0))
      || (load >= Number(previous.loadKg || 0) && reps > Number(previous.reps || 0)));
  target.hidden = !isBetter;
  target.textContent = isBetter ? "↑ Melhor que o registro comparável da última sessão" : "";
};

const formatRunnerPrescription = (value) => String(value || "")
  .replace(/\s*x\s*/gi, " × ")
  .replace(/\s+/g, " ")
  .trim();

const formatRunnerTempo = (value) => String(value || "")
  .replace(/-/g, "–")
  .trim();

const isRunnerPrimaryPhase = (phase) => [SESSION_PHASE.ACTIVE_SET, SESSION_PHASE.RESTING].includes(phase);

const runnerPrimaryVerb = (session = getActiveSession()) => (
  session?.phase === SESSION_PHASE.RESTING ? "pular" : "concluir"
);

const updateRunnerPrimaryAction = (session = getActiveSession()) => {
  const target = document.querySelector("[data-runner-primary-summary]");
  const button = document.querySelector("[data-runner-primary-action]");
  const hint = document.querySelector("[data-runner-swipe-hint]");
  if (!target || !button || !session) return;

  const isResting = session.phase === SESSION_PHASE.RESTING;
  const isAvailable = isRunnerPrimaryPhase(session.phase);
  runnerActionBar.hidden = !isAvailable;
  runnerActionBar.dataset.runnerAction = isResting ? "skip-rest" : "complete-set";
  runnerActionBar.setAttribute("aria-label", isResting ? "Pular descanso" : "Concluir série atual");
  button.textContent = isResting ? "Pular descanso" : "Concluir série";
  button.disabled = !isAvailable;
  if (hint) {
    const correctionHint = getSessionEntries(session).length ? " · corrigir →" : "";
    hint.textContent = isResting ? `← pular${correctionHint}` : `← concluir${correctionHint}`;
  }

  if (isResting) {
    const nextExercise = findSessionExercise(session.pendingExerciseId || session.currentExerciseId, session);
    const nextSetNumber = Number(session.pendingSetNumber || session.currentSetNumber || 1);
    target.textContent = nextExercise
      ? `Próxima: ${nextExercise.name} · Série ${nextSetNumber}/${parseTotalSets(nextExercise)}`
      : "Ir para o resumo do treino";
    return;
  }

  const exercise = findSessionExercise(session.currentExerciseId, session);
  const setNumber = Number(session.currentSetNumber || 1);
  const loadValue = document.querySelector("[data-runner-load]")?.value;
  const repsValue = document.querySelector("[data-runner-reps]")?.value;
  const load = loadValue === "" ? 0 : Number(loadValue || 0);
  const reps = repsValue === "" ? 0 : Number(repsValue || 0);
  const formattedLoad = Number.isInteger(load) ? String(load) : String(Math.round(load * 10) / 10).replace(".", ",");
  target.textContent = `Série ${setNumber}/${parseTotalSets(exercise || {})} · ${formattedLoad} kg · ${reps} reps`;
};

const resetRunnerSwipeVisual = () => {
  runnerSwipe = null;
  runnerActionBar?.classList.remove("is-swiping", "is-armed", "is-correcting");
  runnerActionBar?.style.setProperty("--swipe-progress", "0");
  runnerActionBar?.style.setProperty("--swipe-translation", "0rem");
  const feedbackIcon = runnerSwipeFeedback?.querySelector("span");
  if (feedbackIcon) feedbackIcon.textContent = "✓";
  const feedbackLabel = runnerSwipeFeedback?.querySelector("strong");
  if (feedbackLabel) feedbackLabel.textContent = `Solte para ${runnerPrimaryVerb()}`;
  updateRunnerPrimaryAction(getActiveSession());
};

const completeCurrentRunnerSet = () => {
  const session = getActiveSession();
  if (!session || session.phase !== SESSION_PHASE.ACTIVE_SET) return false;
  const exercise = findSessionExercise(session.currentExerciseId, session);
  if (!exercise) return false;
  const setNumber = Number(session.currentSetNumber || 1);
  const workoutExerciseId = occurrenceId(exercise);
  const lockKey = `${workoutExerciseId}:${setNumber}`;
  if (setClickLocks.has(lockKey)) return false;

  const loadKg = Number(document.querySelector("[data-runner-load]")?.value || 0);
  const reps = Number(document.querySelector("[data-runner-reps]")?.value || 0);
  if (loadKg < 0 || reps < 1) {
    Platform.notify("Informe uma carga válida e pelo menos uma repetição.");
    return false;
  }

  const completeButton = document.querySelector("[data-runner-primary-action]");
  setClickLocks.add(lockKey);
  if (completeButton) {
    completeButton.disabled = true;
    playSetFeedback(completeButton);
  }
  Store.addActiveSetEntry({
    workoutExerciseId,
    exerciseId: exercise.exerciseId || exercise.id,
    exercisePosition: getSessionExercises(session).findIndex((item) => occurrenceId(item) === workoutExerciseId),
    exerciseName: exercise.name,
    setNumber,
    setKind: "working",
    loadKg,
    reps,
    completedAt: new Date().toISOString()
  });
  Platform.vibrate(25);
  renderHome();
  renderExercises();

  const updated = getActiveSession();
  const next = getNextIncompleteTarget(updated, workoutExerciseId);
  const transitionEndsAt = Date.now() + SET_TRANSITION_MS;
  Store.updateActiveSession({
    phase: SESSION_PHASE.TRANSITIONING,
    currentExerciseId: next ? occurrenceId(next.exercise) : workoutExerciseId,
    currentSetNumber: next ? next.setNumber : setNumber,
    currentLoad: null,
    currentReps: null,
    pendingExerciseId: next ? occurrenceId(next.exercise) : null,
    pendingSetNumber: next?.setNumber || null,
    transitionEndsAt: new Date(transitionEndsAt).toISOString(),
    restEndsAt: next ? new Date(transitionEndsAt + (parseRestSeconds(exercise) * 1000)).toISOString() : null
  });
  resetRunnerSwipeVisual();
  renderWorkoutRunner();
  window.setTimeout(() => setClickLocks.delete(lockKey), SET_CLICK_DEBOUNCE_MS);
  return true;
};

const skipCurrentRunnerRest = () => {
  const session = getActiveSession();
  if (!session || session.phase !== SESSION_PHASE.RESTING) return false;
  const next = getNextIncompleteTarget(session, session.currentExerciseId);
  Store.updateActiveSession({
    phase: next ? SESSION_PHASE.ACTIVE_SET : SESSION_PHASE.AWAITING_SUMMARY,
    restEndsAt: null,
    transitionEndsAt: null,
    pendingExerciseId: null,
    pendingSetNumber: null
  });
  resetRunnerSwipeVisual();
  renderWorkoutRunner();
  return true;
};

const correctLastRunnerSet = () => {
  const session = getActiveSession();
  if (!session || !isRunnerPrimaryPhase(session.phase)) return false;
  const last = getLastSessionEntry(session);
  if (!last) {
    Platform.notify("Nenhuma série registrada para corrigir.");
    return false;
  }
  const workoutExerciseId = last.workoutExerciseId || last.exerciseId;
  const removed = Store.removeActiveSetEntry(workoutExerciseId, Number(last.setNumber));
  if (!removed) return false;
  Store.updateActiveSession({
    phase: SESSION_PHASE.ACTIVE_SET,
    currentExerciseId: workoutExerciseId,
    currentSetNumber: Number(last.setNumber || 1),
    currentLoad: removed.loadKg,
    currentReps: removed.reps,
    restEndsAt: null,
    transitionEndsAt: null,
    pendingExerciseId: null,
    pendingSetNumber: null
  });
  resetRunnerSwipeVisual();
  renderAll();
  renderWorkoutRunner();
  Platform.notify("Última série aberta para correção.");
  return true;
};

const performRunnerPrimaryAction = () => {
  const session = getActiveSession();
  if (session?.phase === SESSION_PHASE.ACTIVE_SET) return completeCurrentRunnerSet();
  if (session?.phase === SESSION_PHASE.RESTING) return skipCurrentRunnerRest();
  return false;
};

const adjustRunnerValue = (button, { vibrate = true } = {}) => {
  if (!button || button.disabled) return false;
  const type = button.dataset.adjustRunner;
  const input = document.querySelector(type === "load" ? "[data-runner-load]" : "[data-runner-reps]");
  if (!input || input.disabled) return false;

  const delta = Number(button.dataset.adjustDelta || 0);
  const fallbackMinimum = type === "load" ? 0 : 1;
  const declaredMinimum = Number(input.min);
  const declaredMaximum = Number(input.max);
  const minimum = input.min !== "" && Number.isFinite(declaredMinimum) ? declaredMinimum : fallbackMinimum;
  const maximum = input.max !== "" && Number.isFinite(declaredMaximum) ? declaredMaximum : Number.POSITIVE_INFINITY;
  const parsedCurrent = Number(input.value);
  const current = input.value === "" || !Number.isFinite(parsedCurrent) ? minimum : parsedCurrent;
  const precisionSource = String(input.step || Math.abs(delta));
  const precision = Math.min(4, precisionSource.includes(".") ? precisionSource.split(".")[1].length : 0);
  const next = Math.min(maximum, Math.max(minimum, Number((current + delta).toFixed(precision))));
  if (!Number.isFinite(next) || next === current) return false;

  input.value = String(next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  if (vibrate) Platform.vibrate(10);
  return true;
};

const stopRunnerAdjustHold = ({ suppressClick = false } = {}) => {
  if (!runnerAdjustHold) return;
  window.clearTimeout(runnerAdjustHold.delayId);
  window.clearInterval(runnerAdjustHold.repeatId);
  runnerAdjustHold.button.classList.remove("is-holding");
  if (runnerAdjustHold.didRepeat && suppressClick) {
    suppressedRunnerAdjustButton = runnerAdjustHold.button;
    suppressRunnerAdjustClickUntil = Date.now() + 600;
  }
  runnerAdjustHold = null;
};

const renderRunnerExerciseTrack = (session, currentExerciseId) => {
  const target = document.querySelector("[data-runner-exercise-track]");
  if (!target) return;
  const exercises = getSessionExercises(session);
  const fragment = document.createDocumentFragment();
  exercises.forEach((exercise, index) => {
    const isComplete = getExerciseEntries(occurrenceId(exercise), session).length >= parseTotalSets(exercise);
    const isCurrent = occurrenceId(exercise) === currentExerciseId && !isComplete;
    const step = document.createElement("span");
    step.className = `runner-exercise-step${isComplete ? " is-complete" : isCurrent ? " is-current" : ""}`;
    const dot = document.createElement("span");
    dot.className = "runner-exercise-step__dot";
    step.append(dot);
    if (index < exercises.length - 1) {
      const line = document.createElement("span");
      line.className = "runner-exercise-step__line";
      step.append(line);
    }
    fragment.append(step);
  });
  target.replaceChildren(fragment);
};

const renderRunnerSetTrack = (exercise, setNumber, session = getActiveSession()) => {
  const target = document.querySelector("[data-runner-set-track]");
  if (!target || !exercise || !session) return;
  const completedNumbers = new Set(
    getExerciseEntries(occurrenceId(exercise), session).map((entry) => Number(entry.setNumber))
  );
  const total = parseTotalSets(exercise);
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= total; number += 1) {
    const step = document.createElement("span");
    step.className = `runner-set-step${completedNumbers.has(number) ? " is-complete" : number === setNumber ? " is-current" : ""}`;
    fragment.append(step);
  }
  target.replaceChildren(fragment);
};

const renderWorkoutRunner = () => {
  const session = getActiveSession();
  if (!session) return;
  const total = getSessionTotalSets(session);
  const done = getCompletedSessionSets(session);
  const percent = total ? Math.round((done / total) * 100) : 0;
  document.querySelector("[data-runner-workout-title]").textContent = session.workoutSnapshot?.title || "Treino";
  const exercises = getSessionExercises(session);
  const progressExerciseId = session.pendingExerciseId || session.currentExerciseId;
  const progressExerciseIndex = exercises.findIndex((exercise) => occurrenceId(exercise) === progressExerciseId);
  document.querySelector("[data-runner-progress-title]").textContent = exercises.length
    ? `Exercício ${Math.max(0, progressExerciseIndex) + 1} de ${exercises.length}`
    : "Nenhum exercício";
  document.querySelector("[data-runner-progress-copy]").textContent = `${done} de ${total} séries concluídas`;
  renderRunnerExerciseTrack(session, progressExerciseId);
  document.querySelector("[data-runner-progress]").style.setProperty("--progress", `${percent}%`);
  document.querySelector("[data-runner-progress-track]")?.setAttribute("aria-valuenow", String(percent));
  const visualPhase = {
    [SESSION_PHASE.ACTIVE_SET]: "exercise",
    [SESSION_PHASE.TRANSITIONING]: "transition",
    [SESSION_PHASE.RESTING]: "rest",
    [SESSION_PHASE.PAUSED]: "exercise",
    [SESSION_PHASE.AWAITING_SUMMARY]: "review",
    [SESSION_PHASE.PENDING_SYNC]: "review",
    [SESSION_PHASE.COMPLETED]: "success"
  }[session.phase] || "exercise";
  workoutRunner.dataset.runnerVisualPhase = visualPhase;
  updateRunnerPrimaryAction(session);
  if (!isRunnerPrimaryPhase(session.phase)) resetRunnerSwipeVisual();
  document.querySelectorAll("[data-runner-phase]").forEach((phase) => {
    phase.hidden = phase.dataset.runnerPhase !== visualPhase;
  });
  if (workoutRunner.dataset.renderedPhase !== visualPhase) {
    workoutRunner.dataset.renderedPhase = visualPhase;
    window.setTimeout(() => {
      workoutRunner.querySelector(`[data-runner-phase="${visualPhase}"] [data-runner-phase-focus]`)
        ?.focus({ preventScroll: true });
    }, 0);
  }
  renderRunnerExerciseSheet(session);

  if (session.phase === SESSION_PHASE.TRANSITIONING) {
    const transitionCopy = document.querySelector("[data-runner-transition-copy]");
    transitionCopy.textContent = session.pendingExerciseId
      ? "Preparando o descanso antes da próxima série."
      : "Todas as séries foram realizadas. Preparando seu resumo.";
    syncRunnerClock();
    return;
  }

  if ([SESSION_PHASE.AWAITING_SUMMARY, SESSION_PHASE.PENDING_SYNC].includes(session.phase)) {
    renderRunnerReview(session);
    return;
  }
  if (session.phase === SESSION_PHASE.COMPLETED) {
    document.querySelector("[data-runner-success-copy]").textContent = session.syncStatus === "synced"
      ? "Seu personal recebeu as séries e o feedback."
      : "O treino ficou salvo e será enviado quando a conexão voltar.";
    return;
  }
  if (session.phase === SESSION_PHASE.RESTING) {
    const nextExercise = findSessionExercise(session.pendingExerciseId || session.currentExerciseId, session);
    const nextSetNumber = Number(session.pendingSetNumber || session.currentSetNumber || 1);
    document.querySelector("[data-runner-rest-next]").textContent = nextExercise?.name || "Resumo do treino";
    document.querySelector("[data-runner-rest-position]").textContent = nextExercise
      ? `Série ${nextSetNumber} de ${parseTotalSets(nextExercise)}`
      : "Treino finalizado";
    updateRunnerPrimaryAction(session);
    syncRunnerClock();
    return;
  }

  let exercise = findSessionExercise(session.currentExerciseId, session);
  let setNumber = Number(session.currentSetNumber || 1);
  if (!exercise || getExerciseEntries(occurrenceId(exercise), session).some((entry) => Number(entry.setNumber) === setNumber)) {
    const next = getNextIncompleteTarget(session, occurrenceId(exercise));
    if (!next) {
      Store.updateActiveSession({ phase: SESSION_PHASE.AWAITING_SUMMARY, restEndsAt: null });
      renderWorkoutRunner();
      return;
    }
    exercise = next.exercise;
    setNumber = next.setNumber;
    Store.updateActiveSession({ currentExerciseId: occurrenceId(exercise), currentSetNumber: setNumber });
  }

  const previous = findPreviousSet(exercise, setNumber);
  const previousLogs = findPreviousExerciseLogs(exercise);
  const exerciseIndex = exercises.findIndex((item) => occurrenceId(item) === occurrenceId(exercise));
  document.querySelector("[data-runner-exercise-position]").textContent = `Exercício ${exerciseIndex + 1} de ${exercises.length}`;
  document.querySelector("[data-runner-exercise-name]").textContent = exercise.name;
  document.querySelector("[data-runner-set-number]").textContent = `Série ${setNumber} de ${parseTotalSets(exercise)}`;
  renderRunnerSetTrack(exercise, setNumber, session);
  document.querySelector("[data-runner-prescription]").textContent = formatRunnerPrescription(exercise.prescription);
  document.querySelector("[data-runner-rir]").textContent = `RIR ${exercise.rir}`;
  document.querySelector("[data-runner-tempo]").textContent = formatRunnerTempo(exercise.tempo);
  const instructions = document.querySelector("[data-runner-instructions]");
  const instructionsDetails = document.querySelector("[data-runner-instructions-details]");
  if (instructionsDetails) instructionsDetails.hidden = !exercise.instructions;
  instructions.textContent = exercise.instructions || "";
  const comparableLogs = previousLogs.filter((log) => Number(log.setNumber || 0) > 0).slice(0, 4);
  document.querySelector("[data-previous-set-value]").textContent = comparableLogs.length
    ? comparableLogs.map((log) => formatSetPerformance(log.loadKg, log.reps)).join(" · ")
    : previous ? formatSetPerformance(previous.loadKg, previous.reps) : "Sem histórico comparável";
  const loadInput = document.querySelector("[data-runner-load]");
  const repsInput = document.querySelector("[data-runner-reps]");
  const completeButton = document.querySelector("[data-runner-primary-action]");
  const suggestedLoad = session.currentLoad ?? previous?.loadKg ?? parseLoadKg(exercise.load);
  loadInput.value = Number(suggestedLoad) > 0 ? suggestedLoad : "";
  repsInput.value = session.currentReps ?? previous?.reps ?? parseReps(exercise);
  completeButton.disabled = false;
  document.querySelector("[data-correct-last-set]").hidden = getSessionEntries(session).length === 0;
  renderRunnerMedia(exercise);
  renderRunnerPerformanceHint(exercise, setNumber);
  updateRunnerPrimaryAction(session);
  syncRunnerClock();
};

const syncRunnerClock = () => {
  const session = getActiveSession();
  if (!session) return;
  const elapsed = getElapsedSeconds(session);
  document.querySelector("[data-runner-elapsed]").textContent = formatClock(elapsed);
  if (session.phase === SESSION_PHASE.TRANSITIONING) {
    const transitionRemaining = new Date(session.transitionEndsAt || 0).getTime() - Date.now();
    if (transitionRemaining <= 0) {
      const hasNext = Boolean(session.pendingExerciseId);
      const restIsActive = hasNext && new Date(session.restEndsAt || 0).getTime() > Date.now();
      Store.updateActiveSession({
        phase: hasNext ? (restIsActive ? SESSION_PHASE.RESTING : SESSION_PHASE.ACTIVE_SET) : SESSION_PHASE.AWAITING_SUMMARY,
        transitionEndsAt: null,
        pendingExerciseId: restIsActive ? session.pendingExerciseId : null,
        pendingSetNumber: restIsActive ? session.pendingSetNumber : null,
        restEndsAt: restIsActive ? session.restEndsAt : null
      });
      renderWorkoutRunner();
    }
    return;
  }
  if (session.phase !== SESSION_PHASE.RESTING) return;
  const remaining = Math.max(0, Math.ceil((new Date(session.restEndsAt).getTime() - Date.now()) / 1000));
  document.querySelector("[data-runner-rest-clock]").textContent = formatClock(remaining);
  if (remaining <= 0) {
    Store.updateActiveSession({
      phase: getNextIncompleteTarget(session, session.currentExerciseId) ? SESSION_PHASE.ACTIVE_SET : SESSION_PHASE.AWAITING_SUMMARY,
      restEndsAt: null,
      pendingExerciseId: null,
      pendingSetNumber: null
    });
    Platform.notify("Descanso finalizado.");
    renderWorkoutRunner();
  }
};

const startRunnerTicker = () => {
  clearInterval(runnerTickId);
  syncRunnerClock();
  runnerTickId = window.setInterval(syncRunnerClock, 1000);
};

const stopRunnerTicker = () => {
  clearInterval(runnerTickId);
  runnerTickId = null;
};

const requestRunnerWakeLock = async () => {
  if (!navigator.wakeLock || document.visibilityState !== "visible" || workoutRunner.hidden) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
      if (document.visibilityState === "visible" && !workoutRunner.hidden) {
        window.setTimeout(() => requestRunnerWakeLock(), 250);
      }
    }, { once: true });
  } catch {
    wakeLockSentinel = null;
  }
};

const releaseRunnerWakeLock = async () => {
  try {
    await wakeLockSentinel?.release();
  } catch {
    // O navegador pode liberar automaticamente ao trocar de aba.
  }
  wakeLockSentinel = null;
};

const renderProgress = () => {
  const entries = Store.getProgressEntries([]);
  const historySection = document.querySelector("[data-progress-history]");
  const progressPage = document.querySelector('[data-page="progress"]');
  const progressHeading = progressPage?.querySelector(".page-heading");
  if (progressDisclosure && progressPage) {
    if (entries.length) progressPage.append(progressDisclosure);
    else progressHeading?.after(progressDisclosure);
  }
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
    title: workout.title,
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
    previousSessions = [
      ...result.sessions,
      ...previousSessions.filter((session) => !result.sessions.some((synced) => synced.id === session.id))
    ].sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));
    const activeSession = getActiveSession();
    const syncedActiveSession = activeSession
      ? result.sessions.find((session) => session.id === activeSession.id && session.syncStatus === "synced")
      : null;
    if (syncedActiveSession) {
      Store.updateActiveSession({ phase: SESSION_PHASE.COMPLETED, syncStatus: "synced" });
    }
    return result.syncedCount;
  } catch {
    return 0;
  }
};

const refreshStudentSessionHistory = async () => {
  if (!currentStudent?.id || !currentStudent?.coachId) {
    previousSessions = Store.state.sessions || [];
    return { synced: false, sessions: previousSessions };
  }
  const result = await sessionRepository.fetchStudentSessions({
    studentId: currentStudent.id,
    coachId: currentStudent.coachId,
    limit: 30
  });
  previousSessions = result.sessions || [];
  Store.setSessions(previousSessions);
  return result;
};

const startAuthenticatedApp = async () => {
  setAuthChecking(true);
  const session = await authRepository.getSession();
  if (!session?.user) {
    activateAnonymousStore();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    syncAuthMode("signin");
    setAuthChecking(false);
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
    setAuthChecking(false);
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
    setAuthChecking(false);
    const requiresInvite = /student_invite_required_for_multiple_matches/i.test(
      String(accessClaim.error?.message || "")
    );
    setAuthStatus(
      accessToken
        ? "Este convite é inválido, expirou ou pertence a outro email. Peça um novo link ao personal."
        : requiresInvite
          ? "Encontramos mais de um cadastro com este email. Use o convite específico enviado pelo personal."
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
      setAuthChecking(false);
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
    setAuthChecking(false);
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
    setAuthChecking(false);
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
  await activateStudentStore();

  currentWorkout = emptyWorkout;
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
  await refreshStudentSessionHistory();
  const retriedSessions = await retryPendingSessions();
  renderAll();
  syncOnboarding();
  setAuthChecking(false);
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
  await activateStudentStore();
  availableWorkouts = [];
  upcomingWorkouts = [];
  currentWorkout = emptyWorkout;
  focusedExerciseId = "";
  setClickLocks.clear();
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
  await refreshStudentSessionHistory();
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
  renderAll();
  Platform.notify(`${workout.title} selecionado.`);
};

navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(item.dataset.nav);
}));

appShell?.addEventListener("click", (event) => {
  if (Date.now() >= suppressAppClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

appShell?.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.pointerType === "mouse" || event.button > 0) return;
  if (document.body.classList.contains("has-onboarding") || document.body.classList.contains("has-workout-runner")) return;
  if (event.clientX <= 24 || event.clientX >= window.innerWidth - 24) return;
  if (event.target.closest("button, a, input, textarea, select, label, summary, details, iframe, video, canvas, [contenteditable], [role='slider'], .filter-row, [data-swipe-nav-ignore]")) return;
  const currentIndex = navItems.findIndex((item) => item.classList.contains("is-active"));
  if (currentIndex < 0) return;
  appNavSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentIndex,
    destinationIndex: -1,
    axis: "pending",
    armed: false,
    threshold: Math.min(120, Math.max(72, appShell.clientWidth * 0.2))
  };
});

appShell?.addEventListener("pointermove", (event) => {
  if (!appNavSwipe || event.pointerId !== appNavSwipe.pointerId) return;
  const deltaX = event.clientX - appNavSwipe.startX;
  const deltaY = event.clientY - appNavSwipe.startY;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (appNavSwipe.axis === "pending") {
    if (Math.hypot(deltaX, deltaY) < 12) return;
    if (verticalDistance > horizontalDistance * 1.15) {
      appNavSwipe = null;
      return;
    }
    if (horizontalDistance <= verticalDistance * 1.25) return;
    appNavSwipe.axis = "horizontal";
    appShell.setPointerCapture?.(event.pointerId);
  }

  if (appNavSwipe.axis !== "horizontal") return;
  event.preventDefault();
  const direction = deltaX < 0 ? 1 : -1;
  const destinationIndex = appNavSwipe.currentIndex + direction;
  const canNavigate = destinationIndex >= 0 && destinationIndex < navItems.length;
  appNavSwipe.destinationIndex = canNavigate ? destinationIndex : -1;
  appNavSwipe.armed = canNavigate && horizontalDistance >= appNavSwipe.threshold;
}, { passive: false });

const finishAppNavSwipe = (event) => {
  if (!appNavSwipe || event.pointerId !== appNavSwipe.pointerId) return;
  const shouldSuppressClick = appNavSwipe.axis === "horizontal";
  const destinationIndex = appNavSwipe.armed ? appNavSwipe.destinationIndex : -1;
  if (appShell.hasPointerCapture?.(event.pointerId)) appShell.releasePointerCapture?.(event.pointerId);
  appNavSwipe = null;
  if (shouldSuppressClick) suppressAppClickUntil = Date.now() + 500;
  const destination = navItems[destinationIndex]?.dataset.nav;
  if (destination) navigate(destination);
};

appShell?.addEventListener("pointerup", finishAppNavSwipe);
appShell?.addEventListener("pointercancel", () => {
  appNavSwipe = null;
});

document.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.go)));

document.addEventListener("click", (event) => {
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
  if (event.target.matches("[data-runner-load], [data-runner-reps]")) {
    const session = getActiveSession();
    if (!session) return;
    if (event.target.matches("[data-runner-load]")) {
      Store.updateActiveSession({ currentLoad: event.target.value === "" ? null : Number(event.target.value) });
    } else {
      Store.updateActiveSession({ currentReps: event.target.value === "" ? null : Number(event.target.value) });
    }
    renderRunnerPerformanceHint(findSessionExercise(session.currentExerciseId, session), Number(session.currentSetNumber || 1));
    updateRunnerPrimaryAction(getActiveSession());
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

document.querySelector("[data-finish]")?.addEventListener("click", async (event) => {
  const activeSession = getActiveSession();
  if (!activeSession || getCompletedSessionSets(activeSession) === 0) return;
  const finishButton = event.currentTarget;
  finishButton.disabled = true;
  setFinishStatus("Finalizando treino e enviando ao professor...", "");
  const session = buildWorkoutSessionPayload();
  Store.addSession(session);
  Store.updateActiveSession({ phase: SESSION_PHASE.PENDING_SYNC, syncStatus: "pending" });
  renderWorkoutRunner();
  const result = await sessionRepository.syncSession(session);
  if (result.session) Store.addSession(result.session);
  previousSessions = [result.session || session, ...previousSessions.filter((item) => item.id !== session.id)];
  Store.updateActiveSession({
    phase: result.synced ? SESSION_PHASE.COMPLETED : SESSION_PHASE.PENDING_SYNC,
    syncStatus: result.synced ? "synced" : "pending"
  });
  renderAll();
  setFinishStatus(
    result.synced
      ? "Treino enviado ao professor com cargas, reps e feedback."
      : result.session?.syncMessage || result.error?.message || "Treino salvo localmente; envio pendente.",
    result.synced ? "synced" : "warning"
  );
  finishButton.disabled = false;
  Platform.vibrate([40, 40, 80]);
  Platform.notify(result.synced ? "Treino concluído e enviado ao professor!" : "Treino concluído. Envio pendente.");
  document.querySelector("[data-runner-success-copy]").textContent = result.synced
    ? "Seu personal recebeu as séries e o feedback."
    : "O treino ficou salvo e será enviado quando a conexão voltar.";
  renderWorkoutRunner();
});

const startCurrentWorkoutSession = () => {
  if (currentWorkout.id === emptyWorkout.id || !getCurrentExercises().length) return;
  let activeSession = getActiveSession();
  if (activeSession && activeSession.workoutId !== currentWorkout.id) {
    const discard = window.confirm("Existe outro treino em andamento. Descartar esse registro e iniciar o treino selecionado?");
    if (!discard) {
      const activeWorkout = availableWorkouts.find((workout) => workout.id === activeSession.workoutId);
      if (activeWorkout) currentWorkout = activeWorkout;
      renderAll();
      navigate("workout/session");
      return;
    }
    Store.discardActiveSession();
    activeSession = null;
  }
  if (!activeSession) activeSession = createActiveSession(currentWorkout);
  navigate("workout/session");
};

document.querySelector("[data-start-workout]")?.addEventListener("click", startCurrentWorkoutSession);

pauseDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  pauseDialog.close();
  resumeActiveSession(getActiveSession());
  renderWorkoutRunner();
  requestRunnerWakeLock();
});

workoutRunner?.addEventListener("click", (event) => {
  if (Date.now() >= suppressRunnerClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

workoutRunner?.addEventListener("click", (event) => {
  const session = getActiveSession();
  if (!session) return;

  if (event.target.closest("[data-pause-session]")) {
    pauseActiveSession(session);
    syncRunnerClock();
    if (pauseDialog && !pauseDialog.open) pauseDialog.showModal();
    return;
  }

  if (event.target.closest("[data-continue-session]")) {
    pauseDialog.close?.();
    resumeActiveSession(getActiveSession());
    renderWorkoutRunner();
    requestRunnerWakeLock();
    return;
  }

  if (event.target.closest("[data-exit-session]")) {
    pauseDialog.close?.();
    navigate("workout");
    showToast("Seu treino foi pausado. Você poderá continuar depois.");
    return;
  }

  if (event.target.closest("[data-open-exercise-sheet]")) {
    renderRunnerExerciseSheet(session);
    if (exerciseSheet && !exerciseSheet.open) exerciseSheet.showModal();
    return;
  }

  if (event.target.closest("[data-close-exercise-sheet]")) {
    exerciseSheet.close?.();
    return;
  }

  const jumpButton = event.target.closest("[data-runner-jump]");
  if (jumpButton) {
    const exercise = findSessionExercise(jumpButton.dataset.runnerJump, session);
    if (!exercise) return;
    const completed = getExerciseEntries(occurrenceId(exercise), session);
    const completedNumbers = new Set(completed.map((entry) => Number(entry.setNumber)));
    let setNumber = 1;
    while (setNumber <= parseTotalSets(exercise) && completedNumbers.has(setNumber)) setNumber += 1;
    if (setNumber > parseTotalSets(exercise)) {
      Platform.notify("Este exercício já foi concluído. Toque em uma série abaixo para corrigir.");
      return;
    }
    Store.updateActiveSession({
      phase: SESSION_PHASE.ACTIVE_SET,
      currentExerciseId: occurrenceId(exercise),
      currentSetNumber: setNumber,
      currentLoad: null,
      currentReps: null,
      restEndsAt: null
    });
    exerciseSheet.close?.();
    renderWorkoutRunner();
    return;
  }

  const editSetButton = event.target.closest("[data-edit-completed-set]");
  if (editSetButton) {
    const removed = Store.removeActiveSetEntry(editSetButton.dataset.editCompletedSet, Number(editSetButton.dataset.editSetNumber));
    if (removed) Store.updateActiveSession({ currentLoad: removed.loadKg, currentReps: removed.reps });
    exerciseSheet.close?.();
    renderAll();
    renderWorkoutRunner();
    return;
  }

  const explainButton = event.target.closest("[data-explain]");
  if (explainButton) {
    const isRir = explainButton.dataset.explain === "rir";
    const isPrescription = explainButton.dataset.explain === "prescription";
    document.querySelector("[data-info-title]").textContent = isPrescription
      ? "RIR e cadência"
      : isRir ? "O que significa RIR?" : "Como ler a cadência?";
    document.querySelector("[data-info-copy]").textContent = isPrescription
      ? "RIR indica quantas repetições ainda seriam possíveis ao terminar a série. A cadência mostra o tempo de cada fase do movimento; em 2-0-2, são dois segundos na descida, sem pausa e dois na subida."
      : isRir
      ? "RIR indica quantas repetições você ainda conseguiria fazer ao terminar a série. RIR 2 significa parar sentindo que conseguiria aproximadamente mais duas."
      : "A cadência mostra o tempo de cada fase do movimento. Em 2-0-2, faça dois segundos na descida, sem pausa e dois segundos na subida.";
    if (infoDialog && !infoDialog.open) infoDialog.showModal();
    return;
  }

  if (event.target.closest("[data-close-info]")) {
    infoDialog.close?.();
    return;
  }

  if (event.target.closest("[data-report-discomfort]")) {
    const feedbackKey = `${session.currentExerciseId}:${session.currentSetNumber}`;
    const current = session.exerciseFeedback?.[feedbackKey]
      || session.exerciseFeedback?.[session.currentExerciseId]
      || {};
    discomfortForm.elements.severity.value = current.severity || "mild";
    discomfortForm.elements.region.value = current.region || "";
    discomfortForm.elements.note.value = current.note || "";
    if (discomfortDialog && !discomfortDialog.open) discomfortDialog.showModal();
    return;
  }

  if (event.target.closest("[data-save-discomfort]")) {
    event.preventDefault();
    const data = new FormData(discomfortForm);
    const severity = String(data.get("severity") || "mild");
    const feedback = { ...(session.exerciseFeedback || {}) };
    const feedbackKey = `${session.currentExerciseId}:${session.currentSetNumber}`;
    if (severity === "none") delete feedback[feedbackKey];
    else feedback[feedbackKey] = {
      workoutExerciseId: session.currentExerciseId,
      setNumber: Number(session.currentSetNumber || 1),
      severity,
      region: String(data.get("region") || ""),
      note: String(data.get("note") || "").trim(),
      reportedAt: new Date().toISOString()
    };
    Store.updateActiveSession({ exerciseFeedback: feedback });
    discomfortDialog.close?.();
    Platform.notify(severity === "none" ? "Registro removido." : "Desconforto salvo para o resumo.");
    return;
  }

  const adjustButton = event.target.closest("[data-adjust-runner]");
  if (adjustButton) {
    if (adjustButton === suppressedRunnerAdjustButton && Date.now() < suppressRunnerAdjustClickUntil) {
      event.preventDefault();
      suppressedRunnerAdjustButton = null;
      suppressRunnerAdjustClickUntil = 0;
      return;
    }
    suppressedRunnerAdjustButton = null;
    adjustRunnerValue(adjustButton);
    return;
  }

  const primaryButton = event.target.closest("[data-runner-primary-action]");
  if (primaryButton) {
    performRunnerPrimaryAction();
    return;
  }

  if (event.target.closest("[data-correct-last-set]")) {
    correctLastRunnerSet();
    return;
  }

  if (event.target.closest("[data-add-runner-rest]")) {
    const base = Math.max(Date.now(), new Date(session.restEndsAt || 0).getTime());
    Store.updateActiveSession({ restEndsAt: new Date(base + 30000).toISOString() });
    syncRunnerClock();
    return;
  }

  if (event.target.closest("[data-request-finish]")) {
    const done = getCompletedSessionSets(session);
    const total = getSessionTotalSets(session);
    if (!done) {
      if (!window.confirm("Nenhuma série foi registrada. Descartar este treino?")) return;
      Store.discardActiveSession();
      renderAll();
      navigate("workout");
      return;
    }
    if (done < total && !window.confirm(`Encerrar como treino parcial? ${total - done} série(s) ficarão pendentes.`)) return;
    Store.updateActiveSession({
      phase: SESSION_PHASE.AWAITING_SUMMARY,
      restEndsAt: null,
      transitionEndsAt: null,
      pendingExerciseId: null,
      pendingSetNumber: null
    });
    renderWorkoutRunner();
    return;
  }

  if (event.target.closest("[data-return-to-session]")) {
    const next = getNextIncompleteTarget(session, session.currentExerciseId);
    if (!next) {
      renderRunnerExerciseSheet(session);
      if (exerciseSheet && !exerciseSheet.open) exerciseSheet.showModal();
      return;
    }
    Store.updateActiveSession({
      phase: SESSION_PHASE.ACTIVE_SET,
      currentExerciseId: occurrenceId(next.exercise),
      currentSetNumber: next.setNumber,
      currentLoad: null,
      currentReps: null
    });
    renderWorkoutRunner();
    return;
  }

  if (event.target.closest("[data-discard-session]")) {
    if (!window.confirm("Descartar todas as séries registradas neste treino?")) return;
    exerciseSheet.close?.();
    Store.discardActiveSession();
    renderAll();
    navigate("workout");
    return;
  }

  if (event.target.closest("[data-close-success]")) {
    Store.clearActiveSession();
    document.querySelector("[data-finish-feedback]")?.reset();
    renderAll();
    navigate("progress");
  }
});

workoutRunner?.addEventListener("pointerdown", (event) => {
  const adjustButton = event.target.closest("[data-adjust-runner]");
  if (!adjustButton || !event.isPrimary || event.button > 0) return;
  stopRunnerAdjustHold();
  const holdState = {
    button: adjustButton,
    pointerId: event.pointerId,
    didRepeat: false,
    delayId: 0,
    repeatId: 0
  };
  runnerAdjustHold = holdState;
  adjustButton.setPointerCapture?.(event.pointerId);
  holdState.delayId = window.setTimeout(() => {
    if (runnerAdjustHold !== holdState) return;
    holdState.didRepeat = true;
    adjustButton.classList.add("is-holding");
    adjustRunnerValue(adjustButton);
    holdState.repeatId = window.setInterval(() => {
      if (runnerAdjustHold !== holdState) return;
      adjustRunnerValue(adjustButton, { vibrate: false });
    }, RUNNER_ADJUST_REPEAT_MS);
  }, RUNNER_ADJUST_HOLD_DELAY_MS);
});

document.addEventListener("pointerup", (event) => {
  if (runnerAdjustHold && event.pointerId === runnerAdjustHold.pointerId) {
    stopRunnerAdjustHold({ suppressClick: true });
  }
});

document.addEventListener("pointercancel", (event) => {
  if (runnerAdjustHold && event.pointerId === runnerAdjustHold.pointerId) stopRunnerAdjustHold();
});

window.addEventListener("blur", stopRunnerAdjustHold);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopRunnerAdjustHold();
});

workoutRunner?.addEventListener("contextmenu", (event) => {
  if (event.target.closest("[data-adjust-runner]")) event.preventDefault();
});

workoutRunner?.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.pointerType === "mouse") return;
  const session = getActiveSession();
  if (!session || !isRunnerPrimaryPhase(session.phase)) return;
  if (event.target.closest("input, textarea, select, iframe, video, dialog, [contenteditable], [data-adjust-runner]")) return;
  const primaryThreshold = Math.min(140, Math.max(88, workoutRunner.clientWidth * 0.22));
  runnerSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    axis: "pending",
    direction: null,
    armed: false,
    canCorrect: getSessionEntries(session).length > 0,
    primaryThreshold,
    correctionThreshold: Math.min(168, Math.max(108, primaryThreshold * 1.2)),
    threshold: primaryThreshold
  };
});

workoutRunner?.addEventListener("pointermove", (event) => {
  if (!runnerSwipe || event.pointerId !== runnerSwipe.pointerId) return;
  const deltaX = event.clientX - runnerSwipe.startX;
  const deltaY = event.clientY - runnerSwipe.startY;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (runnerSwipe.axis === "pending") {
    if (Math.hypot(deltaX, deltaY) < 12) return;
    if (verticalDistance > horizontalDistance * 1.15) {
      resetRunnerSwipeVisual();
      return;
    }
    if (horizontalDistance <= verticalDistance * 1.25) return;
    runnerSwipe.axis = "horizontal";
    runnerSwipe.direction = deltaX > 0 ? "correct" : "primary";
    runnerSwipe.threshold = runnerSwipe.direction === "correct"
      ? runnerSwipe.correctionThreshold
      : runnerSwipe.primaryThreshold;
    workoutRunner.setPointerCapture?.(event.pointerId);
  }

  if (runnerSwipe.axis !== "horizontal") return;
  event.preventDefault();
  const isCorrection = runnerSwipe.direction === "correct";
  const directedDistance = isCorrection ? deltaX : -deltaX;
  const progress = Math.min(1, Math.max(0, directedDistance / runnerSwipe.threshold));
  const armed = progress >= 1 && (!isCorrection || runnerSwipe.canCorrect);
  if (armed && !runnerSwipe.armed) Platform.vibrate(12);
  runnerSwipe.armed = armed;
  runnerActionBar?.classList.add("is-swiping");
  runnerActionBar?.classList.toggle("is-armed", armed);
  runnerActionBar?.classList.toggle("is-correcting", isCorrection);
  runnerActionBar?.style.setProperty("--swipe-progress", String(progress));
  runnerActionBar?.style.setProperty("--swipe-translation", `${(isCorrection ? 1 : -1) * progress * 5.5}rem`);
  const feedbackIcon = runnerSwipeFeedback?.querySelector("span");
  if (feedbackIcon) feedbackIcon.textContent = isCorrection ? "↶" : "✓";
  const feedbackLabel = runnerSwipeFeedback?.querySelector("strong");
  if (feedbackLabel) {
    if (isCorrection && !runnerSwipe.canCorrect) feedbackLabel.textContent = "Nenhuma série para corrigir";
    else if (armed) feedbackLabel.textContent = isCorrection ? "Solte para corrigir" : `Solte para ${runnerPrimaryVerb()}`;
    else feedbackLabel.textContent = "Continue deslizando";
  }
}, { passive: false });

const finishRunnerSwipe = (event) => {
  if (!runnerSwipe || event.pointerId !== runnerSwipe.pointerId) return;
  const shouldSuppressClick = runnerSwipe.axis === "horizontal";
  const shouldPerform = runnerSwipe.axis === "horizontal" && runnerSwipe.armed;
  const action = runnerSwipe.direction;
  if (workoutRunner.hasPointerCapture?.(event.pointerId)) workoutRunner.releasePointerCapture?.(event.pointerId);
  resetRunnerSwipeVisual();
  if (shouldSuppressClick) suppressRunnerClickUntil = Date.now() + 600;
  if (shouldPerform) {
    if (action === "correct") correctLastRunnerSet();
    else performRunnerPrimaryAction();
  }
};

workoutRunner?.addEventListener("pointerup", finishRunnerSwipe);
workoutRunner?.addEventListener("pointercancel", resetRunnerSwipeVisual);

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

  try {
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
  } catch (error) {
    console.error("[FlowFit][aluno][magic-link] Falha ao validar convite ou enviar link.", error);
    setAuthStatus("Não foi possível concluir o acesso agora. Tente novamente.", "warning");
  }
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
  renderAll();
  syncOnboarding();
  syncAuthMode("signin");
  setAuthChecking(false);
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
  await refreshStudentSessionHistory();
  const retriedSessions = await retryPendingSessions();
  if (retriedSessions > 0) {
    renderAll();
    if (!workoutRunner.hidden) renderWorkoutRunner();
    Platform.notify(`${retriedSessions} ${retriedSessions === 1 ? "treino pendente enviado" : "treinos pendentes enviados"}.`);
  }
};

window.addEventListener("pageshow", refreshOnForeground);
window.addEventListener("focus", refreshOnForeground);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshOnForeground();
    if (!workoutRunner.hidden) requestRunnerWakeLock();
  }
});

syncAuthMode(getInviteToken() ? "signup" : "signin");
Theme.reset();
syncThemeControls();
renderAll();
navigate(location.hash.slice(1) || "home", false);

if (Platform.canUseServiceWorker() && "serviceWorker" in navigator) {
  if (navigator.serviceWorker.controller) {
    let reloadingForServiceWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForServiceWorker) return;
      reloadingForServiceWorker = true;
      window.location.reload();
    });
  }
  window.addEventListener("load", () => navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch((error) => {
      console.warn("[FlowFit][aluno][opcional] Service worker indisponível.", error);
    }));
}

startAuthenticatedApp()
  .catch((error) => {
    console.error("Falha ao verificar acesso do aluno", error);
    window.FlowFitAlunoErrors = window.FlowFitAlunoErrors || [];
    window.FlowFitAlunoErrors.push(String(error?.message || error));
    activateAnonymousStore();
    syncOnboarding();
    syncAuthMode("signin", { preserveStatus: true });
    setAuthChecking(false);
    setAuthStatus("Não foi possível verificar sua sessão. Tente novamente.", "warning");
  })
  .finally(() => {
    markRuntimeReady();
  });
