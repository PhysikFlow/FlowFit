import { svgIcon } from "../../appAluno/js/core/icons.js?v=build-20260822-1";
import { escapeHtml, formatVolume, normalizeSearch } from "../../appProfessor/js/utils/formatters.js?v=build-20260816-1";
import { parseQuickEntry, normalizePrescription as normalizeStructuredPrescription, formatPrescription, cloneTrainingDocument } from "../../appAluno/js/data/training-domain.js?v=build-20260823-2";

// ── DOM references ──────────────────────────────────────────────────────────────
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
const quickEntryButton = document.querySelector("[data-import-quick-entry]");
const saveWorkoutDraftButton = document.querySelector("[data-save-workout-draft]");
const saveAsTemplateButton = document.querySelector("[data-save-as-template]");

// ── State ───────────────────────────────────────────────────────────────────────
let editingWorkoutId = "";
let workoutDraftExercises = [];
let workoutDraftTextSignature = "";
let selectedDraftExerciseKey = "";
let workoutUndoStack = [];
let workoutRedoStack = [];
let draftFieldSnapshot = null;
let activeWorkoutDrag = null;
let removedWorkoutExercise = null;
const workoutReorderAnimations = new Set();

const WORKOUT_DRAFT_STORAGE_PREFIX = "flowfit.test.workout-draft";

// ── Mock data ───────────────────────────────────────────────────────────────────
const MOCK_STUDENTS = [
  { id: "student-01", name: "Ana Souza", email: "ana@email.com" },
  { id: "student-02", name: "Carlos Lima", email: "carlos@email.com" },
  { id: "student-03", name: "Maria Oliveira", email: "maria@email.com" }
];

const MOCK_WORKOUTS = [
  {
    id: "workout-test-01",
    title: "Peito e tríceps",
    focus: "Hipertrofia",
    owner: "Ana Souza",
    studentId: "student-01",
    exercises: [
      { name: "Supino reto", sets: 4, reps: "10", rest: "90s", prescription: "4 x 10", tempo: "2-0-2", load: "40 kg", rir: "2", rpe: "", target: "Peito", instructions: "", notes: "", blockType: "standard", blockId: "", blockLabel: "", alternatives: [], mediaUrl: "", mediaType: "none", mediaMetadata: {} },
      { name: "Crucifixo", sets: 3, reps: "12", rest: "60s", prescription: "3 x 12", tempo: "2-0-2", load: "14 kg", rir: "2", rpe: "", target: "Peito", instructions: "", notes: "", blockType: "standard", blockId: "", blockLabel: "", alternatives: [], mediaUrl: "", mediaType: "none", mediaMetadata: {} },
      { name: "Tríceps corda", sets: 3, reps: "15", rest: "60s", prescription: "3 x 15", tempo: "2-0-2", load: "20 kg", rir: "2", rpe: "", target: "Tríceps", instructions: "", notes: "", blockType: "standard", blockId: "", blockLabel: "", alternatives: [], mediaUrl: "", mediaType: "none", mediaMetadata: {} }
    ],
    startsAt: "2026-08-24",
    updatedAt: new Date().toISOString()
  }
];

// ── Toast ───────────────────────────────────────────────────────────────────────
let toastTimer;
const showToast = (message, { actionLabel = "", duration = 3200, onAction = null } = {}) => {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;
  clearTimeout(toastTimer);
  const actionHtml = actionLabel ? `<button class="button button--quiet" type="button" data-toast-action>${escapeHtml(actionLabel)}</button>` : "";
  toast.innerHTML = `<span>${escapeHtml(message)}</span>${actionHtml}`;
  toast.classList.add("is-visible");
  const actionButton = toast.querySelector("[data-toast-action]");
  if (actionButton && onAction) {
    actionButton.addEventListener("click", () => {
      onAction();
      toast.classList.remove("is-visible");
    }, { once: true });
  }
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
};

const setText = (selector, value) => {
  const target = document.querySelector(selector);
  if (target) target.textContent = value;
};

