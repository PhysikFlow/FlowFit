# Auditoria Supabase FlowFit — Fase 2

Data: 13/08/2026

Esta fase corrigiu código local e banco remoto sem apagar dados. Não foram usados DROP TABLE, limpeza em massa ou alterações destrutivas de registros.

## 1. RPC de sessão ausente

O frontend chamava sync_workout_session(jsonb,jsonb,jsonb), mas a função não existia no remoto. Foi criada e aplicada a migration supabase/migrations/20260813213230_flowfit_phase2_reconciliation.sql.

A RPC agora exige autenticação, confirma o vínculo aluno-professor, valida o treino, registra séries individuais, recalcula volume, aceita retry idempotente, evita IDs pertencentes a outra sessão, limita payload a 500 séries e usa SECURITY DEFINER com search_path = pg_catalog, public.

Grants finais: execução somente para authenticated e service_role; public e anon foram revogados.

## 2. Schema remoto atrás do frontend

Foram adicionadas, de forma aditiva:

- workout_exercises.media_type;
- workout_set_logs.workout_exercise_id;
- workout_set_logs.discomfort;
- workout_set_logs.discomfort_note.

Registros antigos tiveram somente workout_exercise_id preenchido a partir de exercise_id quando possível. Registros legados continuam com set_number = NULL.

Foram adicionadas constraints para tipo de mídia, desconforto e número de série. O índice legado foi preservado e foi criado workout_set_logs_session_item_set_idx para séries individualizadas.

## 3. Publicação de treino

publish_student_workout foi atualizada remotamente para persistir media_type, validar URLs HTTPS, rejeitar mais de 50 exercícios e manter a autorização de professor/aluno.

## 4. Associação automática de alunos

claim_student_access agora exige convite específico quando há mais de um vínculo pendente para o mesmo e-mail. Usar um token específico não reivindica automaticamente vínculos de outros professores.

O app do aluno exibe uma mensagem específica solicitando o convite correto quando essa ambiguidade ocorre.

## 5. Validação de convites

validate_student_invite agora rejeita tokens que não tenham formato UUID antes da consulta. A função continua pública porque é necessária antes do login, mas não retorna dados do aluno.

Rate limiting por IP/token continua pendente para a Fase 3.

## 6. Cache local

O histórico de sessões foi particionado por coachId e studentId:

- leituras sem escopo autenticado retornam vazio;
- registros legados são migrados somente quando pertencem ao escopo solicitado;
- o professor filtra fallback offline por professor/aluno;
- o aluno filtra fallback por aluno/professor;
- sessões não ficam mais expostas pelo cache global durante troca de identidade.

## 7. Migrations e contrato

Foi criado [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md), que define supabase/migrations/ como fonte aplicável, marca SQLs antigos como históricos e impede reaplicação cega de schema.sql.

O schema.sql de referência foi atualizado para refletir a validação de token e a associação ambígua corrigidas.

Foram criados:

- scripts/supabase-contract-smoke.mjs — contrato local frontend/migration;
- scripts/supabase-remote-contract-smoke.mjs — contrato remoto via Data API/RPC.

## 8. Cache-busting

Foram atualizadas as versões dos módulos alterados e dos service workers:

- flowfit-aluno-v62;
- flowfit-professor-v39;
- query strings dos módulos para build-20260813-1.

O teste de regressão de autenticação foi atualizado para as versões novas.

## 9. Testes executados

Todos passaram:

- supabase-contract-smoke: 10 invariantes locais;
- supabase-remote-contract-smoke: 4 invariantes remotos;
- auth-repository-smoke: 10 cenários;
- supabase-security-smoke: 16 arquivos SQL;
- admin-auth-regression-smoke;
- coach-expiration-smoke;
- node --check em todos os JS/MJS;
- git diff --check.

O smoke visual percorreu Professor, Aluno e Admin em 320x700, 390x844 e 1440x900:

- 33 combinações verificadas;
- failures: [];
- overflowElements: [];
- tinyTargets: [];
- unnamedActions: [];
- unlabeledFields: [];
- duplicateIds: [];
- appErrors: [].

## 10. Verificações remotas

Confirmado após a migration:

- sync_workout_session(jsonb,jsonb,jsonb) existe;
- publish_student_workout(jsonb,jsonb) existe;
- claim_student_access(text) existe;
- validate_student_invite(text,text) existe;
- funções continuam com SECURITY DEFINER e search_path seguro;
- RLS continua habilitado nas tabelas da aplicação;
- nenhuma policy foi removida;
- contagens de usuários, alunos, treinos e sessões permaneceram iguais;
- nenhum bucket, trigger ou Edge Function foi criado acidentalmente.

Chamadas sem autenticação falharam com os erros esperados, sem gravação:

- sessão: student_auth_required;
- publicação: coach_access_blocked;
- claim: student_access_requires_authenticated_email.

## 11. Itens não corrigidos

### Proteção contra senhas vazadas

O advisor ainda indica auth_leaked_password_protection desativado. Não há ferramenta de configuração Auth disponível nesta sessão. Passo manual restante:

Authentication → Password Security → Leaked password protection → Enable

### Testes autenticados de ponta a ponta

Não foram criadas contas temporárias nem enviados e-mails. Ainda falta testar com credenciais autorizadas:

- professor publicando treino;
- aluno carregando treino remoto;
- aluno concluindo sessão;
- retry após falha de rede;
- isolamento com JWTs diferentes;
- tentativa de RPC administrativa por usuário não-admin.

### Storage e rate limiting

Fotos/logos continuam sem Storage remoto. Rate limiting específico de convite ainda precisa ser definido no Dashboard/infraestrutura.

### Concorrência de publicação

A sincronização de sessão bloqueia a linha da sessão durante a substituição dos logs. A publicação de treino ainda não possui controle otimista entre duas abas.

## 12. Riscos para a Fase 3

1. Validar o fluxo completo com usuários autenticados e dados controlados.
2. Confirmar a UX para uma identidade vinculada a mais de um professor.
3. Revisar redirect URLs, SMTP, Google OAuth e recuperação de senha.
4. Ativar proteção contra senhas vazadas.
5. Avaliar rate limiting de convite.
6. Decidir se Admin deve apenas administrar contas ou possuir impersonação controlada.
7. Adicionar índices de FKs somente após observar workload real.

## 13. Estado final

O caminho principal foi encaminhado no código e no remoto:

Professor publica treino → aluno carrega instruções e mídia → aluno registra séries individualizadas → sync_workout_session persiste sessão, séries e feedback → professor pode consultar o resultado.

A Fase 3 deve verificar independentemente esse fluxo com autenticação real. Este documento não substitui essa validação.
