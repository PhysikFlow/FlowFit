import { svgIcon } from "../../appAluno/js/core/icons.js?v=build-20260809-6";
import { Platform } from "../../appAluno/js/core/platform.js?v=build-20260813-1";
import { DEFAULT_BRAND_THEME, LOCAL_BRAND_ASSETS_KEY, applyThemeTokens, contrastRatio, inferModeFromColor, normalizeBrandTheme } from "../../appAluno/js/core/brand-theme.js?v=build-20260816-2";
import { InstallManager } from "../../appAluno/js/core/install.js?v=build-20260816-1";
import { STUDENTS_KEY, createStudentFromProfessorForm, studentRepository } from "../../appAluno/js/data/repositories/student-repository.js?v=build-20260813-2";
import { authRepository } from "../../appAluno/js/data/repositories/auth-repository.js?v=build-20260812-6";
import { themeRepository } from "../../appAluno/js/data/repositories/theme-repository.js?v=build-20260816-1";
import { PUBLISHED_WORKOUTS_KEY, createWorkoutFromProfessorForm, parseExerciseLine, workoutDateInputValue, workoutRepository, workoutStartTimestamp } from "../../appAluno/js/data/repositories/workout-repository.js?v=build-20260813-2";
import { WORKOUT_SESSIONS_KEY, sessionRepository } from "../../appAluno/js/data/repositories/session-repository.js?v=build-20260813-1";
import { createFeedback } from "./components/feedback.js?v=build-20260816-1";
import { initCustomSelects, refreshCustomSelects } from "../../appAluno/js/components/custom-select.js?v=build-20260816-1";
import { createNavigation } from "./core/navigation.js?v=build-20260816-1";
import { createDashboardScreen } from "./screens/dashboard/dashboard-screen.js?v=build-20260816-1";
import { createLocalAssetsEditor } from "./screens/appearance/local-assets-editor.js?v=build-20260816-2";
import { createWorkoutsScreen } from "./screens/workouts/workouts-screen.js?v=build-20260816-1";
import { createStudentsScreen } from "./screens/students/students-screen.js?v=build-20260816-3";
import { escapeHtml, formatUpdatedAt, formatVolume, initialsFromName, normalizeEmail, normalizeSearch } from "./utils/formatters.js?v=build-20260816-1";
import { createProfessorViewState } from "./state/view-state.js?v=build-20260816-1";

initCustomSelects();

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const jumpButtons = [...document.querySelectorAll("[data-nav-jump]")];
const title = document.querySelector("[data-page-title]");
const toast = document.querySelector("[data-toast]");
const { setStatus, showToast } = createFeedback({ toast });
const installAppButton = document.querySelector("[data-install-app]");
const brandInput = document.querySelector("[data-brand-input]");
const taglineInput = document.querySelector("[data-tagline-input]");
const accentInput = document.querySelector("[data-accent-input]");
const backgroundInput = document.querySelector("[data-background-input]");
const surfaceInput = document.querySelector("[data-surface-input]");
const textInput = document.querySelector("[data-text-input]");
const accentHexInput = document.querySelector("[data-accent-hex]");
const backgroundHexInput = document.querySelector("[data-background-hex]");
const surfaceHexInput = document.querySelector("[data-surface-hex]");
const textHexInput = document.querySelector("[data-text-hex]");
const fontInput = document.querySelector("[data-font-input]");
const radiusInput = document.querySelector("[data-radius-input]");
const backgroundStyleInput = document.querySelector("[data-background-style-input]");
const logoInput = document.querySelector("[data-logo-input]");
const logoFrameInput = document.querySelector("[data-logo-frame-input]");
const photoInput = document.querySelector("[data-photo-input]");
const assetCropDialog = document.querySelector("[data-asset-crop-dialog]");
const assetCropForm = document.querySelector("[data-asset-crop-form]");
const assetCropImage = document.querySelector("[data-asset-crop-image]");
const assetCropTitle = document.querySelector("[data-asset-crop-title]");
const assetCropStatus = document.querySelector("[data-asset-crop-status]");
const assetCropZoom = document.querySelector("[data-asset-crop-zoom]");
const assetCropConfirm = document.querySelector("[data-asset-crop-confirm]");
const themeStatus = document.querySelector("[data-theme-status]");
const studentSyncStatus = document.querySelector("[data-student-sync-status]");
const workoutForm = document.querySelector("[data-workout-form]");
const workoutBuilderMode = document.querySelector("[data-workout-builder-mode]");
const workoutBuilderTitle = document.querySelector("[data-workout-builder-title]");
const workoutBuilderCopy = document.querySelector("[data-workout-builder-copy]");
const workoutSubmit = document.querySelector("[data-workout-submit]");
const cancelWorkoutEditButton = document.querySelector("[data-cancel-workout-edit]");
const previewExercises = document.querySelector("[data-preview-exercises]");
const previewSets = document.querySelector("[data-preview-sets]");
const previewMinutes = document.querySelector("[data-preview-minutes]");
const previewList = document.querySelector("[data-preview-list]");
const workoutSyncStatus = document.querySelector("[data-workout-sync-status]");
const saveWorkoutDraftButton = document.querySelector("[data-save-workout-draft]");
const duplicateWorkoutDialog = document.querySelector("[data-duplicate-workout-dialog]");
const duplicateWorkoutForm = document.querySelector("[data-duplicate-workout-form]");
const duplicateWorkoutStudents = document.querySelector("[data-duplicate-workout-students]");
const duplicateWorkoutStatus = document.querySelector("[data-duplicate-workout-status]");
const studentFormPanel = document.querySelector("[data-student-form-panel]");
const studentSessionPanel = document.querySelector("[data-student-session-panel]");
const studentListView = document.querySelector("[data-student-list-view]");
const inviteDialog = document.querySelector("[data-invite-dialog]");
const importDialog = document.querySelector("[data-import-dialog]");
const workoutBuilder = document.querySelector("[data-workout-builder]");
const studentSearchInput = document.querySelector("[data-student-search]");
const studentFilterInput = document.querySelector("[data-student-filter]");
const workoutSearchInput = document.querySelector("[data-workout-search]");
const workoutFilterInput = document.querySelector("[data-workout-filter]");
const authGate = document.querySelector("[data-auth-gate]");
const authForm = document.querySelector("[data-auth-form]");
const authSessionCheck = document.querySelector("[data-auth-session-check]");
const authContent = authForm;
const authStatus = document.querySelector("[data-auth-status]");
const authTitle = document.querySelector("[data-auth-title]");
const authCopy = document.querySelector("[data-auth-copy]");
const authSubmit = document.querySelector("[data-auth-submit]");
const authSecondary = document.querySelector("[data-auth-secondary]");
const oauthLabel = document.querySelector("[data-oauth-label]");
const authUser = document.querySelector("[data-auth-user]");
const authGateSignOut = document.querySelector("[data-auth-gate-sign-out]");
const coachAccessNotice = document.querySelector("[data-coach-access-notice]");
const coachAccessMessage = document.querySelector("[data-coach-access-message]");
const coachProfileForm = document.querySelector("[data-coach-profile-form]");
const coachProfileStatus = document.querySelector("[data-coach-profile-status]");
const coachNameInput = document.querySelector("[data-coach-name-input]");
const coachHeadlineInput = document.querySelector("[data-coach-headline-input]");
const coachBioInput = document.querySelector("[data-coach-bio-input]");
const coachCityInput = document.querySelector("[data-coach-city-input]");
const coachCrefInput = document.querySelector("[data-coach-cref-input]");
const coachContactEmailInput = document.querySelector("[data-coach-contact-email-input]");
const coachWhatsappInput = document.querySelector("[data-coach-whatsapp-input]");
const coachPhoneInput = document.querySelector("[data-coach-phone-input]");
const contrastStatus = document.querySelector("[data-contrast-status]");
const themePaletteList = document.querySelector("[data-theme-palette-list]");
const themePaletteContext = document.querySelector("[data-theme-palette-context]");
const themePaletteModeButtons = [...document.querySelectorAll("[data-theme-palette-mode]")];
const inviteStudentOptions = document.querySelector("[data-invite-student-options]");
const inviteMessage = document.querySelector("[data-invite-message]");
const inviteStatus = document.querySelector("[data-invite-status]");
const whatsappInvite = document.querySelector("[data-whatsapp-invite]");
const copyInviteButton = document.querySelector("[data-copy-invite]");
const studentImportForm = document.querySelector("[data-student-import-form]");
const studentImportInput = document.querySelector("[data-student-import-input]");
const studentImportFile = document.querySelector("[data-student-import-file]");
const studentImportStatus = document.querySelector("[data-student-import-status]");

const ACCOUNT_PLAN = {
  name: "Plano inicial",
  activeStudentLimit: 20
};

const WORKOUT_DRAFT_STORAGE_PREFIX = "flowfit.professor.workout-draft";
const WORKOUT_DRAFT_SAVE_DELAY_MS = 420;
const DRAFT_EXERCISE_DETAIL_FIELDS = [
  "target",
  "load",
  "rest",
  "tempo",
  "rir",
  "notes",
  "instructions",
  "mediaUrl",
  "mediaType"
];

const THEME_PALETTES = [
  {
    id: "flowfit-night",
    name: "Violeta",
    mode: "dark",
    accent: "#7667ff",
    backgroundColor: "#090b10",
    surfaceColor: "#151922",
    textColor: "#f7f7fa",
    backgroundStyle: "aurora"
  },
  {
    id: "ocean-night",
    name: "Oceano",
    mode: "dark",
    accent: "#38bdf8",
    backgroundColor: "#06131c",
    surfaceColor: "#10232e",
    textColor: "#f4fbff",
    backgroundStyle: "spotlight"
  },
  {
    id: "emerald-night",
    name: "Esmeralda",
    mode: "dark",
    accent: "#34d399",
    backgroundColor: "#07130f",
    surfaceColor: "#11241d",
    textColor: "#f1faf6",
    backgroundStyle: "mesh"
  },
  {
    id: "sunset-night",
    name: "Pôr do sol",
    mode: "dark",
    accent: "#fb923c",
    backgroundColor: "#180d08",
    surfaceColor: "#2b1910",
    textColor: "#fff7ed",
    backgroundStyle: "diagonal"
  },
  {
    id: "indigo-day",
    name: "Índigo",
    mode: "light",
    accent: "#5b4cf0",
    backgroundColor: "#f4f4fb",
    surfaceColor: "#ffffff",
    textColor: "#171827",
    backgroundStyle: "aurora"
  },
  {
    id: "teal-day",
    name: "Verde água",
    mode: "light",
    accent: "#0f766e",
    backgroundColor: "#effaf8",
    surfaceColor: "#ffffff",
    textColor: "#10201d",
    backgroundStyle: "mesh"
  },
  {
    id: "berry-day",
    name: "Framboesa",
    mode: "light",
    accent: "#be185d",
    backgroundColor: "#fff1f5",
    surfaceColor: "#ffffff",
    textColor: "#2a1520",
    backgroundStyle: "spotlight"
  },
  {
    id: "cobalt-day",
    name: "Cobalto",
    mode: "light",
    accent: "#2563eb",
    backgroundColor: "#eff6ff",
    surfaceColor: "#ffffff",
    textColor: "#172033",
    backgroundStyle: "diagonal"
  }
];

let themeSaveTimer;
let students = studentRepository.listStudents();
let workouts = workoutRepository.listPublishedWorkouts();
let workoutSessions = [];
const viewState = createProfessorViewState();
let authContext = null;
let authAction = "signin";
let authenticatedSessionDetected = false;
let coachAccessTimer = null;
let coachAccessRevalidationPromise = null;
let authStateVersion = 0;
let isSigningOut = false;
let editingWorkoutId = "";
let workoutDraftExercises = [];
let workoutDraftTextSignature = "";
let workoutDraftDirty = false;
let workoutDraftSaveTimer;
let activeWorkoutDrag = null;
const workoutReorderAnimations = new Set();
let removedWorkoutExercise = null;
let duplicateWorkoutSourceId = "";
let restoredWorkoutDraftSavedAt = "";
let themePaletteMode = inferModeFromColor(backgroundInput?.value || DEFAULT_BRAND_THEME.backgroundColor);

const $ = (selector) => document.querySelector(selector);

const syncInstallButton = () => {
  if (!installAppButton) return;
  installAppButton.hidden = InstallManager.isStandalone();
};

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
  appearance: "Aparência",
  profile: "Perfil"
};

const setThemeStatus = (message, state = "") => setStatus(themeStatus, message, state);
const setStudentSyncStatus = (message, state = "") => setStatus(studentSyncStatus, message, state);
const setWorkoutSyncStatus = (message, state = "") => setStatus(workoutSyncStatus, message, state);
const setAuthStatus = (message, state = "") => setStatus(authStatus, message, state);
const setCoachProfileStatus = (message, state = "") => setStatus(coachProfileStatus, message, state);
const setInviteStatus = (message, state = "") => setStatus(inviteStatus, message, state);
const setStudentImportStatus = (message, state = "") => setStatus(studentImportStatus, message, state);

const rememberProfessorFailure = (stage, error) => {
  const message = String(error?.message || error || "Erro desconhecido");
  console.error(`[FlowFit][professor] Falha na etapa ${stage}.`, error);
  window.FlowFitProfessorErrors = window.FlowFitProfessorErrors || [];
  window.FlowFitProfessorErrors.push(`${stage}: ${message}`.slice(0, 180));
  document.body?.setAttribute("data-professor-error", `${stage}: ${message}`.slice(0, 180));
};

const warnOptionalFeature = (feature, error) => {
  console.warn(`[FlowFit][professor][opcional] ${feature} indisponível.`, error);
};