const setWorkoutSyncStatus = (message, state = "") => {
  if (!workoutSyncStatus) return;
  workoutSyncStatus.textContent = message;
  workoutSyncStatus.classList.toggle("is-synced", state === "synced");
  workoutSyncStatus.classList.toggle("is-warning", state === "warning");
};

const $ = (selector) => document.querySelector(selector);

// ── Helpers ─────────────────────────────────────────────────────────────────────
const createDraftExerciseKey = () => globalThis.crypto?.randomUUID?.()
  || `draft-exercise-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const compactPrescription = (value) => String(value || "3 x 10")
  .trim()
  .replace(/\s*x\s*/i, "x");

const exerciseToDraftLine = (exercise) => {
  const canonical = `${String(exercise?.name || "Exercício").trim()} ${compactPrescription(exercise?.prescription)}`.trim();
  const sourceLine = String(exercise?.sourceLine || "").trim();
  if (!sourceLine) return canonical;
  return canonical;
};

const toDraftExercise = (exercise, index = 0, sourceLine = "") => ({
  ...normalizeStructuredPrescription(exercise, index, "draft"),
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

const setWorkoutDraftDirty = (dirty, message = "") => {
  if (message) {
    setWorkoutSyncStatus(message, dirty ? "warning" : "synced");
    return;
  }
  setWorkoutSyncStatus(
    dirty ? "● Alterações não publicadas" : "✓ Treino atualizado",
    dirty ? "warning" : "synced"
  );
};

const markWorkoutDraftChanged = () => {
  setWorkoutDraftDirty(true);
};

// ── Draft data ──────────────────────────────────────────────────────────────────
const getWorkoutDraft = () => {
  if (!workoutForm) return { exercises: [], totalSets: 0, estimatedMinutes: 0 };
  const exercises = workoutDraftExercises;
  const totalSets = exercises.reduce((sum, exercise) => sum + Number(exercise.sets || 0), 0);
  return {
    exercises,
    totalSets,
    estimatedMinutes: exercises.length ? Math.max(28, exercises.length * 7) : 0
  };
};

const formatDateForInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

// ── Rendering helpers ───────────────────────────────────────────────────────────
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

const renderRepdbDraftMedia = (exercise) => {
  return `
    <div class="repdb-draft-media repdb-draft-media--empty">
      <div>
        <strong>Ilustração RepDB</strong>
        <small>Escolha uma referência visual flat para o aluno.</small>
      </div>
      <button class="button button--quiet" type="button" disabled>Escolher ilustração</button>
    </div>`;
};

const blockTypeLabel = (value) => ({
  standard: "Sem grupo",
  warmup: "Aquecimento",
  superset: "Superset",
  circuit: "Circuito",
  main: "Principal",
  finisher: "Finalizador"
}[value] || "Sem grupo");

const recentExerciseHistory = () => [];

const renderTrainingDetails = (exercise) => {
  if (!exercise) return `<aside class="training-details"><strong>Selecione um exercício</strong><small>Os detalhes, mídia e histórico aparecerão aqui.</small></aside>`;
  const history = recentExerciseHistory(exercise);
  return `<aside class="training-details" data-training-details="${escapeHtml(exercise.draftKey)}">
    <header><div><span class="eyebrow">Exercício selecionado</span><h3>${escapeHtml(exercise.name)}</h3></div><button class="icon-button training-details__close" type="button" data-close-training-details aria-label="Fechar detalhes">×</button></header>
    <div class="training-details__grid">
      <label>Cadência<input value="${escapeHtml(exercise.tempo)}" data-draft-exercise-field="tempo" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
      <label>Carga/alvo<input value="${escapeHtml(exercise.load)}" data-draft-exercise-field="load" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
      <label>RPE opcional<input value="${escapeHtml(exercise.rpe || "")}" data-draft-exercise-field="rpe" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
      <label>Grupo muscular/alvo<input value="${escapeHtml(exercise.target || "")}" data-draft-exercise-field="target" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
      <label>Tipo de bloco<select data-draft-exercise-field="blockType" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">
        ${["standard","warmup","superset","circuit","main","finisher"].map((type) => `<option value="${type}" ${exercise.blockType === type ? "selected" : ""}>${blockTypeLabel(type)}</option>`).join("")}
      </select></label>
      <label>Identificador do bloco<input value="${escapeHtml(exercise.blockLabel || "")}" placeholder="Ex: A ou Aquecimento" data-draft-exercise-field="blockLabel" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
    </div>
    <label>Instrução para o aluno<textarea rows="3" maxlength="240" data-draft-exercise-field="instructions" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">${escapeHtml(exercise.instructions || "")}</textarea></label>
    <label>Alternativas <input value="${escapeHtml((exercise.alternatives || []).join(", "))}" placeholder="Ex: Halteres, máquina" data-draft-exercise-field="alternatives" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" /></label>
    ${renderRepdbDraftMedia(exercise)}
    <div class="training-details__grid">
      <label>Tipo da mídia<select data-draft-exercise-field="mediaType" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">
        ${["none","image","gif","video","youtube","external"].map((type) => `<option value="${type}" ${exercise.mediaType === type ? "selected" : ""}>${({none:"Sem mídia",image:"Imagem",gif:"GIF",video:"Vídeo",youtube:"YouTube",external:"Link externo"})[type]}</option>`).join("")}
      </select></label>
      <label>URL da demonstração<input type="url" value="${escapeHtml(exercise.mediaUrl || "")}" data-draft-exercise-field="mediaUrl" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" placeholder="https://..." /></label>
    </div>
    <section class="training-history"><strong>Histórico recente${history.length ? "" : " indisponível"}</strong>
      ${history.length ? `<div>${history.map((log) => `<span><time>${escapeHtml(log.finishedAt || "")}</time><b>${formatVolume(log.loadKg || 0)} · ${escapeHtml(log.reps || "")} reps</b><small>${log.rir ? `RIR ${escapeHtml(log.rir)}` : ""}</small></span>`).join("")}</div>` : `<small>Associe o treino a um aluno com execuções deste exercício para consultar dados reais.</small>`}
    </section>
  </aside>`;
};

const renderStudentWorkoutPreview = (exercises) => {
  const title = workoutForm?.elements.namedItem("title")?.value || "Novo treino";
  const objective = workoutForm?.elements.namedItem("objective")?.value || "Prescrição personalizada";
  let previousBlock = "";
  return `<details class="student-workout-preview"><summary>Prévia no app do aluno</summary><div class="student-workout-preview__screen">
    <span class="eyebrow">Treino disponível</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(objective)}</p>
    <div>${exercises.map((exercise, index) => {
      const block = exercise.blockId || "";
      const heading = block && block !== previousBlock ? `<small class="student-workout-preview__block">${escapeHtml(exercise.blockLabel || blockTypeLabel(exercise.blockType))}</small>` : "";
      previousBlock = block;
      return `${heading}<article><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(formatPrescription(exercise.sets, exercise.reps))} · ${escapeHtml(exercise.rest)} descanso</small></span></article>`;
    }).join("")}</div></div></details>`;
};

const renderWorkoutPreview = () => {
  if (!previewList || !previewExercises || !previewSets || !previewMinutes) return;
  const draft = getWorkoutDraft();
  previewExercises.textContent = draft.exercises.length;
  previewSets.textContent = draft.totalSets;
  previewMinutes.textContent = draft.estimatedMinutes;
  if (!draft.exercises.length) {
    previewList.innerHTML = `<article class="empty-state"><strong>Comece pela entrada rápida.</strong><small>Cole várias linhas ou adicione o primeiro exercício diretamente.</small>${renderWorkoutInsertSlot(0)}</article>`;
    return;
  }
  if (!draft.exercises.some((exercise) => exercise.draftKey === selectedDraftExerciseKey)) selectedDraftExerciseKey = draft.exercises[0].draftKey;
  const rows = draft.exercises.map((exercise, index) => `
    <div class="workout-preview__entry training-grid__row ${exercise.draftKey === selectedDraftExerciseKey ? "is-selected" : ""}" role="row" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}">
      <button class="workout-exercise-drag-handle" type="button" data-draft-drag-handle="${escapeHtml(exercise.draftKey)}" aria-label="Mover ${escapeHtml(exercise.name)}"><span class="workout-exercise-drag-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span></button>
      <button class="training-grid__index" type="button" data-select-draft-exercise="${escapeHtml(exercise.draftKey)}" aria-label="Abrir detalhes de ${escapeHtml(exercise.name)}">${String(index + 1).padStart(2, "0")}</button>
      <input class="training-grid__name" value="${escapeHtml(exercise.name)}" data-draft-exercise-field="name" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" aria-label="Exercício ${index + 1}" />
      <input type="number" min="1" max="99" value="${escapeHtml(exercise.sets)}" data-draft-exercise-field="sets" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" aria-label="Séries de ${escapeHtml(exercise.name)}" />
      <input value="${escapeHtml(exercise.reps)}" data-draft-exercise-field="reps" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" aria-label="Repetições de ${escapeHtml(exercise.name)}" />
      <input value="${escapeHtml(exercise.rir)}" data-draft-exercise-field="rir" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" aria-label="RIR de ${escapeHtml(exercise.name)}" />
      <input value="${escapeHtml(exercise.rest)}" data-draft-exercise-field="rest" data-draft-exercise-key="${escapeHtml(exercise.draftKey)}" aria-label="Descanso de ${escapeHtml(exercise.name)}" />
      <button class="training-grid__details" type="button" data-select-draft-exercise="${escapeHtml(exercise.draftKey)}" aria-label="Mais detalhes de ${escapeHtml(exercise.name)}">${exercise.blockType !== "standard" ? escapeHtml(exercise.blockLabel || blockTypeLabel(exercise.blockType)) : "•••"}</button>
      <details class="action-menu workout-exercise-menu"><summary class="icon-button" aria-label="Ações para ${escapeHtml(exercise.name)}">•••</summary><div class="action-menu__popover action-menu__popover--end">
        <button type="button" data-duplicate-draft-exercise="${escapeHtml(exercise.draftKey)}">Duplicar</button><button class="is-danger" type="button" data-delete-draft-exercise="${escapeHtml(exercise.draftKey)}">Excluir</button>
      </div></details>
    </div>`).join("");
  const selected = draft.exercises.find((exercise) => exercise.draftKey === selectedDraftExerciseKey);
  previewList.innerHTML = `${renderStudentWorkoutPreview(draft.exercises)}<div class="training-editor__workspace">
    <section class="training-grid" role="grid" aria-label="Editor estruturado de exercícios">
      <div class="training-grid__header" role="row"><span></span><span>#</span><span>Exercício</span><span>Séries</span><span>Reps</span><span>RIR</span><span>Descanso</span><span>Detalhes</span><span></span></div>
      ${rows}${renderWorkoutInsertSlot(draft.exercises.length)}
    </section>${renderTrainingDetails(selected)}</div>`;
};

// ── Find helpers ────────────────────────────────────────────────────────────────
const findDraftExerciseIndex = (draftKey) => workoutDraftExercises
  .findIndex((exercise) => exercise.draftKey === draftKey);

const findDraftExerciseHandle = (draftKey) => [...(previewList?.querySelectorAll("[data-draft-drag-handle]") || [])]
  .find((handle) => handle.dataset.draftDragHandle === draftKey) || null;

const snapshotWorkoutDraft = () => cloneTrainingDocument(workoutDraftExercises);

const pushWorkoutUndo = (snapshot = snapshotWorkoutDraft()) => {
  workoutUndoStack.push(snapshot);
  if (workoutUndoStack.length > 80) workoutUndoStack.shift();
  workoutRedoStack = [];
};

const applyWorkoutHistory = (source, destination) => {
  const snapshot = source.pop();
  if (!snapshot) return false;
  destination.push(snapshotWorkoutDraft());
  workoutDraftExercises = snapshot.map((exercise, index) => toDraftExercise(exercise, index));
  selectedDraftExerciseKey = workoutDraftExercises.find((item) => item.draftKey === selectedDraftExerciseKey)?.draftKey
    || workoutDraftExercises[0]?.draftKey || "";
  writeWorkoutDraftText();
  markWorkoutDraftChanged();
  renderWorkoutPreview();
  return true;
};

const commitWorkoutDraftMutation = ({ focusKey = "", announce = "" } = {}) => {
  writeWorkoutDraftText();
  markWorkoutDraftChanged();
  renderWorkoutPreview();
  if (announce) showToast(announce);
  if (focusKey) {
    window.setTimeout(() => findDraftExerciseHandle(focusKey)?.focus(), 0);
  }
};

// ── Exercise mutations ──────────────────────────────────────────────────────────
const moveDraftExercise = (draftKey, nextIndex) => {
  const currentIndex = findDraftExerciseIndex(draftKey);
  if (currentIndex < 0 || workoutDraftExercises.length < 2) return false;
  const boundedIndex = Math.max(0, Math.min(nextIndex, workoutDraftExercises.length - 1));
  if (boundedIndex === currentIndex) return false;
  pushWorkoutUndo();
  const [exercise] = workoutDraftExercises.splice(currentIndex, 1);
  workoutDraftExercises.splice(boundedIndex, 0, exercise);
  commitWorkoutDraftMutation({ focusKey: draftKey });
  return true;
};

const duplicateDraftExercise = (draftKey) => {
  const index = findDraftExerciseIndex(draftKey);
  if (index < 0) {
    showToast("Exercício não encontrado.");
    return;
  }
  pushWorkoutUndo();
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
  pushWorkoutUndo();
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
  pushWorkoutUndo();
  const parsed = parseQuickEntry(normalizedLine, "draft-import")?.[0] || {
    name: normalizedLine,
    sets: 3,
    reps: "10",
    rest: "60s"
  };
  const exercise = toDraftExercise({
    ...parsed,
    id: `draft-${Date.now()}`,
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
  if (field === "alternatives") exercise.alternatives = input.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (field === "sets") exercise.sets = Math.max(1, Number.parseInt(input.value || "1", 10) || 1);
  if (["sets", "reps"].includes(field)) exercise.prescription = formatPrescription(exercise.sets, exercise.reps);
  if (field === "blockType" && input.value === "standard") {
    exercise.blockId = "";
    exercise.blockLabel = "";
  } else if (field === "blockType" && !exercise.blockId) {
    exercise.blockId = `${input.value}-${Date.now()}`;
  }
  if (field === "blockLabel" && exercise.blockType !== "standard" && !exercise.blockId) exercise.blockId = `block-${Date.now()}`;
  if (["name", "prescription", "sets", "reps"].includes(field)) {
    exercise.sourceLine = "";
    writeWorkoutDraftText();
    const card = input.closest(".workout-preview__entry");
    const nameTarget = card?.querySelector("[data-preview-exercise-name]");
    if (field === "name" && nameTarget) nameTarget.textContent = exercise.name;
    const prescription = card?.querySelector("[data-preview-exercise-prescription]");
    if (prescription) prescription.textContent = `${exercise.prescription} - ${exercise.rest} descanso`;
  } else if (field === "rest") {
    const prescription = input.closest(".workout-preview__entry")?.querySelector("[data-preview-exercise-prescription]");
    if (prescription) prescription.textContent = `${exercise.prescription} - ${exercise.rest} descanso`;
  }
  markWorkoutDraftChanged();
};

// ── Editing mode ────────────────────────────────────────────────────────────────
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

const resetWorkoutFormMode = ({ resetForm = false } = {}) => {
  if (resetForm) workoutForm?.reset();
  workoutDraftExercises = [];
  selectedDraftExerciseKey = "";
  workoutUndoStack = [];
  workoutRedoStack = "";
  workoutDraftTextSignature = getWorkoutBlocksInput()?.value || "";
  setWorkoutDraftDirty(false);
  setWorkoutEditingMode(null);
  renderWorkoutPreview();
};

const loadWorkoutForEditing = (workout) => {
  if (!workoutForm || !workout) return;
  currentTemplateId = workout.templateId || "";
  const studentSelect = workoutForm.querySelector("[name='student']");
  const titleInput = workoutForm.querySelector("[name='title']");
  const objectiveInput = workoutForm.querySelector("[name='objective']");
  const levelInput = workoutForm.querySelector("[name='level']");
  const startsAtInput = workoutForm.querySelector("[name='startsAt']");
  const blocksInput = workoutForm.querySelector("[name='blocks']");

  if (studentSelect && MOCK_STUDENTS.some((student) => student.id === workout.studentId)) studentSelect.value = workout.studentId;
  if (titleInput) titleInput.value = workout.title || "Novo treino";
  if (objectiveInput) objectiveInput.value = workout.focus || "";
  if (levelInput) levelInput.value = workout.level || "";
  if (startsAtInput) startsAtInput.value = formatDateForInput(workout.startsAt || workout.updatedAt);
  workoutDraftExercises = (workout.exercises || []).map((exercise, index) => toDraftExercise(exercise, index));
  selectedDraftExerciseKey = workoutDraftExercises[0]?.draftKey || "";
  if (blocksInput) blocksInput.value = workoutDraftExercises.map(exerciseToDraftLine).join("\n");
  workoutDraftTextSignature = blocksInput?.value || "";

  setWorkoutEditingMode(workout);
  setWorkoutDraftDirty(false);
  renderWorkoutPreview();
};

let currentTemplateId = "";

// ── Populate student select ─────────────────────────────────────────────────────
const renderStudentOptions = () => {
  const select = workoutForm?.querySelector("[name='student']");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">Sem aluno — criar conteúdo reutilizável</option>`;
  MOCK_STUDENTS.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    select.appendChild(option);
  });
  if (current && select.querySelector(`option[value="${current}"]`)) select.value = current;
};

