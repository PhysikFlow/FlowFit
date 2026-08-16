import { Store } from "../../core/store.js?v=build-20260813-1";
import { svgIcon } from "../../core/icons.js?v=build-20260810-7";
import { deltaTone, formatDecimal, formatDelta, formatShortDate } from "../../utils/formatters.js?v=build-20260816-1";

export const createEvolutionScreen = ({ disclosure }) => {
  const elements = {
    page: document.querySelector('[data-page="progress"]'),
    history: document.querySelector("[data-progress-history]"),
    chart: document.querySelector("[data-chart]"),
    metrics: document.querySelector("[data-metric-list]"),
    measurementHistory: document.querySelector("[data-measurement-history]"),
    date: document.querySelector("[data-measurements-date]")
  };

  const render = () => {
    const entries = Store.getProgressEntries([]);
    const heading = elements.page?.querySelector(".page-heading");
    if (disclosure && elements.page) {
      if (entries.length) elements.page.append(disclosure);
      else heading?.after(disclosure);
    }
    if (disclosure && disclosure.dataset.initialized !== "true") {
      disclosure.open = entries.length === 0;
      disclosure.dataset.initialized = "true";
    }
    if (elements.history) elements.history.hidden = entries.length === 0;
    if (!entries.length) {
      elements.chart?.replaceChildren();
      elements.metrics?.replaceChildren();
      elements.measurementHistory?.replaceChildren();
      return;
    }

    const recentEntries = entries.slice(-7);
    const latest = entries.at(-1);
    const weights = recentEntries.map((entry) => entry.weight);
    const minWeight = Math.min(...weights);
    const span = Math.max(Math.max(...weights) - minWeight, 1);
    const definitions = [
      { field: "weight", icon: "scale", label: "Peso", unit: "kg" },
      { field: "waist", icon: "ruler", label: "Cintura", unit: "cm" },
      { field: "arm", icon: "weight", label: "Braço", unit: "cm" }
    ];
    const metrics = definitions.filter(({ field }) => Number(latest[field]) > 0).map((metric) => {
      const previous = [...entries].slice(0, -1).reverse().find((entry) => Number(entry[metric.field]) > 0)?.[metric.field];
      return {
        ...metric,
        value: `${formatDecimal(latest[metric.field])} ${metric.unit}`,
        delta: previous === undefined ? "Primeiro registro" : formatDelta(latest[metric.field], previous, metric.unit),
        tone: previous === undefined ? "neutral" : deltaTone(latest[metric.field], previous)
      };
    });

    elements.chart.innerHTML = recentEntries.map((entry) => {
      const height = 28 + Math.round(((entry.weight - minWeight) / span) * 63);
      return `<span style="--height: ${height}%"><small>${formatShortDate(entry.date)}</small></span>`;
    }).join("");
    elements.date.textContent = formatShortDate(latest.date);
    elements.metrics.innerHTML = metrics.map((metric) => `
      <article class="metric card">
        <span class="surface-icon">${svgIcon(metric.icon)}</span>
        <div><strong>${metric.label}</strong><small>Registro atual</small></div>
        <div class="metric__value" data-delta-tone="${metric.tone}"><strong>${metric.value}</strong><small>${metric.delta}</small></div>
      </article>
    `).join("");
    elements.measurementHistory.innerHTML = [...entries].reverse().slice(0, 6).map((entry) => {
      const measures = [
        Number(entry.waist) > 0 ? `Cintura ${formatDecimal(entry.waist)} cm` : "",
        Number(entry.arm) > 0 ? `Braço ${formatDecimal(entry.arm)} cm` : ""
      ].filter(Boolean);
      return `<article class="measurement-row card"><span class="surface-icon">${svgIcon("ruler")}</span><div><strong>${formatShortDate(entry.date)}</strong><small>Peso ${formatDecimal(entry.weight)} kg</small></div>${measures.map((measure) => `<span>${measure}</span>`).join("")}</article>`;
    }).join("");
  };

  return { render };
};
