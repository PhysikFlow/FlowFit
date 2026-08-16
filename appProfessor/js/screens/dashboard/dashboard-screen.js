import { svgIcon } from "../../../../appAluno/js/core/icons.js?v=build-20260809-6";
import { escapeHtml } from "../../utils/formatters.js?v=build-20260816-1";

export const createDashboardScreen = ({
  accountPlan,
  getStudents,
  getWorkouts,
  getSessions,
  getDataStatus,
  getStudentSituations,
  formatVolume,
  effortLabel,
  formatUpdatedAt,
  setStatus
}) => {
  const elements = {
    tasks: document.querySelector("[data-task-list]"),
    activities: document.querySelector("[data-activity-list]"),
    syncChip: document.querySelector("[data-sync-chip]"),
    syncNotice: document.querySelector("[data-sync-notice]"),
    accountProgress: document.querySelector("[data-account-limit-progress]"),
    accountStatus: document.querySelector("[data-account-status]")
  };
  const setText = (selector, value) => {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  };

  const renderTasks = () => {
    const students = getStudents();
    if (!students.length) {
      elements.tasks.innerHTML = `<article class="empty-state empty-state--action"><strong>Cadastre o primeiro aluno</strong><small>O acompanhamento e os treinos aparecerão aqui.</small><button class="button" type="button" data-task-go="students" data-task-action="new-student">Adicionar aluno</button></article>`;
      return;
    }
    elements.tasks.innerHTML = students.map((student) => {
      const situation = getStudentSituations(student);
      const action = situation.publishedWorkout ? "open-student" : "new-workout";
      const secondary = situation.secondary.length
        ? `+${situation.secondary.length} ${situation.secondary.length === 1 ? "outra situação" : "outras situações"}`
        : "";
      return `<button class="task-row" type="button" data-task-go="${action === "new-workout" ? "workouts" : "students"}" data-task-action="${action}" data-task-student="${escapeHtml(student.id)}"><span class="avatar avatar--small">${escapeHtml(student.initials)}</span><div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(situation.main)}</small></div>${secondary ? `<span class="task-row__secondary">${escapeHtml(secondary)}</span>` : ""}<span class="task-row__arrow">${svgIcon("chevron-right")}</span></button>`;
    }).join("");
  };

  const renderActivities = () => {
    const activities = [
      ...getSessions().map((session) => ({ icon: "trophy", title: `${session.workoutTitle} concluído`, detail: `${formatVolume(session.volumeKg)} - ${effortLabel(session.feedback?.effort)} - ${formatUpdatedAt(session.finishedAt)}`, time: session.finishedAt })),
      ...getWorkouts().map((workout) => ({ icon: "dumbbell", title: `Treino publicado para ${workout.owner}`, detail: `${workout.title} - ${formatUpdatedAt(workout.updatedAt)}`, time: workout.updatedAt }))
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 6);
    if (!activities.length) {
      elements.activities.innerHTML = `<article class="empty-state"><strong>Ainda sem atividade.</strong><small>As primeiras ações aparecerão aqui.</small></article>`;
      return;
    }
    elements.activities.innerHTML = activities.map((item) => `<article class="activity-row"><span class="surface-icon">${svgIcon(item.icon)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div></article>`).join("");
  };

  const renderAccount = () => {
    const activeCount = getStudents().filter((student) => student.status === "Ativo").length;
    const limit = accountPlan.activeStudentLimit;
    const usage = limit ? Math.min(100, Math.round((activeCount / limit) * 100)) : 0;
    setText("[data-account-plan]", accountPlan.name);
    setText("[data-account-active-students]", activeCount);
    setText("[data-account-student-limit]", limit);
    elements.accountProgress?.style.setProperty("--progress", `${usage}%`);
    const exceeded = activeCount > limit;
    const nearLimit = activeCount >= Math.max(1, Math.round(limit * 0.8));
    setStatus(elements.accountStatus, exceeded
      ? `Limite excedido em ${activeCount - limit}. Arquive alunos inativos antes de adicionar novos.`
      : nearLimit ? `${activeCount} de ${limit} alunos ativos. Você está perto do limite.` : "", exceeded || nearLimit ? "warning" : "");
  };

  const render = () => {
    const students = getStudents();
    const workouts = getWorkouts();
    const status = getDataStatus();
    const online = status === "Online";
    const syncing = status === "Sincronizando";
    setText("[data-dashboard-headline]", students.length ? "Situações atuais" : "Comece pelo primeiro aluno");
    setText("[data-dashboard-summary]", students.length
      ? `${students.length} ${students.length === 1 ? "aluno" : "alunos"} · ${workouts.length} ${workouts.length === 1 ? "treino publicado" : "treinos publicados"}`
      : "Cadastre o aluno para iniciar o acompanhamento.");
    setText("[data-sync-chip]", online ? "Online" : syncing ? "Sincronizando" : "Local");
    elements.syncChip?.classList.toggle("chip--success", online);
    elements.syncChip?.classList.toggle("chip--warning", !online);
    setText("[data-sync-title]", online ? "Sincronizado" : syncing ? "Sincronizando" : "Offline");
    setText("[data-sync-detail]", online ? "Dados atualizados." : syncing ? "Atualizando dados..." : "Conecte-se para enviar alterações.");
    elements.syncNotice?.toggleAttribute("hidden", online);
    elements.syncNotice?.classList.toggle("is-online", online);
    elements.syncNotice?.classList.toggle("is-syncing", syncing);
    renderTasks();
    renderActivities();
    renderAccount();
  };

  return { render, renderAccount, renderActivities, renderTasks };
};
