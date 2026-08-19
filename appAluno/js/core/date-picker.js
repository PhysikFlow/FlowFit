/**
 * date-picker.js — Hybrid date picker
 *
 * Mobile: uses the native system date/datetime picker.
 * Desktop: typed input with dd/mm/aaaa mask + calendar popover.
 *
 * Usage:
 *   import { initDatePicker, refreshDatePicker, initAllDatePickers } from "./core/date-picker.js";
 *   initAllDatePickers();            // enhance every date input on the page
 *   initDatePicker(someInput);       // enhance a single input
 *   refreshDatePicker(someInput);    // sync desktop UI after programmatic .value change
 */

/* ── Helpers ─────────────────────────────────────────────── */

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function sameDay(a, b) {
  return !!(
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toISO(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toISODateTime(date) {
  if (!date) return "";
  const base = toISO(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${base}T${h}:${min}`;
}

function toBR(date) {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function toBRDateTime(date) {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()} ${h}:${min}`;
}

function applyDateMask(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function applyDateTimeMask(value) {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8, 10)}:${digits.slice(10)}`;
}

function parseBRDate(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [d, m, y] = value.split("/").map(Number);
  const date = new Date(y, m - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function parseBRDateTime(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}$/.test(value)) return null;
  const [datePart, timePart] = value.split(" ");
  const [d, m, y] = datePart.split("/").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function parseISODate(value) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function parseISODateTime(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/* ── SVG icon ───────────────────────────────────────────── */

const CALENDAR_SVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/* ── State store (WeakMap) ──────────────────────────────── */

const controllers = new WeakMap();

/* ── Init ───────────────────────────────────────────────── */

export function initDatePicker(nativeInput) {
  if (!nativeInput || controllers.has(nativeInput)) return;

  const isDatetime = nativeInput.type === "datetime-local";
  const maskFn = isDatetime ? applyDateTimeMask : applyDateMask;
  const parseMasked = isDatetime ? parseBRDateTime : parseBRDate;
  const parseNative = isDatetime ? parseISODateTime : parseISODate;
  const toNative = isDatetime ? toISODateTime : toISO;
  const toDisplay = isDatetime ? toBRDateTime : toBR;
  const placeholder = isDatetime ? "dd/mm/aaaa hh:mm" : "dd/mm/aaaa";
  const maxLen = isDatetime ? 16 : 10;

  const required = nativeInput.hasAttribute("required");
  const initialValue = nativeInput.value;

  let selectedDate = initialValue ? parseNative(initialValue) : null;
  let viewDate = selectedDate ? new Date(selectedDate) : startOfDay(new Date());
  let timeValue = "12:00";

  if (isDatetime && selectedDate) {
    timeValue = `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`;
  }

  /* ── Build DOM ──────────────────────────────────────── */

  const wrapper = document.createElement("div");
  wrapper.className = "dp";

  // Desktop field
  const desktop = document.createElement("div");
  desktop.className = "dp-desktop";

  const typed = document.createElement("input");
  typed.className = "dp-typed";
  typed.type = "text";
  typed.inputMode = "numeric";
  typed.placeholder = placeholder;
  typed.maxLength = maxLen;
  typed.autocomplete = "off";
  typed.value = selectedDate ? toDisplay(selectedDate) : "";
  if (required) typed.setAttribute("required", "");

  const calBtn = document.createElement("button");
  calBtn.className = "dp-calendar-btn";
  calBtn.type = "button";
  calBtn.setAttribute("aria-label", "Abrir calendário");
  calBtn.setAttribute("aria-haspopup", "dialog");
  calBtn.setAttribute("aria-expanded", "false");
  calBtn.innerHTML = CALENDAR_SVG;

  desktop.appendChild(typed);
  desktop.appendChild(calBtn);

  // Native input (kept for form submission)
  nativeInput.classList.add("dp-native");

  // Popover
  const popover = document.createElement("div");
  popover.className = "dp-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Selecionar data");

  let timeInput = null;

  if (isDatetime) {
    popover.innerHTML = `
      <div class="dp-cal-head">
        <button class="dp-nav-btn dp-prev-btn" type="button" aria-label="Mês anterior">‹</button>
        <span class="dp-month-label"></span>
        <button class="dp-nav-btn dp-next-btn" type="button" aria-label="Próximo mês">›</button>
      </div>
      <div class="dp-weekdays" aria-hidden="true">
        <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
      </div>
      <div class="dp-days-grid"></div>
      <div class="dp-time-row">
        <label class="dp-time-label">
          <span>Horário</span>
          <input class="dp-time-input" type="time" value="${timeValue}" />
        </label>
      </div>
      <div class="dp-cal-footer">
        <button class="dp-footer-btn dp-today-btn" type="button">Hoje</button>
        <button class="dp-footer-btn dp-clear-btn" type="button">Limpar</button>
      </div>
    `;
    timeInput = popover.querySelector(".dp-time-input");
  } else {
    popover.innerHTML = `
      <div class="dp-cal-head">
        <button class="dp-nav-btn dp-prev-btn" type="button" aria-label="Mês anterior">‹</button>
        <span class="dp-month-label"></span>
        <button class="dp-nav-btn dp-next-btn" type="button" aria-label="Próximo mês">›</button>
      </div>
      <div class="dp-weekdays" aria-hidden="true">
        <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
      </div>
      <div class="dp-days-grid"></div>
      <div class="dp-cal-footer">
        <button class="dp-footer-btn dp-today-btn" type="button">Hoje</button>
        <button class="dp-footer-btn dp-clear-btn" type="button">Limpar</button>
      </div>
    `;
  }

  const monthLabel = popover.querySelector(".dp-month-label");
  const daysGrid = popover.querySelector(".dp-days-grid");

  // Assemble
  wrapper.appendChild(desktop);
  wrapper.appendChild(nativeInput);
  wrapper.appendChild(popover);

  // Insert wrapper where the native input was
  if (nativeInput.parentNode) {
    nativeInput.parentNode.insertBefore(wrapper, nativeInput);
  }

  /* ── Calendar render ────────────────────────────────── */

  function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    monthLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month, 1));

    const firstWeekday = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - firstWeekday, 12);
    const today = startOfDay(new Date());

    daysGrid.innerHTML = "";

    for (let i = 0; i < 42; i++) {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
        12
      );

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dp-day";
      btn.textContent = date.getDate();

      if (date.getMonth() !== month) btn.classList.add("dp-day--outside");
      if (sameDay(date, today)) btn.classList.add("dp-day--today");
      if (sameDay(date, selectedDate)) {
        btn.classList.add("dp-day--selected");
        btn.setAttribute("aria-pressed", "true");
      }

      btn.setAttribute(
        "aria-label",
        new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(date)
      );

      btn.addEventListener("click", () => {
        commitDate(date);
        closePopover();
        typed.focus();
      });

      daysGrid.appendChild(btn);
    }
  }

  /* ── Commit ─────────────────────────────────────────── */

  function commitDate(date, emit = true) {
    selectedDate = date ? startOfDay(date) : null;

    if (selectedDate && isDatetime && timeInput) {
      const [h, m] = timeInput.value.split(":").map(Number);
      selectedDate.setHours(h, m, 0, 0);
    }

    if (selectedDate) viewDate = new Date(selectedDate);

    typed.value = selectedDate ? toDisplay(selectedDate) : "";
    nativeInput.value = selectedDate ? toNative(selectedDate) : "";

    typed.classList.remove("is-invalid");
    renderCalendar();

    if (emit) {
      nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function commitTypedInput() {
    const value = typed.value.trim();

    if (!value) {
      commitDate(null);
      return true;
    }

    const parsed = parseMasked(value);

    if (!parsed) {
      typed.classList.add("is-invalid");
      return false;
    }

    commitDate(parsed);
    return true;
  }

  /* ── Popover open / close ───────────────────────────── */

  function openPopover() {
    const parsed = parseMasked(typed.value);
    if (parsed) {
      selectedDate = startOfDay(parsed);
      if (isDatetime && timeInput) {
        const [h, m] = timeInput.value.split(":").map(Number);
        selectedDate.setHours(h, m, 0, 0);
      }
      viewDate = new Date(selectedDate);
      nativeInput.value = toNative(selectedDate);
    }
    renderCalendar();
    popover.classList.add("dp-popover--open");
    calBtn.setAttribute("aria-expanded", "true");
  }

  function closePopover() {
    popover.classList.remove("dp-popover--open");
    calBtn.setAttribute("aria-expanded", "false");
  }

  /* ── Typed input events ─────────────────────────────── */

  typed.addEventListener("input", () => {
    const oldValue = typed.value;
    const maskedValue = maskFn(oldValue);
    if (oldValue !== maskedValue) typed.value = maskedValue;

    typed.classList.remove("is-invalid");

    if (maskedValue.length === maxLen) {
      const parsed = parseMasked(maskedValue);
      if (parsed) {
        commitDate(parsed);
      }
    }
  });

  typed.addEventListener("keydown", (event) => {
    const allowed = [
      "Backspace", "Delete", "ArrowLeft", "ArrowRight",
      "ArrowUp", "ArrowDown", "Tab", "Home", "End", "Enter", "Escape",
    ];

    if (event.ctrlKey || event.metaKey || allowed.includes(event.key)) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (commitTypedInput()) {
          closePopover();
          typed.select();
        }
      }
      if (event.key === "Escape") closePopover();
      return;
    }

    if (!/^\d$/.test(event.key)) event.preventDefault();
  });

  typed.addEventListener("paste", (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    typed.value = maskFn(pasted);
    typed.dispatchEvent(new Event("input", { bubbles: true }));
  });

  typed.addEventListener("blur", () => {
    commitTypedInput();
  });

  /* ── Calendar button ────────────────────────────────── */

  calBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (popover.classList.contains("dp-popover--open")) {
      closePopover();
    } else {
      openPopover();
    }
  });

  /* ── Popover navigation ─────────────────────────────── */

  popover.querySelector(".dp-prev-btn").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1, 12);
    renderCalendar();
  });

  popover.querySelector(".dp-next-btn").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1, 12);
    renderCalendar();
  });

  popover.querySelector(".dp-today-btn").addEventListener("click", () => {
    commitDate(new Date());
    closePopover();
    typed.focus();
  });

  popover.querySelector(".dp-clear-btn").addEventListener("click", () => {
    commitDate(null);
    closePopover();
    typed.focus();
  });

  /* ── Time input (datetime-local) ────────────────────── */

  if (timeInput) {
    timeInput.addEventListener("input", () => {
      if (selectedDate) {
        const [h, m] = timeInput.value.split(":").map(Number);
        selectedDate.setHours(h, m, 0, 0);
        typed.value = toDisplay(selectedDate);
        nativeInput.value = toNative(selectedDate);
      }
    });
  }

  /* ── Close on outside click / Escape ────────────────── */

  function onPointerDown(event) {
    if (!wrapper.contains(event.target)) closePopover();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") closePopover();
  }

  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);

  /* ── Store controller ───────────────────────────────── */

  controllers.set(nativeInput, {
    refresh() {
      const val = nativeInput.value;
      const parsed = val ? parseNative(val) : null;
      selectedDate = parsed ? startOfDay(parsed) : null;
      if (selectedDate && isDatetime && timeInput) {
        const [h, m] = timeInput.value.split(":").map(Number);
        selectedDate.setHours(h, m, 0, 0);
      }
      if (selectedDate) viewDate = new Date(selectedDate);
      typed.value = selectedDate ? toDisplay(selectedDate) : "";
      if (isDatetime && timeInput && selectedDate) {
        timeInput.value = `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`;
      }
      renderCalendar();
    },
    destroy() {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      controllers.delete(nativeInput);
    },
  });

  /* ── Initial render ─────────────────────────────────── */

  renderCalendar();
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Sync the desktop UI from the native input's current .value.
 * Call this after setting nativeInput.value programmatically.
 */
export function refreshDatePicker(nativeInput) {
  const ctrl = controllers.get(nativeInput);
  if (ctrl) ctrl.refresh();
}

/**
 * Find all <input type="date"> and <input type="datetime-local">
 * inside `root` and enhance them with the date picker.
 */
export function initAllDatePickers(root = document) {
  root
    .querySelectorAll('input[type="date"], input[type="datetime-local"]')
    .forEach((input) => {
      if (!controllers.has(input)) initDatePicker(input);
    });
}
