/**
 * Window Controls Overlay – progressive enhancement.
 *
 * Adds `wco-supported` when the API exists and `wco-active` when the overlay
 * is visible. The rest of the app reacts via CSS only; no behaviour changes.
 *
 * Safe to call on every page load – browsers that don't support WCO simply
 * never receive the classes.
 */

export function initWindowControlsOverlay() {
  const root = document.documentElement;

  const update = () => {
    const supported = "windowControlsOverlay" in navigator;
    const visible = supported && navigator.windowControlsOverlay.visible;

    root.classList.toggle("wco-supported", supported);
    root.classList.toggle("wco-active", visible);

    // Sync the titlebar brand icon with the current sidebar icon
    if (visible) syncBrandIcon();
  };

  update();

  if ("windowControlsOverlay" in navigator) {
    navigator.windowControlsOverlay.addEventListener(
      "geometrychange",
      update,
    );
  }
}

/**
 * Mirror the sidebar brand icon into the titlebar so they stay in sync.
 * Called once when WCO becomes active and on every geometry change.
 *
 * Only copies innerHTML — never overwrites className, because the sidebar
 * icon uses `surface-icon` (2.15 rem) which would blow past the titlebar's
 * own constrained sizing (1.65 rem).
 */
function syncBrandIcon() {
  const sidebarIcon = document.querySelector("[data-brand-icon]");
  const wcoIcon = document.querySelector("[data-wco-brand-icon]");
  const wcoName = document.querySelector("[data-wco-brand-name]");
  const brandName = document.querySelector("[data-brand-name]");

  if (sidebarIcon && wcoIcon) {
    wcoIcon.innerHTML = sidebarIcon.innerHTML;
    /* Ensure any <img> inside the copied markup stays within bounds */
    wcoIcon.querySelectorAll("img").forEach((img) => {
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
    });
  }

  if (brandName && wcoName) {
    wcoName.textContent = brandName.textContent;
  }
}
