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

- Login por email/senha, Google e Apple no app do aluno e no painel do professor usando Supabase Auth.
- Professor cadastra alunos reais com email de acesso.
- Professor publica treinos para alunos do proprio `coach_id`.
- Aluno entra com o mesmo email cadastrado pelo professor e ve apenas os proprios dados.
- RLS habilitado para `profiles`, `brand_theme`, `students`, `workout_plans` e `workout_exercises`.
- Dados anonimos/mockados removidos do fluxo principal do app do aluno.
- Check-ins, series, cargas, repeticoes, historico e lembretes ainda ficam locais no aparelho.
- Marca branca sincronizada pelo professor e lida pelo aluno autorizado: nome, frase, cores, fonte, arredondamento e estilo de fundo.
- Logo e foto do personal existem como preview/cache local por enquanto; ainda nao usam Supabase Storage.
- Service Worker atualizado para evitar cache antigo no GitHub Pages.

## GitHub Pages + Supabase Auth

O projeto roda em GitHub Pages sem backend proprio. Por isso, login e autorizacao usam Supabase Auth + Row Level Security.

1. No Supabase SQL Editor, rode `supabase/schema.sql`.
2. Em Authentication > URL Configuration:
   - configure `Site URL` com `https://physikflow.github.io/FlowFit/appProfessor/`;
   - adicione em Redirect URLs:
     - `https://physikflow.github.io/FlowFit/appProfessor/`
     - `https://physikflow.github.io/FlowFit/appAluno/`
     - opcional durante testes: `https://physikflow.github.io/FlowFit/**`
3. Em `appAluno/js/config.js`, confira `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
4. Abra `appProfessor/`, crie/entre com uma conta de professor.
5. Cadastre um aluno com nome, email, objetivo e status.
6. Publique um treino para esse aluno.
7. Abra `appAluno/`, crie/entre com uma conta de aluno usando o mesmo email cadastrado.

## Login social: Google e Apple

O frontend ja chama `supabase.auth.signInWithOAuth()` para `google` e `apple`. Para funcionar em producao, os provedores tambem precisam estar configurados fora do codigo.

### Google

1. No Google Cloud/Auth Platform, crie um OAuth Client do tipo `Web application`.
2. Em Authorized JavaScript origins, use `https://physikflow.github.io`.
3. Em Authorized redirect URIs, cole a Callback URL exibida no provider Google do Supabase.
4. No Supabase > Authentication > Providers > Google:
   - habilite o provider;
   - em Client IDs, cole o Client ID do Google, algo como `...apps.googleusercontent.com`;
   - em Client Secret, cole o secret do OAuth Client.

### Apple

1. Requer Apple Developer Account.
2. Crie/configure App ID, Services ID, Key ID e chave privada `.p8`.
3. Configure o dominio web `physikflow.github.io`.
4. No Supabase > Authentication > Providers > Apple, preencha Client IDs/Services ID e dados de OAuth da Apple.

Observacao: no campo `Client IDs` do Supabase nao vai o dominio do site. O dominio entra nas configuracoes do provedor e na URL Configuration do Supabase.

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
