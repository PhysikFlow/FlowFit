# Checklist de autenticação e contas do FlowFit

Documento operacional para agentes retomarem a auditoria, confirmarem correções e evitarem regressões. A descrição detalhada da arquitetura continua em `AUTH_AUDIT.md`; este arquivo é a fonte de acompanhamento.

Atualizado em: 2026-08-11  
Escopo: `/admin`, `/appProfessor` (a área chamada de `/professor` na auditoria) e `/appAluno` (a área chamada de `/aluno` na auditoria).

## Como usar

- `[x]` significa comprovado no código ou validado por teste reproduzível.
- `[~]` significa corrigido no repositório, mas ainda depende de deploy, aplicação de SQL ou teste com conta real.
- `[ ]` significa aberto.
- `[?]` significa que falta evidência externa para concluir.
- Não marcar um item como concluído apenas porque a tela parece funcionar. Conferir frontend, RPC/RLS, banco e sessão.
- Ao concluir um item, registrar data, commit/deploy, banco afetado e evidência de teste na seção "Registro de validações".

## Dor principal: cadastro/login de professor

| Estado | ID | Risco | Item | Evidência/critério de conclusão |
| --- | --- | --- | --- | --- |
| `[?]` | AUTH-PERM-001 | Alto | Capturar a origem real de `Permissions.query: Illegal invocation` no computador afetado. Não há chamada a Permissions na árvore atual, no histórico Git, no JS publicado nem no `supabase-js@2.112.3`. | Salvar stack completo, URL do frame, aba Sources, extensões ativas e versão do navegador. Reproduzir em perfil anônimo sem extensões. Só atribuir ao FlowFit se o stack apontar para um arquivo do app/dependência. |
| `[x]` | AUTH-BOOT-001 | Alto | O submit de professor deixava exceções de `signUp`/`signIn`/`startAuthenticatedPanel` virarem rejeições não tratadas. | `appProfessor/js/app.js` agora registra a etapa, preserva a sessão detectada e mostra mensagem diferente para falha antes/depois da autenticação. |
| `[x]` | AUTH-BOOT-002 | Médio | O fallback inline disparava em 900 ms e navegava o conteúdo para o dashboard quando o módulo ainda não estava pronto. | `appProfessor/index.html`: aguarda 8 s, mantém o auth gate e não instala navegação paralela. |
| `[x]` | AUTH-BOOT-003 | Médio | APIs PWA opcionais podiam compartilhar o mesmo contexto de inicialização e usavam `catch` vazio. | `initializeOptionalPwaFeatures()` isola service worker/instalação; falhas geram `console.warn` e não alteram a sessão. |
| `[x]` | AUTH-BOOT-004 | Médio | Falha ao importar o cliente Supabase era convertida silenciosamente em `null`. | `appAluno/js/core/supabase.js` preserva a degradação, mas registra o erro original sem token/senha. |
| `[x]` | AUTH-PROFILE-001 | Alto | `auth.users` podia existir sem `profiles` depois de confirmação pendente ou interrupção pós-signup. | `ensureProfile()` continua reparando no próximo login e agora distingue falha de leitura/escrita, expõe `profileIncomplete` e recupera corrida de chave duplicada. |
| `[~]` | AUTH-PROFILE-002 | Alto | Confirmar no banco todas as identidades sem perfil criadas durante falhas antigas. | Rodar `supabase/diagnose-auth-roles.sql`; para cada linha sem perfil, confirmar o papel esperado. Login confirmado em `/professor` deve criar `profiles.role='coach'`, `coach_status='pending'`. Não converter papéis manualmente sem validar a identidade. |
| `[ ]` | AUTH-PROFILE-003 | Médio | Testar duas abas concluindo simultaneamente o mesmo perfil. | As duas devem terminar sem tela quebrada; uma pode inserir e a outra deve reler o perfil após `23505`. |
| `[~]` | AUTH-CACHE-001 | Médio | Garantir que computadores com PWA antiga recebam a correção. | Deployar os novos query strings, `flowfit-professor-v28` e `flowfit-aluno-v53`; testar update com uma instalação que ainda tenha o cache anterior. |

