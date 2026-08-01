# FlowFit Professor

Esqueleto do painel usado pelo personal para administrar alunos, treinos, comunicacao, negocio e aparencia do app do aluno.

## Estado atual

- HTML, CSS e JS puros.
- Dados mockados em `js/data/mock-data.js`.
- Navegacao por hash.
- Sem login, pagamentos ou banco de dados obrigatorio.
- Marca branca salva localmente e, se Supabase estiver configurado, sincronizada na nuvem.
- Reaproveita tokens, componentes e icones compartilhados do `appAluno`.

## Telas criadas

- Dashboard: KPIs, prioridades e atividade recente.
- Alunos: lista mockada, aderencia, objetivo, status e cadastro local em memoria.
- Treinos: modelos, treinos cadastrados e criacao mockada pelo bloco `Adicionar treino`.
- Comunicacao: caixa de entrada e aviso em massa mockado.
- Negocio: agenda, financeiro e retencao como blocos reservados.
- Aparencia: preview de marca branca com nome, frase, cor de destaque, modo claro/escuro e botao `Salvar e aplicar no app do aluno`.

## Proximos passos naturais

1. Criar detalhe do aluno.
2. Criar builder real de treino.
3. Trocar o tenant demo por login real do personal.
4. Adicionar persistencia local primeiro e depois backend.
5. Separar dados por personal/tenant para marca branca.
