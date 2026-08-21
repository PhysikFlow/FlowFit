import { Platform } from "../../../../appAluno/js/core/platform.js?v=build-20260813-1";
import { initAllDatePickers, refreshDatePicker } from "../../../../appAluno/js/core/date-picker.js?v=build-20260819-1";

const STORAGE_KEY = "flowfit.professor.agenda.v2";
const LEGACY_EXCEPTIONS_KEY = "prof_schedule_exceptions";
const DAYS = [
  { key: "mon", short: "SEG", name: "Segunda-feira", dateIndex: 1 },
  { key: "tue", short: "TER", name: "Terça-feira", dateIndex: 2 },
  { key: "wed", short: "QUA", name: "Quarta-feira", dateIndex: 3 },
  { key: "thu", short: "QUI", name: "Quinta-feira", dateIndex: 4 },
  { key: "fri", short: "SEX", name: "Sexta-feira", dateIndex: 5 },
  { key: "sat", short: "SÁB", name: "Sábado", dateIndex: 6 },
  { key: "sun", short: "DOM", name: "Domingo", dateIndex: 0 }
];

const emptyWeek = () => Object.fromEntries(DAYS.map(({ key }) => [key, []]));
const defaultState = () => ({
  durationMinutes: 60,
  slotStepMinutes: 30,
  minimumNoticeMinutes: 240,
  bufferMinutes: 0,
  weekly: emptyWeek(),
  exceptions: []
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const todayValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const parseDate = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};
const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return (hours * 60) + minutes;
};
const minutesToTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const formatDuration = (minutes) => {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
};
const formatDate = (value, options) => new Intl.DateTimeFormat("pt-BR", options).format(parseDate(value));

const normalizePeriod = (period = {}) => ({
  start: String(period.start || "08:00"),
  end: String(period.end || "12:00"),
  type: period.type === "request" ? "request" : "direct"
});

