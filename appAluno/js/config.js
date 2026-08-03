// Configuracao do backend Supabase.
//
// 1. Crie um projeto gratuito em https://supabase.com/dashboard.
// 2. Em Project Settings > API Keys, copie a "Project URL" e a "Publishable key".
// 3. Cole os valores abaixo e rode supabase/schema.sql no SQL Editor do projeto.
//    Esse schema cria marca branca, alunos, treinos e exercicios do piloto.
//
// Com os campos vazios, os apps continuam funcionando 100% locais/offline
// (a sincronizacao de tema/treinos simplesmente fica desativada).

export const SUPABASE_URL = "https://swhamqksvliwrfdytkyh.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_DEpL8nusru0pxVQx-pKcvw_mCzgnh9P";

// Tenant usado pelo piloto enquanto nao existe login. Precisa existir na
// tabela brand_theme e nas policies demo (ver supabase/schema.sql).
export const DEMO_COACH_ID = "coach-demo";