## Hierarquia de papéis e capacidade de professor

| Estado | ID | Risco | Item | Evidência/critério de conclusão |
| --- | --- | --- | --- | --- |
| `[~]` | ROLE-COACH-001 | Alto | Admin que opera como professor era excluído de overview/lista/detalhe/edição por `role='coach'`. | Aplicar `supabase/fix-coach-capability-admin-listing.sql`; confirmar admin na lista e contagens. |
| `[x]` | ROLE-COACH-002 | Alto | Editar o tenant do admin não pode rebaixar `role` para `coach`. | `admin_update_coach` altera somente status, vencimento e configuração administrativa; validar `profiles.role='admin'` antes/depois. |
| `[x]` | ROLE-COACH-003 | Médio | Revisar ocorrências restantes de `role='coach'`. | Mantidas apenas onde exclusividade é intencional: autocadastro/insert de perfil deve criar `coach pending`; `can_operate_as_coach` possui ramo explícito para admin. RPCs de catálogo usam `has_coach_capability`. |
| `[ ]` | ROLE-COACH-004 | Médio | Decidir se todo admin deve sempre ignorar `coach_status` em `/professor`. | Hoje `can_operate_as_coach()` aceita admin independentemente de `pending/suspended/cancelled`; documentar como regra intencional ou separar capacidade administrativa de status do tenant. |
| `[x]` | ROLE-ESC-001 | Alto | Impedir elevação direta de `profiles.role` pela Data API. | Grants limitam update autenticado às colunas de perfil público; `role` e `coach_status` não estão concedidos. Revalidar grants no banco real. |
| `[x]` | ROLE-ADMIN-001 | Alto | RPCs administrativas exigem backend authorization. | Todas verificam `is_platform_admin()` em função `security definer`; testar chamada direta com aluno/professor e esperar erro `P0001`. |

## Sessões, desativação e alterações de credencial

| Estado | ID | Risco | Item | Evidência/critério de conclusão |
| --- | --- | --- | --- | --- |
| `[ ]` | SESSION-001 | Alto | Professor suspenso/cancelado enquanto está com o painel aberto. | Verificar que uma nova abertura bloqueia. Hoje selects por `coach_id` não chamam `can_operate_as_coach`, portanto chamada direta pode continuar lendo dados; decidir e corrigir RLS se a suspensão deve cortar leitura imediatamente. |
| `[ ]` | SESSION-002 | Alto | Usuário removido de `auth.users` com access token ainda não expirado. | Medir leitura/escrita até expiração e refresh; confirmar comportamento de RLS para `auth.uid()` sem profile. |
| `[ ]` | SESSION-003 | Médio | Senha alterada com sessões existentes. | Testar em dois navegadores se access/refresh tokens antigos continuam válidos e por quanto tempo; definir se precisa revogação global. |
| `[ ]` | SESSION-004 | Médio | E-mail/login alterado com sessão existente e vínculos de aluno por e-mail. | Verificar auth user, `students.email`, `student_user_id`, seletores e próximo refresh. Não presumir sincronização automática. |
| `[x]` | SESSION-005 | Médio | Sessão reutilizada entre plataformas no mesmo origin. | É compartilhada pelo cliente Supabase/localStorage; cada app deve reaplicar seu gate. Professor rejeita papel inferior, admin usa RPC, aluno resolve vínculos. |
| `[ ]` | SESSION-006 | Médio | Entrar manualmente na URL de outro perfil com sessão existente. | Repetir matriz admin/coach/student nas três rotas e registrar mensagem, sign-out e acesso de API. |
| `[ ]` | SESSION-007 | Baixo | Sessão/localStorage parcialmente corrompido. | Corromper somente a chave Supabase em ambiente de teste; app deve voltar ao auth gate sem exibir dados remotos de outro usuário. Conferir caches locais. |