const normalizeState = (input = {}) => {
  const fallback = defaultState();
  return {
    durationMinutes: Number(input.durationMinutes) || fallback.durationMinutes,
    slotStepMinutes: Number(input.slotStepMinutes) || fallback.slotStepMinutes,
    minimumNoticeMinutes: Number.isFinite(Number(input.minimumNoticeMinutes)) ? Number(input.minimumNoticeMinutes) : fallback.minimumNoticeMinutes,
    bufferMinutes: Number.isFinite(Number(input.bufferMinutes)) ? Number(input.bufferMinutes) : fallback.bufferMinutes,
    weekly: Object.fromEntries(DAYS.map(({ key }) => [key, Array.isArray(input.weekly?.[key]) ? input.weekly[key].map(normalizePeriod) : []])),
    exceptions: Array.isArray(input.exceptions) ? input.exceptions.map((exception) => ({
      id: String(exception.id || `exception-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      date: String(exception.date || todayValue()),
      type: exception.type === "custom" ? "custom" : "off",
      periods: Array.isArray(exception.periods || exception.ranges)
        ? (exception.periods || exception.ranges).map(normalizePeriod)
        : []
    })) : []
  };
};

const loadState = () => {
  const current = Platform.storage.get(STORAGE_KEY, null);
  if (current) return normalizeState(current);
  const legacyExceptions = Platform.storage.get(LEGACY_EXCEPTIONS_KEY, []);
  return normalizeState({ exceptions: legacyExceptions });
};

const validatePeriods = (periods) => {
  const ordered = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  for (let index = 0; index < ordered.length; index += 1) {
    const period = ordered[index];
    if (!period.start || !period.end) return "Preencha o início e o fim de todos os períodos.";
    if (period.start >= period.end) return "O horário final deve ser depois do horário inicial.";
    if (index > 0 && ordered[index - 1].end > period.start) return "Existem períodos sobrepostos neste dia.";
  }
  return "";
};

export const initAgendaPlanner = (container) => {
  if (!container) return null;
  let state = loadState();
  let weeklyDraft = emptyWeek();
  let editingDay = "";
  let editingExceptionId = "";
  let exceptionDraft = null;
  let toastTimer = 0;

  const persist = () => Platform.storage.set(STORAGE_KEY, state);
  const periodLabel = (period) => `${period.start}–${period.end}`;
  const typeLabel = (type) => type === "direct" ? "Reserva direta" : "Sob consulta";

  const getPeriodsForDate = (date) => {
    const exception = state.exceptions.find((item) => item.date === date);
    if (exception) return exception.type === "off" ? [] : exception.periods;
    const day = DAYS.find((item) => item.dateIndex === parseDate(date).getDay());
    return state.weekly[day?.key] || [];
  };

  const showToast = (message) => {
    const toast = container.querySelector("[data-agenda-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  };

  const renderWeek = () => {
    const target = container.querySelector("[data-agenda-week]");
    if (!target) return;
    target.innerHTML = DAYS.map((day) => {
      const periods = state.weekly[day.key] || [];
      return `<article class="agenda-day-row">
        <strong class="agenda-day-row__day">${day.short}</strong>
        <div class="agenda-day-row__periods">
          ${periods.length ? periods.map((period) => `<span class="agenda-period agenda-period--${period.type}"><i></i><span>${escapeHtml(periodLabel(period))}</span><small>${typeLabel(period.type)}</small></span>`).join("") : `<span class="agenda-day-row__closed">Sem atendimento</span>`}
        </div>
        <button class="icon-button agenda-day-row__edit" type="button" data-edit-day="${day.key}" aria-label="Editar ${day.name}">•••</button>
      </article>`;
    }).join("");
  };

  const ruleLabel = (type, value) => {
    if (type === "notice") return Number(value) === 0 ? "Sem limite" : formatDuration(value);
    if (type === "buffer") return Number(value) === 0 ? "Nenhum" : formatDuration(value);
    return formatDuration(value);
  };

  const renderSummary = () => {
    const target = container.querySelector("[data-agenda-summary]");
    if (!target) return;
    target.innerHTML = `
      <div><span>Duração</span><strong>${ruleLabel("duration", state.durationMinutes)}</strong></div>
      <div><span>Inícios</span><strong>A cada ${ruleLabel("step", state.slotStepMinutes)}</strong></div>
      <div><span>Antecedência</span><strong>${ruleLabel("notice", state.minimumNoticeMinutes)}</strong></div>
      <div><span>Intervalo</span><strong>${ruleLabel("buffer", state.bufferMinutes)}</strong></div>`;
  };

  const renderPreview = () => {
    const input = container.querySelector("[data-agenda-preview-date]");
    const title = container.querySelector("[data-agenda-preview-title]");
    const list = container.querySelector("[data-agenda-preview-slots]");
    if (!input || !title || !list) return;
    const date = input.value || todayValue();
    title.textContent = formatDate(date, { weekday: "long", day: "2-digit", month: "short" });
    const periods = getPeriodsForDate(date);
    const slots = [];
    periods.forEach((period) => {
      const end = timeToMinutes(period.end);
      for (let start = timeToMinutes(period.start); start + state.durationMinutes <= end; start += state.slotStepMinutes) {
        slots.push({ start: minutesToTime(start), end: minutesToTime(start + state.durationMinutes), type: period.type });
      }
    });
    list.innerHTML = slots.length
      ? slots.map((slot) => `<div class="agenda-preview-slot agenda-preview-slot--${slot.type}"><strong>${slot.start}</strong><span>${slot.end}</span><small>${typeLabel(slot.type)}</small></div>`).join("")
      : `<p class="agenda-preview-empty">Nenhum horário configurado para este dia.</p>`;
  };

  const renderExceptions = () => {
    const target = container.querySelector("[data-agenda-exceptions]");
    if (!target) return;
    const sorted = [...state.exceptions].sort((a, b) => a.date.localeCompare(b.date));
    target.innerHTML = sorted.length ? sorted.map((exception) => `
      <article class="agenda-exception-row">
        <div class="agenda-exception-date"><small>${formatDate(exception.date, { month: "short" }).replace(".", "")}</small><strong>${formatDate(exception.date, { day: "2-digit" })}</strong></div>
        <div><strong>${formatDate(exception.date, { weekday: "long" })}</strong><small>${exception.type === "off" ? "Sem atendimento" : exception.periods.map(periodLabel).join(" · ")}</small></div>
        <details class="action-menu entity-menu">
          <summary class="icon-button" aria-label="Ações desta alteração">•••</summary>
          <div class="action-menu__popover action-menu__popover--end">
            <button type="button" data-edit-exception="${escapeHtml(exception.id)}">Editar</button>
            <button class="is-danger" type="button" data-delete-exception="${escapeHtml(exception.id)}">Excluir</button>
          </div>
        </details>
      </article>`).join("") : `<p class="agenda-empty">Nenhuma alteração específica cadastrada.</p>`;
  };

  const renderDynamic = () => {
    renderWeek();
    renderSummary();
    renderPreview();
    renderExceptions();
  };

  const periodEditorRow = (period, index, scope) => `<div class="agenda-period-editor" data-period-row="${index}">
    <input type="time" value="${escapeHtml(period.start)}" data-period-start aria-label="Início do período">
    <span>até</span>
    <input type="time" value="${escapeHtml(period.end)}" data-period-end aria-label="Fim do período">
    <select data-period-type data-custom-select="off" aria-label="Tipo de disponibilidade">
      <option value="direct"${period.type === "direct" ? " selected" : ""}>Reserva direta</option>
      <option value="request"${period.type === "request" ? " selected" : ""}>Sob consulta</option>
    </select>
    <button class="icon-button" type="button" data-remove-period="${index}" data-period-scope="${scope}" aria-label="Remover período">×</button>
  </div>`;

  const syncPeriodInputs = (dialog, periods) => {
    dialog.querySelectorAll("[data-period-row]").forEach((row) => {
      const index = Number(row.dataset.periodRow);
      if (!periods[index]) return;
      periods[index] = {
        start: row.querySelector("[data-period-start]")?.value || "",
        end: row.querySelector("[data-period-end]")?.value || "",
        type: row.querySelector("[data-period-type]")?.value === "direct" ? "direct" : "request"
      };
    });
  };

  const renderDayEditor = () => {
    const dialog = container.querySelector("[data-agenda-day-dialog]");
    const list = dialog?.querySelector("[data-day-periods]");
    const day = DAYS.find((item) => item.key === editingDay);
    if (!dialog || !list || !day) return;
    dialog.querySelector("[data-day-dialog-title]").textContent = day.name;
    const periods = weeklyDraft[editingDay];
    dialog.querySelector("[data-day-selector]").value = editingDay;
    list.innerHTML = periods.length ? periods.map((period, index) => periodEditorRow(period, index, "day")).join("") : `<p class="agenda-editor-empty">Sem períodos — este dia ficará sem atendimento.</p>`;
  };

  const openDayDialog = (key) => {
    editingDay = key;
    weeklyDraft = clone(state.weekly);
    renderDayEditor();
    container.querySelector("[data-agenda-day-error]").textContent = "";
    container.querySelector("[data-agenda-day-dialog]")?.showModal();
  };

  const renderExceptionEditor = () => {
    const dialog = container.querySelector("[data-agenda-exception-dialog]");
    const periodsTarget = dialog?.querySelector("[data-exception-periods]");
    if (!dialog || !periodsTarget || !exceptionDraft) return;
    dialog.querySelector("[data-exception-dialog-title]").textContent = editingExceptionId ? "Editar alteração" : "Adicionar alteração";
    dialog.querySelector("[data-exception-date]").value = exceptionDraft.date;
    dialog.querySelector(`[name="agendaExceptionType"][value="${exceptionDraft.type}"]`).checked = true;
    dialog.querySelector("[data-exception-custom]").hidden = exceptionDraft.type !== "custom";
    periodsTarget.innerHTML = exceptionDraft.periods.length ? exceptionDraft.periods.map((period, index) => periodEditorRow(period, index, "exception")).join("") : `<p class="agenda-editor-empty">Adicione pelo menos um período.</p>`;
    refreshDatePicker(dialog.querySelector("[data-exception-date]"));
  };

  const openExceptionDialog = (id = "") => {
    editingExceptionId = id;
    const existing = state.exceptions.find((item) => item.id === id);
    exceptionDraft = existing ? clone(existing) : { id: "", date: todayValue(), type: "off", periods: [] };
    renderExceptionEditor();
    container.querySelector("[data-agenda-exception-error]").textContent = "";
    container.querySelector("[data-agenda-exception-dialog]")?.showModal();
  };

  container.innerHTML = `
    <div class="agenda-planner-layout">
      <div class="agenda-planner-main">
        <section class="card agenda-panel">
          <header class="agenda-panel__header"><div><h3>Disponibilidade semanal</h3><p>Organize períodos claros, sem precisar preencher uma grade inteira.</p></div><button class="button" type="button" data-edit-week>Editar semana</button></header>
          <div class="agenda-legend"><span><i class="is-direct"></i>Reserva direta</span><span><i class="is-request"></i>Sob consulta</span><span><i class="is-closed"></i>Fora dos períodos</span></div>
          <div class="agenda-week" data-agenda-week></div>
          <p class="agenda-panel__note">Fora dos períodos configurados, o horário é considerado indisponível.</p>
        </section>

        <section class="card agenda-panel">
          <header class="agenda-panel__header"><div><h3>Regras de agendamento</h3><p>Ajustes salvos automaticamente neste dispositivo.</p></div></header>
          <div class="agenda-rules">
            <label><span><strong>Duração do atendimento</strong><small>Tempo ocupado por atendimento.</small></span><select data-agenda-rule="durationMinutes"><option value="45">45 minutos</option><option value="60">1 hora</option><option value="80">1h 20min</option><option value="90">1h 30min</option><option value="120">2 horas</option></select></label>
            <label><span><strong>Oferecer horários a cada</strong><small>Intervalo entre possíveis inícios.</small></span><select data-agenda-rule="slotStepMinutes"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option></select></label>
            <label><span><strong>Antecedência mínima</strong><small>Evita marcações muito próximas.</small></span><select data-agenda-rule="minimumNoticeMinutes"><option value="0">Sem limite</option><option value="60">1 hora</option><option value="240">4 horas</option><option value="720">12 horas</option><option value="1440">24 horas</option></select></label>
            <label><span><strong>Intervalo entre atendimentos</strong><small>Tempo adicional bloqueado após cada horário.</small></span><select data-agenda-rule="bufferMinutes"><option value="0">Sem intervalo</option><option value="10">10 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option></select></label>
          </div>
        </section>

        <section class="card agenda-panel">
          <header class="agenda-panel__header"><div><h3>Alterações da agenda</h3><p>Mude uma data específica sem alterar sua rotina semanal.</p></div><button class="button button--accent" type="button" data-add-exception>+ Adicionar</button></header>
          <div class="agenda-exceptions" data-agenda-exceptions></div>
        </section>
      </div>

      <aside class="card agenda-preview-panel">
        <h3>Como está configurado</h3><p>Prévia dos horários gerados pelas regras atuais.</p>
        <label class="agenda-preview-date">Visualizar dia<input type="date" value="${todayValue()}" data-agenda-preview-date></label>
        <div class="agenda-summary" data-agenda-summary></div>
        <section class="agenda-student-preview"><strong data-agenda-preview-title></strong><small>Prévia — nenhuma reserva será criada.</small><div data-agenda-preview-slots></div></section>
      </aside>
    </div>

    <dialog class="agenda-dialog" data-agenda-day-dialog>
      <form method="dialog"><header><div><h3 data-day-dialog-title>Editar dia</h3><p>Defina os períodos e como cada um será oferecido.</p></div><button class="dialog-close" value="cancel" aria-label="Fechar">×</button></header><div class="agenda-dialog__body"><label class="agenda-dialog__field agenda-dialog__day-selector">Dia da semana<select data-day-selector data-custom-select="off">${DAYS.map((day) => `<option value="${day.key}">${day.name}</option>`).join("")}</select></label><div data-day-periods></div><button class="button button--quiet" type="button" data-add-day-period>+ Adicionar período</button><p class="agenda-dialog__error" data-agenda-day-error></p></div><footer><button class="button button--quiet" value="cancel">Cancelar</button><button class="button button--accent" type="button" data-save-day>Salvar semana</button></footer></form>
    </dialog>

    <dialog class="agenda-dialog" data-agenda-exception-dialog>
      <form method="dialog"><header><div><h3 data-exception-dialog-title>Adicionar alteração</h3><p>Essa configuração valerá somente na data escolhida.</p></div><button class="dialog-close" value="cancel" aria-label="Fechar">×</button></header><div class="agenda-dialog__body"><label class="agenda-dialog__field">Data<input type="date" data-exception-date></label><fieldset class="agenda-exception-types"><legend>Como será esse dia?</legend><label><input type="radio" name="agendaExceptionType" value="off"><span><strong>Sem atendimento</strong><small>O dia inteiro ficará indisponível.</small></span></label><label><input type="radio" name="agendaExceptionType" value="custom"><span><strong>Horários diferentes</strong><small>Use períodos específicos nesta data.</small></span></label></fieldset><div data-exception-custom hidden><div data-exception-periods></div><button class="button button--quiet" type="button" data-add-exception-period>+ Adicionar período</button></div><p class="agenda-dialog__error" data-agenda-exception-error></p></div><footer><button class="button button--quiet" value="cancel">Cancelar</button><button class="button button--accent" type="button" data-save-exception>Salvar alteração</button></footer></form>
    </dialog>
    <div class="agenda-toast" data-agenda-toast role="status" aria-live="polite"></div>`;

  initAllDatePickers(container);
  container.querySelectorAll("[data-agenda-rule]").forEach((select) => { select.value = String(state[select.dataset.agendaRule]); });
  renderDynamic();

  container.addEventListener("change", (event) => {
    const rule = event.target.closest("[data-agenda-rule]");
    if (rule) {
      state[rule.dataset.agendaRule] = Number(rule.value);
      persist();
      renderSummary();
      renderPreview();
      showToast("Regra atualizada.");
      return;
    }
    if (event.target.matches("[data-agenda-preview-date]")) renderPreview();
    if (event.target.matches("[data-day-selector]")) {
      const dialog = container.querySelector("[data-agenda-day-dialog]");
      syncPeriodInputs(dialog, weeklyDraft[editingDay]);
      editingDay = event.target.value;
      renderDayEditor();
    }
    if (event.target.matches('[name="agendaExceptionType"]')) {
      syncPeriodInputs(container.querySelector("[data-agenda-exception-dialog]"), exceptionDraft.periods);
      exceptionDraft.type = event.target.value;
      if (exceptionDraft.type === "custom" && !exceptionDraft.periods.length) exceptionDraft.periods.push(normalizePeriod());
      renderExceptionEditor();
    }
  });

  container.addEventListener("click", (event) => {
    const editDay = event.target.closest("[data-edit-day]");
    if (editDay) return openDayDialog(editDay.dataset.editDay);
    if (event.target.closest("[data-edit-week]")) return openDayDialog(DAYS[0].key);
    if (event.target.closest("[data-add-exception]")) return openExceptionDialog();
    const editException = event.target.closest("[data-edit-exception]");
    if (editException) return openExceptionDialog(editException.dataset.editException);
    const deleteException = event.target.closest("[data-delete-exception]");
    if (deleteException) {
      state.exceptions = state.exceptions.filter((item) => item.id !== deleteException.dataset.deleteException);
      persist(); renderExceptions(); renderPreview(); showToast("Alteração excluída."); return;
    }
    const remove = event.target.closest("[data-remove-period]");
    if (remove) {
      if (remove.dataset.periodScope === "day") {
        const dialog = container.querySelector("[data-agenda-day-dialog]");
        syncPeriodInputs(dialog, weeklyDraft[editingDay]);
        weeklyDraft[editingDay].splice(Number(remove.dataset.removePeriod), 1);
        renderDayEditor();
      } else {
        const dialog = container.querySelector("[data-agenda-exception-dialog]");
        syncPeriodInputs(dialog, exceptionDraft.periods);
        exceptionDraft.periods.splice(Number(remove.dataset.removePeriod), 1);
        renderExceptionEditor();
      }
      return;
    }
    if (event.target.closest("[data-add-day-period]")) {
      const dialog = container.querySelector("[data-agenda-day-dialog]");
      syncPeriodInputs(dialog, weeklyDraft[editingDay]);
      const last = weeklyDraft[editingDay].at(-1);
      weeklyDraft[editingDay].push(normalizePeriod(last ? { start: last.end, end: minutesToTime(Math.min(1439, timeToMinutes(last.end) + 60)), type: last.type } : {}));
      renderDayEditor(); return;
    }
    if (event.target.closest("[data-add-exception-period]")) {
      const dialog = container.querySelector("[data-agenda-exception-dialog]");
      syncPeriodInputs(dialog, exceptionDraft.periods);
      const last = exceptionDraft.periods.at(-1);
      exceptionDraft.periods.push(normalizePeriod(last ? { start: last.end, end: minutesToTime(Math.min(1439, timeToMinutes(last.end) + 60)), type: last.type } : {}));
      renderExceptionEditor(); return;
    }
    if (event.target.closest("[data-save-day]")) {
      const dialog = container.querySelector("[data-agenda-day-dialog]");
      syncPeriodInputs(dialog, weeklyDraft[editingDay]);
      const error = validatePeriods(weeklyDraft[editingDay]);
      dialog.querySelector("[data-agenda-day-error]").textContent = error;
      if (error) return;
      state.weekly = clone(weeklyDraft); persist(); dialog.close(); renderWeek(); renderPreview(); showToast("Disponibilidade salva."); return;
    }
    if (event.target.closest("[data-save-exception]")) {
      const dialog = container.querySelector("[data-agenda-exception-dialog]");
      syncPeriodInputs(dialog, exceptionDraft.periods);
      exceptionDraft.date = dialog.querySelector("[data-exception-date]").value;
      let error = !exceptionDraft.date ? "Selecione uma data." : "";
      if (!error && exceptionDraft.type === "custom") error = exceptionDraft.periods.length ? validatePeriods(exceptionDraft.periods) : "Adicione pelo menos um período.";
      dialog.querySelector("[data-agenda-exception-error]").textContent = error;
      if (error) return;
      const saved = { ...clone(exceptionDraft), id: editingExceptionId || `exception-${Date.now()}` };
      state.exceptions = [...state.exceptions.filter((item) => item.id !== editingExceptionId && item.date !== saved.date), saved];
      persist(); dialog.close(); renderExceptions(); renderPreview(); showToast("Alteração salva.");
    }
  });

  container.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));

  return { getValue: () => clone(state), refresh: renderDynamic };
};
