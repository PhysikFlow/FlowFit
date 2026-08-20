import {
  buildWorkoutPdfFileName,
  createWorkoutPdf,
  downloadWorkoutPdf
} from "./workout-pdf-generator.js?v=build-20260820-1";

const parseSets = (prescription) => {
  const match = String(prescription || "").match(/\d+/);
  return Number.parseInt(match?.[0] || "0", 10) || 0;
};

export const createWorkoutPdfExporter = ({ getContext, setStatus, showToast }) => {
  const dialog = document.querySelector("[data-workout-pdf-dialog]");
  const form = dialog?.querySelector("[data-workout-pdf-form]");
  const closeButtons = [...(dialog?.querySelectorAll("[data-close-workout-pdf]") || [])];
  const title = dialog?.querySelector("[data-workout-pdf-title]");
  const student = dialog?.querySelector("[data-workout-pdf-student]");
  const focus = dialog?.querySelector("[data-workout-pdf-focus]");
  const exercises = dialog?.querySelector("[data-workout-pdf-exercises]");
  const sets = dialog?.querySelector("[data-workout-pdf-sets]");
  const duration = dialog?.querySelector("[data-workout-pdf-duration]");
  const fileName = dialog?.querySelector("[data-workout-pdf-file]");
  const status = dialog?.querySelector("[data-workout-pdf-status]");
  const downloadButton = dialog?.querySelector("[data-workout-pdf-download]");
  let activeWorkout = null;
  let isGenerating = false;

  const write = (element, value) => {
    if (element) element.textContent = String(value ?? "");
  };

  const close = () => {
    if (isGenerating || !dialog?.open) return;
    dialog.close();
  };

  const open = (workout) => {
    if (!dialog || !form || !workout) return false;
    activeWorkout = workout;
    const workoutExercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const totalSets = workoutExercises.reduce((sum, exercise) => sum + parseSets(exercise.prescription), 0);
    write(title, workout.title || "Treino");
    write(student, workout.owner || "Aluno");
    write(focus, workout.focus || "Prescrição personalizada");
    write(exercises, workoutExercises.length);
    write(sets, totalSets);
    write(duration, `${Math.max(0, Number(workout.estimatedMinutes || 0))} min`);
    write(fileName, buildWorkoutPdfFileName(workout));
    setStatus(status, "Revise o resumo e baixe a ficha do treino.", "");
    if (downloadButton) {
      downloadButton.disabled = false;
      downloadButton.textContent = "Baixar PDF";
      downloadButton.removeAttribute("aria-busy");
    }
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => downloadButton?.focus(), 60);
    return true;
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeWorkout || isGenerating) return;
    isGenerating = true;
    if (downloadButton) {
      downloadButton.disabled = true;
      downloadButton.textContent = "Gerando PDF…";
      downloadButton.setAttribute("aria-busy", "true");
    }
    setStatus(status, "Montando a ficha com os dados atuais do treino…", "");

    try {
      const context = getContext(activeWorkout);
      const bytes = await createWorkoutPdf(context);
      const outputName = buildWorkoutPdfFileName(activeWorkout);
      downloadWorkoutPdf(bytes, outputName);
      setStatus(status, `PDF baixado como “${outputName}”.`, "synced");
      showToast?.("PDF do treino baixado.");
      if (downloadButton) downloadButton.textContent = "Baixar novamente";
    } catch (error) {
      console.error("Falha ao gerar PDF do treino", error);
      setStatus(status, error?.message || "Não foi possível gerar o PDF deste treino.", "warning");
      showToast?.("Não foi possível gerar o PDF.");
      if (downloadButton) downloadButton.textContent = "Tentar novamente";
    } finally {
      isGenerating = false;
      if (downloadButton) {
        downloadButton.disabled = false;
        downloadButton.removeAttribute("aria-busy");
      }
    }
  });

  closeButtons.forEach((button) => button.addEventListener("click", close));
  dialog?.addEventListener("cancel", (event) => {
    if (isGenerating) event.preventDefault();
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog?.addEventListener("close", () => {
    activeWorkout = null;
    isGenerating = false;
    form?.reset();
  });

  return { open, close };
};
