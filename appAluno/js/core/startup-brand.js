import { Platform } from "./platform.js?v=build-20260813-1";
import { DEFAULT_BRAND_THEME, applyThemeTokens, normalizeBrandTheme } from "./brand-theme.js?v=build-20260818-1";

const STARTUP_SCOPE = location.pathname.includes("appProfessor") ? "professor" : "aluno";
export const STARTUP_BRAND_KEY = `flowfit.startup-brand.v1:${STARTUP_SCOPE}`;
const MAX_CACHED_LOGO_BYTES = 768 * 1024;
const MAX_DATA_URL_LENGTH = 1_100_000;
const MIN_SPLASH_TIME_MS = 720;
const SPLASH_EXIT_MS = 260;
let lastSignature = "";
let pendingLogoUrl = "";
let splashFinished = false;

const readStored = () => Platform.storage.get(STARTUP_BRAND_KEY, null);

export const getStartupBrand = () => {
  const runtime = window.FlowFitStartup?.brand;
  const stored = readStored();
  const source = stored?.theme ? stored : runtime;
  if (!source?.theme) return null;
  return {
    version: 1,
    theme: normalizeBrandTheme(source.theme),
    logoDataUrl: String(source.logoDataUrl || ""),
    logoRemoteUrl: String(source.logoRemoteUrl || ""),
    updatedAt: String(source.updatedAt || "")
  };
};

export const hasStartupBrand = () => Boolean(getStartupBrand()?.theme);

const publishRuntimeBrand = (brand) => {
  if (!window.FlowFitStartup) return;
  window.FlowFitStartup.brand = brand;
  window.FlowFitStartup.apply?.(brand);
  window.FlowFitStartup.paint?.(document.querySelector("[data-app-startup-splash]"), brand);
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
  reader.addEventListener("error", () => reject(reader.error), { once: true });
  reader.readAsDataURL(blob);
});

const cacheRemoteLogo = async (remoteUrl, expectedSignature) => {
  if (!remoteUrl || remoteUrl === pendingLogoUrl || !/^https?:/i.test(remoteUrl)) return;
  pendingLogoUrl = remoteUrl;
  try {
    const response = await fetch(remoteUrl, { cache: "force-cache", credentials: "omit" });
    if (!response.ok) return;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > MAX_CACHED_LOGO_BYTES) return;
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl || dataUrl.length > MAX_DATA_URL_LENGTH) return;
    const current = readStored();
    if (!current?.theme || current.logoRemoteUrl !== remoteUrl || lastSignature !== expectedSignature) return;
    const next = { ...current, logoDataUrl: dataUrl };
    Platform.storage.set(STARTUP_BRAND_KEY, next);
    publishRuntimeBrand(next);
  } catch {
    // A URL pública continua utilizável; o Data URL é apenas reforço offline.
  } finally {
    if (pendingLogoUrl === remoteUrl) pendingLogoUrl = "";
  }
};

export const cacheStartupBrand = (theme, { logoSource = "" } = {}) => {
  const normalized = normalizeBrandTheme(theme);
  const previous = readStored();
  const source = String(logoSource || normalized.logoUrl || "").trim();
  const isUncustomizedDefault = !source
    && normalized.brandName === DEFAULT_BRAND_THEME.brandName
    && normalized.tagline === DEFAULT_BRAND_THEME.tagline
    && normalized.accent === DEFAULT_BRAND_THEME.accent
    && normalized.backgroundColor === DEFAULT_BRAND_THEME.backgroundColor
    && normalized.surfaceColor === DEFAULT_BRAND_THEME.surfaceColor
    && normalized.textColor === DEFAULT_BRAND_THEME.textColor;
  if (!previous?.theme && isUncustomizedDefault) return null;
  const sourceIsDataUrl = source.startsWith("data:image/") && source.length <= MAX_DATA_URL_LENGTH;
  const remoteUrl = sourceIsDataUrl ? String(normalized.logoUrl || "") : source;
  const canReuseDataUrl = Boolean(previous?.logoDataUrl)
    && Boolean(remoteUrl)
    && previous.logoRemoteUrl === remoteUrl;
  const next = {
    version: 1,
    theme: normalized,
    logoDataUrl: sourceIsDataUrl ? source : (canReuseDataUrl ? previous.logoDataUrl : ""),
    logoRemoteUrl: remoteUrl,
    updatedAt: normalized.updatedAt || new Date().toISOString()
  };
  const signature = JSON.stringify({ theme: next.theme, logoRemoteUrl: next.logoRemoteUrl, hasDataUrl: Boolean(next.logoDataUrl) });
  lastSignature = signature;
  Platform.storage.set(STARTUP_BRAND_KEY, next);
  publishRuntimeBrand(next);
  if (!sourceIsDataUrl && remoteUrl && !next.logoDataUrl) void cacheRemoteLogo(remoteUrl, signature);
  return next;
};

export const applyStartupBrand = () => {
  const startup = getStartupBrand();
  if (!startup?.theme) return null;
  return applyThemeTokens(startup.theme);
};

export const finishStartupSplash = () => {
  if (splashFinished) return;
  splashFinished = true;
  const splash = document.querySelector("[data-app-startup-splash]");
  if (!splash) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const startedAt = Number(window.FlowFitStartup?.startedAt || performance.now());
  const delay = reducedMotion ? 0 : Math.max(0, MIN_SPLASH_TIME_MS - (performance.now() - startedAt));
  window.setTimeout(() => {
    splash.classList.add("is-leaving");
    splash.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      splash.hidden = true;
      document.body.classList.remove("has-startup-splash");
    }, reducedMotion ? 0 : SPLASH_EXIT_MS);
  }, delay);
};
