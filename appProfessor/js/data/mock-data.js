export const students = [
  {
    id: "ana-paula",
    name: "Ana Paula",
    initials: "AP",
    goal: "Hipertrofia",
    status: "Ativo",
    plan: "Performance",
    workout: "Treino A/B/C",
    adherence: 86,
    nextAction: "Ajustar carga no treino B"
  },
  {
    id: "lucas-andrade",
    name: "Lucas Andrade",
    initials: "LA",
    goal: "Hipertrofia",
    status: "Aguardando check-in",
    plan: "Performance",
    workout: "Treino B - Costas",
    adherence: 75,
    nextAction: "Cobrar check-in de percepcao"
  },
  {
    id: "marcos-lima",
    name: "Marcos Lima",
    initials: "ML",
    goal: "Emagrecimento",
    status: "Ativo",
    plan: "Essencial",
    workout: "Full body 3x",
    adherence: 68,
    nextAction: "Revisar cardio semanal"
  },
  {
    id: "bianca-rocha",
    name: "Bianca Rocha",
    initials: "BR",
    goal: "Condicionamento",
    status: "Inadimplente",
    plan: "Premium",
    workout: "Corrida + forca",
    adherence: 42,
    nextAction: "Enviar lembrete financeiro"
  }
];

export const workouts = [
  {
    id: "template-hypertrophy-4x",
    title: "Hipertrofia 4x semana",
    owner: "Modelo",
    blocks: ["Peito/triceps", "Costas/biceps", "Pernas", "Ombros/core"],
    updatedAt: "Hoje"
  },
  {
    id: "lucas-workout-b",
    title: "Treino B - Costas e biceps",
    owner: "Lucas Andrade",
    blocks: ["Puxada", "Remada", "Biceps", "Finalizador"],
    updatedAt: "Ontem"
  },
  {
    id: "ana-workout-c",
    title: "Treino C - Pernas",
    owner: "Ana Paula",
    blocks: ["Agachamento", "Leg press", "Posterior", "Panturrilha"],
    updatedAt: "12 jul"
  }
];

export const tasks = [
  { id: "task-checkins", type: "Check-ins", title: "5 alunos sem check-in", detail: "Priorize os alunos com treino novo nesta semana." },
  { id: "task-renewals", type: "Retencao", title: "2 renovacoes proximas", detail: "Prepare mensagem com progresso do mes." },
  { id: "task-import", type: "Migracao", title: "Importar planilha antiga", detail: "Fila futura para IA converter treino em cadastro." }
];

export const activities = [
  "Ana Paula concluiu Treino C",
  "Lucas Andrade registrou nova carga na remada",
  "Marcos Lima respondeu o check-in",
  "Bianca Rocha visualizou lembrete financeiro"
];

export const messages = [
  { id: "msg-lucas", from: "Lucas Andrade", text: "Senti o ombro no desenvolvimento. Pode trocar?", time: "Hoje, 09:18" },
  { id: "msg-ana", from: "Ana Paula", text: "Consegui subir carga no leg press.", time: "Hoje, 08:44" },
  { id: "msg-marcos", from: "Marcos Lima", text: "Vou treinar amanha cedo, pode ajustar cardio?", time: "Ontem, 21:10" }
];
