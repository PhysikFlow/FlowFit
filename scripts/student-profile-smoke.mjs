import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("supabase/migrations/20260822143000_flowfit_private_student_profiles.sql");
const repository = read("appAluno/js/data/repositories/student-profile-repository.js");
const studentApp = read("appAluno/js/app.js");
const professorApp = read("appProfessor/js/app.js");
const studentHtml = read("appAluno/index.html");
const studentSw = read("appAluno/sw.js");
const professorSw = read("appProfessor/sw.js");

const checks = [
  ["tabela separada", migration.includes("create table if not exists public.student_profiles")],
  ["bucket privado", /'flowfit-student-avatars'[\s\S]+false,[\s\S]+1048576/.test(migration)],
  ["RLS do perfil", migration.includes("alter table public.student_profiles enable row level security")],
  ["leitura vinculada", migration.includes("student_profiles_select_own_or_linked_coach")],
  ["upload no caminho exato", migration.includes("name = (select auth.uid())::text || '/avatar.webp'")],
  ["nome administrativo preservado", !/update\s+public\.students[\s\S]+set\s+name/i.test(migration)],
  ["signed URLs em lote", repository.includes("createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)")],
  ["signed URLs somente em memória", repository.includes("const signedAvatarUrls = new Map()") && !repository.includes("localStorage")],
  ["fallback público removido", !read("appAluno/js/data/repositories/student-repository.js").includes("/storage/v1/object/public/")],
  ["imagem 256 WebP", studentHtml.includes("data-student-profile-photo-input") && read("appAluno/js/screens/profile/student-profile-editor.js").includes("width: 256")],
  ["carregamento tardio no aluno", studentApp.includes("void studentProfileRepository.fetchOwnProfile")],
  ["perfil vinculado no professor", professorApp.includes("fetchLinkedProfiles")],
  ["cache PWA aluno", studentSw.includes("student-profile-repository.js?v=build-20260822-1")],
  ["cache PWA professor", professorSw.includes("student-profile-repository.js?v=build-20260822-1")]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`student-profile-smoke: falhou: ${failed.join(", ")}`);
  process.exit(1);
}

console.log(`student-profile-smoke: ${checks.length} invariantes aprovadas`);