const setAuthGateSignOutVisible = (visible) => {
  if (authGateSignOut) authGateSignOut.hidden = !visible;
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

const normalizeHexInput = (value) => {
  const text = String(value || "").trim();
  const withHash = text.startsWith("#") ? text : `#${text}`;
  return HEX_PATTERN.test(withHash) ? withHash.toLowerCase() : "";
};

const formatContrast = (ratio) => ratio.toLocaleString("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const colorHexPairs = [
  [accentInput, accentHexInput],
  [backgroundInput, backgroundHexInput],
  [surfaceInput, surfaceHexInput],
  [textInput, textHexInput]
].filter(([color, hex]) => color && hex);

const syncHexInputsFromColors = () => {
  colorHexPairs.forEach(([color, hex]) => {
    hex.value = String(color.value || "").toLowerCase();
    hex.classList.remove("is-invalid");
  });
};

const updateContrastStatus = () => {
  const hasInvalidHex = colorHexPairs.some(([, hex]) => !normalizeHexInput(hex.value));
  const text = normalizeHexInput(textInput?.value) || DEFAULT_BRAND_THEME.textColor;
  const background = normalizeHexInput(backgroundInput?.value) || DEFAULT_BRAND_THEME.backgroundColor;
  const surface = normalizeHexInput(surfaceInput?.value) || DEFAULT_BRAND_THEME.surfaceColor;
  const backgroundRatio = contrastRatio(text, background);
  const surfaceRatio = contrastRatio(text, surface);
  const isReadable = !hasInvalidHex && backgroundRatio >= 4.5 && surfaceRatio >= 4.5;

  if (contrastStatus) {
    contrastStatus.textContent = hasInvalidHex
      ? "Digite cores hex válidas para salvar o tema."
      : isReadable
        ? `Contraste aprovado: fundo ${formatContrast(backgroundRatio)}:1, cards ${formatContrast(surfaceRatio)}:1.`
        : `Contraste insuficiente: fundo ${formatContrast(backgroundRatio)}:1, cards ${formatContrast(surfaceRatio)}:1. Use pelo menos 4,5:1.`;
    contrastStatus.classList.toggle("is-warning", !isReadable);
    contrastStatus.classList.toggle("is-synced", isReadable);
  }

  return isReadable;
};

const isCurrentThemePalette = (palette) => {
  const theme = readTheme();
  return ["accent", "backgroundColor", "surfaceColor", "textColor"]
    .every((key) => String(theme[key] || "").toLowerCase() === palette[key]);
};

const renderThemePalettes = ({ syncToTheme = false } = {}) => {
  if (!themePaletteList) return;
  if (syncToTheme) {
    themePaletteMode = inferModeFromColor(backgroundInput?.value || DEFAULT_BRAND_THEME.backgroundColor);
  }

  const isLight = themePaletteMode === "light";
  if (themePaletteContext) {
    themePaletteContext.textContent = `Combinações seguras para fundo ${isLight ? "claro" : "escuro"}.`;
  }
  themePaletteModeButtons.forEach((button) => {
    const active = button.dataset.themePaletteMode === themePaletteMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const fragment = document.createDocumentFragment();
  THEME_PALETTES.filter((palette) => palette.mode === themePaletteMode).forEach((palette) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-palette";
    button.dataset.themePalette = palette.id;
    button.setAttribute("aria-pressed", String(isCurrentThemePalette(palette)));
    button.setAttribute("aria-label", `Aplicar paleta ${palette.name}`);
    button.style.setProperty("--palette-accent", palette.accent);
    button.style.setProperty("--palette-background", palette.backgroundColor);
    button.style.setProperty("--palette-surface", palette.surfaceColor);
    button.style.setProperty("--palette-text", palette.textColor);
    button.innerHTML = `
      <span class="theme-palette__name">${escapeHtml(palette.name)}</span>
      <span class="theme-palette__swatches" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
    `;
    button.addEventListener("click", () => {
      fillThemeInputs({ ...readTheme(), ...palette });
      applyTheme();
      showToast(`Paleta ${palette.name} aplicada.`);
      queueThemeSave();
    });
    fragment.append(button);
  });
  themePaletteList.replaceChildren(fragment);
};

const professorAuthReturn = (() => {
  const url = new URL(window.location.href);
  const search = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return {
    detected: search.has("code") || search.has("error") || hash.has("access_token") || hash.has("error"),
    error: search.get("error_description") || hash.get("error_description") || search.get("error") || hash.get("error") || ""
  };
})();

const getAuthRedirectUrl = () => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.href;
};

const getSessionAfterAuthReturn = async () => {
  let session = await authRepository.getSession();
  if (session?.user || !professorAuthReturn.detected) return session;

  // Alguns navegadores entregam o callback antes de a persistencia local da
  // sessao terminar. Releia por uma janela curta antes de declarar falha.
  for (const delay of [150, 350, 700]) {
    await new Promise((resolve) => window.setTimeout(resolve, delay));
    session = await authRepository.getSession();
    if (session?.user) return session;
  }
  return null;
};

const getProviderLabel = () => "Google";

const authModeContent = {
  signin: {
    title: "Entrar no painel",
    copy: "Gerencie alunos, treinos e marca em um só lugar.",
    submit: "Entrar",
    oauth: "Entrar com Google",
    status: "",
    secondary: "Não tem conta? Use “Criar conta”."
  },
  signup: {
    title: "Criar conta de professor",
    copy: "Crie seu acesso e configure o perfil profissional.",
    submit: "Criar conta",
    oauth: "Criar com Google",
    status: "O acesso será liberado após a aprovação da conta.",
    secondary: "Já tem conta? Volte para “Entrar”."
  }
};

const clearAuthenticatedAccessState = () => {
  authForm?.removeAttribute("data-account-state");
  authForm?.removeAttribute("data-account-status");
};

const showAuthenticatedAccessState = ({ status = "pending", message = "", email = "" } = {}) => {
  const titles = {
    pending: "Cadastro recebido",
    suspended: "Acesso suspenso",
    cancelled: "Conta cancelada",
    expired: "Plano vencido",
    error: "Conta autenticada"
  };
  authForm?.setAttribute("data-account-state", "blocked");
  authForm?.setAttribute("data-account-status", status);
  if (authTitle) authTitle.textContent = titles[status] || "Acesso ainda não liberado";
  if (authCopy) {
    authCopy.textContent = email
      ? `${email} está autenticado como personal.`
      : "Sua identidade foi autenticada como personal.";
  }
  setAuthStatus(message || "Seu cadastro foi salvo e aguarda liberação.", "warning");
  setAuthGateSignOutVisible(true);
};

const formatAccessDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "data não informada";
};

const coachAccessView = (access) => {
  const status = access?.effective_status || access?.configured_status || "error";
  const customMessage = String(access?.status_note || "").trim();

  if (status === "grace") {
    return {
      ok: true,
      status,
      warning: true,
      message: `Seu plano venceu em ${formatAccessDate(access.access_expires_on)}. Você está no dia de carência. O acesso será bloqueado em ${formatAccessDate(access.blocked_on)} se a renovação não for registrada.`
    };
  }

  if (access?.allowed) {
    return {
      ok: true,
      status,
      warning: status === "past_due",
      message: customMessage || (status === "past_due"
        ? "Seu pagamento está pendente. O uso continua liberado enquanto você regulariza o acesso."
        : "")
    };
  }

  const messages = {
    pending: "Seu cadastro de personal está aguardando aprovação.",
    suspended: "Seu acesso de personal está suspenso.",
    cancelled: "Esta conta de personal foi cancelada.",
    expired: `Seu plano venceu em ${formatAccessDate(access?.access_expires_on)} e o período de carência terminou. Regularize o acesso para voltar a usar o painel.`,
    wrong_role: "Esta conta não é de professor. Use o app do aluno ou entre com outro email."
  };
  return {
    ok: false,
    status,
    warning: false,
    message: customMessage || messages[status] || "Seu acesso de personal não está ativo."
  };
};

const scheduleCoachAccessCheck = (nextTransitionAt) => {
  clearTimeout(coachAccessTimer);
  coachAccessTimer = null;
  if (!nextTransitionAt) return;
  const delay = new Date(nextTransitionAt).getTime() - Date.now() + 1000;
  if (!Number.isFinite(delay)) return;
  coachAccessTimer = setTimeout(
    () => revalidateCoachAccess(),
    Math.max(1000, Math.min(delay, 2147483647))
  );
};

const syncAuthMode = (mode = authAction, { preserveStatus = false } = {}) => {
  clearAuthenticatedAccessState();
  authAction = mode === "signup" ? "signup" : "signin";
  const content = authModeContent[authAction];
  if (authForm) authForm.dataset.authMode = authAction;
  if (authTitle) authTitle.textContent = content.title;
  if (authCopy) authCopy.textContent = content.copy;
  if (authSubmit) authSubmit.textContent = content.submit;
  if (oauthLabel) oauthLabel.textContent = content.oauth;
  if (authSecondary) authSecondary.textContent = content.secondary;
  authForm?.querySelector('input[name="password"]')?.setAttribute("autocomplete", authAction === "signup" ? "new-password" : "current-password");
  authForm?.querySelectorAll("[data-auth-mode-button]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authModeButton === authAction);
  });
  if (!preserveStatus) setAuthStatus(content.status, "");
};

const handlePasswordReset = async () => {
  const email = authForm?.querySelector('input[name="email"]')?.value;
  if (!email) {
    setAuthStatus("Informe seu email para recuperar a senha.", "warning");
    return;
  }

  setAuthStatus("Enviando email de recuperação...", "");
  try {
    const result = await authRepository.resetPassword({ email, redirectTo: getAuthRedirectUrl() });
    setAuthStatus(
      result.ok ? "Enviamos o link de recuperação para seu email." : result.message || "Não foi possível enviar a recuperação.",
      result.ok ? "synced" : "warning"
    );
  } catch (error) {
    rememberProfessorFailure("password-reset", error);
    setAuthStatus("Não foi possível enviar a recuperação. Tente novamente.", "warning");
  }
};

const getActiveStudentCount = () => students.filter((student) => student.status === "Ativo").length;

const isInviteExpired = (student) => student?.inviteStatus === "pending"
  && student?.inviteExpiresAt
  && new Date(student.inviteExpiresAt).getTime() <= Date.now();

const getStudentAppUrl = (student) => {
  const url = new URL("../appAluno/", window.location.href);
  if (student?.inviteToken) url.searchParams.set("invite", student.inviteToken);
  return url.href;
};

const getCoachPublicName = () => authContext?.profile?.name
  || authContext?.user?.user_metadata?.display_name
  || authContext?.email
  || "seu personal";

const buildInviteMessage = (student) => {
  if (!student?.inviteToken) return "";
  const brandName = brandInput?.value?.trim() || DEFAULT_BRAND_THEME.brandName;
  const emailLine = student.email
    ? `Você também pode entrar diretamente com ${student.email}, sem precisar guardar este link.`
    : "Como seu email não foi cadastrado, use este link no primeiro acesso.";
  return [
    `Oi, ${student.name}!`,
    `${getCoachPublicName()} liberou seu acesso ao ${brandName}.`,
    `Acesse: ${getStudentAppUrl(student)}`,
    emailLine,
    "Continue com Google ou peça um link mágico por email. Não é necessário criar senha."
  ].join("\n");
};

const detectCsvDelimiter = (text) => {
  const firstLine = String(text || "").split(/\r?\n/)[0] || "";
  return (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
};

const parseDelimitedRows = (text, delimiter) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (char === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const normalizeCsvKey = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "");

const parseStudentCsv = (text) => {
  const rows = parseDelimitedRows(text, detectCsvDelimiter(text));
  if (!rows.length) return [];

  const firstRowKeys = rows[0].map(normalizeCsvKey);
  const hasHeader = firstRowKeys.some((key) => ["nome", "name", "email", "objetivo", "goal", "status"].includes(key));
  const header = hasHeader ? firstRowKeys : ["nome", "email", "objetivo", "status"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const indexOf = (...keys) => {
    const normalizedKeys = keys.map(normalizeCsvKey);
    return header.findIndex((key) => normalizedKeys.includes(key));
  };

  const nameIndex = indexOf("nome", "name", "aluno", "student");
  const emailIndex = indexOf("email", "e-mail", "mail");
  const goalIndex = indexOf("objetivo", "goal");
  const statusIndex = indexOf("status", "situacao", "situação");

  return dataRows
    .map((row) => ({
      name: row[nameIndex] || "",
      email: row[emailIndex] || "",
      goal: row[goalIndex] || "Hipertrofia",
      status: row[statusIndex] || "Ativo"
    }))
    .filter((student) => student.name);
};

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
    rememberProfessorFailure("oauth-start", error);
    setAuthStatus(`Não foi possível abrir login com ${label}. Tente novamente.`, "warning");
  }
};

const setAuthLocked = (locked) => {
  authGate?.classList.toggle("is-hidden", !locked);
  document.body.classList.toggle("is-auth-locked", locked);
};

const setAuthChecking = (checking) => {
  if (authSessionCheck) authSessionCheck.hidden = !checking;
  if (authContent) authContent.hidden = checking;
  authGate?.setAttribute("aria-busy", String(checking));
};

const {
  readLocalBrandAssets,
  writeLocalBrandAssets,
  renderLocalBrandAssets,
  handleLocalAssetInput,
  saveCroppedLocalAsset,
  closeAssetCropDialog,
  disposeAssetCropper,
  setAssetCropZoom,
  isProcessing: isProcessingLocalAsset
} = createLocalAssetsEditor({
  getAuthContext: () => authContext,
  setStatus,
  showToast,
  setText,
  setThemeStatus
});
const readTheme = () => ({
  brandName: brandInput?.value?.trim() || DEFAULT_BRAND_THEME.brandName,
  tagline: taglineInput?.value?.trim() || DEFAULT_BRAND_THEME.tagline,
  accent: accentInput?.value || DEFAULT_BRAND_THEME.accent,
  backgroundColor: backgroundInput?.value || DEFAULT_BRAND_THEME.backgroundColor,
  surfaceColor: surfaceInput?.value || DEFAULT_BRAND_THEME.surfaceColor,
  textColor: textInput?.value || DEFAULT_BRAND_THEME.textColor,
  fontPreset: fontInput?.value || DEFAULT_BRAND_THEME.fontPreset,
  radiusPreset: radiusInput?.value || DEFAULT_BRAND_THEME.radiusPreset,
  backgroundStyle: backgroundStyleInput?.value || DEFAULT_BRAND_THEME.backgroundStyle,
  mode: inferModeFromColor(backgroundInput?.value || DEFAULT_BRAND_THEME.backgroundColor)
});

