import { Store } from "../../core/store.js?v=build-20260813-1";
import { svgIcon } from "../../core/icons.js?v=build-20260810-7";
import { escapeHtml, formatScheduleTime } from "../../utils/formatters.js?v=build-20260816-1";

const iconByType = { Treino: "dumbbell", Mensagem: "message", Avaliacao: "ruler" };
const labelByType = { Treino: "Treino", Mensagem: "Mensagem", Avaliacao: "Avaliação" };

export const createAgendaScreen = ({ getUpcomingWorkouts, formatWorkoutAvailability, localItems = [] }) => {
  const elements = {
    count: document.querySelector("[data-schedule-count]"),
    list: document.querySelector("[data-schedule-list]"),
    filters: [...document.querySelectorAll("[data-schedule-filter]")]
  };

  const render = () => {
    const filter = Store.state.scheduleFilter || "Todos";
    const workoutItems = getUpcomingWorkouts().map((workout) => ({ id: `published-${workout.id}`, type: "Treino", title: workout.title, detail: workout.focus, time: workout.startsAt, source: "personal" }));
    const items = [...workoutItems, ...Store.getScheduleItems(localItems)].sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
    const visible = filter === "Todos" ? items : items.filter((item) => item.type === filter);
    const pending = items.filter((item) => item.source === "personal" || !Store.isReminderDone(item.id)).length;
    elements.count.textContent = `${pending} ${pending === 1 ? "próximo" : "próximos"}`;
    elements.filters.forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleFilter === filter));
    if (!visible.length) {
      elements.list.innerHTML = items.length
        ? `<article class="empty-state card"><strong>Nenhum item neste filtro.</strong><small>Escolha outra categoria para continuar.</small></article>`
        : `<article class="empty-state card"><strong>Agenda livre.</strong><small>Adicione um lembrete quando precisar.</small></article>`;
      return;
    }
    elements.list.innerHTML = visible.map((item) => {
      const fromPersonal = item.source === "personal";
      const done = !fromPersonal && Store.isReminderDone(item.id);
      return `<article class="schedule-item card ${done ? "is-muted" : ""}"><span class="surface-icon">${svgIcon(iconByType[item.type] || "calendar")}</span><div><span class="chip chip--info">${escapeHtml(labelByType[item.type] || item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p><small>${fromPersonal ? `Disponível em ${escapeHtml(formatWorkoutAvailability(item.time))}` : escapeHtml(formatScheduleTime(item.time))}</small></div>${fromPersonal ? `<span class="chip chip--info">Agendado</span>` : `<button class="icon-button" type="button" data-reminder="${escapeHtml(item.id)}" aria-label="${done ? "Reativar" : "Dispensar"} lembrete">${done ? svgIcon("refresh") : svgIcon("check")}</button>`}</article>`;
    }).join("");
  };

  return { render };
};
