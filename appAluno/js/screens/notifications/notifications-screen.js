import { Store } from "../../core/store.js?v=build-20260813-1";
import { svgIcon } from "../../core/icons.js?v=build-20260822-1";
import { escapeHtml } from "../../utils/formatters.js?v=build-20260816-1";

const iconByType = { Treino: "dumbbell", Agenda: "calendar", Avaliacao: "ruler", Evolucao: "chart", Lembrete: "bell", Mensagem: "message" };

export const createNotificationsScreen = ({ items = [], headerButton }) => {
  const count = document.querySelector("[data-notification-count]");
  const list = document.querySelector("[data-notification-list]");
  const render = () => {
    const unread = items.filter((item) => !Store.isNotificationRead(item.id)).length;
    if (headerButton) headerButton.hidden = items.length === 0;
    count.textContent = unread;
    count.classList.toggle("is-hidden", unread === 0);
    if (!items.length) {
      list.innerHTML = `<article class="empty-state card"><strong>Nenhum aviso por enquanto.</strong><small>Quando houver algo novo, aparecerá aqui.</small></article>`;
      return;
    }
    list.innerHTML = items.map((item) => {
      const read = Store.isNotificationRead(item.id);
      return `<article class="notification-item card ${read ? "is-read" : ""}"><div class="notification-item__content"><span class="surface-icon">${svgIcon(iconByType[item.type] || "bell")}</span><div><span class="chip">${escapeHtml(item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.time)}</small></div></div><button class="button button--quiet" type="button" data-notification="${escapeHtml(item.id)}" data-notification-action="${escapeHtml(item.action)}">${escapeHtml(item.action)} ${svgIcon("arrow-right")}</button></article>`;
    }).join("");
  };
  return { render };
};
