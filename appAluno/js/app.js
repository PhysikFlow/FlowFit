import { Platform } from "./core/platform.js";
import { Store } from "./core/store.js";
import { Theme } from "./core/theme.js";
import { svgIcon } from "./core/icons.js";
import { LEGACY_REMOTE_THEME_KEY, REMOTE_THEME_KEY } from "./core/brand-theme.js";
import { authRepository } from "./data/repositories/auth-repository.js";
import { studentRepository } from "./data/repositories/student-repository.js";
import { themeRepository } from "./data/repositories/theme-repository.js";
import { PUBLISHED_WORKOUTS_KEY, workoutRepository } from "./data/repositories/workout-repository.js";

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const onboarding = document.querySelector("[data-onboarding]");
const onboardingForm = document.querySelector("[data-onboarding-form]");
const accessAppButton = document.querySelector("[data-access-app]");
const runtimeWarning = document.querySelector("[data-runtime-warning]");
const authStatus = document.querySelector("[data-auth-status]");
const toast = document.querySelector("[data-toast]");
const accentInput = document.querySelector("[data-accent]");
const brandInput = document.querySelector("[data-brand-input]");
const taglineInput = document.querySelector("[data-tagline-input]");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
let toastTimer;
let restTimerId;
let restRemaining = 0;
const SET_CLICK_DEBOUNCE_MS = 2000;
const setClickLocks = new Set();
const emptyStudent = {
  id: "student-empty",
  name: "Aluno",
  initials: "AL",
  goal: "Sem objetivo cadastrado",
  plan: "Sem plano",
  since: "hoje",
  coach: "Personal",
  frequency: "Sem frequencia cadastrada"
};
const emptyWorkout = {
  id: "workout-empty",
  code: "-",
  title: "Nenhum treino publicado",
  focus: "Aguardando prescricao do personal",
  estimatedMinutes: 0,
  lastDoneLabel: "novo",
  exercises: []
};
const scheduleItems = [];
const notificationItems = [];
let currentStudent = emptyStudent;
let currentWorkout = emptyWorkout;
let authAction = "signin";

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

const resolveCurrentWorkout = () => {
  if (!currentStudent?.name) return emptyWorkout;
  return workoutRepository.getLatestWorkoutForStudent(currentStudent.name) || emptyWorkout;
};

const formatVolume = (value) => `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`;

const formatDecimal = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const formatShortDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(date));

const formatMonthYear = (date) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(date));

