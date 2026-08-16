export const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export const parseTotalSets = (exercise) => {
  const match = String(exercise?.prescription || "").match(/\d+/);
  return Number.parseInt(match?.[0] || "1", 10) || 1;
};

export const parseRestSeconds = (exercise) => Number.parseInt(exercise?.rest, 10) || 45;

export const parseLoadKg = (value) => Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.]/g, "")) || 0;

export const parseReps = (exercise) => {
  const match = String(exercise?.prescription || "").match(/x\s*(\d+)/i);
  return Number.parseInt(match?.[1] || "10", 10) || 10;
};

export const formatDecimal = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const formatVolume = (value) => {
  const volumeKg = Math.max(0, Number(value) || 0);
  return volumeKg > 0
    ? `${(volumeKg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`
    : "0 kg";
};

export const formatSetPerformance = (loadKg, reps) => Number(loadKg) > 0
  ? `${formatDecimal(loadKg)} kg × ${Number(reps || 0)}`
  : `${Number(reps || 0)} reps`;

export const formatShortDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(date));

export const formatDateTime = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date || "Sem data");
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

export const formatScheduleTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "Sem horário");
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

export const formatMonthYear = (date) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(date));

export const formatDelta = (current, previous, unit) => {
  if (previous === undefined) return `0 ${unit}`;
  const delta = Number(current) - Number(previous);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta)} ${unit}`;
};

export const deltaTone = (current, previous) => {
  const delta = Number(current) - Number(previous);
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
};

export const formatClock = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export const formatWorkoutElapsed = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safeSeconds < 3600) return formatClock(safeSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
};

export const formatWorkoutDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safeSeconds < 60) return "<1 min";
  if (safeSeconds < 3600) return `${Math.round(safeSeconds / 60)} min`;
  const roundedMinutes = Math.round(safeSeconds / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes ? `${hours}h ${minutes} min` : `${hours}h`;
};
