import { DEMO_COACH_ID } from "../../config.js?v=build-20260809-6";
import { Platform } from "../../core/platform.js?v=build-20260813-1";
import { getSupabase } from "../../core/supabase.js?v=build-20260812-5";
import { authRepository } from "./auth-repository.js?v=build-20260812-5";
import { studentKeyFromName } from "./workout-repository.js?v=build-20260813-1";

export const STUDENTS_KEY = "flowfit.students";

const TABLE = "students";
const CLOUD_STUDENT_SELECT = [
  "id",
  "coach_id",
  "student_key",
  "student_user_id",
  "email",
  "name",
  "initials",
  "goal",
  "status",
  "plan",
  "workout",
  "adherence",
  "next_action",
  "invite_token",
  "invite_status",
  "invite_expires_at",
  "invite_claimed_at",
  "created_at",
  "updated_at"
].join(", ");

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeEmail = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  return text || "";
};

const createId = (prefix) => {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

export const initialsFromName = (name) => normalizeText(name, "Aluno")
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase() || "AL";

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
    id: normalizeText(student?.id, createId("student")),
    coachId: normalizeText(student?.coachId, DEMO_COACH_ID),
    studentKey,
    studentUserId: normalizeText(student?.studentUserId, ""),
    email: normalizeEmail(student?.email),
    name,
    initials: normalizeText(student?.initials, initialsFromName(name)),
    goal: normalizeText(student?.goal, "Hipertrofia"),
    status: normalizeText(student?.status, "Ativo"),
    plan: normalizeText(student?.plan, "Atendimento"),
    workout: normalizeText(student?.workout, "Sem treino atribuído"),
    adherence: Number.isFinite(Number(student?.adherence)) ? Number(student.adherence) : 0,
    nextAction: normalizeText(student?.nextAction, "Criar primeiro treino"),
    inviteToken: normalizeText(student?.inviteToken, ""),
    inviteStatus: normalizeText(student?.inviteStatus, "pending"),
    inviteExpiresAt: normalizeText(student?.inviteExpiresAt, ""),
    inviteClaimedAt: normalizeText(student?.inviteClaimedAt, ""),
    coachName: normalizeText(student?.coachName, "Personal"),
    coachHeadline: normalizeText(student?.coachHeadline, "Acompanhamento personalizado"),
    createdAt: normalizeText(student?.createdAt, updatedAt),
    updatedAt
  };
};