const formatDelta = (current, previous, unit) => {
  if (previous === undefined) return `0 ${unit}`;
  const delta = Number(current) - Number(previous);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta)} ${unit}`;
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

const syncThemeControls = () => {
  if (accentInput) accentInput.value = Theme.value.accent;
  if (brandInput) brandInput.value = Theme.value.brandName;
  if (taglineInput) taglineInput.value = Theme.value.tagline;
  document.querySelectorAll("[data-brand-name]").forEach((item) => { item.textContent = Theme.value.brandName; });
  document.querySelectorAll("[data-brand-tagline]").forEach((item) => { item.textContent = Theme.value.tagline; });
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === Theme.value.mode));
};

const applyPublishedBrandTheme = async () => {
  try {
    const remote = await themeRepository.fetchBrandTheme();
    if (!remote?.accent || !remote?.brandName) return;
    Theme.apply(remote);
    syncThemeControls();
  } catch {
    // Mantem o tema local atual se o repositório remoto/cache falhar.
  }
};

const refreshPublishedWorkout = async ({ silent = false } = {}) => {
  const previousWorkoutId = currentWorkout.id;
  const result = await workoutRepository.fetchLatestWorkoutForCurrentStudent(currentStudent);
  currentWorkout = result.workout || emptyWorkout;

  const changed = currentWorkout.id !== previousWorkoutId;
  if (changed) {
    setClickLocks.clear();
    stopRestTimer();
    if (!silent && currentWorkout.id !== emptyWorkout.id) Platform.notify("Seu personal publicou um novo treino.");
  }
  if (changed || result.synced) renderAll();
  return result;
};

const syncOnboarding = () => {
  document.body.classList.toggle("has-onboarding", !Store.state.onboarded);
  onboarding?.classList.toggle("is-hidden", Store.state.onboarded);
};

const markRuntimeReady = () => {
  accessAppButton?.removeAttribute("aria-busy");
  accessAppButton?.setAttribute("data-ready", "true");
  if (runtimeWarning) runtimeWarning.hidden = true;
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
    coach: "Personal",
    frequency: student.plan || "Atendimento"
  };
};

const renderStudent = () => {
  const student = currentStudent || emptyStudent;
  document.querySelectorAll("[data-student-name]").forEach((item) => { item.textContent = student.name; });
  document.querySelectorAll("[data-student-initials]").forEach((item) => { item.textContent = student.initials; });
  document.querySelector("[data-student-since]").textContent = `Aluno desde ${String(student.since || "hoje").toLowerCase()}`;
  document.querySelector("[data-student-plan]").textContent = `Plano ${student.plan}`;
  document.querySelector("[data-coach-name]").textContent = student.coach;
  document.querySelector("[data-profile-goal]").textContent = student.goal || "Hipertrofia";
  document.querySelector("[data-profile-frequency]").textContent = student.frequency || "Sem frequencia cadastrada";
};

const renderHome = () => {
  document.querySelector("[data-home-workout]").textContent = `Treino ${currentWorkout.code}`;
  document.querySelector("[data-home-summary]").textContent =
    currentWorkout.id === emptyWorkout.id
      ? "Seu personal ainda nao publicou um treino para este email."
      : `${currentWorkout.title} - ${getCurrentExercises().length} exercicios - cerca de ${currentWorkout.estimatedMinutes} minutos.`;
  const sessions = Store.state.sessions || [];
  const doneWorkouts = sessions.length;
  const targetWorkouts = 4;
  const volumeKg = sessions.reduce((sum, session) => sum + Number(session.volume || 0), 0);
  const progressPercent = Math.min(100, Math.round((doneWorkouts / targetWorkouts) * 100));
  document.querySelector("[data-stat-done]").textContent = `${doneWorkouts}/${targetWorkouts}`;
  document.querySelector("[data-stat-volume]").textContent = formatVolume(volumeKg);
  document.querySelector("[data-stat-streak]").textContent = `${doneWorkouts} treinos`;
  document.querySelector("[data-week-percent]").textContent = `${progressPercent}%`;
  document.querySelector("[data-week-progress]").style.setProperty("--progress", `${progressPercent}%`);
  document.querySelector("[data-week-message]").textContent = doneWorkouts ? "Continue registrando seus treinos" : "Comece pelo treino publicado";
  document.querySelector("[data-week-delta]").textContent = `${progressPercent}%`;
  document.querySelector("[data-workout-title]").textContent = currentWorkout.title;
  document.querySelector("[data-workout-focus]").textContent = currentWorkout.focus;
  document.querySelector("[data-workout-plan-title]").textContent = currentWorkout.id === emptyWorkout.id ? "Sem treino ativo" : `Treino ${currentWorkout.code} - ${currentWorkout.title}`;
  document.querySelector("[data-workout-last]").textContent = currentWorkout.lastDoneLabel === "novo" ? "Ainda nao executado" : `Ultima execucao ${currentWorkout.lastDoneLabel}`;
  document.querySelector("[data-workout-minutes]").textContent = `${currentWorkout.estimatedMinutes} min`;
  document.querySelector("[data-workout-exercise-count]").textContent = `${getCurrentExercises().length} exercicios`;
  document.querySelector("[data-workout-set-count]").textContent = `${getTotalSets()} series`;
};

const renderWorkoutProgress = () => {
  const totalSets = getTotalSets();
  const done = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  const percent = totalSets > 0 ? Math.round((done / totalSets) * 100) : 0;
  document.querySelector("[data-session-count]").textContent = `${done}/${totalSets} series`;
  document.querySelector("[data-session-progress]").style.setProperty("--progress", `${percent}%`);
  document.querySelector("[data-finish]").disabled = totalSets === 0 || done < totalSets;
};

const getWorkoutVolume = () => getCurrentExercises().reduce((sum, exercise) => {
  const done = Store.getExerciseDone(exercise.id);
  const log = Store.getExerciseLog(exercise.id, {
    load: parseLoadKg(exercise.load),
    reps: parseReps(exercise)
  });
  return sum + (done * Number(log.load || 0) * Number(log.reps || 0));
}, 0);

const renderRestTimer = () => {
  const timer = document.querySelector("[data-rest-timer]");
  const label = document.querySelector("[data-rest-label]");
  timer.classList.toggle("is-active", restRemaining > 0);
  label.textContent = restRemaining > 0 ? `${restRemaining}s restantes` : "Pronto para iniciar";
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
      Platform.notify("Descanso finalizado. Proxima serie liberada.");
      return;
    }
    renderRestTimer();
  }, 1000);
};

const lockSetButton = (exerciseId, button) => {
  setClickLocks.add(exerciseId);
  button.disabled = true;
  button.classList.add("is-locked");

  window.setTimeout(() => {
    setClickLocks.delete(exerciseId);
    const currentButton = document.querySelector(`[data-set="${exerciseId}"]`);
    currentButton?.removeAttribute("disabled");
    currentButton?.classList.remove("is-locked");
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
    list.innerHTML = `<article class="empty-state card"><strong>Nenhum exercicio publicado.</strong><small>Peça ao personal para revisar este treino.</small></article>`;
    renderWorkoutProgress();
    return;
  }
  list.innerHTML = exercises.map((exercise, index) => {
    const total = parseTotalSets(exercise);
    const done = Store.getExerciseDone(exercise.id);
    const log = Store.getExerciseLog(exercise.id, {
      load: parseLoadKg(exercise.load),
      reps: parseReps(exercise)
    });
    const label = done >= total ? "Feito" : `${done}/${total}`;
    const locked = setClickLocks.has(exercise.id);
    return `
      <article class="exercise card">
        <span class="exercise__number">${String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3>${escapeHtml(exercise.name)}</h3>
          <p>${escapeHtml(exercise.prescription)} - ${escapeHtml(exercise.load)} - descanso ${escapeHtml(exercise.rest)}</p>
          <div class="exercise__meta">
            <span>${escapeHtml(exercise.target)}</span>
            <span>RIR ${escapeHtml(exercise.rir)}</span>
            <span>${escapeHtml(exercise.tempo)}</span>
          </div>
          <div class="set-log" aria-label="Registro rapido de ${escapeHtml(exercise.name)}">
            <label>Carga <input type="number" inputmode="decimal" min="0" step="0.5" value="${escapeHtml(log.load)}" data-log-load="${escapeHtml(exercise.id)}" aria-label="Carga usada em ${escapeHtml(exercise.name)}" /></label>
            <label>Reps <input type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(log.reps)}" data-log-reps="${escapeHtml(exercise.id)}" aria-label="Repeticoes por serie em ${escapeHtml(exercise.name)}" /></label>
          </div>
          <small>${escapeHtml(exercise.notes)}</small>
        </div>
        <button class="set-button ${done >= total ? "is-done" : ""} ${locked ? "is-locked" : ""}" type="button" data-set="${escapeHtml(exercise.id)}" data-total="${total}" aria-label="Registrar serie de ${escapeHtml(exercise.name)}" ${locked ? "disabled" : ""}>
          ${label}
        </button>
      </article>
    `;
  }).join("");
  renderWorkoutProgress();
};

const renderProgress = () => {
  const entries = Store.getProgressEntries([]);
  if (!entries.length) {
    document.querySelector("[data-chart]").innerHTML = `<article class="empty-state"><strong>Nenhum check-in salvo.</strong><small>Registre peso e medidas para criar seu historico real.</small></article>`;
    document.querySelector("[data-measurements-date]").textContent = "Sem registros";
    document.querySelector("[data-metric-list]").innerHTML = `<article class="empty-state card"><strong>Sem medidas ainda.</strong><small>Use o formulario de check-in acima.</small></article>`;
    document.querySelector("[data-measurement-history]").innerHTML = `<article class="empty-state card"><strong>Linha do tempo vazia.</strong><small>Os proximos check-ins aparecem aqui.</small></article>`;
    return;
  }
  const recentEntries = entries.slice(-7);
  const latest = entries.at(-1);
  const previous = entries.at(-2) || latest;
  const weights = recentEntries.map((entry) => entry.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const span = Math.max(maxWeight - minWeight, 1);
  const metrics = [
    { icon: "scale", label: "Peso", helper: "Meta: 78 kg", value: `${formatDecimal(latest.weight)} kg`, delta: formatDelta(latest.weight, previous.weight, "kg") },
    { icon: "ruler", label: "Cintura", helper: "Medida atual", value: `${formatDecimal(latest.waist)} cm`, delta: formatDelta(latest.waist, previous.waist, "cm") },
    { icon: "weight", label: "Braco", helper: "Medida atual", value: `${formatDecimal(latest.arm)} cm`, delta: formatDelta(latest.arm, previous.arm, "cm") }
  ];

  document.querySelector("[data-chart]").innerHTML = recentEntries.map((entry) => {
    const height = 28 + Math.round(((entry.weight - minWeight) / span) * 63);
    return `<span style="--height: ${height}%"><small>${formatShortDate(entry.date)}</small></span>`;
  }).join("");
  document.querySelector("[data-measurements-date]").textContent = formatShortDate(latest.date);
  document.querySelector("[data-metric-list]").innerHTML = metrics.map((metric) => `
    <article class="metric card">
      <span class="surface-icon">${svgIcon(metric.icon)}</span>
      <div><strong>${metric.label}</strong><small>${metric.helper}</small></div>
      <div class="metric__value"><strong>${metric.value}</strong><small>${metric.delta}</small></div>
    </article>
  `).join("");
  document.querySelector("[data-measurement-history]").innerHTML = [...entries].reverse().slice(0, 6).map((entry) => `
    <article class="measurement-row card">
      <span class="surface-icon">${svgIcon("ruler")}</span>
      <div><strong>${formatShortDate(entry.date)}</strong><small>Peso ${formatDecimal(entry.weight)} kg</small></div>
      <span>Cintura ${formatDecimal(entry.waist)} cm</span>
      <span>Braco ${formatDecimal(entry.arm)} cm</span>
    </article>
  `).join("");
};

const renderSchedule = () => {
  const filter = Store.state.scheduleFilter || "Todos";
  const items = Store.getScheduleItems(scheduleItems);
  const visibleItems = filter === "Todos" ? items : items.filter((item) => item.type === filter);
  const pendingCount = items.filter((item) => !Store.isReminderDone(item.id)).length;
  document.querySelector("[data-schedule-count]").textContent = `${pendingCount} pendentes`;
  document.querySelectorAll("[data-schedule-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scheduleFilter === filter);
  });
  if (!visibleItems.length) {
    document.querySelector("[data-schedule-list]").innerHTML =
      `<article class="empty-state card"><strong>Nenhum item neste filtro.</strong><small>Crie um lembrete local ou altere o filtro.</small></article>`;
    return;
  }
  document.querySelector("[data-schedule-list]").innerHTML = visibleItems.map((item) => {
    const done = Store.isReminderDone(item.id);
    return `
      <article class="schedule-item card ${done ? "is-muted" : ""}">
        <span class="surface-icon">${svgIcon(scheduleIconByType[item.type] || "calendar")}</span>
        <div>
          <span class="chip">${item.type}</span>
          <h3>${item.title}</h3>
          <p>${item.detail}</p>
          <small>${item.time}</small>
        </div>
        <button class="icon-button" type="button" data-reminder="${item.id}" aria-label="${done ? "Reativar" : "Dispensar"} lembrete">
          ${done ? svgIcon("refresh") : svgIcon("check")}
        </button>
      </article>
    `;
  }).join("");
};

const renderNotifications = () => {
  const unreadCount = notificationItems.filter((item) => !Store.isNotificationRead(item.id)).length;
  document.querySelector("[data-notification-count]").textContent = unreadCount;
  document.querySelector("[data-notification-count]").classList.toggle("is-hidden", unreadCount === 0);
  if (!notificationItems.length) {
    document.querySelector("[data-notification-list]").innerHTML =
      `<article class="empty-state card"><strong>Nenhum aviso recebido.</strong><small>As mensagens do personal aparecerao aqui quando o modulo de comunicacao for ativado.</small></article>`;
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
    target.innerHTML = `<article class="empty-state card"><strong>Nenhum treino salvo neste aparelho.</strong><small>Conclua o treino de hoje para criar o primeiro registro local.</small></article>`;
    return;
  }
  target.innerHTML = sessions.map((session) => `
    <article class="history-row card">
      <span class="surface-icon">${svgIcon("trophy")}</span>
      <div><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.finishedAt)}</small></div>
      <span class="chip">${session.sets}/${session.totalSets} series</span>
      <small>${formatVolume(session.volume || 0)} de volume</small>
    </article>
  `).join("");
};

const renderAll = () => {
  renderStudent();
  renderHome();
  renderExercises();
  renderProgress();
  renderSchedule();
  renderNotifications();
  renderHistory();
};

const startAuthenticatedApp = async () => {
  const session = await authRepository.getSession();
  if (!session?.user) {
    Store.resetOnboarding();
    currentStudent = emptyStudent;
    currentWorkout = emptyWorkout;
    renderAll();
    syncOnboarding();
    setAuthStatus("Entre ou crie sua conta de aluno.", "");
    return false;
  }

  const profileResult = await authRepository.ensureProfile({
    role: "student",
    name: session.user.user_metadata?.display_name || session.user.email
  });
  if (!profileResult.synced && !profileResult.profile) {
    Store.resetOnboarding();
    setAuthStatus("Login ok, mas o banco ainda nao aceitou profiles. Rode supabase/schema.sql no SQL Editor.", "warning");
    syncOnboarding();
    return false;
  }
  const authContext = await authRepository.getAuthContext();
  if (authContext?.role !== "student") {
    await authRepository.signOut();
    Store.resetOnboarding();
    setAuthStatus("Esta conta nao e de aluno. Use o painel do professor ou crie outra conta.", "warning");
    syncOnboarding();
    return false;
  }

  const studentResult = await studentRepository.fetchCurrentStudent();
  currentStudent = toRuntimeStudent(studentResult.student, authContext);
  Store.completeOnboarding({
    name: currentStudent.name,
    goal: currentStudent.goal,
    frequency: currentStudent.frequency
  });

  currentWorkout = emptyWorkout;
  await applyPublishedBrandTheme();
  await refreshPublishedWorkout({ silent: true });
  renderAll();
  syncOnboarding();
  navigate(location.hash.slice(1) || "home", false);

  if (!studentResult.student) {
    setAuthStatus("Conta autenticada, mas este email ainda nao foi cadastrado por um personal.", "warning");
    Platform.notify("Peça ao personal para cadastrar este email no painel.");
  } else {
    setAuthStatus("Conta autenticada. Dados reais carregados.", "synced");
  }

  return true;
};

navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(item.dataset.nav);
}));

document.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.go)));

document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-schedule-filter]");
  if (filterButton) {
    Store.setScheduleFilter(filterButton.dataset.scheduleFilter);
    renderSchedule();
  }

  const setButton = event.target.closest("[data-set]");
  if (setButton) {
    const exerciseId = setButton.dataset.set;
    if (setClickLocks.has(exerciseId)) return;
    const exercise = getCurrentExercises().find((item) => item.id === exerciseId);
    if (!exercise) return;
    const total = parseTotalSets(exercise);
    const current = Store.getExerciseDone(exercise.id);
    const next = current >= total ? 0 : current + 1;
    lockSetButton(exercise.id, setButton);
    playSetFeedback(setButton);
    Store.setExerciseDone(exercise.id, next);
    setButton.textContent = next >= total ? "Feito" : `${next}/${total}`;
    setButton.classList.toggle("is-done", next >= total);
    renderWorkoutProgress();
    Platform.vibrate(25);
    if (next >= total) Platform.notify("Exercicio concluido. Boa!");
    else if (next > 0) startRestTimer(parseRestSeconds(exercise));
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

document.querySelector("[data-progress-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  Store.addProgressEntry({
    id: `measure-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    weight: Number(data.get("weight") || 0),
    waist: Number(data.get("waist") || 0),
    arm: Number(data.get("arm") || 0)
  });
  renderProgress();
  Platform.notify("Check-in de evolucao salvo neste aparelho.");
});

