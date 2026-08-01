export const DEFAULT_BRAND_THEME = {
  mode: "dark",
  accent: "#7667ff",
  brandName: "FlowFit",
  tagline: "Seu treino, no seu ritmo"
};

export const LOCAL_THEME_KEY = "flowfit.theme";
export const REMOTE_THEME_KEY = "flowfit.brand-theme";
export const LEGACY_REMOTE_THEME_KEY = "flowfit.remote-theme";

const isValidHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));

export const normalizeBrandTheme = (theme = {}) => ({
  mode: theme.mode === "light" ? "light" : "dark",
  accent: isValidHex(theme.accent) ? theme.accent : DEFAULT_BRAND_THEME.accent,
  brandName: String(theme.brandName || theme.brand_name || DEFAULT_BRAND_THEME.brandName).trim() || DEFAULT_BRAND_THEME.brandName,
  tagline: String(theme.tagline || DEFAULT_BRAND_THEME.tagline).trim() || DEFAULT_BRAND_THEME.tagline
});

export const hexToHsl = (hex) => {
  const safeHex = isValidHex(hex) ? hex : DEFAULT_BRAND_THEME.accent;
  const value = safeHex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (!delta) {
    return {
      hue: 246,
      saturation: 0,
      lightness: Math.round(lightness * 100)
    };
  }

  let hue = max === red
    ? ((green - blue) / delta) % 6
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;

  hue = Math.round(hue * 60);
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100)
  };
};

export const applyThemeTokens = (theme) => {
  const normalized = normalizeBrandTheme(theme);
  const accent = hexToHsl(normalized.accent);
  const root = document.documentElement;

  root.dataset.mode = normalized.mode;
  root.style.setProperty("--hue-accent", String(accent.hue));
  root.style.setProperty("--accent-saturation", `${accent.saturation}%`);
  root.style.setProperty("--accent-lightness", `${accent.lightness}%`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", normalized.accent);

  return normalized;
};
