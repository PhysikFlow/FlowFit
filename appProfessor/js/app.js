import { svgIcon } from "../../appAluno/js/core/icons.js";
import { Platform } from "../../appAluno/js/core/platform.js";
import { DEFAULT_BRAND_THEME, LOCAL_BRAND_ASSETS_KEY, applyThemeTokens, contrastRatio, inferModeFromColor, normalizeBrandTheme } from "../../appAluno/js/core/brand-theme.js";
import { STUDENTS_KEY, createStudentFromProfessorForm, studentRepository } from "../../appAluno/js/data/repositories/student-repository.js";
import { authRepository } from "../../appAluno/js/data/repositories/auth-repository.js";
import { themeRepository } from "../../appAluno/js/data/repositories/theme-repository.js";
import { PUBLISHED_WORKOUTS_KEY, createWorkoutFromProfessorForm, parseExerciseLine, workoutRepository } from "../../appAluno/js/data/repositories/workout-repository.js";
import { WORKOUT_SESSIONS_KEY, sessionRepository } from "../../appAluno/js/data/repositories/session-repository.js";

const pages = [...document.querySelectorAll("[data-page]")];
const navItems = [...document.querySelectorAll("[data-nav]")];
const jumpButtons = [...document.querySelectorAll("[data-nav-jump]")];
const title = document.querySelector("[data-page-title]");
const toast = document.querySelector("[data-toast]");
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
const photoInput = document.querySelector("[data-photo-input]");
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
const authGate = document.querySelector("[data-auth-gate]");
const authForm = document.querySelector("[data-auth-form]");
const authStatus = document.querySelector("[data-auth-status]");
const authTitle = document.querySelector("[data-auth-title]");
const authCopy = document.querySelector("[data-auth-copy]");
const authSubmit = document.querySelector("[data-auth-submit]");
const authSecondary = document.querySelector("[data-auth-secondary]");
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
const saveThemeButton = document.querySelector("[data-save-theme]");
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
  name: "Plano piloto",
  activeStudentLimit: 20
};

let toastTimer;
let themeSaveTimer;
let students = studentRepository.listStudents();
let workouts = workoutRepository.listPublishedWorkouts();
let workoutSessions = sessionRepository.listCachedSessions();
let selectedStudentId = "";
let dataStatus = "Local";
let authContext = null;
let authAction = "signin";
let editingWorkoutId = "";
let deferredInstallPrompt = null;

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
const setInviteStatus = (message, state = "") => setStatus(inviteStatus, message, state);
const setStudentImportStatus = (message, state = "") => setStatus(studentImportStatus, message, state);

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

  if (saveThemeButton) saveThemeButton.disabled = !isReadable;
  return isReadable;
};

const getAuthRedirectUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.href;
};

const getProviderLabel = () => "Google";

const authModeContent = {
  signin: {
    title: "Entrar no painel",
    copy: "Gerencie alunos, treinos e marca em um só lugar.",
    submit: "Entrar",
    status: "Acesse sua conta de professor.",
    secondary: "Não tem conta? Use “Criar conta”."
  },
  signup: {
    title: "Criar conta de professor",
    copy: "Comece seu painel em período de teste com email, senha e nome profissional.",
    submit: "Criar conta",
    status: "Contas novas de professor entram como teste no piloto.",
    secondary: "Já tem conta? Volte para “Entrar”."
  }
};

const syncAuthMode = (mode = authAction, { preserveStatus = false } = {}) => {
  authAction = mode === "signup" ? "signup" : "signin";
  const content = authModeContent[authAction];
  if (authForm) authForm.dataset.authMode = authAction;
  if (authTitle) authTitle.textContent = content.title;
  if (authCopy) authCopy.textContent = content.copy;
  if (authSubmit) authSubmit.textContent = content.submit;
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
  const result = await authRepository.resetPassword({ email, redirectTo: getAuthRedirectUrl() });
  setAuthStatus(
    result.ok ? "Enviamos o link de recuperação para seu email." : result.message || "Não foi possível enviar a recuperação.",
    result.ok ? "synced" : "warning"
  );
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

const readLocalBrandAssets = () => Platform.storage.get(LOCAL_BRAND_ASSETS_KEY, {});

const writeLocalBrandAssets = (assets = {}) => {
  const current = readLocalBrandAssets();
  return Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, { ...current, ...assets });
};