document.querySelector("[data-schedule-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  Store.addScheduleItem({
    id: `custom-schedule-${Date.now()}`,
    time: String(data.get("time") || "Hoje"),
    title: String(data.get("title") || "Novo lembrete"),
    detail: "Lembrete criado localmente neste prototipo.",
    type: String(data.get("type") || "Treino")
  });
  Store.setScheduleFilter("Todos");
  renderSchedule();
  Platform.notify("Lembrete adicionado na agenda local.");
});

document.querySelector("[data-finish]")?.addEventListener("click", () => {
  const totalSets = getTotalSets();
  const done = getCurrentExercises().reduce((sum, exercise) => sum + Store.getExerciseDone(exercise.id), 0);
  if (done < totalSets) {
    Platform.notify("Registre todas as series antes de finalizar.");
    return;
  }
  Store.addSession({
    id: `session-${Date.now()}`,
    title: currentWorkout.title,
    sets: done,
    totalSets,
    volume: Math.round(getWorkoutVolume()),
    finishedAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
  });
  renderAll();
  Platform.vibrate([40, 40, 80]);
  Platform.notify("Treino concluido! Historico local atualizado.");
  navigate("progress");
});

document.querySelector("[data-reset-workout]")?.addEventListener("click", () => {
  Store.resetWorkout(currentWorkout.id);
  renderExercises();
  Platform.notify("Registro do treino atual reiniciado.");
});

