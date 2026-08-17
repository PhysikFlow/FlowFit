// UI de instalação PWA do app Aluno: convite dispensável na home + guia de
// instalação manual (iOS/menu do navegador). Toda a lógica de estado/eventos
// fica no InstallManager compartilhado — aqui só temos apresentação e ações.

import { InstallManager } from "../core/install.js?v=build-20260816-1";

const openGuide = () => {
  const dialog = document.querySelector("[data-install-guide]");
  if (!dialog || dialog.open) return;
  const ios = InstallManager.isIOS();
  document.querySelector("[data-install-guide-ios]")?.toggleAttribute("hidden", !ios);
  document.querySelector("[data-install-guide-manual]")?.toggleAttribute("hidden", ios);
  dialog.showModal?.();
};

export const initInstallUi = () => {
  if (!globalThis.window) return;

  const invite = document.querySelector("[data-install-invite]");
  const action = document.querySelector("[data-install-action]");
  const dismiss = document.querySelector("[data-install-dismiss]");

  InstallManager.init();

  const sync = () => {
    if (!invite) return;
    invite.hidden = InstallManager.isStandalone() || InstallManager.guideDismissed();
  };
  InstallManager.onChange(sync);

  action?.addEventListener("click", async () => {
    if (InstallManager.canInstallNatively()) {
      invite.hidden = true;
      try {
        await InstallManager.install();
      } catch {
        // Sem ação extra: o fallback manual segue disponível.
      }
      sync();
      return;
    }
    openGuide();
  });

  dismiss?.addEventListener("click", () => {
    InstallManager.dismissGuide();
    sync();
  });

  document.querySelectorAll("[data-close-install-guide]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-install-guide]")?.close?.();
    });
  });

  sync();
};
