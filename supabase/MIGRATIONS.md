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
