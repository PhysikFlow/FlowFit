// Gerenciador de instalação PWA, compartilhado entre Aluno e Professor.
//
// O comportamento é decidido pela capacidade do navegador e pelo estado atual
// do runtime — não por Android/iOS:
//   - rodando instalado (standalone)    -> nada a fazer;
//   - navegador com beforeinstallprompt -> prompt nativo (Android/Chromium);
//   - iOS/iPadOS no navegador           -> guia manual (Compartilhar → Adicionar à Tela de Início);
//   - outros navegadores                -> guia manual genérica (menu do navegador).
//
// A UI não precisa conhecer beforeinstallprompt: ela usa getInstallState(),
// canInstallNatively() e install(), e escuta mudanças com onChange().

import { Platform } from "./platform.js?v=build-20260813-1";

export const INSTALL_GUIDE_DISMISS_KEY = "flowfit.install-guide-dismissed";

let deferredInstallPrompt = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

const isIOSDevice = () => {
  const navigator = globalThis.navigator;
  if (!navigator) return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
};

const isStandalone = () => Boolean(
  Platform.runtime === "pwa"
  || globalThis.navigator?.standalone
  || globalThis.matchMedia?.("(display-mode: standalone)")?.matches
);

export const InstallManager = {
  isStandalone,
  isIOS: isIOSDevice,

  getInstallState() {
    if (isStandalone()) return { installed: true, installMode: "installed" };
    if (deferredInstallPrompt) return { installed: false, canPrompt: true, installMode: "native-prompt" };
    return { installed: false, canPrompt: false, installMode: isIOSDevice() ? "ios-guide" : "manual-guide" };
  },

  canInstallNatively() {
    return Boolean(deferredInstallPrompt) && !isStandalone();
  },

  needsManualGuide() {
    return !isStandalone() && !deferredInstallPrompt;
  },

  // Dispara o prompt nativo quando disponível. Retorna false quando não há
  // prompt (a UI então abre a guia manual). Nunca reutiliza um prompt já
  // consumido: antes de chamar prompt() o evento é descartado, evitando
  // prompts duplicados em cliques repetidos.
  async install() {
    if (!deferredInstallPrompt || isStandalone()) return false;
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    notify();
    prompt.prompt();
    await prompt.userChoice;
    return true;
  },

  // Preferência de UX persistida em localStorage. O estado "instalado" NÃO é
  // persistido: ele é sempre derivado do runtime (display-mode/standalone).
  guideDismissed() {
    return Boolean(Platform.storage.get(INSTALL_GUIDE_DISMISS_KEY, false));
  },

  dismissGuide() {
    Platform.storage.set(INSTALL_GUIDE_DISMISS_KEY, true);
    notify();
  },

  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  init() {
    if (!globalThis.window) return;
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      notify();
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      notify();
    });
    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
    if (displayModeQuery?.addEventListener) {
      displayModeQuery.addEventListener("change", notify);
    } else {
      displayModeQuery?.addListener?.(notify);
    }
  }
};
