# Dados de treino enviados pelo professor e prioridade da UI

> Mapeamento do comportamento existente em 26/08/2026. Este documento descreve o contrato atual e propõe uma hierarquia para a interface. Não altera banco, regras de negócio ou código.

## Objetivo

Explicar, em linguagem de produto, quais dados o personal realmente define ao montar um treino, quais valores o FlowFit deriva automaticamente e quais campos existem apenas para persistência, sincronização ou compatibilidade.

A finalidade é orientar uma futura simplificação do editor: deixar em evidência o que muda a execução do aluno e retirar do caminho principal aquilo que é ocasional, derivado ou técnico.

## Conclusão curta

O núcleo da prescrição é menor do que o objeto enviado ao Supabase faz parecer:

1. para quem e quando o treino será disponibilizado;
2. nome e, opcionalmente, objetivo do treino;
3. ordem dos exercícios;
4. nome, séries, repetições, descanso e esforço de cada exercício;
5. orientações ou demonstração apenas quando necessárias.

O restante deve ser progressivamente revelado, inferido ou totalmente ocultado. IDs, código alfabético, posição numérica, string `prescription`, versão, revisão, estado de sincronização, metadados da RepDB e timestamps não são decisões do personal.

## O que significa “enviar um treino” no FlowFit

Existem quatro objetos relacionados, mas eles não deveriam parecer quatro formulários iguais:

### 1. Treino publicado para um aluno

É a prescrição concreta que aparece no app do aluno. Possui aluno, disponibilidade, identificação do treino e exercícios. Este é o fluxo principal do editor.

### 2. Modelo de treino

É uma receita reutilizável sem aluno. Guarda nome, objetivo, nível e o mesmo documento de exercícios. Selecionar um modelo é uma forma de iniciar o trabalho; não precisa permanecer como um campo destacado durante toda a edição.

### 3. Programa

Organiza modelos em semanas e dias. Ao aplicar o programa, o professor escolhe aluno e data inicial; o sistema calcula as datas e instancia os treinos. Semana, dia e ordem da sessão pertencem ao programa, não a cada exercício.

### 4. Definição de exercício

É uma entrada reutilizável de biblioteca: nome, aliases, músculos, equipamento, instruções e mídia. Ela pode preencher uma ocorrência no treino, mas a ocorrência continua podendo ter séries, reps, descanso e instruções específicas.

Os resultados executados — carga usada, reps feitas, séries concluídas, desconforto e feedback — percorrem o sentido inverso: são enviados pelo aluno ao professor. Eles devem aparecer como contexto de leitura no editor, não como parte da prescrição que o professor está “enviando”.

## Fluxo real dos dados

```text
Professor edita um rascunho
        ↓
FlowFit normaliza valores e gera campos derivados
        ↓
Professor publica para um aluno ou salva como modelo
        ↓
RPC grava plano + exercícios + snapshot de revisão
        ↓
App do aluno lê a prescrição publicada
        ↓
Aluno executa e envia sessão, séries e feedback de volta
```

A publicação atual é transacional: o plano e seus exercícios são enviados juntos. O editor não precisa expor essa complexidade.

# Parte 1 — dados do treino

## Identificação e destino

| Dado | Quem define | Uso atual | Prioridade na edição |
|---|---|---|---|
| Aluno | Professor | Define o destinatário da publicação | **Essencial ao publicar**; fora do conteúdo do modelo |
| Nome do treino | Professor | Listagens, início, agenda, execução, histórico e PDF | **Essencial e sempre visível** |
| Objetivo/foco | Professor, opcional | Cards do aluno, agenda, listagens e PDF | **Útil, mas secundário** |
| Nível | Professor, opcional | Persistido em treino/modelo/programa; não foi encontrado uso visível no app do aluno | **Avançado ou candidato a ocultar** até ter função clara |
| Data de disponibilidade | Professor | Decide quando o treino passa a estar disponível e alimenta agenda/programação | **Contextual e importante** |
| Modelo de origem | Professor escolhe ao começar | Preenche o rascunho e cria vínculo para revisões | **Ação de início**, não campo permanente |

### Leitura de UX

