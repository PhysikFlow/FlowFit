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

- App do aluno com uma única tela de acesso: Google ou link mágico por email, sem senha.
- Professor pode cadastrar aluno com email (entrada direta) ou sem email (primeiro acesso por convite).
- Professor publica treinos para alunos do proprio `coach_id`.
- Aluno entra com o mesmo email cadastrado pelo professor e ve apenas os proprios dados.
- RLS habilitado para `profiles`, `brand_theme`, `students`, `workout_plans` e `workout_exercises`.
- Dados anonimos/mockados removidos do fluxo principal do app do aluno.
- Check-ins, series, cargas, repeticoes, historico e lembretes ainda ficam locais no aparelho.
- Marca branca sincronizada pelo professor e lida pelo aluno autorizado: nome, frase, cores, fonte, arredondamento e estilo de fundo.
- Logo e foto do personal existem como preview/cache local por enquanto; ainda nao usam Supabase Storage.
- A aparencia nao usa mais toggle claro/escuro separado no painel: o personal define as cores reais, o modo e inferido pelo fundo, e ha reset para o padrao FlowFit validado.
- Service Worker atualizado para evitar cache antigo no GitHub Pages.

## GitHub Pages + Supabase Auth

O projeto roda em GitHub Pages sem backend proprio. Por isso, login e autorizacao usam Supabase Auth + Row Level Security.

1. Em projeto novo, rode `supabase/schema.sql`. Em banco já configurado, rode apenas `supabase/update-student-access.sql`.
2. Em Authentication > URL Configuration:
   - configure `Site URL` com `https://physikflow.github.io/FlowFit/appProfessor/`;
   - adicione em Redirect URLs:
     - `https://physikflow.github.io/FlowFit/appProfessor/`
     - `https://physikflow.github.io/FlowFit/appAluno/`
     - opcional durante testes: `https://physikflow.github.io/FlowFit/**`
3. Em `appAluno/js/config.js`, confira `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
4. Em Authentication > Providers > Email, mantenha o provedor habilitado; o template de Magic Link deve usar a URL de confirmação do Supabase.
5. Abra `appProfessor/`, crie/entre com uma conta de professor.
6. Cadastre um aluno com nome e, se souber, o email de acesso.
7. Publique os treinos A, B e C para esse aluno.
8. Com email cadastrado, abra `appAluno/` e continue com Google ou peça um link mágico. Sem email, abra primeiro o convite copiado no painel.

## Login social: Google

O frontend chama `supabase.auth.signInWithOAuth()` apenas para `google`. Para funcionar em producao, o provedor tambem precisa estar configurado fora do codigo.

### Google

1. No Google Cloud/Auth Platform, crie um OAuth Client do tipo `Web application`.
2. Em Authorized JavaScript origins, use `https://physikflow.github.io`.
3. Em Authorized redirect URIs, cole a Callback URL exibida no provider Google do Supabase.
4. No Supabase > Authentication > Providers > Google:
   - habilite o provider;
   - em Client IDs, cole o Client ID do Google, algo como `...apps.googleusercontent.com`;
   - em Client Secret, cole o secret do OAuth Client.

Observacao: no campo `Client IDs` do Supabase nao vai o dominio do site. O dominio entra nas configuracoes do provedor e na URL Configuration do Supabase.

## Executar localmente

O app usa modulos JavaScript e Service Worker, por isso deve ser servido por HTTP:

```powershell
python -m http.server 8080
```

Depois abra:

- `http://localhost:8080/appAluno/`
- `http://localhost:8080/appProfessor/`

## Atualizar um banco existente sem apagar dados

1. Rode `supabase/update-student-access.sql` no SQL Editor.
2. Rode `supabase/diagnose-development-data.sql` e confira se as consultas de duplicidade e planos incompletos retornam zero linhas.
3. Não rode `supabase/reset-development-data.sql`; ele continua reservado para uma limpeza deliberada do ambiente de desenvolvimento.

A migração mantém alunos, contas, temas, treinos e históricos existentes. Ela adiciona o acesso direto por email, preserva a RPC antiga de convite por compatibilidade e cria a publicação transacional de treinos.

## Publicacao de treinos

O painel prepara o treino localmente e chama `publish_student_workout`. O Supabase confirma plano, exercícios e resumo do aluno na mesma transação. A interface só mostra sucesso depois dessa confirmação.

O app do aluno carrega:

1. sessao Supabase;
2. todos os vínculos autorizados para o email autenticado;
3. personal selecionado e seus treinos A/B/C ativos;
4. estado vazio real se nada foi publicado.

## Roteiro manual curto

1. Cadastre um aluno com email, publique A, B e C e confirme que os três aparecem no app do aluno.
2. Cadastre outro aluno sem email, copie o convite e confirme que o primeiro login define o email verificado.
3. Use o mesmo email em dois personais e confirme que o seletor do perfil troca tanto os treinos quanto o tema.
4. Arquive um treino e confirme que ele desaparece do app sem remover sessões antigas.
5. Salve duas cores de destaque diferentes; reabra o app do aluno e confirme que a segunda é aplicada.

## Observacao de producao

A chave `SUPABASE_ANON_KEY`/`publishable key` pode ficar no frontend. O que protege dados reais e RLS no banco. Nunca coloque `service_role` ou secret key no GitHub Pages.
