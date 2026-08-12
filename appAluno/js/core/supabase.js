import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js?v=build-20260809-6";

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

const getAuthScope = () => {
  const pathname = String(globalThis.location?.pathname || "").toLowerCase();
  if (pathname.includes("/admin")) return "admin";
  if (pathname.includes("/appprofessor")) return "professor";
  return "aluno";
};

export const AUTH_STORAGE_KEY = `flowfit-auth-${getAuthScope()}`;

// Cria o cliente supabase-js de forma lazy via CDN (sem bundler/build step).
// Retorna null quando o backend nao esta configurado, mantendo os apps 100% locais.
export const getSupabase = () => {
  if (!isConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2.112.3")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
          storageKey: AUTH_STORAGE_KEY
        }
      }))
      .catch((error) => {
        console.error("[FlowFit][supabase] Falha ao carregar o cliente Supabase.", error);
        return null;
      });
  }
  return clientPromise;
};