const renderLocalBrandAssets = () => {
  const assets = readLocalBrandAssets();
  const logoTarget = document.querySelector("[data-preview-logo]");
  if (logoTarget) {
    if (assets.logoDataUrl) {
      logoTarget.innerHTML = `<img src="${assets.logoDataUrl}" alt="Logo local da marca" />`;
    } else {
      const initials = (brandInput?.value || DEFAULT_BRAND_THEME.brandName).trim().slice(0, 2).toUpperCase() || "FF";
      logoTarget.textContent = initials;
    }
  }

  const photoWrap = document.querySelector("[data-preview-photo-wrap]");
  if (photoWrap) {
    photoWrap.innerHTML = assets.photoDataUrl
      ? `<img class="preview-photo" src="${assets.photoDataUrl}" alt="Foto local do personal" />`
      : `<span class="avatar" data-preview-photo-fallback>${initialsFromName(authContext?.profile?.name || authContext?.email || "PF")}</span>`;
  }

  setText("[data-logo-file-name]", assets.logoName || "Nenhum arquivo selecionado");
  setText("[data-photo-file-name]", assets.photoName || "Nenhum arquivo selecionado");
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(String(reader.result || "")));
  reader.addEventListener("error", () => reject(reader.error || new Error("Falha ao ler imagem.")));
  reader.readAsDataURL(file);
});

const handleLocalAssetInput = async (input, type) => {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Escolha um arquivo de imagem.");
    return;
  }
  if (file.size > 1024 * 1024) {
    showToast("Imagem muito grande. Use até 1MB.");
    return;
  }

  const dataUrl = await fileToDataUrl(file);
  const prefix = type === "logo" ? "logo" : "photo";
  writeLocalBrandAssets({
    [`${prefix}DataUrl`]: dataUrl,
    [`${prefix}Name`]: file.name
  });
  renderLocalBrandAssets();
  setThemeStatus("Asset salvo apenas neste navegador. Ainda não é enviado para a nuvem.", "warning");
  showToast(type === "logo" ? "Logo local atualizado." : "Foto local atualizada.");
};

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
  syncHexInputsFromColors();
  updateContrastStatus();
  return normalized;
};

const saveThemeNow = async ({ silent = false } = {}) => {
  clearTimeout(themeSaveTimer);
  if (!updateContrastStatus()) {
    setThemeStatus("Ajuste o contraste antes de salvar o tema.", "warning");
    if (!silent) showToast("Contraste insuficiente para salvar o tema.");
    return { synced: false, blocked: true, theme: readTheme() };
  }
  setThemeStatus("Salvando marca branca...", "");
  const result = await themeRepository.saveBrandTheme(readTheme());
  const message = result.synced && result.partial
    ? "Tema salvo parcialmente. Recarregue e tente salvar novamente."
    : result.synced
    ? `Marca sincronizada e confirmada${result.updatedAt ? ` em ${formatUpdatedAt(result.updatedAt)}` : ""}.`
    : "Marca não confirmada pelo Supabase. Verifique a conexão e tente novamente.";
  setThemeStatus(message, result.synced && !result.partial ? "synced" : "warning");
  if (!silent) showToast(result.synced && !result.partial ? "Tema sincronizado." : "Tema salvo com aviso.");
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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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

const formatUpdatedAt = (value) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const formatVolume = (value) => `${(Number(value || 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`;

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
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatWorkoutStart = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "entrada indefinida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
};

const getWorkoutStage = (workout) => {
  const startsAt = new Date(workout?.startsAt || workout?.updatedAt || 0);
  const isScheduled = !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now();
  return {
    label: isScheduled ? "Agendado" : "Ativo",
    detail: isScheduled ? `entra em ${formatWorkoutStart(workout.startsAt)}` : `vigente desde ${formatWorkoutStart(workout.startsAt || workout.updatedAt)}`
  };
};

const getWorkoutSyncLabel = (workout) => {
  if (workout?.syncStatus === "synced") return "Nuvem";
  if (workout?.syncStatus === "failed") return "Pendente";
  return "Local";
};

const describeWorkoutSyncResult = (result) => {
  if (result.synced && result.partial) return "Treino enviado. Rode o SQL novo para salvar data de entrada e versão.";
  if (result.synced) return "Treino enviado. O aluno recebe quando abrir ou atualizar o app.";
  if (result.reason === "not-authenticated-as-coach") return "Treino não enviado. Entre como professor para sincronizar com o aluno.";
  const message = result.error?.message || result.workout?.syncMessage;
  return message ? `Treino salvo, mas não enviado: ${message}` : "Treino salvo, mas ainda não foi enviado para a nuvem.";
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

const getSessionsForStudent = (studentId) => workoutSessions
  .filter((session) => session.studentId === studentId)
  .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));

