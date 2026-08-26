import assert from "node:assert/strict";
import { createCausalSyncRunner } from "../appAluno/js/data/causal-sync.js";
import {
  createProgramApplicationOperation,
  createProgramAssignmentId,
  createProgramWorkoutCode,
  createProgramWorkoutId,
  processProgramApplicationOperation
} from "../appAluno/js/data/program-application.js";
import { reconcileStudentSnapshots } from "../appAluno/js/data/repositories/student-repository.js";
import { compareWorkoutScheduleOrder } from "../appAluno/js/data/repositories/workout-repository.js";
import {
  isRunnerSystemEdgeStart,
  runnerSwipeActionForDelta,
  runnerSwipeDirectedDistance,
  runnerSwipeTranslation
} from "../appAluno/js/interaction/runner-swipe.js";
import { WORKOUT_DRAFT_CONTEXT, canMutatePrimaryWorkoutDraft } from "../appProfessor/js/state/workout-draft-policy.js";

// Autosave isolado: abrir/editar/duplicar/criar modelo não recebe autoridade
// para gravar ou remover o rascunho principal.
assert.equal(canMutatePrimaryWorkoutDraft(WORKOUT_DRAFT_CONTEXT.PRIMARY), true);
assert.equal(canMutatePrimaryWorkoutDraft(WORKOUT_DRAFT_CONTEXT.ISOLATED), false);
let storedDraft = { fields: { student: "student-1" }, exercises: [{ id: "exercise-1" }] };
if (canMutatePrimaryWorkoutDraft(WORKOUT_DRAFT_CONTEXT.ISOLATED)) storedDraft = null;
assert.deepEqual(storedDraft, { fields: { student: "student-1" }, exercises: [{ id: "exercise-1" }] });

// Concorrência causal: uma edição feita durante a primeira requisição força
// uma segunda passagem e prevalece mesmo com a primeira resposta atrasada.
let localVersion = 1;
const persistedVersions = [];
let releaseFirst;
const firstResponse = new Promise((resolve) => { releaseFirst = resolve; });
let calls = 0;
const causalRunner = createCausalSyncRunner({
  syncOnce: async () => {
    const captured = localVersion;
    calls += 1;
    if (calls === 1) await firstResponse;
    persistedVersions.push(captured);
    return { synced: true };
  },
  hasPending: () => persistedVersions.at(-1) !== localVersion
});
const oldRequest = causalRunner.run();
localVersion = 2;
const newRequest = causalRunner.run();
releaseFirst();
await Promise.all([oldRequest, newRequest]);
assert.deepEqual(persistedVersions, [1, 2]);

// Ordem publicada explícita: três ocorrências na mesma data mantêm o desempate
// definido pelo professor, sem depender de timestamp ou ID aleatório.
const sameDay = [2, 0, 1].map((position) => ({
  title: `Sessão ${position + 1}`,
  startsAt: "2026-08-25T03:00:00.000Z",
  code: createProgramWorkoutCode({ week: 1, day: 1, position, occurrenceId: `occ-${position}` })
}));
assert.deepEqual(sameDay.sort(compareWorkoutScheduleOrder).map((item) => item.title), ["Sessão 1", "Sessão 2", "Sessão 3"]);

// Cadastro offline: registro local pendente sobrevive a fetch remoto e uma
// resposta vazia por RLS nunca apaga a única cópia local.
const remoteStudent = { id: "remote", coachId: "coach", name: "Remoto", updatedAt: "2026-08-25T10:00:00.000Z" };
const pendingStudent = { id: "pending", coachId: "coach", name: "Offline", syncStatus: "pending", updatedAt: "2026-08-25T11:00:00.000Z" };
const mergedStudents = reconcileStudentSnapshots([remoteStudent], [pendingStudent], { coachId: "coach" });
assert.deepEqual(new Set(mergedStudents.students.map((item) => item.id)), new Set(["remote", "pending"]));
const emptyRemote = reconcileStudentSnapshots([], [remoteStudent, pendingStudent], { coachId: "coach" });
assert.equal(emptyRemote.preservedLocal, true);
assert.equal(emptyRemote.students.length, 2);

