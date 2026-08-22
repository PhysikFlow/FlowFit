/**
 * Modal background blur without a live backdrop-filter or DOM snapshot.
 *
 * The browser promotes <dialog> elements to the top layer, so filtering the
 * visible application roots leaves the modal sharp. Keeping the modal and its
 * controls outside those filtered layers prevents modal interaction from
 * invalidating the background effect.
 */

const SOURCE_ATTRIBUTE = "data-modal-backdrop-source";

let installed = false;
let openDialogCount = 0;

function isBackdropBlurDisabled() {
  return document.body.classList.contains("no-backdrop-blur");
}

function isBackdropSource(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (["DIALOG", "SCRIPT", "STYLE", "LINK", "TEMPLATE"].includes(element.tagName)) return false;
  if (element.classList.contains("toast")) return false;
  return true;
}

function markBackdropSources() {
  [...document.body.children]
    .filter(isBackdropSource)
    .forEach((element) => element.setAttribute(SOURCE_ATTRIBUTE, ""));
}

function enableFrozenBackdrop() {
  if (isBackdropBlurDisabled()) return;
  markBackdropSources();
  document.body.classList.add("has-frozen-backdrop");
}

function disableFrozenBackdrop() {
  document.body.classList.remove("has-frozen-backdrop");
}

/**
 * Installs once at startup and keeps the existing showModal() API intact.
 * No DOM cloning, canvas conversion or synchronous layout read is performed.
 */
export function installFrozenBackdrop() {
  if (installed) return;
  installed = true;

  const originalShowModal = HTMLDialogElement.prototype.showModal;

  HTMLDialogElement.prototype.showModal = function (...args) {
    const isFirstDialog = openDialogCount === 0;
    if (isFirstDialog) enableFrozenBackdrop();

    let result;
    try {
      result = originalShowModal.apply(this, args);
    } catch (error) {
      if (isFirstDialog) disableFrozenBackdrop();
      throw error;
    }

    openDialogCount++;
    this.addEventListener("close", () => {
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) disableFrozenBackdrop();
    }, { once: true });

    return result;
  };
}
