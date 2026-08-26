import { Platform } from "../../core/platform.js?v=build-20260813-1";
import { getSupabase } from "../../core/supabase.js?v=build-20260823-3";
import { authRepository } from "./auth-repository.js?v=build-20260812-5";
import { cloneTrainingDocument, createRevisionSnapshot, normalizeWorkoutDocument } from "../training-domain.js?v=build-20260823-2";
import { normalizeProgramSessionSlot } from "../program-schedule.js?v=build-20260825-1";
import { createCausalSyncRunner } from "../causal-sync.js?v=build-20260825-1";
import { createProgramApplicationOperation } from "../program-application.js?v=build-20260825-1";

export const PROGRAMMING_KEYS = Object.freeze({
  definitions: "flowfit.programming.exercise-definitions",
  templates: "flowfit.programming.workout-templates",
  programs: "flowfit.programming.program-templates",
  assignments: "flowfit.programming.program-assignments",
  queue: "flowfit.programming.publish-queue"
});

const read = (key) => {
  const value = Platform.storage.get(key, []);
  return Array.isArray(value) ? value : [];
};
const write = (key, value) => Platform.storage.set(key, value);
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const upsertLocal = (key, item) => {
  const next = [item, ...read(key).filter((current) => current.id !== item.id)];
  write(key, next);
  return item;
};

const normalizeDefinition = (definition = {}) => ({
  id: String(definition.id || uid("exercise")),
  name: String(definition.name || "Exercício personalizado").trim(),
  aliases: Array.isArray(definition.aliases) ? definition.aliases : [],
  muscles: Array.isArray(definition.muscles) ? definition.muscles : [],
  equipment: String(definition.equipment || "").trim(),
  instructions: String(definition.instructions || "").trim(),
  mediaUrl: String(definition.mediaUrl || "").trim(),
  mediaType: String(definition.mediaType || "none").trim(),
  mediaMetadata: definition.mediaMetadata || {},
  source: definition.source === "system" ? "system" : "custom",
  syncStatus: definition.syncStatus || "local",
  updatedAt: definition.updatedAt || now()
});

const normalizeTemplate = (template = {}) => {
  const document = normalizeWorkoutDocument(template.document || template);
  return {
    id: String(template.id || uid("template")),
    name: String(template.name || document.title || "Modelo sem nome").trim(),
    objective: String(template.objective || document.objective || "").trim(),
    level: String(template.level || document.level || "").trim(),
    currentRevision: Math.max(1, Number(template.currentRevision || 1)),
    document: createRevisionSnapshot(document),
    syncStatus: template.syncStatus || "local",
    updatedAt: template.updatedAt || now()
  };
};

const normalizeProgram = (program = {}) => {
  const programId = String(program.id || uid("program"));
  const sessions = (Array.isArray(program.sessions) ? program.sessions : []).map((session, index) => ({
    id: String(session.id || `${programId}-session-${index + 1}`),
    ...normalizeProgramSessionSlot(session, index),
    templateId: String(session.templateId || ""),
    title: String(session.title || "Sessão").trim()
  }));
  const occupiedWeeks = sessions.reduce((maximum, session) => Math.max(maximum, session.week), 1);
  const requestedWeeks = Math.max(1, Math.trunc(Number(program.weeks)) || 1);
  return {
    id: programId,
    name: String(program.name || "Novo programa").trim(),
    objective: String(program.objective || "").trim(),
    level: String(program.level || "").trim(),
    weeks: Math.max(occupiedWeeks, requestedWeeks),
    sessions,
    syncStatus: program.syncStatus || "local",
    updatedAt: program.updatedAt || now()
  };
};

const normalizeAssignment = (assignment = {}) => ({
  id: String(assignment.id || uid("assignment")),
  studentId: String(assignment.studentId || assignment.student_id || ""),
  programId: String(assignment.programId || assignment.program_id || ""),
  programRevision: Math.max(1, Number(assignment.programRevision || assignment.program_revision || 1)),
  startsAt: assignment.startsAt || assignment.starts_at || now(),
  status: ["scheduled", "active", "completed", "cancelled"].includes(assignment.status) ? assignment.status : "active",
  syncStatus: assignment.syncStatus || "local",
  updatedAt: assignment.updatedAt || assignment.updated_at || now()
});