const fillThemeInputs = (theme) => {
  const normalized = normalizeBrandTheme(theme);
  if (brandInput) brandInput.value = normalized.brandName;
  if (taglineInput) taglineInput.value = normalized.tagline;
  if (accentInput) accentInput.value = normalized.accent;
  if (backgroundInput) backgroundInput.value = normalized.backgroundColor;
  if (surfaceInput) surfaceInput.value = normalized.surfaceColor;
  if (textInput) textInput.value = normalized.textColor;
  if (fontInput) fontInput.value = normalized.fontPreset;
  if (radiusInput) radiusInput.value = normalized.radiusPreset;
  if (backgroundStyleInput) backgroundStyleInput.value = normalized.backgroundStyle;
  refreshCustomSelects(document.querySelector("[data-page='appearance']") || document);
  syncHexInputsFromColors();
  updateContrastStatus();
  renderThemePalettes({ syncToTheme: true });
  return normalized;
};

const saveThemeNow = async ({ silent = false } = {}) => {
  clearTimeout(themeSaveTimer);
  if (!updateContrastStatus()) {
    setThemeStatus("Ajuste o contraste antes de salvar o tema.", "warning");
    if (!silent) showToast("Contraste insuficiente para salvar o tema.");
    return { synced: false, blocked: true, theme: readTheme() };
  }
  setThemeStatus("Salvando…", "");
  const result = await themeRepository.saveBrandTheme(readTheme());
  const message = result.synced && result.partial
    ? "Salvo parcialmente. Recarregue e tente novamente."
    : result.synced
    ? "Salvo"
    : "Não foi possível salvar. Verifique a conexão e tente novamente.";
  setThemeStatus(message, result.synced && !result.partial ? "synced" : "warning");
  if (!silent) showToast(result.synced && !result.partial ? "Aparência publicada." : "Aparência salva com aviso.");
  return result;
};

const queueThemeSave = () => {
  clearTimeout(themeSaveTimer);
  setThemeStatus("Salvando…", "");
  themeSaveTimer = setTimeout(() => saveThemeNow({ silent: true }), 700);
};

const syncStudentSessionPresentation = () => {
  if (!studentSessionPanel) return;
  const hasSelection = Boolean(viewState.studentSessionOpen && viewState.selectedStudentId && !studentSessionPanel.hidden);
  if (studentListView) studentListView.hidden = hasSelection;
  studentSessionPanel.classList.toggle("is-detail-view", hasSelection);
};

const setStudentSessionOpen = (open, { focus = true } = {}) => {
  viewState.studentSessionOpen = Boolean(open && viewState.selectedStudentId && !studentSessionPanel?.hidden);
  syncStudentSessionPresentation();
  if (viewState.studentSessionOpen && focus) {
    window.setTimeout(() => studentSessionPanel?.querySelector("[data-student-session-close]")?.focus(), 80);
  }
};

const revealStudentSession = () => {
  setStudentSessionOpen(true);
  studentSessionPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const { navigate } = createNavigation({
  pages,
  navItems,
  title,
  pageTitles,
  onNavigate: (destination) => {
    if (destination !== "students") setStudentSessionOpen(false, { focus: false });
  }
});

const setStudentFormOpen = (open, { focus = true } = {}) => {
  if (!studentFormPanel) return;
  if (open) setStudentSessionOpen(false, { focus: false });
  if (open && !studentFormPanel.open) studentFormPanel.showModal();
  if (!open && studentFormPanel.open) studentFormPanel.close();
  if (open && focus) window.setTimeout(() => studentFormPanel.querySelector("input, select, textarea")?.focus(), 80);
};

const setWorkoutBuilderOpen = (open, { focus = true } = {}) => {
  if (!workoutBuilder) return;
  workoutBuilder.hidden = !open;
  if (!open) return;
  workoutBuilder.scrollIntoView({ behavior: "smooth", block: "start" });
  if (focus) window.setTimeout(() => workoutForm?.querySelector("select, input, textarea")?.focus(), 260);
};

const focusWorkoutForm = () => {
  setWorkoutBuilderOpen(true);
};

const findExistingStudentForDraft = (draft) => {
  const normalizedEmail = normalizeEmail(draft.email);
  if (!normalizedEmail) return null;
  return students.find((student) => normalizeEmail(student.email) === normalizedEmail) || null;
};

const mergeStudentDraftWithExisting = (draft) => {
  const existing = findExistingStudentForDraft(draft);
  const next = createStudentFromProfessorForm(draft);
  if (!existing) return next;
  return {
    ...existing,
    ...next,
    id: existing.id,
    studentKey: existing.studentKey,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };
};

const effortLabel = (value) => ({
  easy: "leve",
  ok: "na medida",
  hard: "pesado"
}[value] || value || "sem feedback");

const painLabel = (value) => ({
  none: "sem dor",
  mild: "desconforto leve",
  pain: "relatou dor"
}[value] || value || "sem dor");

const formatDateForInput = (value) => {
  return workoutDateInputValue(value);
};

const formatWorkoutStart = (value) => {
  const dateKey = workoutDateInputValue(value);
  if (!dateKey) return "entrada indefinida";
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
};

const getWorkoutStage = (workout) => {
  const startsAt = workoutStartTimestamp(workout?.startsAt || workout?.updatedAt);
  const isScheduled = Number.isFinite(startsAt) && startsAt > Date.now();
  return {
    label: isScheduled ? "Agendado" : "Ativo",
    detail: isScheduled ? `entra em ${formatWorkoutStart(workout.startsAt)}` : `vigente desde ${formatWorkoutStart(workout.startsAt || workout.updatedAt)}`
  };
};

const getWorkoutSyncLabel = (workout) => {
  if (workout?.syncStatus === "synced") return "Publicado";
  if (workout?.syncStatus === "failed") return "Pendente";
  return "Rascunho";
};

const describeWorkoutSyncResult = (result) => {
  if (result.synced && result.partial) return "Treino enviado sem agendamento. Tente republicar para completar.";
  if (result.synced) return "Treino enviado. O aluno recebe quando abrir ou atualizar o app.";
  if (result.reason === "not-authenticated-as-coach") return "Entre novamente para enviar o treino ao aluno.";
  return "Treino salvo como rascunho. Verifique a conexão e tente publicar novamente.";
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

const getPublishedWorkoutForStudent = (student) => workouts.find((workout) => workout.studentId === student.id)
  || workouts.find((workout) => workout.studentKey === student.studentKey);

const syncStudentWorkout = (workout) => {
  students = students.map((student) => {
    const matchesStudent = workout.studentId
      ? student.id === workout.studentId
      : student.studentKey === workout.studentKey;
    if (!matchesStudent) return student;
    return {
      ...student,
      workout: workout.title,
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

const getSessionsForStudent = (studentId) => workoutSessions
  .filter((session) => session.studentId === studentId)
  .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));

const applyWorkoutSessions = (sessions = sessionRepository.listCachedSessions({
  coachId: authContext?.coachId || ""
})) => {
  workoutSessions = [...sessions].sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));
  renderStudents();
  renderStudentSessionPanel();
  renderDashboard();
};

const updateDataStatus = (status) => {
  viewState.dataStatus = status;
  renderDashboard();
};

const refreshStudents = async ({ silent = false } = {}) => {
  if (!silent) setStudentSyncStatus("Buscando alunos...", "");
  updateDataStatus("Sincronizando");
  const result = await studentRepository.fetchStudents();
  viewState.dataStatus = result.synced ? "Online" : "Local";
  applyStudents(result.students);
  setStudentSyncStatus(
    result.synced ? "Alunos atualizados." : "Alunos em modo offline.",
    result.synced ? "synced" : "warning"
  );
  return result;
};

const refreshPublishedWorkouts = async ({ silent = false } = {}) => {
  if (!silent) setWorkoutSyncStatus("Buscando treinos publicados...", "");
  updateDataStatus("Sincronizando");
  const result = await workoutRepository.fetchPublishedWorkouts();
  viewState.dataStatus = result.synced ? "Online" : viewState.dataStatus;
  applyPublishedWorkouts(result.workouts);
  setWorkoutSyncStatus(
    result.synced ? "Treinos atualizados." : "Treinos em modo offline.",
    result.synced ? "synced" : "warning"
  );
  return result;
};

const refreshWorkoutSessions = async ({ silent = false } = {}) => {
  if (!silent) setStudentSyncStatus("Buscando execuções dos alunos...", "");
  updateDataStatus("Sincronizando");
  const result = await sessionRepository.fetchCoachSessions();
  viewState.dataStatus = result.synced ? "Online" : viewState.dataStatus;
  applyWorkoutSessions(result.sessions);
  if (!silent) {
    setStudentSyncStatus(
      result.synced ? "Execuções dos alunos atualizadas." : "Execuções em modo offline/local.",
      result.synced ? "synced" : "warning"
    );
  }
  return result;
};

const renderIcons = () => {
  document.querySelectorAll("[data-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.icon);
  });
  setHtml("[data-brand-icon]", svgIcon("dumbbell"));
  setHtml("[data-brand-icon-mobile]", svgIcon("dumbbell"));
};

const renderCoachProfile = () => {
  const profile = authContext?.profile;
  const fallbackName = authContext?.user?.user_metadata?.display_name || authContext?.email || "Personal";
  const name = profile?.name || fallbackName;
  const headline = profile?.headline || "Perfil do personal";
  const bio = profile?.bio || "";
  const city = profile?.city || "";
  const contactEmail = profile?.contactEmail || "";
  const phone = profile?.phone || "";
  const whatsapp = profile?.whatsapp || "";
  const cref = profile?.cref || "";
  const email = authContext?.email || "Entre para sincronizar";
  const contactItems = [
    city,
    whatsapp ? `WhatsApp ${whatsapp}` : "",
    phone ? `Tel. ${phone}` : "",
    contactEmail
  ].filter(Boolean);

  setAllText("[data-coach-name]", name);
  setAllText("[data-coach-headline]", headline);
  setAllText("[data-coach-bio]", bio || "Bio profissional ainda não preenchida.");
  setAllText("[data-coach-contact-line]", contactItems.length ? contactItems.join(" • ") : "Contato profissional não informado.");
  setAllText("[data-coach-cref-line]", cref ? `CREF ${cref}` : "CREF não informado.");
  setAllText("[data-coach-email]", email);
  setAllText("[data-coach-initials]", initialsFromName(name));
  setText("[data-auth-user]", authContext?.email || "");
  if (authUser) authUser.title = authContext?.email || "";

  if (coachNameInput && document.activeElement !== coachNameInput) coachNameInput.value = profile?.name || "";
  if (coachHeadlineInput && document.activeElement !== coachHeadlineInput) coachHeadlineInput.value = profile?.headline || "";
  if (coachBioInput && document.activeElement !== coachBioInput) coachBioInput.value = bio;
  if (coachCityInput && document.activeElement !== coachCityInput) coachCityInput.value = city;
  if (coachCrefInput && document.activeElement !== coachCrefInput) coachCrefInput.value = cref;
  if (coachContactEmailInput && document.activeElement !== coachContactEmailInput) coachContactEmailInput.value = contactEmail;
  if (coachWhatsappInput && document.activeElement !== coachWhatsappInput) coachWhatsappInput.value = whatsapp;
  if (coachPhoneInput && document.activeElement !== coachPhoneInput) coachPhoneInput.value = phone;
  renderLocalBrandAssets();
};

const getStudentSituations = (student) => {
  const publishedWorkout = getPublishedWorkoutForStudent(student);
  const main = String(student.nextAction || "").trim()
    || (!publishedWorkout ? "Criar primeiro treino" : "Acompanhar aluno");
  const normalizedMain = normalizeSearch(main);
  const secondary = [];

  if (!publishedWorkout && !normalizedMain.includes("treino")) secondary.push("Sem treino publicado");
  if (student.inviteStatus !== "accepted" && !/(convite|acesso)/.test(normalizedMain)) {
    secondary.push(isInviteExpired(student) ? "Convite expirado" : "Convite pendente");
  }
  if (student.status && student.status !== "Ativo" && normalizeSearch(student.status) !== normalizedMain) {
    secondary.push(student.status);
  }

  return { main, secondary, publishedWorkout };
};

const {
  render: renderDashboard,
  renderAccount,
  renderActivities,
  renderTasks
} = createDashboardScreen({
  accountPlan: ACCOUNT_PLAN,
  getStudents: () => students,
  getWorkouts: () => workouts,
  getSessions: () => workoutSessions,
  getDataStatus: () => viewState.dataStatus,
  getStudentSituations,
  formatVolume,
  effortLabel,
  formatUpdatedAt,
  setStatus
});

const renderInviteTools = () => {
  if (!inviteStudentOptions || !inviteMessage || !whatsappInvite) return;
  const previousValue = inviteStudentOptions.value;
  const hasStudents = students.some((student) => student.inviteToken);

  inviteStudentOptions.disabled = !hasStudents;
  copyInviteButton?.toggleAttribute("disabled", !hasStudents);
  whatsappInvite.classList.toggle("is-disabled", !hasStudents);
  whatsappInvite.setAttribute("aria-disabled", String(!hasStudents));

  if (!hasStudents) {
    inviteStudentOptions.innerHTML = `<option value="">Cadastre um aluno primeiro</option>`;
    inviteMessage.value = "";
    whatsappInvite.href = "#";
    if (copyInviteButton) copyInviteButton.textContent = "Copiar convite";
    setInviteStatus("Cadastre um aluno para gerar o primeiro convite.", "");
    refreshCustomSelects(inviteStudentOptions);
    return;
  }

  inviteStudentOptions.innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}" data-icon="${escapeHtml(initialsFromName(student.name))}" data-avatar="true"${student.email ? ` data-description="${escapeHtml(student.email)}"` : ""}>${escapeHtml(student.name)}</option>`).join("");
  if (students.some((student) => student.id === previousValue)) inviteStudentOptions.value = previousValue;

  const selected = students.find((student) => student.id === inviteStudentOptions.value && student.inviteToken)
    || students.find((student) => student.inviteToken);
  if (selected) inviteStudentOptions.value = selected.id;
  const message = buildInviteMessage(selected);
  const expired = isInviteExpired(selected);
  inviteMessage.value = message;
  whatsappInvite.href = expired ? "#" : `https://wa.me/?text=${encodeURIComponent(message)}`;
  whatsappInvite.classList.toggle("is-disabled", expired);
  whatsappInvite.setAttribute("aria-disabled", String(expired));
  if (copyInviteButton) copyInviteButton.textContent = expired ? "Gerar novo convite" : "Copiar convite";
  if (expired) setInviteStatus(`O convite de ${selected.name} expirou. Gere um novo link.`, "warning");
  else if (selected.inviteStatus === "accepted") setInviteStatus(`${selected.name} já ativou o acesso.`, "synced");
  else if (selected.email) setInviteStatus(`Link opcional: ${selected.name} também pode entrar diretamente com o email cadastrado.`, "synced");
  else setInviteStatus(`Convite necessário: o email será definido no primeiro acesso de ${selected.name}.`, "warning");
  refreshCustomSelects(inviteStudentOptions);
};

