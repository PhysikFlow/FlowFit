(function bootstrapFlowFitBrand() {
  "use strict";

  var STARTUP_SCOPE = location.pathname.indexOf("appProfessor") >= 0 ? "professor" : "aluno";
  var STARTUP_KEY = "flowfit.startup-brand.v1:" + STARTUP_SCOPE;
  var REMOTE_PREFIX = "flowfit.brand-theme:";
  var DEFAULT_NAME = "FlowFit";
  var startedAt = performance.now();

  var readJson = function (key) {
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_error) {
      return null;
    }
  };

  var isHex = function (value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  };

  var normalize = function (value) {
    if (!value || typeof value !== "object") return null;
    var mode = value.mode === "light" ? "light" : "dark";
    return {
      mode: mode,
      accent: isHex(value.accent) ? value.accent : "#7667ff",
      brandName: String(value.brandName || value.brand_name || DEFAULT_NAME).trim() || DEFAULT_NAME,
      tagline: String(value.tagline || "").trim(),
      backgroundColor: isHex(value.backgroundColor || value.background_color)
        ? (value.backgroundColor || value.background_color)
        : (mode === "light" ? "#f3f4f7" : "#090b10"),
      surfaceColor: isHex(value.surfaceColor || value.surface_color)
        ? (value.surfaceColor || value.surface_color)
        : (mode === "light" ? "#ffffff" : "#151922"),
      textColor: isHex(value.textColor || value.text_color)
        ? (value.textColor || value.text_color)
        : (mode === "light" ? "#151722" : "#f7f7fa"),
      fontPreset: String(value.fontPreset || value.font_preset || "system"),
      radiusPreset: String(value.radiusPreset || value.radius_preset || "soft"),
      backgroundStyle: String(value.backgroundStyle || value.background_style || "aurora"),
      logoUrl: String(value.logoUrl || value.logo_url || "").trim(),
      logoFrameEnabled: value.logoFrameEnabled !== false && value.logo_frame_enabled !== false,
      updatedAt: String(value.updatedAt || value.updated_at || "")
    };
  };

  var isPersonalTheme = function (theme, logoSource) {
    return Boolean(theme && (theme.brandName !== DEFAULT_NAME || theme.logoUrl || logoSource));
  };

  var latestScopedTheme = function () {
    var latest = null;
    try {
      for (var index = 0; index < localStorage.length; index += 1) {
        var key = localStorage.key(index) || "";
        if (key.indexOf(REMOTE_PREFIX) !== 0) continue;
        var candidate = normalize(readJson(key));
        if (!candidate || !isPersonalTheme(candidate, candidate.logoUrl)) continue;
        if (!latest || String(candidate.updatedAt) > String(latest.updatedAt)) latest = candidate;
      }
    } catch (_error) {
      return null;
    }
    return latest;
  };

  var readBrand = function () {
    var stored = readJson(STARTUP_KEY);
    if (stored && normalize(stored.theme)) {
      return {
        version: 1,
        theme: normalize(stored.theme),
        logoDataUrl: String(stored.logoDataUrl || ""),
        logoRemoteUrl: String(stored.logoRemoteUrl || ""),
        updatedAt: String(stored.updatedAt || "")
      };
    }

    var assets = readJson("flowfit.brand-assets") || {};
    var localTheme = normalize(readJson("flowfit.theme"));
    var logoSource = String(assets.logoDataUrl || localTheme?.logoUrl || "");
    var theme = isPersonalTheme(localTheme, logoSource) ? localTheme : latestScopedTheme();
    if (!theme) return null;
    return {
      version: 1,
      theme: theme,
      logoDataUrl: String(assets.logoDataUrl || ""),
      logoRemoteUrl: String(theme.logoUrl || ""),
      updatedAt: String(theme.updatedAt || "")
    };
  };

  var fontStacks = {
    system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', ui-serif, serif",
    mono: "'SFMono-Regular', Consolas, 'Liberation Mono', ui-monospace, monospace",
    oswald: "'Oswald', ui-sans-serif, system-ui, sans-serif",
    "bebas-neue": "'Bebas Neue', 'Oswald', ui-sans-serif, system-ui, sans-serif",
    "barlow-condensed": "'Barlow Condensed', ui-sans-serif, system-ui, sans-serif",
    rajdhani: "'Rajdhani', ui-sans-serif, system-ui, sans-serif",
    teko: "'Teko', 'Barlow Condensed', ui-sans-serif, system-ui, sans-serif",
    anton: "'Anton', 'Oswald', ui-sans-serif, system-ui, sans-serif",
    "saira-condensed": "'Saira Condensed', ui-sans-serif, system-ui, sans-serif"
  };
  var radii = {
    sharp: ["0.18rem", "0.28rem", "0.42rem", "0.62rem", "0.82rem", "0.38rem", "0.22rem", "0.45rem"],
    soft: ["0.25rem", "0.48rem", "0.7rem", "0.95rem", "1.2rem", "0.6rem", "0.38rem", "0.75rem"],
    round: ["0.32rem", "0.62rem", "0.88rem", "1.2rem", "1.5rem", "0.8rem", "0.55rem", "1.05rem"],
    pill: ["0.4rem", "0.7rem", "1rem", "1.35rem", "1.7rem", "999px", "999px", "999px"]
  };
  var effects = {
    none: "linear-gradient(0deg, transparent, transparent)",
    aurora: "radial-gradient(circle at 85% 3%, var(--color-accent-soft), transparent 18rem)",
    spotlight: "radial-gradient(circle at 50% -10%, var(--color-accent-soft), transparent 24rem)",
    diagonal: "linear-gradient(135deg, var(--color-accent-soft), transparent 32%)",
    mesh: "radial-gradient(circle at 12% 8%, var(--color-accent-soft), transparent 22rem), radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 18rem)"
  };

  var apply = function (brand) {
    var theme = brand?.theme;
    if (!theme) return;
    var root = document.documentElement;
    root.dataset.mode = theme.mode;
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-bg", theme.backgroundColor);
    root.style.setProperty("--color-bg-elevated", "color-mix(in srgb, " + theme.surfaceColor + " 88%, " + theme.backgroundColor + ")");
    root.style.setProperty("--color-surface", theme.surfaceColor);
    root.style.setProperty("--color-surface-strong", "color-mix(in srgb, " + theme.surfaceColor + " 92%, " + theme.textColor + ")");
    root.style.setProperty("--color-surface-glass", "color-mix(in srgb, " + theme.surfaceColor + " 82%, transparent)");
    root.style.setProperty("--color-text", theme.textColor);
    root.style.setProperty("--color-muted", "color-mix(in srgb, " + theme.textColor + " 68%, " + theme.backgroundColor + ")");
    root.style.setProperty("--color-subtle", "color-mix(in srgb, " + theme.textColor + " 58%, " + theme.backgroundColor + ")");
    root.style.setProperty("--color-line", "color-mix(in srgb, " + theme.textColor + " 13%, transparent)");
    root.style.setProperty("--font-sans", fontStacks[theme.fontPreset] || fontStacks.system);
    root.style.setProperty("--brand-bg-effect", effects[theme.backgroundStyle] || effects.aurora);
    var radius = radii[theme.radiusPreset] || radii.soft;
    ["xs", "sm", "md", "lg", "xl", "control", "compact", "avatar"].forEach(function (name, index) {
      root.style.setProperty("--radius-" + name, radius[index]);
    });
    root.style.setProperty("--radius-pill", radius[6]);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.backgroundColor);
    document.title = theme.brandName + (location.pathname.indexOf("appProfessor") >= 0 ? " - Professor" : " - Aluno");
  };

  var initials = function (name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0); })
      .join("")
      .toUpperCase();
  };

  var paint = function (root, nextBrand) {
    if (!root) return;
    var brand = nextBrand || api.brand;
    var theme = brand?.theme;
    var source = String(brand?.logoDataUrl || brand?.logoRemoteUrl || theme?.logoUrl || "");
    var images = root.querySelectorAll("[data-startup-logo-image]");
    var monogram = root.querySelector("[data-startup-monogram]");
    root.classList.toggle("has-brand", Boolean(theme));
    root.classList.toggle("is-frameless", theme?.logoFrameEnabled === false);
    images.forEach(function (image) {
      if (source) {
        image.src = source;
        image.hidden = false;
        image.onerror = function () {
          images.forEach(function (failedImage) { failedImage.hidden = true; });
          if (monogram && theme) {
            monogram.textContent = initials(theme.brandName);
            monogram.hidden = false;
          }
        };
      } else {
        image.removeAttribute("src");
        image.hidden = true;
        image.onerror = null;
      }
    });
    if (monogram) {
      var value = theme ? initials(theme.brandName) : "";
      monogram.textContent = value;
      monogram.hidden = Boolean(source) || !value;
    }
  };

  var brand = readBrand();
  var api = window.FlowFitStartup = {
    key: STARTUP_KEY,
    startedAt: startedAt,
    brand: brand,
    apply: apply,
    paint: paint
  };
  apply(brand);
})();