// ── Set initial date ────────────────────────────────────────────────────────────
const setInitialDate = () => {
  const startsAtInput = workoutForm?.querySelector("[name='startsAt']");
  if (startsAtInput && !startsAtInput.value) {
    startsAtInput.value = formatDateForInput(new Date());
  }
};

// ── Hydrate icons ───────────────────────────────────────────────────────────────
const hydrateIcons = () => {
  document.querySelectorAll("[data-ui-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.uiIcon, "icon", target.dataset.iconWeight || "light");
  });
};

// ── Initialize ──────────────────────────────────────────────────────────────────
hydrateIcons();
renderStudentOptions();
setInitialDate();
renderWorkoutPreview();

// ── Quick entry ─────────────────────────────────────────────────────────────────
quickEntryButton?.addEventListener("click", () => {
  const input = workoutForm?.elements.namedItem("quickEntry");
  const parsed = parseQuickEntry(input?.value || "", "draft-import");
  if (!parsed.length) {
    showToast("Cole ou digite pelo menos um exercício.");
    input?.focus();
    return;
  }
  pushWorkoutUndo();
  const additions = parsed.map((exercise, index) => toDraftExercise({
    ...exercise, id: `draft-${Date.now()}-${index}`, draftKey: createDraftExerciseKey()
  }, workoutDraftExercises.length + index));
  workoutDraftExercises.push(...additions);
  selectedDraftExerciseKey = additions[0]?.draftKey || selectedDraftExerciseKey;
  input.value = "";
  commitWorkoutDraftMutation({ announce: `${additions.length} ${additions.length === 1 ? "exercício adicionado" : "exercícios adicionados"}.` });
});

