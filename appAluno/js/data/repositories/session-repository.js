import { Platform } from "../../core/platform.js?v=build-20260809-6";
import { getSupabase } from "../../core/supabase.js?v=build-20260809-6";
import { authRepository } from "./auth-repository.js?v=build-20260809-6";

export const WORKOUT_SESSIONS_KEY = "flowfit.workout-sessions";

const SESSIONS_TABLE = "workout_sessions";
const SET_LOGS_TABLE = "workout_set_logs";
const FEEDBACK_TABLE = "workout_feedback";

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeDate = (value, fallback = new Date().toISOString()) => {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
};

const readCachedSessions = () => {
  const items = Platform.storage.get(WORKOUT_SESSIONS_KEY, []);
  return Array.isArray(items) ? items : [];
};

const writeCachedSessions = (sessions) => Platform.storage.set(WORKOUT_SESSIONS_KEY, sessions);

const normalizeSetLog = (log = {}, index = 0, sessionId = "session") => {
  const completedSets = normalizeNumber(log.completedSets);
  const loadKg = normalizeNumber(log.loadKg);
  const reps = normalizeNumber(log.reps);

  return {
    id: normalizeText(log.id, `${sessionId}-set-${String(index + 1).padStart(2, "0")}`),
    sessionId: normalizeText(log.sessionId, sessionId),
    coachId: normalizeText(log.coachId),
    workoutId: normalizeText(log.workoutId),
    exerciseId: normalizeText(log.exerciseId),
    position: normalizeNumber(log.position, index),
    exerciseName: normalizeText(log.exerciseName, `Exercício ${index + 1}`),
    target: normalizeText(log.target, "Personalizado"),
    prescription: normalizeText(log.prescription),
    plannedSets: normalizeNumber(log.plannedSets),
    completedSets,
    loadKg,
    reps,
    volumeKg: normalizeNumber(log.volumeKg, completedSets * loadKg * reps),
    rir: normalizeText(log.rir),
    notes: normalizeText(log.notes)
  };
};

const normalizeFeedback = (feedback = {}, sessionId = "session") => ({
  id: normalizeText(feedback.id, `${sessionId}-feedback`),
  sessionId: normalizeText(feedback.sessionId, sessionId),
  coachId: normalizeText(feedback.coachId),
  studentId: normalizeText(feedback.studentId),
  effort: normalizeText(feedback.effort, "ok"),
  pain: normalizeText(feedback.pain, "none"),
  note: normalizeText(feedback.note)
});

export const normalizeWorkoutSession = (session = {}) => {
  const id = normalizeText(session.id, `session-${Date.now()}`);
  const finishedAt = normalizeDate(session.finishedAt);
  const feedback = normalizeFeedback(session.feedback, id);
  const setLogs = Array.isArray(session.setLogs)
    ? session.setLogs.map((log, index) => normalizeSetLog(log, index, id))
    : [];

  return {
    id,
    coachId: normalizeText(session.coachId),
    studentId: normalizeText(session.studentId),
    studentKey: normalizeText(session.studentKey),
    studentEmail: normalizeText(session.studentEmail),
    workoutId: normalizeText(session.workoutId),
    workoutCode: normalizeText(session.workoutCode, "A"),
    workoutTitle: normalizeText(session.workoutTitle, "Treino"),
    workoutVersion: Math.max(1, normalizeNumber(session.workoutVersion, 1)),
    status: normalizeText(session.status, "completed"),
    totalSets: normalizeNumber(session.totalSets),
    completedSets: normalizeNumber(session.completedSets),
    volumeKg: normalizeNumber(session.volumeKg),
    durationSeconds: normalizeNumber(session.durationSeconds),
    startedAt: normalizeDate(session.startedAt, finishedAt),
    finishedAt,
    syncStatus: normalizeText(session.syncStatus, "local"),
    syncMessage: normalizeText(session.syncMessage),
    feedback,
    setLogs
  };
};

const toSessionRow = (session) => ({
  id: session.id,
  coach_id: session.coachId,
  student_id: session.studentId || null,
  student_key: session.studentKey,
  student_email: session.studentEmail || null,
  workout_id: session.workoutId || null,
  workout_code: session.workoutCode,
  workout_title: session.workoutTitle,
  workout_version: session.workoutVersion,
  status: session.status,
  total_sets: session.totalSets,
  completed_sets: session.completedSets,
  volume_kg: session.volumeKg,
  duration_seconds: session.durationSeconds,
  started_at: session.startedAt,
  finished_at: session.finishedAt,
  updated_at: new Date().toISOString()
});

const toSetLogRow = (log, session) => ({
  id: log.id,
  session_id: session.id,
  coach_id: session.coachId,
  workout_id: session.workoutId || null,
  exercise_id: log.exerciseId || null,
  position: log.position,
  exercise_name: log.exerciseName,
  target: log.target,
  prescription: log.prescription,
  planned_sets: log.plannedSets,
  completed_sets: log.completedSets,
  load_kg: log.loadKg,
  reps: log.reps,
  volume_kg: log.volumeKg,
  rir: log.rir,
  notes: log.notes
});

const toFeedbackRow = (feedback, session) => ({
  id: feedback.id,
  session_id: session.id,
  coach_id: session.coachId,
  student_id: session.studentId || null,
  effort: feedback.effort,
  pain: feedback.pain,
  note: feedback.note
});

