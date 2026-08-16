const instances = new WeakMap();
let activeInstance = null;
let instanceSequence = 0;
let documentObserver = null;

const SELECTOR = "select:not([multiple]):not([size]):not([data-custom-select='off'])";
const FOCUS_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

const nextFrame = (callback) => requestAnimationFrame(() => requestAnimationFrame(callback));

const ensureId = (element, prefix) => {
  if (!element.id) element.id = `${prefix}-${++instanceSequence}`;
  return element.id;
};

const optionDescription = (option) => option.dataset.description || "";
const optionImage = (option) => option.dataset.image || option.dataset.avatarSrc || "";
const optionIcon = (option) => option.dataset.icon || "";

class CustomSelect {
  constructor(select) {
    this.select = select;
    this.initialValue = select.value;
    this.activeIndex = -1;
    this.isOpen = false;
    this.optionElements = [];
    this.id = ensureId(select, "custom-select-native");

    this.wrapper = document.createElement("span");
    this.wrapper.className = "custom-select";
    this.wrapper.dataset.customSelectInstance = "";

    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className = `custom-select__trigger ${select.className}`.trim();
    this.trigger.setAttribute("role", "combobox");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.autocomplete = "off";

    this.valueContent = document.createElement("span");
    this.valueContent.className = "custom-select__value";
    this.valueContent.id = `custom-select-value-${++instanceSequence}`;
    this.chevron = document.createElement("span");
    this.chevron.className = "custom-select__chevron";
    this.chevron.setAttribute("aria-hidden", "true");
    this.trigger.append(this.valueContent, this.chevron);

    this.menu = document.createElement("div");
    this.menu.className = "custom-select__menu";
    this.menu.id = `custom-select-listbox-${++instanceSequence}`;
    this.menu.setAttribute("role", "listbox");
    this.menu.hidden = true;
    this.trigger.setAttribute("aria-controls", this.menu.id);

    select.before(this.wrapper);
    this.wrapper.append(select, this.trigger);
    select.classList.add("custom-select__native");
    select.hidden = true;
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    this.portalRoot = select.closest("dialog") || document.body;
    this.portalRoot.append(this.menu);

    this.label = select.labels?.[0] || null;
    if (this.label) {
      ensureId(this.label, "custom-select-label");
      this.trigger.setAttribute("aria-labelledby", `${this.label.id} ${this.valueContent.id}`);
      this.onLabelClick = (event) => {
        if (event.target.closest("button, a, input, textarea")) return;
        event.preventDefault();
        this.trigger.focus();
      };
      this.label.addEventListener("click", this.onLabelClick);
    } else {
      const accessibleName = select.getAttribute("aria-label") || select.name || "Selecionar opção";
      this.trigger.setAttribute("aria-label", accessibleName);
    }

    this.onTriggerClick = (event) => {
      event.preventDefault();
      this.isOpen ? this.close() : this.open();
    };
    this.onTriggerKeydown = (event) => this.handleKeydown(event);
    this.onMenuClick = (event) => {
      const item = event.target.closest("[role='option']");
      if (!item || item.getAttribute("aria-disabled") === "true") return;
      this.choose(Number(item.dataset.optionIndex));
    };
    this.onMenuPointerMove = (event) => {
      if (event.pointerType === "touch") return;
      const item = event.target.closest("[role='option']");
      if (!item || item.getAttribute("aria-disabled") === "true") return;
      this.setActiveIndex(Number(item.dataset.optionIndex), { scroll: false });
    };
    this.onNativeChange = () => this.refresh();

    this.trigger.addEventListener("click", this.onTriggerClick);
    this.trigger.addEventListener("keydown", this.onTriggerKeydown);
    this.menu.addEventListener("click", this.onMenuClick);
    this.menu.addEventListener("pointermove", this.onMenuPointerMove);
    select.addEventListener("change", this.onNativeChange);
    select.addEventListener("input", this.onNativeChange);

    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(select, {
      attributes: true,
      attributeFilter: [
        "disabled", "required", "selected", "value", "label", "class", "aria-label",
        "data-show-description", "data-menu-max-height", "data-avatar", "data-description",
        "data-image", "data-avatar-src", "data-icon"
      ],
      childList: true,
      characterData: true,
      subtree: true
    });

    this.refresh();
  }