- “Aluno” e “modelo” hoje podem competir visualmente, embora representem decisões de momentos diferentes.
- O modelo deve ser escolhido antes de entrar na edição ou em um comando “Começar a partir de…”. Depois de carregado, basta uma indicação discreta da origem.
- O aluno é obrigatório para publicar uma ocorrência, mas não para salvar um modelo. A interface deve mudar o contexto com clareza em vez de deixar o usuário descobrir isso na validação final.
- Objetivo ajuda o aluno a reconhecer a proposta do treino, porém não deve disputar atenção com o nome.
- Nível está persistido, mas atualmente não altera a execução nem aparece para o aluno. Mantê-lo no formulário principal cria uma decisão sem retorno visível.

## Campos do plano que o sistema acrescenta

| Campo técnico | Como nasce | Por que existe | Deve ser editável? |
|---|---|---|---|
| `id` | Gerado pelo sistema | Identidade estável do plano | Não |
| `coach_id` | Sessão autenticada | Propriedade/RLS | Não |
| `student_id` | Aluno escolhido | Vínculo relacional | Somente pela escolha de aluno, nunca como ID |
| `student_key` e `owner` | Derivados do aluno | Compatibilidade e apresentação | Não |
| `code` | Legado, com fallback alfabético | Compatibilidade histórica | Não; não identifica o treino |
| `estimated_minutes` | Fórmula atual baseada na quantidade de exercícios | Resumo estimado | Não como precisão clínica; hoje é derivado |
| `source` | Sistema | Origem da publicação | Não |
| `status` e `editorial_status` | Sistema/fluxo | Publicado, rascunho etc. | Por ações de fluxo, não por select técnico |
| `starts_at` | Data escolhida e normalizada | Disponibilidade | Sim, por um controle de data amigável |
| `published_at` e `updated_at` | Relógio do sistema | Auditoria e ordenação | Não |
| `version` e `current_revision_id` | Publicação/revisão | Concorrência e histórico | Não |
| `template_id` | Modelo usado | Linhagem | Não diretamente |
| `program_assignment_id` | Aplicação de programa | Linhagem da programação | Não diretamente |
| `schema_version` | Sistema | Evolução do contrato | Não |

### Atenção à duração estimada

Hoje o editor calcula aproximadamente `máximo entre 28 minutos e 7 minutos por exercício`. O valor aparece para professor e aluno, mas não considera séries, descanso, tipo de exercício ou experiência da pessoa. Portanto:

- não deve ocupar espaço como campo manual enquanto a regra de produto não estiver definida;
- deve ser apresentado explicitamente como estimativa;
- não deve ser usado para sugerir que a prescrição está “correta”;
- uma melhoria futura poderia estimar pelas séries e descansos reais, sem criar mais um campo obrigatório.

# Parte 2 — dados de cada exercício

## Prescrição essencial

| Dado | Efeito no app do aluno | Prioridade na edição |
|---|---|---|
| Ordem | Define sequência, progresso e próximo exercício | **Essencial**, manipulada por arrastar/mover |
| Nome | Identifica o exercício em todas as telas e logs | **Essencial** |
| Séries | Define quantas conclusões o aluno precisa realizar | **Essencial** |
| Repetições | Preenche a meta e o registro inicial | **Essencial** |
| Descanso | Alimenta a prescrição e o timer entre séries | **Essencial** |
| RIR | É exibido diretamente no Modo Treino e registrado no snapshot/log | **Importante no produto atual** |

Esses seis elementos formam a linha principal do exercício. São suficientes para montar rapidamente a maior parte de um treino.

Uma linha compacta poderia ter:

```text
⠿  Supino reto             4 séries   10 reps   RIR 2   90 s    ···
```

Em telas estreitas, o mesmo conteúdo pode ser quebrado em duas linhas sem transformar todos os campos em cartões independentes.

## Dados úteis, mas ocasionais