// ── Form submit ─────────────────────────────────────────────────────────────────
workoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const title = data.get("title") || "";
  if (!title.trim()) {
    showToast("Informe o nome do treino.");
    return;
  }
  if (!workoutDraftExercises.length) {
    showToast("Informe pelo menos um exercício.");
    return;
  }

  // Local-only: simulate publish
  const published = {
    id: editingWorkoutId || `workout-${Date.now()}`,
    title: title,
    focus: data.get("objective") || "Prescrição personalizada",
    level: data.get("level") || "",
    studentId: data.get("student") || "",
    startsAt: data.get("startsAt") || "",
    exercises: workoutDraftExercises.map(toPublishedExercise),
    updatedAt: new Date().toISOString()
  };

  console.log("[Teste Local] Treino \"publicado\" (local):", published);
  showToast(`Treino "${title}" publicado com sucesso. (Modo local)`);
  setWorkoutDraftDirty(false, "✓ Treino atualizado");
});

// ── Save as template ────────────────────────────────────────────────────────────
saveAsTemplateButton?.addEventListener("click", () => {
  if (!workoutDraftExercises.length) {
    showToast("Adicione pelo menos um exercício antes de criar o modelo.");
    return;
  }
  const name = String(workoutForm?.elements.namedItem("title")?.value || "Modelo sem nome").trim();
  console.log("[Teste Local] Modelo criado (local):", { name, exercises: workoutDraftExercises.map(toPublishedExercise) });
  showToast(`Modelo "${name}" salvo. (Modo local)`);
});

