import { Platform } from "./platform.js?v=build-20260809-6";

const APP_STATE_KEY = "flowfit.aluno.state";

const createDefaultState = () => ({
  onboarded: false,
  localProfile: {},
  activeWorkoutId: null,
  activeSession: null,
  setLogs: {},
  exerciseLogs: {},
  progressEntries: [],
  sessions: [],
  scheduleFilter: "Todos",
  customScheduleItems: [],
  dismissedReminders: [],
  readNotifications: []
});

const normalizeScopeId = (scopeId) => encodeURIComponent(String(scopeId || "anonymous").trim() || "anonymous");
const stateKeyForScope = (scopeId) => `${APP_STATE_KEY}:${normalizeScopeId(scopeId)}`;
const loadState = (scopeId) => ({
  ...createDefaultState(),
  ...Platform.storage.get(stateKeyForScope(scopeId), {})
});

export const Store = {
  scopeId: "anonymous",
  state: loadState("anonymous"),
  useScope(scopeId = "anonymous") {
    this.scopeId = String(scopeId || "anonymous").trim() || "anonymous";
    this.state = loadState(this.scopeId);
    return this.state;
  },
  save() {
    Platform.storage.set(stateKeyForScope(this.scopeId), this.state);
  },
  completeOnboarding(profile = {}) {
    this.state.onboarded = true;
    this.state.localProfile = { ...this.state.localProfile, ...profile };
    this.save();
  },
  resetOnboarding() {
    this.state.onboarded = false;
    this.save();
  },
  getStudent(baseProfile) {
    const profile = { ...baseProfile, ...(this.state.localProfile || {}) };
    const initials = profile.name
      ? profile.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
      : baseProfile.initials;
    return { ...profile, initials };
  },
  getExerciseDone(exerciseId) {
    return Number(this.state.setLogs?.[exerciseId] || 0);
  },
  setExerciseDone(exerciseId, done) {
    this.state.setLogs = { ...this.state.setLogs, [exerciseId]: done };
    this.save();
  },
  getExerciseLog(exerciseId, fallback = {}) {
    return { ...fallback, ...(this.state.exerciseLogs?.[exerciseId] || {}) };
  },
  setExerciseLog(exerciseId, nextLog) {
    const previous = this.state.exerciseLogs?.[exerciseId] || {};
    this.state.exerciseLogs = {
      ...this.state.exerciseLogs,
      [exerciseId]: { ...previous, ...nextLog }
    };
    this.save();
  },
  getActiveSession() {
    return this.state.activeSession && typeof this.state.activeSession === "object"
      ? this.state.activeSession
      : null;
  },
  startActiveSession(session) {
    this.state.activeWorkoutId = session.workoutId || null;
    this.state.activeSession = {
      ...session,
      setEntries: Array.isArray(session.setEntries) ? session.setEntries : []
    };
    this.save();
    return this.state.activeSession;
  },
  updateActiveSession(patch = {}) {
    const current = this.getActiveSession();
    if (!current) return null;
    this.state.activeSession = { ...current, ...patch };
    this.save();
    return this.state.activeSession;
  },
  addActiveSetEntry(entry) {
    const current = this.getActiveSession();
    if (!current) return null;
    const entries = Array.isArray(current.setEntries) ? current.setEntries : [];
    this.state.activeSession = {
      ...current,
      setEntries: [...entries.filter((item) => !(
        item.exerciseId === entry.exerciseId && Number(item.setNumber) === Number(entry.setNumber)
      )), entry].sort((a, b) => Number(a.exercisePosition || 0) - Number(b.exercisePosition || 0)
        || Number(a.setNumber || 0) - Number(b.setNumber || 0))
    };
    this.save();
    return entry;
  },
  removeActiveSetEntry(exerciseId, setNumber) {
    const current = this.getActiveSession();
    if (!current) return null;
    const entries = Array.isArray(current.setEntries) ? current.setEntries : [];
    const target = entries.find((item) => item.exerciseId === exerciseId && Number(item.setNumber) === Number(setNumber));
    if (!target) return null;
    this.state.activeSession = {
      ...current,
      setEntries: entries.filter((item) => item !== target),
      phase: "exercise",
      currentExerciseId: exerciseId,
      currentSetNumber: Number(setNumber),
      restEndsAt: null
    };
    this.save();
    return target;
  },
  clearActiveSession() {
    this.state.activeSession = null;
    this.state.activeWorkoutId = null;
    this.state.setLogs = {};
    this.state.exerciseLogs = {};
    this.save();
  },
  resetWorkout(workoutId) {
    this.state.activeWorkoutId = workoutId;
    this.state.activeSession = null;
    this.state.setLogs = {};
    this.state.exerciseLogs = {};
    this.save();
  },
  addSession(session) {
    this.state.sessions = [
      session,
      ...(this.state.sessions || []).filter((item) => item?.id !== session?.id)
    ].slice(0, 12);
    this.state.setLogs = {};
    this.state.exerciseLogs = {};
    this.save();
  },
  setSessions(sessions = []) {
    const merged = new Map([...(this.state.sessions || []), ...sessions]
      .filter(Boolean)
      .map((session) => [session.id, session]));
    this.state.sessions = [...merged.values()]
      .sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0))
      .slice(0, 20);
    this.save();
  },
  getProgressEntries(defaultEntries = []) {
    const entries = this.state.progressEntries?.length ? this.state.progressEntries : defaultEntries;
    return [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  },
  addProgressEntry(entry) {
    this.state.progressEntries = [...this.getProgressEntries(), entry].slice(-12);
    this.save();
  },
  getScheduleItems(defaultItems = []) {
    return [...defaultItems, ...(this.state.customScheduleItems || [])];
  },
  addScheduleItem(item) {
    this.state.customScheduleItems = [item, ...(this.state.customScheduleItems || [])].slice(0, 8);
    this.save();
  },
  setScheduleFilter(filter) {
    this.state.scheduleFilter = filter;
    this.save();
  },
  toggleReminder(itemId) {
    const current = new Set(this.state.dismissedReminders || []);
    if (current.has(itemId)) current.delete(itemId);
    else current.add(itemId);
    this.state.dismissedReminders = [...current];
    this.save();
  },
  isReminderDone(itemId) {
    return (this.state.dismissedReminders || []).includes(itemId);
  },
  markNotificationRead(itemId) {
    const current = new Set(this.state.readNotifications || []);
    current.add(itemId);
    this.state.readNotifications = [...current];
    this.save();
  },
  markAllNotificationsRead(notificationIds = []) {
    this.state.readNotifications = [...new Set([...(this.state.readNotifications || []), ...notificationIds])];
    this.save();
  },
  isNotificationRead(itemId) {
    return (this.state.readNotifications || []).includes(itemId);
  }
};
