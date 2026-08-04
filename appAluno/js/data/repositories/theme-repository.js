import { getSupabase } from "../../core/supabase.js";
import { Platform } from "../../core/platform.js";
import { LEGACY_REMOTE_THEME_KEY, REMOTE_THEME_KEY, normalizeBrandTheme } from "../../core/brand-theme.js";
import { authRepository } from "./auth-repository.js";

const TABLE = "brand_theme";
const THEME_COLUMNS_BASE = "brand_name, tagline, accent, mode";
const THEME_COLUMNS_EXTENDED = [
  THEME_COLUMNS_BASE,
  "background_color",
  "surface_color",
  "text_color",
  "font_preset",
  "radius_preset",
  "background_style"
].join(", ");

// O app usa camelCase; o banco usa snake_case. A conversao fica confinada aqui.
// O cache local guarda o shape do app (camelCase), entao aceitamos ambos.
const toAppTheme = (row) => row ? normalizeBrandTheme(row) : null;

const isMissingThemeColumn = (error) => {
  const message = String(error?.message || "");
  return error?.code === "42703"
    || error?.code === "PGRST204"
    || /column .* does not exist/i.test(message)
    || /could not find .* column/i.test(message);
};

const readCachedTheme = () => {
  const current = Platform.storage.get(REMOTE_THEME_KEY);
  if (current) return toAppTheme(current);

  const legacy = Platform.storage.get(LEGACY_REMOTE_THEME_KEY);
  if (!legacy) return null;

  const migrated = toAppTheme(legacy);
  Platform.storage.set(REMOTE_THEME_KEY, migrated);
  return migrated;
};

const writeCachedTheme = (theme) => {
  const normalized = normalizeBrandTheme(theme);
  Platform.storage.set(REMOTE_THEME_KEY, normalized);
  Platform.storage.set(LEGACY_REMOTE_THEME_KEY, normalized);
  return normalized;
};

export const themeRepository = {
  // Retorna o tema de marca branca (ou null). Busca na nuvem e cai no cache local.
  async fetchBrandTheme() {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (client) {
      try {
        let query = client
          .from(TABLE)
          .select(THEME_COLUMNS_EXTENDED)
          .limit(1);

        if (authContext?.role === "coach") query = query.eq("coach_id", authContext.coachId);

        let { data, error } = await query;
        if (isMissingThemeColumn(error)) {
          query = client
            .from(TABLE)
            .select(THEME_COLUMNS_BASE)
            .limit(1);

          if (authContext?.role === "coach") query = query.eq("coach_id", authContext.coachId);
          const fallback = await query;
          data = fallback.data;
          error = fallback.error;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row) {
          const theme = toAppTheme(row);
          writeCachedTheme(theme);
          return theme;
        }
      } catch {
        // offline: usa o cache local abaixo
      }
    }
    return readCachedTheme();
  },

  // Salva o tema localmente (otimista) e tenta sincronizar com a nuvem.
  async saveBrandTheme(theme) {
    const normalized = writeCachedTheme(theme);
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authContext?.user || authContext.role !== "coach") {
      return { synced: false, reason: "not-authenticated-as-coach", theme: normalized };
    }
    try {
      const payload = {
        coach_id: authContext.coachId,
        brand_name: normalized.brandName,
        tagline: normalized.tagline,
        accent: normalized.accent,
        mode: normalized.mode,
        background_color: normalized.backgroundColor,
        surface_color: normalized.surfaceColor,
        text_color: normalized.textColor,
        font_preset: normalized.fontPreset,
        radius_preset: normalized.radiusPreset,
        background_style: normalized.backgroundStyle,
        updated_at: new Date().toISOString()
      };

      let { error } = await client
        .from(TABLE)
        .upsert(payload, { onConflict: "coach_id" });

      let partial = false;
      if (isMissingThemeColumn(error)) {
        partial = true;
        const fallback = await client
          .from(TABLE)
          .upsert({
          coach_id: authContext.coachId,
          brand_name: normalized.brandName,
          tagline: normalized.tagline,
          accent: normalized.accent,
          mode: normalized.mode,
          updated_at: new Date().toISOString()
          }, { onConflict: "coach_id" });
        error = fallback.error;
      }

      return { synced: !error, error, partial, theme: normalized };
    } catch (error) {
      return { synced: false, error, theme: normalized };
    }
  }
};
