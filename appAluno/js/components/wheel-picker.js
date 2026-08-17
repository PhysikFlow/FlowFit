// Rolagem em carrossel para Carga/Repetições do modo treino.
//
// O componente sempre grava no <input> ligado (data-runner-load / data-runner-reps)
// e dispara um evento "input" com bubbles, então toda a lógica existente do runner
// (salvar sessão, dica de melhor desempenho, botão primário, conclusão de série)
// continua funcionando sem mudanças.

const COPY_COUNT = 3;               // cópias dos valores para simular o loop infinito
const DEFAULT_ITEM_HEIGHT = 32;     // px — espelha --runner-wheel-item em app.css (2rem)
const MAX_LOAD = 500;               // kg
const MAX_REPS = 100;
const MAX_VELOCITY = 1.8;           // px/ms máximo do impulso ao soltar
const MOMENTUM_THRESHOLD = 0.08;    // abaixo disso encaixa direto, sem inércia
const MOMENTUM_MULTIPLIER = 0.95;
const FRICTION = 0.9;               // resistência da inércia (1 = nunca para)
const DOUBLE_TAP_MS = 350;

const formatWheelValue = (value) => String(Number(value)).replace(".", ",");

class WheelPicker {
  constructor(wheel, input, options) {
    this.wheel = wheel;
    this.input = input;
    this.options = options;

    this.itemHeight = DEFAULT_ITEM_HEIGHT;
    this.index = 0;
    this.value = options[0];
    this.offset = 0;
    this.startY = 0;
    this.startOffset = 0;
    this.lastY = 0;
    this.lastTime = 0;
    this.velocity = 0;
    this.dragging = false;
    this.momentum = false;
    this.editing = false;
    this.animationFrame = null;
    this.lastTapAt = 0;
    this.editInput = null;

    this.render();
    this.measureItemHeight();
    this.bindEvents();
    this.setValue(input.value, { silent: true });
  }

  render() {
    this.itemsEl = document.createElement("div");
    this.itemsEl.className = "runner-wheel__items";

    const values = Array.from({ length: COPY_COUNT }, () => this.options).flat();
    const fragment = document.createDocumentFragment();
    values.forEach((option) => {
      const item = document.createElement("span");
      item.className = "runner-wheel__item";
      item.textContent = formatWheelValue(option);
      fragment.append(item);
    });
    this.itemsEl.append(fragment);

    this.wheel.append(this.itemsEl);
    this.middleStart = this.options.length;
  }

  measureItemHeight() {
    const first = this.itemsEl.firstElementChild;
    if (first) this.itemHeight = first.getBoundingClientRect().height || DEFAULT_ITEM_HEIGHT;
  }

  bindEvents() {
    this.wheel.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.wheel.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.wheel.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.wheel.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    this.wheel.addEventListener("dblclick", (event) => {
      event.preventDefault();
      this.startEditing();
    });
    this.wheel.addEventListener("pointerup", (event) => this.detectDoubleTap(event));
    this.wheel.addEventListener("keydown", (event) => this.onKeyDown(event));
  }

  onPointerDown(event) {
    if (this.editing) return;
    if (!event.isPrimary || event.button > 0) return;
    this.stopMomentum();
    this.dragging = true;
    this.startY = event.clientY;
    this.startOffset = this.offset;
    this.lastY = event.clientY;
    this.lastTime = performance.now();
    this.velocity = 0;
    this.wheel.setPointerCapture?.(event.pointerId);
    this.itemsEl.style.transition = "none";
  }

