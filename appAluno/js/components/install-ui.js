// UI de instalação PWA do app Aluno: convite na home, botão na tela de login e
// guia de instalação manual (iOS/menu do navegador). Toda a lógica de
// estado/eventos fica no InstallManager compartilhado — aqui só há
// apresentação e ações.
//
// Por enquanto o convite sempre reaparece ao recarregar a página: o
// "dispensar" vale apenas para a sessão atual (em memória), sem persistência.

import { InstallManager } from "../core/install.js?v=build-20260816-2";

let sessionDismissed = false;

const openGuide = () => {
  const dialog = document.querySelector("[data-install-guide]");
  if (!dialog || dialog.open) return;
  const ios = InstallManager.isIOS();
  document.querySelector("[data-install-guide-ios]")?.toggleAttribute("hidden", !ios);
  document.querySelector("[data-install-guide-manual]")?.toggleAttribute("hidden", ios);
  dialog.showModal?.();
};

const handleInstallAction = async (button) => {
  if (InstallManager.canInstallNatively()) {
    if (button) button.hidden = true;
    try {
      await InstallManager.install();
    } catch {
      // Sem ação extra: o fallback manual segue disponível.
    }
    sync();
    return;
  }
  openGuide();
};

const sync = () => {
  const standalone = InstallManager.isStandalone();
  const invite = document.querySelector("[data-install-invite]");
  const onboardingAction = document.querySelector("[data-install-onboarding-action]");
  const authCard = document.querySelector("[data-auth-content]");
  if (invite) invite.hidden = standalone || sessionDismissed;
  // O botão da tela de login acompanha o card: some enquanto a sessão é
  // verificada (card oculto) e só aparece com ele.
  if (onboardingAction) onboardingAction.hidden = standalone || (authCard?.hidden ?? true);
};

export const initInstallUi = () => {
  if (!globalThis.window) return;

  InstallManager.init();
  InstallManager.onChange(sync);

  document.querySelectorAll("[data-install-action]").forEach((button) => {
    button.addEventListener("click", () => handleInstallAction(button));
  });

  document.querySelector("[data-install-dismiss]")?.addEventListener("click", () => {
    sessionDismissed = true;
    sync();
  });

  document.querySelectorAll("[data-close-install-guide]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-install-guide]")?.close?.();
    });
  });

  const authCard = document.querySelector("[data-auth-content]");
  if (authCard && globalThis.MutationObserver) {
    new MutationObserver(sync).observe(authCard, { attributes: true, attributeFilter: ["hidden"] });
  }

  sync();
};