// ── Save draft ──────────────────────────────────────────────────────────────────
saveWorkoutDraftButton?.addEventListener("click", () => {
  showToast("Rascunho preservado neste teste local.");
});

// ── Cancel edit ─────────────────────────────────────────────────────────────────
cancelWorkoutEditButton?.addEventListener("click", () => {
  resetWorkoutFormMode({ resetForm: true });
  showToast("Edição cancelada.");
});

// ── Preview list: click ────────────────────────────────────────────────────────
previewList?.addEventListener("click", (event) => {
  const selectExercise = event.target.closest("[data-select-draft-exercise]");
  if (selectExercise) {
    selectedDraftExerciseKey = selectExercise.dataset.selectDraftExercise;
    renderWorkoutPreview();
    window.setTimeout(() => previewList.querySelector(".training-details input, .training-details textarea")?.focus(), 0);
    return;
  }
  if (event.target.closest("[data-close-training-details]")) {
    selectedDraftExerciseKey = "";
    previewList.querySelector(".training-details")?.classList.add("is-closed");
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

// ── Preview list: submit ────────────────────────────────────────────────────────
previewList?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-workout-insert-form]");
  if (!form) return;
  event.preventDefault();
  const index = Number(form.dataset.workoutInsertForm);
  insertDraftExercise(new FormData(form).get("exercise"), index);
});

