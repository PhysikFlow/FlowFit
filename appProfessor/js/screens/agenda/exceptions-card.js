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
import { initAllDatePickers, refreshDatePicker } from "../../../../appAluno/js/core/date-picker.js?v=build-20260819-1";

const MONTHS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const WEEKDAYS = [
  "Domingo", "Segunda-feira", "Terça-feira",
  "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado",
];

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function parseDate(val) {
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

function formatRangeText(ranges) {
  if (!ranges || !ranges.length) return "";
  return ranges.map((r) => `${r.start}–${r.end}`).join(" · ");
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

// ── Validation ─────────────────────────────────────────────────────
function validateRanges(ranges) {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r.start || !r.end) {
      return { ok: false, message: "Preencha o início e o fim de todos os períodos." };
    }
    if (r.start >= r.end) {
      return { ok: false, message: "O horário final deve ser depois do horário inicial." };
    }
  }
  return { ok: true };
}

// ── Init ───────────────────────────────────────────────────────────
export function initExceptionsCard(container) {
  if (!container) return;

  let exceptions = loadExceptions();
  let editingId = null;
  let openMenuCleanup = null;

  // ── Toast ──────────────────────────────────────────────────────
  function showToast(msg, actionLabel, onAction) {
    const toast = container.querySelector(".exc-toast");
    if (!toast) return;

    const actionBtn = toast.querySelector(".exc-toast-action");
    toast.querySelector(".exc-toast-msg").textContent = msg;

    if (actionLabel && onAction) {
      actionBtn.textContent = actionLabel;
      actionBtn.hidden = false;
      actionBtn.onclick = () => {
        onAction();
        hideToast();
      };
    } else {
      actionBtn.hidden = true;
      actionBtn.onclick = null;
    }

    toast.classList.add("show");
    clearTimeout(container._toastTimer);
    container._toastTimer = setTimeout(hideToast, 4200);
  }

  function hideToast() {
    const toast = container.querySelector(".exc-toast");
    if (toast) toast.classList.remove("show");
    clearTimeout(container._toastTimer);
  }

  // ── Render list ────────────────────────────────────────────────
  function renderList() {
    const listEl = container.querySelector(".exc-list");
    if (!listEl) return;

    if (exceptions.length === 0) {
      listEl.innerHTML = `<p class="exc-empty">Nenhuma exceção cadastrada.</p>`;
      return;
    }

    const sorted = [...exceptions].sort((a, b) => a.date.localeCompare(b.date));

    listEl.innerHTML = sorted.map((ex) => {
      const isOff = ex.type === "off";
      const badgeClass = isOff ? "exc-badge--off" : "exc-badge--changed";
      const badgeText = isOff
        ? "Indisponível o dia todo"
        : formatRangeText(ex.ranges) || "Sem horários";

      return `<article class="exc-item" data-exc-id="${ex.id}">
        <div class="exc-date-box">
          <small>${formatMonth(ex.date)}</small>
          <strong>${formatDay(ex.date)}</strong>
        </div>
        <div class="exc-info">
          <p class="exc-title">${formatWeekday(ex.date)}</p>
          <span class="exc-badge ${badgeClass}">${escHtml(badgeText)}</span>
        </div>
        <button class="exc-more icon-button" type="button" data-exc-action="menu" data-exc-id="${ex.id}" aria-label="Ações da exceção" aria-haspopup="true" aria-expanded="false">
          ${svgIcon("dots")}
        </button>
      </article>`;
    }).join("");
  }

  // ── Contextual menu ────────────────────────────────────────────
  function closeMenu() {
    const existing = container.querySelector(".exc-menu");
    if (existing) existing.remove();
    if (openMenuCleanup) {
      openMenuCleanup();
      openMenuCleanup = null;
    }
  }

  function openMenu(anchorBtn, ex) {
    closeMenu();

    const menu = document.createElement("div");
    menu.className = "exc-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button class="exc-menu-item" type="button" role="menuitem" data-exc-menu-action="edit">Editar</button>
      <button class="exc-menu-item exc-menu-item--danger" type="button" role="menuitem" data-exc-menu-action="delete">Excluir</button>
    `;

    container.appendChild(menu);

    // Position: try to place below and aligned right to the anchor
    const btnRect = anchorBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const menuWidth = 10;
    let top = btnRect.bottom - containerRect.top + 4;
    let left = btnRect.right - containerRect.left - menuWidth;

    // Prevent overflow right
    if (left + menuWidth > containerRect.width) {
      left = containerRect.width - menuWidth - 4;
    }
    // Prevent overflow left
    if (left < 0) left = 4;

    // If menu would overflow bottom, show above
    if (btnRect.bottom + 80 > window.innerHeight) {
      top = btnRect.top - containerRect.top - 72;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    anchorBtn.setAttribute("aria-expanded", "true");

    // Close handlers
    const onDocClick = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorBtn && !anchorBtn.contains(e.target)) {
        closeMenu();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey);
    openMenuCleanup = () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey);
      anchorBtn.setAttribute("aria-expanded", "false");
    };

    // Menu item clicks
    menu.querySelector("[data-exc-menu-action='edit']").addEventListener("click", () => {
      closeMenu();
      openSheet(ex);
    });

    menu.querySelector("[data-exc-menu-action='delete']").addEventListener("click", () => {
      closeMenu();
      showDeleteConfirm(ex);
    });

    // Focus first item
    menu.querySelector("[data-exc-menu-action='edit']").focus();
  }

  // ── Delete confirmation (inline) ───────────────────────────────
  function showDeleteConfirm(ex) {
    const existing = container.querySelector(".exc-delete-confirm");
    if (existing) existing.remove();

    const dateFormatted = formatDateBR(ex.date);
    const weekday = formatWeekday(ex.date);

    const el = document.createElement("div");
    el.className = "exc-delete-confirm";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "exc-delete-title");
    el.innerHTML = `
      <div class="exc-delete-confirm__inner">
        <p class="exc-delete-confirm__title" id="exc-delete-title">Excluir esta exceção?</p>
        <p class="exc-delete-confirm__detail">${dateFormatted} — ${weekday}</p>
        <p class="exc-delete-confirm__copy">A disponibilidade semanal normal voltará a valer nessa data.</p>
        <div class="exc-delete-confirm__actions">
          <button class="exc-delete-cancel button" type="button">Cancelar</button>
          <button class="exc-delete-ok button" type="button">Excluir</button>
        </div>
      </div>
    `;

    container.appendChild(el);

    // Animate in
    requestAnimationFrame(() => el.classList.add("show"));

    // Focus the cancel button by default (safe default)
    el.querySelector(".exc-delete-cancel").focus();

    const cleanup = () => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };

    const onKey = (e) => {
      if (e.key === "Escape") cleanup();
    };
    document.addEventListener("keydown", onKey);

    el.querySelector(".exc-delete-cancel").addEventListener("click", cleanup);

    el.querySelector(".exc-delete-ok").addEventListener("click", () => {
      cleanup();
      performDelete(ex);
    });

    // Close on backdrop click
    el.addEventListener("click", (e) => {
      if (e.target === el) cleanup();
    });
  }

  function performDelete(ex) {
    const removed = exceptions.find((e) => e.id === ex.id);
    exceptions = exceptions.filter((e) => e.id !== ex.id);
    saveExceptions(exceptions);
    renderList();
    if (removed) {
      showToast("Exceção removida.", "Desfazer", () => {
        exceptions.push(removed);
        exceptions.sort((a, b) => a.date.localeCompare(b.date));
        saveExceptions(exceptions);
        renderList();
        showToast("Exceção restaurada.");
      });
    }
  }

  // ── Sheet ──────────────────────────────────────────────────────
  function openSheet(prefill) {
    closeMenu();

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
    const subEl = backdrop.querySelector(".exc-sheet-sub");
    const submitBtn = backdrop.querySelector(".exc-save");
    const errorEl = backdrop.querySelector(".exc-validation-error");

    // Clear previous errors
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }

    // Title & button text
    if (editingId) {
      titleEl.textContent = "Editar exceção";
      subEl.textContent = "Altere os dados dessa exceção.";
      submitBtn.textContent = "Salvar alterações";
    } else {
      titleEl.textContent = "Adicionar exceção";
      subEl.textContent = "Escolha uma data e defina como sua disponibilidade será diferente nesse dia.";
      submitBtn.textContent = "Salvar exceção";
    }

    // Date
    dateInput.value = prefill?.date || todayValue();
    refreshDatePicker(dateInput);

    // Type
    if (prefill?.type === "custom") {
      typeCustom.checked = true;
    } else {
      typeOff.checked = true;
    }

    // Ranges
    if (prefill?.ranges?.length) {
      rangesEl.innerHTML = prefill.ranges.map((r) => rangeRowHTML(r.start, r.end)).join("");
    } else {
      rangesEl.innerHTML = defaultRangesHTML();
    }

    bindRanges();
    updatePreview();
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");

    // Focus first interactive element
    setTimeout(() => dateInput.focus(), 100);
  }

  function closeSheet() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    editingId = null;
  }

  function rangeRowHTML(start, end) {
    return `<div class="exc-range">
      <input type="time" value="${escHtml(start || "")}">
      <span>até</span>
      <input type="time" value="${escHtml(end || "")}">
      <button class="exc-remove-range icon-button" type="button" aria-label="Remover período">${svgIcon("notification")}</button>
    </div>`;
  }

  function defaultRangesHTML() {
    return rangeRowHTML("08:00", "11:00") + rangeRowHTML("16:00", "19:00");
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
      previewEl.innerHTML = `<strong>${dateFormatted}</strong><br>Você não estará disponível nessa data.`;
    } else {
      const ranges = currentRanges();
      if (ranges.length) {
        const parts = ranges.map((r) => `das ${r.start} às ${r.end}`);
        let text;
        if (parts.length === 1) {
          text = `Você estará disponível ${parts[0]}.`;
        } else {
          const last = parts.pop();
          text = `Você estará disponível ${parts.join(", ")} e ${last}.`;
        }
        previewEl.innerHTML = `<strong>${dateFormatted}</strong><br>${text}`;
      } else {
        previewEl.innerHTML = `<strong>${dateFormatted}</strong><br>Defina ao menos um período disponível.`;
      }
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

  function clearValidation() {
    const backdrop = container.querySelector(".exc-backdrop");
    const errorEl = backdrop?.querySelector(".exc-validation-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  function showValidation(msg) {
    const backdrop = container.querySelector(".exc-backdrop");
    const errorEl = backdrop?.querySelector(".exc-validation-error");
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
  }

  function handleSave() {
    const backdrop = container.querySelector(".exc-backdrop");
    if (!backdrop) return;

    clearValidation();

    const dateInput = backdrop.querySelector("#excDate");
    const type = selectedType();
    const ranges = currentRanges();

    if (!dateInput.value) {
      showValidation("Selecione uma data para a exceção.");
      return;
    }

    if (type === "custom") {
      if (!ranges.length) {
        showValidation("Adicione pelo menos um período disponível.");
        return;
      }
      const validation = validateRanges(ranges);
      if (!validation.ok) {
        showValidation(validation.message);
        return;
      }
    }

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
        note: "",
      });
    }

    const isEditing = Boolean(editingId);
    saveExceptions(exceptions);
    closeSheet();
    renderList();
    showToast(isEditing ? "Exceção atualizada." : "Exceção salva.");
  }

  // ── Event binding ──────────────────────────────────────────────
  function bindEvents() {
    const backdrop = container.querySelector(".exc-backdrop");

    // Add button
    container.querySelector(".exc-add-btn")?.addEventListener("click", () => openSheet());

    // Cancel
    backdrop?.querySelector(".exc-cancel")?.addEventListener("click", closeSheet);

    // Save
    backdrop?.querySelector(".exc-save")?.addEventListener("click", handleSave);

    // Close sheet on backdrop click
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) closeSheet();
    });

    // Escape to close sheet
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop?.classList.contains("open")) {
        closeSheet();
      }
    });

    // Type radio change
    backdrop?.querySelectorAll('input[name="excType"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        clearValidation();
        updatePreview();
      });
    });

    // Date change
    backdrop?.querySelector("#excDate")?.addEventListener("input", () => {
      clearValidation();
      updatePreview();
    });

    // Add range
    backdrop?.querySelector(".exc-add-range")?.addEventListener("click", () => {
      const ranges = backdrop.querySelector("#excRanges");
      if (!ranges) return;
      ranges.insertAdjacentHTML("beforeend", rangeRowHTML("09:00", "12:00"));
      bindRanges();
      updatePreview();
    });

    // List delegation — menu
    container.querySelector(".exc-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-exc-action='menu']");
      if (!btn) return;

      const id = btn.dataset.excId;
      const ex = exceptions.find((x) => x.id === id);
      if (!ex) return;

      openMenu(btn, ex);
    });
  }

  // ── Render ─────────────────────────────────────────────────────
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
          <p class="exc-sheet-sub">Escolha uma data e defina como sua disponibilidade será diferente nesse dia.</p>

          <div class="exc-field">
            <label class="exc-label" for="excDate">Data</label>
            <input class="exc-date-input" id="excDate" type="date" value="${todayValue()}">
          </div>

          <div class="exc-field">
            <span class="exc-label">Como será esse dia?</span>
            <div class="exc-type-options">
              <label class="exc-type-card">
                <input type="radio" id="excTypeOff" name="excType" value="off" checked>
                <div>
                  <strong>Indisponível o dia todo</strong>
                  <span>Não haverá atendimento nessa data.</span>
                </div>
              </label>
              <label class="exc-type-card">
                <input type="radio" id="excTypeCustom" name="excType" value="custom">
                <div>
                  <strong>Horários específicos</strong>
                  <span>Defina os horários em que você estará disponível.</span>
                </div>
              </label>
            </div>
          </div>

          <div class="exc-hours-panel" id="excHoursPanel">
            <div class="exc-hours-head">
              <strong>Horários disponíveis</strong>
            </div>
            <div id="excRanges">
              <div class="exc-range"><input type="time" value="08:00"><span>até</span><input type="time" value="11:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">${svgIcon("notification")}</button></div>
              <div class="exc-range"><input type="time" value="16:00"><span>até</span><input type="time" value="19:00"><button class="exc-remove-range icon-button" type="button" aria-label="Remover período">${svgIcon("notification")}</button></div>
            </div>
            <button class="exc-add-range" type="button">+ Adicionar horário</button>
          </div>

          <p class="exc-validation-error" hidden></p>

          <div class="exc-preview" id="excPreview"></div>

          <div class="exc-actions">
            <button class="exc-cancel button" type="button">Cancelar</button>
            <button class="exc-save button button--accent" type="button">Salvar exceção</button>
          </div>
        </div>
      </div>

      <div class="exc-toast" role="status">
        <span class="exc-toast-msg"></span>
        <button class="exc-toast-action" type="button" hidden></button>
      </div>
    `;

    // Enhance date inputs with the hybrid date picker
    initAllDatePickers(container);

    renderList();
    bindEvents();
  }

  render();
}
