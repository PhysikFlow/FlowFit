import { Store } from "../../core/store.js?v=build-20260813-1";
import { svgIcon } from "../../core/icons.js?v=build-20260810-7";
import { escapeHtml, formatDateTime, formatVolume } from "../../utils/formatters.js?v=build-20260816-1";

export const createHistoryScreen = ({ effortLabels }) => {
  const target = document.querySelector("[data-history-list]");
  const render = () => {
    const sessions = Store.state.sessions || [];
    if (!sessions.length) {
      target.innerHTML = `<article class="empty-state card"><strong>Nenhum treino concluído.</strong><small>Conclua o treino de hoje para enviar o primeiro feedback ao professor.</small></article>`;
      return;
    }
    target.innerHTML = sessions.map((session) => `<article class="history-row card ${session.syncStatus === "synced" ? "is-synced" : "is-pending"}"><span class="surface-icon surface-icon--success">${svgIcon("trophy")}</span><div><strong>${escapeHtml(session.workoutTitle || session.title)}</strong><small>${escapeHtml(formatDateTime(session.finishedAt))} · ${escapeHtml(effortLabels[session.feedback?.effort] || "Sem avaliação")}</small></div><span class="chip chip--success">${session.completedSets || session.sets || 0}/${session.totalSets || session.sets || 0} séries</span><small class="history-row__sync">${formatVolume(session.volumeKg || session.volume || 0)} de volume · ${session.syncStatus === "synced" ? "Enviado ao professor" : "Envio pendente"}</small></article>`).join("");
  };
  return { render };
};
