import { Platform } from "../../core/platform.js?v=build-20260813-1";
import { getSupabase } from "../../core/supabase.js?v=build-20260812-5";
import { authRepository } from "./auth-repository.js?v=build-20260812-5";

export const WORKOUT_SESSIONS_KEY = "flowfit.workout-sessions";
const SCOPED_SESSIONS_PREFIX = `${WORKOUT_SESSIONS_KEY}:`;

const SESSIONS_TABLE = "workout_sessions";
const SET_LOGS_TABLE = "workout_set_logs";
const FEEDBACK_TABLE = "workout_feedback";
const LEGACY_SESSION_SELECT = "id, coach_id, student_id, student_key, student_email, workout_id, workout_code, workout_title, workout_version, status, total_sets, completed_sets, volume_kg, duration_seconds, started_at, finished_at, updated_at";
const SESSION_SELECT = `${LEGACY_SESSION_SELECT}, workout_revision_id, prescription_snapshot`;
const SET_LOG_SELECT = "id, session_id, coach_id, workout_id, exercise_id, workout_exercise_id, position, exercise_name, target, prescription, planned_sets, completed_sets, load_kg, reps, volume_kg, rir, notes, set_number, set_kind, completed_at, discomfort, discomfort_note";
const FEEDBACK_SELECT = "id, session_id, coach_id, student_id, effort, pain, note";

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

const encodeScopePart = (value) => encodeURIComponent(normalizeText(value, "unknown"));
const scopedCacheKey = ({ studentId = "", coachId = "" } = {}) => (
  `${SCOPED_SESSIONS_PREFIX}${encodeScopePart(coachId)}:${encodeScopePart(studentId)}`
);

const readLegacySessions = () => {
  const items = Platform.storage.get(WORKOUT_SESSIONS_KEY, []);
  return Array.isArray(items) ? items : [];
};

const writeScopedSessions = (scope, sessions) => Platform.storage.set(scopedCacheKey(scope), sessions);

const matchesScope = (session, { studentId = "", coachId = "" } = {}) => (
  (!studentId || session.studentId === studentId)
  && (!coachId || session.coachId === coachId)
);

const readCachedSessions = (scope = {}) => {
  const studentId = normalizeText(scope.studentId);
  const coachId = normalizeText(scope.coachId);
  if (!studentId && !coachId) return [];

  const keys = coachId
    ? Platform.storage.keys(`${SCOPED_SESSIONS_PREFIX}${encodeScopePart(coachId)}:`)
    : [];
  const exactKey = studentId && coachId ? scopedCacheKey({ studentId, coachId }) : "";
  const scopedItems = (exactKey ? [exactKey] : keys)
    .flatMap((key) => {
      const value = Platform.storage.get(key, []);
      return Array.isArray(value) ? value : [];
    })
    .filter((session) => matchesScope(session, { studentId, coachId }));

  // Migra somente os registros legados que pertencem ao escopo autenticado.
  // O cache legado nunca é retornado sem um studentId/coachId explícito.
  const legacyItems = readLegacySessions()
    .filter((session) => matchesScope(session, { studentId, coachId }));
  if (legacyItems.length) {
    const grouped = new Map();
    [...scopedItems, ...legacyItems].forEach((session) => {
      const key = scopedCacheKey({ studentId: session.studentId, coachId: session.coachId });
      const list = grouped.get(key) || [];
      grouped.set(key, [session, ...list.filter((item) => item?.id !== session?.id)]);
    });
    grouped.forEach((sessions, key) => Platform.storage.set(key, sessions.slice(0, 80)));
  }

  return [...scopedItems, ...legacyItems]
    .reduce((items, session) => items.some((item) => item?.id === session?.id)
      ? items
      : [...items, session], [])
    .map(normalizeWorkoutSession)
    .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));
};

const normalizeSetLog = (log = {}, index = 0, sessionId = "session") => {
  const rawSetNumber = log.setNumber ?? log.set_number;
  const setNumber = rawSetNumber === null || rawSetNumber === undefined || rawSetNumber === ""
    ? null
    : Math.max(1, normalizeNumber(rawSetNumber, 1));
  const completedSets = normalizeNumber(log.completedSets, setNumber ? 1 : 0);
  const loadKg = normalizeNumber(log.loadKg);
  const reps = normalizeNumber(log.reps);

  return {
    id: normalizeText(log.id, `${sessionId}-set-${String(index + 1).padStart(2, "0")}`),
    sessionId: normalizeText(log.sessionId, sessionId),
    coachId: normalizeText(log.coachId),
    workoutId: normalizeText(log.workoutId),
    exerciseId: normalizeText(log.exerciseId),
    workoutExerciseId: normalizeText(log.workoutExerciseId || log.workout_exercise_id || log.exerciseId),
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
    notes: normalizeText(log.notes),
    setNumber,
    setKind: normalizeText(log.setKind || log.set_kind, "working"),
    completedAt: log.completedAt || log.completed_at
      ? normalizeDate(log.completedAt || log.completed_at)
      : null,
    discomfort: normalizeText(log.discomfort, "none"),
    discomfortNote: normalizeText(log.discomfortNote || log.discomfort_note)
  };
};

