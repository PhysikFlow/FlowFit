/**
 * Frozen backdrop — "baked blur" for &lt;dialog&gt; backdrops.
 *
 * Replaces the continuous `backdrop-filter: blur()` CSS approach with a
 * one-time captured snapshot that is blurred via CSS filter and shown as
 * a static overlay behind the modal. The browser only composites:
 * static blurred image + dialog, with no ongoing blur recomputation.
 *
 * Flow:
 *   dialog.showModal()
 *     → clone the visible body roots into a viewport-sized snapshot
 *     → keep their current screen geometry and blur the static layer
 *     → show snapshot + dark overlay behind the dialog
 *     → dialog.close() → remove snapshot
 */

let installed = false;
let activeBackdrop = null;
let openDialogCount = 0;

function isBackdropBlurDisabled() {
  return document.body.classList.contains("no-backdrop-blur");
}

function captureAndFreeze() {
  if (activeBackdrop || isBackdropBlurDisabled()) return;

  const backdrop = document.createElement("div");
  backdrop.className = "frozen-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const snapshot = document.createElement("div");
  snapshot.className = "frozen-backdrop__snapshot";

  // Preserve each visible root at its current viewport coordinates. Simply
  // appending clones makes grid/flex roots reflow inside the snapshot and can
  // leave only the dark overlay visible in the real application layout.
  for (const child of [...document.body.children]) {
    const childStyle = getComputedStyle(child);
    if (
      child.tagName === "DIALOG" ||
      child.tagName === "SCRIPT" ||
      child.classList?.contains("frozen-backdrop") ||
      child.classList?.contains("toast") ||
      child.hidden ||
      childStyle.display === "none" ||
      childStyle.visibility === "hidden"
    ) continue;

    const rect = child.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const clone = child.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    Object.assign(clone.style, {
      position: "absolute",
      inset: "auto",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      transform: "none",
      pointerEvents: "none"
    });
    snapshot.appendChild(clone);
  }

  const overlay = document.createElement("div");
  overlay.className = "frozen-backdrop__overlay";

  backdrop.appendChild(snapshot);
  backdrop.appendChild(overlay);
  document.body.appendChild(backdrop);

  // Force layout once. The cloned scene never changes while the dialog is open,
  // allowing the browser to reuse the same composited blurred layer.
  void backdrop.offsetHeight;
  activeBackdrop = backdrop;
  document.body.classList.add("has-frozen-backdrop");
}

function removeFrozenBackdrop() {
  if (!activeBackdrop) return;
  activeBackdrop.remove();
  activeBackdrop = null;
  document.body.classList.remove("has-frozen-backdrop");
}

/**
 * Call once at app startup.
 * Monkey-patches `HTMLDialogElement.prototype.showModal` so that every
 * `dialog.showModal()` call automatically captures a frozen backdrop
 * before the dialog appears, and removes it when the last dialog closes.
 */
export function installFrozenBackdrop() {
  if (installed) return;
  installed = true;

  const originalShowModal = HTMLDialogElement.prototype.showModal;

  HTMLDialogElement.prototype.showModal = function (...args) {
    // Freeze on the first dialog only — subsequent dialogs reuse the same snapshot
    const isFirstDialog = openDialogCount === 0;
    if (isFirstDialog) {
      captureAndFreeze();
    }

    let result;
    try {
      result = originalShowModal.apply(this, args);
    } catch (error) {
      if (isFirstDialog) removeFrozenBackdrop();
      throw error;
    }
    openDialogCount++;

    this.addEventListener("close", () => {
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) {
        removeFrozenBackdrop();
      }
    }, { once: true });

    return result;
  };
}
