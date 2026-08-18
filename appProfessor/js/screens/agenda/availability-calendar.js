/**
 * AvailabilityCalendar — weekly availability grid for the professor agenda.
 *
 * States per slot:
 *   negotiable  = no mark (default)
 *   available   = free to book
 *   unavailable = blocked
 *   reserved    = already booked (read-only from professor side)
 *
 * Usage:
 *   import { initAvailabilityCalendar } from "./availability-calendar.js";
 *   initAvailabilityCalendar(document.querySelector("[data-agenda-calendar]"));
 */
import { Platform } from "../../../../appAluno/js/core/platform.js?v=build-20260818-1";
import { svgIcon } from "../../../../appAluno/js/core/icons.js?v=build-20260818-1";

const DAYS = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

const START_HOUR = 6;
const END_HOUR = 22;
const STEP_MINUTES = 30;

function slotKey(day, time) {
  return `${day}|${time}`;
}

function buildSlots() {
  const result = [];
  const start = START_HOUR * 60;
  const end = END_HOUR * 60;
  for (let mins = start; mins < end; mins += STEP_MINUTES) {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    result.push(`${h}:${m}`);
  }
  return result;
}

const SLOTS = buildSlots();

const STATE_READABLE = {
  available: "Livre",
  unavailable: "Sempre indisponível",
  reserved: "Reservado",
};

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function initAvailabilityCalendar(container) {
  if (!container) return;

  const state = new Map();
  let paintMode = "available";
  let blockUnmarked = false;

  // Mock reservations
  const mockReservations = [
    { day: "mon", time: "08:00" },
    { day: "mon", time: "08:30" },
    { day: "tue", time: "18:00" },
    { day: "wed", time: "10:30" },
    { day: "thu", time: "19:00" },
    { day: "fri", time: "07:00" },
    { day: "fri", time: "17:30" },
  ];
  mockReservations.forEach(({ day, time }) => {
    state.set(slotKey(day, time), "reserved");
  });

  function getSlotState(day, time) {
    return state.get(slotKey(day, time)) || "negotiable";
  }

  function setSlotState(day, time, value, emit = true) {
    const key = slotKey(day, time);
    if (value === "negotiable") {
      state.delete(key);
    } else {
      state.set(key, value);
    }
    const cell = container.querySelector(
      `.ag-slot[data-day="${day}"][data-time="${time}"]`
    );
    if (cell) paintCell(cell, value);
    if (emit) emitChange();
  }

  function paintCell(cell, value) {
    cell.dataset.state = value;
    const readable =
      STATE_READABLE[value] ||
      (blockUnmarked ? "Indisponível por regra geral" : "Negociável");
    cell.setAttribute(
      "aria-label",
      `${dayLabel(cell.dataset.day)}, ${cell.dataset.time}: ${readable}`
    );
  }

  function dayLabel(key) {
    return DAYS.find((d) => d.key === key)?.label || key;
  }

  function refreshCells() {
    container.querySelectorAll(".ag-slot").forEach((cell) => {
      paintCell(cell, getSlotState(cell.dataset.day, cell.dataset.time));
    });
  }

  function toggleCell(cell) {
    const day = cell.dataset.day;
    const time = cell.dataset.time;
    const current = getSlotState(day, time);
    if (current !== "negotiable") {
      setSlotState(day, time, "negotiable");
      return;
    }
    setSlotState(day, time, paintMode);
  }

  function emitChange() {
    const available = [];
    const unavailable = [];
    const reserved = [];
    for (const day of DAYS) {
      for (const time of SLOTS) {
        const val = getSlotState(day.key, time);
        const item = { day: day.key, time };
        if (val === "available") available.push(item);
        if (val === "unavailable") unavailable.push(item);
        if (val === "reserved") reserved.push(item);
      }
    }
    container.dispatchEvent(
      new CustomEvent("availability-change", {
        detail: { blockUnmarked, available, unavailable, reserved },
        bubbles: true,
      })
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  function render() {
    const rows = SLOTS.map((time) => {
      const cells = DAYS.map((day) => {
        const s = getSlotState(day.key, time);
        return `<button class="ag-slot" type="button" data-day="${day.key}" data-time="${time}" data-state="${s}" aria-label="${day.label}, ${time}"></button>`;
      }).join("");
      return `<div class="ag-time">${time}</div>${cells}`;
    }).join("");

    const dayHeaders = DAYS.map(
      (d) => `<div class="ag-day">${d.label}</div>`
    ).join("");

    container.innerHTML = `
      <div class="ag-card">
        <header class="ag-top">
          <div class="ag-top__text">
            <h2>Disponibilidade semanal</h2>
            <p>Clique para alternar. Arraste para marcar vários de uma vez.</p>
          </div>

          <div class="ag-toolbar" aria-label="Modo de edição">
            <div class="ag-mode-group">
              <button class="ag-mode" type="button" data-mode="available" aria-pressed="true">
                <span class="ag-dot ag-dot--free"></span>Livre
              </button>
              <button class="ag-mode" type="button" data-mode="unavailable" aria-pressed="false">
                <span class="ag-dot ag-dot--busy"></span>Indisponível
              </button>
            </div>
            <span class="ag-hint">Clique para alternar. Arraste para marcar vários.</span>
          </div>
        </header>

        <label class="ag-setting">
          <input id="agBlockUnmarked" type="checkbox" />
          <span>
            <strong>Bloquear todos os horários sem marca</strong>
            <small>Somente horários marcados como "Livre" ficam disponíveis.</small>
          </span>
        </label>

        <div class="ag-scroll">
          <div class="ag-grid" role="grid" aria-label="Grade semanal">
            <div class="ag-corner"></div>
            ${dayHeaders}
            ${rows}
          </div>
        </div>

        <footer class="ag-footer">
          <div class="ag-legend" aria-label="Legenda">
            <span class="ag-legend-item"><i class="ag-swatch ag-swatch--free"></i>Livre</span>
            <span class="ag-legend-item"><i class="ag-swatch ag-swatch--busy"></i>Indisponível</span>
            <span class="ag-legend-item"><i class="ag-swatch ag-swatch--reserved"></i>Reservado</span>
            <span class="ag-legend-item"><i class="ag-swatch"></i>Negociável</span>
          </div>
          <button class="ag-clear" type="button">Limpar disponibilidade</button>
        </footer>
      </div>
    `;

    // Sync block-unmarked checkbox
    const checkbox = container.querySelector("#agBlockUnmarked");
    if (checkbox) checkbox.checked = blockUnmarked;

    refreshCells();
    bindEvents();
  }

  // ── Events ────────────────────────────────────────────────────────
  function bindEvents() {
    const grid = container.querySelector(".ag-grid");
    const modes = [...container.querySelectorAll(".ag-mode")];
    const checkbox = container.querySelector("#agBlockUnmarked");
    const clearBtn = container.querySelector(".ag-clear");

    // Paint mode toggle
    modes.forEach((btn) => {
      btn.addEventListener("click", () => {
        paintMode = btn.dataset.mode;
        modes.forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn))
        );
        refreshCells();
      });
    });

    // Pointer drag painting
    // On touch devices painting requires a long-press (~450 ms) to arm,
    // so the first swipe naturally scrolls the table. On desktop (mouse)
    // painting starts immediately as before.
    const isTouchDevice = matchMedia("(hover: none), (pointer: coarse)").matches;
    const LONG_PRESS_MS = 450;
    const MOVE_CANCEL_PX = 12;

    let pointerDown = false;
    let dragging = false;
    let armed = isTouchDevice ? false : true; // desktop: armed instantly
    let pointerId = null;
    let startCell = null;
    let lastDragCell = null;
    let startX = 0;
    let startY = 0;
    let longPressTimer = null;
    let cancelled = false;

    function armPainting() {
      armed = true;
      Platform.vibrate(25);
    }

    function cancelPainting() {
      cancelled = true;
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    grid.addEventListener("pointerdown", (e) => {
      const cell = e.target.closest(".ag-slot");
      if (!cell) return;
      if (!isTouchDevice) e.preventDefault(); // desktop only
      pointerDown = true;
      dragging = false;
      armed = !isTouchDevice; // desktop: armed immediately
      cancelled = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startCell = cell;
      lastDragCell = cell;
      clearTimeout(longPressTimer);
      if (isTouchDevice) {
        longPressTimer = setTimeout(() => {
          if (pointerDown && !cancelled) armPainting();
        }, LONG_PRESS_MS);
      }
    });

    grid.addEventListener("pointermove", (e) => {
      if (!pointerDown || e.pointerId !== pointerId) return;
      // Before armed on touch, check if user is scrolling away
      if (!armed) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
          cancelPainting();
          return;
        }
        return; // not armed yet – don't paint
      }
      let el = container.elementFromPoint?.(e.clientX, e.clientY);
      if (!el) el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest?.(".ag-slot");
      if (!cell || cell === lastDragCell) return;
      dragging = true;
      lastDragCell = cell;
      if (cell.dataset.state === "reserved") return;
      const cur = getSlotState(cell.dataset.day, cell.dataset.time);
      if (cur !== paintMode) {
        setSlotState(cell.dataset.day, cell.dataset.time, paintMode, false);
      }
    });

    const finishPointer = (e) => {
      if (!pointerDown || e.pointerId !== pointerId) return;
      const wasDragging = dragging;
      const wasArmed = armed;
      pointerDown = false;
      dragging = false;
      armed = isTouchDevice ? false : true;
      pointerId = null;
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (!startCell) return;
      if (cancelled || !wasArmed) {
        // Touch user didn't hold long enough – treat as a tap
        toggleCell(startCell);
      } else if (!wasDragging) {
        toggleCell(startCell);
      } else {
        if (startCell.dataset.state !== "reserved") {
          setSlotState(
            startCell.dataset.day,
            startCell.dataset.time,
            paintMode,
            false
          );
        }
        emitChange();
      }
      startCell = null;
      lastDragCell = null;
      cancelled = false;
    };

    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);

    // Keyboard
    container.querySelectorAll(".ag-slot").forEach((cell) => {
      cell.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggleCell(cell);
      });
    });

    // Block unmarked
    checkbox?.addEventListener("change", () => {
      blockUnmarked = checkbox.checked;
      refreshCells();
      emitChange();
    });

    // Clear
    clearBtn?.addEventListener("click", () => {
      for (const [key, value] of [...state.entries()]) {
        if (value !== "reserved") state.delete(key);
      }
      refreshCells();
      emitChange();
    });
  }

  // ── Public API ────────────────────────────────────────────────────
  function getValue() {
    const available = [];
    const unavailable = [];
    const reserved = [];
    for (const day of DAYS) {
      for (const time of SLOTS) {
        const val = getSlotState(day.key, time);
        const item = { day: day.key, time };
        if (val === "available") available.push(item);
        if (val === "unavailable") unavailable.push(item);
        if (val === "reserved") reserved.push(item);
      }
    }
    return { blockUnmarked, available, unavailable, reserved };
  }

  function setValue(data = {}) {
    state.clear();
    blockUnmarked = Boolean(data.blockUnmarked);
    (data.available || []).forEach(({ day, time }) =>
      state.set(slotKey(day, time), "available")
    );
    (data.unavailable || []).forEach(({ day, time }) =>
      state.set(slotKey(day, time), "unavailable")
    );
    (data.reserved || []).forEach(({ day, time }) =>
      state.set(slotKey(day, time), "reserved")
    );
    render();
  }

  // ── Init ──────────────────────────────────────────────────────────
  render();

  return { getValue, setValue, refreshCells };
}