| Dado | Uso atual | Tratamento recomendado na UI |
|---|---|---|
| Instruções para o aluno | Aparecem na visão geral e nos detalhes do Modo Treino | Painel de detalhes; indicar na linha quando preenchidas |
| Demonstração/mídia | Imagem, GIF, vídeo, YouTube, link ou RepDB no exercício ativo | Ação única “Adicionar demonstração”; inferir o tipo quando possível |
| Cadência/tempo | Exibida no Modo Treino | Detalhe técnico, com exemplo e linguagem clara |
| Carga sugerida | Serve como valor inicial quando não existe histórico | Detalhe; renomear para **Carga sugerida inicial** e omitir quando zero |
| Alternativas | Exibidas junto das instruções no Modo Treino | Detalhe; mostrar indicador de quantidade na linha |
| Tipo e nome do bloco | Agrupa aquecimento, superset, circuito, principal ou finalizador | Interação de agrupamento, não dois campos crus independentes |
| Grupo muscular/alvo | Aparece no modo legado e é salvo nos logs; pouca presença no fluxo atual | Inferir da biblioteca quando possível; edição avançada |
| RPE | Persistido, mas não foi encontrado uso visível no app atual do aluno | Ocultar do caminho principal enquanto RIR for o padrão |
| Observações internas (`notes`) | Existe no contrato e no modo legado; o editor atual não oferece campo claro e o valor padrão não acrescenta informação | Não adicionar à UI sem definir destinatário e finalidade |

### RIR e RPE

Expor RIR e RPE simultaneamente para todo exercício acrescentaria duas formas concorrentes de prescrever esforço. O produto atual é orientado a RIR: ele aparece no editor e no Modo Treino; RPE é apenas persistido.

Recomendação para a UI atual:

- manter RIR no caminho principal;
- não mostrar RPE ao lado dele só porque o banco possui o campo;
- se futuramente RPE virar uma opção real, usar uma preferência de método de esforço ou permitir escolher **RIR ou RPE**, com tradução clara para o aluno.

### Blocos

O contrato possui `block_id`, `block_type` e `block_label`, mas o personal não deveria precisar entender três campos técnicos.

A intenção do usuário é algo como:

- marcar como aquecimento;
- agrupar dois exercícios em superset;
- criar circuito;
- marcar bloco principal ou finalizador;
- opcionalmente dar um nome ao grupo.

A interface deveria oferecer uma ação “Agrupar/organizar” e gerar IDs e tipos internamente. `block_id` nunca deve aparecer.

### Mídia

O contrato envia `media_url`, `media_type` e `media_metadata`. Para RepDB, os metadados incluem provedor, versão, ID do exercício e poses; para URLs externas, o tipo pode ser imagem, GIF, vídeo, YouTube ou link.

A decisão humana é apenas “qual demonstração quero anexar?”. Logo:

- RepDB deve continuar como seletor visual;
- uma URL deve ser analisada automaticamente sempre que for seguro;
- o tipo técnico pode ficar como correção avançada apenas quando a detecção falhar;
- metadados da RepDB devem ser totalmente invisíveis;
- a linha do exercício deve mostrar somente que existe uma demonstração e permitir trocar/remover.

## Campos derivados ou técnicos do exercício

| Campo | Origem | UI recomendada |
|---|---|---|
| `id` | Sistema | Oculto |
| `workout_id` e `coach_id` | Contexto | Ocultos |
| `position` | Ordem da lista | Representado somente pela posição/drag |
| `prescription` | Derivado de séries + reps, por exemplo `4 x 10` | Nunca editar separadamente |
| `exercise_definition_id` | Item da biblioteca | Oculto; manter vínculo internamente |
| `block_id` | Agrupamento | Oculto |
| `media_metadata` | Adaptador/provedor | Oculto |
| `updated_at` | Sistema | Oculto |

Manter `prescription` editável além de séries e reps criaria duas fontes de verdade. O código atual já o recalcula, portanto a UI deve tratar a string apenas como resumo.

# Parte 3 — o que o aluno realmente vê e usa

## Antes de iniciar

O app do aluno usa:

- nome do treino;
- objetivo/foco;
- disponibilidade;
- quantidade de exercícios;
- duração estimada;
- lista de exercícios;
- séries/reps e descanso;
- instruções, quando preenchidas;
- agrupamentos/blocos.

## Durante a execução

Para o exercício ativo, usa:

