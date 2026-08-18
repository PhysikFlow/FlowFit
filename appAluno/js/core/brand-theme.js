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

const SYSTEM_STACK = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const FONT_STACKS = {
  system: SYSTEM_STACK,
  serif: 'Georgia, "Times New Roman", ui-serif, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", ui-monospace, monospace',
  oswald: `"Oswald", ${SYSTEM_STACK}`,
  "bebas-neue": `"Bebas Neue", "Oswald", ${SYSTEM_STACK}`,
  "barlow-condensed": `"Barlow Condensed", ${SYSTEM_STACK}`,
  rajdhani: `"Rajdhani", ${SYSTEM_STACK}`,
  teko: `"Teko", "Barlow Condensed", ${SYSTEM_STACK}`,
  anton: `"Anton", "Oswald", ${SYSTEM_STACK}`,
  "saira-condensed": `"Saira Condensed", ${SYSTEM_STACK}`
};

const RADIUS_PRESETS = {
  sharp: {
    xs: "0.18rem", sm: "0.28rem", md: "0.42rem", lg: "0.62rem", xl: "0.82rem",
    control: "0.38rem", compact: "0.22rem", avatar: "0.45rem"
  },
  soft: {
    xs: "0.25rem", sm: "0.48rem", md: "0.7rem", lg: "0.95rem", xl: "1.2rem",
    control: "0.6rem", compact: "0.38rem", avatar: "0.75rem"
  },
  round: {
    xs: "0.32rem", sm: "0.62rem", md: "0.88rem", lg: "1.2rem", xl: "1.5rem",
    control: "0.8rem", compact: "0.55rem", avatar: "1.05rem"
  },
  pill: {
    xs: "0.4rem", sm: "0.7rem", md: "1rem", lg: "1.35rem", xl: "1.7rem",
    control: "999px", compact: "999px", avatar: "999px"
  }
};

const FONT_ALIASES = {
  editorial: "serif",
  rounded: "system",
  geometric: "system"
};

const backgroundEffects = {
  none: "linear-gradient(0deg, transparent, transparent)",
  aurora: "radial-gradient(circle at 85% 3%, var(--color-accent-soft), transparent 18rem)",
  spotlight: "radial-gradient(circle at 50% -10%, var(--color-accent-soft), transparent 24rem)",
  diagonal: "linear-gradient(135deg, var(--color-accent-soft), transparent 32%)",
  mesh: "radial-gradient(circle at 12% 8%, var(--color-accent-soft), transparent 22rem), radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 18rem)"
};

const hexToRgb = (hex, fallback = DEFAULT_BRAND_THEME.accent) => {
  const safeHex = isValidHex(hex) ? hex : fallback;
  const value = safeHex.replace("#", "");
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16)
  };
};

const relativeLuminance = (hex) => {
  const { red, green, blue } = hexToRgb(hex);
  const channels = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
};

export const inferModeFromColor = (hex) => relativeLuminance(hex) > 0.56 ? "light" : "dark";

const readableOnColor = (hex) => {
  const luminance = relativeLuminance(hex);
  const lightContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = relativeLuminance("#090b10");
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  return darkContrast >= lightContrast ? "#090b10" : "#ffffff";
};

export const contrastRatio = (foreground, background) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

export const normalizeBrandTheme = (theme = {}) => {
  const rawBackground = theme.backgroundColor || theme.background_color;
  const mode = theme.mode === "light" || theme.mode === "dark"
    ? theme.mode
    : inferModeFromColor(isValidHex(rawBackground) ? rawBackground : DEFAULT_BRAND_THEME.backgroundColor);
  const palette = MODE_PALETTES[mode];
  const rawFontPreset = theme.fontPreset || theme.font_preset;
  const fontPreset = allowed(FONT_ALIASES[rawFontPreset] || rawFontPreset, Object.keys(FONT_STACKS), DEFAULT_BRAND_THEME.fontPreset);
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
  const rgb = hexToRgb(hex);
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
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
  root.style.setProperty("--color-accent", normalized.accent);
  root.style.setProperty("--color-bg", normalized.backgroundColor);
  root.style.setProperty("--color-bg-elevated", `color-mix(in srgb, ${normalized.surfaceColor} 88%, ${normalized.backgroundColor})`);
  root.style.setProperty("--color-surface", normalized.surfaceColor);
  root.style.setProperty("--color-surface-strong", `color-mix(in srgb, ${normalized.surfaceColor} 92%, ${normalized.textColor})`);
  root.style.setProperty("--color-surface-glass", `color-mix(in srgb, ${normalized.surfaceColor} 82%, transparent)`);
  root.style.setProperty("--color-text", normalized.textColor);
  root.style.setProperty("--color-muted", `color-mix(in srgb, ${normalized.textColor} 68%, ${normalized.backgroundColor})`);
  root.style.setProperty("--color-subtle", `color-mix(in srgb, ${normalized.textColor} 58%, ${normalized.backgroundColor})`);
  root.style.setProperty("--color-line", `color-mix(in srgb, ${normalized.textColor} 13%, transparent)`);
  root.style.setProperty("--color-on-accent", readableOnColor(normalized.accent));
  root.style.setProperty("--font-sans", FONT_STACKS[normalized.fontPreset]);
  root.style.setProperty("--brand-bg-effect", backgroundEffects[normalized.backgroundStyle]);

  const radius = RADIUS_PRESETS[normalized.radiusPreset];
  root.style.setProperty("--radius-xs", radius.xs);
  root.style.setProperty("--radius-sm", radius.sm);
  root.style.setProperty("--radius-md", radius.md);
  root.style.setProperty("--radius-lg", radius.lg);
  root.style.setProperty("--radius-xl", radius.xl);
  root.style.setProperty("--radius-control", radius.control);
  root.style.setProperty("--radius-compact", radius.compact);
  root.style.setProperty("--radius-avatar", radius.avatar);
  root.style.setProperty("--radius-pill", radius.compact);
  root.style.setProperty("--radius-track", "999px");
  // A barra do sistema (status bar/toolbar) usa a cor de fundo chapada, não o
  // acento — evita a impressão de "importante" com acentos fortes. Em barra
  // transparente (iOS, Android 15+) quem desenha atrás é o próprio fundo do app.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", normalized.backgroundColor);

  return normalized;
};
