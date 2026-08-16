export const createFeedback = ({ toast } = {}) => {
  let toastTimer;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  };

  const setStatus = (target, message, state = "") => {
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-synced", state === "synced");
    target.classList.toggle("is-warning", state === "warning");
  };

  return { showToast, setStatus };
};