## Vínculos professor-aluno e dados órfãos

| Estado | ID | Risco | Item | Evidência/critério de conclusão |
| --- | --- | --- | --- | --- |
| `[x]` | LINK-001 | Baixo | Mesmo e-mail de aluno em professores diferentes. | Modelo suporta várias linhas e o app oferece seletor de vínculo; manter teste de troca de tenant/tema/treinos. |
| `[ ]` | LINK-002 | Médio | Mesmo e-mail duplicado dentro do mesmo professor. | Rodar `diagnose-auth-roles.sql`; duplicidade pode tornar convite e escolha ambíguos. Definir constraint/migração sem apagar dados. |
| `[ ]` | LINK-003 | Alto | Aluno marcado apenas como inativo ainda acessa dados. | As RLS atuais verificam `student_user_id`, não `students.status`; testar leitura direta e decidir se inativação deve revogar acesso. |
| `[ ]` | LINK-004 | Médio | Linha de aluno excluída com sessão/cache ativo. | RLS remota deve perder o `exists`, mas dados locais podem continuar visíveis até limpeza/refresh; medir e definir política de cache. |
| `[ ]` | LINK-005 | Alto | Professor/auth user excluído deixa dados de tenant órfãos. | `coach_id` é texto e não FK para `auth.users`; consultar students/themes/workouts/sessions sem profile/auth correspondente e definir retenção. |
| `[x]` | LINK-006 | Baixo | Professor sem alunos. | Estado vazio é suportado; professor continua listável por capacidade, não por contagem de alunos. |
| `[ ]` | LINK-007 | Médio | Aluno sem professor/vínculo aceito. | Deve autenticar, mas receber estado vazio/instrução; conferir que nenhum dado de cache de sessão anterior vaza. |
| `[ ]` | LINK-008 | Médio | `student_user_id` aponta para auth user sem profile ou papel inesperado. | Usar a consulta já existente em `diagnose-auth-roles.sql`; validar acesso real por RLS e mensagem do app. |

## APIs diretas, IDs e concorrência

| Estado | ID | Risco | Item | Evidência/critério de conclusão |
| --- | --- | --- | --- | --- |
| `[x]` | API-001 | Alto | Manipulação de `coach_id`/`student_id` no frontend. | Escritas principais usam RLS com `auth.uid()` e relação aluno-plano. Manter testes REST diretos com IDs de outro tenant. |
| `[x]` | API-002 | Alto | Alterar outro professor pela UI/API comum. | Update comum de profile é limitado ao próprio `user_id`; alteração administrativa passa por RPC autorizada. |
| `[ ]` | API-003 | Médio | IDs UUID/texto inválidos e inexistentes nas RPCs. | Confirmar `22P02`/`P0002`, mensagem da UI e ausência de alteração parcial. |
| `[ ]` | API-004 | Médio | Duas alterações administrativas simultâneas. | `admin_update_coach` bloqueia a linha `profiles FOR UPDATE`; validar histórico e regra last-write-wins para settings. |
| `[ ]` | API-005 | Médio | Edições simultâneas de aluno/treino fora das RPCs transacionais. | Verificar perda silenciosa de update e necessidade de versionamento/`updated_at`. |
| `[ ]` | API-006 | Médio | Dados locais exibidos depois de 401/403/RLS. | Repositórios mantêm cache offline; testar troca de usuário, revogação de vínculo e suspensão para garantir que cache não pareça acesso válido. |

## Matriz mínima de regressão