const renderStudentOptions = () => {
  const select = document.querySelector("[data-student-options]");
  const submitButton = workoutForm?.querySelector("button[type='submit']");
  if (!select) return;
  if (!students.length) {
    select.innerHTML = `<option value="">Cadastre um aluno primeiro</option>`;
    select.disabled = true;
    if (submitButton) submitButton.disabled = true;
    renderInviteTools();
    return;
  }

  const previousValue = select.value;
  select.disabled = false;
  if (submitButton) submitButton.disabled = false;
  select.innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}" data-icon="${escapeHtml(initialsFromName(student.name))}" data-avatar="true"${student.email ? ` data-description="${escapeHtml(student.email)}"` : ""}>${escapeHtml(student.name)}</option>`).join("");
  if (students.some((student) => student.id === previousValue)) select.value = previousValue;
  renderInviteTools();
};

const createDraftExerciseKey = () => globalThis.crypto?.randomUUID?.()
  || `draft-exercise-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const compactPrescription = (value) => String(value || "3 x 10")
  .trim()
  .replace(/\s*x\s*/i, "x");

const exerciseToDraftLine = (exercise) => {
  const canonical = `${String(exercise?.name || "Exercício").trim()} ${compactPrescription(exercise?.prescription)}`.trim();
  const sourceLine = String(exercise?.sourceLine || "").trim();
  if (!sourceLine) return canonical;
  const parsedSource = parseExerciseLine(sourceLine, 0, "draft-source");
  const sameName = normalizeSearch(parsedSource.name) === normalizeSearch(exercise.name);
  const samePrescription = compactPrescription(parsedSource.prescription) === compactPrescription(exercise.prescription);
  return sameName && samePrescription ? sourceLine : canonical;
};

const toDraftExercise = (exercise, index = 0, sourceLine = "") => ({
  ...exercise,
  draftKey: exercise?.draftKey || createDraftExerciseKey(),
  sourceLine: String(sourceLine || exercise?.sourceLine || `${exercise?.name || `Exercício ${index + 1}`} ${compactPrescription(exercise?.prescription)}`).trim(),
  parsed: exercise?.parsed !== false
});

const toPublishedExercise = ({ draftKey, sourceLine, parsed, ...exercise }) => ({ ...exercise });

const getWorkoutBlocksInput = () => workoutForm?.querySelector("[name='blocks']") || null;

const writeWorkoutDraftText = () => {
  const blocksInput = getWorkoutBlocksInput();
  if (!blocksInput) return;
  const text = workoutDraftExercises.map(exerciseToDraftLine).join("\n");
  blocksInput.value = text;
  workoutDraftTextSignature = text;
};

const reconcileWorkoutDraftFromText = ({ force = false } = {}) => {
  const blocksInput = getWorkoutBlocksInput();
  if (!blocksInput) return workoutDraftExercises;
  const rawText = String(blocksInput.value || "");
  if (!force && rawText === workoutDraftTextSignature) return workoutDraftExercises;
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  const previous = workoutDraftExercises;
  const usedKeys = new Set();
  const findReusable = (line, parsed) => {
    const exactLine = previous.find((exercise) => !usedKeys.has(exercise.draftKey)
      && String(exercise.sourceLine || "").trim() === line);
    if (exactLine) return exactLine;
    const exactExercise = previous.find((exercise) => !usedKeys.has(exercise.draftKey)
      && normalizeSearch(exercise.name) === normalizeSearch(parsed.name)
      && compactPrescription(exercise.prescription) === compactPrescription(parsed.prescription));
    if (exactExercise) return exactExercise;
    return previous.find((exercise) => !usedKeys.has(exercise.draftKey)
      && normalizeSearch(exercise.name) === normalizeSearch(parsed.name)) || null;
  };

  workoutDraftExercises = lines.map((line, index) => {
    const parsed = parseExerciseLine(line, index, "draft");
    const reusable = findReusable(line, parsed);
    if (reusable) usedKeys.add(reusable.draftKey);
    const preservedDetails = {};
    DRAFT_EXERCISE_DETAIL_FIELDS.forEach((field) => {
      if (reusable && reusable[field] !== undefined) preservedDetails[field] = reusable[field];
    });
    return toDraftExercise({
      ...parsed,
      ...preservedDetails,
      id: reusable?.id || parsed.id,
      draftKey: reusable?.draftKey,
      parsed: /\d+\s*x\s*.+/i.test(line)
    }, index, line);
  });
  workoutDraftTextSignature = rawText;
  return workoutDraftExercises;
};

const getWorkoutDraftStorageKey = () => `${WORKOUT_DRAFT_STORAGE_PREFIX}:${authContext?.coachId || "local"}`;

const setWorkoutDraftDirty = (dirty, message = "") => {
  workoutDraftDirty = Boolean(dirty);
  if (message) {
    setWorkoutSyncStatus(message, dirty ? "warning" : "synced");
    return;
  }
  setWorkoutSyncStatus(
    dirty ? "● Alterações não publicadas" : "✓ Treino atualizado",
    dirty ? "warning" : "synced"
  );
};

const serializeWorkoutDraft = ({ builderOpen = !workoutBuilder?.hidden } = {}) => {
  if (!workoutForm) return null;
  reconcileWorkoutDraftFromText();
  const fields = Object.fromEntries(new FormData(workoutForm));
  return {
    editingWorkoutId,
    fields,
    exercises: workoutDraftExercises.map((exercise) => ({ ...exercise })),
    dirty: workoutDraftDirty,
    builderOpen,
    savedAt: new Date().toISOString()
  };
};

const saveWorkoutDraftLocally = ({ builderOpen = !workoutBuilder?.hidden, notify = false } = {}) => {
  clearTimeout(workoutDraftSaveTimer);
  const draft = serializeWorkoutDraft({ builderOpen });
  if (!draft) return false;
  const hasContent = draft.exercises.length || String(draft.fields?.title || "").trim();
  if (!hasContent) {
    Platform.storage.remove(getWorkoutDraftStorageKey());
    return false;
  }
  const saved = Platform.storage.set(getWorkoutDraftStorageKey(), draft);
  if (saved) restoredWorkoutDraftSavedAt = draft.savedAt;
  if (notify) showToast(saved ? "Rascunho salvo neste dispositivo." : "Não foi possível salvar o rascunho.");
  return saved;
};

const scheduleWorkoutDraftSave = () => {
  clearTimeout(workoutDraftSaveTimer);
  workoutDraftSaveTimer = window.setTimeout(() => saveWorkoutDraftLocally(), WORKOUT_DRAFT_SAVE_DELAY_MS);
};

const clearStoredWorkoutDraft = () => {
  clearTimeout(workoutDraftSaveTimer);
  Platform.storage.remove(getWorkoutDraftStorageKey());
  restoredWorkoutDraftSavedAt = "";
};

const markWorkoutDraftChanged = () => {
  setWorkoutDraftDirty(true);
  scheduleWorkoutDraftSave();
};

const restoreStoredWorkoutDraft = ({ open = false } = {}) => {
  if (!workoutForm) return false;
  const saved = Platform.storage.get(getWorkoutDraftStorageKey(), null);
  if (!saved?.fields || !Array.isArray(saved.exercises)) return false;
  if (saved.savedAt && saved.savedAt === restoredWorkoutDraftSavedAt && workoutDraftExercises.length) {
    if (open) setWorkoutBuilderOpen(true, { focus: false });
    return true;
  }
  Object.entries(saved.fields).forEach(([name, value]) => {
    const field = workoutForm.elements.namedItem(name);
    if (field && "value" in field) field.value = String(value ?? "");
  });
  workoutDraftExercises = saved.exercises.map((exercise, index) => toDraftExercise(exercise, index));
  restoredWorkoutDraftSavedAt = saved.savedAt || "";
  writeWorkoutDraftText();
  const editingWorkout = workouts.find((workout) => workout.id === saved.editingWorkoutId) || null;
  setWorkoutEditingMode(editingWorkout);
  setWorkoutDraftDirty(true, "● Alterações não publicadas · rascunho recuperado");
  renderWorkoutPreview();
  if (open || saved.builderOpen) {
    navigate("workouts");
    setWorkoutBuilderOpen(true, { focus: false });
    showToast("Rascunho de treino recuperado.");
  }
  return true;
};

const setWorkoutEditingMode = (workout = null) => {
  editingWorkoutId = workout?.id || "";
  if (workoutBuilderMode) workoutBuilderMode.textContent = workout ? "Editar treino publicado" : "Adicionar treino";
  if (workoutBuilderTitle) workoutBuilderTitle.textContent = workout ? `Editando treino de ${workout.owner}` : "Criar novo treino para um aluno";
  if (workoutBuilderCopy) {
    workoutBuilderCopy.textContent = workout
      ? "Salvar alterações republica o treino para o mesmo aluno. Ele recebe na próxima abertura ou atualização do app."
      : "Ao publicar, o aluno recebe esse treino no app na próxima abertura ou atualização.";
  }
  if (workoutSubmit) workoutSubmit.textContent = workout ? "Salvar alterações e republicar" : "Publicar treino para o aluno";
  cancelWorkoutEditButton?.toggleAttribute("hidden", !workout);
};

const workoutToEditableTitle = (workout) => workout.title || "Novo treino";

const workoutToEditableBlocks = (workout) => (workout.exercises || [])
  .map((exercise) => `${exercise.name} ${exercise.prescription}`)
  .join("\n");

const loadWorkoutForEditing = (workout) => {
  if (!workoutForm || !workout) return;
  clearStoredWorkoutDraft();
  const studentSelect = workoutForm.querySelector("[name='student']");
  const titleInput = workoutForm.querySelector("[name='title']");
  const templateInput = workoutForm.querySelector("[name='template']");
  const startsAtInput = workoutForm.querySelector("[name='startsAt']");
  const blocksInput = workoutForm.querySelector("[name='blocks']");

  if (studentSelect && students.some((student) => student.id === workout.studentId)) studentSelect.value = workout.studentId;
  if (titleInput) titleInput.value = workoutToEditableTitle(workout);
  if (templateInput) templateInput.value = workout.focus || templateInput.value;
  refreshCustomSelects(workoutForm);
  if (startsAtInput) startsAtInput.value = formatDateForInput(workout.startsAt || workout.updatedAt);
  workoutDraftExercises = (workout.exercises || []).map((exercise, index) => toDraftExercise(exercise, index));
  if (blocksInput) blocksInput.value = workoutToEditableBlocks(workout);
  workoutDraftTextSignature = blocksInput?.value || "";

  setWorkoutEditingMode(workout);
  setWorkoutDraftDirty(false);
  renderWorkoutPreview();
  focusWorkoutForm();
};

const resetWorkoutFormMode = ({ resetForm = false, clearStored = false } = {}) => {
  if (resetForm) workoutForm?.reset();
  workoutDraftExercises = [];
  workoutDraftTextSignature = getWorkoutBlocksInput()?.value || "";
  workoutDraftDirty = false;
  if (clearStored) clearStoredWorkoutDraft();
  setWorkoutEditingMode(null);
  renderWorkoutPreview();
};

const {
  render: renderStudents,
  renderSessionPanel: renderStudentSessionPanel
} = createStudentsScreen({
  getStudents: () => students,
  viewState,
  getSessionsForStudent,
  getPublishedWorkoutForStudent,
  isInviteExpired,
  effortLabel,
  painLabel,
  setStudentSessionOpen,
  syncStudentSessionPresentation,
  setCount: (value) => setText("[data-student-count]", value),
  renderStudentOptions: () => renderStudentOptions(),
  renderWorkoutPreview: () => renderWorkoutPreview()
});
const getWorkoutDraft = () => {
  if (!workoutForm) return { exercises: [], totalSets: 0, estimatedMinutes: 0 };
  const exercises = reconcileWorkoutDraftFromText();
  const totalSets = exercises.reduce((sum, exercise) => sum + parseSets(exercise.prescription), 0);

  return {
    exercises,
    totalSets,
    estimatedMinutes: exercises.length ? Math.max(28, exercises.length * 7) : 0
  };
};

const renderWorkoutInsertSlot = (index) => `
  <div class="workout-insert-slot" data-workout-insert-slot="${index}">
    <button type="button" data-open-workout-insert="${index}">+ Adicionar exercício aqui</button>
    <form class="workout-insert-form" data-workout-insert-form="${index}" hidden>
      <input name="exercise" autocomplete="off" placeholder="Elevação lateral 3x12" aria-label="Novo exercício na posição ${index + 1}" required />
      <button class="button" type="submit">Adicionar</button>
      <button class="button button--quiet" type="button" data-cancel-workout-insert>Cancelar</button>
    </form>
  </div>
