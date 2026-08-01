// Configuracao do backend Supabase.
//
// 1. Crie um projeto gratuito em https://supabase.com/dashboard.
// 2. Em Project Settings > API, copie a "Project URL" e a chave "anon public".
// 3. Cole os valores abaixo e rode supabase/schema.sql no SQL Editor do projeto.
//
// Com os campos vazios, os apps continuam funcionando 100% locais/offline
// (a sincronizacao de tema simplesmente fica desativada).

export const SUPABASE_URL = ""; // ex: "https://abcdefghijklm.supabase.co"
export const SUPABASE_ANON_KEY = ""; // chave "anon public" (segura para o navegador)

// Tenant usado pelo piloto enquanto nao existe login. Precisa existir na
// tabela brand_theme (ver supabase/schema.sql).
export const DEMO_COACH_ID = "coach-demo";