const applyWorkoutSessions = (sessions = sessionRepository.listCachedSessions()) => {
  workoutSessions = [...sessions].sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));
  renderStudents();
  renderStudentSessionPanel();
  renderDashboard();
};

const updateDataStatus = (status) => {
  dataStatus = status;
  renderDashboard();
};

const refreshStudents = async ({ silent = false } = {}) => {
  if (!silent) setStudentSyncStatus("Buscando alunos...", "");
  updateDataStatus("Sincronizando");
  const result = await studentRepository.fetchStudents();
  dataStatus = result.synced ? "Online" : "Local";
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
  dataStatus = result.synced ? "Online" : dataStatus;
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
  dataStatus = result.synced ? "Online" : dataStatus;
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
    ...workoutSessions.map((session) => ({
      icon: "trophy",
      title: `${session.workoutTitle} concluído`,
      detail: `${formatVolume(session.volumeKg)} - ${effortLabel(session.feedback?.effort)} - ${formatUpdatedAt(session.finishedAt)}`,
      time: session.finishedAt
    })),
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
  const isOnline = dataStatus === "Online";
  const isSyncing = dataStatus === "Sincronizando";
  setText("[data-kpi-students]", activeStudents);
  setText("[data-kpi-workouts]", workouts.length);
  setText("[data-kpi-pending]", pendingCount);
  setText("[data-hero-pending]", pendingCount);
  setText("[data-dashboard-headline]", pendingCount
    ? `${pendingCount} pendência(s) para revisar hoje.`
    : "Operação em dia.");
  setText("[data-dashboard-summary]", !students.length
    ? "Cadastre o primeiro aluno e publique um treino para liberar o app do aluno."
    : pendingCount
      ? "Priorize alunos sem treino publicado, check-ins pendentes ou status financeiro manual."
      : "Alunos ativos possuem treino publicado e não há alertas operacionais agora.");
  setText("[data-sync-eyebrow]", isOnline ? "Sincronizado" : isSyncing ? "Sincronizando" : "Offline");
  setText("[data-sync-chip]", isOnline ? "Online" : isSyncing ? "Sincronizando" : "Local");
  setText("[data-sync-title]", isOnline ? "Dados sincronizados" : isSyncing ? "Sincronizando" : "Modo offline");
  setText("[data-sync-detail]", isOnline
    ? "Tudo atualizado."
    : isSyncing
      ? "Atualizando dados..."
      : "As alterações ficam neste aparelho até reconectar.");

  const syncStatus = document.querySelector("[data-sync-chip]")?.closest(".sync-status");
  syncStatus?.classList.toggle("is-online", isOnline);
  syncStatus?.classList.toggle("is-syncing", isSyncing);
  renderTasks();
  renderActivities();
  renderAccount();
};

const renderAccount = () => {
  const activeCount = getActiveStudentCount();
  const limit = ACCOUNT_PLAN.activeStudentLimit;
  const usage = limit ? Math.min(100, Math.round((activeCount / limit) * 100)) : 0;
  setText("[data-account-plan]", ACCOUNT_PLAN.name);
  setText("[data-account-active-students]", activeCount);
  setText("[data-account-student-limit]", limit);

  const progress = document.querySelector("[data-account-limit-progress]");
  if (progress) progress.style.setProperty("--progress", `${usage}%`);

  const exceeded = activeCount > limit;
  const nearLimit = activeCount >= Math.max(1, Math.round(limit * 0.8));
  setStatus(
    document.querySelector("[data-account-status]"),
    exceeded
      ? `Limite excedido em ${activeCount - limit} aluno(s). Plano real/billing ainda não está conectado.`
      : nearLimit
        ? `Você está usando ${activeCount} de ${limit} alunos ativos do plano piloto.`
        : "Você está no plano piloto. Upgrade e cobrança entram depois.",
    exceeded || nearLimit ? "warning" : ""
  );
};

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
    return;
  }

  inviteStudentOptions.innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}${student.email ? ` - ${escapeHtml(student.email)}` : ""}</option>`).join("");
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
  select.innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}${student.email ? ` - ${escapeHtml(student.email)}` : ""}</option>`).join("");
  if (students.some((student) => student.id === previousValue)) select.value = previousValue;
  renderInviteTools();
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

