export const mockStudent = {
  id: "student-lucas",
  name: "Lucas Andrade",
  initials: "LA",
  plan: "Performance",
  since: "Janeiro de 2026",
  coach: "Marina Costa"
};

export const activeWorkout = {
  id: "workout-b-back-biceps",
  code: "B",
  title: "Costas e biceps",
  focus: "Amplitude, controle e progressao limpa",
  estimatedMinutes: 52,
  lastDoneLabel: "ha 7 dias",
  exercises: [
    {
      id: "lat-pulldown",
      name: "Puxada alta pronada",
      target: "Costas",
      prescription: "4 x 10-12",
      load: "45 kg",
      rest: "60s",
      tempo: "2-1-2",
      rir: "2",
      notes: "Descer ate a linha do queixo sem perder escapulas."
    },
    {
      id: "seated-row",
      name: "Remada baixa neutra",
      target: "Costas",
      prescription: "4 x 8-10",
      load: "52 kg",
      rest: "75s",
      tempo: "2-0-2",
      rir: "2",
      notes: "Segurar 1 segundo na contracao."
    },
    {
      id: "single-arm-row",
      name: "Remada unilateral",
      target: "Costas",
      prescription: "3 x 10 cada lado",
      load: "26 kg",
      rest: "60s",
      tempo: "2-1-2",
      rir: "2",
      notes: "Evitar girar o tronco."
    },
    {
      id: "rear-delt-fly",
      name: "Crucifixo inverso",
      target: "Posterior de ombro",
      prescription: "3 x 12-15",
      load: "8 kg",
      rest: "45s",
      tempo: "2-1-2",
      rir: "3",
      notes: "Movimento curto e controlado."
    },
    {
      id: "barbell-curl",
      name: "Rosca direta",
      target: "Biceps",
      prescription: "3 x 10",
      load: "18 kg",
      rest: "60s",
      tempo: "2-1-2",
      rir: "2",
      notes: "Cotovelos parados, sem roubar no final."
    },
    {
      id: "hammer-curl",
      name: "Rosca martelo",
      target: "Biceps",
      prescription: "3 x 12",
      load: "12 kg",
      rest: "45s",
      tempo: "2-0-2",
      rir: "2",
      notes: "Alternar bracos mantendo punho neutro."
    },
    {
      id: "straight-arm-pulldown",
      name: "Pulldown braco reto",
      target: "Dorsal",
      prescription: "3 x 15",
      load: "25 kg",
      rest: "45s",
      tempo: "2-1-2",
      rir: "3",
      notes: "Finalizar com dorsal, nao com triceps."
    }
  ]
};

export const weeklySummary = {
  targetWorkouts: 4,
  doneWorkouts: 3,
  volumeKg: 12800,
  streakDays: 6,
  progressPercent: 75
};

export const progressData = {
  weeklyVolume: [
    { label: "S1", percent: 38 },
    { label: "S2", percent: 52 },
    { label: "S3", percent: 47 },
    { label: "S4", percent: 63 },
    { label: "S5", percent: 70 },
    { label: "S6", percent: 76 },
    { label: "S7", percent: 91 }
  ],
  measurementsDate: "12 jul 2026",
  measurements: [
    { label: "Peso", helper: "Meta: 78 kg", value: "79,4 kg", delta: "-0,8 kg" },
    { label: "Cintura", helper: "Medida atual", value: "82 cm", delta: "-2,1 cm" },
    { label: "Braco", helper: "Medida atual", value: "39 cm", delta: "+1,2 cm" }
  ],
  entries: [
    { id: "measure-2026-06-01", date: "2026-06-01", weight: 81.1, waist: 84.4, arm: 37.8 },
    { id: "measure-2026-06-15", date: "2026-06-15", weight: 80.6, waist: 83.8, arm: 38.1 },
    { id: "measure-2026-06-29", date: "2026-06-29", weight: 80.2, waist: 83.0, arm: 38.4 },
    { id: "measure-2026-07-12", date: "2026-07-12", weight: 79.4, waist: 82.0, arm: 39.0 }
  ]
};

export const scheduleItems = [
  {
    id: "checkin-weekly",
    time: "Hoje, 19:30",
    title: "Check-in rapido",
    detail: "Enviar percepcao de esforco e observacoes do treino B.",
    type: "Mensagem"
  },
  {
    id: "legs-training",
    time: "Amanha, 07:00",
    title: "Treino C - Pernas",
    detail: "Agachamento, leg press e posterior. Previsao de 58 min.",
    type: "Treino"
  },
  {
    id: "assessment",
    time: "Segunda, 18:00",
    title: "Reavaliacao mensal",
    detail: "Peso, medidas, fotos e ajuste de metas.",
    type: "Avaliacao"
  }
];

export const notificationItems = [
  {
    id: "coach-adjustment",
    type: "Treino",
    title: "Marina ajustou seu treino B",
    detail: "A remada unilateral ganhou uma serie extra para a proxima semana.",
    time: "Hoje, 08:40",
    action: "Ver treino"
  },
  {
    id: "workout-reminder",
    type: "Lembrete",
    title: "Treino de costas hoje",
    detail: "Sua janela ideal e entre 18:00 e 20:00, antes do check-in.",
    time: "Hoje, 07:10",
    action: "Abrir agenda"
  },
  {
    id: "progress-note",
    type: "Evolucao",
    title: "Volume semanal acima da meta",
    detail: "Voce esta 12% acima da media das ultimas quatro semanas.",
    time: "Ontem, 21:05",
    action: "Ver evolucao"
  },
  {
    id: "assessment-alert",
    type: "Avaliacao",
    title: "Reavaliacao chegando",
    detail: "Separe fotos e medidas para segunda-feira as 18:00.",
    time: "Ontem, 09:30",
    action: "Ver agenda"
  }
];
