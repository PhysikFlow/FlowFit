import { getSupabase } from "../../core/supabase.js?v=build-20260812-5";
import { Platform } from "../../core/platform.js?v=build-20260813-1";
import { LEGACY_REMOTE_THEME_KEY, REMOTE_THEME_KEY, normalizeBrandTheme } from "../../core/brand-theme.js?v=build-20260814-1";
import { authRepository } from "./auth-repository.js?v=build-20260812-5";

const TABLE = "brand_theme";
const THEME_COLUMNS_BASE = "coach_id, brand_name, tagline, accent, mode, updated_at";
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
const toAppTheme = (row) => row ? {
  ...normalizeBrandTheme(row),
  coachId: String(row.coach_id || row.coachId || ""),
  updatedAt: String(row.updated_at || row.updatedAt || "")
} : null;

const isMissingThemeColumn = (error) => {
  const message = String(error?.message || "");
  return error?.code === "42703"
    || error?.code === "PGRST204"
    || /column .* does not exist/i.test(message)
    || /could not find .* column/i.test(message);
};

const scopedThemeKey = (userId, coachId) => `${REMOTE_THEME_KEY}:${String(userId || "anonymous")}:${String(coachId || "none")}`;

const readCachedTheme = ({ userId, coachId, allowLegacy = false } = {}) => {
  const current = Platform.storage.get(scopedThemeKey(userId, coachId));
  if (current) return toAppTheme(current);

  if (!allowLegacy) return null;
  const legacy = Platform.storage.get(LEGACY_REMOTE_THEME_KEY);
  if (!legacy) return null;

  const migrated = toAppTheme(legacy);
  Platform.storage.set(scopedThemeKey(userId, coachId), migrated);
  return migrated;
};

const writeCachedTheme = (theme, { userId, coachId } = {}) => {
  const normalized = toAppTheme({ ...theme, coach_id: coachId || theme?.coachId, updated_at: theme?.updatedAt });
  Platform.storage.set(scopedThemeKey(userId, coachId), normalized);
  return normalized;
};

const clearCachedTheme = ({ userId, coachId } = {}) => {
  Platform.storage.remove(scopedThemeKey(userId, coachId));
};

export const themeRepository = {
  // Retorna o tema de marca branca (ou null). Busca na nuvem e cai no cache local.
  async fetchBrandTheme(coachId = "") {
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    const resolvedCoachId = String(coachId || (authRepository.canWriteAsCoach(authContext) ? authContext.coachId : "")).trim();
    const cacheContext = {
      userId: authContext?.user?.id || "anonymous",
      coachId: resolvedCoachId
    };
    if (!resolvedCoachId) return null;
    if (client) {
      try {
        let query = client
          .from(TABLE)
          .select(THEME_COLUMNS_EXTENDED)
          .eq("coach_id", resolvedCoachId)
          .maybeSingle();

        let { data, error } = await query;
        if (isMissingThemeColumn(error)) {
          query = client
            .from(TABLE)
            .select(THEME_COLUMNS_BASE)
            .eq("coach_id", resolvedCoachId)
            .maybeSingle();
          const fallback = await query;
          data = fallback.data;
          error = fallback.error;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!error) {
          if (row) {
            const theme = toAppTheme(row);
            writeCachedTheme(theme, cacheContext);
            return theme;
          }

          // Resposta online e vazia e autoritativa: nao reutiliza tema de outra
          // conta ou de um banco que acabou de ser limpo.
          clearCachedTheme(cacheContext);
          return null;
        }
      } catch {
        // offline: usa o cache local abaixo
      }
    }
    return readCachedTheme({ ...cacheContext, allowLegacy: authRepository.canWriteAsCoach(authContext) });
  },

  // Salva o tema localmente (otimista) e tenta sincronizar com a nuvem.
  async saveBrandTheme(theme) {
    const normalized = normalizeBrandTheme(theme);
    const client = await getSupabase();
    const authContext = await authRepository.getAuthContext();
    if (!client || !authContext?.user || !authRepository.canWriteAsCoach(authContext)) {
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

      let { data, error } = await client
        .from(TABLE)
        .upsert(payload, { onConflict: "coach_id" })
        .select(THEME_COLUMNS_EXTENDED)
        .single();

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
          updated_at: payload.updated_at
          }, { onConflict: "coach_id" })
          .select(THEME_COLUMNS_BASE)
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error || !data) return { synced: false, error, partial, theme: normalized };
      const confirmedTheme = writeCachedTheme(toAppTheme(data), {
        userId: authContext.user.id,
        coachId: authContext.coachId
      });
      return { synced: true, error: null, partial, theme: confirmedTheme, updatedAt: confirmedTheme.updatedAt };
    } catch (error) {
      return { synced: false, error, theme: normalized };
    }
  }
};
