# Auditoria de Autenticação — FlowFit (appAluno + appProfessor)

**Escopo:** fluxos de autenticação, cadastro, papel (aluno/personal), vínculo professor↔aluno e mensagens exibidas ao usuário.
**Método:** leitura dos dois aplicativos, repositórios compartilhados, schema do banco e guias do projeto.
**Status:** auditoria documental original + atualização de implementação em 2026-08-05. Pontos que dependem de configuração externa do painel do Supabase estão marcados como **precisa confirmar no dashboard**.

---

## Atualização de implementação — 2026-08-08

Regra adotada para a próxima fase:

- A identidade de autenticação deve ser única por pessoa/email no Supabase Auth sempre que possível.
- `profiles.role` passa a representar o **maior papel** da conta, não um app exclusivo:
  - `admin` > `coach` > `student`.
  - `coach` continua sendo o valor interno para professor/personal por compatibilidade.
- Matriz de acesso:
  - `admin`: pode abrir Admin, Professor e Aluno.
  - `coach`: pode abrir Professor e Aluno.
  - `student`: pode abrir somente Aluno.
- O método de login não define papel. Google, link mágico e email/senha apenas autenticam a identidade.
- O frontend não promove nem rebaixa papel automaticamente:
  - uma conta `admin` pode entrar em telas que exigem `coach` ou `student`;
  - uma conta `coach` pode entrar em telas que exigem `student`;
  - uma conta `student` não vira `coach` por abrir o painel do professor.
- A área do aluno continua protegida por vínculo real:
  - entrar no app do aluno não libera dados de qualquer aluno;
  - treinos/dados só aparecem se houver `students.student_user_id` ou convite/email válido vinculado.
- O backend recebeu funções de autorização reutilizáveis:
  - `role_rank(role)`;
  - `current_profile_role()`;
  - `has_role_at_least(required_role)`;
  - `can_operate_as_coach()`.
- Policies e RPCs de escrita do professor passam a aceitar `admin` operando como professor, mas ainda exigem `coach_id = auth.uid()::text` para operações comuns. A administração global continua concentrada nas funções do `/admin`.
- `/admin` reconhece tanto a allowlist `platform_admins` quanto `profiles.role = 'admin'`.
- Foi criado `supabase/diagnose-auth-roles.sql` para auditar usuários, roles, admins e vínculos antes de qualquer limpeza.

Ponto operacional importante:

- O SQL de bootstrap do primeiro administrador promove o email configurado para `profiles.role = 'admin'` e também mantém a linha em `platform_admins`. Isso não apaga dados, mas altera a permissão dessa conta quando o SQL for executado no Supabase.

---

## Atualização de implementação — 2026-08-05

Regra adotada para o piloto:

- Personal pode criar conta pelo painel com email/senha ou Google.
- Conta nova de personal entra com `profiles.role = 'coach'` e `profiles.coach_status = 'trial'`.
- Status de personal aceitos para operar: `trial`, `active`, `past_due`.
- Status bloqueados: `pending`, `suspended`, `cancelled`.
- Aluno não tem cadastro livre de produto: o primeiro acesso exige um token pessoal gerado no cadastro feito pelo personal.
- A função `claim_student_invite` valida token, validade e email e, de forma atômica, cria `profiles.role = 'student'` e grava `students.student_user_id`.
- Google continua sendo apenas método de autenticação. O papel vem de `profiles.role`.
- O convite carrega apenas `?invite=TOKEN`; email e IDs internos não ficam mais expostos na URL.
- Depois do aceite, RLS usa somente `student_user_id`; coincidência de email não libera cadastro ou treino.
- `profiles.role` não deve ser alterado por update comum do frontend. O SQL revoga update total em `profiles` e libera apenas campos editáveis de perfil.

Ainda pendente para endurecer antes de produção:

- Painel administrativo `/admin` para aprovar/suspender personal sem SQL manual.
- Executar `supabase/reset-development-data.sql` no projeto de desenvolvimento para remover vínculos antigos misturados.
- Seletor visual no app do aluno quando ele tiver mais de um personal ativo.

> A implementação acima substitui as descrições históricas abaixo que falam em autorização direta por email. Elas foram mantidas como registro da auditoria do fluxo antigo.

