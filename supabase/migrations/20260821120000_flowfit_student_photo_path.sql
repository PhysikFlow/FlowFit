-- FlowFit: photo_path na tabela students para fotos de perfil do aluno.
-- A coluna armazena o caminho no bucket flowfit-brand-assets.
-- A leitura é pública; escrita será implementada no appAluno (upload UI).

begin;

alter table public.students
  add column if not exists photo_path text;

commit;
