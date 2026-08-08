import { Platform } from "../../core/platform.js";
import { getSupabase } from "../../core/supabase.js";
import { DEMO_COACH_ID } from "../../config.js";
import { authRepository } from "./auth-repository.js";

export const PUBLISHED_WORKOUTS_KEY = "flowfit.published-workouts";

const STUDENTS_TABLE = "students";
const PLANS_TABLE = "workout_plans";
const EXERCISES_TABLE = "workout_exercises";
const CLOUD_WORKOUT_SELECT = `
  id,
  coach_id,
  student_id,
  student_key,
  owner,
  code,
  title,
  focus,
  estimated_minutes,
  last_done_label,
  source,
  status,
  starts_at,
  published_at,
  version,
  updated_at,
  workout_exercises (
    id,
    position,
    name,
    target,
    prescription,
    load,
    rest,
    tempo,
    rir,
    notes,
    updated_at
  )
`;

const LEGACY_CLOUD_WORKOUT_SELECT = `
  id,
  coach_id,
  student_id,
  student_key,
  owner,
  code,
  title,
  focus,
  estimated_minutes,
  last_done_label,
  source,
  status,
  updated_at,
  workout_exercises (
    id,
    position,
    name,
    target,
    prescription,
    load,
    rest,
    tempo,
    rir,
    notes,
    updated_at
  )
`;

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

const normalizeIsoDate = (value, fallback = new Date().toISOString()) => {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
};

const isMissingWorkoutScheduleColumn = (error) => {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return ["starts_at", "published_at", "version"].some((column) => message.includes(column));
};

const initialsFromName = (name) => normalizeText(name, "Aluno")
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase() || "AL";

const fallbackStudentIdFromKey = (studentKey) => `student-${studentKey}`;

const normalizeExercise = (exercise, index = 0, workoutId = "workout") => ({
  ...DEFAULT_EXERCISE,
  ...exercise,
  id: normalizeText(exercise?.id, `${workoutId}-ex-${String(index + 1).padStart(2, "0")}`),
  name: normalizeText(exercise?.name, `Exercício ${index + 1}`),
  prescription: normalizeText(exercise?.prescription, "3 x 10")
});

const normalizeWorkout = (workout) => {
  const owner = normalizeText(workout?.owner, "Aluno");
  const studentKey = normalizeText(workout?.studentKey, studentKeyFromName(owner));
  const updatedAt = normalizeText(workout?.updatedAt, new Date().toISOString());
  const startsAt = normalizeIsoDate(workout?.startsAt, updatedAt);
  const id = normalizeText(workout?.id, `published-${Date.now()}`);
  const studentId = normalizeText(workout?.studentId, fallbackStudentIdFromKey(studentKey));
  const exercises = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise, index) => normalizeExercise(exercise, index, id))
    : [];

  return {
    id,
    coachId: normalizeText(workout?.coachId, DEMO_COACH_ID),
    code: normalizeText(workout?.code, "A"),
    title: normalizeText(workout?.title, "Novo treino"),
    focus: normalizeText(workout?.focus, "Prescrição personalizada"),
    estimatedMinutes: Number(workout?.estimatedMinutes || 45),
    lastDoneLabel: normalizeText(workout?.lastDoneLabel, "novo"),
    owner,
    studentId,
    studentKey,
    source: normalizeText(workout?.source, "professor"),
    status: normalizeText(workout?.status, "published"),
    startsAt,
    publishedAt: normalizeIsoDate(workout?.publishedAt, updatedAt),
    version: Math.max(1, Number.parseInt(workout?.version || "1", 10) || 1),
    syncStatus: normalizeText(workout?.syncStatus, "local"),
    syncMessage: normalizeText(workout?.syncMessage, ""),
    updatedAt,
    exercises
  };
};

const mergeWorkoutLists = (...lists) => {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach((item) => {
    const workout = normalizeWorkout(item);
    const previous = merged.get(workout.id);
    if (!previous || new Date(workout.updatedAt) >= new Date(previous.updatedAt)) merged.set(workout.id, workout);
  });
  return [...merged.values()]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 40);
};

