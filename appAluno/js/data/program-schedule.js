const positiveInteger = (value, fallback = 1) => {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeProgramSessionSlot = (session = {}, index = 0) => {
  const rawWeek = positiveInteger(session.week, 1);
  const rawDay = positiveInteger(session.day, index + 1);
  return {
    week: rawWeek + Math.floor((rawDay - 1) / 7),
    day: ((rawDay - 1) % 7) + 1,
    position: Math.max(0, Math.trunc(Number(session.position ?? index)) || 0)
  };
};

export const compareProgramSessions = (left = {}, right = {}) => {
  const leftSlot = normalizeProgramSessionSlot(left);
  const rightSlot = normalizeProgramSessionSlot(right);
  return leftSlot.week - rightSlot.week
    || leftSlot.day - rightSlot.day
    || leftSlot.position - rightSlot.position
    || String(left.id || "").localeCompare(String(right.id || ""));
};

const localDate = (value) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const getProgramSessionStart = (startsAt, session = {}) => {
  const base = localDate(startsAt);
  if (!base) return null;
  const slot = normalizeProgramSessionSlot(session);
  base.setDate(base.getDate() + ((slot.week - 1) * 7) + (slot.day - 1));
  return base;
};

export const buildProgramSchedule = (program = {}, startsAt) => (
  [...(Array.isArray(program.sessions) ? program.sessions : [])]
    .sort(compareProgramSessions)
    .map((session) => ({
      ...session,
      ...normalizeProgramSessionSlot(session),
      startsAt: getProgramSessionStart(startsAt, session)
    }))
);
