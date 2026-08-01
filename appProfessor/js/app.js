import { svgIcon } from "../../appAluno/js/core/icons.js";
import { DEFAULT_BRAND_THEME, applyThemeTokens, normalizeBrandTheme } from "../../appAluno/js/core/brand-theme.js";
import { themeRepository } from "../../appAluno/js/data/repositories/theme-repository.js";
import { activities, messages, students as mockStudents, tasks, workouts as mockWorkouts } from "./data/mock-data.js";

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

let toastTimer;
let themeSaveTimer;
let students = [...mockStudents];
let workouts = [...mockWorkouts];

const readTheme = () => ({
  brandName: brandInput.value.trim() || "FlowFit",
  tagline: taglineInput.value.trim() || "Seu treino, no seu ritmo",
  accent: accentInput.value,
  mode: document.documentElement.dataset.mode
});

const setThemeStatus = (message, state = "") => {
  if (!themeStatus) return;
  themeStatus.textContent = message;
  themeStatus.classList.toggle("is-synced", state === "synced");
  themeStatus.classList.toggle("is-warning", state === "warning");
};

const fillThemeInputs = (theme) => {
  const normalized = normalizeBrandTheme(theme);
  brandInput.value = normalized.brandName;
  taglineInput.value = normalized.tagline;
  accentInput.value = normalized.accent;
  return normalized;
};

const saveThemeNow = async ({ silent = false } = {}) => {
  clearTimeout(themeSaveTimer);
  setThemeStatus("Salvando marca branca...", "");
  const result = await themeRepository.saveBrandTheme(readTheme());
  const message = result.synced
    ? "Marca branca salva na nuvem e pronta para o app do aluno."
    : "Marca branca salva localmente. Configure o Supabase para sincronizar entre dispositivos.";
  setThemeStatus(message, result.synced ? "synced" : "warning");
  if (!silent) showToast(result.synced ? "Tema aplicado no app do aluno." : "Tema aplicado localmente.");
  return result;
};

const queueThemeSave = () => {
  clearTimeout(themeSaveTimer);
  setThemeStatus("Alteracao pendente. Salvamento automatico em instantes.", "");
  themeSaveTimer = setTimeout(() => saveThemeNow({ silent: true }), 700);
};

const pageTitles = {
  dashboard: "Dashboard",
  students: "Alunos",
  workouts: "Treinos",
  messages: "Comunicacao",
  business: "Negocio",
  appearance: "Aparencia"
};

const initialsFromName = (name) => String(name)
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase() || "AL";

