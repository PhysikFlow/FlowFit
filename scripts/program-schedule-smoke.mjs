import assert from "node:assert/strict";
import {
  buildProgramSchedule,
  normalizeProgramSessionSlot
} from "../appAluno/js/data/program-schedule.js";

const program = {
  weeks: 3,
  sessions: [
    { id: "late", templateId: "same-template", week: 2, day: 3, position: 0 },
    { id: "second", templateId: "same-template", week: 1, day: 1, position: 1 },
    { id: "first", templateId: "same-template", week: 1, day: 1, position: 0 }
  ]
};

const schedule = buildProgramSchedule(program, "2026-08-24");
assert.deepEqual(schedule.map((item) => item.id), ["first", "second", "late"]);
assert.equal(schedule.length, 3, "ocorrências repetidas do mesmo modelo devem ser preservadas");
assert.deepEqual(
  schedule.map((item) => [item.startsAt.getFullYear(), item.startsAt.getMonth() + 1, item.startsAt.getDate()]),
  [[2026, 8, 24], [2026, 8, 24], [2026, 9, 2]]
);

assert.deepEqual(
  normalizeProgramSessionSlot({ week: 1, day: 8, position: 2 }),
  { week: 2, day: 1, position: 2 },
  "programas legados com dia acima de 7 devem manter a data relativa"
);
assert.deepEqual(buildProgramSchedule({ sessions: [{ id: "legacy", week: 1, day: 8 }] }, "2026-08-24")
  .map((item) => [item.week, item.day, item.startsAt.getDate()]), [[2, 1, 31]]);
assert.deepEqual(buildProgramSchedule(program, "2026-08-31").map((item) => item.startsAt.getDate()), [31, 31, 9]);
assert.ok(buildProgramSchedule(program, "data-inválida").every((item) => item.startsAt === null));

console.log("program-schedule-smoke: agenda compartilhada, ordem e datas aprovadas");
