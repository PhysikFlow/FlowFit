import { svgIcon } from "../../../../appAluno/js/core/icons.js?v=build-20260822-1";
import { escapeHtml, formatUpdatedAt, normalizeSearch } from "../../utils/formatters.js?v=build-20260816-1";

export const createWorkoutsScreen = ({
  getWorkouts,
  getSearchQuery,
  getFilter,
  getWorkoutStage,
  getWorkoutBlocks,
  getWorkoutSyncLabel,
  parseSets,
  setCount
}) => {
  const list = document.querySelector("[data-workout-list]");

  const render = () => {
    const workouts = getWorkouts();
    const query = normalizeSearch(getSearchQuery());
    const filter = getFilter();
    const visibleWorkouts = workouts.filter((workout) => {
      const stage = getWorkoutStage(workout);
      const matchesSearch = !query
        || normalizeSearch([workout.title, workout.owner, workout.focus, stage.label].join(" ")).includes(query);
      const matchesFilter = filter === "all"
        || (filter === "active" && stage.label === "Ativo")
        || (filter === "scheduled" && stage.label === "Agendado");
      return matchesSearch && matchesFilter;
    });

    setCount(query || filter !== "all"
      ? `${visibleWorkouts.length} de ${workouts.length}`
      : `${workouts.length} ${workouts.length === 1 ? "publicado" : "publicados"}`);
    if (!list) return;
    if (!workouts.length) {
      list.innerHTML = `<article class="empty-state empty-state--action"><strong>Nenhum treino publicado</strong><small>Crie o primeiro treino para um aluno cadastrado.</small><button class="button" type="button" data-open-workout-form>Novo treino</button></article>`;
      return;
    }
    if (!visibleWorkouts.length) {
      list.innerHTML = `<article class="empty-state"><strong>Nenhum treino encontrado</strong><small>Ajuste a busca ou o filtro selecionado.</small></article>`;
      return;
    }

    const rows = visibleWorkouts.map((workout) => {
      const blocks = getWorkoutBlocks(workout);
      const exerciseCount = (workout.exercises || []).length;
      const totalSets = (workout.exercises || []).reduce((sum, exercise) => sum + parseSets(exercise.prescription), 0);
      const stage = getWorkoutStage(workout);
      const syncLabel = getWorkoutSyncLabel(workout);
      return `
        <article class="entity-row workout-row">
          <div class="entity-row__identity">
            <span class="surface-icon">${svgIcon("dumbbell")}</span>
            <div><h2>${escapeHtml(workout.title)}</h2><small>${escapeHtml(workout.focus || blocks[0] || "Treino")}</small></div>
          </div>
          <div class="entity-row__field"><small>Aluno</small><span>${escapeHtml(workout.owner || "Aluno")}</span></div>
          <div class="entity-row__field"><small>Estágio</small><span class="status-text">${escapeHtml(stage.label)}</span><span>${escapeHtml(stage.detail)}</span></div>
          <div class="entity-row__field"><small>Resumo</small><span>${exerciseCount} exercícios · ${totalSets} séries · ${escapeHtml(workout.estimatedMinutes || 0)} min</span></div>
          <div class="entity-row__field"><small>Atualização</small><span>${escapeHtml(formatUpdatedAt(workout.updatedAt))}</span><span class="status-text${syncLabel === "Publicado" ? "" : " is-exception"}">${escapeHtml(syncLabel)}</span></div>
          <div class="entity-row__actions">
            <button class="button" type="button" aria-label="Editar ${escapeHtml(workout.title)}" data-workout-action="${escapeHtml(workout.id)}">Editar</button>
            <details class="action-menu entity-menu">
              <summary class="icon-button" aria-label="Mais ações para ${escapeHtml(workout.title)}">•••</summary>
              <div class="action-menu__popover action-menu__popover--end">
                <button type="button" data-workout-duplicate="${escapeHtml(workout.id)}">Duplicar treino</button>
                <button type="button" data-workout-pdf="${escapeHtml(workout.id)}">PDF</button>
                <button class="is-danger" type="button" data-workout-archive="${escapeHtml(workout.id)}">Arquivar</button>
              </div>
            </details>
          </div>
        </article>
      `;
    }).join("");
    list.innerHTML = `
      <div class="entity-list__header entity-list__header--workouts" aria-hidden="true">
        <span>Treino</span><span>Aluno</span><span>Estágio</span><span>Resumo</span><span>Atualização</span><span>Ações</span>
      </div>
      ${rows}
    `;
  };

  return { render };
};