// ── Preview list: keydown ───────────────────────────────────────────────────────
previewList?.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
    event.preventDefault();
    const redo = event.key.toLowerCase() === "y" || event.shiftKey;
    applyWorkoutHistory(redo ? workoutRedoStack : workoutUndoStack, redo ? workoutUndoStack : workoutRedoStack);
    return;
  }
  const editable = event.target.closest("[data-draft-exercise-field]");
  if (editable && event.key === "Enter" && !event.shiftKey && editable.tagName !== "TEXTAREA") {
    event.preventDefault();
    const index = findDraftExerciseIndex(editable.dataset.draftExerciseKey);
    const before = snapshotWorkoutDraft();
    const exercise = toDraftExercise({
      id: `draft-${Date.now()}`, draftKey: createDraftExerciseKey(), name: "Novo exercício", sets: 3, reps: "10", rest: "60s"
    }, index + 1);
    workoutUndoStack.push(before);
    workoutRedoStack = [];
    workoutDraftExercises.splice(index + 1, 0, exercise);
    selectedDraftExerciseKey = exercise.draftKey;
    commitWorkoutDraftMutation();
    window.setTimeout(() => previewList.querySelector(`[data-draft-exercise-key="${CSS.escape(exercise.draftKey)}"] .training-grid__name`)?.select(), 0);
    return;
  }
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

