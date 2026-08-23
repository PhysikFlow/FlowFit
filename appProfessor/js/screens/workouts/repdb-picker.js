import {
  filterRepdbExercises,
  getRepdbFilterValues,
  getRepdbPoseUrls,
  loadRepdbCatalog,
  normalizeRepdbMetadata,
  repdbBodyPartLabel,
  repdbEquipmentLabel
} from "../../../../appAluno/js/data/repdb/repdb-catalog.js?v=build-20260823-1";

const PAGE_SIZE = 30;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const optionMarkup = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;

export const createRepdbPicker = ({
  dialog,
  searchInput,
  bodyPartSelect,
  equipmentSelect,
  results,
  status,
  selection,
  confirmButton,
  closeButtons = [],
  onConfirm,
  refreshSelects = () => {}
} = {}) => {
  if (!dialog || !searchInput || !bodyPartSelect || !equipmentSelect || !results || !selection || !confirmButton) {
    return { open: async () => false, close: () => {} };
  }

  let catalog = null;
  let filtered = [];
  let renderedCount = 0;
  let selectedId = "";
  let targetKey = "";
  let observer = null;
  let renderFrame = 0;

  const selectedExercise = () => catalog?.byId.get(selectedId) || null;

  const setStatus = (message, state = "") => {
    status.textContent = message;
    status.classList.toggle("is-warning", state === "warning");
    status.classList.toggle("is-synced", state === "synced");
  };

  const renderSelection = () => {
    const exercise = selectedExercise();
    confirmButton.disabled = !exercise;
    if (!exercise) {
      selection.innerHTML = `<span class="repdb-picker__selection-empty">Escolha uma ilustração para visualizar as poses.</span>`;
      return;
    }
    const poses = getRepdbPoseUrls(exercise.metadata);
    const poseMarkup = [
      poses.start ? ["Início", poses.start] : null,
      poses.peak ? ["Pico", poses.peak] : null,
      !poses.start && !poses.peak && poses.main ? ["Pose principal", poses.main] : null
    ].filter(Boolean).map(([label, url]) => `
      <figure>
        <img src="${escapeHtml(url)}" alt="" loading="eager" />
        <figcaption>${escapeHtml(label)}</figcaption>
      </figure>
    `).join("");
    selection.innerHTML = `
      <div class="repdb-picker__selection-copy">
        <strong>${escapeHtml(exercise.name)}</strong>
        <small>${escapeHtml(repdbBodyPartLabel(exercise.bodyPart))} · ${escapeHtml(repdbEquipmentLabel(exercise.equipment))}</small>
      </div>
      <div class="repdb-picker__selection-poses">${poseMarkup}</div>
    `;
  };

  const cardMarkup = (exercise) => `
    <button class="repdb-exercise-card${exercise.id === selectedId ? " is-selected" : ""}" type="button"
      data-repdb-exercise="${escapeHtml(exercise.id)}" aria-pressed="${exercise.id === selectedId}">
      <span class="repdb-exercise-card__media">
        <img src="${escapeHtml(exercise.posterUrl)}" alt="" loading="lazy" decoding="async" />
      </span>
      <span class="repdb-exercise-card__copy">
        <strong>${escapeHtml(exercise.name)}</strong>
        <small>${escapeHtml(repdbBodyPartLabel(exercise.bodyPart))} · ${escapeHtml(repdbEquipmentLabel(exercise.equipment))}</small>
        <span>${exercise.poseCount > 1 ? "2 etapas" : "Pose única"}</span>
      </span>
      <i aria-hidden="true">✓</i>
    </button>
  `;

  const appendBatch = () => {
    const next = filtered.slice(renderedCount, renderedCount + PAGE_SIZE);
    results.querySelector("[data-repdb-sentinel]")?.remove();
    results.insertAdjacentHTML("beforeend", next.map(cardMarkup).join(""));
    renderedCount += next.length;
    if (renderedCount < filtered.length) {
      results.insertAdjacentHTML("beforeend", `<div class="repdb-picker__sentinel" data-repdb-sentinel aria-hidden="true"></div>`);
      observer?.observe(results.querySelector("[data-repdb-sentinel]"));
    }
  };

  const applyFilters = () => {
    if (!catalog) return;
    filtered = filterRepdbExercises(catalog.exercises, {
      query: searchInput.value,
      bodyPart: bodyPartSelect.value,
      equipment: equipmentSelect.value
    });
    renderedCount = 0;
    results.innerHTML = "";
    if (!filtered.length) {
      results.innerHTML = `<div class="repdb-picker__empty"><strong>Nenhuma ilustração encontrada.</strong><small>Tente outro termo ou remova um filtro.</small></div>`;
      setStatus("Nenhum resultado para os filtros atuais.");
      return;
    }
    appendBatch();
    setStatus(`${filtered.length} ${filtered.length === 1 ? "ilustração encontrada" : "ilustrações encontradas"}.`);
  };

  const scheduleFilters = () => {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(applyFilters);
  };

  const fillFilters = () => {
    bodyPartSelect.innerHTML = optionMarkup("", "Todas as regiões") + getRepdbFilterValues(catalog.exercises, "bodyPart")
      .map((value) => optionMarkup(value, repdbBodyPartLabel(value))).join("");
    equipmentSelect.innerHTML = optionMarkup("", "Todos os equipamentos") + getRepdbFilterValues(catalog.exercises, "equipment")
      .map((value) => optionMarkup(value, repdbEquipmentLabel(value))).join("");
    refreshSelects(dialog);
  };

  const close = () => {
    cancelAnimationFrame(renderFrame);
    observer?.disconnect();
    if (dialog.open) dialog.close();
  };

  const open = async ({ draftKey = "", mediaMetadata = {} } = {}) => {
    targetKey = draftKey;
    selectedId = normalizeRepdbMetadata(mediaMetadata).exerciseId || "";
    searchInput.value = "";
    bodyPartSelect.value = "";
    equipmentSelect.value = "";
    results.innerHTML = `<div class="repdb-picker__loading" aria-hidden="true"><span></span><span></span><span></span></div>`;
    setStatus("Carregando biblioteca de ilustrações…");
    renderSelection();
    if (!dialog.open) dialog.showModal();
    try {
      catalog = catalog || await loadRepdbCatalog();
      fillFilters();
      if (selectedId && !catalog.byId.has(selectedId)) selectedId = "";
      renderSelection();
      applyFilters();
      window.setTimeout(() => searchInput.focus(), 0);
      return true;
    } catch (error) {
      console.warn("[FlowFit][RepDB] Falha ao carregar catálogo", error);
      results.innerHTML = `
        <div class="repdb-picker__empty">
          <strong>Biblioteca indisponível.</strong>
          <small>${navigator.onLine ? "Não foi possível baixar o catálogo agora." : "Conecte-se à internet para o primeiro acesso."}</small>
          <button class="button button--quiet" type="button" data-repdb-retry>Tentar novamente</button>
        </div>`;
      setStatus("A ilustração atual não foi alterada.", "warning");
      return false;
    }
  };

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) appendBatch();
    }, { root: results, rootMargin: "180px" });
  } else {
    results.addEventListener("scroll", () => {
      if (results.scrollHeight - results.scrollTop - results.clientHeight < 240) appendBatch();
    }, { passive: true });
  }

  searchInput.addEventListener("input", scheduleFilters);
  bodyPartSelect.addEventListener("change", scheduleFilters);
  equipmentSelect.addEventListener("change", scheduleFilters);
  results.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-repdb-retry]");
    if (retry) {
      catalog = null;
      loadRepdbCatalog({ force: true }).then((loaded) => {
        catalog = loaded;
        fillFilters();
        renderSelection();
        applyFilters();
      }).catch(() => setStatus("Ainda não foi possível carregar a biblioteca.", "warning"));
      return;
    }
    const card = event.target.closest("[data-repdb-exercise]");
    if (!card) return;
    selectedId = card.dataset.repdbExercise;
    results.querySelectorAll("[data-repdb-exercise]").forEach((item) => {
      const selected = item.dataset.repdbExercise === selectedId;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderSelection();
    selection.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });

  confirmButton.addEventListener("click", () => {
    const exercise = selectedExercise();
    if (!exercise) return;
    onConfirm?.({ draftKey: targetKey, exercise });
    close();
  });
  closeButtons.forEach((button) => button?.addEventListener("click", close));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  return { open, close };
};