  get options() {
    return [...this.select.options];
  }

  renderVisual(option, compact = false) {
    const fragment = document.createDocumentFragment();
    const imageSource = optionImage(option);
    const icon = optionIcon(option);
    if (imageSource || icon) {
      const visual = document.createElement("span");
      visual.className = "custom-select__visual";
      const isAvatar = option.dataset.avatar === "true" || this.select.dataset.avatar === "true";
      if (isAvatar) visual.classList.add("is-avatar");
      if (imageSource) {
        const image = document.createElement("img");
        image.src = imageSource;
        image.alt = "";
        image.loading = "lazy";
        visual.append(image);
      } else {
        visual.textContent = icon;
      }
      fragment.append(visual);
    }

    const copy = document.createElement("span");
    copy.className = "custom-select__copy";
    const title = document.createElement("span");
    title.className = "custom-select__title";
    title.textContent = option.label || option.textContent || "";
    copy.append(title);

    const description = optionDescription(option);
    const shouldShowDescription = description && (!compact || this.select.dataset.showDescription === "true");
    if (shouldShowDescription) {
      const supporting = document.createElement("span");
      supporting.className = "custom-select__description";
      supporting.textContent = description;
      copy.append(supporting);
    }
    fragment.append(copy);
    return fragment;
  }

  refresh() {
    const options = this.options;
    const selectedIndex = Math.max(0, this.select.selectedIndex);
    const selected = options[selectedIndex];
    const selectClasses = [...this.select.classList].filter((name) => name !== "custom-select__native");
    this.trigger.className = ["custom-select__trigger", ...selectClasses].join(" ");
    this.trigger.disabled = this.select.disabled;
    this.trigger.setAttribute("aria-disabled", String(this.select.disabled));
    if (!this.label) this.trigger.setAttribute("aria-label", this.select.getAttribute("aria-label") || this.select.name || "Selecionar opção");
    this.wrapper.classList.toggle("is-disabled", this.select.disabled);
    this.wrapper.classList.toggle("is-required", this.select.required);
    this.menu.style.setProperty("--custom-select-max-height", `${this.menuMaxHeight}px`);

    this.valueContent.replaceChildren();
    if (selected) this.valueContent.append(this.renderVisual(selected, true));
    else {
      const fallback = document.createElement("span");
      fallback.className = "custom-select__title";
      fallback.textContent = this.select.dataset.placeholder || "Selecione";
      this.valueContent.append(fallback);
    }

    this.menu.replaceChildren();
    this.optionElements = options.map((option, index) => {
      const item = document.createElement("div");
      item.className = "custom-select__option";
      item.id = `${this.menu.id}-option-${index}`;
      item.dataset.optionIndex = String(index);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.setAttribute("aria-disabled", String(option.disabled));
      if (option.selected) item.classList.add("is-selected");
      if (option.disabled) item.classList.add("is-disabled");
      item.append(this.renderVisual(option));
      this.menu.append(item);
      return item;
    });

    const currentActive = options[this.activeIndex];
    if (!currentActive || currentActive.disabled) this.activeIndex = this.enabledIndexFrom(selectedIndex, 1);
    this.syncActiveState({ scroll: false });
    if (this.isOpen) nextFrame(() => this.position());
  }

  get menuMaxHeight() {
    const configured = Number.parseInt(this.select.dataset.menuMaxHeight || "320", 10);
    return Number.isFinite(configured) ? Math.max(160, Math.min(configured, 640)) : 320;
  }