// Aplicação offline: IDs são estáveis e o retry continua do primeiro treino
// ainda não confirmado, sem republicar o que já concluiu.
const assignmentId = createProgramAssignmentId({ programId: "program", studentId: "student", startsAt: "2026-08-25" });
const assignment = { id: assignmentId };
const workouts = ["a", "b", "c"].map((occurrenceId, position) => ({
  id: createProgramWorkoutId({ assignmentId, occurrenceId }),
  code: createProgramWorkoutCode({ week: 1, day: 1, position, occurrenceId })
}));
let operation = createProgramApplicationOperation({ assignment, workouts });
const publishedIds = [];
let shouldFailMiddle = true;
let result = await processProgramApplicationOperation(operation, {
  syncAssignment: async () => ({ synced: true }),
  publishWorkout: async (workout) => {
    if (workout.id === workouts[1].id && shouldFailMiddle) return { synced: false, reason: "offline" };
    publishedIds.push(workout.id);
    return { synced: true };
  },
  onProgress: (next) => { operation = next; }
});
assert.equal(result.synced, false);
assert.deepEqual(result.operation.completedWorkoutIds, [workouts[0].id]);
shouldFailMiddle = false;
result = await processProgramApplicationOperation(result.operation, {
  syncAssignment: async () => ({ synced: true }),
  publishWorkout: async (workout) => {
    publishedIds.push(workout.id);
    return { synced: true };
  }
});
assert.equal(result.synced, true);
assert.deepEqual(publishedIds, workouts.map((workout) => workout.id));
assert.equal(createProgramApplicationOperation({ assignment, workouts, previous: result.operation }).id, operation.id);

const assignmentFailure = await processProgramApplicationOperation(createProgramApplicationOperation({ assignment, workouts }), {
  syncAssignment: async () => ({ synced: false, reason: "offline-before-assignment" }),
  publishWorkout: async () => { throw new Error("não deveria publicar sem atribuição"); }
});
assert.equal(assignmentFailure.completed, 0);
assert.equal(assignmentFailure.operation.attempts, 1);

for (const failedIndex of [0, 2]) {
  let failsOnce = true;
  const sent = [];
  const initial = createProgramApplicationOperation({ assignment, workouts });
  const interrupted = await processProgramApplicationOperation(initial, {
    syncAssignment: async () => ({ synced: true }),
    publishWorkout: async (workout) => {
      const index = workouts.findIndex((item) => item.id === workout.id);
      if (index === failedIndex && failsOnce) return { synced: false, reason: "connection-dropped" };
      sent.push(workout.id);
      return { synced: true };
    }
  });
  failsOnce = false;
  const restoredAfterReload = JSON.parse(JSON.stringify(interrupted.operation));
  const resumed = await processProgramApplicationOperation(restoredAfterReload, {
    syncAssignment: async () => ({ synced: true }),
    publishWorkout: async (workout) => {
      sent.push(workout.id);
      return { synced: true };
    }
  });
  assert.equal(resumed.synced, true);
  assert.deepEqual(sent, workouts.map((workout) => workout.id));
}

// Swipe: direita corrige, esquerda avança; a faixa de borda fica reservada ao SO.
assert.equal(runnerSwipeActionForDelta(80), "correct");
assert.equal(runnerSwipeActionForDelta(-80), "primary");
assert.equal(runnerSwipeDirectedDistance(80, "correct"), 80);
assert.equal(runnerSwipeDirectedDistance(-80, "primary"), 80);
assert.equal(runnerSwipeTranslation(1, "correct"), "5.5rem");
assert.equal(runnerSwipeTranslation(1, "primary"), "-5.5rem");
assert.equal(isRunnerSystemEdgeStart(10, 390), true);
assert.equal(isRunnerSystemEdgeStart(200, 390), false);
assert.equal(isRunnerSystemEdgeStart(382, 390), true);

console.log("post-audit-regression-smoke: P0/P1 direcionados aprovados");
