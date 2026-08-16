export const createWorkoutSessionState = ({
  Store,
  SESSION_PHASE,
  getCurrentStudent,
  getCurrentWorkout,
  getPreviousSessions,
  parseTotalSets,
  parseLoadKg,
  parseReps
}) => {
  const getCurrentExercises = () => Array.isArray(getCurrentWorkout().exercises) ? getCurrentWorkout().exercises : [];
  
  const getTotalSets = () => getCurrentExercises().reduce((sum, exercise) => sum + parseTotalSets(exercise), 0);
  
  const normalizeExerciseName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  
  const getActiveSession = () => {
    const session = Store.getActiveSession();
    if (!session || session.studentId !== getCurrentStudent().id) return null;
    return session;
  };
  
  const getSessionExercises = (session = getActiveSession()) => (
    Array.isArray(session?.workoutSnapshot?.exercises) ? session.workoutSnapshot.exercises : []
  );
  
  const getSessionEntries = (session = getActiveSession()) => (
    Array.isArray(session?.setEntries) ? session.setEntries : []
  );
  
  const getLastSessionEntry = (session = getActiveSession()) => getSessionEntries(session)
    .reduce((latest, entry) => {
      if (!latest) return entry;
      const latestTime = new Date(latest.completedAt || 0).getTime() || 0;
      const entryTime = new Date(entry.completedAt || 0).getTime() || 0;
      return entryTime >= latestTime ? entry : latest;
    }, null);
  
  const occurrenceId = (exercise) => exercise?.workoutExerciseId || exercise?.id || "";
  
  const getExerciseEntries = (workoutExerciseId, session = getActiveSession()) => getSessionEntries(session)
    .filter((entry) => (entry.workoutExerciseId || entry.exerciseId) === workoutExerciseId)
    .sort((a, b) => Number(a.setNumber || 0) - Number(b.setNumber || 0));
  
  const getCompletedSetCount = (exerciseId, session = getActiveSession()) => getExerciseEntries(exerciseId, session).length;
  
  const getCompletedSessionSets = (session = getActiveSession()) => getSessionEntries(session).length;
  
  const getSessionTotalSets = (session = getActiveSession()) => getSessionExercises(session)
    .reduce((sum, exercise) => sum + parseTotalSets(exercise), 0);
  
  const findSessionExercise = (workoutExerciseId, session = getActiveSession()) => getSessionExercises(session)
    .find((exercise) => occurrenceId(exercise) === workoutExerciseId) || null;
  
  const getNextIncompleteTarget = (session = getActiveSession(), afterExerciseId = "") => {
    const exercises = getSessionExercises(session);
    if (!exercises.length) return null;
    const startIndex = Math.max(0, exercises.findIndex((exercise) => occurrenceId(exercise) === afterExerciseId));
    const ordered = [...exercises.slice(startIndex), ...exercises.slice(0, startIndex)];
    for (const exercise of ordered) {
      const completedNumbers = new Set(getExerciseEntries(occurrenceId(exercise), session).map((entry) => Number(entry.setNumber)));
      const total = parseTotalSets(exercise);
      for (let setNumber = 1; setNumber <= total; setNumber += 1) {
        if (!completedNumbers.has(setNumber)) return { exercise, setNumber };
      }
    }
    return null;
  };
  
  const findPreviousSet = (exercise, setNumber) => {
    for (const session of getPreviousSessions()) {
      if (session.status !== "completed" && session.status !== "partial") continue;
      const historicalExerciseId = exercise.exerciseId || exercise.id;
      const exactLogs = (session.setLogs || []).filter((log) => log.exerciseId === historicalExerciseId);
      const nameLogs = (session.setLogs || []).filter((log) => (
        normalizeExerciseName(log.exerciseName) === normalizeExerciseName(exercise.name)
      ));
      const logs = exactLogs.length ? exactLogs : nameLogs;
      const individual = logs.find((log) => Number(log.setNumber) === Number(setNumber));
      if (individual) return individual;
      const legacy = logs.find((log) => !log.setNumber && Number(log.completedSets || 0) >= Number(setNumber));
      if (legacy) return legacy;
    }
    return null;
  };
  
  const findPreviousExerciseLogs = (exercise) => {
    for (const session of getPreviousSessions()) {
      if (!["completed", "partial"].includes(session.status)) continue;
      const historicalExerciseId = exercise.exerciseId || exercise.id;
      const exactLogs = (session.setLogs || []).filter((log) => log.exerciseId === historicalExerciseId);
      const nameLogs = (session.setLogs || []).filter((log) => (
        normalizeExerciseName(log.exerciseName) === normalizeExerciseName(exercise.name)
      ));
      const logs = exactLogs.length ? exactLogs : nameLogs;
      if (logs.length) return [...logs].sort((a, b) => Number(a.setNumber || 0) - Number(b.setNumber || 0));
    }
    return [];
  };
  
  const createStableId = (prefix) => {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };
  
  const getElapsedSeconds = (session, now = Date.now()) => {
    const startedAt = new Date(session?.startedAt || now).getTime();
    const pausedAt = session?.pausedAt ? new Date(session.pausedAt).getTime() : null;
    const activeUntil = Number.isFinite(pausedAt) ? pausedAt : now;
    return Math.max(0, Math.floor((activeUntil - startedAt) / 1000) - Number(session?.pausedDurationSeconds || 0));
  };
  
  const pauseActiveSession = (session = getActiveSession(), { pausedAt = Date.now(), reason = "manual" } = {}) => {
    if (!session || session.phase === SESSION_PHASE.PAUSED) return session;
    return Store.updateActiveSession({
      phase: SESSION_PHASE.PAUSED,
      resumePhase: session.phase,
      pausedAt: new Date(pausedAt).toISOString(),
      pausedReason: reason
    });
  };
  
  const resumeActiveSession = (session = getActiveSession()) => {
    if (!session || session.phase !== SESSION_PHASE.PAUSED) return session;
    const pausedAt = new Date(session.pausedAt || Date.now()).getTime();
    const pausedFor = Number.isFinite(pausedAt) ? Math.max(0, Math.floor((Date.now() - pausedAt) / 1000)) : 0;
    let phase = session.resumePhase || SESSION_PHASE.ACTIVE_SET;
    if (phase === SESSION_PHASE.TRANSITIONING && new Date(session.transitionEndsAt || 0).getTime() <= Date.now()) {
      phase = session.pendingExerciseId ? SESSION_PHASE.RESTING : SESSION_PHASE.AWAITING_SUMMARY;
    }
    if (phase === SESSION_PHASE.RESTING && new Date(session.restEndsAt || 0).getTime() <= Date.now()) {
      phase = session.pendingExerciseId || session.currentExerciseId
        ? SESSION_PHASE.ACTIVE_SET
        : SESSION_PHASE.AWAITING_SUMMARY;
    }
    return Store.updateActiveSession({
      phase,
      resumePhase: null,
      pausedAt: null,
      pausedReason: null,
      lastActivityAt: new Date().toISOString(),
      pausedDurationSeconds: Number(session.pausedDurationSeconds || 0) + pausedFor,
      transitionEndsAt: phase === SESSION_PHASE.TRANSITIONING ? session.transitionEndsAt : null,
      restEndsAt: phase === SESSION_PHASE.RESTING ? session.restEndsAt : null,
      pendingExerciseId: [SESSION_PHASE.TRANSITIONING, SESSION_PHASE.RESTING].includes(phase) ? session.pendingExerciseId : null,
      pendingSetNumber: [SESSION_PHASE.TRANSITIONING, SESSION_PHASE.RESTING].includes(phase) ? session.pendingSetNumber : null
    });
  };
  
  const createSessionSnapshot = (workout) => {
    const exercises = workout.exercises || [];
    const occurrenceCounts = new Map();
    exercises.forEach((exercise) => {
      const baseId = exercise.workoutExerciseId || exercise.id || "";
      occurrenceCounts.set(baseId, Number(occurrenceCounts.get(baseId) || 0) + 1);
    });
    return {
      id: workout.id,
      code: workout.code,
      title: workout.title,
      focus: workout.focus,
      version: workout.version || 1,
      exercises: exercises.map((exercise, index) => {
        const baseId = exercise.workoutExerciseId || exercise.id || `${workout.id}-item-${index + 1}`;
        return {
          ...exercise,
          workoutExerciseId: Number(occurrenceCounts.get(baseId) || 0) > 1
            ? `${baseId}-occurrence-${index + 1}`
            : baseId,
          exerciseId: exercise.exerciseId || exercise.id || ""
        };
      })
    };
  };
  
  const createActiveSession = (workout) => {
    const workoutSnapshot = createSessionSnapshot(workout);
    const firstExercise = workoutSnapshot.exercises?.[0];
    const session = {
      id: createStableId("session"),
      coachId: workout.coachId || getCurrentStudent().coachId || "",
      studentId: getCurrentStudent().id,
      studentKey: getCurrentStudent().studentKey || workout.studentKey || "",
      studentEmail: getCurrentStudent().email || "",
      workoutId: workout.id,
      workoutVersion: workout.version || 1,
      workoutSnapshot,
      startedAt: new Date().toISOString(),
      schemaVersion: 2,
      phase: SESSION_PHASE.ACTIVE_SET,
      syncStatus: "local",
      currentExerciseId: occurrenceId(firstExercise),
      currentSetNumber: 1,
      restEndsAt: null,
      transitionEndsAt: null,
      pendingExerciseId: null,
      pendingSetNumber: null,
      pausedAt: null,
      pausedReason: null,
      lastActivityAt: new Date().toISOString(),
      pausedDurationSeconds: 0,
      setEntries: []
    };
  
    const legacyDone = Store.state.activeWorkoutId === workout.id ? Store.state.setLogs || {} : {};
    Object.entries(legacyDone).forEach(([exerciseId, count]) => {
      const exerciseIndex = workout.exercises.findIndex((item) => item.id === exerciseId);
      const exercise = workoutSnapshot.exercises[exerciseIndex];
      if (!exercise) return;
      const log = Store.getExerciseLog(exerciseId, {
        load: parseLoadKg(exercise.load),
        reps: parseReps(exercise)
      });
      for (let setNumber = 1; setNumber <= Math.min(Number(count || 0), parseTotalSets(exercise)); setNumber += 1) {
        session.setEntries.push({
          workoutExerciseId: occurrenceId(exercise),
          exerciseId: exercise.exerciseId || exercise.id,
          exercisePosition: exerciseIndex,
          exerciseName: exercise.name,
          setNumber,
          setKind: "working",
          loadKg: Number(log.load || 0),
          reps: Number(log.reps || 0),
          completedAt: new Date().toISOString()
        });
      }
    });
    const next = getNextIncompleteTarget(session, occurrenceId(firstExercise));
    if (next) {
      session.currentExerciseId = occurrenceId(next.exercise);
      session.currentSetNumber = next.setNumber;
    }
    return Store.startActiveSession(session);
  };
  
  

  return {
    getCurrentExercises,
    getTotalSets,
    getActiveSession,
    getSessionExercises,
    getSessionEntries,
    getLastSessionEntry,
    occurrenceId,
    getExerciseEntries,
    getCompletedSetCount,
    getCompletedSessionSets,
    getSessionTotalSets,
    findSessionExercise,
    getNextIncompleteTarget,
    findPreviousSet,
    findPreviousExerciseLogs,
    getElapsedSeconds,
    pauseActiveSession,
    resumeActiveSession,
    createSessionSnapshot,
    createActiveSession
  };
};