const normalizeFeedback = (feedback = {}, sessionId = "session") => {
  const value = feedback && typeof feedback === "object" ? feedback : {};
  return {
    id: normalizeText(value.id, `${sessionId}-feedback`),
    sessionId: normalizeText(value.sessionId, sessionId),
    coachId: normalizeText(value.coachId),
    studentId: normalizeText(value.studentId),
    effort: normalizeText(value.effort, "ok"),
    pain: normalizeText(value.pain, "none"),
    note: normalizeText(value.note)
  };
};

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
    workoutRevisionId: normalizeText(session.workoutRevisionId || session.workout_revision_id),
    prescriptionSnapshot: session.prescriptionSnapshot || session.prescription_snapshot || {},
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
  workout_revision_id: session.workoutRevisionId || null,
  prescription_snapshot: session.prescriptionSnapshot || {},
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
  workout_exercise_id: log.workoutExerciseId || log.exerciseId || null,
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
  notes: log.notes,
  set_number: log.setNumber,
  set_kind: log.setKind,
  completed_at: log.completedAt,
  discomfort: log.discomfort,
  discomfort_note: log.discomfortNote
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
  workoutRevisionId: row.workout_revision_id,
  prescriptionSnapshot: row.prescription_snapshot,
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
    workoutExerciseId: log.workout_exercise_id || log.exercise_id,
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
    notes: log.notes,
    setNumber: log.set_number,
    setKind: log.set_kind,
    completedAt: log.completed_at,
    discomfort: log.discomfort,
    discomfortNote: log.discomfort_note
  }))
});

const upsertLocalSession = (session) => {
  const normalized = normalizeWorkoutSession(session);
  if (!normalized.coachId || !normalized.studentId) {
    const legacy = [normalized, ...readLegacySessions().filter((item) => item?.id !== normalized.id)]
      .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0))
      .slice(0, 80);
    Platform.storage.set(WORKOUT_SESSIONS_KEY, legacy);
    return normalized;
  }
  const next = [
    normalized,
    ...readCachedSessions({ studentId: normalized.studentId, coachId: normalized.coachId })
      .filter((item) => item?.id !== normalized.id)
  ].slice(0, 80);
  writeScopedSessions({ studentId: normalized.studentId, coachId: normalized.coachId }, next);
  return normalized;
};