---

## 0. Arquitetura em uma imagem

```
appProfessor (index.html + app.js)  ─┐
                                     ├─► appAluno/js/data/repositories/*  (auth, students, workouts, sessions, theme)
appAluno (index.html + app.js)     ─┘              │                        ├─ localStorage (cache local-first)
                                                   │                        └─ Supabase Auth + Data API (chave anon)
                                                                                      └─ RLS (profiles, students, brand_theme, workout_*)
```

- Os dois apps são estáticos, sem servidor próprio; falam direto com o Supabase usando a chave pública.
- A lógica de autenticação é **única e compartilhada**: `appAluno/js/data/repositories/auth-repository.js` é importado pelos dois apps.
- O papel da conta não é decidido por um servidor nem por um trigger no banco: é gravado/validado **pelo próprio app no cliente** (função `ensureProfile`).

---

## 1. Fluxo atual do app do aluno (appAluno)

### 1.1 Tela de acesso (onboarding)
- `appAluno/index.html` → seção `[data-onboarding]` com abas **Entrar** / **Criar conta**, botão **Entrar com Google** e campos nome/email/senha.
- `?email=...` na URL (gerado pelo convite do personal) apenas **pré-preenche o campo email** (`getInviteEmail` / `prefillInviteEmail`). Não há token de convite.

### 1.2 Criar conta (signup)
1. `authRepository.signUp({ email, password, role: "student", redirectTo })` → `client.auth.signUp(...)`.
2. Envia `user_metadata.display_name` e `emailRedirectTo` (a própria URL do app, sem hash).
3. Comportamento bifurcado:
   - **Sem sessão no retorno** (padrão quando a confirmação de email está ligada): retorna `pendingEmailConfirmation: true` e exibe *"Conta criada. Confirme o email e depois entre novamente."*
   - **Com sessão no retorno** (novo usuário com confirmação desligada, ou sessão já existente): chama `ensureProfile({ role: "student" })` para criar o `profiles` e segue para o app autenticado.
4. **Não existe validação de que o email foi cadastrado por um personal.** Qualquer email pode criar uma conta de acesso.

### 1.3 Entrar (signin)
1. `authRepository.signIn({ email, password, role: "student" })` → `client.auth.signInWithPassword(...)`.
2. Em seguida `ensureProfile({ role: "student" })`:
   - Sem perfil → insere `profiles` com `role = 'student'`.
   - Perfil com outro papel → `roleMismatch` → **faz signOut** e retorna *"Esta conta já existe com outro tipo de acesso."*
3. Sucesso → `startAuthenticatedApp()`.

### 1.4 Boot autenticado (`startAuthenticatedApp`)
1. Lê sessão; sem sessão → volta ao onboarding.
2. `ensureProfile({ role: "student" })` de novo (idempotente).
3. **Checagem de papel:** `if (authContext?.role && authContext.role !== "student")` → `signOut()` + *"Esta conta não é de aluno. Use o painel do professor ou crie outra conta."*
   - ⚠️ Note que `role === null/undefined` **passa** nesta checagem (o `if` só dispara quando existe um role diferente de `student`).
4. `studentRepository.fetchCurrentStudent()` → busca na tabela `students` uma linha com `email ilike email autenticado`, mais recente (`order updated_at desc limit 1`). **O vínculo é por email, na hora da consulta.**
5. Se não achar aluno: *"Conta autenticada, mas este email ainda não foi cadastrado por um personal."* + notificação *"Peça ao personal para cadastrar este email no painel."* (estado vazio real).
6. Se achar: carrega o treino mais recente elegível (`fetchLatestWorkoutForCurrentStudent` — casa por `studentId` ou `studentKey`) e aplica o tema do personal (`brand_theme`).

### 1.5 Google no app do aluno
- Botão Google chama `authRepository.signInWithOAuth({ provider: "google" })` → `client.auth.signInWithOAuth(...)` com `redirectTo` = URL do app.
- No retorno do redirect, `detectSessionInUrl: true` (config em `core/supabase.js`) restaura a sessão; o boot roda `ensureProfile({ role: "student" })` e a mesma checagem de papel.
- **Consequência:** a primeira vez que um email entra por Google no app do aluno, ganha `profiles.role = 'student'` e fica "preso" nesse papel (ver seção 4).