document.querySelector("[data-skip-rest]")?.addEventListener("click", () => {
  stopRestTimer();
  Platform.notify("Descanso encerrado.");
});

onboardingForm?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-action]");
  if (button) authAction = button.dataset.authAction;
});

onboardingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(onboardingForm));
  setAuthStatus(authAction === "signup" ? "Criando conta de aluno..." : "Entrando...", "");

  const result = authAction === "signup"
    ? await authRepository.signUp({ ...data, role: "student" })
    : await authRepository.signIn({ ...data, role: "student" });

  if (!result.ok) {
    setAuthStatus(result.message || "Nao foi possivel autenticar.", "warning");
    return;
  }

  if (result.pendingEmailConfirmation) {
    setAuthStatus(result.message, "warning");
    return;
  }

  await startAuthenticatedApp();
  Platform.notify("Bem-vindo ao app.");
});

const signOut = async () => {
  await authRepository.signOut();
  Store.resetOnboarding();
  currentStudent = emptyStudent;
  currentWorkout = emptyWorkout;
  setClickLocks.clear();
  stopRestTimer();
  renderAll();
  syncOnboarding();
  setAuthStatus("Sessao encerrada. Entre novamente para ver seus dados.", "");
  Platform.notify("Sessao encerrada.");
};

document.querySelector("[data-reset-onboarding]")?.addEventListener("click", signOut);
document.querySelector("[data-sign-out]")?.addEventListener("click", signOut);

