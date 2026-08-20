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

const parsePrescription = (value) => {
  const text = cleanText(value, "3 x 10");
  const match = text.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i);
  return {
    sets: Number.parseInt(match?.[1] || "0", 10) || 0,
    display: match ? `${match[1]} × ${match[2]}` : text
  };
};

const exerciseDetail = (exercise) => {
  const details = [];
  const rest = cleanText(exercise?.rest);
  if (rest) details.push(/\bdescanso\b/i.test(rest) ? rest : `${rest.replace(/\s*s$/i, "")} s descanso`);
  const tempo = cleanText(exercise?.tempo);
  if (tempo) details.push(`cadência ${tempo}`);
  const rir = cleanText(exercise?.rir);
  if (rir) details.push(/^rir\b/i.test(rir) ? rir : `RIR ${rir}`);
  return details.join(" • ");
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
    accentSoft: mixWithWhite(accentRaw, 0.88),
    dark: rgb(0.09, 0.09, 0.105),
    text: rgb(0.09, 0.09, 0.105),
    muted: rgb(0.43, 0.43, 0.48),
    darkMuted: rgb(0.74, 0.74, 0.78),
    line: rgb(0.90, 0.90, 0.92),
    soft: rgb(0.97, 0.97, 0.976),
    card: rgb(0.992, 0.992, 0.996),
    white: rgb(1, 1, 1)
  };
  let page;
  let y;

  const drawContinuationHeader = () => {
    page.drawText(fitText(context.brandName.toUpperCase(), bold, 8, 240), {
      x: PAGE_MARGIN, y: pageHeight - 35, size: 8, font: bold, color: colors.text
    });
    const label = "FICHA DE TREINO";
    page.drawText(label, {
      x: pageWidth - PAGE_MARGIN - bold.widthOfTextAtSize(label, 7), y: pageHeight - 35, size: 7, font: bold, color: colors.muted
    });
    page.drawText(fitText(context.title, bold, 15, pageWidth - PAGE_MARGIN * 2), {
      x: PAGE_MARGIN, y: pageHeight - 59, size: 15, font: bold, color: colors.text
    });
    page.drawLine({
      start: { x: PAGE_MARGIN, y: pageHeight - 74 }, end: { x: pageWidth - PAGE_MARGIN, y: pageHeight - 74 }, thickness: 0.7, color: colors.line
    });
    page.drawText("EXERCÍCIOS", { x: PAGE_MARGIN, y: pageHeight - 98, size: 10, font: bold, color: colors.text });
    y = pageHeight - 114;
  };

  const addPage = (continuation = false) => {
    page = pdfDoc.addPage(A4);
    page.drawRectangle({ x: 0, y: pageHeight - 7, width: pageWidth, height: 7, color: colors.accent });
    y = pageHeight - PAGE_MARGIN;
    if (continuation) drawContinuationHeader();
  };

  const ensureSpace = (height) => {
    if (y - height >= 58) return;
    addPage(true);
  };

  addPage();

  const headerX = PAGE_MARGIN;
  const headerWidth = pageWidth - PAGE_MARGIN * 2;
  const headerHeight = 132;
  const headerTop = pageHeight - 28;
  const headerY = headerTop - headerHeight;
  drawRoundedRect(page, {
    x: headerX, y: headerY, width: headerWidth, height: headerHeight, radius: 16, color: { r: 0.09, g: 0.09, b: 0.105 }
  });
  page.drawEllipse({
    x: pageWidth - PAGE_MARGIN - 60, y: headerTop - 60, xScale: 60, yScale: 60, color: colors.accent, opacity: 0.48
  });
  drawRoundedRect(page, {
    x: PAGE_MARGIN + 18, y: headerTop - 45, width: 30, height: 30, radius: 9, color: accentRaw
  });
  page.drawText(cleanText(context.brandName[0], "F").toUpperCase(), {
    x: PAGE_MARGIN + 28, y: headerTop - 35, size: 11, font: bold, color: colors.white
  });
  page.drawText(fitText(context.brandName.toUpperCase(), bold, 8.4, 230), {
    x: PAGE_MARGIN + 58, y: headerTop - 28, size: 8.4, font: bold, color: colors.white
  });
  page.drawText(fitText(`${context.coachName} • ${context.coachRole}`, regular, 7.2, 260), {
    x: PAGE_MARGIN + 58, y: headerTop - 42, size: 7.2, font: regular, color: colors.darkMuted
  });
  const documentLabel = "FICHA DE TREINO";
  page.drawText(documentLabel, {
    x: pageWidth - PAGE_MARGIN - 18 - bold.widthOfTextAtSize(documentLabel, 7.1), y: headerTop - 30, size: 7.1, font: bold, color: colors.darkMuted
  });
  page.drawText(fitText(context.focus.toUpperCase(), bold, 7, headerWidth - 36), {
    x: PAGE_MARGIN + 18, y: headerTop - 70, size: 7, font: bold, color: colors.darkMuted
  });
  const titleLines = breakLines(context.title, bold, 20, headerWidth - 36, 2);
  titleLines.forEach((line, index) => page.drawText(line, {
    x: PAGE_MARGIN + 18, y: headerTop - 94 - index * 22, size: 20, font: bold, color: colors.white
  }));

  y = headerY - 15;

  const metaGap = 7;
  const metaHeight = 49;
  const totalWidth = pageWidth - PAGE_MARGIN * 2;
  const usableMetaWidth = totalWidth - metaGap * 3;
  const metaWidths = [usableMetaWidth * 0.29, usableMetaWidth * 0.29, usableMetaWidth * 0.17, usableMetaWidth * 0.25];
  const metas = [
    ["ALUNO", context.studentName],
    ["PROFESSOR", context.coachName],
    ["DURAÇÃO", context.duration],
    ["OBJETIVO", context.goal]
  ];
  let metaX = PAGE_MARGIN;
  metas.forEach(([label, value], index) => {
    drawRoundedRect(page, { x: metaX, y: y - metaHeight, width: metaWidths[index], height: metaHeight, radius: 10, color: { r: 0.97, g: 0.97, b: 0.976 } });
    page.drawText(label, { x: metaX + 12, y: y - 14, size: 6.2, font: bold, color: colors.muted });
    page.drawText(fitText(value, bold, 9, metaWidths[index] - 24), { x: metaX + 12, y: y - 31, size: 9, font: bold, color: colors.text });
    metaX += metaWidths[index] + metaGap;
  });
  y -= metaHeight + 22;

  const totalSets = context.exercises.reduce((sum, exercise) => sum + parsePrescription(exercise.prescription).sets, 0);
  page.drawText("EXERCÍCIOS", { x: PAGE_MARGIN, y, size: 11, font: bold, color: colors.text });
  const countLabel = `${context.exercises.length} exercícios • ${totalSets} séries`;
  const countWidth = regular.widthOfTextAtSize(countLabel, 7.5) + 18;
  drawRoundedRect(page, {
    x: pageWidth - PAGE_MARGIN - countWidth, y: y - 5, width: countWidth, height: 19, radius: 9.5, color: { r: 0.955, g: 0.955, b: 0.963 }
  });
  page.drawText(countLabel, {
    x: pageWidth - PAGE_MARGIN - countWidth + 9, y: y + 1.5, size: 7.5, font: regular, color: colors.muted
  });
  y -= 17;

  for (let index = 0; index < context.exercises.length; index += 1) {
    const exercise = context.exercises[index] || {};
    const guidanceLines = breakLines(exerciseGuidance(exercise), regular, 7.2, totalWidth - 93, 2);
    const cardHeight = 60 + guidanceLines.length * 10;
    ensureSpace(cardHeight + 7);
    const cardY = y - cardHeight;
    drawRoundedRect(page, { x: PAGE_MARGIN, y: cardY, width: totalWidth, height: cardHeight, radius: 11, color: { r: 0.992, g: 0.992, b: 0.996 } });
    drawRoundedRect(page, { x: PAGE_MARGIN + 9, y: cardY + 9, width: 3, height: cardHeight - 18, radius: 1.5, color: accentRaw });
    drawRoundedRect(page, { x: PAGE_MARGIN + 20, y: y - 40, width: 29, height: 29, radius: 8, color: colors.accentSoft });
    const number = String(index + 1).padStart(2, "0");
    page.drawText(number, { x: PAGE_MARGIN + 28.5, y: y - 30, size: 8.2, font: bold, color: colors.accent });
    page.drawText(fitText(exercise.name || `Exercício ${index + 1}`, bold, 10.2, 270), {
      x: PAGE_MARGIN + 61, y: y - 20, size: 10.2, font: bold, color: colors.text
    });
    page.drawText(fitText(exercise.target || "Personalizado", regular, 7.3, 250), {
      x: PAGE_MARGIN + 61, y: y - 35, size: 7.3, font: regular, color: colors.muted
    });
    const prescription = parsePrescription(exercise.prescription).display;
    page.drawText(prescription, {
      x: pageWidth - PAGE_MARGIN - 15 - bold.widthOfTextAtSize(prescription, 12.5), y: y - 20, size: 12.5, font: bold, color: colors.text
    });
    const detail = exerciseDetail(exercise);
    if (detail) page.drawText(fitText(detail, regular, 6.8, 190), {
      x: pageWidth - PAGE_MARGIN - 15 - regular.widthOfTextAtSize(fitText(detail, regular, 6.8, 190), 6.8),
      y: y - 35, size: 6.8, font: regular, color: colors.muted
    });
    guidanceLines.forEach((line, lineIndex) => page.drawText(line, {
      x: PAGE_MARGIN + 61, y: y - 51 - lineIndex * 10, size: 7.2, font: regular, color: colors.muted
    }));
    y = cardY - 7;
  }

  ensureSpace(48);
  y -= 3;
  page.drawText("PRESCRIÇÃO", { x: PAGE_MARGIN, y, size: 6.4, font: bold, color: colors.muted });
  page.drawText(fitText(context.coachName, bold, 9.5, 260), { x: PAGE_MARGIN, y: y - 16, size: 9.5, font: bold, color: colors.text });
  page.drawText(fitText(context.coachRole, regular, 7.4, 260), { x: PAGE_MARGIN, y: y - 29, size: 7.4, font: regular, color: colors.muted });
  const generated = `Gerado em ${new Intl.DateTimeFormat("pt-BR").format(context.generatedAt)}`;
  page.drawText(generated, {
    x: pageWidth - PAGE_MARGIN - regular.widthOfTextAtSize(generated, 7.4), y: y - 16, size: 7.4, font: regular, color: colors.muted
  });

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) => {
    const footerY = 27;
    currentPage.drawLine({
      start: { x: PAGE_MARGIN, y: footerY + 15 }, end: { x: pageWidth - PAGE_MARGIN, y: footerY + 15 }, thickness: 0.55, color: colors.line
    });
    currentPage.drawText(fitText(`${context.coachName} • ${context.coachRole}`, regular, 7.5, 280), {
      x: PAGE_MARGIN, y: footerY, size: 7.5, font: regular, color: colors.muted
    });
    const pageLabel = `${context.brandName} • Página ${index + 1} de ${pages.length}`;
    currentPage.drawText(pageLabel, {
      x: pageWidth - PAGE_MARGIN - regular.widthOfTextAtSize(pageLabel, 7.5), y: footerY, size: 7.5, font: regular, color: colors.muted
    });
  });

  pdfDoc.setTitle(`${context.title} — ${context.studentName}`);
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