export const sessionRepository = {
  listCachedSessions(scope = {}) {
    return readCachedSessions(scope);
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
      const rows = normalized.setLogs.map((log) => toSetLogRow(log, normalized));
      let { error } = await client.rpc("sync_workout_session_v2", {
        p_session: toSessionRow(normalized),
        p_set_logs: rows,
        p_feedback: toFeedbackRow(normalized.feedback, normalized)
      });
      if (error && String(error.message || "").toLowerCase().includes("sync_workout_session_v2")) {
        const legacyRow = toSessionRow(normalized);
        delete legacyRow.workout_revision_id;
        delete legacyRow.prescription_snapshot;
        ({ error } = await client.rpc("sync_workout_session", {
          p_session: legacyRow,
          p_set_logs: rows,
          p_feedback: toFeedbackRow(normalized.feedback, normalized)
        }));
      }
      if (error) throw error;

      const synced = upsertLocalSession({
        ...normalized,
        syncStatus: "synced",
        syncMessage: "Treino enviado ao professor."
      });
      return { synced: true, session: synced };
    } catch (error) {
      const failed = upsertLocalSession({
        ...normalized,
        syncStatus: "pending",
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

    const pending = this.listCachedSessions({ studentId: resolvedStudentId, coachId: resolvedCoachId }).filter((session) => (
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

  async fetchStudentSessions({ studentId = "", coachId = "", workoutId = "", limit = 20, authContext: providedAuthContext } = {}) {
    const resolvedStudentId = normalizeText(studentId);
    const resolvedCoachId = normalizeText(coachId);
    const resolvedWorkoutId = normalizeText(workoutId);
    const localSessions = this.listCachedSessions({ studentId: resolvedStudentId, coachId: resolvedCoachId }).filter((session) => (
      (!resolvedStudentId || session.studentId === resolvedStudentId)
      && (!resolvedCoachId || session.coachId === resolvedCoachId)
      && (!resolvedWorkoutId || session.workoutId === resolvedWorkoutId)
    ));
    const client = await getSupabase();
    const authContext = providedAuthContext || await authRepository.getAuthContext();
    if (!client || !authContext?.user || !authRepository.canAccessStudent(authContext)) {
      return { synced: false, reason: "not-authenticated-as-student", sessions: localSessions };
    }
    if (!resolvedStudentId || !resolvedCoachId) {
      return { synced: false, reason: "student-scope-required", sessions: localSessions };
    }

    try {
      let query = client
        .from(SESSIONS_TABLE)
        .select(SESSION_SELECT)
        .eq("student_id", resolvedStudentId)
        .eq("coach_id", resolvedCoachId)
        .order("finished_at", { ascending: false })
        .limit(Math.max(1, Math.min(80, Number(limit) || 20)));
      if (resolvedWorkoutId) query = query.eq("workout_id", resolvedWorkoutId);

      let { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError && String(sessionsError.message || "").includes("workout_revision_id")) {
        let legacyQuery = client.from(SESSIONS_TABLE).select(LEGACY_SESSION_SELECT)
          .eq("student_id", resolvedStudentId).eq("coach_id", resolvedCoachId)
          .order("finished_at", { ascending: false })
          .limit(Math.max(1, Math.min(80, Number(limit) || 20)));
        if (resolvedWorkoutId) legacyQuery = legacyQuery.eq("workout_id", resolvedWorkoutId);
        ({ data: sessionsData, error: sessionsError } = await legacyQuery);
      }
      if (sessionsError) throw sessionsError;
      const ids = (sessionsData || []).map((session) => session.id);
      if (!ids.length) return { synced: true, sessions: localSessions };

      const [{ data: logsData, error: logsError }, { data: feedbackData, error: feedbackError }] = await Promise.all([
        client.from(SET_LOGS_TABLE).select(SET_LOG_SELECT).in("session_id", ids).order("position", { ascending: true }),
        client.from(FEEDBACK_TABLE).select(FEEDBACK_SELECT).in("session_id", ids)
      ]);
      if (logsError) throw logsError;
      if (feedbackError) throw feedbackError;

      const logsBySession = new Map();
      (logsData || [])
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0)
          || Number(a.set_number || 0) - Number(b.set_number || 0))
        .forEach((log) => {
          const items = logsBySession.get(log.session_id) || [];
          items.push(log);
          logsBySession.set(log.session_id, items);
        });
      const feedbackBySession = new Map((feedbackData || []).map((feedback) => [feedback.session_id, feedback]));
      const cloudSessions = (sessionsData || []).map((session) => fromRows(
        session,
        logsBySession.get(session.id) || [],
        feedbackBySession.get(session.id) || null
      ));
      const merged = new Map([...localSessions, ...cloudSessions].map((session) => [session.id, session]));
      return {
        synced: true,
        sessions: [...merged.values()]
          .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0))
          .slice(0, Math.max(1, Math.min(80, Number(limit) || 20)))
      };
    } catch (error) {
      return { synced: false, error, sessions: localSessions };
    }
  },

  async fetchCoachSessions({ studentId = "", limit = 80, authContext: providedAuthContext } = {}) {
    const client = await getSupabase();
    const authContext = providedAuthContext || await authRepository.getAuthContext();
    const localSessions = this.listCachedSessions({
      coachId: authContext?.coachId || "",
      studentId: normalizeText(studentId)
    });
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
      return { synced: false, reason: "not-authenticated-as-coach", sessions: localSessions };
    }

    try {
      let query = client
        .from(SESSIONS_TABLE)
        .select(SESSION_SELECT)
        .eq("coach_id", authContext.coachId)
        .order("finished_at", { ascending: false })
        .limit(limit);
      if (studentId) query = query.eq("student_id", studentId);

      let { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError && String(sessionsError.message || "").includes("workout_revision_id")) {
        let legacyQuery = client.from(SESSIONS_TABLE).select(LEGACY_SESSION_SELECT)
          .eq("coach_id", authContext.coachId)
          .order("finished_at", { ascending: false }).limit(limit);
        if (studentId) legacyQuery = legacyQuery.eq("student_id", studentId);
        ({ data: sessionsData, error: sessionsError } = await legacyQuery);
      }
      if (sessionsError) throw sessionsError;

      const ids = (sessionsData || []).map((session) => session.id);
      if (!ids.length) return { synced: true, sessions: [] };

      const [{ data: logsData, error: logsError }, { data: feedbackData, error: feedbackError }] = await Promise.all([
        client.from(SET_LOGS_TABLE).select(SET_LOG_SELECT).in("session_id", ids).order("position", { ascending: true }),
        client.from(FEEDBACK_TABLE).select(FEEDBACK_SELECT).in("session_id", ids)
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