  onPointerMove(event) {
    if (!this.dragging) return;
    const now = performance.now();
    this.offset = this.startOffset + (event.clientY - this.startY);
    const deltaY = event.clientY - this.lastY;
    const deltaTime = now - this.lastTime;
    if (deltaTime > 0) {
      const instantVelocity = deltaY / deltaTime;
      this.velocity = this.velocity * 0.65 + instantVelocity * 0.35;
    }
    this.lastY = event.clientY;
    this.lastTime = now;
    this.updateTransform();
    this.updateVisualSelection();
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    const velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, this.velocity * MOMENTUM_MULTIPLIER));
    if (Math.abs(velocity) > MOMENTUM_THRESHOLD) {
      this.startMomentum(velocity);
    } else {
      this.snapToNearest();
    }
  }

  startMomentum(initialVelocity) {
    this.stopMomentum();
    this.momentum = true;
    let velocity = initialVelocity;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!this.momentum) return;
      const deltaTime = Math.min(time - lastTime, 32);
      lastTime = time;
      this.offset += velocity * deltaTime;
      this.updateTransform();
      this.updateVisualSelection();
      velocity *= Math.pow(FRICTION, deltaTime / 16);
      if (Math.abs(velocity) < 0.015) {
        this.momentum = false;
        this.snapToNearest();
        return;
      }
      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  stopMomentum() {
    this.momentum = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  getIndexFromOffset() {
    const raw = Math.round(-this.offset / this.itemHeight - this.middleStart);
    return ((raw % this.options.length) + this.options.length) % this.options.length;
  }

  snapToNearest() {
    this.itemsEl.style.transition = "transform 0.18s ease-out";
    this.index = this.getIndexFromOffset();
    this.offset = -(this.middleStart + this.index) * this.itemHeight;
    this.updateTransform();
    this.commit(this.options[this.index]);

    // Reposiciona sem transição para manter a sensação de rolagem contínua.
    setTimeout(() => {
      if (this.dragging || this.momentum) return;
      this.itemsEl.style.transition = "none";
      this.offset = -(this.middleStart + this.index) * this.itemHeight;
      this.updateTransform();
    }, 200);
  }

  nearestIndex(value) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.options.length; i += 1) {
      const distance = Math.abs(this.options[i] - value);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  updateTransform() {
    this.itemsEl.style.transform = `translateY(${this.offset}px)`;
  }

  updateVisualSelection() {
    const items = this.itemsEl.children;
    const visualIndex = this.getIndexFromOffset();
    for (let i = 0; i < items.length; i += 1) items[i].classList.remove("is-selected");
    const selected = items[this.middleStart + visualIndex];
    if (selected) {
      selected.classList.add("is-selected");
      // Durante o arrasto mostra o valor real da opção (descarta valor digitado).
      const text = formatWheelValue(this.options[visualIndex]);
      if (selected.textContent !== text) selected.textContent = text;
    }
  }

  updateSelection() {
    const items = this.itemsEl.children;
    for (let i = 0; i < items.length; i += 1) items[i].classList.remove("is-selected");
    const selected = items[this.middleStart + this.index];
    if (selected) {
      selected.classList.add("is-selected");
      // Exibe o valor efetivo (pode ser um valor digitado fora das opções).
      selected.textContent = formatWheelValue(this.value);
    }
  }

  setValue(rawValue, { silent = false } = {}) {
    const parsed = Number(rawValue);
    let value = Number.isFinite(parsed) ? parsed : this.options[0];
    const step = Number(this.input.step);
    if (Number.isFinite(step) && step >= 1) {
      // Passos inteiros (ex.: cargas sem ,5): encaixa no valor mais próximo.
      value = this.options[this.nearestIndex(value)];
    }
    const changed = value !== this.value;
    this.index = this.nearestIndex(value);
    this.value = value;
    this.offset = -(this.middleStart + this.index) * this.itemHeight;
    this.itemsEl.style.transition = "none";
    this.updateTransform();
    this.updateSelection();
    if (!silent && changed) this.commit(value);
  }

  commit(value) {
    this.value = value;
    this.input.value = String(value);
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
    this.updateAria();
  }

  updateAria() {
    this.wheel.setAttribute("aria-valuenow", String(this.value));
  }

  stepBy(direction) {
    const current = this.nearestIndex(this.value);
    const next = Math.max(0, Math.min(this.options.length - 1, current + direction));
    this.setValue(this.options[next]);
  }

  onKeyDown(event) {
    if (this.editing) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.stepBy(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.stepBy(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      this.setValue(this.options[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      this.setValue(this.options[this.options.length - 1]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.startEditing();
    }
  }

  detectDoubleTap() {
    if (this.dragging || this.momentum || this.editing) return;
    const now = Date.now();
    if (now - this.lastTapAt > 0 && now - this.lastTapAt < DOUBLE_TAP_MS) {
      this.lastTapAt = 0;
      this.startEditing();
    } else {
      this.lastTapAt = now;
    }
  }

  clamp(value) {
    const min = Number(this.input.min);
    const max = Number(this.input.max);
    if (Number.isFinite(min)) value = Math.max(min, value);
    if (Number.isFinite(max)) value = Math.min(max, value);
    return value;
  }

  startEditing() {
    if (this.editing) return;
    this.stopMomentum();
    this.editing = true;

    const input = document.createElement("input");
    input.type = "number";
    input.className = "runner-wheel__edit";
    input.inputMode = this.input.getAttribute("inputmode") || "decimal";
    input.step = this.input.step || "any";
    input.min = this.input.min !== "" ? this.input.min : "";
    input.max = this.input.max !== "" ? this.input.max : "";
    input.value = String(this.value);
    input.setAttribute("aria-label", this.wheel.getAttribute("aria-label") || "Valor");

    this.wheel.append(input);
    this.editInput = input;
    this.itemsEl.style.opacity = "0";

    input.focus();
    input.select();

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.finishEditing(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.finishEditing(false);
      }
    });
    // Confirma na hora (sem timeout) para que um clique logo em seguida
    // (ex.: "Concluir série") já leia o valor recém-digitado.
    input.addEventListener("blur", () => {
      if (this.editing) this.finishEditing(true);
    });
  }

  finishEditing(save) {
    if (!this.editing) return;
    const input = this.editInput;
    let value = this.value;
    if (save && input) {
      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) value = this.clamp(parsed);
    }
    if (input) input.remove();
    this.editInput = null;
    this.editing = false;
    this.itemsEl.style.opacity = "1";
    this.setValue(value);
  }
}

const buildLoadOptions = () => {
  const options = [];
  for (let value = 0; value <= MAX_LOAD; value += 1) options.push(value);
  return options;
};

const buildRepsOptions = () => {
  const options = [];
  for (let value = 1; value <= MAX_REPS; value += 1) options.push(value);
  return options;
};

export const initRunnerWheelPickers = () => {
  const pickers = [];
  document.querySelectorAll("[data-runner-wheel]").forEach((wheel) => {
    const kind = wheel.dataset.runnerWheel;
    const input = document.querySelector(kind === "load" ? "[data-runner-load]" : "[data-runner-reps]");
    if (!input) return;
    const options = kind === "load" ? buildLoadOptions() : buildRepsOptions();
    pickers.push(new WheelPicker(wheel, input, options));
  });
  return {
    syncAll() {
      pickers.forEach((picker) => picker.setValue(picker.input.value, { silent: true }));
    }
  };
};
