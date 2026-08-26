const cleanSegment = (value, fallback) => String(value || fallback)
  .trim()
  .replace(/[^a-zA-Z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "") || fallback;

const dateKey = (value) => {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || "sem-data";
};

const pad = (value, size) => String(Math.max(0, Math.trunc(Number(value)) || 0)).padStart(size, "0");

export const createProgramAssignmentId = ({ programId, studentId, startsAt }) => [
  "assignment",
  cleanSegment(programId, "program"),
  cleanSegment(studentId, "student"),
  dateKey(startsAt)
].join("-");

export const createProgramWorkoutId = ({ assignmentId, occurrenceId }) => [
  "program-workout",
  cleanSegment(assignmentId, "assignment"),
  cleanSegment(occurrenceId, "occurrence")
].join("-");

export const createProgramWorkoutCode = ({ week, day, position, occurrenceId }) => (
  `P${pad(week, 3)}D${pad(day, 2)}O${pad(position, 3)}-${cleanSegment(occurrenceId, "occurrence")}`
);

const PROGRAM_CODE_PATTERN = /^P(\d{3})D(\d{2})O(\d{3})-(.+)$/;

export const parseProgramWorkoutCode = (value) => {
  const match = String(value || "").match(PROGRAM_CODE_PATTERN);
  if (!match) return null;
  return {
    week: Number(match[1]),
    day: Number(match[2]),
    position: Number(match[3]),
    occurrenceId: match[4]
  };
};

export const compareProgramWorkoutCodes = (leftCode, rightCode) => {
  const left = parseProgramWorkoutCode(leftCode);
  const right = parseProgramWorkoutCode(rightCode);
  if (!left || !right) return null;
  return left.week - right.week
    || left.day - right.day
    || left.position - right.position
    || left.occurrenceId.localeCompare(right.occurrenceId);
};

export const createProgramApplicationOperation = ({ assignment, workouts, previous = null }) => {
  const workoutIds = new Set((workouts || []).map((workout) => workout.id));
  const completedWorkoutIds = (previous?.completedWorkoutIds || []).filter((id) => workoutIds.has(id));
  return {
    id: `program-application-${cleanSegment(assignment?.id, "assignment")}`,
    intent: "apply-program",
    assignment,
    workouts,
    completedWorkoutIds,
    attempts: Number(previous?.attempts || 0),
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: ""
  };
};

export const processProgramApplicationOperation = async (operation, {
  syncAssignment,
  publishWorkout,
  onProgress = () => {}
}) => {
  const assignmentResult = await syncAssignment(operation.assignment);
  if (!assignmentResult?.synced) {
    return {
      synced: false,
      completed: operation.completedWorkoutIds.length,
      total: operation.workouts.length,
      operation: {
        ...operation,
        attempts: Number(operation.attempts || 0) + 1,
        updatedAt: new Date().toISOString(),
        lastError: assignmentResult?.reason || assignmentResult?.error?.message || "assignment-sync-failed"
      }
    };
  }

  const completed = new Set(operation.completedWorkoutIds || []);
  for (const workout of operation.workouts || []) {
    if (completed.has(workout.id)) continue;
    const result = await publishWorkout(workout);
    if (!result?.synced) {
      const nextOperation = {
        ...operation,
        completedWorkoutIds: [...completed],
        attempts: Number(operation.attempts || 0) + 1,
        updatedAt: new Date().toISOString(),
        lastError: result?.reason || result?.error?.message || "workout-sync-failed"
      };
      await onProgress(nextOperation, result);
      return { synced: false, completed: completed.size, total: operation.workouts.length, operation: nextOperation };
    }
    completed.add(workout.id);
    const nextOperation = {
      ...operation,
      completedWorkoutIds: [...completed],
      updatedAt: new Date().toISOString(),
      lastError: ""
    };
    await onProgress(nextOperation, result);
  }

  return {
    synced: true,
    completed: completed.size,
    total: operation.workouts.length,
    operation: { ...operation, completedWorkoutIds: [...completed], updatedAt: new Date().toISOString(), lastError: "" }
  };
};