const templateCloudRow = (item, coachId) => ({
  id: item.id,
  coach_id: coachId,
  name: item.name,
  objective: item.objective || "",
  level: item.level || "",
  current_revision: item.currentRevision,
  content: item.document,
  status: "draft",
  updated_at: item.updatedAt
});

const programCloudRow = (item, coachId) => ({
  id: item.id,
  coach_id: coachId,
  name: item.name,
  objective: item.objective || "",
  level: item.level || "",
  weeks: item.weeks,
  content: { weeks: item.weeks, sessions: item.sessions },
  status: "draft",
  updated_at: item.updatedAt
});

const definitionCloudRow = (item, coachId) => ({
  id: item.id,
  coach_id: coachId,
  name: item.name,
  aliases: item.aliases,
  muscles: item.muscles,
  equipment: item.equipment,
  instructions: item.instructions,
  media_url: item.mediaUrl,
  media_type: item.mediaType,
  media_metadata: item.mediaMetadata,
  source: item.source,
  updated_at: item.updatedAt
});

const mergeCloud = (local, cloud, normalize) => {
  const items = new Map(local.map((item) => [item.id, normalize(item)]));
  cloud.forEach((item) => {
    const current = items.get(item.id);
    if (!current || new Date(item.updatedAt || 0) >= new Date(current.updatedAt || 0)) items.set(item.id, normalize(item));
  });
  return [...items.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
};

const hasPendingLibraries = (repository) => [
  ...repository.listDefinitions(),
  ...repository.listTemplates(),
  ...repository.listPrograms(),
  ...repository.listAssignments()
].some((item) => item.syncStatus !== "synced");

const markSyncedIfUnchanged = (repository, collection, row, save) => {
  const current = collection.call(repository).find((item) => item.id === row.id);
  if (!current || current.updatedAt !== row.updated_at) return;
  save.call(repository, { ...current, syncStatus: "synced" });
};

const syncLibrariesOnce = async (repository) => {
  const authContext = await authRepository.getAuthContext();
  const client = await getSupabase();
  if (!client || !authRepository.canWriteAsCoach(authContext)) return { synced: false, reason: "offline-or-unauthorized" };
  const definitionRows = repository.listDefinitions().filter((item) => item.syncStatus !== "synced").map((item) => definitionCloudRow(item, authContext.coachId));
  const templateRows = repository.listTemplates().filter((item) => item.syncStatus !== "synced").map((item) => templateCloudRow(item, authContext.coachId));
  const programRows = repository.listPrograms().filter((item) => item.syncStatus !== "synced").map((item) => programCloudRow(item, authContext.coachId));
  const assignmentRows = repository.listAssignments().filter((item) => item.syncStatus !== "synced").map((item) => ({
    id: item.id, coach_id: authContext.coachId, student_id: item.studentId, program_id: item.programId,
    program_revision: item.programRevision, starts_at: item.startsAt, status: item.status, updated_at: item.updatedAt
  }));
  try {
    if (definitionRows.length) {
      const { error } = await client.from("exercise_definitions").upsert(definitionRows, { onConflict: "id" });
      if (error) throw error;
      definitionRows.forEach((row) => markSyncedIfUnchanged(repository, repository.listDefinitions, row, repository.saveDefinition));
    }
    if (templateRows.length) {
      const { error } = await client.from("workout_templates").upsert(templateRows, { onConflict: "id" });
      if (error) throw error;
      const revisionRows = templateRows.map((row) => ({
        id: `${row.id}-revision-${row.current_revision}`,
        template_id: row.id,
        coach_id: authContext.coachId,
        revision: row.current_revision,
        content: row.content
      }));
      const { error: revisionError } = await client.from("workout_template_revisions")
        .upsert(revisionRows, { onConflict: "template_id,revision", ignoreDuplicates: true });
      if (revisionError) throw revisionError;
      templateRows.forEach((row) => markSyncedIfUnchanged(repository, repository.listTemplates, row, repository.saveTemplate));
    }
    if (programRows.length) {
      const { error } = await client.from("program_templates").upsert(programRows, { onConflict: "id" });
      if (error) throw error;
      programRows.forEach((row) => markSyncedIfUnchanged(repository, repository.listPrograms, row, repository.saveProgram));
    }
    if (assignmentRows.length) {
      const { error } = await client.from("program_assignments").upsert(assignmentRows, { onConflict: "id" });
      if (error) throw error;
      assignmentRows.forEach((row) => markSyncedIfUnchanged(repository, repository.listAssignments, row, repository.saveAssignment));
    }
    return { synced: true };
  } catch (error) {
    return { synced: false, error };
  }
};

let librarySyncRunner = null;

export const programmingRepository = {
  listDefinitions() { return read(PROGRAMMING_KEYS.definitions).map(normalizeDefinition); },
  listTemplates() { return read(PROGRAMMING_KEYS.templates).map(normalizeTemplate); },
  listPrograms() { return read(PROGRAMMING_KEYS.programs).map(normalizeProgram); },
  listAssignments() { return read(PROGRAMMING_KEYS.assignments).map(normalizeAssignment); },
  listPublishQueue() { return read(PROGRAMMING_KEYS.queue).filter((item) => item.intent !== "apply-program"); },
  listProgramApplications() { return read(PROGRAMMING_KEYS.queue).filter((item) => item.intent === "apply-program"); },

  saveDefinition(value) { return upsertLocal(PROGRAMMING_KEYS.definitions, normalizeDefinition(value)); },
  saveTemplate(value) { return upsertLocal(PROGRAMMING_KEYS.templates, normalizeTemplate(value)); },
  saveProgram(value) { return upsertLocal(PROGRAMMING_KEYS.programs, normalizeProgram(value)); },
  saveAssignment(value) { return upsertLocal(PROGRAMMING_KEYS.assignments, normalizeAssignment(value)); },
  removeTemplate(id) { write(PROGRAMMING_KEYS.templates, read(PROGRAMMING_KEYS.templates).filter((item) => item.id !== id)); },
  removeProgram(id) { write(PROGRAMMING_KEYS.programs, read(PROGRAMMING_KEYS.programs).filter((item) => item.id !== id)); },

  createTemplateFromWorkout(workout, name = "") {
    return this.saveTemplate({ name: name || workout.title, document: cloneTrainingDocument(workout), syncStatus: "pending" });
  },

  instantiateTemplate(template, overrides = {}) {
    const source = normalizeTemplate(template);
    return normalizeWorkoutDocument({
      ...cloneTrainingDocument(source.document),
      ...overrides,
      id: overrides.id || uid("workout"),
      templateId: source.id,
      editorialState: "draft",
      transportState: "local",
      revision: 1
    });
  },

  enqueuePublish(workout, reason = "offline") {
    const operation = {
      id: uid("publish"),
      workoutId: workout.id,
      intent: "publish",
      reason,
      payload: cloneTrainingDocument(workout),
      createdAt: now(),
      attempts: 0
    };
    upsertLocal(PROGRAMMING_KEYS.queue, operation);
    return operation;
  },

  enqueueProgramApplication({ assignment, workouts }) {
    const provisional = createProgramApplicationOperation({ assignment, workouts });
    const previous = this.listProgramApplications().find((item) => item.id === provisional.id);
    const operation = createProgramApplicationOperation({ assignment, workouts, previous });
    return upsertLocal(PROGRAMMING_KEYS.queue, operation);
  },

  updateQueuedProgramApplication(operation) {
    if (!operation?.id) return null;
    return upsertLocal(PROGRAMMING_KEYS.queue, operation);
  },

  removeQueuedProgramApplication(id) {
    write(PROGRAMMING_KEYS.queue, read(PROGRAMMING_KEYS.queue).filter((item) => item.id !== id));
  },

  removeQueuedPublish(id) {
    write(PROGRAMMING_KEYS.queue, read(PROGRAMMING_KEYS.queue).filter((item) => item.id !== id));
  },

  updateQueuedPublish(id, changes = {}) {
    const current = read(PROGRAMMING_KEYS.queue).find((item) => item.id === id);
    if (!current) return null;
    return upsertLocal(PROGRAMMING_KEYS.queue, { ...current, ...changes });
  },

  async syncLibraries() {
    if (!librarySyncRunner) {
      librarySyncRunner = createCausalSyncRunner({
        syncOnce: () => syncLibrariesOnce(this),
        hasPending: () => hasPendingLibraries(this)
      });
    }
    return librarySyncRunner.run();
  },

  async fetchLibraries() {
    const authContext = await authRepository.getAuthContext();
    const client = await getSupabase();
    if (!client || !authRepository.canWriteAsCoach(authContext)) {
      return { synced: false, definitions: this.listDefinitions(), templates: this.listTemplates(), programs: this.listPrograms(), assignments: this.listAssignments() };
    }
    try {
      const [definitionsResult, templatesResult, programsResult, assignmentsResult] = await Promise.all([
        client.from("exercise_definitions").select("id,name,aliases,muscles,equipment,instructions,media_url,media_type,media_metadata,source,updated_at")
          .eq("coach_id", authContext.coachId).order("updated_at", { ascending: false }),
        client.from("workout_templates").select("id,name,objective,level,current_revision,content,status,updated_at")
          .eq("coach_id", authContext.coachId).neq("status", "archived").order("updated_at", { ascending: false }),
        client.from("program_templates").select("id,name,objective,level,weeks,content,status,updated_at")
          .eq("coach_id", authContext.coachId).neq("status", "archived").order("updated_at", { ascending: false }),
        client.from("program_assignments").select("id,student_id,program_id,program_revision,starts_at,status,updated_at")
          .eq("coach_id", authContext.coachId).neq("status", "cancelled").order("updated_at", { ascending: false })
      ]);
      const error = definitionsResult.error || templatesResult.error || programsResult.error || assignmentsResult.error;
      if (error) throw error;
      const cloudDefinitions = (definitionsResult.data || []).map((row) => normalizeDefinition({
        ...row, mediaUrl: row.media_url, mediaType: row.media_type, mediaMetadata: row.media_metadata, syncStatus: "synced", updatedAt: row.updated_at
      }));
      const cloudTemplates = (templatesResult.data || []).map((row) => normalizeTemplate({
        ...row, currentRevision: row.current_revision, document: row.content, syncStatus: "synced", updatedAt: row.updated_at
      }));
      const cloudPrograms = (programsResult.data || []).map((row) => normalizeProgram({
        ...row, ...(row.content || {}), syncStatus: "synced", updatedAt: row.updated_at
      }));
      const cloudAssignments = (assignmentsResult.data || []).map((row) => normalizeAssignment({ ...row, syncStatus: "synced" }));
      const definitions = mergeCloud(this.listDefinitions(), cloudDefinitions, normalizeDefinition);
      const templates = mergeCloud(this.listTemplates(), cloudTemplates, normalizeTemplate);
      const programs = mergeCloud(this.listPrograms(), cloudPrograms, normalizeProgram);
      const assignments = mergeCloud(this.listAssignments(), cloudAssignments, normalizeAssignment);
      write(PROGRAMMING_KEYS.definitions, definitions);
      write(PROGRAMMING_KEYS.templates, templates);
      write(PROGRAMMING_KEYS.programs, programs);
      write(PROGRAMMING_KEYS.assignments, assignments);
      return { synced: true, definitions, templates, programs, assignments };
    } catch (error) {
      return { synced: false, error, definitions: this.listDefinitions(), templates: this.listTemplates(), programs: this.listPrograms(), assignments: this.listAssignments() };
    }
  }
};
