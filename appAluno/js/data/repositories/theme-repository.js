import { getSupabase } from "../../core/supabase.js";
import { Platform } from "../../core/platform.js";
import { LEGACY_REMOTE_THEME_KEY, REMOTE_THEME_KEY, normalizeBrandTheme } from "../../core/brand-theme.js";
import { DEMO_COACH_ID } from "../../config.js";

const TABLE = "brand_theme";

// O app usa camelCase; o banco usa snake_case. A conversao fica confinada aqui.
// O cache local guarda o shape do app (camelCase), entao aceitamos ambos.
const toAppTheme = (row) => row ? normalizeBrandTheme(row) : null;

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
    if (client) {
      try {
        const { data, error } = await client
          .from(TABLE)
          .select("brand_name, tagline, accent, mode")
          .eq("coach_id", DEMO_COACH_ID)
          .maybeSingle();
        if (!error && data) {
          const theme = toAppTheme(data);
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
    if (!client) return { synced: false, theme: normalized };
    try {
      const { error } = await client
        .from(TABLE)
        .upsert({
          coach_id: DEMO_COACH_ID,
          brand_name: normalized.brandName,
          tagline: normalized.tagline,
          accent: normalized.accent,
          mode: normalized.mode,
          updated_at: new Date().toISOString()
        }, { onConflict: "coach_id" });
      return { synced: !error, error, theme: normalized };
    } catch (error) {
      return { synced: false, error, theme: normalized };
    }
  }
};