`;

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
    <div class="workout-preview__entry" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">
    <article class="workout-preview__item workout-preview__item--editable">
      <button class="workout-exercise-drag-handle" type="button" data-draft-drag-handle="${escapeHtml(exercise.draftKey)}" aria-label="Mover ${escapeHtml(exercise.name)}. Arraste ou use as setas para reordenar." title="Arrastar para reordenar"><span aria-hidden="true">⠿</span></button>
      <span class="workout-preview__number">${String(index + 1).padStart(2, "0")}</span>
      <div class="workout-preview__exercise-main">
        <div class="workout-preview__exercise-head">
          <div>
            <strong data-preview-exercise-name>${escapeHtml(exercise.name)}</strong>
            <small data-preview-exercise-prescription>${escapeHtml(exercise.prescription)} - ${escapeHtml(exercise.rest)} descanso</small>
          </div>
          <details class="action-menu workout-exercise-menu">
            <summary class="icon-button" aria-label="Ações para ${escapeHtml(exercise.name)}">•••</summary>
            <div class="action-menu__popover action-menu__popover--end">
              <button type="button" data-edit-draft-exercise="${escapeHtml(exercise.draftKey)}">Editar exercício</button>
              <button type="button" data-duplicate-draft-exercise="${escapeHtml(exercise.draftKey)}">Duplicar exercício</button>
              <button class="is-danger" type="button" data-delete-draft-exercise="${escapeHtml(exercise.draftKey)}">Excluir exercício</button>
            </div>
          </details>
        </div>
        <details class="exercise-detail-editor">
          <summary>Detalhes para o aluno</summary>
          <div class="exercise-detail-editor__grid exercise-detail-editor__grid--identity">
            <label>Nome<input name="draft-name-${index}" value="${escapeHtml(exercise.name)}" data-draft-exercise-field="name" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
            <label>Séries e repetições<input name="draft-prescription-${index}" value="${escapeHtml(exercise.prescription)}" data-draft-exercise-field="prescription" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="4 x 10" /></label>
          </div>
          <div class="exercise-detail-editor__grid">
            <label>Descanso<input name="draft-rest-${index}" value="${escapeHtml(exercise.rest)}" data-draft-exercise-field="rest" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="60s" /></label>
            <label>RIR<input name="draft-rir-${index}" value="${escapeHtml(exercise.rir)}" data-draft-exercise-field="rir" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="2" /></label>
            <label>Cadência<input name="draft-tempo-${index}" value="${escapeHtml(exercise.tempo)}" data-draft-exercise-field="tempo" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="2-0-2" /></label>
          </div>
          <label>Instrução curta<textarea name="draft-instructions-${index}" rows="2" maxlength="240" data-draft-exercise-field="instructions" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="Ex: mantenha as escápulas apoiadas">${escapeHtml(exercise.instructions || "")}</textarea></label>
          <label>Tipo da demonstração
            <select name="draft-media-type-${index}" data-draft-exercise-field="mediaType" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">
              <option value="none" ${!exercise.mediaType || exercise.mediaType === "none" ? "selected" : ""}>Sem mídia</option>
              <option value="image" ${exercise.mediaType === "image" ? "selected" : ""}>Imagem</option>
              <option value="gif" ${exercise.mediaType === "gif" ? "selected" : ""}>GIF</option>
              <option value="video" ${exercise.mediaType === "video" ? "selected" : ""}>Vídeo direto</option>
              <option value="youtube" ${exercise.mediaType === "youtube" ? "selected" : ""}>YouTube</option>
              <option value="external" ${exercise.mediaType === "external" ? "selected" : ""}>Link externo</option>
            </select>
          </label>
          <label>URL da demonstração<input type="url" name="draft-media-${index}" value="${escapeHtml(exercise.mediaUrl || "")}" data-draft-exercise-field="mediaUrl" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="https://..." /></label>
          <small class="field-help">Aceita HTTPS, incluindo YouTube, imagem, GIF ou vídeo direto.</small>
        </details>
      </div>
    </article>
    ${renderWorkoutInsertSlot(index + 1)}
    </div>
  `).join("");
};

const findDraftExerciseIndex = (draftKey) => workoutDraftExercises
  .findIndex((exercise) => exercise.draftKey === draftKey);

const findDraftExerciseHandle = (draftKey) => [...(previewList?.querySelectorAll("[data-draft-drag-handle]") || [])]
  .find((handle) => handle.dataset.draftDragHandle === draftKey) || null;

const commitWorkoutDraftMutation = ({ focusKey = "", announce = "" } = {}) => {
  writeWorkoutDraftText();
  markWorkoutDraftChanged();
  renderWorkoutPreview();
  if (announce) showToast(announce);
  if (focusKey) {
    window.setTimeout(() => findDraftExerciseHandle(focusKey)?.focus(), 0);
  }
};

const moveDraftExercise = (draftKey, nextIndex) => {
  const currentIndex = findDraftExerciseIndex(draftKey);
  if (currentIndex < 0 || workoutDraftExercises.length < 2) return false;
  const boundedIndex = Math.max(0, Math.min(nextIndex, workoutDraftExercises.length - 1));
  if (boundedIndex === currentIndex) return false;
  const [exercise] = workoutDraftExercises.splice(currentIndex, 1);
  workoutDraftExercises.splice(boundedIndex, 0, exercise);
  commitWorkoutDraftMutation({ focusKey: draftKey });
  return true;
};

const duplicateDraftExercise = (draftKey) => {
  const index = findDraftExerciseIndex(draftKey);
  if (index < 0 || workoutDraftExercises.length >= 12) {
    showToast(index < 0 ? "Exercício não encontrado." : "O treino aceita até 12 exercícios.");
    return;
  }
  const source = workoutDraftExercises[index];
  const copy = toDraftExercise({
    ...source,
    id: `draft-copy-${Date.now()}`,
    draftKey: createDraftExerciseKey(),
    sourceLine: exerciseToDraftLine(source)
  }, index + 1);
  workoutDraftExercises.splice(index + 1, 0, copy);
  commitWorkoutDraftMutation({ focusKey: copy.draftKey, announce: "Exercício duplicado." });
};

const deleteDraftExercise = (draftKey) => {
  const index = findDraftExerciseIndex(draftKey);
  if (index < 0) return;
  const [exercise] = workoutDraftExercises.splice(index, 1);
  removedWorkoutExercise = { exercise, index };
  writeWorkoutDraftText();
  markWorkoutDraftChanged();
  renderWorkoutPreview();
  showToast("Exercício removido.", {
    actionLabel: "Desfazer",
    duration: 5200,
    onAction: () => {
      if (!removedWorkoutExercise) return;
      const restored = removedWorkoutExercise;
      removedWorkoutExercise = null;
      workoutDraftExercises.splice(Math.min(restored.index, workoutDraftExercises.length), 0, restored.exercise);
      commitWorkoutDraftMutation({ focusKey: restored.exercise.draftKey, announce: "Exercício restaurado." });
    }
  });
};

const insertDraftExercise = (line, index) => {
  const normalizedLine = String(line || "").trim();
  if (!normalizedLine) {
    showToast("Digite o exercício antes de adicionar.");
    return false;
  }
  if (workoutDraftExercises.length >= 12) {
    showToast("O treino aceita até 12 exercícios.");
    return false;
  }
  const parsed = parseExerciseLine(normalizedLine, index, "draft");
  const exercise = toDraftExercise({
    ...parsed,
    draftKey: createDraftExerciseKey(),
    parsed: /\d+\s*x\s*.+/i.test(normalizedLine)
  }, index, normalizedLine);
  workoutDraftExercises.splice(Math.max(0, Math.min(index, workoutDraftExercises.length)), 0, exercise);
  commitWorkoutDraftMutation({ focusKey: exercise.draftKey, announce: "Exercício adicionado." });
  return true;
};

const updateDraftExerciseField = (input) => {
  const draftKey = input.dataset.draftExerciseKey;
  const field = input.dataset.draftExerciseField;
  const exercise = workoutDraftExercises.find((item) => item.draftKey === draftKey);
  if (!exercise || !field) return;
  exercise[field] = input.value;
  if (field === "name" || field === "prescription") {
    exercise.sourceLine = "";
    writeWorkoutDraftText();
    const card = input.closest(".workout-preview__item");
    const nameTarget = card?.querySelector("[data-preview-exercise-name]");
    if (field === "name" && nameTarget) nameTarget.textContent = exercise.name;
    const prescription = card?.querySelector("[data-preview-exercise-prescription]");
    if (prescription) prescription.textContent = `${exercise.prescription} - ${exercise.rest} descanso`;
  } else if (field === "rest") {
    const prescription = input.closest(".workout-preview__item")?.querySelector("[data-preview-exercise-prescription]");
    if (prescription) prescription.textContent = `${exercise.prescription} - ${exercise.rest} descanso`;
  }
  markWorkoutDraftChanged();
};

const clearWorkoutDragVisuals = () => {
  workoutReorderAnimations.forEach((animation) => animation.cancel());
  workoutReorderAnimations.clear();
  document.querySelectorAll(".workout-preview__entry.is-dragging, .workout-preview__entry.is-settling")
    .forEach((element) => {
      element.classList.remove("is-dragging", "is-settling");
      element.removeAttribute("style");
    });
  document.body.classList.remove("is-reordering-workout");
};

const getWorkoutPreviewEntries = () => [...(previewList?.querySelectorAll(
  ".workout-preview__entry[data-draft-exercise-key]"
) || [])];

const animateWorkoutEntryReflow = (beforeRects) => {
  getWorkoutPreviewEntries().forEach((entry) => {
    const before = beforeRects.get(entry);
    if (!before || typeof entry.animate !== "function") return;
    const after = entry.getBoundingClientRect();
    const deltaX = before.left - after.left;
    const deltaY = before.top - after.top;
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;
    const animation = entry.animate([
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
      { transform: "translate3d(0, 0, 0)" }
    ], {
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    });
    workoutReorderAnimations.add(animation);
    animation.finished.catch(() => {}).finally(() => workoutReorderAnimations.delete(animation));
  });
};

const moveWorkoutDragPlaceholder = (clientY) => {
  if (!activeWorkoutDrag?.placeholder || activeWorkoutDrag.settling) return;
  const idleEntries = getWorkoutPreviewEntries();
  const beforeRects = new Map(idleEntries.map((entry) => [entry, entry.getBoundingClientRect()]));
  const reference = idleEntries.find((entry) => {
    const rect = entry.getBoundingClientRect();
    return clientY < rect.top + (rect.height / 2);
  }) || null;
  const placeholder = activeWorkoutDrag.placeholder;
  if (reference === placeholder.nextElementSibling || (!reference && placeholder === previewList.lastElementChild)) return;
  previewList.insertBefore(placeholder, reference);
  animateWorkoutEntryReflow(beforeRects);
};

const beginWorkoutDrag = () => {
  if (!activeWorkoutDrag || activeWorkoutDrag.moved) return;
  const { entry } = activeWorkoutDrag;
  const rect = entry.getBoundingClientRect();
  const placeholder = document.createElement("div");
  placeholder.className = "workout-preview__placeholder";
  placeholder.style.height = `${rect.height}px`;
  placeholder.setAttribute("aria-hidden", "true");
  entry.before(placeholder);
  document.body.appendChild(entry);
  Object.assign(entry.style, {
    position: "fixed",
    zIndex: "1000",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "translate3d(0, 0, 0)"
  });
  entry.classList.add("is-dragging");
  document.body.classList.add("is-reordering-workout");
  Object.assign(activeWorkoutDrag, { moved: true, placeholder, originRect: rect });
};

const finalizeWorkoutDrag = ({ cancel = false } = {}) => {
  if (!activeWorkoutDrag?.moved || activeWorkoutDrag.settling) {
    activeWorkoutDrag = null;
    return;
  }
  const drag = activeWorkoutDrag;
  drag.settling = true;
  drag.handle.releasePointerCapture?.(drag.pointerId);

  if (cancel) {
    const entries = getWorkoutPreviewEntries();
    const beforeRects = new Map(entries.map((entry) => [entry, entry.getBoundingClientRect()]));
    previewList.insertBefore(drag.placeholder, entries[drag.originIndex] || null);
    animateWorkoutEntryReflow(beforeRects);
  }

  const targetIndex = [...previewList.children]
    .filter((element) => element === drag.placeholder || element.matches?.(".workout-preview__entry[data-draft-exercise-key]"))
    .indexOf(drag.placeholder);
  const targetRect = drag.placeholder.getBoundingClientRect();
  const currentRect = drag.entry.getBoundingClientRect();
  Object.assign(drag.entry.style, {
    transition: "none",
    transform: "none",
    top: `${currentRect.top}px`,
    left: `${currentRect.left}px`
  });
  drag.entry.getBoundingClientRect();
  drag.entry.classList.add("is-settling");
  drag.entry.style.transition = "";
  Object.assign(drag.entry.style, {
    top: `${targetRect.top}px`,
    left: `${targetRect.left}px`,
    width: `${targetRect.width}px`
  });

  window.setTimeout(() => {
    if (!cancel && targetIndex >= 0 && targetIndex !== drag.originIndex) {
      const [exercise] = workoutDraftExercises.splice(drag.originIndex, 1);
      workoutDraftExercises.splice(targetIndex, 0, exercise);
      writeWorkoutDraftText();
      markWorkoutDraftChanged();
    }
    drag.entry.remove();
    drag.placeholder.remove();
    activeWorkoutDrag = null;
    clearWorkoutDragVisuals();
    renderWorkoutPreview();
    window.setTimeout(() => findDraftExerciseHandle(drag.key)?.focus(), 0);
  }, 190);
};

previewList?.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-draft-drag-handle]");
  if (!handle || !event.isPrimary || event.button !== 0) return;
  const entry = handle.closest(".workout-preview__entry");
  if (!entry) return;
  activeWorkoutDrag = {
    pointerId: event.pointerId,
    key: handle.dataset.draftDragHandle,
    handle,
    entry,
    originIndex: findDraftExerciseIndex(handle.dataset.draftDragHandle),
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    settling: false
  };
  handle.setPointerCapture?.(event.pointerId);
});