const workoutToEditableTitle = (workout) => `Treino ${workout.code || "A"} - ${workout.title || "Novo treino"}`;

const workoutToEditableBlocks = (workout) => (workout.exercises || [])
  .map((exercise) => `${exercise.name} ${exercise.prescription}`)
  .join("\n");

const loadWorkoutForEditing = (workout) => {
  if (!workoutForm || !workout) return;
  const studentSelect = workoutForm.querySelector("[name='student']");
  const titleInput = workoutForm.querySelector("[name='title']");
  const templateInput = workoutForm.querySelector("[name='template']");
  const startsAtInput = workoutForm.querySelector("[name='startsAt']");
  const blocksInput = workoutForm.querySelector("[name='blocks']");

  if (studentSelect && students.some((student) => student.id === workout.studentId)) studentSelect.value = workout.studentId;
  if (titleInput) titleInput.value = workoutToEditableTitle(workout);
  if (templateInput) templateInput.value = workout.focus || templateInput.value;
  if (startsAtInput) startsAtInput.value = formatDateForInput(workout.startsAt || workout.updatedAt);
  if (blocksInput) blocksInput.value = workoutToEditableBlocks(workout);

  setWorkoutEditingMode(workout);
  setWorkoutSyncStatus("Editando treino publicado. Salve para atualizar o app do aluno.", "");
  renderWorkoutPreview();
  focusWorkoutForm();
};

const resetWorkoutFormMode = ({ resetForm = false } = {}) => {
  if (resetForm) workoutForm?.reset();
  setWorkoutEditingMode(null);
  renderWorkoutPreview();
};

const renderStudentSessionPanel = () => {
  const target = document.querySelector("[data-student-session-panel]");
  if (!target) return;
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0] || null;
  if (!selectedStudent) {
    target.innerHTML = `<article class="empty-state"><strong>Acompanhamento</strong><small>Cadastre um aluno para acompanhar execuções reais.</small></article>`;
    return;
  }
  selectedStudentId = selectedStudent.id;
  const sessions = getSessionsForStudent(selectedStudent.id);
  const totalSessions = sessions.length;
  const lastSession = sessions[0] || null;
  const totalVolume = sessions.reduce((sum, session) => sum + Number(session.volumeKg || 0), 0);
  const painCount = sessions.filter((session) => session.feedback?.pain && session.feedback.pain !== "none").length;
  const averageSets = totalSessions
    ? Math.round(sessions.reduce((sum, session) => sum + Number(session.completedSets || 0), 0) / totalSessions)
    : 0;

  const sessionCards = sessions.slice(0, 5).map((session) => {
    const setRows = (session.setLogs || []).slice(0, 6).map((log) => `
      <article class="session-log-row">
        <div><strong>${escapeHtml(log.exerciseName)}</strong><small>${escapeHtml(log.prescription || "")}</small></div>
        <span class="chip">${escapeHtml(String(log.completedSets))}x${escapeHtml(String(log.reps))}</span>
        <span>${escapeHtml(String(log.loadKg))} kg</span>
      </article>
    `).join("");
    return `
      <article class="session-card">
        <div class="session-card__head">
          <div>
            <span class="eyebrow">${escapeHtml(formatUpdatedAt(session.finishedAt))}</span>
            <h3>${escapeHtml(session.workoutTitle)}</h3>
          </div>
          <span class="chip">${escapeHtml(formatVolume(session.volumeKg))}</span>
        </div>
        <div class="session-card__feedback">
          <span class="chip">${escapeHtml(effortLabel(session.feedback?.effort))}</span>
          <span class="chip">${escapeHtml(painLabel(session.feedback?.pain))}</span>
          <span class="chip">${escapeHtml(session.completedSets)}/${escapeHtml(session.totalSets)} séries</span>
        </div>
        ${session.feedback?.note ? `<p class="session-card__note">${escapeHtml(session.feedback.note)}</p>` : ""}
        <section class="session-log-list">${setRows || `<article class="empty-state"><strong>Sem logs por exercício.</strong><small>O aluno concluiu sem registros detalhados.</small></article>`}</section>
      </article>
    `;
  }).join("");

  target.innerHTML = `
    <div class="student-session-panel__head">
      <div>
        <span class="eyebrow">Acompanhamento real</span>
        <h2>${escapeHtml(selectedStudent.name)}</h2>
      </div>
      <button class="button button--quiet" type="button" data-refresh-sessions>Atualizar execuções</button>
    </div>
    <div class="student-session-panel__metrics">
      <span><strong>${totalSessions}</strong><small>treinos concluídos</small></span>
      <span><strong>${lastSession ? formatUpdatedAt(lastSession.finishedAt) : "—"}</strong><small>última execução</small></span>
      <span><strong>${formatVolume(totalVolume)}</strong><small>volume acumulado</small></span>
      <span><strong>${painCount ? `${painCount} alerta(s)` : `${averageSets} séries`}</strong><small>${painCount ? "dor/desconforto" : "média por treino"}</small></span>
    </div>
    <section class="session-list">
      ${sessionCards || `<article class="empty-state card"><strong>Nenhum treino concluído ainda.</strong><small>Quando o aluno finalizar no app, cargas, reps e feedback aparecem aqui.</small></article>`}
    </section>
  `;
};

