# FlowFit Professor

Esqueleto do painel usado pelo personal para administrar alunos, treinos, comunicacao, negocio e aparencia do app do aluno.

## Estado atual

- HTML, CSS e JS puros.
- Navegacao por hash.
- Sem login, pagamentos ou banco de dados obrigatorio.
- Alunos e treinos persistidos em repositórios local-first com Supabase opcional.
- Marca branca salva localmente e, se Supabase estiver configurado, sincronizada na nuvem.
- Publicacao local-first de treinos para o app do aluno via `flowfit.published-workouts`, com sync Supabase opcional.
- Reaproveita tokens, componentes e icones compartilhados do `appAluno`.

## Telas criadas

- Dashboard: KPIs, prioridades e atividade recente.
- Alunos: lista real, objetivo, status, treino ativo e cadastro persistido.
- Treinos: modelos, treinos cadastrados, preview estruturado e publicacao local pelo bloco `Adicionar treino`.
- Comunicacao: estado vazio ate autenticacao/notificacoes reais.
- Negocio: agenda, financeiro e retencao como modulos nao configurados.
- Aparencia: preview de marca branca com nome, frase, cor de destaque, modo claro/escuro e botao `Salvar e aplicar no app do aluno`.

## Proximos passos naturais

1. Criar detalhe do aluno.
2. Criar builder real de treino.
3. Trocar o tenant demo por login real do personal.
4. Evoluir sync de treinos para autenticacao real e historico de alteracoes.
5. Separar dados por personal/tenant para marca branca.