const mergeStudents = (...lists) => {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach((item) => {
    const student = normalizeStudent(item);
    const key = student.email
      ? `${student.coachId}:email:${student.email}`
      : student.id || `${student.coachId}:key:${student.studentKey}`;
    const previous = merged.get(key);
    if (!previous || new Date(student.updatedAt) > new Date(previous.updatedAt)) merged.set(key, student);
  });
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

const toRow = (student, authContext) => ({
  id: student.id,
  coach_id: authContext?.coachId || student.coachId,
  student_key: student.studentKey,
  email: student.email || null,
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
  studentUserId: row.student_user_id,
  email: row.email,
  name: row.name,
  initials: row.initials,
  goal: row.goal,
  status: row.status,
  plan: row.plan,
  workout: row.workout,
  adherence: row.adherence,
  nextAction: row.next_action,
  inviteToken: row.invite_token,
  inviteStatus: row.invite_status,
  inviteExpiresAt: row.invite_expires_at,
  inviteClaimedAt: row.invite_claimed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createStudentFromProfessorForm = ({ name, email, goal, status }) => {
  const normalizedName = normalizeText(name, "Aluno");
  const studentKey = studentKeyFromName(normalizedName);
  const now = new Date().toISOString();

  return normalizeStudent({
    id: createId(`student-${studentKey}`),
    studentKey,
    email,
    name: normalizedName,
    initials: initialsFromName(normalizedName),
    goal,
    status,
    plan: "Atendimento",
    workout: "Sem treino atribuído",
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
    const authContext = await authRepository.getAuthContext();
    const normalized = this.saveStudent({ ...student, coachId: authContext?.coachId || student?.coachId });
    const client = await getSupabase();
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
      return { synced: false, reason: "not-authenticated-as-coach", student: normalized };
    }

    try {
      const { data, error } = await client
        .from(TABLE)
        .upsert(toRow(normalized, authContext), { onConflict: "id" })
        .select(CLOUD_STUDENT_SELECT)
        .maybeSingle();
      const syncedStudent = data ? toAppStudent(data) : normalized;
      if (data) this.saveStudent(syncedStudent);
      return { synced: !error, error, student: syncedStudent };
    } catch (error) {
      return { synced: false, error, student: normalized };
    }
  },

  async fetchStudents() {
    const localStudents = this.listStudents();
    const authContext = await authRepository.getAuthContext();
    const client = await getSupabase();
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
      return { synced: false, reason: "not-authenticated-as-coach", students: localStudents };
    }

    try {
      const { data, error } = await client
        .from(TABLE)
        .select(CLOUD_STUDENT_SELECT)
        .eq("coach_id", authContext.coachId)
        .order("name", { ascending: true });
      if (error) return { synced: false, error, students: localStudents };

      const cloudStudents = (data || []).map(toAppStudent);
      writeStudents(cloudStudents);
      return { synced: true, students: cloudStudents };
    } catch (error) {
      return { synced: false, error, students: localStudents };
    }
  },

  async fetchCurrentStudent({ preferredStudentId = "" } = {}) {
    const authContext = await authRepository.getAuthContext();
    const client = await getSupabase();
    if (!client || !authContext?.user) return { synced: false, reason: "not-authenticated", student: null };

    try {
      const { data: byUserId, error: userIdError } = await client
        .from(TABLE)
        .select(CLOUD_STUDENT_SELECT)
        .eq("student_user_id", authContext.user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (userIdError) return { synced: false, error: userIdError, student: null };

      const uniqueRows = new Map();
      (byUserId || []).forEach((row) => {
        if (row?.id) uniqueRows.set(row.id, row);
      });

      const coachIds = [...new Set([...uniqueRows.values()].map((row) => row.coach_id).filter(Boolean))];
      let coachProfiles = [];
      if (coachIds.length) {
        const profileResult = await client
          .from("profiles")
          .select("user_id, name, headline")
          .in("user_id", coachIds);
        if (!profileResult.error) coachProfiles = profileResult.data || [];
      }
      const coachById = new Map(coachProfiles.map((profile) => [String(profile.user_id), profile]));
      const students = [...uniqueRows.values()]
        .map((row) => {
          const coach = coachById.get(String(row.coach_id));
          return normalizeStudent({
            ...toAppStudent(row),
            coachName: coach?.name || "Personal",
            coachHeadline: coach?.headline || "Acompanhamento personalizado"
          });
        })
        .sort((a, b) => a.coachName.localeCompare(b.coachName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
      const student = students.find((item) => preferredStudentId && item.id === preferredStudentId)
        || students.find((item) => item.studentUserId === authContext.user.id)
        || students[0]
        || null;
      if (student) this.saveStudent(student);
      return { synced: true, student, students, multiple: students.length > 1 };
    } catch (error) {
      return { synced: false, error, student: null };
    }
  },

  async validateInvite({ token, email } = {}) {
    const client = await getSupabase();
    if (!client || !token) return { valid: false, reason: "invite-required" };

    try {
      const { data, error } = await client
        .rpc("validate_student_invite", { p_token: token, p_email: normalizeEmail(email) || null });
      const result = Array.isArray(data) ? data[0] : data;
      if (error) return { valid: false, error, reason: "invite-validation-failed" };
      return {
        valid: Boolean(result?.valid),
        emailMatches: result?.email_matches !== false,
        reason: result?.reason || "invite-invalid"
      };
    } catch (error) {
      return { valid: false, error, reason: "invite-validation-failed" };
    }
  },

  async claimAccess(token = "") {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authContext?.user) {
      return { claimed: false, reason: "not-authenticated" };
    }

    try {
      const { data, error } = await client.rpc("claim_student_access", { p_token: String(token || "").trim() || null });
      if (error) return { claimed: false, error, reason: "student-access-claim-failed" };
      const accesses = (Array.isArray(data) ? data : [data]).filter(Boolean).map((item) => ({
        studentId: item.student_id || "",
        coachId: item.coach_id || "",
        method: item.access_method || "email"
      }));
      return { claimed: accesses.length > 0, studentId: accesses[0]?.studentId || "", accesses };
    } catch (error) {
      return { claimed: false, error, reason: "student-access-claim-failed" };
    }
  },

  async claimInvite(token) {
    return this.claimAccess(token);
  },

  async renewInvite(student) {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authContext?.user || !student?.id || !authRepository.canWriteAsCoach(authContext)) {
      return { renewed: false, reason: "not-authenticated-as-coach", student };
    }

    try {
      const { data, error } = await client.rpc("renew_student_invite", { p_student_id: student.id });
      if (error) return { renewed: false, error, reason: "invite-renew-failed", student };
      const result = Array.isArray(data) ? data[0] : data;
      const renewedStudent = normalizeStudent({
        ...student,
        inviteToken: result?.invite_token,
        inviteStatus: result?.invite_status,
        inviteExpiresAt: result?.invite_expires_at,
        inviteClaimedAt: "",
        updatedAt: new Date().toISOString()
      });
      this.saveStudent(renewedStudent);
      return { renewed: true, student: renewedStudent };
    } catch (error) {
      return { renewed: false, error, reason: "invite-renew-failed", student };
    }
  }
};