const renderStudents = () => {
  const target = document.querySelector("[data-student-list]");
  if (!target) {
    renderStudentOptions();
    renderWorkoutPreview();
    renderStudentSessionPanel();
    return;
  }
  if (!students.length) {
    target.innerHTML = `<article class="empty-state card"><strong>Nenhum aluno cadastrado.</strong><small>Use o formulário acima para criar o primeiro aluno real.</small></article>`;
    renderStudentOptions();
    renderWorkoutPreview();
    renderStudentSessionPanel();
    return;
  }

  target.innerHTML = students.map((student) => {
    const publishedWorkout = getPublishedWorkoutForStudent(student);
    const actionLabel = publishedWorkout ? "Editar treino publicado" : "Criar primeiro treino";
    const workoutLabel = publishedWorkout
      ? `Treino ${publishedWorkout.code} - ${publishedWorkout.title}`
      : "Sem treino publicado";
    const studentSessions = getSessionsForStudent(student.id);
    const latestSession = studentSessions[0] || null;
    const followupLabel = latestSession
      ? `Último: ${formatUpdatedAt(latestSession.finishedAt)}`
      : `${student.adherence}% aderência`;
    const accessLabel = student.email ? `Acesso: ${student.email}` : "Sem email de acesso";
    return `
      <article class="student-card card">
        <span class="avatar">${escapeHtml(student.initials)}</span>
        <div class="student-card__main">
          <div>
            <h2>${escapeHtml(student.name)}</h2>
            <p>${escapeHtml(student.goal)} - ${escapeHtml(student.plan)}</p>
            <small class="student-card__access">${escapeHtml(accessLabel)}</small>
          </div>
          <span class="chip">${escapeHtml(student.status)}</span>
        </div>
        <div class="student-card__meta">
          <span>${escapeHtml(workoutLabel)}</span>
          <span>${escapeHtml(followupLabel)}</span>
        </div>
        <div class="progress-track" aria-label="${student.adherence} por cento de aderência"><span style="--progress: ${student.adherence}%"></span></div>
        <div class="student-card__actions">
          <button class="button button--quiet" type="button" data-student-detail="${escapeHtml(student.id)}">Acompanhar</button>
          <button class="button button--quiet" type="button" data-student-action="${escapeHtml(student.id)}">${escapeHtml(actionLabel)}</button>
        </div>
      </article>
    `;
  }).join("");
  renderStudentOptions();
  renderWorkoutPreview();
  renderStudentSessionPanel();
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
    const stage = getWorkoutStage(workout);
    const syncLabel = getWorkoutSyncLabel(workout);
    const syncMessage = workout.syncMessage ? ` - ${workout.syncMessage}` : "";
    return `
      <article class="workout-card card workout-card--published">
        <span class="surface-icon">${svgIcon("dumbbell")}</span>
        <div>
          <div class="workout-card__meta-line">
            <span class="eyebrow">${escapeHtml(workout.owner || "Aluno")}</span>
            <span class="chip">${escapeHtml(stage.label)}</span>
            <span class="chip">${escapeHtml(syncLabel)}</span>
          </div>
          <h2>${escapeHtml(workout.title)}</h2>
          <p>${blocks}</p>
          <small>${escapeHtml(stage.detail)} - v${escapeHtml(workout.version || 1)} - atualizado: ${escapeHtml(formatUpdatedAt(workout.updatedAt))}${escapeHtml(syncMessage)}</small>
        </div>
        <div class="workout-card__actions">
          <button class="button button--quiet" type="button" aria-label="Editar ${escapeHtml(workout.title)}" data-workout-action="${escapeHtml(workout.id)}">Editar</button>
          <button class="button button--quiet" type="button" aria-label="Arquivar ${escapeHtml(workout.title)}" data-workout-archive="${escapeHtml(workout.id)}">Arquivar</button>
        </div>
      </article>
    `;
  }).join("");
};

