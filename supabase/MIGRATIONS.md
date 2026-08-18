# Estratégia de banco do FlowFit

## Fonte de verdade

As alterações aplicáveis ao banco devem ficar em `supabase/migrations/` e ser executadas em ordem pelo Supabase. O arquivo `supabase/schema.sql` é uma referência de bootstrap e não deve ser reaplicado sobre um banco existente.

## Arquivos históricos

Os SQLs na raiz de `supabase/` (`update-student-access.sql`, `focused-workout-mode.sql`, `admin-console.sql`, `automatic-coach-expiration.sql` e `fix-*.sql`) documentam etapas anteriores do desenvolvimento. Eles não devem ser aplicados isoladamente em um banco que já possui migrations.

## Reconciliação da Fase 2

`migrations/20260813213230_flowfit_phase2_reconciliation.sql` é aditiva e idempotente. Ela:

- adiciona as colunas do registro individual de séries que faltavam no remoto;
- preserva registros legados com `set_number` nulo;
- instala `sync_workout_session`;
- atualiza a publicação de treinos para `media_type`;
- limita payloads excessivos;
- exige convite explícito quando o e-mail corresponde a mais de um vínculo de aluno;
- mantém `SECURITY DEFINER`, `search_path` seguro e grants restritos.

Antes de uma nova migration, confirme o estado remoto com consultas de catálogo e execute `node scripts/supabase-contract-smoke.mjs`.

## Fase 4 — integridade das séries

`migrations/20260813223339_flowfit_session_exercise_integrity.sql` substitui
somente a definição da RPC `sync_workout_session`. Ela é aditiva e não remove
dados nem índices. Séries individualizadas com `workout_id` precisam apontar
para um exercício do treino; o sufixo local `-occurrence-N` é resolvido para o
ID persistido. Payloads agregados legados sem `set_number`, e sessões antigas
sem `workout_id`, continuam aceitos para permitir reenvio compatível.

O Supabase registrou essa migration com a versão `20260813223339`. O arquivo
local usa exatamente essa versão para evitar drift entre o histórico remoto e
`supabase/migrations/`.

## Títulos literais dos treinos

`migrations/20260813233000_preserve_workout_titles.sql` mantém o `id` como
identidade do treino e deixa o campo alfabético `code` apenas para
compatibilidade. A publicação passa a copiar somente o `title` para o resumo do
aluno e a migration corrige os resumos existentes a partir do plano publicado
mais recente de cada vínculo.

## Assets de marca branca

`migrations/20260818110654_flowfit_brand_assets_storage.sql` adiciona
`logo_path`, `photo_path` e `logo_frame_enabled` a `brand_theme` e cria o
bucket público `flowfit-brand-assets`. Os objetos usam o caminho
`<auth.uid()>/logo.webp` ou `<auth.uid()>/photo.webp`: leitura pública serve o
app do aluno, mas upload, atualização e remoção só passam pela pasta do
professor autenticado. A migration seguinte,
`migrations/20260818110804_flowfit_brand_assets_coach_only.sql`, reforça que
somente professores com acesso permitido podem alterar os objetos.

O app continua guardando uma cópia otimizada local para funcionar offline. A
cópia local é fallback; quando o upload remoto conclui, o caminho publicado no
tema é usado por todos os dispositivos.
