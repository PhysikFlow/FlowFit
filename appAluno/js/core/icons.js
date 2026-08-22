const PHOSPHOR_SPRITE_URL = new URL("../../assets/icons/phosphor/icons.svg", import.meta.url).href;

const iconNames = new Set([
  "arrow-right",
  "bell",
  "calendar",
  "check",
  "chart",
  "chevron-right",
  "chevron-down",
  "chevron-left",
  "clock",
  "database",
  "dumbbell",
  "home",
  "list",
  "menu",
  "message",
  "x",
  "plus",
  "dots",
  "palette",
  "play",
  "profile",
  "refresh",
  "ruler",
  "scale",
  "target",
  "trophy",
  "user",
  "users",
  "wallet",
  "weight",
  "download",
  "warning"
]);

const filledIconNames = new Set([
  "home",
  "dumbbell",
  "chart",
  "calendar",
  "profile",
  "users",
  "palette"
]);

const resolveIconName = (name) => iconNames.has(name) ? name : "target";

export const svgIcon = (name, className = "icon", weight = "light") => {
  const resolvedName = resolveIconName(name);
  const resolvedWeight = weight === "fill" && filledIconNames.has(resolvedName) ? "fill" : "light";
  const symbolUrl = `${PHOSPHOR_SPRITE_URL}#ph-${resolvedName}-${resolvedWeight}`;

  return `<svg class="${className}" viewBox="0 0 256 256" aria-hidden="true" focusable="false" data-icon-name="${resolvedName}" data-icon-weight="${resolvedWeight}"><use href="${symbolUrl}"></use></svg>`;
};

export const navigationIcon = (name, className = "icon") => {
  const resolvedName = resolveIconName(name);
  if (!filledIconNames.has(resolvedName)) return svgIcon(resolvedName, className);

  return [
    svgIcon(resolvedName, `${className} nav-icon__light`, "light"),
    svgIcon(resolvedName, `${className} nav-icon__fill`, "fill")
  ].join("");
};

export const hydrateIcons = (root = document) => {
  root.querySelectorAll("[data-ui-icon]").forEach((target) => {
    target.innerHTML = svgIcon(target.dataset.uiIcon, "icon", target.dataset.iconWeight || "light");
  });

  root.querySelectorAll("[data-nav-icon]").forEach((target) => {
    target.innerHTML = navigationIcon(target.dataset.navIcon);
  });
};