const renderMessages = () => {
  const target = document.querySelector("[data-message-list]");
  if (!target) return;
  target.innerHTML = `<article class="empty-state card"><strong>Nenhuma mensagem conectada.</strong><small>O módulo de comunicação precisa de autenticação antes de receber conversas reais.</small></article>`;
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
  const draft = Object.fromEntries(new FormData(event.currentTarget));
  const existingStudent = findExistingStudentForDraft(draft);
  const student = mergeStudentDraftWithExisting(draft);
  const savedStudent = studentRepository.saveStudent({ ...student, coachId: authContext.coachId });
  applyStudents([savedStudent, ...students.filter((item) => item.id !== savedStudent.id)]);
  setStudentSyncStatus(existingStudent ? "Aluno já existia neste personal. Atualizando cadastro..." : "Aluno criado. Sincronizando...", "");
  showToast(existingStudent ? "Aluno atualizado." : "Aluno criado.");
  if (getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit) {
    setStudentSyncStatus("Aluno salvo, mas o limite do plano piloto foi excedido.", "warning");
  }

  const result = await studentRepository.syncStudent(savedStudent);
  if (result.student) {
    applyStudents([result.student, ...students.filter((item) => item.id !== result.student.id)]);
  }
  const limitExceeded = getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit;
  setStudentSyncStatus(
    result.synced
      ? limitExceeded
        ? "Aluno sincronizado, mas o limite do plano piloto foi excedido."
        : existingStudent
          ? "Aluno atualizado neste personal. Outros personais com o mesmo aluno não foram alterados."
          : draft.email
            ? "Aluno sincronizado. Ele já pode entrar diretamente com Google ou link mágico usando esse email."
            : "Aluno sincronizado sem email. Envie o convite pessoal para liberar o primeiro acesso."
      : "Aluno salvo neste aparelho.",
    result.synced && !limitExceeded ? "synced" : "warning"
  );
  if (result.synced) showToast("Aluno sincronizado.");
  event.currentTarget.reset();
});

inviteStudentOptions?.addEventListener("change", renderInviteTools);

