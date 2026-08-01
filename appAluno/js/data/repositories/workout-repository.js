import { Platform } from "../../core/platform.js";

export const PUBLISHED_WORKOUTS_KEY = "flowfit.published-workouts";

const DEFAULT_EXERCISE = {
  target: "Personalizado",
  load: "0 kg",
  rest: "60s",
  tempo: "2-0-2",
  rir: "2",
  notes: "Criado no painel do professor."
};

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

export const studentKeyFromName = (name) => normalizeText(name, "aluno")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "aluno";

const slugFromText = (value, fallback = "exercicio") => studentKeyFromName(normalizeText(value, fallback));

const normalizePrescription = (sets, reps) => `${sets} x ${normalizeText(reps, "10")}`;

export const parseExerciseLine = (line, index = 0, workoutId = "workout") => {
  const raw = normalizeText(line);
  const match = raw.match(/^(.*?)\s+(\d+)\s*x\s*(.+)$/i);
  const name = normalizeText(match?.[1], raw || `Exercicio ${index + 1}`);
  const sets = Number.parseInt(match?.[2] || "3", 10) || 3;
  const reps = normalizeText(match?.[3], "10");

  return {
    ...DEFAULT_EXERCISE,
    id: `${workoutId}-ex-${String(index + 1).padStart(2, "0")}-${slugFromText(name)}`,
    name,
    prescription: normalizePrescription(sets, reps)
  };
};

const readPublishedWorkouts = () => {
  const items = Platform.storage.get(PUBLISHED_WORKOUTS_KEY, []);
  return Array.isArray(items) ? items : [];
};

const writePublishedWorkouts = (items) => Platform.storage.set(PUBLISHED_WORKOUTS_KEY, items);

export const createWorkoutFromProfessorForm = ({ studentName, title, template, blocks }) => {
  const owner = normalizeText(studentName, "Aluno");
  const workoutTitle = normalizeText(title, "Novo treino");
  const sourceLines = String(blocks ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!sourceLines.length) sourceLines.push("Exercicio livre 3x10");
  const id = `published-${Date.now()}`;
  const exercises = sourceLines.map((line, index) => parseExerciseLine(line, index, id));

  return {
    id,
    code: workoutTitle.match(/\bTreino\s+([A-Z0-9])/i)?.[1]?.toUpperCase() || "A",
    title: workoutTitle.replace(/^Treino\s+[A-Z0-9]\s*-\s*/i, ""),
    focus: normalizeText(template, "Prescricao personalizada"),
    estimatedMinutes: Math.max(28, exercises.length * 7),
    lastDoneLabel: "novo",
    owner,
    studentKey: studentKeyFromName(owner),
    source: "professor",
    status: "published",
    updatedAt: new Date().toISOString(),
    exercises
  };
};

export const workoutRepository = {
  listPublishedWorkouts() {
    return readPublishedWorkouts()
      .filter((workout) => workout?.id && workout?.studentKey && Array.isArray(workout.exercises))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  },

  savePublishedWorkout(workout) {
    const current = this.listPublishedWorkouts();
    const next = [workout, ...current.filter((item) => item.id !== workout.id)].slice(0, 40);
    writePublishedWorkouts(next);
    return workout;
  },

  getLatestWorkoutForStudent(studentName) {
    const studentKey = studentKeyFromName(studentName);
    return this.listPublishedWorkouts().find((workout) => workout.studentKey === studentKey) || null;
  }
};