- nome e posição;
- série atual e total de séries;
- repetições alvo;
- RIR;
- cadência;
- descanso;
- carga sugerida ou histórico anterior;
- instruções e alternativas;
- mídia/demonstração;
- bloco, quando aplicável.

O aluno então registra carga e reps reais. Esses valores não substituem automaticamente a prescrição do professor: tornam-se logs da sessão e histórico para a próxima execução.

## Dados enviados, mas atualmente pouco ou nada percebidos pelo aluno

- `level` não foi encontrado na apresentação do app do aluno;
- `rpe` é persistido, mas não aparece no fluxo de execução atual;
- `target` tem presença limitada e não é central no Modo Treino atual;
- `notes` não tem uma finalidade consistente no editor atual;
- IDs, versões, revisões, código e estados técnicos são infraestrutura.

Esses campos não devem ocupar o primeiro nível da interface só porque existem no banco.

# Parte 4 — hierarquia recomendada para o editor

## Nível 1: sempre visível

### Contexto do treino

- aluno, quando a ação for publicar para alguém;
- nome do treino;
- data de disponibilidade, quando relevante;
- ação principal clara: publicar, atualizar ou salvar modelo.

### Lista de exercícios

- ordem;
- nome;
- séries;
- reps;
- RIR;
- descanso;
- menu de ações.

Essa lista deve ser o centro do trabalho. O personal precisa conseguir adicionar, duplicar, remover e reordenar sem abrir um formulário grande para cada mudança comum.

## Nível 2: resumo do treino

Em uma seção compacta “Sobre o treino”:

- objetivo/foco;
- nível somente se ganhar uso real;
- origem do modelo como informação, não como decisão repetida;
- totais calculados de exercícios e séries;
- duração apenas como estimativa derivada.

## Nível 3: detalhes do exercício selecionado

Painel contextual, drawer ou página secundária conforme a largura:

1. **Orientação:** instruções e alternativas;
2. **Execução:** cadência e carga sugerida;
3. **Organização:** aquecimento/superset/circuito/bloco;
4. **Demonstração:** RepDB ou mídia externa;
5. **Metadados:** grupo muscular apenas quando necessário.

A linha principal deve indicar detalhes existentes sem repeti-los:

```text
Supino reto   4 × 10   RIR 2   90 s   [vídeo] [instrução] [superset A]
```

## Nível 4: nunca expor como edição

- IDs e chaves;
- `code`/letra do treino;
- `prescription` derivada;
- índice/posição numérica editável;
- estados de transporte e sincronização;
- timestamps;
- versões e revisões;
- schema/editorial metadata;
- IDs de modelo/programa/definição/bloco;
- metadados da RepDB.

# Parte 5 — elementos atuais que podem sair do caminho principal

## Entrada rápida

O texto de entrada rápida é uma ferramenta para criar exercícios em lote, não uma configuração do treino. Deve aparecer como ação “Adicionar vários” e desaparecer depois da importação, preservando a possibilidade de corrigir o resultado na lista.

## Fonte/modelo

“Criar do zero” ou selecionar um modelo é uma decisão inicial. Manter esse select permanentemente no formulário aumenta o risco de trocar a base sem querer e ocupa espaço depois que já cumpriu sua função.

## Preview duplicado

O preview atual repete nome, séries/reps e descanso. Um preview só agrega valor se representar fielmente a experiência do aluno, incluindo instruções, esforço, blocos e mídia. Caso contrário, a própria lista de exercícios já cumpre melhor a função de revisão.

Uma solução mais útil seria:

- lista como representação principal do conteúdo;
- “Visualizar como aluno” sob demanda;
- preview sem campos editáveis e sem ficar competindo por largura;
- destaque de inconsistências reais antes de publicar.

## Campos com defaults artificiais

Os defaults atuais (`RIR 2`, `60s`, `2-0-2`, `0 kg`, alvo “Personalizado”) aceleram a criação, mas também podem enviar uma intenção que o professor nunca confirmou.

Revisar no futuro:

