/**
 * ExceptionsCard — schedule exceptions below the weekly availability grid.
 *
 * Lets the professor add date-specific overrides (day off or custom hours)
 * that don't affect the normal weekly availability.
 *
 * Usage:
 *   import { initExceptionsCard } from "./exceptions-card.js";
 *   initExceptionsCard(document.querySelector("[data-agenda-exceptions]"));
 */
import { svgIcon } from "../../../../appAluno/js/core/icons.js?v=build-20260818-1";

const MONTHS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const WEEKDAYS = [
  "Domingo", "Segunda-feira", "Terça-feira",
  "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado",
];

function escHtml(str) {
  return String(str).replace(/[&<>\"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function parseDate(val) {
  // val = "YYYY-MM-DD"
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function formatDateBR(val) {
  const d = parseDate(val);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(d);
}

function formatMonth(val) {
  return MONTHS[parseDate(val).getMonth()];
}

function formatDay(val) {
  return String(parseDate(val).getDate()).padStart(2, "0");
}

function formatWeekday(val) {
  return WEEKDAYS[parseDate(val).getDay()];
}

function todayValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Storage ────────────────────────────────────────────────────────
const STORAGE_KEY = "prof_schedule_exceptions";

function loadExceptions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExceptions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Init ───────────────────────────────────────────────────────────
export function initExceptionsCard(container) {
  if (!container) return;

  let exceptions = loadExceptions();
  let editingId = null;

  function renderList() {
    const listEl = container.querySelector(".exc-list");
    if (!listEl) return;

    if (exceptions.length === 0) {
      listEl.innerHTML = `<p class="exc-empty">Nenhuma exceção cadastrada.</p>`;
      return;
    }

    // Sort by date ascending
    const sorted = [...exceptions].sort((a, b) => a.date.localeCompare(b.date));

    listEl.innerHTML = sorted.map((ex) => {
      const badgeClass = ex.type === "off" ? "exc-badge--off" : "exc-badge--changed";
      const badgeText = ex.type === "off"
        ? "Indisponível o dia todo"
        : (ex.ranges || []).map((r) => `${r.start}–${r.end}`).join(" · ") || "Sem horários";

      return `<article class="exc-item" data-exc-id="${ex.id}">
        <div class="exc-date-box">
          <small>${formatMonth(ex.date)}</small>
          <strong>${formatDay(ex.date)}</strong>
        </div>
        <div class="exc-info">
          <p class="exc-title">${formatWeekday(ex.date)}</p>
          <p class="exc-desc">${escHtml(ex.note || "")}</p>
          <span class="exc-badge ${badgeClass}">${badgeText}</span>
        </div>
        <button class="exc-more icon-button" type="button" data-exc-action="menu" data-exc-id="${ex.id}" aria-label="Ações">
          ${svgIcon("dots")}
        </button>
      </article>`;
    }).join("");
  }

  function openSheet(prefill) {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;

    editingId = prefill?.id || null;

    const dateInput = backdrop.querySelector("#excDate");
    const typeOff = backdrop.querySelector("#excTypeOff");
    const typeCustom = backdrop.querySelector("#excTypeCustom");
    const hoursPanel = backdrop.querySelector(".exc-hours-panel");
    const rangesEl = backdrop.querySelector("#excRanges");
    const previewEl = backdrop.querySelector(".exc-preview");
    const titleEl = backdrop.querySelector(".exc-sheet-title");

    // Reset
    titleEl.textContent = editingId ? "Editar exceção" : "Adicionar exceção";
    dateInput.value = prefill?.date || todayValue();

    if (prefill?.type === "custom") {
      typeCustom.checked = true;
    } else {
      typeOff.checked = true;
    }

    // Populate ranges
    if (prefill?.ranges?.length) {
      rangesEl.innerHTML = prefill.ranges.map((r) =>
        `<div class="exc-range"><input type="time" value="${r.start}"><span>até</span><input type="time" value="${r.end}"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>`
      ).join("");
    } else {
      rangesEl.innerHTML = defaultRangesHTML();
    }

    bindRanges();
    updatePreview();
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    editingId = null;
  }

  function defaultRangesHTML() {
    return `<div class="exc-range"><input type="time" value="08:00"><span>até</span><input type="time" value="11:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>
<div class="exc-range"><input type="time" value="16:00"><span>até</span><input type="time" value="19:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>`;
  }

  function selectedType() {
    const checked = container.querySelector('input[name="excType"]:checked');
    return checked ? checked.value : "off";
  }

  function currentRanges() {
    const rangesEl = container.querySelector("#excRanges");
    if (!rangesEl) return [];
    return [...rangesEl.querySelectorAll(".exc-range")]
      .map((row) => {
        const inputs = row.querySelectorAll('input[type="time"]');
        return { start: inputs[0]?.value || "", end: inputs[1]?.value || "" };
      })
      .filter((r) => r.start && r.end);
  }

  function updatePreview() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;

    const dateInput = backdrop.querySelector("#excDate");
    const hoursPanel = backdrop.querySelector(".exc-hours-panel");
    const previewEl = backdrop.querySelector(".exc-preview");
    const type = selectedType();
    const dateFormatted = formatDateBR(dateInput.value);

    hoursPanel.classList.toggle("show", type === "custom");

    if (type === "off") {
      previewEl.textContent = `Em ${dateFormatted}, sua agenda ficará indisponível o dia todo.`;
    } else {
      const ranges = currentRanges();
      const text = ranges.length
        ? ranges.map((r) => `${r.start}–${r.end}`).join(" · ")
        : "nenhum horário definido";
      previewEl.textContent = `Em ${dateFormatted}, somente estes horários ficarão disponíveis: ${text}.`;
    }
  }

  function bindRanges() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;

    backdrop.querySelectorAll(".exc-remove-range").forEach((btn) => {
      btn.onclick = () => {
        btn.closest(".exc-range")?.remove();
        updatePreview();
      };
    });

    backdrop.querySelectorAll('input[type="time"]').forEach((inp) => {
      inp.oninput = updatePreview;
    });
  }

  function handleSave() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;

    const dateInput = backdrop.querySelector("#excDate");
    const type = selectedType();
    const ranges = currentRanges();

    if (editingId) {
      const idx = exceptions.findIndex((e) => e.id === editingId);
      if (idx >= 0) {
        exceptions[idx] = { ...exceptions[idx], date: dateInput.value, type, ranges };
      }
    } else {
      exceptions.push({
        id: `exc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date: dateInput.value,
        type,
        ranges,
        note: type === "off" ? "Exceção adicionada à disponibilidade semanal" : "Horário diferente da rotina semanal",
      });
    }

    saveExceptions(exceptions);
    closeSheet();
    renderList();
    showToast("Exceção salva.");
  }

  function handleDelete(id) {
    exceptions = exceptions.filter((e) => e.id !== id);
    saveExceptions(exceptions);
    renderList();
    showToast("Exceção removida.");
  }

  function showToast(msg) {
    const toast = container.querySelector(".exc-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(container._toastTimer);
    container._toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ── Bind events ──────────────────────────────────────────────────
  function bindEvents() {
    const backdrop = container.querySelector(".exc-backdrop");

    // Add button
    container.querySelector(".exc-add-btn")?.addEventListener("click", () => openSheet());

    // Cancel
    backdrop?.querySelector(".exc-cancel")?.addEventListener("click", closeSheet);

    // Save
    backdrop?.querySelector(".exc-save")?.addEventListener("click", handleSave);

    // Close on backdrop click
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) closeSheet();
    });

    // Type radio change
    backdrop?.querySelectorAll('input[name="excType"]').forEach((radio) => {
      radio.addEventListener("change", updatePreview);
    });

    // Date change
    backdrop?.querySelector("#excDate")?.addEventListener("input", updatePreview);

    // Add range
    backdrop?.querySelector(".exc-add-range")?.addEventListener("click", () => {
      const ranges = backdrop.querySelector("#excRanges");
      if (!ranges) return;
      ranges.insertAdjacentHTML(
        "beforeend",
        `<div class="exc-range"><input type="time" value="09:00"><span>até</span><input type="time" value="12:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>`
      );
      bindRanges();
      updatePreview();
    });

    // List delegation — edit / delete
    container.querySelector(".exc-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-exc-action]");
      if (!btn) return;

      const id = btn.dataset.excId;
      const action = btn.dataset.excAction;

      if (action === "menu") {
        const ex = exceptions.find((x) => x.id === id);
        if (!ex) return;

        // Simple prompt-based action for now
        const choice = confirm("OK = Editar  |  Cancelar = Excluir");
        if (choice) {
          openSheet(ex);
        } else {
          handleDelete(id);
        }
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────
  function render() {
    container.innerHTML = `
      <div class="exc-card card">
        <header class="exc-header">
          <div class="exc-header__text">
            <h2>Exceções da agenda</h2>
            <p>Ajuste datas específicas sem alterar sua disponibilidade semanal padrão.</p>
          </div>
          <button class="exc-add-btn button button--accent" type="button">
            ${svgIcon("plus")} Adicionar
          </button>
        </header>
        <div class="exc-list"></div>
        <p class="exc-note">A rotina semanal continua valendo normalmente em todas as outras datas.</p>
      </div>

      <div class="exc-backdrop" aria-hidden="true">
        <div class="exc-sheet" role="dialog" aria-modal="true">
          <div class="exc-handle"></div>
          <h2 class="exc-sheet-title">Adicionar exceção</h2>
          <p class="exc-sheet-sub">Escolha uma data e diga apenas o que será diferente naquele dia.</p>

          <div class="exc-field">
            <label class="exc-label" for="excDate">Data</label>
            <input class="exc-date-input" id="excDate" type="date" value="${todayValue()}">
          </div>

          <div class="exc-field">
            <span class="exc-label">O que muda nessa data?</span>
            <div class="exc-type-options">
              <label class="exc-type-card">
                <input type="radio" name="excType" value="off" checked>
                <div>
                  <strong>Não vou atender</strong>
                  <span>Bloqueia o dia inteiro. Ideal para folga, viagem, feriado ou compromisso.</span>
                </div>
              </label>
              <label class="exc-type-card">
                <input type="radio" name="excType" value="custom">
                <div>
                  <strong>Vou atender em outros horários</strong>
                  <span>Substitui somente os horários desse dia, sem mexer na rotina semanal.</span>
                </div>
              </label>
            </div>
          </div>

          <div class="exc-hours-panel" id="excHoursPanel">
            <div class="exc-hours-head">
              <strong>Horários disponíveis nesse dia</strong>
            </div>
            <div id="excRanges">
              <div class="exc-range"><input type="time" value="08:00"><span>até</span><input type="time" value="11:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>
              <div class="exc-range"><input type="time" value="16:00"><span>até</span><input type="time" value="19:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">✕</button></div>
            </div>
            <button class="exc-add-range" type="button">+ Adicionar outro período</button>
          </div>

          <div class="exc-preview" id="excPreview"></div>

          <div class="exc-actions">
            <button class="exc-cancel button" type="button">Cancelar</button>
            <button class="exc-save button button--accent" type="button">Salvar exceção</button>
          </div>
        </div>
      </div>

      <div class="exc-toast" role="status"></div>
    `;

    renderList();
    bindEvents();
  }

  render();
}
