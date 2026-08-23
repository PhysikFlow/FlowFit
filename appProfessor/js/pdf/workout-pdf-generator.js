import { PDFDocument, StandardFonts, rgb } from "../../vendor/pdf-lib/pdf-lib.esm.min.js?v=1.17.1";

const A4 = [595.28, 841.89];
const PAGE_MARGIN = 38;
const WIN_ANSI_EXTRAS = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ×"]);

const cleanText = (value, fallback = "") => {
  const normalized = String(value ?? fallback).normalize("NFC").replace(/\s+/g, " ").trim();
  return [...normalized].map((character) => {
    const code = character.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRAS.has(character)) return character;
    return "";
  }).join("").replace(/\s+/g, " ").trim() || fallback;
};

const normalizeHex = (value, fallback = "#7667ff") => /^#[0-9a-f]{6}$/i.test(String(value || ""))
  ? String(value)
  : fallback;

const hexToRgb = (hex) => {
  const value = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255
  };
};

const mixWithWhite = (color, amount) => ({
  r: color.r + (1 - color.r) * amount,
  g: color.g + (1 - color.g) * amount,
  b: color.b + (1 - color.b) * amount
});

const breakLines = (value, font, size, maxWidth, maxLines = Number.POSITIVE_INFINITY) => {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    if (lines.length >= maxLines) return;
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line && lines.length < maxLines) lines.push(line);

  if (words.length && lines.length === maxLines) {
    const joined = lines.join(" ");
    const source = words.join(" ");
    if (joined !== source) {
      let last = lines.at(-1) || "";
      while (last && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last.trimEnd()}…`;
    }
  }
  return lines;
};

const fitText = (value, font, size, maxWidth) => {
  const source = cleanText(value);
  if (font.widthOfTextAtSize(source, size) <= maxWidth) return source;
  let result = source;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) result = result.slice(0, -1);
  return `${result.trimEnd()}…`;
};

const drawRoundedRect = (page, { x, y, width, height, radius, color, opacity = 1 }) => {
  const fill = rgb(color.r, color.g, color.b);
  const corner = Math.min(radius, height / 2, width / 2);
  page.drawRectangle({ x: x + corner, y, width: width - 2 * corner, height, color: fill, opacity });
  page.drawRectangle({ x, y: y + corner, width, height: height - 2 * corner, color: fill, opacity });
  page.drawEllipse({ x: x + corner, y: y + corner, xScale: corner, yScale: corner, color: fill, opacity });
  page.drawEllipse({ x: x + width - corner, y: y + corner, xScale: corner, yScale: corner, color: fill, opacity });
  page.drawEllipse({ x: x + corner, y: y + height - corner, xScale: corner, yScale: corner, color: fill, opacity });
  page.drawEllipse({ x: x + width - corner, y: y + height - corner, xScale: corner, yScale: corner, color: fill, opacity });
};

const parsePrescription = (value, exercise = {}) => {
  const structuredSets = Math.max(0, Number.parseInt(exercise.sets || exercise.sets_count || 0, 10) || 0);
  const structuredReps = cleanText(exercise.reps || exercise.reps_target);
  const text = structuredSets && structuredReps ? `${structuredSets} x ${structuredReps}` : cleanText(value, "3 x 10");
  const match = text.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i);
  return {
    sets: Number.parseInt(match?.[1] || "0", 10) || 0,
    display: match ? `${match[1]} × ${match[2]}` : text
  };
};

const exerciseGuidance = (exercise) => {
  const instruction = cleanText(exercise?.instructions);
  if (instruction) return instruction;
  const notes = cleanText(exercise?.notes);
  if (notes && notes.toLowerCase() !== "criado no painel do professor.") return notes;
  return "";
};

const normalizeContext = (context = {}) => {
  const workout = context.workout || {};
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const student = context.student || {};
  const coachRole = [context.coachRole, context.coachCref].map((item) => cleanText(item)).filter(Boolean).join(" • ");
  return {
    workout,
    exercises,
    title: cleanText(workout.title, "Treino"),
    focus: cleanText(workout.focus, "Prescrição personalizada"),
    studentName: cleanText(workout.owner || student.name, "Aluno"),
    goal: cleanText(student.goal, "Não informado"),
    duration: `${Math.max(0, Number(workout.estimatedMinutes || 0))} min`,
    brandName: cleanText(context.brandName, "FlowFit"),
    coachName: cleanText(context.coachName, "Personal trainer"),
    coachRole: coachRole || "Personal trainer",
    accent: normalizeHex(context.accent),
    generatedAt: context.generatedAt instanceof Date ? context.generatedAt : new Date()
  };
};

export const buildWorkoutPdfFileName = (workout = {}) => {
  const source = cleanText(`treino-${workout.owner || "aluno"}-${workout.title || "flowfit"}`, "treino-flowfit")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return `${source || "treino-flowfit"}.pdf`;
};

export const createWorkoutPdf = async (sourceContext = {}) => {
  const context = normalizeContext(sourceContext);
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = A4;
  const accentRaw = hexToRgb(context.accent);
  const colors = {
    accent: rgb(accentRaw.r, accentRaw.g, accentRaw.b),
    accentRaw,
    accentSoft: mixWithWhite(accentRaw, 0.91),
    dark: rgb(0.075, 0.08, 0.095),
    text: rgb(0.10, 0.105, 0.12),
    muted: rgb(0.40, 0.415, 0.46),
    darkMuted: rgb(0.72, 0.73, 0.77),
    line: rgb(0.875, 0.885, 0.91),
    soft: rgb(0.965, 0.97, 0.98),
    rowAlternate: rgb(0.982, 0.985, 0.992),
    white: rgb(1, 1, 1)
  };
  let page;
  let y;

  const totalWidth = pageWidth - PAGE_MARGIN * 2;
  const columns = {
    number: PAGE_MARGIN + 12,
    exercise: PAGE_MARGIN + 46,
    prescription: PAGE_MARGIN + 287,
    rest: PAGE_MARGIN + 365,
    control: PAGE_MARGIN + 430
  };

  const drawTableHeader = (top) => {
    const height = 23;
    page.drawRectangle({ x: PAGE_MARGIN, y: top - height, width: totalWidth, height, color: colors.dark });
    page.drawRectangle({ x: PAGE_MARGIN, y: top - height, width: 4, height, color: colors.accent });
    const labels = [
      ["#", columns.number],
      ["EXERCÍCIO", columns.exercise],
      ["SÉRIES / REPS", columns.prescription],
      ["DESCANSO", columns.rest],
      ["CONTROLE", columns.control]
    ];
    labels.forEach(([label, x]) => page.drawText(label, {
      x, y: top - 15, size: 6.3, font: bold, color: colors.darkMuted
    }));
    return top - height;
  };

  const drawContinuationHeader = () => {
    page.drawText(fitText(context.brandName.toUpperCase(), bold, 8.2, 240), {
      x: PAGE_MARGIN, y: pageHeight - 34, size: 8.2, font: bold, color: colors.text
    });
    const label = `FICHA DE TREINO - ${context.studentName.toUpperCase()}`;
    page.drawText(label, {
      x: pageWidth - PAGE_MARGIN - bold.widthOfTextAtSize(label, 6.5), y: pageHeight - 34, size: 6.5, font: bold, color: colors.muted
    });
    page.drawText(fitText(context.title, bold, 16, totalWidth), {
      x: PAGE_MARGIN, y: pageHeight - 61, size: 16, font: bold, color: colors.text
    });
    page.drawText(fitText(context.focus, regular, 7.4, totalWidth), {
      x: PAGE_MARGIN, y: pageHeight - 76, size: 7.4, font: regular, color: colors.muted
    });
    page.drawLine({
      start: { x: PAGE_MARGIN, y: pageHeight - 88 }, end: { x: pageWidth - PAGE_MARGIN, y: pageHeight - 88 }, thickness: 0.7, color: colors.line
    });
    page.drawText("CONTINUAÇÃO", { x: PAGE_MARGIN, y: pageHeight - 108, size: 6.4, font: bold, color: colors.muted });
    y = drawTableHeader(pageHeight - 119);
  };

  const addPage = (continuation = false) => {
    page = pdfDoc.addPage(A4);
    page.drawRectangle({ x: 0, y: pageHeight - 5, width: pageWidth, height: 5, color: colors.accent });
    y = pageHeight - PAGE_MARGIN;
    if (continuation) drawContinuationHeader();
  };

  const ensureSpace = (height) => {
    if (y - height >= 55) return;
    addPage(true);
  };

  addPage();

  const headerX = PAGE_MARGIN;
  const headerWidth = totalWidth;
  const headerHeight = 129;
  const headerTop = pageHeight - 24;
  const headerY = headerTop - headerHeight;
  page.drawRectangle({ x: headerX, y: headerY, width: headerWidth, height: headerHeight, color: colors.dark });
  page.drawRectangle({ x: headerX, y: headerY, width: 6, height: headerHeight, color: colors.accent });
  drawRoundedRect(page, {
    x: PAGE_MARGIN + 21, y: headerTop - 43, width: 27, height: 27, radius: 6, color: accentRaw
  });
  page.drawText(cleanText(context.brandName[0], "F").toUpperCase(), {
    x: PAGE_MARGIN + 30, y: headerTop - 34, size: 10, font: bold, color: colors.white
  });
  page.drawText(fitText(context.brandName.toUpperCase(), bold, 8, 230), {
    x: PAGE_MARGIN + 58, y: headerTop - 26, size: 8, font: bold, color: colors.white
  });
  page.drawText(fitText(`${context.coachName} - ${context.coachRole}`, regular, 6.8, 280), {
    x: PAGE_MARGIN + 58, y: headerTop - 39, size: 6.8, font: regular, color: colors.darkMuted
  });
  const documentLabel = "FICHA DE TREINO";
  page.drawText(documentLabel, {
    x: pageWidth - PAGE_MARGIN - 20 - bold.widthOfTextAtSize(documentLabel, 6.8), y: headerTop - 28, size: 6.8, font: bold, color: colors.darkMuted
  });
  page.drawText(fitText(context.focus.toUpperCase(), bold, 6.6, headerWidth - 44), {
    x: PAGE_MARGIN + 21, y: headerTop - 67, size: 6.6, font: bold, color: colors.darkMuted
  });
  const titleLines = breakLines(context.title, bold, 22, headerWidth - 44, 2);
  titleLines.forEach((line, index) => page.drawText(line, {
    x: PAGE_MARGIN + 21, y: headerTop - 94 - index * 23, size: 22, font: bold, color: colors.white
  }));

  y = headerY - 13;

  const metaHeight = 57;
  const metaWidths = [totalWidth * 0.29, totalWidth * 0.27, totalWidth * 0.17, totalWidth * 0.27];
  const metas = [
    ["ALUNO", context.studentName],
    ["PROFESSOR", context.coachName],
    ["DURAÇÃO", context.duration],
    ["OBJETIVO", context.goal]
  ];
  page.drawRectangle({ x: PAGE_MARGIN, y: y - metaHeight, width: totalWidth, height: metaHeight, color: colors.soft });
  let metaX = PAGE_MARGIN;
  metas.forEach(([label, value], index) => {
    if (index > 0) page.drawLine({
      start: { x: metaX, y: y - metaHeight + 12 }, end: { x: metaX, y: y - 12 }, thickness: 0.55, color: colors.line
    });
    page.drawText(label, { x: metaX + 12, y: y - 17, size: 5.9, font: bold, color: colors.muted });
    page.drawText(fitText(value, bold, 9, metaWidths[index] - 24), { x: metaX + 12, y: y - 36, size: 9, font: bold, color: colors.text });
    metaX += metaWidths[index];
  });
  y -= metaHeight + 20;

  const totalSets = context.exercises.reduce((sum, exercise) => sum + parsePrescription(exercise.prescription, exercise).sets, 0);
  page.drawText("PLANO DE EXERCÍCIOS", { x: PAGE_MARGIN, y, size: 10.5, font: bold, color: colors.text });
  const countLabel = `${context.exercises.length} exercícios - ${totalSets} séries`;
  page.drawText(countLabel, {
    x: pageWidth - PAGE_MARGIN - regular.widthOfTextAtSize(countLabel, 7.2), y: y + 0.5, size: 7.2, font: regular, color: colors.muted
  });
  y = drawTableHeader(y - 12);

  for (let index = 0; index < context.exercises.length; index += 1) {
    const exercise = context.exercises[index] || {};
    const guidanceLines = breakLines(exerciseGuidance(exercise), regular, 6.8, totalWidth - 58, 2);
    const rowHeight = 49 + guidanceLines.length * 9;
    ensureSpace(rowHeight);
    const rowY = y - rowHeight;
    if (index % 2 === 1) page.drawRectangle({ x: PAGE_MARGIN, y: rowY, width: totalWidth, height: rowHeight, color: colors.rowAlternate });
    page.drawLine({
      start: { x: PAGE_MARGIN, y: rowY }, end: { x: pageWidth - PAGE_MARGIN, y: rowY }, thickness: 0.45, color: colors.line
    });
    drawRoundedRect(page, { x: columns.number - 4, y: y - 34, width: 25, height: 25, radius: 5, color: colors.accentSoft });
    const number = String(index + 1).padStart(2, "0");
    page.drawText(number, { x: columns.number + 2, y: y - 25.5, size: 7.4, font: bold, color: colors.accent });
    page.drawText(fitText(exercise.name || `Exercício ${index + 1}`, bold, 9.4, 225), {
      x: columns.exercise, y: y - 18, size: 9.4, font: bold, color: colors.text
    });
    page.drawText(fitText(exercise.target || "Personalizado", regular, 6.6, 220), {
      x: columns.exercise, y: y - 32, size: 6.6, font: regular, color: colors.muted
    });
    const prescription = parsePrescription(exercise.prescription, exercise).display;
    page.drawText(fitText(prescription, bold, 10, 68), {
      x: columns.prescription, y: y - 22, size: 10, font: bold, color: colors.text
    });
    const rest = cleanText(exercise.rest, "-");
    page.drawText(fitText(rest, regular, 7.2, 54), {
      x: columns.rest, y: y - 22, size: 7.2, font: regular, color: colors.text
    });
    const tempo = cleanText(exercise.tempo);
    const rir = cleanText(exercise.rir);
    page.drawText(fitText(tempo ? `Cad. ${tempo}` : "Cad. -", regular, 6.6, 82), {
      x: columns.control, y: y - 17, size: 6.6, font: regular, color: colors.text
    });
    page.drawText(fitText(rir ? (/^rir\b/i.test(rir) ? rir : `RIR ${rir}`) : "RIR -", regular, 6.6, 82), {
      x: columns.control, y: y - 30, size: 6.6, font: regular, color: colors.muted
    });
    guidanceLines.forEach((line, lineIndex) => page.drawText(line, {
      x: columns.exercise, y: y - 45 - lineIndex * 9, size: 6.8, font: regular, color: colors.muted
    }));
    y = rowY;
  }

  ensureSpace(58);
  y -= 18;
  page.drawLine({
    start: { x: PAGE_MARGIN, y }, end: { x: pageWidth - PAGE_MARGIN, y }, thickness: 1.1, color: colors.accent
  });
  page.drawText("PRESCRIÇÃO RESPONSÁVEL", { x: PAGE_MARGIN, y: y - 17, size: 6.2, font: bold, color: colors.muted });
  page.drawText(fitText(context.coachName, bold, 9.2, 260), { x: PAGE_MARGIN, y: y - 34, size: 9.2, font: bold, color: colors.text });
  page.drawText(fitText(context.coachRole, regular, 7, 260), { x: PAGE_MARGIN, y: y - 47, size: 7, font: regular, color: colors.muted });
  const generated = `Gerado em ${new Intl.DateTimeFormat("pt-BR").format(context.generatedAt)}`;
  page.drawText(generated, {
    x: pageWidth - PAGE_MARGIN - regular.widthOfTextAtSize(generated, 7), y: y - 34, size: 7, font: regular, color: colors.muted
  });

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) => {
    const footerY = 27;
    currentPage.drawLine({
      start: { x: PAGE_MARGIN, y: footerY + 15 }, end: { x: pageWidth - PAGE_MARGIN, y: footerY + 15 }, thickness: 0.55, color: colors.line
    });
    currentPage.drawText(fitText(`${context.coachName} - ${context.coachRole}`, regular, 7, 285), {
      x: PAGE_MARGIN, y: footerY, size: 7, font: regular, color: colors.muted
    });
    const pageLabel = `${context.brandName} - Página ${index + 1} de ${pages.length}`;
    currentPage.drawText(pageLabel, {
      x: pageWidth - PAGE_MARGIN - regular.widthOfTextAtSize(pageLabel, 7), y: footerY, size: 7, font: regular, color: colors.muted
    });
  });

  pdfDoc.setTitle(`${context.title} - ${context.studentName}`);
  pdfDoc.setAuthor(context.coachName);
  pdfDoc.setSubject("Ficha de treino");
  pdfDoc.setCreator("FlowFit");
  pdfDoc.setProducer("FlowFit com pdf-lib");
  pdfDoc.setCreationDate(context.generatedAt);
  pdfDoc.setModificationDate(context.generatedAt);
  return pdfDoc.save();
};

export const downloadWorkoutPdf = (bytes, fileName) => {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};