export const parseExerciseLine = (line, index = 0, workoutId = "workout") => {
  const raw = normalizeText(line);
  const match = raw.match(/^(.*?)\s+(\d+)\s*x\s*(.+)$/i);
  const name = normalizeText(match?.[1], raw || `Exercício ${index + 1}`);
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

export const createWorkoutFromProfessorForm = ({ student, studentName, studentId, studentKey, coachId, title, template, blocks, workoutId, startsAt, version = 1 }) => {
  const owner = normalizeText(student?.name || studentName, "Aluno");
  const resolvedStudentKey = normalizeText(student?.studentKey || studentKey, studentKeyFromName(owner));
  const resolvedStudentId = normalizeText(student?.id || studentId, fallbackStudentIdFromKey(resolvedStudentKey));
  const workoutTitle = normalizeText(title, "Novo treino");
  const sourceLines = String(blocks ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!sourceLines.length) sourceLines.push("Exercício livre 3x10");
  const id = normalizeText(workoutId, `published-${Date.now()}`);
  const now = new Date().toISOString();
  const exercises = sourceLines.map((line, index) => parseExerciseLine(line, index, id));

  return {
    id,
    coachId: normalizeText(student?.coachId || coachId, DEMO_COACH_ID),
    code: workoutTitle.match(/\bTreino\s+([A-Z0-9])/i)?.[1]?.toUpperCase() || "A",
    title: workoutTitle.replace(/^Treino\s+[A-Z0-9]\s*-\s*/i, ""),
    focus: normalizeText(template, "Prescrição personalizada"),
    estimatedMinutes: Math.max(28, exercises.length * 7),
    lastDoneLabel: "novo",
    owner,
    studentId: resolvedStudentId,
    studentKey: resolvedStudentKey,
    source: "professor",
    status: "published",
    startsAt: normalizeIsoDate(startsAt, now),
    publishedAt: now,
    version: Math.max(1, Number.parseInt(version, 10) || 1),
    syncStatus: "pending",
    syncMessage: "Aguardando sincronização.",
    updatedAt: now,
    exercises
  };
};

const toStudentRow = (workout, student = {}) => ({
  id: workout.studentId,
  coach_id: workout.coachId,
  student_key: workout.studentKey,
  email: student.email || null,
  name: workout.owner,
  initials: student.initials || initialsFromName(workout.owner),
  goal: student.goal || "Hipertrofia",
  status: student.status || "Ativo",
  plan: student.plan || "Atendimento",
  workout: `Treino ${workout.code} - ${workout.title}`,
  adherence: student.adherence || 0,
  next_action: "Ver treino publicado",
  updated_at: workout.updatedAt
});

const toWorkoutPlanRow = (workout, authContext) => ({
  id: workout.id,
  coach_id: authContext?.coachId || workout.coachId,
  student_id: workout.studentId,
  student_key: workout.studentKey,
  owner: workout.owner,
  code: workout.code,
  title: workout.title,
  focus: workout.focus,
  estimated_minutes: workout.estimatedMinutes,
  last_done_label: workout.lastDoneLabel,
  source: workout.source,
  status: workout.status,
  starts_at: workout.startsAt,
  published_at: workout.publishedAt,
  version: workout.version,
  updated_at: workout.updatedAt
});

const toLegacyWorkoutPlanRow = (workout, authContext) => {
  const { starts_at, published_at, version, ...legacyRow } = toWorkoutPlanRow(workout, authContext);
  return legacyRow;
};

const toExerciseRows = (workout, authContext) => workout.exercises.map((exercise, index) => ({
  id: exercise.id,
  workout_id: workout.id,
  coach_id: authContext?.coachId || workout.coachId,
  position: index,
  name: exercise.name,
  target: exercise.target,
  prescription: exercise.prescription,
  load: exercise.load,
  rest: exercise.rest,
  tempo: exercise.tempo,
  rir: exercise.rir,
  notes: exercise.notes,
  updated_at: workout.updatedAt
}));

const toAppWorkout = (row) => normalizeWorkout({
  id: row.id,
  coachId: row.coach_id,
  code: row.code,
  title: row.title,
  focus: row.focus,
  estimatedMinutes: row.estimated_minutes,
  lastDoneLabel: row.last_done_label,
  owner: row.owner,
  studentId: row.student_id,
  studentKey: row.student_key,
  source: row.source,
  status: row.status,
  startsAt: row.starts_at,
  publishedAt: row.published_at,
  version: row.version,
  syncStatus: "synced",
  updatedAt: row.updated_at,
  exercises: [...(row.workout_exercises || [])]
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      target: exercise.target,
      prescription: exercise.prescription,
      load: exercise.load,
      rest: exercise.rest,
      tempo: exercise.tempo,
      rir: exercise.rir,
      notes: exercise.notes
    }))
});

