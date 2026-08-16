export const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export const initialsFromName = (value) => {
  const parts = String(value || "Personal").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "PF").toUpperCase();
};

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const normalizeSearch = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export const formatUpdatedAt = (value) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

export const formatVolume = (value) => {
  const volumeKg = Math.max(0, Number(value) || 0);
  return volumeKg > 0
    ? `${(volumeKg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`
    : "0 kg";
};