| Estado | Cenário | Resultado esperado |
| --- | --- | --- |
| `[ ]` | Professor novo, e-mail novo, confirmação desativada | `auth.users` + `profiles(coach,pending)`; mensagem de aprovação; sem rejeição no console. |
| `[ ]` | Professor novo, confirmação de e-mail ativada | Primeiro passo cria auth user e pede confirmação; callback/login completa profile pending. |
| `[ ]` | Auth user existente sem profile | Login repara profile de professor sem criar segunda identidade. |
| `[ ]` | Profile existente de aluno tentando `/professor` | Mensagem de papel incompatível e sign-out, sem promoção. |
| `[ ]` | Admin usando `/admin`, `/professor` e `/aluno` | Todos os gates coerentes; role continua admin; vínculos preservados. |
| `[~]` | Admin na lista de personals | Após migration, overview/list/get/update incluem a conta; edição não muda role. |
| `[ ]` | Professor pending/suspended/cancelled | Gate mostra mensagem correta; testar também REST direto. |
| `[ ]` | Conta inexistente e senha errada | Mesma mensagem segura quando aplicável; nenhuma criação de profile. |
| `[x]` | Chromium atual, tela inicial sem sessão | Inicializa sem erro de console no teste local e no deploy anterior à correção. Repetir após deploy. |
| `[ ]` | Perfil Chromium limpo, sem extensões | Não ocorre `Permissions.query`; comparar com computador afetado. |
| `[ ]` | PWA/service worker indisponível | Autenticação funciona; apenas instalação/cache offline fica indisponível e gera aviso técnico. |

## Registro de validações

| Data | IDs | Ambiente | Evidência | Resultado |
| --- | --- | --- | --- | --- |
| 2026-08-11 | AUTH-PERM-001 | Repositório, histórico Git, GitHub Pages, `supabase-js@2.112.3` | Busca por `Permissions`, `navigator.permissions`, `permissions.query`, Notification e câmera; nenhuma chamada correspondente. | Origem externa/não reproduzida; stack do computador afetado ainda necessário. |
| 2026-08-11 | AUTH-BOOT-001..004 | Revisão estática | Fluxos de submit/bootstrap e inicialização PWA separados; erros com etapa e mensagem. | Corrigido; smoke sem credenciais aprovado e deploy ainda pendente. |
| 2026-08-11 | AUTH-PROFILE-001, AUTH-PROFILE-003 | `scripts/auth-repository-smoke.mjs` | 5 cenários determinísticos: criação, conflito simultâneo, escrita incompleta pós-auth, confirmação pendente e papel incompatível. | Aprovado; integração com duas abas reais ainda pendente. |
| 2026-08-11 | ROLE-COACH-001..003 | SQL estático | RPCs usam `has_coach_capability`; update não escreve `role`. | Corrigido no repositório; migration ainda precisa ser aplicada no Supabase. |
| 2026-08-11 | AUTH-BOOT-001..003, SESSION-005 | Chromium local | `/appProfessor`, `/appAluno` e `/admin` abriram sem erros/warnings; fallback de 8 s não disparou com o módulo pronto. | Aprovado sem credenciais; login real e deploy continuam pendentes. |
| 2026-08-11 | Infra de teste | `scripts/ui-smoke.mjs` | Neste ambiente, o runner encerrou com `unsettled top-level await` em `Page.enable`, antes de inspecionar as rotas. | Não é evidência de falha do app; corrigir/rodar o harness em outro ambiente antes de usá-lo como gate. |

## Comandos/arquivos de confirmação

1. Diagnóstico somente leitura: `supabase/diagnose-auth-roles.sql`.
2. Correção incremental da lista de personals: `supabase/fix-coach-capability-admin-listing.sql`.
3. Schema consolidado para instalações novas: `supabase/schema.sql`.
4. Smoke de UI: `node scripts/ui-smoke.mjs http://127.0.0.1:8080`.
5. Smoke do reparo de profile: `node scripts/auth-repository-smoke.mjs`.
6. Busca conceitual obrigatória antes de fechar mudanças de papel: `rg -n "role.*coach|can_operate_as_coach|has_coach_capability" admin appProfessor appAluno supabase`.