// ── Preview list: input ─────────────────────────────────────────────────────────
previewList?.addEventListener("focusin", (event) => {
  if (event.target.closest("[data-draft-exercise-field]")) draftFieldSnapshot = snapshotWorkoutDraft();
});

previewList?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-draft-exercise-field]");
  if (!input) return;
  updateDraftExerciseField(input);
});

// ── Drag and drop (simplified) ──────────────────────────────────────────────────
let activeDrag = null;

const finalizeDrag = ({ cancel = false } = {}) => {
  if (!activeDrag) return;
  const { placeholder, originalIndex, handle } = activeDrag;
  if (!cancel && placeholder?.isConnected) {
    const entries = [...previewList.querySelectorAll(".workout-preview__entry[data-draft-exercise-key]")];
    const targetIndex = entries.indexOf(placeholder);
    if (targetIndex >= 0) {
      moveDraftExercise(handle.dataset.draftDragHandle, targetIndex);
    }
  }
  placeholder?.remove();
  document.body.classList.remove("is-reordering-workout");
  activeDrag = null;
};

previewList?.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-draft-drag-handle]");
  if (!handle || event.button !== 0) return;
  event.preventDefault();
  const entry = handle.closest(".workout-preview__entry");
  if (!entry) return;
  const draftKey = handle.dataset.draftDragHandle;
  const index = findDraftExerciseIndex(draftKey);
  if (index < 0 || workoutDraftExercises.length < 2) return;
  pushWorkoutUndo();
  const placeholder = document.createElement("div");
  placeholder.className = "workout-preview__placeholder";
  placeholder.style.height = `${entry.offsetHeight}px`;
  activeDrag = {
    draftKey,
    handle,
    entry,
    placeholder,
    originalIndex: index,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    pointerId: event.pointerId
  };
  handle.setPointerCapture(event.pointerId);
});