const fromRows = (row, setLogs = [], feedback = null) => normalizeWorkoutSession({
  id: row.id,
  coachId: row.coach_id,
  studentId: row.student_id,
  studentKey: row.student_key,
  studentEmail: row.student_email,
  workoutId: row.workout_id,
  workoutCode: row.workout_code,
  workoutTitle: row.workout_title,
  workoutVersion: row.workout_version,
  status: row.status,
  totalSets: row.total_sets,
  completedSets: row.completed_sets,
  volumeKg: row.volume_kg,
  durationSeconds: row.duration_seconds,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  syncStatus: "synced",
  feedback: feedback ? {
    id: feedback.id,
    sessionId: feedback.session_id,
    coachId: feedback.coach_id,
    studentId: feedback.student_id,
    effort: feedback.effort,
    pain: feedback.pain,
    note: feedback.note
  } : null,
  setLogs: setLogs.map((log) => ({
    id: log.id,
    sessionId: log.session_id,
    coachId: log.coach_id,
    workoutId: log.workout_id,
    exerciseId: log.exercise_id,
    position: log.position,
    exerciseName: log.exercise_name,
    target: log.target,
    prescription: log.prescription,
    plannedSets: log.planned_sets,
    completedSets: log.completed_sets,
    loadKg: log.load_kg,
    reps: log.reps,
    volumeKg: log.volume_kg,
    rir: log.rir,
    notes: log.notes
  }))
});

const upsertLocalSession = (session) => {
  const normalized = normalizeWorkoutSession(session);
  const next = [
    normalized,
    ...readCachedSessions().filter((item) => item?.id !== normalized.id)
  ]
    .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0))
    .slice(0, 80);
  writeCachedSessions(next);
  return normalized;
};

export const sessionRepository = {
  listCachedSessions() {
    return readCachedSessions().map(normalizeWorkoutSession);
  },

  saveLocalSession(session) {
    return upsertLocalSession(session);
  },

  async syncSession(session) {
    const normalized = upsertLocalSession({
      ...session,
      syncStatus: "pending",
      syncMessage: "Enviando para o professor."
    });
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authContext?.user) {
      const local = upsertLocalSession({
        ...normalized,
        syncStatus: "local",
        syncMessage: "Sua sessão expirou. O treino ficou salvo neste aparelho."
      });
      return { synced: false, reason: "not-authenticated", session: local };
    }

    try {
      const { error: sessionError } = await client
        .from(SESSIONS_TABLE)
        .upsert(toSessionRow(normalized), { onConflict: "id" });
      if (sessionError) throw sessionError;

      const rows = normalized.setLogs.map((log) => toSetLogRow(log, normalized));
      if (rows.length) {
        const { error: setError } = await client
          .from(SET_LOGS_TABLE)
          .upsert(rows, { onConflict: "id" });
        if (setError) throw setError;
      }

      const { error: feedbackError } = await client
        .from(FEEDBACK_TABLE)
        .upsert(toFeedbackRow(normalized.feedback, normalized), { onConflict: "id" });
      if (feedbackError) throw feedbackError;

      const synced = upsertLocalSession({
        ...normalized,
        syncStatus: "synced",
        syncMessage: "Treino enviado ao professor."
      });
      return { synced: true, session: synced };
    } catch (error) {
      const failed = upsertLocalSession({
        ...normalized,
        syncStatus: "failed",
        syncMessage: error?.message || "Não foi possível enviar o treino ao professor."
      });
      return { synced: false, error, session: failed };
    }
  },

  async syncPendingSessions({ studentId = "", coachId = "" } = {}) {
    const resolvedStudentId = normalizeText(studentId);
    const resolvedCoachId = normalizeText(coachId);
    if (!resolvedStudentId || !resolvedCoachId) {
      return { syncedCount: 0, failedCount: 0, sessions: [] };
    }

    const pending = this.listCachedSessions().filter((session) => (
      session.syncStatus !== "synced"
      && session.studentId === resolvedStudentId
      && session.coachId === resolvedCoachId
    ));
    const sessions = [];
    let syncedCount = 0;

    for (const session of pending) {
      const result = await this.syncSession(session);
      if (result.session) sessions.push(result.session);
      if (result.synced) syncedCount += 1;
    }

    return {
      syncedCount,
      failedCount: Math.max(0, pending.length - syncedCount),
      sessions
    };
  },

  async fetchCoachSessions({ studentId = "", limit = 80 } = {}) {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    const localSessions = this.listCachedSessions();
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
      return { synced: false, reason: "not-authenticated-as-coach", sessions: localSessions };
    }

    try {
      let query = client
        .from(SESSIONS_TABLE)
        .select("*")
        .eq("coach_id", authContext.coachId)
        .order("finished_at", { ascending: false })
        .limit(limit);
      if (studentId) query = query.eq("student_id", studentId);

      const { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      const ids = (sessionsData || []).map((session) => session.id);
      if (!ids.length) return { synced: true, sessions: [] };

      const [{ data: logsData, error: logsError }, { data: feedbackData, error: feedbackError }] = await Promise.all([
        client.from(SET_LOGS_TABLE).select("*").in("session_id", ids).order("position", { ascending: true }),
        client.from(FEEDBACK_TABLE).select("*").in("session_id", ids)
      ]);
      if (logsError) throw logsError;
      if (feedbackError) throw feedbackError;

      const logsBySession = new Map();
      (logsData || []).forEach((log) => {
        const items = logsBySession.get(log.session_id) || [];
        items.push(log);
        logsBySession.set(log.session_id, items);
      });
      const feedbackBySession = new Map((feedbackData || []).map((feedback) => [feedback.session_id, feedback]));
      const sessions = (sessionsData || []).map((session) => fromRows(
        session,
        logsBySession.get(session.id) || [],
        feedbackBySession.get(session.id) || null
      ));
      return { synced: true, sessions };
    } catch (error) {
      return { synced: false, error, sessions: localSessions };
    }
  }
};
