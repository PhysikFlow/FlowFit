import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js?v=build-20260809-6";

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

const getSupabaseProjectRef = () => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
};

const getAuthScope = () => {
  const pathname = String(globalThis.location?.pathname || "").toLowerCase();
  if (pathname.includes("/admin")) return "admin";
  if (pathname.includes("/appprofessor")) return "professor";
  return "aluno";
};

export const AUTH_STORAGE_KEY = `flowfit-auth-${getAuthScope()}`;

// Versoes anteriores usavam a chave padrao do supabase-js para as tres areas.
// A chave nao e mais lida, mas ainda pode conter um refresh token valido. Remova
// somente esse estado legado; as chaves isoladas atuais permanecem intactas.
export const LEGACY_AUTH_STORAGE_KEY = getSupabaseProjectRef()
  ? `sb-${getSupabaseProjectRef()}-auth-token`
  : "";

export const clearLegacyAuthStorage = (storage) => {
  if (!LEGACY_AUTH_STORAGE_KEY) return;
  try {
    const target = storage || globalThis.localStorage;
    target?.removeItem(LEGACY_AUTH_STORAGE_KEY);
    target?.removeItem(`${LEGACY_AUTH_STORAGE_KEY}-code-verifier`);
  } catch {
    // Browsers podem bloquear storage; isso nao deve impedir a autenticacao.
  }
};

// Cria o cliente de forma lazy a partir da copia versionada no proprio PWA.
// Autenticacao e tema nao dependem de disponibilidade de um CDN externo.
// Retorna null quando o backend nao esta configurado, mantendo os apps 100% locais.
export const getSupabase = () => {
  if (!isConfigured()) return null;
  if (!clientPromise) {
    clearLegacyAuthStorage();
    clientPromise = import("../../vendor/supabase/supabase-js.bundle.mjs?v=2.112.3-flowfit.1")
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
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
};
