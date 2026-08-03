import { DEMO_COACH_ID } from "../../config.js";
import { Platform } from "../../core/platform.js";
import { getSupabase } from "../../core/supabase.js";
import { studentKeyFromName } from "./workout-repository.js";

export const STUDENTS_KEY = "flowfit.students";

const TABLE = "students";

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

export const initialsFromName = (name) => normalizeText(name, "Aluno")
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase() || "AL";

const studentIdFromKey = (studentKey) => `student-${studentKey}`;

const readStudents = () => {
  const items = Platform.storage.get(STUDENTS_KEY, []);
  return Array.isArray(items) ? items : [];
};

const writeStudents = (students) => Platform.storage.set(STUDENTS_KEY, students);

const normalizeStudent = (student) => {
  const name = normalizeText(student?.name, "Aluno");
  const studentKey = normalizeText(student?.studentKey, studentKeyFromName(name));
  const updatedAt = normalizeText(student?.updatedAt, new Date().toISOString());

  return {
    id: normalizeText(student?.id, studentIdFromKey(studentKey)),
    coachId: normalizeText(student?.coachId, DEMO_COACH_ID),
    studentKey,
    name,
    initials: normalizeText(student?.initials, initialsFromName(name)),
    goal: normalizeText(student?.goal, "Hipertrofia"),
    status: normalizeText(student?.status, "Ativo"),
    plan: normalizeText(student?.plan, "Atendimento"),
    workout: normalizeText(student?.workout, "Sem treino atribuido"),
    adherence: Number.isFinite(Number(student?.adherence)) ? Number(student.adherence) : 0,
    nextAction: normalizeText(student?.nextAction, "Criar primeiro treino"),
    createdAt: normalizeText(student?.createdAt, updatedAt),
    updatedAt
  };
};

const mergeStudents = (...lists) => {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach((item) => {
    const student = normalizeStudent(item);
    const previous = merged.get(student.id);
    if (!previous || new Date(student.updatedAt) >= new Date(previous.updatedAt)) merged.set(student.id, student);
  });
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

const toRow = (student) => ({
  id: student.id,
  coach_id: DEMO_COACH_ID,
  student_key: student.studentKey,
  name: student.name,
  initials: student.initials,
  goal: student.goal,
  status: student.status,
  plan: student.plan,
  workout: student.workout,
  adherence: student.adherence,
  next_action: student.nextAction,
  created_at: student.createdAt,
  updated_at: student.updatedAt
});

const toAppStudent = (row) => normalizeStudent({
  id: row.id,
  coachId: row.coach_id,
  studentKey: row.student_key,
  name: row.name,
  initials: row.initials,
  goal: row.goal,
  status: row.status,
  plan: row.plan,
  workout: row.workout,
  adherence: row.adherence,
  nextAction: row.next_action,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createStudentFromProfessorForm = ({ name, goal, status }) => {
  const normalizedName = normalizeText(name, "Aluno");
  const studentKey = studentKeyFromName(normalizedName);
  const now = new Date().toISOString();

  return normalizeStudent({
    id: studentIdFromKey(studentKey),
    studentKey,
    name: normalizedName,
    initials: initialsFromName(normalizedName),
    goal,
    status,
    plan: "Atendimento",
    workout: "Sem treino atribuido",
    adherence: 0,
    nextAction: "Criar primeiro treino",
    createdAt: now,
    updatedAt: now
  });
};

export const studentRepository = {
  listStudents() {
    return mergeStudents(readStudents());
  },

  saveStudent(student) {
    const normalized = normalizeStudent(student);
    const next = mergeStudents(normalized, this.listStudents());
    writeStudents(next);
    return normalized;
  },

  async syncStudent(student) {
    const normalized = this.saveStudent(student);
    const client = await getSupabase();
    if (!client) return { synced: false, reason: "not-configured", student: normalized };

    try {
      const { error } = await client
        .from(TABLE)
        .upsert(toRow(normalized), { onConflict: "id" });
      return { synced: !error, error, student: normalized };
    } catch (error) {
      return { synced: false, error, student: normalized };
    }
  },

  async fetchStudents() {
    const localStudents = this.listStudents();
    const client = await getSupabase();
    if (!client) return { synced: false, reason: "not-configured", students: localStudents };

    try {
      const { data, error } = await client
        .from(TABLE)
        .select("id, coach_id, student_key, name, initials, goal, status, plan, workout, adherence, next_action, created_at, updated_at")
        .eq("coach_id", DEMO_COACH_ID)
        .order("name", { ascending: true });
      if (error) return { synced: false, error, students: localStudents };

      const cloudStudents = (data || []).map(toAppStudent);
      const merged = mergeStudents(cloudStudents, localStudents);
      writeStudents(merged);
      return { synced: true, students: merged };
    } catch (error) {
      return { synced: false, error, students: localStudents };
    }
  }
};
