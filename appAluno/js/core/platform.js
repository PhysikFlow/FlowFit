const browserStorage = {
  get(key, fallback = null) {
    try {
      if (!globalThis.localStorage) return fallback;
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (!globalThis.localStorage) return false;
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

const detectRuntime = () => {
  if (!globalThis.window) return "server";
  if (window.qt?.webChannelTransport) return "qml";
  if (window.Android) return "android-webview";
  if (globalThis.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  return "browser";
};

export const Platform = {
  runtime: detectRuntime(),
  storage: browserStorage,
  vibrate(pattern = 30) {
    globalThis.navigator?.vibrate?.(pattern);
  },
  async share(data) {
    if (globalThis.navigator?.share) return navigator.share(data);
    return false;
  },
  notify(message) {
    globalThis.window?.dispatchEvent(new CustomEvent("app:notify", { detail: message }));
  },
  canUseServiceWorker() {
    return this.runtime === "browser" || this.runtime === "pwa";
  }
};
