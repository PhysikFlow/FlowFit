import { Platform } from "./platform.js";

const APP_STATE_KEY = "flowfit.aluno.state";

const defaultState = {
  onboarded: false,
  localProfile: {},
  activeWorkoutId: null,
  setLogs: {},
  exerciseLogs: {},
  progressEntries: [],
  sessions: [],
  scheduleFilter: "Todos",
  customScheduleItems: [],
  dismissedReminders: [],
  readNotifications: []
};

export const Store = {
  state: { ...defaultState, ...Platform.storage.get(APP_STATE_KEY, {}) },
  save() {
    Platform.storage.set(APP_STATE_KEY, this.state);
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
  resetWorkout(workoutId) {
    this.state.activeWorkoutId = workoutId;
    this.state.setLogs = {};
    this.state.exerciseLogs = {};
    this.save();
  },
  addSession(session) {
    this.state.sessions = [session, ...(this.state.sessions || [])].slice(0, 12);
    this.state.setLogs = {};
    this.state.exerciseLogs = {};
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