### 1.6 Recuperação de senha
- `resetPasswordForEmail` para qualquer email; sucesso → *"Enviamos o link de recuperação para seu email."* (sem validação de existência no cliente).

---

## 2. Fluxo atual do app do personal (appProfessor)

### 2.1 Tela de acesso (auth gate)
- `appProfessor/index.html` → `[data-auth-gate]` com abas **Entrar** / **Criar conta**, campo nome do personal, email, senha e botão Google. O painel inteiro fica bloqueado até autenticar como coach (`setAuthLocked`).

### 2.2 Criar conta / entrar
- Mesmo `authRepository.signUp` / `signIn`, agora com `role: "coach"` e mensagens do painel (*"Criando conta de professor..."*).
- `signIn` com perfil existente de aluno → `roleMismatch` → signOut + *"Esta conta já existe com outro tipo de acesso."*
- **`signUp` NÃO verifica `roleMismatch`** (só `signIn` verifica) — inconsistência documentada na seção 4.

### 2.3 Boot autenticado (`startAuthenticatedPanel`)
1. `ensureProfile({ role: "coach" })`; se não sincronizou e não há perfil → *"Conta autenticada, mas o perfil não carregou. Recarregue a página."*
2. **Checagem de papel:** `if (authContext?.role !== "coach")` → *"Esta conta não é de professor. Use o app do aluno ou crie uma conta de professor."* e **mantém o painel bloqueado** (não faz signOut, ao contrário do app do aluno).
   - ⚠️ Aqui `role === null` **bloqueia** (ao contrário do app do aluno). Uma conta recém-criada cujo insert de perfil falhou cai exatamente nesta mensagem.
3. Sucesso → desbloqueia o painel, busca alunos/treinos/sessões/tema do coach (`coach_id = auth.uid()::text`).

### 2.4 Cadastro de aluno pelo personal
1. Formulário `[data-student-form]` (nome, email de acesso, objetivo, status) → valida apenas se há `authContext?.user` (não valida papel, mas o upsert no banco exige papel coach via RLS).
2. `createStudentFromProfessorForm` → aluno local (id `student-<slug>`), salvo primeiro em `localStorage` (`flowfit.students`).
3. `studentRepository.syncStudent` → `upsert` na tabela `students` com `coach_id = auth.uid()::text`.
   - **Não cria usuário no Supabase Auth. Não cria `profiles`. Não gera token. Não preenche `student_user_id`.**
4. Convite (`renderInviteTools`): gera texto com link `../appAluno/?email=...` e botões *Copiar convite* / *Abrir WhatsApp*. Não há aceite no app: o aluno só precisa saber o email.
5. Mesmo email no mesmo personal → mescla/atualiza o aluno existente (*"Aluno já existia neste personal. Atualizando cadastro..."*).

### 2.5 Importação CSV
- Mesmo fluxo do cadastro manual, em lote; cada aluno vira linha em `students`. Também não cria contas de acesso.

### 2.6 Google no painel
- Mesmo `signInWithOAuth` + `startAuthenticatedPanel` → primeiro acesso Google cria `profiles.role = 'coach'`.

---

## 3. Tabelas, funções, triggers e arquivos envolvidos

### 3.1 Tabelas (supabase/schema.sql)
| Tabela | Papel na autenticação |
|---|---|
| `auth.users` (gerenciada pelo Supabase) | Conta de acesso. Email único por usuário no projeto. **Não é tocada pelo schema.sql.** |
| `profiles` | **Define o papel.** `user_id uuid PK → auth.users (cascade)`, `role text check ('admin','coach','student')`, `coach_status`, `name` + campos de perfil do coach. **Uma linha por usuário → um email não pode ser coach e aluno ao mesmo tempo no piloto.** |
| `students` | **Cadastro do aluno (registro de negócio), NÃO é conta de acesso.** `id text PK`, `coach_id text`, `student_key`, `student_user_id uuid → auth.users (on delete set null)`, `email` (nullable). Índice único `(coach_id, lower(email))`. |
| `brand_theme` | Marca por coach (`coach_id = auth.uid()::text`); aluno autenticado do coach também pode ler. |
| `workout_plans`, `workout_exercises`, `workout_sessions`, `workout_set_logs`, `workout_feedback` | Dados por coach/aluno; RLS por `coach_id` ou vínculo do aluno (por `student_user_id` ou email). |

