const text = (value, fallback = "") => String(value ?? "").trim() || fallback;
const slug = (value, fallback = "item") => text(value, fallback)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

export const BLOCK_TYPES = Object.freeze(["standard", "warmup", "superset", "circuit", "main", "finisher"]);
export const EDITORIAL_STATES = Object.freeze(["draft", "published", "archived"]);
export const TRANSPORT_STATES = Object.freeze(["local", "pending", "synced", "error"]);

export const parsePrescription = (value, fallbackSets = 3, fallbackReps = "10") => {
  const source = text(value);
  const match = source.match(/^\s*(\d+)\s*[x×]\s*(.+?)\s*$/i);
  return {
    sets: Math.max(1, Number.parseInt(match?.[1] || fallbackSets, 10) || fallbackSets),
    reps: text(match?.[2], fallbackReps)
  };
};

export const formatPrescription = (sets, reps) => `${Math.max(1, Number.parseInt(sets, 10) || 1)} x ${text(reps, "10")}`;

export const parseQuickEntryLine = (line, index = 0, namespace = "draft") => {
  const raw = text(line);
  const tabParts = raw.split(/\t+/).map((item) => item.trim()).filter(Boolean);
  let name = raw;
  let sets = 3;
  let reps = "10";
  let rest = "60s";
  if (tabParts.length >= 3 && /^\d+$/.test(tabParts[1])) {
    [name] = tabParts;
    sets = Number(tabParts[1]);
    reps = tabParts[2];
    rest = tabParts[3] || rest;
  } else {
    const match = raw.match(/^(.*?)\s+(\d+)\s*[x×]\s*([^\s]+(?:\s*[-–]\s*[^\s]+)?)(?:\s+(\d+\s*(?:s|sec|min)))?\s*$/i);
    name = text(match?.[1], raw || `Exercício ${index + 1}`);
    sets = Number.parseInt(match?.[2] || "3", 10) || 3;
    reps = text(match?.[3], "10");
    rest = text(match?.[4], "60s").replace(/\s+/g, "");
  }
  return normalizePrescription({
    id: `${namespace}-ex-${String(index + 1).padStart(2, "0")}-${slug(name, "exercicio")}`,
    name, sets, reps, rest
  }, index, namespace);
};

export const parseQuickEntry = (source, namespace = "draft") => text(source)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => parseQuickEntryLine(line, index, namespace));

export const normalizePrescription = (value = {}, index = 0, namespace = "workout") => {
  const parsed = parsePrescription(value.prescription, value.sets || 3, value.reps || "10");
  const blockType = BLOCK_TYPES.includes(value.blockType || value.block_type) ? (value.blockType || value.block_type) : "standard";
  const blockId = text(value.blockId || value.block_id, blockType === "standard" ? "" : `${blockType}-${index + 1}`);
  return {
    ...value,
    id: text(value.id, `${namespace}-ex-${index + 1}`),
    definitionId: text(value.definitionId || value.exercise_definition_id),
    name: text(value.name, `Exercício ${index + 1}`),
    sets: parsed.sets,
    reps: parsed.reps,
    prescription: formatPrescription(parsed.sets, parsed.reps),
    rir: text(value.rir, "2"),
    rpe: text(value.rpe),
    rest: text(value.rest, "60s"),
    load: text(value.load, "0 kg"),
    tempo: text(value.tempo, "2-0-2"),
    target: text(value.target, "Personalizado"),
    notes: text(value.notes),
    instructions: text(value.instructions),
    alternatives: Array.isArray(value.alternatives) ? value.alternatives.map((item) => text(item)).filter(Boolean) : [],
    blockId,
    blockType,
    blockLabel: text(value.blockLabel || value.block_label),
    position: Number.isFinite(Number(value.position)) ? Number(value.position) : index
  };
};

export const normalizeWorkoutDocument = (workout = {}) => ({
  schemaVersion: 2,
  id: text(workout.id, `workout-${Date.now()}`),
  title: text(workout.title, "Novo treino"),
  objective: text(workout.objective || workout.focus),
  level: text(workout.level),
  editorialState: EDITORIAL_STATES.includes(workout.editorialState) ? workout.editorialState : "draft",
  transportState: TRANSPORT_STATES.includes(workout.transportState || workout.syncStatus)
    ? (workout.transportState || workout.syncStatus) : "local",
  revision: Math.max(1, Number.parseInt(workout.revision || workout.version || 1, 10) || 1),
  templateId: text(workout.templateId || workout.template_id),
  programAssignmentId: text(workout.programAssignmentId || workout.program_assignment_id),
  exercises: (Array.isArray(workout.exercises) ? workout.exercises : [])
    .map((exercise, index) => normalizePrescription(exercise, index, workout.id || "workout"))
});

export const createRevisionSnapshot = (workout = {}) => {
  const document = normalizeWorkoutDocument(workout);
  return {
    schemaVersion: document.schemaVersion,
    title: document.title,
    objective: document.objective,
    level: document.level,
    templateId: document.templateId || null,
    programAssignmentId: document.programAssignmentId || null,
    exercises: document.exercises.map((exercise) => ({ ...exercise }))
  };
};

export const cloneTrainingDocument = (value) => JSON.parse(JSON.stringify(value));