const showToast = (message) => {
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
  title.textContent = pageTitles[destination] || "Painel";
  if (updateHash) history.replaceState(null, "", `#${destination}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const focusWorkoutForm = () => {
  const form = document.querySelector("[data-workout-form]");
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => form?.querySelector("select, input, textarea")?.focus(), 260);
};

const renderIcons = () => {
  document.querySelectorAll("[data-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.icon);
  });
  document.querySelector("[data-brand-icon]").innerHTML = svgIcon("dumbbell");
};

const renderDashboard = () => {
  document.querySelector("[data-kpi-students]").textContent = students.filter((student) => student.status !== "Inadimplente").length;
  document.querySelector("[data-kpi-workouts]").textContent = workouts.length;
  document.querySelector("[data-task-list]").innerHTML = tasks.map((task) => `
    <article class="task-row">
      <span class="chip">${task.type}</span>
      <div><strong>${task.title}</strong><small>${task.detail}</small></div>
    </article>
  `).join("");
  document.querySelector("[data-activity-list]").innerHTML = activities.map((item) => `
    <article class="activity-row">
      <span class="surface-icon">${svgIcon("check")}</span>
      <p>${item}</p>
    </article>
  `).join("");
};

const renderStudentOptions = () => {
  const select = document.querySelector("[data-student-options]");
  select.innerHTML = students.map((student) => `<option>${student.name}</option>`).join("");
};

const renderStudents = () => {
  document.querySelector("[data-student-list]").innerHTML = students.map((student) => `
    <article class="student-card card">
      <span class="avatar">${student.initials}</span>
      <div class="student-card__main">
        <div>
          <h2>${student.name}</h2>
          <p>${student.goal} - ${student.plan}</p>
        </div>
        <span class="chip">${student.status}</span>
      </div>
      <div class="student-card__meta">
        <span>${student.workout}</span>
        <span>${student.adherence}% aderencia</span>
      </div>
      <div class="progress-track" aria-label="${student.adherence} por cento de aderencia"><span style="--progress: ${student.adherence}%"></span></div>
      <button class="button button--quiet button--block" type="button" data-student-action="${student.id}">
        ${student.nextAction} ${svgIcon("arrow-right")}
      </button>
    </article>
  `).join("");
  renderStudentOptions();
  renderDashboard();
};

const renderWorkouts = () => {
  document.querySelector("[data-workout-count]").textContent = `${workouts.length} itens`;
  document.querySelector("[data-workout-list]").innerHTML = workouts.map((workout) => `
    <article class="workout-card card">
      <span class="surface-icon">${svgIcon("dumbbell")}</span>
      <div>
        <span class="eyebrow">${workout.owner}</span>
        <h2>${workout.title}</h2>
        <p>${workout.blocks.join(" - ")}</p>
        <small>Atualizado: ${workout.updatedAt}</small>
      </div>
      <button class="icon-button" type="button" aria-label="Editar ${workout.title}" data-workout-action="${workout.id}">
        ${svgIcon("chevron-right")}
      </button>
    </article>
  `).join("");
  renderDashboard();
};

const renderMessages = () => {
  document.querySelector("[data-message-list]").innerHTML = messages.map((message) => `
    <article class="message-row">
      <span class="surface-icon">${svgIcon("message")}</span>
      <div>
        <strong>${message.from}</strong>
        <p>${message.text}</p>
        <small>${message.time}</small>
      </div>
    </article>
  `).join("");
};

const applyTheme = ({ brand, tagline, accent, mode } = {}) => {
  const nextTheme = applyThemeTokens({
    brandName: brand ?? brandInput.value,
    tagline: tagline ?? taglineInput.value,
    accent: accent ?? accentInput.value,
    mode: mode ?? document.documentElement.dataset.mode
  });
  document.title = `${nextTheme.brandName} - Professor`;
  document.querySelectorAll("[data-brand-name]").forEach((item) => { item.textContent = nextTheme.brandName; });
  document.querySelector("[data-preview-brand]").textContent = nextTheme.brandName;
  document.querySelector("[data-preview-tagline]").textContent = nextTheme.tagline;
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.modeChoice === nextTheme.mode));
};

const renderAll = () => {
  renderIcons();
  renderDashboard();
  renderStudents();
  renderWorkouts();
  renderMessages();
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

document.querySelector("[data-scroll-workout-form]").addEventListener("click", (event) => {
  event.preventDefault();
  focusWorkoutForm();
});

document.querySelector("[data-student-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get("name") || "Novo Aluno").trim();
  students = [
    {
      id: `student-${Date.now()}`,
      name,
      initials: initialsFromName(name),
      goal: String(data.get("goal") || "Hipertrofia"),
      status: String(data.get("status") || "Ativo"),
      plan: "Novo",
      workout: "Sem treino atribuido",
      adherence: 0,
      nextAction: "Criar primeiro treino"
    },
    ...students
  ];
  renderStudents();
  showToast("Aluno mockado adicionado ao painel.");
});

document.querySelector("[data-workout-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  workouts = [
    {
      id: `workout-${Date.now()}`,
      title: String(data.get("title") || "Novo treino"),
      owner: String(data.get("student") || "Aluno"),
      blocks: String(data.get("blocks") || data.get("template") || "Modelo")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6),
      updatedAt: "Agora"
    },
    ...workouts
  ];
  renderWorkouts();
  showToast("Treino mockado criado.");
});

document.querySelector("[data-broadcast-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Aviso mockado salvo para envio futuro.");
});

brandInput.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
taglineInput.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
accentInput.addEventListener("input", () => { applyTheme(); queueThemeSave(); });
modeButtons.forEach((button) => button.addEventListener("click", () => { applyTheme({ mode: button.dataset.modeChoice }); queueThemeSave(); }));
document.querySelector("[data-save-theme]").addEventListener("click", () => saveThemeNow());
document.querySelector("[data-reset-theme]").addEventListener("click", () => {
  fillThemeInputs(DEFAULT_BRAND_THEME);
  applyTheme({ mode: DEFAULT_BRAND_THEME.mode });
  saveThemeNow();
  showToast("Preview visual restaurado.");
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-student-action]")) showToast("Acao mockada. Depois abre detalhe do aluno.");
  if (event.target.closest("[data-workout-action]")) showToast("Edicao mockada. Depois abre builder completo.");
});

window.addEventListener("hashchange", () => navigate(location.hash.slice(1), false));

renderAll();
navigate(location.hash.slice(1) || "dashboard", false);

// Marca branca: carrega o tema publicado no servidor (se houver).
(async () => {
  const remote = await themeRepository.fetchBrandTheme();
  if (!remote) {
    setThemeStatus("Sem tema publicado ainda. Use Salvar e aplicar para criar o primeiro.", "");
    return;
  }
  fillThemeInputs(remote);
  applyTheme({ mode: remote.mode });
  setThemeStatus("Tema publicado carregado para edicao.", "synced");
})();