### 3.2 Funções e triggers
- **Não existe nenhuma função nem trigger no schema.sql.** Não há `handle_new_user`, não há criação automática de `profiles` no signup.
- A criação/validação do `profiles` é feita **no cliente**, em `authRepository.ensureProfile()`. Isso significa que o papel de uma conta depende do app que o usuário abriu primeiro (ver seção 4).

### 3.3 Arquivos envolvidos
| Arquivo | O que faz |
|---|---|
| `appAluno/js/core/supabase.js` | Cria o cliente supabase-js (CDN, chave anon, `detectSessionInUrl`, `persistSession`, `autoRefreshToken`). |
| `appAluno/js/config.js` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEMO_COACH_ID` (fallback legado). |
| `appAluno/js/data/repositories/auth-repository.js` | **Toda a lógica de auth**: `signIn`, `signUp`, `signInWithOAuth`, `resetPassword`, `ensureProfile`, `updateProfile`, `getAuthContext`, `onAuthStateChange`. |
| `appAluno/js/app.js` | Onboarding, `startAuthenticatedApp`, checagem de papel do aluno, `fetchCurrentStudent`. |
| `appProfessor/js/app.js` | Auth gate, `startAuthenticatedPanel`, checagem de papel do coach, cadastro/convite de alunos. |
| `appAluno/js/data/repositories/student-repository.js` | CRUD/mescla de `students` (local + nuvem), `fetchCurrentStudent` por email. |
| `appAluno/js/data/repositories/workout-repository.js` | Publicação/sincronização de treinos; `toStudentRow` re-upserta `students` ao publicar. |
| `appAluno/js/data/repositories/session-repository.js` / `theme-repository.js` | Sincronização de sessões e tema (dependem de `authContext.role`). |
| `supabase/schema.sql` | Tabelas, grants, RLS. |
| `appAluno/index.html` / `appProfessor/index.html` | Telas de login/cadastro. |

---

## 4. Contradições e comportamentos ambíguos

1. **Vínculo por email × coluna `student_user_id` morta.**
   O schema prevê `students.student_user_id` e a RLS a usa, mas **nenhum código grava esse campo** (sempre `null`). O vínculo real aluno↔cadastro é feito por `lower(email)` **na hora da consulta**. Se o email mudar ou o provedor for outro, o vínculo quebra.

2. **"Quem abre primeiro, define o papel."**
   `ensureProfile` roda no boot de cada app com o papel do app (student ou coach) e cria o perfil se não existir. Uma conta nova via Google ou via primeiro login fica **permanentemente** com o papel do primeiro app usado. Não existe conversão nem reivindicação explícita de papel.

3. **`signUp` ignora `roleMismatch`; `signIn` rejeita.**
   - `signIn`: detecta perfil com outro papel → signOut + erro claro.
   - `signUp`: chama `ensureProfile` mas **descarta `roleMismatch`** → o fluxo segue como se tivesse dado certo e só é barrado depois, no `startAuthenticatedApp`/`startAuthenticatedPanel`. Caminho direto para a mensagem "não é de professor/aluno".

4. **Comportamento divergente no bloqueio de papel.**
   - App do aluno: faz `signOut()` e mostra "Esta conta não é de aluno...".
   - Painel: **não faz signOut**, apenas mantém o gate bloqueado e mostra "Esta conta não é de professor...".
   Resultado: no painel o usuário fica "logado" sem acesso; no app do aluno é desconectado.

5. **Tratamento de papel ausente (`null`) divergente.**
   - Aluno: `role && role !== "student"` → `null` **passa** (segue para o app).
   - Professor: `role !== "coach"` → `null` **bloqueia** com "não é de professor".
   Uma conta sem perfil (insert falhou, por exemplo) é aceita no app do aluno e rejeitada no painel.

6. **"Conta criada. Confirme o email..." para email que já existe.**
   Quando o `signUp` do Supabase retorna usuário existente sem sessão (confirmação de email ligada), o app interpreta como cadastro novo e exibe mensagem de sucesso/confirmação. **Não é um cadastro novo.** (Ver seção 5, cenário 2.)

7. **Cadastro do aluno não gera vínculo garantido.**
   O personal grava apenas a linha em `students` (nome + email). Não há token de convite, nem estado "pendente de aceite", nem gravação de `student_user_id`. O "convite" é um texto com link. Qualquer pessoa com acesso ao email pode criar a conta de acesso; o vínculo depende só do email bater.

8. **Aluno de dois personais: quem ganha?**
   `fetchCurrentStudent` retorna a linha `students` **mais recente** para o email. Um aluno com dois personais vê os dados/treino de apenas um (o último atualizado), sem indicador de qual é qual.

9. **Email único no Auth × papel único no `profiles`.**
   No piloto, um email não pode ser `coach` e `student` ao mesmo tempo (uma linha de `profiles` por usuário). O mesmo email pode ser aluno de vários personais em `students`, mas usar o mesmo login como personal e aluno fica como evolução futura com papéis múltiplos.

10. **Mensagens de erro cruas em inglês.**
    Vários pontos repassam `error.message` do Supabase direto para o usuário (login inválido, "User already registered", "Email not confirmed", "Password should be at least 6 characters", rate limits etc.). O app não tem camada de tradução de códigos de erro (ver seção 7).

11. **`DEMO_COACH_ID` ainda existe** em `config.js` e como fallback em `normalizeStudent`, embora o fluxo autenticado sempre use `auth.uid()`. Risco de dado órfão em cenários de fallback.

12. **`upsert onConflict: "id"` ignora a constraint de email.**
    O índice único `(coach_id, lower(email))` protege o banco, mas o upsert usa `id` como conflito; a deduplicação por email depende do merge local do app (`mergeStudents`). Se o merge local for pulado, o banco rejeita com violação de unique e o app mostra erro cru.

13. **`emailRedirectTo` aponta para a própria URL do app** — OK. Mas o fluxo de confirmação depende de config do dashboard (ligar/desligar confirmação, whitelist de redirect URLs), fora do repositório.

14. **Sessão velha pode vazar para um signup.**
    Em `signUp`: `const session = data.session || await this.getSession()`. Se já existir sessão persistida de outra conta, o app pode associar o `profiles` ao **usuário errado**.

---

## 5. Cenários que podem gerar conta duplicada, papel incorreto ou vínculo ausente

### Cenário 1 — Mesmo email, dois personais (vínculo ambíguo, não duplicado)
Personal A e B cadastram `aluno@x.com`. O banco aceita (índice único é por `(coach_id, email)`). O aluno entra: `fetchCurrentStudent` devolve a linha mais recente → vê dados/treino de só um personal. **Dados do outro ficam invisíveis para ele.**

### Cenário 2 — Cadastrar email que já existe (o "cadastro que loga")
1. `aluno@x.com` já é conta de **coach** (ou de aluno) confirmada.
2. No app do aluno, o usuário usa **Criar conta** com esse email.
3. Com confirmação de email **ligada**: `signUp` devolve o usuário existente **sem sessão e sem erro** → o app mostra *"Conta criada. Confirme o email e depois entre novamente."* → o usuário confirma (ou já havia confirmado) → a sessão da conta **existente** volta via `detectSessionInUrl` → checagem de papel → signOut + "Esta conta não é de aluno..." ou entrada na conta errada.
4. Com confirmação **desligada**: `signUp` pode devolver erro `user_already_exists` (mensagem crua em inglês) **ou** sessão do usuário existente, dependendo da versão/config do GoTrue. Se devolver sessão → o app entra direto na conta já existente, **como se o cadastro tivesse feito login**.
5. Se já houver sessão persistida no navegador, `getSession()` no `signUp` devolve essa sessão → mesmo efeito.

> **Conclusão:** o signup de email existente nunca é detectado pelo app. Ele ou mostra sucesso falso, ou loga na conta existente — exatamente o sintoma relatado.

### Cenário 3 — Papel "incorreto" (mensagem "não é professor")
1. Usuário tem conta com `profiles.role = 'student'` (criada primeiro no app do aluno ou via Google).
2. Abre o painel e usa **Criar conta** ou **Google** com o mesmo email → `signUp` ignora `roleMismatch` → `startAuthenticatedPanel` → `role !== 'coach'` → *"Esta conta não é de professor..."* (gate bloqueado, sem logout).
3. Mesma mensagem aparece para conta **sem perfil** (role `null`), pois o painel exige `role === 'coach'` estritamente.
4. No sentido inverso, um coach usando o app do aluno é deslogado com "Esta conta não é de aluno...".

### Cenário 4 — Email com typo ou troca de email (vínculo ausente)
O personal cadastra `aluno@x.com`; o aluno cria a conta com `aluno@x.com` errado (ou muda o email depois). `fetchCurrentStudent` não acha linha → estado vazio *"este email ainda não foi cadastrado por um personal"*. Como `student_user_id` nunca é gravado, **não há como religar automaticamente**.

### Cenário 5 — Aluno cria conta antes de ser cadastrado
A conta de acesso existe (auth + profile) antes da linha em `students`. Quando o personal cadastra o email depois, o match por email passa a funcionar. **Funciona por acaso**, mas não há evento que "religue" nada; e se houver duas linhas com o mesmo email em personais diferentes, vale o cenário 1.

### Cenário 6 — Conta sem perfil
Insert de `profiles` falha (RLS não aplicada no banco, coluna faltando, etc.) → conta autenticada com `role = null`:
- App do aluno: entra (aceita `null`) e segue pelo email;
- Painel: bloqueia com "não é de professor".
Divergência de comportamento para o mesmo estado.

### Cenário 7 — Duplicidade no banco burlando o merge local
Se duas linhas `students` com o mesmo `(coach_id, email)` forem tentadas via upsert com `id` diferente, o índice único rejeita → erro cru. Se o merge local rodar antes, vira atualização. A proteção é frágil (cliente-dependente).

### Cenário 8 — Dois personais, um email, sync cruzado de treinos
`fetchPublishedWorkouts` no app do aluno filtra por RLS (vínculo por email em `students`) — o aluno vê treinos de **todos** os personais que o cadastraram, mas o `fetchLatestWorkoutForCurrentStudent` escolhe 1 pelo `studentId`/`studentKey` do aluno "mais recente". Pode exibir treino do personal A enquanto os dados de perfil vêm do personal B.

---

## 6. Proposta de regras únicas para os dois aplicativos

Base: regras propostas pelo usuário, com desdobramentos concretos para banco/código. **Implementado parcialmente no piloto em 2026-08-05; token real de convite e admin ficam pendentes.**

### R1 — Conta de acesso ≠ cadastro de aluno
- `auth.users` + `profiles` = **identidade de acesso** (quem você é, como entra).
- `students` = **registro de negócio** (relação personal↔aluno).
- O app do aluno deve tratar "não tenho conta de acesso" e "não fui cadastrado por personal" como estados **distintos** e explicáveis.

### R2 — O personal cria o cadastro e envia um convite
- Cadastro cria linha em `students` com **estado do vínculo**: `invited` → `claimed` (ou tabela `student_invites` com token).
- O convite é um **link com token** (`appAluno/?invite=<token>`, além do `?email=`), não apenas texto informativo.

### R3 — O aluno define o próprio acesso (senha ou Google)
- O personal nunca define senha. O aluno escolhe o método no primeiro acesso.
- Ao aceitar o convite (token + email), o app grava `students.student_user_id = auth.uid()` — preenchendo a coluna hoje morta e tornando o vínculo persistente.

### R4 — Google é método de entrada, não tipo de conta
- Uma identidade (email) pode ter senha E Google (identity linking do Supabase); não existe "conta Google" separada.
- O papel continua vindo de uma decisão explícita (aceite de convite = aluno; criação de conta de professor = coach), **nunca** do primeiro app aberto.

### R5 — Cadastrar conta existente nunca deve logar automaticamente
- O app deve detectar "email já registrado" antes/durante o signup e responder com uma destas:
  - mesmo papel → *"Já existe uma conta com este email. Entre com a senha ou use 'Esqueci minha senha'."*
  - papel diferente → *"Este email já está vinculado a outra função no FlowFit."*
- `signUp` deve passar a **tratar `roleMismatch`** como `signIn` já trata (hoje ignora).

### R6 — Conta sem vínculo com personal recebe explicação clara
- Telas distintas para: (a) conta válida sem cadastro em `students` → *"Este email ainda não foi cadastrado por um personal. Peça ao seu personal o link de convite."*; (b) papel errado → orientação para o outro app; (c) convite pendente → estado de aguardando.

### R7 — Aluno e personal como papéis explícitos
- `profiles.role` permanece como fonte do papel, mas **deixando de ser decidido pelo app aberto primeiro**: criação de coach só por signup explícito no painel (e validação de perfil), criação de aluno via aceite de convite.
- Definir o que acontece com contas existentes (migração) antes de mudar a regra (ver Decisões).

### R8 — Todas as mensagens ao usuário em português
- Camada de mapeamento `código do Supabase → mensagem pt-BR` (ex.: `invalid_credentials` → *"Email ou senha incorretos."*; `email_not_confirmed` → *"Confirme seu email antes de entrar."*; `over_email_send_rate_limit` → *"Tente novamente em alguns minutos."*).
- Nunca exibir `error.message` cru.

### R9 — Erros técnicos registrados separadamente
- Log de desenvolvimento (console + array em memória, padrão já existente no painel via `FlowFitProfessorErrors`) para erros técnicos; mensagem amigável sempre separada do detalhe técnico.

### Consequências esperadas no banco (para quando for implementar)
- Preencher `students.student_user_id` no aceite do convite e usá-lo como vínculo primário (email vira fallback).
- Estado de convite (novo campo ou tabela `student_invites`) + política de RLS para o aluno "reivindicar" a própria linha (`update` quando `student_user_id` está null e o email bate, ou via token).
- Revisar `signUp`/`signIn`/boot para tratar `role` ausente de forma consistente nos dois apps.

---

## 7. Quais mensagens vêm do Supabase e quais são criadas pelo app

### 7.1 Criadas pelo aplicativo (pt-BR, em `auth-repository.js` e nos `app.js`)
- *"Serviço indisponível."*
- *"Esta conta já existe com outro tipo de acesso."* (signIn com papel divergente)
- *"Conta criada. Confirme o email e depois entre novamente."* (signUp sem sessão — **inclusive quando o email já existia**)
- *"Provedor de login inválido."*
- *"Informe seu email para recuperar a senha."*
- *"Enviamos o link de recuperação para seu email."*
- *"Esta conta não é de aluno. Use o painel do professor ou crie outra conta."* (app do aluno)
- *"Esta conta não é de professor. Use o app do aluno ou crie uma conta de professor."* (painel)
- *"Conta autenticada, mas este email ainda não foi cadastrado por um personal."* (app do aluno)
- *"Conta autenticada, mas o perfil não carregou. Recarregue a página."* (painel)
- *"Entre como professor antes de cadastrar alunos/importar/publicar/editar o perfil."* (toasts do painel)
- Status de progresso: *"Entrando..."*, *"Criando conta de aluno..."*, *"Criando conta de professor..."*, *"Abrindo login com Google..."*.

### 7.2 Vindas diretas do Supabase (inglês/técnicas, repassadas cruas ao usuário)
Passadas por `error.message` sem tradução em:
- `signInWithPassword` (login/senha): `Invalid login credentials`, `Email not confirmed`, `Email not confirmed error`, rate limits, `Invalid email`, etc.
- `signUp`: `User already registered`, `Password should be at least 6 characters`, `Signup not allowed for otp`, rate limits, etc.
- `signInWithOAuth`: falhas de provedor/configuração de redirect.
- `resetPasswordForEmail`: erros de email/rate limit.
- Erros de inserção de perfil/aluno (`ensureProfile`, `syncStudent`, RLS/colunas): parcialmente engolidos (viraram flags `synced: false`), mas quando exibidos aparecem crus (ex.: "Aluno salvo, mas não enviado: <mensagem>", "Treino salvo, mas não enviado: <mensagem>").

---

## 8. Decisões necessárias antes de alterar banco ou código

1. **Papel único ou múltiplo?** Decisão do piloto: manter `profiles.role` único (um email = um papel). Evolução futura: tabela de papéis múltiplos para permitir que um usuário seja coach **e** aluno.
2. **Modelo de convite.** Novo campo(s) em `students` (`invite_token`, `invited_at`, `claimed_at`, status) ou tabela `student_invites`? Token de uso único ou reutilizável? Expira? Vínculo obrigatório por email ou por token?
3. **Quem pode criar conta de coach?** Signup aberto (como hoje) ou convite/validação manual de CREF? Isso define se `profiles.role = 'coach'` pode ser criado por qualquer um.
4. **Confirmação de email no Supabase.** Ligar/desligar no dashboard? Isso muda o comportamento do `signUp` (com sessão ou sem) e exige repensar os estados "pendente de confirmação" em pt-BR.
5. **Comportamento do signup com email existente.** Mensagem única por cenário: mesmo papel (ir para login/recuperação) vs papel diferente (bloqueio com orientação). Confirmar a semântica do `signUp` do GoTrue na versão/configuração atual do projeto.
6. **Migração de dados existentes.** O que fazer com contas que já têm papel definido pelo "primeiro app aberto"? E com `students.student_user_id` nulo? E com emails repetidos em múltiplos personais?
7. **Regra de reivindicação do vínculo.** Ao aceitar o convite, o app grava `student_user_id = uid`. Qual RLS permite isso com segurança (update na própria linha por email/token) sem permitir roubo de cadastro?
8. **Divergência de bloqueio.** Unificar: app do aluno e painel devem fazer o mesmo (signOut + mensagem) ao detectar papel errado.
9. **Tratamento de `role` nulo.** Decidir se conta autenticada sem perfil entra em algum app ou é sempre bloqueada com instrução de recarregar/recriar perfil.
10. **Google identity linking.** Configurar no dashboard do Supabase "one account per email" (merge de identidades) e definir o comportamento quando o email já tem senha — fora do repositório, mas precisa ser decidido para R4 funcionar.
11. **Ordem de implementação.** Banco primeiro (convite + student_user_id + RLS), depois `auth-repository` (tradução de erros, roleMismatch no signUp), depois as telas (estados de vínculo ausente/pendente) — e a ordem de deploy das mudanças para não quebrar o fluxo atual.

---

## Apêndice — Respostas diretas às perguntas da auditoria

| Pergunta | Resposta (resumo) |
|---|---|
| Como uma conta de aluno é criada? | Pelo próprio aluno, em **Criar conta** no appAluno (`signUp` + `ensureProfile('student')`). O cadastro feito pelo personal em `students` **não** cria conta de acesso. |
| Como uma conta de personal é criada? | Pelo próprio personal, em **Criar conta** no painel (`signUp` + `ensureProfile('coach')`). |
| O mesmo email pode existir nos dois apps? | Não no piloto: `auth.users` tem email único e `profiles` é 1:1 com papel único. O mesmo email pode ser **aluno de vários personais**, mas não operar como aluno e personal ao mesmo tempo sem futura tabela de papéis múltiplos. |
| Onde o papel é armazenado? | `profiles.role` (`'coach'` / `'student'`), criado/validado pelo app via `ensureProfile` — sem trigger no banco. |
| O que acontece quando o personal cadastra um aluno? | Upsert em `students` (local + nuvem) com `coach_id = auth.uid()`. |
| Cria só cadastro ou também usuário no Auth? | **Só cadastro** (`students`). Não cria `auth.users`, nem `profiles`, nem token de convite. |
| Google × email/senha? | Ambos usam o mesmo `auth.users`; Google é só método de entrada. O papel continua vindo do `ensureProfile` do app aberto. |
| Criar conta já existente? | O app não detecta: mostra "Conta criada. Confirme o email..." (quando sem sessão) ou loga na conta existente / mostra erro cru (depende da config de confirmação). |
| Por que o cadastro "loga" quando o email já existe? | `signUp` devolve sessão do usuário existente (confirmação desligada ou sessão velha via `getSession`) e o app **ignora `roleMismatch`** no caminho de signup. |
| Por que "não é professor"? | `startAuthenticatedPanel` exige `role === 'coach'`. Atingido por: signup de email já usado como aluno, Google de conta student, ou conta sem perfil (`role` nulo). |
| Mensagens do Supabase × do app? | App cria a maioria (pt-BR). Supabase fornece `error.message` em inglês, exibida crua em login/senha, signup, OAuth e reset (ver seção 7). |