  enabledIndexFrom(startIndex, direction) {
    const options = this.options;
    if (!options.length) return -1;
    const normalizedStart = Math.max(0, Math.min(startIndex, options.length - 1));
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (normalizedStart + offset * direction + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return -1;
  }

  moveActive(direction) {
    const options = this.options;
    if (!options.length) return;
    let index = this.activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index].disabled) {
        this.setActiveIndex(index);
        return;
      }
    }
  }

  setActiveIndex(index, { scroll = true } = {}) {
    if (!Number.isInteger(index) || this.options[index]?.disabled) return;
    this.activeIndex = index;
    this.syncActiveState({ scroll });
  }

  syncActiveState({ scroll = true } = {}) {
    this.optionElements.forEach((element, index) => element.classList.toggle("is-active", index === this.activeIndex));
    const active = this.optionElements[this.activeIndex];
    if (active && this.isOpen) {
      this.trigger.setAttribute("aria-activedescendant", active.id);
      if (scroll) active.scrollIntoView({ block: "nearest" });
    } else {
      this.trigger.removeAttribute("aria-activedescendant");
    }
  }

  open({ edge = null } = {}) {
    if (this.select.disabled || this.isOpen) return;
    if (activeInstance && activeInstance !== this) activeInstance.close();
    this.refresh();
    this.initialValue = this.select.value;
    this.isOpen = true;
    activeInstance = this;
    this.wrapper.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");
    this.menu.hidden = false;
    this.menu.classList.add("is-open");
    if (edge === "last") this.activeIndex = this.enabledIndexFrom(this.options.length - 1, -1);
    else this.activeIndex = this.enabledIndexFrom(Math.max(0, this.select.selectedIndex), 1);
    this.syncActiveState({ scroll: false });
    this.position();
    nextFrame(() => this.optionElements[this.activeIndex]?.scrollIntoView({ block: "nearest" }));
  }

  close({ focus = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (activeInstance === this) activeInstance = null;
    this.wrapper.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.removeAttribute("aria-activedescendant");
    this.menu.classList.remove("is-open");
    this.menu.hidden = true;
    if (focus) this.trigger.focus();
  }

  choose(index) {
    const option = this.options[index];
    if (!option || option.disabled) return;
    const changed = this.select.value !== option.value;
    this.select.value = option.value;
    this.select.setCustomValidity("");
    this.wrapper.classList.remove("is-invalid");
    this.trigger.removeAttribute("aria-invalid");
    this.refresh();
    this.close({ focus: true });
    if (changed) {
      this.select.dispatchEvent(new Event("input", { bubbles: true }));
      this.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  handleKeydown(event) {
    if (event.key === "Tab") {
      this.close();
      return;
    }
    if (event.key === "Escape") {
      if (this.isOpen) {
        event.preventDefault();
        this.close();
      }
      return;
    }
    if (FOCUS_KEYS.has(event.key)) {
      event.preventDefault();
      if (!this.isOpen) {
        this.open({ edge: event.key === "ArrowUp" || event.key === "End" ? "last" : "first" });
      } else if (event.key === "ArrowDown") this.moveActive(1);
      else if (event.key === "ArrowUp") this.moveActive(-1);
      else if (event.key === "Home") this.setActiveIndex(this.enabledIndexFrom(0, 1));
      else if (event.key === "End") this.setActiveIndex(this.enabledIndexFrom(this.options.length - 1, -1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (this.isOpen) this.choose(this.activeIndex);
      else this.open();
    }
  }

  position() {
    if (!this.isOpen || !this.trigger.isConnected) return;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || document.documentElement.clientWidth;
    const viewportHeight = viewport?.height || document.documentElement.clientHeight;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const margin = 8;
    const gap = 6;
    const rect = this.trigger.getBoundingClientRect();
    const portalRect = this.portalRoot === document.body
      ? { left: viewportLeft, top: viewportTop, right: viewportLeft + viewportWidth, bottom: viewportTop + viewportHeight }
      : this.portalRoot.getBoundingClientRect();
    const boundsLeft = Math.max(viewportLeft, portalRect.left) + margin;
    const boundsTop = Math.max(viewportTop, portalRect.top) + margin;
    const boundsRight = Math.min(viewportLeft + viewportWidth, portalRect.right) - margin;
    const boundsBottom = Math.min(viewportTop + viewportHeight, portalRect.bottom) - margin;
    const boundedWidth = Math.max(1, boundsRight - boundsLeft);
    const boundedHeight = Math.max(120, boundsBottom - boundsTop);
    const maxHeight = Math.min(this.menuMaxHeight, viewportHeight * 0.5, boundedHeight);
    const menuWidth = Math.min(rect.width, boundedWidth);
    this.menu.style.maxHeight = `${Math.max(120, maxHeight)}px`;
    this.menu.style.width = `${menuWidth}px`;
    this.menu.style.minWidth = `${menuWidth}px`;
    this.menu.style.maxWidth = `${viewportWidth - margin * 2}px`;

    const measuredHeight = Math.min(this.menu.scrollHeight, maxHeight);
    const below = boundsBottom - rect.bottom;
    const above = rect.top - boundsTop;
    const openAbove = below < Math.min(measuredHeight, 180) && above > below;
    const idealTop = openAbove ? rect.top - measuredHeight - gap : rect.bottom + gap;
    const top = Math.max(boundsTop, Math.min(idealTop, boundsBottom - measuredHeight));
    const left = Math.max(boundsLeft, Math.min(rect.left, boundsRight - menuWidth));
    this.menu.dataset.placement = openAbove ? "top" : "bottom";
    this.menu.style.top = `${top}px`;
    this.menu.style.left = `${left}px`;
  }
}

const getInstance = (select) => instances.get(select);

export const enhanceCustomSelect = (select) => {
  if (!(select instanceof HTMLSelectElement) || !select.matches(SELECTOR)) return null;
  const existing = getInstance(select);
  if (existing) {
    existing.refresh();
    return existing;
  }
  const instance = new CustomSelect(select);
  instances.set(select, instance);
  return instance;
};

export const refreshCustomSelects = (root = document) => {
  if (!root) return;
  if (root instanceof HTMLSelectElement) return enhanceCustomSelect(root);
  root.querySelectorAll?.(SELECTOR).forEach((select) => enhanceCustomSelect(select)?.refresh());
};

const observeDynamicSelects = () => {
  if (documentObserver || !document.body) return;
  documentObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(SELECTOR)) enhanceCustomSelect(node);
      node.querySelectorAll?.(SELECTOR).forEach(enhanceCustomSelect);
    }));
    if (activeInstance && !activeInstance.trigger.isConnected) activeInstance.close();
  });
  documentObserver.observe(document.body, { childList: true, subtree: true });
};

export const initCustomSelects = (root = document) => {
  refreshCustomSelects(root);
  observeDynamicSelects();
  return { refresh: refreshCustomSelects };
};

document.addEventListener("pointerdown", (event) => {
  if (!activeInstance) return;
  if (activeInstance.wrapper.contains(event.target) || activeInstance.menu.contains(event.target)) return;
  activeInstance.close();
}, true);

document.addEventListener("reset", (event) => {
  nextFrame(() => refreshCustomSelects(event.target));
}, true);

document.addEventListener("invalid", (event) => {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const instance = getInstance(event.target);
  if (!instance) return;
  event.preventDefault();
  instance.wrapper.classList.add("is-invalid");
  instance.trigger.setAttribute("aria-invalid", "true");
  nextFrame(() => instance.trigger.focus());
}, true);

window.addEventListener("resize", () => activeInstance?.position(), { passive: true });
window.addEventListener("scroll", (event) => {
  if (event.target !== activeInstance?.menu) activeInstance?.position();
}, { passive: true, capture: true });
window.visualViewport?.addEventListener("resize", () => activeInstance?.position(), { passive: true });
window.visualViewport?.addEventListener("scroll", () => activeInstance?.position(), { passive: true });