document.addEventListener("pointermove", (event) => {
  if (!activeWorkoutDrag || activeWorkoutDrag.pointerId !== event.pointerId) return;
  if (activeWorkoutDrag.settling) return;
  if (!activeWorkoutDrag.moved && Math.abs(event.clientY - activeWorkoutDrag.startY) < 6) return;
  event.preventDefault();
  beginWorkoutDrag();
  if (!activeWorkoutDrag?.moved) return;
  const offsetX = event.clientX - activeWorkoutDrag.startX;
  const offsetY = event.clientY - activeWorkoutDrag.startY;
  activeWorkoutDrag.entry.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  const listRect = previewList.getBoundingClientRect();
  const autoScrollEdge = 52;
  if (event.clientY < listRect.top + autoScrollEdge) previewList.scrollBy({ top: -14, behavior: "auto" });
  else if (event.clientY > listRect.bottom - autoScrollEdge) previewList.scrollBy({ top: 14, behavior: "auto" });
  moveWorkoutDragPlaceholder(event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (activeWorkoutDrag?.pointerId === event.pointerId) finalizeWorkoutDrag();
});

document.addEventListener("pointercancel", (event) => {
  if (activeWorkoutDrag?.pointerId === event.pointerId) finalizeWorkoutDrag({ cancel: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !activeWorkoutDrag?.moved) return;
  event.preventDefault();
  finalizeWorkoutDrag({ cancel: true });
});

previewList?.addEventListener("keydown", (event) => {
  const handle = event.target.closest("[data-draft-drag-handle]");
  if (!handle || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = findDraftExerciseIndex(handle.dataset.draftDragHandle);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? workoutDraftExercises.length - 1
      : index + (event.key === "ArrowUp" ? -1 : 1);
  moveDraftExercise(handle.dataset.draftDragHandle, nextIndex);
});

previewList?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-draft-exercise]");
  if (editButton) {
    const entry = editButton.closest(".workout-preview__entry");
    editButton.closest(".action-menu")?.removeAttribute("open");
    const details = entry?.querySelector(".exercise-detail-editor");
    if (details) details.open = true;
    window.setTimeout(() => details?.querySelector("[data-draft-exercise-field='name']")?.focus(), 0);
    return;
  }
  const duplicateButton = event.target.closest("[data-duplicate-draft-exercise]");
  if (duplicateButton) {
    duplicateDraftExercise(duplicateButton.dataset.duplicateDraftExercise);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-draft-exercise]");
  if (deleteButton) {
    deleteDraftExercise(deleteButton.dataset.deleteDraftExercise);
    return;
  }
  const openInsert = event.target.closest("[data-open-workout-insert]");
  if (openInsert) {
    const slot = openInsert.closest(".workout-insert-slot");
    openInsert.hidden = true;
    const form = slot?.querySelector("[data-workout-insert-form]");
    if (form) form.hidden = false;
    window.setTimeout(() => form?.querySelector("input")?.focus(), 0);
    return;
  }
  const cancelInsert = event.target.closest("[data-cancel-workout-insert]");
  if (cancelInsert) {
    const slot = cancelInsert.closest(".workout-insert-slot");
    const form = cancelInsert.closest("form");
    if (form) form.hidden = true;
    const button = slot?.querySelector("[data-open-workout-insert]");
    if (button) button.hidden = false;
  }
});

previewList?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-workout-insert-form]");
  if (!form) return;
  event.preventDefault();
  const index = Number(form.dataset.workoutInsertForm);
  insertDraftExercise(new FormData(form).get("exercise"), index);
});

const isValidHttpsUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const { render: renderWorkouts } = createWorkoutsScreen({
  getWorkouts: () => workouts,
  getSearchQuery: () => viewState.workoutSearchQuery,
  getFilter: () => viewState.workoutFilter,
  getWorkoutStage,
  getWorkoutBlocks,
  getWorkoutSyncLabel,
  parseSets,
  setCount: (value) => setText("[data-workout-count]", value)
});

const renderDuplicateWorkoutStudents = (selectedStudentId = "") => {
  if (!duplicateWorkoutStudents) return;
  duplicateWorkoutStudents.innerHTML = students.map((student) => `
    <option value="${escapeHtml(student.id)}" data-icon="${escapeHtml(initialsFromName(student.name))}" data-avatar="true"${student.email ? ` data-description="${escapeHtml(student.email)}"` : ""} ${student.id === selectedStudentId ? "selected" : ""}>${escapeHtml(student.name)}</option>
  `).join("");
};

const openDuplicateWorkoutDialog = (workout) => {
  if (!duplicateWorkoutDialog || !duplicateWorkoutForm || !workout) return;
  duplicateWorkoutSourceId = workout.id;
  renderDuplicateWorkoutStudents(workout.studentId);
  duplicateWorkoutForm.elements.namedItem("title").value = `${workout.title} - cópia`;
  duplicateWorkoutForm.elements.namedItem("startsAt").value = workoutDateInputValue(new Date());
  setStatus(duplicateWorkoutStatus, "Escolha o destino e confirme a nova cópia.", "");
  if (!duplicateWorkoutDialog.open) duplicateWorkoutDialog.showModal();
  window.setTimeout(() => duplicateWorkoutForm.elements.namedItem("title")?.focus(), 80);
};

const closeDuplicateWorkoutDialog = () => {
  duplicateWorkoutSourceId = "";
  if (duplicateWorkoutDialog?.open) duplicateWorkoutDialog.close();
};

const applyTheme = (overrides = {}) => {
  const {
    brand,
    tagline,
    accent,
    mode,
    backgroundColor,
    surfaceColor,
    textColor,
    fontPreset,
    radiusPreset,
    backgroundStyle
  } = overrides;
  const nextBackgroundColor = backgroundColor ?? backgroundInput?.value ?? DEFAULT_BRAND_THEME.backgroundColor;
  const nextTheme = applyThemeTokens({
    brandName: brand ?? brandInput?.value ?? DEFAULT_BRAND_THEME.brandName,
    tagline: tagline ?? taglineInput?.value ?? DEFAULT_BRAND_THEME.tagline,
    accent: accent ?? accentInput?.value ?? DEFAULT_BRAND_THEME.accent,
    backgroundColor: nextBackgroundColor,
    surfaceColor: surfaceColor ?? surfaceInput?.value ?? DEFAULT_BRAND_THEME.surfaceColor,
    textColor: textColor ?? textInput?.value ?? DEFAULT_BRAND_THEME.textColor,
    fontPreset: fontPreset ?? fontInput?.value ?? DEFAULT_BRAND_THEME.fontPreset,
    radiusPreset: radiusPreset ?? radiusInput?.value ?? DEFAULT_BRAND_THEME.radiusPreset,
    backgroundStyle: backgroundStyle ?? backgroundStyleInput?.value ?? DEFAULT_BRAND_THEME.backgroundStyle,
    mode: mode ?? inferModeFromColor(nextBackgroundColor)
  });
  document.title = `${nextTheme.brandName} - Professor`;
  document.querySelectorAll("[data-brand-name]").forEach((item) => { item.textContent = nextTheme.brandName; });
  setText("[data-preview-brand]", nextTheme.brandName);
  setText("[data-preview-tagline]", nextTheme.tagline);
  renderLocalBrandAssets();
  renderInviteTools();
};

const renderAll = () => {
  renderIcons();
  renderCoachProfile();
  renderStudents();
  renderWorkouts();
  renderDashboard();
  applyTheme();
  renderThemePalettes({ syncToTheme: true });
};

navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(item.dataset.nav);
}));

jumpButtons.forEach((button) => button.addEventListener("click", () => {
  navigate(button.dataset.navJump);
  if (button.hasAttribute("data-open-student-form")) setStudentFormOpen(true);
  if (button.hasAttribute("data-focus-workout-form")) {
    if (!restoreStoredWorkoutDraft({ open: true })) {
      resetWorkoutFormMode({ resetForm: true });
      focusWorkoutForm();
    }
  }
}));

document.querySelector("[data-close-student-form]")?.addEventListener("click", () => setStudentFormOpen(false, { focus: false }));
document.querySelector("[data-open-invite-dialog]")?.addEventListener("click", () => {
  document.querySelector(".page-actions-menu")?.removeAttribute("open");
  renderInviteTools();
  if (!inviteDialog?.open) inviteDialog?.showModal();
});
document.querySelector("[data-close-invite-dialog]")?.addEventListener("click", () => inviteDialog?.close());
document.querySelector("[data-open-import-dialog]")?.addEventListener("click", () => {
  document.querySelector(".page-actions-menu")?.removeAttribute("open");
  if (!importDialog?.open) importDialog?.showModal();
});
document.querySelector("[data-close-import-dialog]")?.addEventListener("click", () => importDialog?.close());
document.querySelector("[data-close-workout-form]")?.addEventListener("click", () => {
  if (workoutDraftDirty) saveWorkoutDraftLocally({ builderOpen: false });
  setWorkoutBuilderOpen(false, { focus: false });
});

studentSearchInput?.addEventListener("input", () => {
  viewState.studentSearchQuery = studentSearchInput.value;
  renderStudents();
});

studentFilterInput?.addEventListener("change", () => {
  viewState.studentFilter = studentFilterInput.value;
  renderStudents();
});

workoutSearchInput?.addEventListener("input", () => {
  viewState.workoutSearchQuery = workoutSearchInput.value;
  renderWorkouts();
});

workoutFilterInput?.addEventListener("change", () => {
  viewState.workoutFilter = workoutFilterInput.value;
  renderWorkouts();
});

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
  const draft = Object.fromEntries(new FormData(event.currentTarget));
  const existingStudent = findExistingStudentForDraft(draft);
  const student = mergeStudentDraftWithExisting(draft);
  const savedStudent = studentRepository.saveStudent({ ...student, coachId: authContext.coachId });
  applyStudents([savedStudent, ...students.filter((item) => item.id !== savedStudent.id)]);
  setStudentSyncStatus(existingStudent ? "Atualizando aluno..." : "Salvando aluno...", "");
  showToast(existingStudent ? "Aluno atualizado." : "Aluno criado.");
  if (getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit) {
    setStudentSyncStatus(`Aluno salvo, mas o limite do ${ACCOUNT_PLAN.name.toLowerCase()} foi excedido.`, "warning");
  }

  const result = await studentRepository.syncStudent(savedStudent);
  if (result.student) {
    applyStudents([result.student, ...students.filter((item) => item.id !== result.student.id)]);
  }
  const limitExceeded = getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit;
  setStudentSyncStatus(
    result.synced
      ? limitExceeded
        ? `Aluno salvo, mas o limite do ${ACCOUNT_PLAN.name.toLowerCase()} foi excedido.`
        : existingStudent
          ? "Aluno atualizado neste personal. Outros personais com o mesmo aluno não foram alterados."
          : draft.email
            ? "Aluno cadastrado. O acesso já pode ser ativado com este email."
            : "Aluno cadastrado sem email. Envie o convite para liberar o acesso."
      : "Aluno salvo como rascunho neste aparelho.",
    result.synced && !limitExceeded ? "synced" : "warning"
  );
  if (result.synced) showToast(existingStudent ? "Aluno atualizado." : "Aluno cadastrado.");
  event.currentTarget.reset();
  setStudentFormOpen(false, { focus: false });
});

inviteStudentOptions?.addEventListener("change", renderInviteTools);

copyInviteButton?.addEventListener("click", async () => {
  let selected = students.find((student) => student.id === inviteStudentOptions?.value);
  if (selected && isInviteExpired(selected)) {
    setInviteStatus("Gerando um novo convite pessoal...", "");
    const renewal = await studentRepository.renewInvite(selected);
    if (!renewal.renewed) {
      setInviteStatus("Não foi possível renovar o convite. Tente novamente.", "warning");
      return;
    }
    selected = renewal.student;
    applyStudents([selected, ...students.filter((student) => student.id !== selected.id)]);
    renderInviteTools();
  }

  const message = selected ? buildInviteMessage(selected) : inviteMessage?.value || "";
  if (!message) {
    setInviteStatus("Cadastre e selecione um aluno antes de copiar.", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(message);
    setInviteStatus("Convite copiado para a área de transferência.", "synced");
    showToast("Convite copiado.");
  } catch {
    inviteMessage?.focus();
    inviteMessage?.select();
    setInviteStatus("Não consegui copiar automaticamente. Selecione o texto e copie manualmente.", "warning");
  }
});

studentImportInput?.addEventListener("change", () => {
  const file = studentImportInput.files?.[0];
  setText("[data-student-import-file]", file?.name || "Nenhum arquivo selecionado");
});

studentImportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authContext?.user) {
    showToast("Entre como professor antes de importar alunos.");
    setAuthLocked(true);
    return;
  }

  const file = studentImportInput?.files?.[0];
  if (!file) {
    setStudentImportStatus("Escolha um arquivo CSV antes de importar.", "warning");
    return;
  }
  if (file.size > 400 * 1024) {
    setStudentImportStatus("Arquivo grande demais. Use até 400KB.", "warning");
    return;
  }

  setStudentImportStatus("Lendo planilha...", "");
  const parsedStudents = parseStudentCsv(await file.text());
  if (!parsedStudents.length) {
    setStudentImportStatus("Nenhum aluno válido encontrado. Nome é obrigatório; email é opcional.", "warning");
    return;
  }

  const uniqueDrafts = [];
  const seenDrafts = new Set();
  parsedStudents.forEach((draft) => {
    const key = (draft.email || draft.name).trim().toLowerCase();
    if (!key || seenDrafts.has(key)) return;
    seenDrafts.add(key);
    uniqueDrafts.push(draft);
  });

  const updatedExistingCount = uniqueDrafts.filter((draft) => findExistingStudentForDraft(draft)).length;
  const savedStudents = uniqueDrafts.map((draft) => {
    const merged = mergeStudentDraftWithExisting(draft);
    return studentRepository.saveStudent({ ...merged, coachId: authContext.coachId });
  });
  applyStudents([
    ...savedStudents,
    ...students.filter((student) => !savedStudents.some((saved) => saved.id === student.id))
  ]);
  setStudentImportStatus(`Salvando ${savedStudents.length} aluno(s)...`, "");
  showToast("Importação concluída.");

  const syncResults = await Promise.allSettled(savedStudents.map((student) => studentRepository.syncStudent(student)));
  const syncedCount = syncResults.filter((result) => result.status === "fulfilled" && result.value?.synced).length;
  const limitExceeded = getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit;
  setStudentImportStatus(
    syncedCount === savedStudents.length
      ? limitExceeded
        ? `${syncedCount} aluno(s) importado(s). Limite do ${ACCOUNT_PLAN.name.toLowerCase()} excedido.`
        : `${syncedCount} aluno(s) importado(s). ${updatedExistingCount} já existiam neste personal.`
      : `${syncedCount} de ${savedStudents.length} aluno(s) importado(s).`,
    syncedCount === savedStudents.length && !limitExceeded ? "synced" : "warning"
  );

  studentImportForm.reset();
  setText("[data-student-import-file]", "Nenhum arquivo selecionado");
});

