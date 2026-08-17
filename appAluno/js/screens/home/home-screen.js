import { Platform } from "../../core/platform.js?v=build-20260813-1";
import { LOCAL_BRAND_ASSETS_KEY } from "../../core/brand-theme.js?v=build-20260816-2";
import { escapeHtml, formatVolume } from "../../utils/formatters.js?v=build-20260816-1";

export const createHomeScreen = ({
  appState, emptyStudent, emptyWorkout, Store, homeWorkoutAction, homeWorkoutLabel,
  coachCard, coachOptions, getCoachInitials, setImageOrText, formatWorkoutAvailability,
  getCurrentExercises, getTotalSets, getActiveSession, getCompletedSessionSets, getSessionTotalSets
}) => {
  const renderStudent = () => {
    const student = appState.currentStudent || emptyStudent;
    document.querySelectorAll("[data-student-name]").forEach((item) => { item.textContent = student.name; });
    document.querySelectorAll("[data-student-initials]").forEach((item) => { item.textContent = student.initials; });
    const studentSince = document.querySelector("[data-student-since]");
    if (studentSince) {
      studentSince.hidden = !student.since;
      studentSince.textContent = student.since ? `Aluno desde ${String(student.since).toLowerCase()}` : "";
    }
    document.querySelector("[data-student-plan]").textContent = student.plan || "Sem plano";
    document.querySelector("[data-coach-name]").textContent = student.coach;
    document.querySelector("[data-coach-headline]").textContent = student.coachHeadline || "Prescrição e acompanhamento do seu treino.";
    document.querySelector("[data-profile-goal]").textContent = student.goal || "Não informado";
    document.querySelector("[data-profile-status]").textContent = student.status || "Não informado";
  };
  
  const renderAccessSelectors = () => {
    const hasMultipleCoaches = appState.studentAccesses.length > 1;
    const affordance = document.querySelector("[data-coach-card-affordance]");
    if (coachCard) {
      coachCard.disabled = !hasMultipleCoaches;
      coachCard.setAttribute("aria-label", hasMultipleCoaches
        ? `Personal ativo: ${appState.currentStudent.coach}. Abrir seleção de personal.`
        : `Personal: ${appState.currentStudent.coach}`);
    }
    if (affordance) affordance.hidden = !hasMultipleCoaches;
  
    if (coachOptions) {
      coachOptions.innerHTML = appState.studentAccesses.map((student) => {
        const coachName = student.coachName || "Personal";
        const isActive = student.id === appState.currentStudent.id;
        return `
          <button class="coach-option ${isActive ? "is-active" : ""}" type="button"
            data-select-coach="${escapeHtml(student.id)}" aria-pressed="${isActive}">
            <span class="avatar coach-option__photo" data-coach-option-photo="${escapeHtml(student.id)}" aria-hidden="true">${escapeHtml(getCoachInitials(coachName))}</span>
            <span class="coach-option__copy">
              <strong>${escapeHtml(coachName)}</strong>
              <small>${escapeHtml(student.coachHeadline || "Acompanhamento personalizado")}</small>
            </span>
            <span class="coach-option__check" aria-hidden="true">${isActive ? "✓" : ""}</span>
          </button>
        `;
      }).join("");
  
      const assets = Platform.storage.get(LOCAL_BRAND_ASSETS_KEY, {});
      const activePhoto = [...coachOptions.querySelectorAll("[data-coach-option-photo]")]
        .find((target) => target.dataset.coachOptionPhoto === String(appState.currentStudent.id || ""));
      if (activePhoto) {
        setImageOrText(activePhoto, assets.photoDataUrl, getCoachInitials(appState.currentStudent.coach), `Foto de ${appState.currentStudent.coach}`);
      }
    }
  
    const picker = document.querySelector("[data-workout-picker]");
    const options = document.querySelector("[data-workout-options]");
    const count = document.querySelector("[data-available-workout-count]");
    if (picker) picker.hidden = appState.availableWorkouts.length <= 1;
    if (count) count.textContent = `${appState.availableWorkouts.length} ${appState.availableWorkouts.length === 1 ? "disponível" : "disponíveis"}`;
    if (options) {
      options.innerHTML = appState.availableWorkouts.map((workout) => `
        <button class="workout-choice ${workout.id === appState.currentWorkout.id ? "is-active" : ""}" type="button" data-select-workout="${escapeHtml(workout.id)}">
          <strong>${escapeHtml(workout.title)}</strong>
          <span>${escapeHtml(workout.focus)}</span>
          <small>${escapeHtml(workout.estimatedMinutes)} min - ${escapeHtml(workout.exercises.length)} exercícios</small>
        </button>
      `).join("");
    }
  };
  
  const renderHome = () => {
    const upcomingWorkout = appState.upcomingWorkouts[0] || null;
    const hasWorkout = appState.currentWorkout.id !== emptyWorkout.id;
    const availabilityLabel = upcomingWorkout ? formatWorkoutAvailability(upcomingWorkout.startsAt) : "";
    document.querySelector("[data-home-workout]").textContent = hasWorkout
      ? "Treino disponível"
      : upcomingWorkout ? `Agendado para ${availabilityLabel}` : "Sem treino ativo";
    document.querySelector("[data-home-title]").textContent = hasWorkout
      ? appState.currentWorkout.title
      : upcomingWorkout ? upcomingWorkout.title : "Aguardando seu primeiro treino.";
    document.querySelector("[data-home-summary]").textContent =
      !hasWorkout
        ? upcomingWorkout
          ? `${upcomingWorkout.title} será liberado em ${availabilityLabel}.`
          : "Seu personal ainda não publicou um treino para você."
        : `${appState.currentWorkout.focus ? `${appState.currentWorkout.focus} · ` : ""}${getCurrentExercises().length} exercícios · ~${appState.currentWorkout.estimatedMinutes} min`;
    const sessions = Store.state.sessions || [];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter((session) => {
      const finishedAt = new Date(session.finishedAt || session.date || 0).getTime();
      return Number.isFinite(finishedAt) && finishedAt >= sevenDaysAgo;
    });
    const doneWorkouts = recentSessions.length;
    const volumeKg = recentSessions.reduce((sum, session) => sum + Number(session.volumeKg || session.volume || 0), 0);
    const completedSets = recentSessions.reduce((sum, session) => sum + Number(session.completedSets || session.sets || 0), 0);
    document.querySelector("[data-stat-done]").textContent = doneWorkouts;
    document.querySelector("[data-stat-volume]").textContent = formatVolume(volumeKg);
    document.querySelector("[data-stat-sets]").textContent = completedSets;
    const activeSession = getActiveSession();
    const currentCompletedSets = activeSession?.workoutId === appState.currentWorkout.id ? getCompletedSessionSets(activeSession) : 0;
    if (homeWorkoutAction) {
      homeWorkoutAction.disabled = !hasWorkout;
    }
    if (homeWorkoutLabel) {
      homeWorkoutLabel.textContent = hasWorkout
        ? currentCompletedSets > 0 ? "Continuar treino" : "Começar treino"
        : upcomingWorkout ? `Disponível em ${availabilityLabel}` : "Aguardando treino";
    }
    document.querySelector("[data-workout-title]").textContent = hasWorkout
      ? appState.currentWorkout.title
      : upcomingWorkout ? upcomingWorkout.title : "Treino";
    document.querySelector("[data-workout-focus]").textContent = hasWorkout
      ? appState.currentWorkout.focus
      : upcomingWorkout ? `Disponível em ${availabilityLabel}` : appState.currentWorkout.focus;
    document.querySelector("[data-workout-plan-title]").textContent = appState.currentWorkout.id === emptyWorkout.id ? "Sem treino ativo" : appState.currentWorkout.title;
    document.querySelector("[data-workout-last]").textContent = appState.currentWorkout.lastDoneLabel === "novo" ? "Ainda não executado" : `Última execução ${appState.currentWorkout.lastDoneLabel}`;
    document.querySelector("[data-workout-minutes]").textContent = `${appState.currentWorkout.estimatedMinutes} min`;
    document.querySelector("[data-workout-exercise-count]").textContent = `${getCurrentExercises().length} exercícios`;
    document.querySelector("[data-workout-set-count]").textContent = `${getTotalSets()} séries`;
    document.querySelectorAll("[data-active-workout-only]").forEach((element) => {
      element.hidden = !hasWorkout;
    });
  };
  
  const renderWorkoutProgress = () => {
    const activeSession = getActiveSession();
    const belongsToCurrentWorkout = activeSession?.workoutId === appState.currentWorkout.id;
    const totalSets = belongsToCurrentWorkout ? getSessionTotalSets(activeSession) : getTotalSets();
    const done = belongsToCurrentWorkout ? getCompletedSessionSets(activeSession) : 0;
    const percent = totalSets > 0 ? Math.round((done / totalSets) * 100) : 0;
    document.querySelector("[data-session-count]").textContent = `${done}/${totalSets} séries`;
    document.querySelector("[data-session-progress]").style.setProperty("--progress", `${percent}%`);
    document.querySelector("[data-session-progress-track]")?.setAttribute("aria-valuenow", String(percent));
    const startButton = document.querySelector("[data-start-workout]");
    if (startButton) {
      startButton.disabled = totalSets === 0;
      startButton.textContent = belongsToCurrentWorkout ? "Continuar treino" : "Começar treino";
    }
  };
  
  
  return { renderStudent, renderAccessSelectors, renderHome, renderWorkoutProgress };
};