previewList?.addEventListener("pointermove", (event) => {
  if (!activeDrag) return;
  const dx = Math.abs(event.clientX - activeDrag.startX);
  const dy = Math.abs(event.clientY - activeDrag.startY);
  if (!activeDrag.moved && (dx > 4 || dy > 4)) {
    activeDrag.moved = true;
    activeDrag.entry.classList.add("is-dragging");
    document.body.classList.add("is-reordering-workout");
    activeDrag.entry.before(activeDrag.placeholder);
  }
  if (!activeDrag.moved) return;
  const entries = [...previewList.querySelectorAll(".workout-preview__entry[data-draft-exercise-key]")];
  entries.forEach((e) => e.classList.remove("is-settling"));
  const clientY = event.clientY;
  let insertBefore = null;
  for (const e of entries) {
    const rect = e.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      insertBefore = e;
      break;
    }
  }
  if (insertBefore) {
    insertBefore.before(activeDrag.placeholder);
  } else {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) lastEntry.after(activeDrag.placeholder);
  }
});

const handlePointerUp = (event) => {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  activeDrag.entry.classList.remove("is-dragging");
  finalizeDrag({ cancel: !activeDrag.moved });
};

document.addEventListener("pointerup", handlePointerUp);
document.addEventListener("pointercancel", (event) => {
  if (activeDrag?.pointerId === event.pointerId) finalizeDrag({ cancel: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeDrag?.moved) {
    event.preventDefault();
    finalizeDrag({ cancel: true });
  }
});

// ── Load mock workout for testing ───────────────────────────────────────────────
window.__testLoadMockWorkout = () => {
  loadWorkoutForEditing(MOCK_WORKOUTS[0]);
};

window.__testReset = () => {
  resetWorkoutFormMode({ resetForm: true });
};

window.__testAddSampleExercises = () => {
  const textarea = workoutForm?.elements.namedItem("quickEntry");
  if (textarea) {
    textarea.value = "Supino reto 4x10 90s\nCrucifixo 3x12 60s\nTríceps corda 3x15 60s";
    quickEntryButton?.click();
  }
};

document.querySelector("#test-load-mock")?.addEventListener("click", () => window.__testLoadMockWorkout());
document.querySelector("#test-add-sample")?.addEventListener("click", () => window.__testAddSampleExercises());
document.querySelector("#test-reset")?.addEventListener("click", () => window.__testReset());