copyInviteButton?.addEventListener("click", async () => {
  let selected = students.find((student) => student.id === inviteStudentOptions?.value);
  if (selected && isInviteExpired(selected)) {
    setInviteStatus("Gerando um novo convite pessoal...", "");
    const renewal = await studentRepository.renewInvite(selected);
    if (!renewal.renewed) {
      setInviteStatus("Não foi possível renovar o convite. Confirme o SQL e tente novamente.", "warning");
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
  setStudentImportStatus(`${savedStudents.length} aluno(s) processado(s), ${updatedExistingCount} atualizado(s). Sincronizando...`, "");
  showToast("Importação concluída.");

  const syncResults = await Promise.allSettled(savedStudents.map((student) => studentRepository.syncStudent(student)));
  const syncedCount = syncResults.filter((result) => result.status === "fulfilled" && result.value?.synced).length;
  const limitExceeded = getActiveStudentCount() > ACCOUNT_PLAN.activeStudentLimit;
  setStudentImportStatus(
    syncedCount === savedStudents.length
      ? limitExceeded
        ? `${syncedCount} aluno(s) sincronizado(s). Limite do plano piloto excedido.`
        : `${syncedCount} aluno(s) sincronizado(s). ${updatedExistingCount} já existiam neste personal.`
      : `${savedStudents.length} aluno(s) salvos; ${syncedCount} sincronizado(s).`,
    syncedCount === savedStudents.length && !limitExceeded ? "synced" : "warning"
  );

  studentImportForm.reset();
  setText("[data-student-import-file]", "Nenhum arquivo selecionado");
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

  const selectedStudent = students.find((student) => student.id === data.get("student"));
  const editingWorkout = workouts.find((item) => item.id === editingWorkoutId);
  const workout = createWorkoutFromProfessorForm({
    student: selectedStudent,
    coachId: authContext.coachId,
    title: data.get("title"),
    template: data.get("template"),
    blocks: data.get("blocks"),
    workoutId: editingWorkout?.id,
    startsAt: data.get("startsAt"),
    version: editingWorkout ? Number(editingWorkout.version || 1) + 1 : 1
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
  setWorkoutSyncStatus(editingWorkout ? "Confirmando atualização completa no Supabase..." : "Confirmando plano e exercícios no Supabase...", "");

  const result = await workoutRepository.syncPublishedWorkout(savedWorkout, linkedStudent);
  setWorkoutSyncStatus(
    describeWorkoutSyncResult(result),
    result.synced && !result.partial ? "synced" : "warning"
  );
  if (result.workout) applyPublishedWorkouts([result.workout, ...workouts.filter((item) => item.id !== result.workout.id)]);
  if (result.synced) {
    showToast(editingWorkout ? "Treino republicado e confirmado." : "Treino publicado e confirmado.");
    resetWorkoutFormMode({ resetForm: true });
  } else {
    showToast("Publicação não concluída. Revise o aviso e tente novamente.");
  }
});

workoutForm?.addEventListener("input", renderWorkoutPreview);
workoutForm?.addEventListener("change", renderWorkoutPreview);

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

colorHexPairs.forEach(([color, hex]) => {
  const syncFromColor = () => {
    hex.value = String(color.value || "").toLowerCase();
    hex.classList.remove("is-invalid");
    handleThemeControlChange();
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
  });
  hex.addEventListener("blur", () => {
    const normalized = normalizeHexInput(hex.value);
    hex.value = normalized || String(color.value || "").toLowerCase();
    hex.classList.remove("is-invalid");
    updateContrastStatus();
  });
});

logoInput?.addEventListener("change", () => handleLocalAssetInput(logoInput, "logo"));
photoInput?.addEventListener("change", () => handleLocalAssetInput(photoInput, "photo"));
document.querySelector("[data-clear-brand-assets]")?.addEventListener("click", () => {
  Platform.storage.set(LOCAL_BRAND_ASSETS_KEY, {});
  if (logoInput) logoInput.value = "";
  if (photoInput) photoInput.value = "";
  renderLocalBrandAssets();
  setThemeStatus("Logo e foto locais removidos deste navegador.", "warning");
  showToast("Assets locais removidos.");
});
saveThemeButton?.addEventListener("click", () => {
  if (!updateContrastStatus()) {
    setThemeStatus("Ajuste o contraste antes de salvar o tema.", "warning");
    showToast("Contraste insuficiente para salvar.");
    return;
  }
  saveThemeNow();
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
      ? "Tema restaurado para o padrão FlowFit validado e sincronizado."
      : "Tema restaurado neste aparelho.",
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
    setCoachProfileStatus(result.error?.message || "Não foi possível sincronizar o perfil.", "warning");
    showToast("Perfil não sincronizado.");
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
    result.partial ? "Perfil salvo parcialmente. Recarregue e tente salvar novamente." : "Perfil profissional sincronizado.",
    result.partial ? "warning" : "synced"
  );
  showToast("Perfil atualizado.");
});

document.addEventListener("click", async (event) => {
  const refreshSessionsButton = event.target.closest("[data-refresh-sessions]");
  if (refreshSessionsButton) {
    refreshWorkoutSessions();
    return;
  }

  const studentDetail = event.target.closest("[data-student-detail]");
  if (studentDetail) {
    selectedStudentId = studentDetail.dataset.studentDetail;
    navigate("students");
    renderStudents();
    document.querySelector("[data-student-session-panel]")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      resetWorkoutFormMode();
      renderWorkoutPreview();
    }
    focusWorkoutForm();
  }

  const workoutAction = event.target.closest("[data-workout-action]");
  if (workoutAction) {
    const workout = workouts.find((item) => item.id === workoutAction.dataset.workoutAction);
    if (workout) loadWorkoutForEditing(workout);
  }

  const workoutArchive = event.target.closest("[data-workout-archive]");
  if (workoutArchive) {
    const workout = workouts.find((item) => item.id === workoutArchive.dataset.workoutArchive);
    if (!workout) return;
    workoutArchive.disabled = true;
    setWorkoutSyncStatus(`Arquivando Treino ${workout.code}...`, "");
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
  resetWorkoutFormMode({ resetForm: true });
  setWorkoutSyncStatus("Edição cancelada. Pronto para publicar novo treino.", "");
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
  if (event.key === WORKOUT_SESSIONS_KEY) {
    applyWorkoutSessions(sessionRepository.listCachedSessions());
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
  setAuthStatus(authAction === "signup" ? "Criando conta de professor..." : "Entrando...", "");

  const result = authAction === "signup"
    ? await authRepository.signUp({ ...data, role: "coach", redirectTo: getAuthRedirectUrl(), coachStatus: authRepository.coachStatus.PENDING })
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

const signOutProfessor = async () => {
  await authRepository.signOut();
  authContext = null;
  students = [];
  workouts = [];
  workoutSessions = [];
  selectedStudentId = "";
  dataStatus = "Local";
  renderAll();
  setAuthLocked(true);
  syncAuthMode("signin");
  setAuthStatus("Sessão encerrada.", "");
  setAuthGateSignOutVisible(false);
  if (coachAccessNotice) coachAccessNotice.hidden = true;
};

document.querySelector("[data-sign-out]")?.addEventListener("click", signOutProfessor);
authGateSignOut?.addEventListener("click", signOutProfessor);

const startAuthenticatedPanel = async () => {
  const session = await authRepository.getSession();
  if (!session?.user) {
    setAuthLocked(true);
    syncAuthMode("signin");
    setAuthGateSignOutVisible(false);
    return;
  }

  const profileResult = await authRepository.ensureProfile({
    role: "coach",
    name: session.user.user_metadata?.display_name || session.user.email,
    coachStatus: authRepository.coachStatus.PENDING
  });
  if (profileResult.roleMismatch) {
    await authRepository.signOut();
    authContext = null;
    setAuthLocked(true);
    syncAuthMode("signin", { preserveStatus: true });
    setAuthGateSignOutVisible(false);
    setAuthStatus("Esta conta já existe como aluno. Use outro email para o painel do professor.", "warning");
    return;
  }
  if (!profileResult.synced && !profileResult.profile) {
    setAuthLocked(true);
    setAuthGateSignOutVisible(true);
    setAuthStatus("Conta autenticada, mas o perfil não carregou. Recarregue a página.", "warning");
    return;
  }
  authContext = await authRepository.getAuthContext();

  const coachAccess = authRepository.getCoachAccess(authContext?.profile);
  if (!coachAccess.ok) {
    setAuthLocked(true);
    setAuthGateSignOutVisible(true);
    setAuthStatus(coachAccess.message, "warning");
    return;
  }

  setAuthLocked(false);
  setAuthGateSignOutVisible(false);
  if (coachAccessNotice) coachAccessNotice.hidden = !coachAccess.warning;
  if (coachAccessMessage) coachAccessMessage.textContent = coachAccess.message || "Regularize o acesso para evitar uma suspensão.";
  setText("[data-auth-user]", authContext.email);
  if (authUser) authUser.title = authContext.email;
  students = [];
  workouts = [];
  workoutSessions = [];
  selectedStudentId = "";
  renderAll();

  await Promise.allSettled([
    refreshStudents({ silent: true }),
    refreshPublishedWorkouts({ silent: true }),
    refreshWorkoutSessions({ silent: true })
  ]);

  const remote = await themeRepository.fetchBrandTheme();
  if (!remote) {
    fillThemeInputs(DEFAULT_BRAND_THEME);
    applyTheme(DEFAULT_BRAND_THEME);
    setThemeStatus("Sem tema publicado ainda. Use Salvar e aplicar para criar o primeiro.", "");
    return;
  }
  fillThemeInputs(remote);
  applyTheme({ mode: remote.mode });
  setThemeStatus("Tema publicado carregado para edição.", "synced");
};

const boot = async () => {
  syncAuthMode("signin", { preserveStatus: true });
  renderAll();
  navigate(location.hash.slice(1) || "dashboard", false);
  window.FlowFitProfessorReady = true;
  await startAuthenticatedPanel();
};

if (Platform.canUseServiceWorker() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installAppButton) installAppButton.hidden = false;
});

installAppButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  installAppButton.hidden = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installAppButton) installAppButton.hidden = true;
});

boot().catch((error) => {
  console.error("Falha ao iniciar appProfessor", error);
  window.FlowFitProfessorErrors = window.FlowFitProfessorErrors || [];
  window.FlowFitProfessorErrors.push(String(error?.message || error));
  document.body?.setAttribute("data-professor-error", String(error?.message || error).slice(0, 180));
  window.FlowFitProfessorReady = false;
  showToast("Falha ao iniciar painel. Recarregue a página.");
});
