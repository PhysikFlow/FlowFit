export const createFeedback = ({ toast } = {}) => {
  let toastTimer;

  const setStatus = (target, message, state = "") => {
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-synced", state === "synced");
    target.classList.toggle("is-warning", state === "warning");
  };

  const showToast = (message, { actionLabel = "", onAction = null, duration = 2600 } = {}) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.replaceChildren();
    const copy = document.createElement("span");
    copy.textContent = message;
    toast.append(copy);
    if (actionLabel && typeof onAction === "function") {
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = actionLabel;
      action.addEventListener("click", () => {
        clearTimeout(toastTimer);
        toast.classList.remove("is-visible");
        onAction();
      }, { once: true });
      toast.append(action);
    }
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
  };

  return { setStatus, showToast };
};