document.querySelector("[data-mark-all-read]")?.addEventListener("click", () => {
  Store.markAllNotificationsRead(notificationItems.map((item) => item.id));
  renderNotifications();
  Platform.notify("Todas as notificacoes foram marcadas como lidas.");
});

accentInput?.addEventListener("input", () => Theme.apply({ accent: accentInput.value }));
brandInput?.addEventListener("input", () => Theme.apply({ brandName: brandInput.value.trim() || "FlowFit" }));
taglineInput?.addEventListener("input", () => Theme.apply({ tagline: taglineInput.value.trim() || "Seu treino, no seu ritmo" }));
modeButtons.forEach((button) => button.addEventListener("click", () => Theme.apply({ mode: button.dataset.mode })));
document.querySelector("[data-theme-reset]")?.addEventListener("click", () => {
  Theme.reset();
  syncThemeControls();
  Platform.notify("Tema padrao restaurado.");
});

window.addEventListener("hashchange", () => navigate(location.hash.slice(1), false));
window.addEventListener("app:notify", (event) => showToast(event.detail));
window.addEventListener("app:theme", syncThemeControls);
window.addEventListener("storage", (event) => {
  if ([REMOTE_THEME_KEY, LEGACY_REMOTE_THEME_KEY].includes(event.key)) applyPublishedBrandTheme();
  if (event.key === PUBLISHED_WORKOUTS_KEY) {
    const previousWorkoutId = currentWorkout.id;
    currentWorkout = resolveCurrentWorkout();
    if (currentWorkout.id !== previousWorkoutId) {
      setClickLocks.clear();
      stopRestTimer();
      Platform.notify("Seu personal publicou um novo treino.");
    }
    renderAll();
  }
});

Theme.apply();
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
