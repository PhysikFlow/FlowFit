export const MODE_PALETTES = {
  dark: {
    backgroundColor: "#090b10",
    surfaceColor: "#151922",
    textColor: "#f7f7fa"
  },
  light: {
    backgroundColor: "#f3f4f7",
    surfaceColor: "#ffffff",
    textColor: "#151722"
  }
};

export const DEFAULT_BRAND_THEME = {
  mode: "dark",
  accent: "#7667ff",
  brandName: "FlowFit",
  tagline: "Seu treino, no seu ritmo",
  backgroundColor: MODE_PALETTES.dark.backgroundColor,
  surfaceColor: MODE_PALETTES.dark.surfaceColor,
  textColor: MODE_PALETTES.dark.textColor,
  fontPreset: "system",
  radiusPreset: "soft",
  backgroundStyle: "aurora"
};

export const LOCAL_THEME_KEY = "flowfit.theme";
export const REMOTE_THEME_KEY = "flowfit.brand-theme";
export const LEGACY_REMOTE_THEME_KEY = "flowfit.remote-theme";
export const LOCAL_BRAND_ASSETS_KEY = "flowfit.brand-assets";

const isValidHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));

const allowed = (value, options, fallback) => options.includes(value) ? value : fallback;

const FONT_STACKS = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"Segoe UI Rounded", "Nunito", "Aptos Rounded", ui-rounded, system-ui, sans-serif',
  geometric: '"Montserrat", "Aptos", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
  editorial: 'Georgia, "Times New Roman", ui-serif, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", ui-monospace, monospace'
};

const RADIUS_PRESETS = {
  sharp: { sm: "0.35rem", md: "0.55rem", lg: "0.8rem", pill: "0.8rem" },
  soft: { sm: "0.7rem", md: "1rem", lg: "1.35rem", pill: "999px" },
  round: { sm: "1rem", md: "1.45rem", lg: "2rem", pill: "999px" },
  pill: { sm: "1.2rem", md: "1.8rem", lg: "2.4rem", pill: "999px" }
};

const backgroundEffects = {
  none: "linear-gradient(0deg, transparent, transparent)",
  aurora: "radial-gradient(circle at 85% 3%, var(--color-accent-soft), transparent 18rem)",
  spotlight: "radial-gradient(circle at 50% -10%, var(--color-accent-soft), transparent 24rem)",
  diagonal: "linear-gradient(135deg, var(--color-accent-soft), transparent 32%)",
  mesh: "radial-gradient(circle at 12% 8%, var(--color-accent-soft), transparent 22rem), radial-gradient(circle at 92% 0%, hsl(var(--hue-accent) 80% 55% / 0.1), transparent 18rem)"
};

export const normalizeBrandTheme = (theme = {}) => {
  const mode = theme.mode === "light" ? "light" : "dark";
  const palette = MODE_PALETTES[mode];
  const fontPreset = allowed(theme.fontPreset || theme.font_preset, Object.keys(FONT_STACKS), DEFAULT_BRAND_THEME.fontPreset);
  const radiusPreset = allowed(theme.radiusPreset || theme.radius_preset, Object.keys(RADIUS_PRESETS), DEFAULT_BRAND_THEME.radiusPreset);
  const backgroundStyle = allowed(theme.backgroundStyle || theme.background_style, Object.keys(backgroundEffects), DEFAULT_BRAND_THEME.backgroundStyle);

  return {
    mode,
    accent: isValidHex(theme.accent) ? theme.accent : DEFAULT_BRAND_THEME.accent,
    brandName: String(theme.brandName || theme.brand_name || DEFAULT_BRAND_THEME.brandName).trim() || DEFAULT_BRAND_THEME.brandName,
    tagline: String(theme.tagline || DEFAULT_BRAND_THEME.tagline).trim() || DEFAULT_BRAND_THEME.tagline,
    backgroundColor: isValidHex(theme.backgroundColor || theme.background_color) ? (theme.backgroundColor || theme.background_color) : palette.backgroundColor,
    surfaceColor: isValidHex(theme.surfaceColor || theme.surface_color) ? (theme.surfaceColor || theme.surface_color) : palette.surfaceColor,
    textColor: isValidHex(theme.textColor || theme.text_color) ? (theme.textColor || theme.text_color) : palette.textColor,
    fontPreset,
    radiusPreset,
    backgroundStyle
  };
};

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
  root.style.setProperty("--color-bg", normalized.backgroundColor);
  root.style.setProperty("--color-bg-elevated", `color-mix(in srgb, ${normalized.surfaceColor} 88%, ${normalized.backgroundColor})`);
  root.style.setProperty("--color-surface", normalized.surfaceColor);
  root.style.setProperty("--color-surface-strong", `color-mix(in srgb, ${normalized.surfaceColor} 86%, ${normalized.textColor})`);
  root.style.setProperty("--color-surface-glass", `color-mix(in srgb, ${normalized.surfaceColor} 82%, transparent)`);
  root.style.setProperty("--color-text", normalized.textColor);
  root.style.setProperty("--color-line", `color-mix(in srgb, ${normalized.textColor} 12%, transparent)`);
  root.style.setProperty("--font-sans", FONT_STACKS[normalized.fontPreset]);
  root.style.setProperty("--brand-bg-effect", backgroundEffects[normalized.backgroundStyle]);

  const radius = RADIUS_PRESETS[normalized.radiusPreset];
  root.style.setProperty("--radius-sm", radius.sm);
  root.style.setProperty("--radius-md", radius.md);
  root.style.setProperty("--radius-lg", radius.lg);
  root.style.setProperty("--radius-pill", radius.pill);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", normalized.accent);

  return normalized;
};
