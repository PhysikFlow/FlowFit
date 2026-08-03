# FlowFit

Base web, mobile-first e sem dependencias de framework para um produto de treino com app do aluno, painel do personal e caminho futuro para PWA/WebView.

## Estrutura

- `appAluno/`: app do aluno com login, treino publicado, execucao, check-ins e historico local.
- `appAluno/js/data/repositories/`: Auth, alunos, treinos e marca branca via Supabase, com cache local/offline.
- `appAluno/js/core/`: adaptadores de plataforma, tema e estado local.
- `appProfessor/`: painel do personal para alunos, treinos e marca branca.
- `supabase/schema.sql`: schema Supabase com Auth/RLS para professor e aluno.
- `PLANEJAMENTO.md`: arquitetura, fases e criterios de evolucao.

## Estado atual

- Login por email/senha no app do aluno e no painel do professor usando Supabase Auth.
- Professor cadastra alunos reais com email de acesso.
- Professor publica treinos para alunos do proprio `coach_id`.
- Aluno entra com o mesmo email cadastrado pelo professor e ve apenas os proprios dados.
- RLS habilitado para `profiles`, `brand_theme`, `students`, `workout_plans` e `workout_exercises`.
- Dados anonimos/mockados removidos do fluxo principal do app do aluno.
- Check-ins, series, cargas, repeticoes, historico e lembretes ainda ficam locais no aparelho.
- Marca branca sincronizada pelo professor e lida pelo aluno autorizado.
- Service Worker atualizado para evitar cache antigo no GitHub Pages.

## GitHub Pages + Supabase Auth

O projeto roda em GitHub Pages sem backend proprio. Por isso, login e autorizacao usam Supabase Auth + Row Level Security.

1. No Supabase SQL Editor, rode `supabase/schema.sql`.
2. Em Authentication > URL Configuration:
   - configure `Site URL` com a URL do GitHub Pages;
   - adicione as URLs de `appAluno/` e `appProfessor/` em Redirect URLs.
3. Em `appAluno/js/config.js`, confira `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
4. Abra `appProfessor/`, crie/entre com uma conta de professor.
5. Cadastre um aluno com nome, email, objetivo e status.
6. Publique um treino para esse aluno.
7. Abra `appAluno/`, crie/entre com uma conta de aluno usando o mesmo email cadastrado.

Google/Apple ficam para uma etapa futura porque exigem configurar provedores OAuth no painel do Supabase/Google/Apple.

## Executar localmente

O app usa modulos JavaScript e Service Worker, por isso deve ser servido por HTTP:

```powershell
python -m http.server 8080
```

Depois abra:

- `http://localhost:8080/appAluno/`
- `http://localhost:8080/appProfessor/`

## Publicacao de treinos

O painel do professor publica um treino no cache local (`flowfit.published-workouts`) imediatamente e, se o professor estiver autenticado, sincroniza:

- `students`
- `workout_plans`
- `workout_exercises`

O app do aluno carrega:

1. sessao Supabase;
2. aluno encontrado pelo email autenticado;
3. treino publicado para esse aluno;
4. estado vazio real se nada foi publicado.

## Observacao de producao

A chave `SUPABASE_ANON_KEY`/`publishable key` pode ficar no frontend. O que protege dados reais e RLS no banco. Nunca coloque `service_role` ou secret key no GitHub Pages.