- manter defaults úteis e visíveis para séries, reps, descanso e RIR;
- tratar `0 kg` como ausência de sugestão, não como prescrição literal;
- não exibir “Personalizado” ao aluno se o alvo não foi definido;
- avaliar se `2-0-2` deve ser default global, preferência do personal ou campo vazio;
- evitar observação automática “Criado no painel do professor”, pois ela não orienta ninguém.

# Parte 6 — proposta de fluxo simplificado

## Criar treino individual

1. Escolher aluno.
2. Escolher “do zero” ou um modelo.
3. Informar nome e, se necessário, data/objetivo.
4. Montar a lista usando nome, séries, reps, RIR e descanso.
5. Abrir detalhes apenas nos exercícios que precisam de orientação, bloco ou mídia.
6. Revisar um resumo e publicar.

## Criar modelo

1. Entrar pelo contexto “Modelos”, sem exigir aluno.
2. Informar nome do modelo.
3. Montar a mesma lista essencial.
4. Adicionar detalhes opcionais.
5. Salvar modelo.

## Aplicar programa

1. Escolher programa.
2. Escolher aluno e data inicial.
3. Conferir calendário calculado e exceções.
4. Confirmar aplicação.

O usuário não deveria editar aluno, modelo, programa e campos técnicos ao mesmo tempo. Cada fluxo deve deixar clara a entidade que está sendo criada.

# Parte 7 — decisões de produto ainda necessárias

Antes de remover definitivamente controles, responder:

- O nível será usado para busca, recomendação, progressão ou apenas documentação?
- O FlowFit quer prescrever esforço por RIR, RPE ou permitir uma escolha por exercício?
- Cadência `2-0-2` é um default intencional ou somente um legado?
- Carga do treino significa carga sugerida inicial, carga fixa ou meta?
- Grupo muscular será preenchido pela biblioteca e usado em relatórios?
- Observações são internas ao professor ou visíveis para o aluno?
- A duração deve ser estimada automaticamente com séries/descanso ou informada pelo professor?
- Alternativas são apenas texto ou futuramente apontarão para exercícios da biblioteca?
- Um treino pode ser reutilizável e destinado a aluno ao mesmo tempo, ou modelo e ocorrência devem permanecer fluxos separados?

Até essas respostas existirem, a opção mais segura é preservar os dados no contrato, mas retirar campos sem efeito comprovado do primeiro nível visual.

# Parte 8 — fonte do mapeamento

O documento foi conferido principalmente nestes pontos:

- [`appProfessor/index.html`](../appProfessor/index.html): campos gerais do editor;
- [`appProfessor/js/app.js`](../appProfessor/js/app.js): montagem dos exercícios, publicação, modelos e programas;
- [`appAluno/js/data/training-domain.js`](../appAluno/js/data/training-domain.js): normalização do documento, defaults e campos derivados;
- [`appAluno/js/data/repositories/workout-repository.js`](../appAluno/js/data/repositories/workout-repository.js): payload real de plano e exercícios enviado ao Supabase;
- [`appAluno/js/data/repositories/programming-repository.js`](../appAluno/js/data/repositories/programming-repository.js): definições, modelos, programas e aplicações;
- [`appAluno/js/app.js`](../appAluno/js/app.js): dados efetivamente exibidos e usados durante o treino;
- [`appAluno/js/screens/home/home-screen.js`](../appAluno/js/screens/home/home-screen.js) e [`appAluno/js/screens/agenda/agenda-screen.js`](../appAluno/js/screens/agenda/agenda-screen.js): apresentação antes da execução;
- [`supabase/migrations/20260823180000_flowfit_programming_domain.sql`](../supabase/migrations/20260823180000_flowfit_programming_domain.sql): domínio estruturado e publicação v2.

## Regra prática para a futura refatoração

Para decidir se um controle merece ficar sempre visível, aplicar esta sequência:

1. o personal toma conscientemente essa decisão em quase todo treino?
2. o aluno vê ou usa o resultado dessa decisão?
3. o campo não pode ser derivado com segurança?
4. deixar de preenchê-lo pode impedir ou alterar significativamente a execução?

Se a resposta não for “sim” para a maior parte das perguntas, o campo deve ser contextual, avançado, inferido ou oculto — não mais um controle no caminho principal.