const saveAndPublishWorkout = async (workout, { pendingMessage = "Publicando treino..." } = {}) => {
  const savedWorkout = workoutRepository.savePublishedWorkout(workout);
  const linkedStudent = students.find((student) => student.id === savedWorkout.studentId);
  if (linkedStudent) {
    studentRepository.saveStudent({
      ...linkedStudent,
      workout: savedWorkout.title,
      nextAction: "Ver treino publicado",
      updatedAt: savedWorkout.updatedAt
    });
  }
  applyPublishedWorkouts([savedWorkout, ...workouts.filter((item) => item.id !== savedWorkout.id)]);
  setWorkoutSyncStatus(pendingMessage, "");
  const result = await workoutRepository.syncPublishedWorkout(savedWorkout, linkedStudent);
  setWorkoutSyncStatus(
    describeWorkoutSyncResult(result),
    result.synced && !result.partial ? "synced" : "warning"
  );
  if (result.workout) {
    applyPublishedWorkouts([result.workout, ...workouts.filter((item) => item.id !== result.workout.id)]);
  }
  return { ...result, savedWorkout: result.workout || savedWorkout };
};

duplicateWorkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sourceWorkout = workouts.find((workout) => workout.id === duplicateWorkoutSourceId);
  const data = new FormData(event.currentTarget);
  const destinationStudent = students.find((student) => student.id === data.get("student"));
  if (!authContext?.user || !sourceWorkout || !destinationStudent) {
    setStatus(duplicateWorkoutStatus, "Não foi possível identificar o treino ou aluno de destino.", "warning");
    return;
  }
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setStatus(duplicateWorkoutStatus, "Criando uma cópia independente...", "");
  try {
    const copy = createWorkoutFromProfessorForm({
      student: destinationStudent,
      coachId: authContext.coachId,
      title: data.get("title"),
      template: sourceWorkout.focus,
      blocks: workoutToEditableBlocks(sourceWorkout),
      exercises: (sourceWorkout.exercises || []).map((exercise) => ({ ...exercise })),
      startsAt: data.get("startsAt"),
      version: 1
    });
    const result = await saveAndPublishWorkout(copy, { pendingMessage: "Criando e publicando a cópia..." });
    closeDuplicateWorkoutDialog();
    loadWorkoutForEditing(result.savedWorkout);
    setWorkoutSyncStatus(
      result.synced ? "✓ Cópia criada e publicada" : "● Cópia criada localmente · publicação pendente",
      result.synced ? "synced" : "warning"
    );
    showToast(result.synced ? "Cópia criada sem alterar o treino original." : "Cópia criada; publicação ainda pendente.");
  } catch (error) {
    console.error("[FlowFit][professor] Falha ao duplicar treino.", error);
    setStatus(duplicateWorkoutStatus, error?.message || "Não foi possível criar a cópia.", "warning");
    showToast("A cópia não foi criada.");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("[data-close-duplicate-workout]")?.addEventListener("click", closeDuplicateWorkoutDialog);
duplicateWorkoutDialog?.addEventListener("close", () => { duplicateWorkoutSourceId = ""; });
duplicateWorkoutDialog?.addEventListener("click", (event) => {
  if (event.target === duplicateWorkoutDialog) closeDuplicateWorkoutDialog();
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

  const workoutDraft = getWorkoutDraft();
  const invalidMedia = workoutDraft.exercises.find((exercise) => (
    !isValidHttpsUrl(exercise.mediaUrl)
  ));
  if (invalidMedia) {
    showToast(`Use uma URL HTTPS na demonstração de ${invalidMedia.name}.`);
    return;
  }

  const selectedStudent = students.find((student) => student.id === data.get("student"));
  const editingWorkout = workouts.find((item) => item.id === editingWorkoutId);
  const workout = createWorkoutFromProfessorForm({
    student: selectedStudent,
    coachId: authContext.coachId,
    title: data.get("title"),
    template: data.get("template"),
    blocks: data.get("blocks"),
    exercises: workoutDraft.exercises.map(toPublishedExercise),
    workoutId: editingWorkout?.id,
    startsAt: data.get("startsAt"),
    version: editingWorkout ? Number(editingWorkout.version || 1) + 1 : 1
  });
  const result = await saveAndPublishWorkout(workout, {
    pendingMessage: editingWorkout ? "Salvando atualização do treino..." : "Publicando treino..."
  });
  if (result.synced) {
    showToast(editingWorkout ? "Treino republicado e confirmado." : "Treino publicado e confirmado.");
    setWorkoutDraftDirty(false);
    clearStoredWorkoutDraft();
    resetWorkoutFormMode({ resetForm: true });
    setWorkoutBuilderOpen(false, { focus: false });
  } else {
    showToast("Publicação não concluída. Revise o aviso e tente novamente.");
  }
});

workoutForm?.addEventListener("input", (event) => {
  const detailInput = event.target.closest("[data-draft-exercise-field]");
  if (detailInput) {
    updateDraftExerciseField(detailInput);
    return;
  }
  if (event.target.matches("[name='blocks']")) {
    reconcileWorkoutDraftFromText({ force: true });
    renderWorkoutPreview();
  }
  markWorkoutDraftChanged();
});
workoutForm?.addEventListener("change", (event) => {
  const detailInput = event.target.closest("[data-draft-exercise-field]");
  if (detailInput) updateDraftExerciseField(detailInput);
  else markWorkoutDraftChanged();
});

previewList?.addEventListener("input", (event) => {
  const detailInput = event.target.closest("[data-draft-exercise-field]");
  if (!detailInput) return;
  updateDraftExerciseField(detailInput);
});

previewList?.addEventListener("change", (event) => {
  const detailInput = event.target.closest("[data-draft-exercise-field]");
  if (detailInput) updateDraftExerciseField(detailInput);
});

saveWorkoutDraftButton?.addEventListener("click", () => {
  const saved = saveWorkoutDraftLocally({ notify: true });
  setWorkoutSyncStatus(
    saved ? "● Alterações não publicadas · rascunho salvo localmente" : "Não foi possível salvar o rascunho.",
    "warning"
  );
});

const handleThemeControlChange = () => {
  applyTheme();
  if (updateContrastStatus()) {
    queueThemeSave();
    return;
  }

  clearTimeout(themeSaveTimer);
  setThemeStatus("Ajuste o contraste antes de salvar o tema.", "warning");
};

const themeInputs = [
  brandInput,
  taglineInput,
  fontInput,
  radiusInput,
  backgroundStyleInput
].filter(Boolean);

themeInputs.forEach((input) => input.addEventListener("input", handleThemeControlChange));
themeInputs.forEach((input) => input.addEventListener("change", handleThemeControlChange));

themePaletteModeButtons.forEach((button) => button.addEventListener("click", () => {
  themePaletteMode = button.dataset.themePaletteMode === "light" ? "light" : "dark";
  renderThemePalettes();
}));

colorHexPairs.forEach(([color, hex]) => {
  const syncFromColor = () => {
    hex.value = String(color.value || "").toLowerCase();
    hex.classList.remove("is-invalid");
    handleThemeControlChange();
    renderThemePalettes({ syncToTheme: color === backgroundInput });
  };

  color.addEventListener("input", syncFromColor);
  color.addEventListener("change", syncFromColor);
  hex.addEventListener("input", () => {
    const normalized = normalizeHexInput(hex.value);
    hex.classList.toggle("is-invalid", !normalized && hex.value.trim().length > 0);
    if (!normalized) {
      updateContrastStatus();
      clearTimeout(themeSaveTimer);
      setThemeStatus("Digite uma cor hex válida, ex: #7667ff.", "warning");
      return;
    }

    color.value = normalized;
    hex.value = normalized;
    handleThemeControlChange();
    renderThemePalettes({ syncToTheme: color === backgroundInput });
  });
  hex.addEventListener("blur", () => {
    const normalized = normalizeHexInput(hex.value);
    hex.value = normalized || String(color.value || "").toLowerCase();
    hex.classList.remove("is-invalid");
    updateContrastStatus();
  });
});

logoInput?.addEventListener("change", () => handleLocalAssetInput(logoInput, "logo"));
logoFrameInput?.addEventListener("change", () => {
  const enabled = logoFrameInput.checked;
  const saved = writeLocalBrandAssets({ logoFrameEnabled: enabled });
  logoFrameInput.setAttribute("aria-checked", String(enabled));
  renderLocalBrandAssets();
  if (!saved) {
    setThemeStatus("Não foi possível salvar a exibição da logo neste navegador.", "warning");
    return;
  }
  setThemeStatus(enabled ? "Fundo e borda da logo ativados neste navegador." : "Logo sem fundo e borda neste navegador.", "warning");
});
photoInput?.addEventListener("change", () => handleLocalAssetInput(photoInput, "photo"));
assetCropForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveCroppedLocalAsset();
});
document.querySelectorAll("[data-asset-crop-cancel]").forEach((button) => {
  button.addEventListener("click", closeAssetCropDialog);
});
assetCropZoom?.addEventListener("input", () => setAssetCropZoom(assetCropZoom.value));
document.querySelector("[data-asset-crop-zoom-out]")?.addEventListener("click", () => {
  setAssetCropZoom((Number(assetCropZoom?.value) || 1) - 0.15);
});
document.querySelector("[data-asset-crop-zoom-in]")?.addEventListener("click", () => {
  setAssetCropZoom((Number(assetCropZoom?.value) || 1) + 0.15);
});
assetCropDialog?.addEventListener("cancel", (event) => {
  if (isProcessingLocalAsset()) event.preventDefault();
});
assetCropDialog?.addEventListener("close", disposeAssetCropper);
document.querySelector("[data-clear-brand-assets]")?.addEventListener("click", () => {
  Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, {});
  if (logoInput) logoInput.value = "";
  if (photoInput) photoInput.value = "";
  renderLocalBrandAssets();
  setThemeStatus("Logo e foto locais removidos deste navegador.", "warning");
  showToast("Logo e foto removidos.");
});
document.querySelector("[data-reset-theme]")?.addEventListener("click", async () => {
  Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, {});
  if (logoInput) logoInput.value = "";
  if (photoInput) photoInput.value = "";
  fillThemeInputs(DEFAULT_BRAND_THEME);
  applyTheme(DEFAULT_BRAND_THEME);
  renderLocalBrandAssets();
  const result = await saveThemeNow({ silent: true });
  setThemeStatus(
    result.synced && !result.partial
      ? "Padrão FlowFit restaurado e publicado."
      : "Padrão FlowFit restaurado neste aparelho.",
    result.synced && !result.partial ? "synced" : "warning"
  );
  showToast("Tema padrão restaurado.");
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
    headline: data.headline,
    bio: data.bio,
    city: data.city,
    contactEmail: data.contactEmail,
    phone: data.phone,
    whatsapp: data.whatsapp,
    cref: data.cref
  });

  if (!result.synced || !result.profile) {
    setCoachProfileStatus(result.error?.message || "Não foi possível salvar o perfil.", "warning");
    showToast("Perfil não salvo.");
    return;
  }

  const previousProfile = authContext.profile || {};
  authContext = {
    ...authContext,
    profile: result.partial
      ? {
        ...previousProfile,
        name: result.profile?.name || previousProfile.name,
        headline: result.profile?.headline || previousProfile.headline || ""
      }
      : {
        ...previousProfile,
        ...result.profile
      }
  };
  renderCoachProfile();
  renderInviteTools();
  setCoachProfileStatus(
    result.partial ? "Perfil salvo parcialmente. Recarregue e tente novamente." : "Perfil profissional atualizado.",
    result.partial ? "warning" : "synced"
  );
  showToast("Perfil atualizado.");
});

document.addEventListener("click", async (event) => {
  const addStudentButton = event.target.closest("[data-toggle-student-form]");
  if (addStudentButton) {
    setStudentFormOpen(true);
    return;
  }

  const studentInvite = event.target.closest("[data-student-invite]");
  if (studentInvite) {
    if (inviteStudentOptions) inviteStudentOptions.value = studentInvite.dataset.studentInvite;
    renderInviteTools();
    studentInvite.closest("details")?.removeAttribute("open");
    if (!inviteDialog?.open) inviteDialog?.showModal();
    return;
  }

  const openWorkoutButton = event.target.closest("[data-open-workout-form]");
  if (openWorkoutButton) {
    if (!restoreStoredWorkoutDraft({ open: true })) {
      resetWorkoutFormMode({ resetForm: true });
      focusWorkoutForm();
    }
    return;
  }

  const taskButton = event.target.closest("[data-task-go]");
  if (taskButton) {
    const action = taskButton.dataset.taskAction;
    const student = students.find((item) => item.id === taskButton.dataset.taskStudent);
    navigate(taskButton.dataset.taskGo);

    if (action === "new-student") {
      setStudentFormOpen(true);
      return;
    }

    if (action === "new-workout") {
      resetWorkoutFormMode({ resetForm: true, clearStored: true });
      const studentSelect = document.querySelector("[data-student-options]");
      if (studentSelect && student) studentSelect.value = student.id;
      refreshCustomSelects(studentSelect);
      renderWorkoutPreview();
      focusWorkoutForm();
      return;
    }

    if (action === "invite-student" && student) {
      if (inviteStudentOptions) inviteStudentOptions.value = student.id;
      renderInviteTools();
      if (!inviteDialog?.open) inviteDialog?.showModal();
      return;
    }

    if (student) {
      viewState.selectedStudentId = student.id;
      renderStudents();
      revealStudentSession();
    }
    return;
  }

  const studentSessionClose = event.target.closest("[data-student-session-close]");
  if (studentSessionClose) {
    viewState.selectedStudentId = "";
    setStudentSessionOpen(false, { focus: false });
    renderStudents();
    window.setTimeout(() => studentSearchInput?.focus(), 80);
    return;
  }

  const refreshSessionsButton = event.target.closest("[data-refresh-sessions]");
  if (refreshSessionsButton) {
    refreshWorkoutSessions();
    return;
  }

  const studentDetail = event.target.closest("[data-student-detail]");
  if (studentDetail) {
    viewState.selectedStudentId = studentDetail.dataset.studentDetail;
    navigate("students");
    renderStudents();
    revealStudentSession();
    return;
  }

  const studentAction = event.target.closest("[data-student-action]");
  if (studentAction) {
    const student = students.find((item) => item.id === studentAction.dataset.studentAction);
    navigate("workouts");
    if (student) {
      const publishedWorkout = getPublishedWorkoutForStudent(student);
      if (publishedWorkout) {
        loadWorkoutForEditing(publishedWorkout);
        return;
      }
      const studentSelect = document.querySelector("[data-student-options]");
      if (studentSelect) studentSelect.value = student.id;
      refreshCustomSelects(studentSelect);
      resetWorkoutFormMode({ clearStored: true });
      renderWorkoutPreview();
    }
    focusWorkoutForm();
  }

  const workoutAction = event.target.closest("[data-workout-action]");
  if (workoutAction) {
    const workout = workouts.find((item) => item.id === workoutAction.dataset.workoutAction);
    if (workout) loadWorkoutForEditing(workout);
    return;
  }

  const workoutDuplicate = event.target.closest("[data-workout-duplicate]");
  if (workoutDuplicate) {
    const workout = workouts.find((item) => item.id === workoutDuplicate.dataset.workoutDuplicate);
    workoutDuplicate.closest("details")?.removeAttribute("open");
    if (workout) openDuplicateWorkoutDialog(workout);
    return;
  }

  const workoutArchive = event.target.closest("[data-workout-archive]");
  if (workoutArchive) {
    const workout = workouts.find((item) => item.id === workoutArchive.dataset.workoutArchive);
    if (!workout) return;
    if (!window.confirm(`Arquivar “${workout.title}”? O histórico do aluno será preservado.`)) return;
    workoutArchive.disabled = true;
    setWorkoutSyncStatus(`Arquivando “${workout.title}”...`, "");
    const result = await workoutRepository.archivePublishedWorkout(workout.id);
    if (!result.archived) {
      workoutArchive.disabled = false;
      setWorkoutSyncStatus(result.error?.message || "Não foi possível arquivar o treino.", "warning");
      showToast("Treino não arquivado.");
      return;
    }
    applyPublishedWorkouts(workouts.filter((item) => item.id !== workout.id));
    setWorkoutSyncStatus("Treino arquivado. O histórico do aluno foi preservado.", "synced");
    showToast("Treino arquivado.");
  }
});

