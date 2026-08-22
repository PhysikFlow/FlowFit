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
 *     → clone body children into a snapshot div
 *     → apply CSS filter: blur(6px) to the snapshot (computed once by GPU)
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

  // Clone visible body children — skip dialogs, the toast, and hidden elements
  for (const child of [...document.body.children]) {
    if (
      child.tagName === "DIALOG" ||
      child.classList?.contains("frozen-backdrop") ||
      child.classList?.contains("toast") ||
      child.hidden
    ) continue;
    snapshot.appendChild(child.cloneNode(true));
  }

  const overlay = document.createElement("div");
  overlay.className = "frozen-backdrop__overlay";

  backdrop.appendChild(snapshot);
  backdrop.appendChild(overlay);
  document.body.appendChild(backdrop);

  // Force a layout reflow so the browser computes the blur once, then mark active
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
    openDialogCount++;

    // Freeze on the first dialog only — subsequent dialogs reuse the same snapshot
    if (openDialogCount === 1) {
      captureAndFreeze();
    }

    const result = originalShowModal.apply(this, args);

    this.addEventListener("close", () => {
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) {
        removeFrozenBackdrop();
      }
    }, { once: true });

    return result;
  };
}
