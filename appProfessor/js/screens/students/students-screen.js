import { svgIcon } from "../../../../appAluno/js/core/icons.js?v=build-20260822-1";
import { escapeHtml, formatUpdatedAt, formatVolume, normalizeSearch } from "../../utils/formatters.js?v=build-20260816-1";

export const createStudentsScreen = ({
  getStudents,
  viewState,
  getSessionsForStudent,
  getPublishedWorkoutForStudent,
  getPublishedWorkoutsForStudent,
  isInviteExpired,
  effortLabel,
  painLabel,
  setStudentSessionOpen,
  syncStudentSessionPresentation,
  setCount,
  renderStudentOptions,
  renderWorkoutPreview
}) => {
  const displayName = (student) => String(student?.displayName || student?.name || "Aluno").trim() || "Aluno";
  const studentSessionPanel = document.querySelector("[data-student-session-panel]");
  const studentList = document.querySelector("[data-student-list]");

  const aggregateSessionLogs = (logs = []) => {
    const grouped = new Map();
    logs.forEach((log) => {
      const key = log.workoutExerciseId || log.exerciseId || `${log.position}-${log.exerciseName}`;
      const current = grouped.get(key) || { ...log, completedSets: 0, entries: [] };
      if (log.setNumber) {
        current.completedSets += 1;
        current.loadKg = log.loadKg;
        current.reps = log.reps;
      } else {
        current.completedSets += Number(log.completedSets || 0);
      }
      current.entries.push(log);
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  };
  
  const renderStudentSessionPanel = () => {
    const students = getStudents();
    const target = studentSessionPanel;
    if (!target) return;
    const selectedStudent = students.find((student) => student.id === viewState.selectedStudentId) || null;
    if (!selectedStudent) {
      target.hidden = true;
      target.innerHTML = "";
      setStudentSessionOpen(false, { focus: false });
      return;
    }
    target.hidden = false;
    viewState.selectedStudentId = selectedStudent.id;
    const sessions = getSessionsForStudent(selectedStudent.id);
    const contactLine = [selectedStudent.email, selectedStudent.phone].filter(Boolean).join(" · ");
    const totalSessions = sessions.length;
    const lastSession = sessions[0] || null;
    const totalVolume = sessions.reduce((sum, session) => sum + Number(session.volumeKg || 0), 0);
    const painCount = sessions.filter((session) => session.feedback?.pain && session.feedback.pain !== "none").length;
    const averageSets = totalSessions
      ? Math.round(sessions.reduce((sum, session) => sum + Number(session.completedSets || 0), 0) / totalSessions)
      : 0;
    const publishedWorkouts = getPublishedWorkoutsForStudent(selectedStudent);
  
    const sessionCards = sessions.slice(0, 5).map((session) => {
      const setRows = aggregateSessionLogs(session.setLogs || []).slice(0, 8).map((log) => {
        const individualSets = log.entries.filter((entry) => entry.setNumber);
        const detail = individualSets.length
          ? individualSets.map((entry) => `${entry.loadKg}kg × ${entry.reps}${entry.discomfort && entry.discomfort !== "none" ? " · ⚠ desconforto" : ""}`).join(" · ")
          : `${log.loadKg}kg × ${log.reps}`;
        return `
          <article class="session-log-row">
            <div><strong>${escapeHtml(log.exerciseName)}</strong><small>${escapeHtml(log.prescription || "")}</small></div>
            <span class="chip">${escapeHtml(String(log.completedSets))} séries</span>
            <span>${escapeHtml(detail)}</span>
          </article>
        `;
      }).join("");
      return `
        <details class="session-card">
          <summary class="session-card__summary">
            <div>
              <span class="eyebrow">${escapeHtml(formatUpdatedAt(session.finishedAt))}</span>
              <h3>${escapeHtml(session.workoutTitle)}</h3>
              <span class="session-card__summary-line">${escapeHtml(session.completedSets)}/${escapeHtml(session.totalSets)} séries · ${session.status === "partial" ? "parcial · " : ""}${escapeHtml(effortLabel(session.feedback?.effort))} · ${escapeHtml(painLabel(session.feedback?.pain))}</span>
            </div>
            <span class="session-card__summary-action">
              <span class="chip">${escapeHtml(formatVolume(session.volumeKg))}</span>
              <span class="session-card__chevron">${svgIcon("chevron-down")}</span>
            </span>
          </summary>
          <div class="session-card__body">
            ${session.feedback?.note ? `<p class="session-card__note">${escapeHtml(session.feedback.note)}</p>` : ""}
            <section class="session-log-list">${setRows || `<article class="empty-state"><strong>Sem detalhes das séries</strong><small>Este treino não possui registros por exercício.</small></article>`}</section>
          </div>
        </details>
      `;
    }).join("");
  
    target.innerHTML = `
      <div class="student-session-panel__head">
        <div class="student-session-panel__title">
          <button class="button button--quiet" type="button" data-student-session-close>${svgIcon("chevron-left")} Voltar para alunos</button>
          <span class="eyebrow">Acompanhamento</span>
          <h2 id="student-session-title">${escapeHtml(displayName(selectedStudent))}</h2>
          ${contactLine ? `<p>${escapeHtml(contactLine)}</p>` : ""}
        </div>
        <div class="student-session-panel__actions">
          ${publishedWorkouts.length ? `<button class="button button--quiet" type="button" data-open-student-programming="${escapeHtml(selectedStudent.id)}">Abrir programação</button>` : ""}
          <button class="button button--quiet" type="button" data-refresh-sessions>Atualizar</button>
        </div>
      </div>
      <div class="student-session-panel__metrics">
        <span><strong>${totalSessions}</strong><small>concluídos</small></span>
        <span><strong>${lastSession ? formatUpdatedAt(lastSession.finishedAt) : "—"}</strong><small>último treino</small></span>
        <span><strong>${formatVolume(totalVolume)}</strong><small>volume</small></span>
        <span><strong>${painCount ? `${painCount} alerta(s)` : `${averageSets} séries`}</strong><small>${painCount ? "dor/desconforto" : "média"}</small></span>
      </div>
      <section class="session-list">
        ${sessionCards || `<article class="empty-state"><strong>Sem treinos concluídos</strong><small>O histórico aparecerá após o primeiro treino.</small></article>`}
      </section>
    `;
    syncStudentSessionPresentation();
  };
  
  const renderStudents = () => {
    const students = getStudents();
    const target = studentList;
    if (!students.some((student) => student.id === viewState.selectedStudentId)) {
      viewState.selectedStudentId = "";
    }
    const query = normalizeSearch(viewState.studentSearchQuery);
    const visibleStudents = students.filter((student) => {
      const matchesSearch = !query
        || normalizeSearch([displayName(student), student.name, student.email, student.goal, student.status].join(" ")).includes(query);
      const matchesFilter = viewState.studentFilter === "all"
        || (viewState.studentFilter === "without-workout" && !getPublishedWorkoutForStudent(student))
        || (viewState.studentFilter === "invite-pending" && student.inviteStatus !== "accepted" && !isInviteExpired(student))
        || (viewState.studentFilter === "invite-expired" && isInviteExpired(student));
      return matchesSearch && matchesFilter;
    });
    setCount(query || viewState.studentFilter !== "all"
      ? `${visibleStudents.length} de ${students.length}`
      : `${students.length} ${students.length === 1 ? "cadastrado" : "cadastrados"}`);
    if (!target) {
      renderStudentOptions();
      renderWorkoutPreview();
      renderStudentSessionPanel();
      return;
    }
    if (!students.length) {
      target.innerHTML = `<article class="empty-state empty-state--action"><strong>Nenhum aluno cadastrado</strong><small>Adicione o primeiro aluno para começar.</small><button class="button" type="button" data-toggle-student-form>Novo aluno</button></article>`;
      renderStudentOptions();
      renderWorkoutPreview();
      renderStudentSessionPanel();
      return;
    }
  
    if (!visibleStudents.length) {
      target.innerHTML = `<article class="empty-state"><strong>Nenhum aluno encontrado</strong><small>Ajuste a busca ou o filtro selecionado.</small></article>`;
      renderStudentOptions();
      renderWorkoutPreview();
      renderStudentSessionPanel();
      return;
    }
  
    const rows = visibleStudents.map((student) => {
      const publishedWorkout = getPublishedWorkoutForStudent(student);
      const workoutLabel = publishedWorkout?.title || "Sem treino publicado";
      const studentSessions = getSessionsForStudent(student.id);
      const latestSession = studentSessions[0] || null;
      const followupLabel = latestSession
        ? `Último: ${formatUpdatedAt(latestSession.finishedAt)}`
        : "Nenhum treino concluído";
      const accessState = student.inviteStatus === "accepted"
        ? "active"
        : isInviteExpired(student) ? "expired" : "pending";
      const accessLabel = accessState === "active" ? "Acesso ativo" : accessState === "expired" ? "Convite expirado" : "Convite pendente";
      const accessEmail = student.email || "Sem email de acesso";
      const contactLine = [accessEmail, student.phone].filter(Boolean).join(" · ");
      const localSyncPending = ["pending", "syncing", "failed"].includes(student.syncStatus);
      const localSyncLabel = student.syncStatus === "failed" ? "Falha ao sincronizar cadastro" : "Cadastro aguardando sincronização";
      const statusIsException = student.status && student.status !== "Ativo";
      const studentName = displayName(student);
      return `
        <article class="entity-row student-row" data-student-card="${escapeHtml(student.id)}">
          <div class="entity-row__identity">
            <span class="avatar">${student.photoUrl ? `<img src="${escapeHtml(student.photoUrl)}" alt="Foto de ${escapeHtml(studentName)}" loading="lazy">` : escapeHtml(studentName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || student.initials)}</span>
            <div><h2>${escapeHtml(studentName)}</h2><small>${escapeHtml(contactLine)}</small></div>
          </div>
          <div class="entity-row__field"><small>Objetivo</small><span>${escapeHtml(student.goal)}</span></div>
          <div class="entity-row__field"><small>Treino</small><span>${escapeHtml(workoutLabel)}</span></div>
          <div class="entity-row__field entity-row__states">
            <small>Status e acesso</small>
            <span class="status-text${statusIsException ? " is-exception" : ""}">${escapeHtml(student.status)}</span>
            <span class="status-text${accessState === "active" ? "" : " is-exception"}" data-access-state="${accessState}">${escapeHtml(accessLabel)}</span>
            ${localSyncPending ? `<span class="status-text is-exception">${escapeHtml(localSyncLabel)}</span>` : ""}
          </div>
          <div class="entity-row__field"><small>Última sessão</small><span>${escapeHtml(followupLabel)}</span></div>
          <div class="entity-row__actions">
            ${publishedWorkout
              ? `<button class="button" type="button" data-student-detail="${escapeHtml(student.id)}">Acompanhar</button>`
              : `<button class="button" type="button" data-student-action="${escapeHtml(student.id)}">Programar</button>`}
            <details class="action-menu entity-menu">
              <summary class="icon-button" aria-label="Mais ações para ${escapeHtml(studentName)}">•••</summary>
              <div class="action-menu__popover">
                <button type="button" data-student-invite="${escapeHtml(student.id)}">Enviar convite</button>
                ${localSyncPending ? `<button type="button" data-student-retry-sync="${escapeHtml(student.id)}">Tentar sincronizar cadastro</button>` : ""}
                ${publishedWorkout ? `<button type="button" data-student-action="${escapeHtml(student.id)}">Editar programação</button>` : ""}
              </div>
            </details>
          </div>
        </article>
      `;
    }).join("");
    target.innerHTML = `
      <div class="entity-list__header" aria-hidden="true">
        <span>Aluno</span><span>Objetivo</span><span>Treino</span><span>Status e acesso</span><span>Última sessão</span><span>Ações</span>
      </div>
      ${rows}
    `;
    renderStudentOptions();
    renderWorkoutPreview();
    renderStudentSessionPanel();
  };
  
  

  return {
    render: renderStudents,
    renderSessionPanel: renderStudentSessionPanel,
    aggregateSessionLogs
  };
};