cancelWorkoutEditButton?.addEventListener("click", () => {
  resetWorkoutFormMode({ resetForm: true, clearStored: true });
  setWorkoutSyncStatus("Edição cancelada. Pronto para publicar novo treino.", "");
  setWorkoutBuilderOpen(false, { focus: false });
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
  if (event.key === WORKOUT_SESSIONS_KEY || event.key?.startsWith(`${WORKOUT_SESSIONS_KEY}:`)) {
    applyWorkoutSessions(sessionRepository.listCachedSessions({
      coachId: authContext?.coachId || ""
    }));
    setStudentSyncStatus("Execuções atualizadas por outra aba.", "synced");
  }
});

authForm?.addEventListener("click", async (event) => {
  const oauthButton = event.target.closest("[data-oauth-provider]");
  if (oauthButton) {
    event.preventDefault();
    await handleOAuthSignIn(oauthButton.dataset.oauthProvider);
    return;
  }

  const modeButton = event.target.closest("[data-auth-mode-button]");
  if (modeButton) {
    event.preventDefault();
    syncAuthMode(modeButton.dataset.authModeButton);
    return;
  }

  const resetButton = event.target.closest("[data-auth-reset]");
  if (resetButton) {
    event.preventDefault();
    await handlePasswordReset();
  }
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const action = authAction;
  let stage = action === "signup" ? "auth-sign-up" : "auth-sign-in";
  let authenticated = false;
  setAuthStatus(action === "signup" ? "Criando conta de professor..." : "Entrando...", "");

  try {
    const result = action === "signup"
      ? await authRepository.signUp({ ...data, role: "coach", redirectTo: getAuthRedirectUrl(), coachStatus: authRepository.coachStatus.PENDING })
      : await authRepository.signIn({ ...data, role: "coach" });
    authenticated = Boolean(result.authenticated || result.session);

    if (!result.ok) {
      setAuthStatus(result.message || "Não foi possível autenticar.", "warning");
      return;
    }

    if (result.pendingEmailConfirmation) {
      setAuthStatus(result.message, "warning");
      return;
    }

    if (result.profileIncomplete) {
      console.warn("[FlowFit][professor] Autenticação concluída; o perfil será reparado no bootstrap.", result.profileError);
      setAuthStatus("Conta autenticada. Concluindo o perfil de professor...", "");
    } else {
      setAuthStatus("Conta autenticada.", "synced");
    }

    stage = "authenticated-panel";
    await startAuthenticatedPanel();
  } catch (error) {
    rememberProfessorFailure(stage, error);
    setAuthLocked(true);
    setAuthChecking(false);
    authenticated = authenticated || authenticatedSessionDetected;
    setAuthGateSignOutVisible(authenticated);
    const message = authenticated
      ? "Sua conta foi autenticada, mas o painel não terminou de carregar. Sua sessão foi preservada; recarregue a página."
      : action === "signup"
        ? "Não foi possível concluir a criação. Antes de repetir, tente entrar com o mesmo email."
        : "Não foi possível concluir o login. Tente novamente.";
    setAuthStatus(message, "warning");
  }
});

const signOutProfessor = async () => {
  isSigningOut = true;
  authStateVersion += 1;
  clearTimeout(coachAccessTimer);
  coachAccessTimer = null;
  try {
    await authRepository.signOut();
  } finally {
    authenticatedSessionDetected = false;
    authContext = null;
    students = [];
    workouts = [];
    workoutSessions = [];
    viewState.selectedStudentId = "";
    viewState.dataStatus = "Local";
    renderAll();
    syncAuthMode("signin");
    setAuthLocked(true);
    setAuthChecking(false);
    setAuthStatus("Sessão encerrada.", "");
    setAuthGateSignOutVisible(false);
    if (coachAccessNotice) coachAccessNotice.hidden = true;
    isSigningOut = false;
  }
};

document.querySelector("[data-sign-out]")?.addEventListener("click", signOutProfessor);
document.querySelector("[data-profile-sign-out]")?.addEventListener("click", signOutProfessor);
authGateSignOut?.addEventListener("click", signOutProfessor);

const startAuthenticatedPanel = async () => {
  if (isSigningOut) return false;
  const stateVersion = authStateVersion;
  const isStale = () => isSigningOut || stateVersion !== authStateVersion;
  setAuthChecking(true);
  let session = null;
  try {
    session = await getSessionAfterAuthReturn();
    if (isStale()) return false;
  } catch (error) {
    rememberProfessorFailure("oauth-callback-session", error);
    setAuthLocked(true);
    setAuthChecking(false);
    syncAuthMode("signin", { preserveStatus: true });
    setAuthGateSignOutVisible(false);
    setAuthStatus("O Google retornou, mas não foi possível concluir a sessão. Tente novamente; se persistir, envie o erro registrado no console.", "warning");
    return false;
  }
  if (!session?.user) {
    authenticatedSessionDetected = false;
    setAuthLocked(true);
    setAuthChecking(false);
    syncAuthMode("signin", { preserveStatus: professorAuthReturn.detected });
    setAuthGateSignOutVisible(false);
    if (professorAuthReturn.detected) {
      const detail = professorAuthReturn.error ? ` Motivo informado: ${professorAuthReturn.error}.` : "";
      setAuthStatus(`O login do Google voltou ao FlowFit, mas nenhuma sessão válida foi criada.${detail} Tente novamente ou use email e senha.`, "warning");
    }
    return false;
  }
  authenticatedSessionDetected = true;

  const profileResult = await authRepository.ensureProfile({
    role: "coach",
    name: session.user.user_metadata?.display_name || session.user.email,
    coachStatus: authRepository.coachStatus.PENDING
  });
  if (isStale()) return false;
  if (profileResult.roleMismatch) {
    await authRepository.signOut();
    authenticatedSessionDetected = false;
    authContext = null;
    setAuthLocked(true);
    setAuthChecking(false);
    syncAuthMode("signin", { preserveStatus: true });
    setAuthGateSignOutVisible(false);
    const label = authRepository.getRoleLabel(profileResult.existingRole);
    setAuthStatus(`Esta conta existe como ${label} e não tem acesso ao painel do professor.`, "warning");
    return;
  }
  if (!profileResult.synced && !profileResult.profile) {
    console.error("[FlowFit][professor] Sessão válida, mas o perfil não pôde ser carregado ou reparado.", profileResult.error);
    setAuthLocked(true);
    setAuthChecking(false);
    showAuthenticatedAccessState({
      status: "error",
      email: session.user.email,
      message: "Sua conta está autenticada, mas o perfil de professor não pôde ser concluído. Recarregue a página; se persistir, informe o suporte."
    });
    return;
  }

  authContext = await authRepository.getAuthContext();
  if (isStale()) return false;

  const accessResult = await authRepository.getOwnCoachAccess();
  if (isStale()) return false;
  if (!accessResult.ok) {
    setAuthLocked(true);
    setAuthChecking(false);
    showAuthenticatedAccessState({
      status: "error",
      email: authContext?.email || session.user.email,
      message: accessResult.message
    });
    return;
  }

  const coachAccess = coachAccessView(accessResult.access);
  scheduleCoachAccessCheck(accessResult.access.next_transition_at);
  if (!coachAccess.ok) {
    setAuthLocked(true);
    setAuthChecking(false);
    showAuthenticatedAccessState({
      status: coachAccess.status || "error",
      email: authContext?.email || session.user.email,
      message: coachAccess.message
    });
    return;
  }

  setAuthLocked(false);
  setAuthChecking(false);
  setAuthGateSignOutVisible(false);
  if (coachAccessNotice) coachAccessNotice.hidden = !coachAccess.warning;
  if (coachAccessMessage) coachAccessMessage.textContent = coachAccess.message || "Regularize o acesso para evitar uma suspensão.";
  setText("[data-auth-user]", authContext.email);
  if (authUser) authUser.title = authContext.email;
  students = [];
  workouts = [];
  workoutSessions = [];
  viewState.selectedStudentId = "";
  renderAll();

  const refreshResults = await Promise.allSettled([
    refreshStudents({ silent: true }),
    refreshPublishedWorkouts({ silent: true }),
    refreshWorkoutSessions({ silent: true })
  ]);
  refreshResults.forEach((result, index) => {
    if (result.status === "rejected") {
      const resources = ["alunos", "treinos", "sessões"];
      console.warn(`[FlowFit][professor] Falha ao carregar ${resources[index]}; a sessão permanece ativa.`, result.reason);
    }
  });

  const pendingWorkoutDraft = Platform.storage.get(getWorkoutDraftStorageKey(), null);
  if (pendingWorkoutDraft?.builderOpen && pendingWorkoutDraft.savedAt !== restoredWorkoutDraftSavedAt) {
    restoreStoredWorkoutDraft({ open: true });
  }

  let remote = null;
  try {
    remote = await themeRepository.fetchBrandTheme();
  } catch (error) {
    warnOptionalFeature("tema remoto", error);
  }
  if (!remote) {
    fillThemeInputs(DEFAULT_BRAND_THEME);
    applyTheme(DEFAULT_BRAND_THEME);
    setThemeStatus("Nenhuma aparência publicada. Ajuste as opções e publique.", "");
    return;
  }
  fillThemeInputs(remote);
  applyTheme({ mode: remote.mode });
  setThemeStatus("Aparência publicada carregada.", "synced");
};

const boot = async () => {
  syncAuthMode("signin", { preserveStatus: true });
  renderAll();
  navigate(location.hash.slice(1) || "dashboard", false);
  window.FlowFitProfessorReady = true;
  await startAuthenticatedPanel();
};

const initializeOptionalPwaFeatures = () => {
  try {
    if (Platform.canUseServiceWorker() && globalThis.navigator?.serviceWorker) {
      if (navigator.serviceWorker.controller) {
        let reloadingForServiceWorker = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloadingForServiceWorker) return;
          reloadingForServiceWorker = true;
          window.location.reload();
        });
      }
      const registerServiceWorker = () => navigator.serviceWorker
        .register("./sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch((error) => warnOptionalFeature("service worker", error));
      if (document.readyState === "complete") registerServiceWorker();
      else window.addEventListener("load", registerServiceWorker, { once: true });
    }

    InstallManager.init();
    InstallManager.onChange(syncInstallButton);

    const openInstallGuide = () => {
      const dialog = document.querySelector("[data-install-guide-dialog]");
      if (!dialog || dialog.open) return;
      const ios = InstallManager.isIOS();
      document.querySelector("[data-install-guide-ios]")?.toggleAttribute("hidden", !ios);
      document.querySelector("[data-install-guide-manual]")?.toggleAttribute("hidden", ios);
      dialog.showModal?.();
    };

    document.querySelectorAll("[data-close-install-guide]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelector("[data-install-guide-dialog]")?.close?.();
      });
    });

    installAppButton?.addEventListener("click", async () => {
      if (InstallManager.canInstallNatively()) {
        try {
          installAppButton.hidden = true;
          await InstallManager.install();
          syncInstallButton();
        } catch (error) {
          warnOptionalFeature("instalação PWA", error);
        }
        return;
      }
      openInstallGuide();
    });
    syncInstallButton();
  } catch (error) {
    warnOptionalFeature("inicialização PWA", error);
  }
};

const revalidateCoachAccess = () => {
  if (isSigningOut || !authenticatedSessionDetected) return Promise.resolve(false);
  if (coachAccessRevalidationPromise) return coachAccessRevalidationPromise;
  coachAccessRevalidationPromise = startAuthenticatedPanel()
    .catch((error) => rememberProfessorFailure("coach-access-revalidation", error))
    .finally(() => { coachAccessRevalidationPromise = null; });
  return coachAccessRevalidationPromise;
};

window.addEventListener("focus", () => revalidateCoachAccess());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") revalidateCoachAccess();
});

window.addEventListener("beforeunload", () => {
  if (workoutDraftDirty) {
    saveWorkoutDraftLocally({ builderOpen: !workoutBuilder?.hidden });
  }
});

initializeOptionalPwaFeatures();

boot().catch((error) => {
  rememberProfessorFailure("session-bootstrap", error);
  window.FlowFitProfessorReady = false;
  setAuthLocked(true);
  setAuthChecking(false);
  setAuthGateSignOutVisible(authenticatedSessionDetected);
  setAuthStatus("Não foi possível verificar sua sessão. Recarregue a página ou tente entrar novamente.", "warning");
  showToast("Falha ao iniciar painel.");
});