export const workoutRepository = {
  listPublishedWorkouts() {
    return readPublishedWorkouts()
      .filter((workout) => workout?.id && workout?.studentKey && Array.isArray(workout.exercises))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  },

  savePublishedWorkout(workout) {
    const current = this.listPublishedWorkouts();
    const next = mergeWorkoutLists(workout, current);
    writePublishedWorkouts(next);
    return next.find((item) => item.id === workout.id) || normalizeWorkout(workout);
  },

  getLatestWorkoutForStudent(studentName) {
    const studentKey = studentKeyFromName(studentName);
    const now = Date.now();
    return this.listPublishedWorkouts()
      .filter((workout) => new Date(workout.startsAt || workout.updatedAt || 0).getTime() <= now)
      .find((workout) => workout.studentKey === studentKey) || null;
  },

  async syncPublishedWorkout(workout, linkedStudent = {}) {
    const authContext = await authRepository.getAuthContext();
    const normalized = this.savePublishedWorkout({
      ...workout,
      coachId: authContext?.coachId || workout?.coachId,
      syncStatus: "pending",
      syncMessage: "Aguardando sincronização."
    });
    const client = await getSupabase();
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
      const pending = this.savePublishedWorkout({
        ...normalized,
        syncStatus: "local",
        syncMessage: "Entre como professor para enviar este treino ao aluno."
      });
      return { synced: false, reason: "not-authenticated-as-coach", workout: pending };
    }

    try {
      const { data, error } = await client.rpc("publish_student_workout", {
        p_workout: toWorkoutPlanRow(normalized, authContext),
        p_exercises: toExerciseRows(normalized, authContext)
      });
      if (error || !data || Number(data.exercise_count || 0) !== normalized.exercises.length) {
        const verificationError = error || new Error("O Supabase não confirmou todos os exercícios do treino.");
        const failed = this.savePublishedWorkout({
          ...normalized,
          syncStatus: "failed",
          syncMessage: verificationError.message || "Não foi possível publicar o treino por completo."
        });
        return { synced: false, error: verificationError, workout: failed };
      }

      const confirmedWorkout = this.savePublishedWorkout({
        ...normalized,
        syncStatus: "synced",
        syncMessage: "Plano e exercícios confirmados pelo Supabase.",
        updatedAt: data.updated_at || normalized.updatedAt
      });
      return { synced: true, workout: confirmedWorkout, partial: false, confirmation: data };

      /* Compatibilidade historica removida da execucao: a RPC acima substitui
         as tres gravacoes independentes e garante rollback automatico.
      const { error: studentError } = await client
        .from(STUDENTS_TABLE)
        .upsert(toStudentRow(normalized, linkedStudent), { onConflict: "id" });
      if (studentError) {
        const failed = this.savePublishedWorkout({
          ...normalized,
          syncStatus: "failed",
          syncMessage: studentError.message || "Não foi possível atualizar o aluno antes do treino."
        });
        return { synced: false, error: studentError, workout: failed };
      }

      const { error: planError } = await client
        .from(PLANS_TABLE)
        .upsert(toWorkoutPlanRow(normalized, authContext), { onConflict: "id" });
      if (planError) {
        if (!isMissingWorkoutScheduleColumn(planError)) {
          const failed = this.savePublishedWorkout({
            ...normalized,
            syncStatus: "failed",
            syncMessage: planError.message || "Não foi possível sincronizar o treino."
          });
          return { synced: false, error: planError, workout: failed };
        }

        const { error: legacyPlanError } = await client
          .from(PLANS_TABLE)
          .upsert(toLegacyWorkoutPlanRow(normalized, authContext), { onConflict: "id" });
        if (legacyPlanError) {
          const failed = this.savePublishedWorkout({
            ...normalized,
            syncStatus: "failed",
            syncMessage: legacyPlanError.message || "Não foi possível sincronizar o treino."
          });
          return { synced: false, error: legacyPlanError, workout: failed };
        }
      }

      const { error: deleteError } = await client
        .from(EXERCISES_TABLE)
        .delete()
        .eq("workout_id", normalized.id)
        .eq("coach_id", authContext.coachId);
      if (deleteError) {
        const failed = this.savePublishedWorkout({
          ...normalized,
          syncStatus: "failed",
          syncMessage: deleteError.message || "Não foi possível substituir os exercícios antigos."
        });
        return { synced: false, error: deleteError, workout: failed };
      }

      const exerciseRows = toExerciseRows(normalized, authContext);
      if (exerciseRows.length) {
        const { error: exercisesError } = await client
          .from(EXERCISES_TABLE)
          .upsert(exerciseRows, { onConflict: "id" });
        if (exercisesError) {
          const failed = this.savePublishedWorkout({
            ...normalized,
            syncStatus: "failed",
            syncMessage: exercisesError.message || "Não foi possível enviar os exercícios."
          });
          return { synced: false, error: exercisesError, workout: failed };
        }
      }

      const syncedWorkout = this.savePublishedWorkout({
        ...normalized,
        syncStatus: "synced",
        syncMessage: isMissingWorkoutScheduleColumn(planError)
          ? "Sincronizado sem agendamento. Rode o SQL novo para salvar data e versão."
          : "Sincronizado com o aluno."
      });
      return { synced: true, workout: syncedWorkout, partial: isMissingWorkoutScheduleColumn(planError) };
      */
    } catch (error) {
      const failed = this.savePublishedWorkout({
        ...normalized,
        syncStatus: "failed",
        syncMessage: error?.message || "Não foi possível sincronizar o treino."
      });
      return { synced: false, error, workout: failed };
    }
  },

  async fetchPublishedWorkouts({ studentId = "", coachId = "" } = {}) {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    const resolvedCoachId = String(coachId || (authRepository.canWriteAsCoach(authContext) ? authContext.coachId : "")).trim();
    const resolvedStudentId = String(studentId || "").trim();
    const localWorkouts = this.listPublishedWorkouts().filter((workout) => (
      (!resolvedCoachId || workout.coachId === resolvedCoachId)
      && (!resolvedStudentId || workout.studentId === resolvedStudentId)
    ));
    if (!client || !authContext?.user) return { synced: false, reason: "not-authenticated", workouts: localWorkouts };
    if (authRepository.canAccessStudent(authContext) && !authRepository.canAccessCoach(authContext) && (!resolvedCoachId || !resolvedStudentId)) {
      return { synced: false, reason: "student-scope-required", workouts: [] };
    }

    try {
      const runQuery = (selectColumns) => {
        let query = client
        .from(PLANS_TABLE)
        .select(selectColumns)
        .eq("status", "published")
        .order("updated_at", { ascending: false });

        if (resolvedCoachId) query = query.eq("coach_id", resolvedCoachId);
        if (resolvedStudentId) query = query.eq("student_id", resolvedStudentId);
        return query;
      };

      let { data, error } = await runQuery(CLOUD_WORKOUT_SELECT);
      if (error && isMissingWorkoutScheduleColumn(error)) {
        ({ data, error } = await runQuery(LEGACY_CLOUD_WORKOUT_SELECT));
      }

      if (error) return { synced: false, error, workouts: localWorkouts };

      const cloudWorkouts = (data || []).map(toAppWorkout);
      const unrelatedLocal = this.listPublishedWorkouts().filter((workout) => (
        (resolvedCoachId && workout.coachId !== resolvedCoachId)
        || (resolvedStudentId && workout.studentId !== resolvedStudentId)
      ));
      writePublishedWorkouts(mergeWorkoutLists(cloudWorkouts, unrelatedLocal));
      return { synced: true, workouts: cloudWorkouts };
    } catch (error) {
      return { synced: false, error, workouts: localWorkouts };
    }
  },

  async fetchLatestWorkoutForStudent(studentName) {
    const result = await this.fetchPublishedWorkouts();
    return {
      ...result,
      workout: this.getLatestWorkoutForStudent(studentName)
    };
  },

  async fetchWorkoutsForCurrentStudent(student) {
    if (!student?.id || !student?.coachId) return { synced: false, reason: "student-scope-required", workouts: [] };
    const result = await this.fetchPublishedWorkouts({ studentId: student.id, coachId: student.coachId });
    const now = Date.now();
    const workouts = (result.workouts || [])
      .filter((item) => item.status === "published")
      .filter((item) => new Date(item.startsAt || item.updatedAt || 0).getTime() <= now)
      .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })
        || a.title.localeCompare(b.title, "pt-BR")
        || new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0));
    return { ...result, workouts };
  },

  async archivePublishedWorkout(workoutId) {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authRepository.canWriteAsCoach(authContext) || !workoutId) {
      return { archived: false, reason: "not-authenticated-as-coach" };
    }
    try {
      const { data, error } = await client
        .from(PLANS_TABLE)
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", workoutId)
        .eq("coach_id", authContext.coachId)
        .select("id, status, updated_at")
        .single();
      if (error || data?.status !== "archived") return { archived: false, error };
      writePublishedWorkouts(this.listPublishedWorkouts().filter((workout) => workout.id !== workoutId));
      return { archived: true, workoutId, updatedAt: data.updated_at };
    } catch (error) {
      return { archived: false, error };
    }
  },

  async fetchLatestWorkoutForCurrentStudent(student) {
    const result = await this.fetchWorkoutsForCurrentStudent(student);
    return { ...result, workout: result.workouts?.[0] || null };
  }
};
