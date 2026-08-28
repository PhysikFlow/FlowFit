# Auditoria sistêmica de design system e hierarquia visual

> Status: diagnóstico e proposta de direção. Este documento não implementa mudanças.
>
> Escopo: `appProfessor` e `appAluno`, com foco em hierarquia visual, composição, personalização e responsividade.
>
> Evidência: código atual, interface autenticada do professor em desktop e mobile, e telas do aluno já fornecidas no projeto/conversa.

## Resumo executivo

O FlowFit não está exatamente “sem design system”. O projeto já possui uma base útil:

- tokens semânticos de cor, tipografia, espaçamento, raio e sombra;
- componentes compartilhados para botões, cards, campos, estados e navegação;
- presets de tipografia e arredondamento;
- foco visível, áreas de toque e suporte a redução de movimento;
- personalização de marca aplicada por variáveis CSS.

O problema principal é que essa base ainda não funciona como um **contrato de composição**. Ela define como uma borda ou um card parece, mas não define com força suficiente:

- quando usar uma superfície;
- quando não usar uma superfície;
- quais superfícies podem ser aninhadas;
- o que é seção, grupo, linha, card, inset e overlay;
- qual ação deve dominar cada contexto;
- como a mesma informação perde detalhes no mobile;
- até onde a personalização do personal pode alterar a interface operacional.

O resultado é a sensação descrita como “tudo por cima”:

1. quase todo agrupamento recebe fundo, borda e raio;
2. grupos internos recebem novamente fundo, borda e raio;
3. ícones, métricas, filtros, estados e ações também recebem seus próprios contêineres;
4. como muitos níveis têm peso semelhante, a hierarquia depende mais de contornos do que de conteúdo, tipografia e espaço;
5. no mobile, essa estrutura geralmente é apenas empilhada, preservando todos os níveis e produzindo itens muito altos.

Há uma segunda causa estrutural importante: o tema configurado pelo personal altera também o painel administrativo do professor. Isso mistura **branding do produto entregue ao aluno** com **ferramenta operacional de trabalho**. Uma combinação de cores válida para uma marca pode reduzir demais a separação entre página, cards, seleção e ação principal no painel. No tema real auditado, o fundo marrom, as superfícies quase pretas e o acento marrom escuro mantêm legibilidade do texto, mas enfraquecem muito a indicação de prioridade.

### Direção recomendada

O FlowFit precisa de um design system que controle **papéis e relações**, não uma coleção maior de componentes:

- manter o painel do professor com um tema operacional estável e neutro;
- aplicar a marca do personal ao app do aluno e ao preview, não à legibilidade estrutural do painel;
- limitar a personalização a tokens de marca com derivações seguras;
- adotar quatro níveis claros de superfície: página, grupo, inset e overlay;
- reservar card para entidades realmente independentes e acionáveis;
- transformar coleções em uma superfície única com linhas e divisores;
- permitir no máximo um nível visível de superfície aninhada, exceto previews reais e diálogos;
- definir uma única ação primária por região;
- no mobile, reduzir informação em vez de apenas empilhar as colunas do desktop;
- migrar por fluxos, começando pelo editor de treino e pelos itens operacionais mobile.

---

## 1. Como a auditoria foi feita

### 1.1 Fontes analisadas

- tokens e componentes compartilhados em `appAluno/css/tokens.css` e `appAluno/css/components.css`;
- estilos específicos em `appAluno/css/app.css` e `appProfessor/css/app.css`;
- aplicação de tema em `appAluno/js/core/brand-theme.js`;
- integração do tema e validação de contraste em `appProfessor/js/app.js`;
- marcação HTML e componentes renderizados pelos dois aplicativos;
- painel do professor autenticado, navegado em 1440 × 900 e 390 × 844;
- screenshots anteriores do app do aluno em telas reais/representativas.

Nenhuma ação de salvar, publicar, excluir ou alterar dados foi executada durante a inspeção.

### 1.2 Medição auxiliar

Foi usada uma contagem heurística dos elementos visíveis com fundo, borda, raio e aninhamento. Ela não é uma regra absoluta de qualidade: campos e botões legítimos também entram na contagem. Sua utilidade é comparar a densidade estrutural entre telas.

| Tela auditada | Viewport | Elementos com aparência de superfície | Superfícies dentro de outro elemento visual | Elementos arredondados | Botões visíveis | Altura do documento |
|---|---:|---:|---:|---:|---:|---:|
| Editor de treino do professor | 1440 × 900 | 58 | 54 | 65 | 31 | 994 px |
| Agenda do professor | 1440 × 900 | 52 | 46 | 53 | 35 | 1315 px |
| Aparência do professor | 1440 × 900 | 71 | 69 | 49 | 16 | 918 px |
| Perfil do professor | 1440 × 900 | 19 | 16 | 19 | 2 | 900 px |
| Lista de alunos | 1440 × 900 | 19 | 17 | 19 | 12 | 900 px |
| Acompanhamento de aluno | 1440 × 900 | 9 | 8 | 3 | 3 | 900 px |
| Dashboard do professor | 390 × 844 | 9 | 6 | 5 | 2 | 844 px |
| Lista de alunos | 390 × 844 | 26 | 24 | 20 | 12 | 1062 px |
| Treinos com editor aberto | 390 × 844 | 56 | 52 | 63 | 31 | 1749 px |
| Aparência | 390 × 844 | 71 | 69 | 49 | 16 | 1551 px |

O padrão é consistente: as telas mais difíceis não têm necessariamente mais conteúdo de negócio; elas têm mais **camadas visuais concorrendo para explicar esse conteúdo**. Aparência, por exemplo, possui quase o mesmo número de superfícies aninhadas no mobile e no desktop. A responsividade muda a disposição, mas não reduz a complexidade apresentada.

### 1.3 Limitações e nível de confiança

- **Confirmado na interface real:** Dashboard, Alunos, acompanhamento, Treinos/editor, Agenda, Aparência e Perfil do professor.
- **Confirmado no código e nas screenshots fornecidas:** Home, Treino, Evolução, Agenda e Perfil do aluno.
- **Inferência de arquitetura:** os nomes exatos dos futuros componentes e a ordem fina da migração devem ser validados durante a implementação.
- A contagem automática serve como evidência comparativa; decisões devem continuar sendo feitas por fluxo e tarefa.

---

## 2. O que já existe e deve ser preservado

### 2.1 Base semântica útil

O arquivo de tokens já separa conceitos como página, superfície elevada, card, superfície forte, overlay, seleção, bordas, ação, estados, tipografia, espaçamento e raios. Essa base deve ser evoluída, não descartada.

### 2.2 Presets de raio por papel

O tema não aplica um único número bruto a tudo; ele possui mapas para `xs`, `sm`, `md`, `lg`, controles, elementos compactos, avatar e trilhas. Essa é a direção correta. O problema é a quantidade de elementos que recebem algum contorno arredondado, não apenas o valor do raio.

### 2.3 Listas operacionais do professor

As listas desktop de Alunos e Treinos estão entre as partes mais claras do painel:

- uma superfície principal;
- linhas separadas;
- colunas previsíveis;
- ação principal visível;
- menu secundário contextual.

Elas são uma referência melhor para o restante do painel do que a antiga grade de cards.

### 2.4 Dashboard do professor

O Dashboard atual usa linhas internas e divisores em vez de transformar cada situação em um card completo. A estrutura de “principal situação + ocorrências secundárias resumidas” é coerente e deve ser preservada.

### 2.5 Home do aluno

A Home do aluno possui uma hierarquia relativamente forte:

- treino disponível como tarefa dominante;
- uma ação principal clara;
- atividade dos últimos dias como conteúdo secundário agrupado;
- espaço vazio que não compete com a tarefa.

Ela demonstra que o produto já consegue usar uma superfície forte de maneira intencional.

### 2.6 Progressive disclosure

Os accordions em Aparência e as configurações recolhíveis do editor são ideias corretas. O problema não é esconder conteúdo; é que, quando aberto, o conteúdo ainda acumula muitos contornos e subcontêineres.

### 2.7 Modo Treino imersivo

O Modo Treino é um contexto especial, orientado a uma ação física e sequencial. Ele não deve ser forçado a adotar a mesma composição do painel ou das páginas comuns. A decisão de retirar a navegação convencional e dar prioridade à série ativa deve permanecer.

---

## 3. Diagnóstico estrutural

### 3.1 Existe uma biblioteca visual, mas não uma gramática de uso

**Problema**

`card`, `panel`, `entity-row`, `programming-card`, `agenda-panel`, `preview-card` e outras classes cumprem papéis parcialmente sobrepostos. Novas telas escolhem ou criam um contêiner pela aparência desejada, não por uma regra compartilhada de semântica.

O CSS reforça esse histórico: o painel do professor concentra cerca de 148 KB em uma folha específica, com blocos posteriores de “refresh”, “hierarquia semântica”, “workspace” e correções do editor/agenda. Há uma base comum, mas muitas decisões finais dependem da ordem da cascata e de overrides acumulados.

**Consequência**

- telas semelhantes têm densidades diferentes;
- correções locais voltam a divergir;
- o mesmo componente muda de significado entre páginas;
- adicionar uma feature tende a adicionar mais uma classe de superfície;
- personalização e responsividade ficam difíceis de testar sistemicamente.

**Solução**

Criar uma gramática curta de composição antes de criar novos componentes:

1. **Page canvas:** fundo da página, sem borda.
2. **Section:** título + conteúdo separados por espaço; normalmente sem fundo.
3. **Group surface:** agrupa uma coleção relacionada; pode ter uma borda externa.
4. **Row:** item dentro de grupo; usa divisor, não card individual.
5. **Inset:** região interna de apoio, preview ou dados subordinados; sem sombra.
6. **Card:** entidade independente, acionável e capaz de existir/mover-se sozinha.
7. **Overlay:** dialog, popover ou menu acima do conteúdo.

Cada componente novo deve declarar qual desses papéis ocupa. Se não houver resposta clara, provavelmente não precisa de outro contêiner.

---

### 3.2 O componente visual “card” está realizando trabalhos demais

**Problema**

Cards são usados para:

- página inteira;
- seção;
- item de lista;
- conjunto de métricas;
- ícone;
- status;
- filtro;
- formulário;
- preview;
- navegação segmentada;
- empty state;
- ação “adicionar”.

**Consequência**

Se tudo é independente e elevado, nada parece realmente prioritário. O usuário precisa ler os rótulos para reconstruir uma hierarquia que o layout deveria comunicar de imediato.

**Solução**

Aplicar o teste de independência:

> Este bloco pode ser selecionado, movido, aberto ou comparado como uma entidade completa?

- Se sim, um card pode ser apropriado.
- Se é apenas uma linha dentro de uma coleção, usar row + divisor.
- Se é apenas um rótulo ou número, não criar superfície própria.
- Se é uma subseção do formulário, usar título, espaço e eventualmente divisor.
- Se é um estado, usar texto/ícone/cor; chip apenas quando o estado precisa ser escaneado ou filtrado.

Meta inicial: nenhuma tela comum deve ultrapassar um nível visível de superfície aninhada. Exceções: preview de dispositivo, conteúdo de dialog e visualizações que simulam outro contexto.

---

### 3.3 Bordas e raios substituem hierarquia de conteúdo

**Problema**

O CSS específico do professor contém muito mais usos de bordas e raios do que a camada compartilhada. Na interface real, painel externo, subseção, campo, ícone, métrica e botão repetem contornos com pesos próximos.

**Consequência**

- aparência de wireframe/protótipo;
- ruído nas bordas periféricas;
- agrupamentos fracos apesar de muitos contornos;
- sensação de “card dentro de card” mesmo quando as cores são bonitas;
- arredondamento perde significado e passa a parecer decorativo.

**Solução**

Adotar esta ordem para criar hierarquia:

1. proximidade e espaçamento;
2. tipografia;
3. alinhamento;
4. divisor;
5. mudança sutil de superfície;
6. borda completa apenas quando ainda necessária;
7. sombra somente para elementos flutuantes/overlay.

Raios devem pertencer ao papel, não ao tamanho arbitrário:

- controles interativos: `radius-control`;
- superfície de grupo: `radius-surface`;
- cards independentes: `radius-card`;
- overlay: `radius-overlay`;
- avatar e trilha: papéis próprios;
- linhas, métricas e ícones internos: sem raio por padrão.

---

### 3.4 A personalização de marca interfere na ferramenta operacional

**Problema confirmado**

`applyThemeTokens()` escreve cores, fontes e raios no `document.documentElement`. O painel do professor também chama essa função e recebe o tema da marca como tema global. Assim, uma escolha feita para o app do aluno altera Dashboard, tabelas, sidebar, formulários, estados e botões administrativos.

No tema real observado:

- fundo da página marrom escuro;
- superfícies quase pretas;
- ação/acento em outro marrom escuro;
- texto continua legível, mas página, seleção e ação primária têm separação fraca.

**Consequência**

- a qualidade do painel varia de acordo com a marca;
- ações primárias podem perder destaque;
- status e seleção podem competir com a decoração;
- fica impossível garantir uma experiência operacional consistente;
- bugs visuais parecem aleatórios porque surgem apenas com certas combinações.

**Solução recomendada**

Separar dois escopos:

#### Tema operacional do professor

- estável, neutro e controlado pelo produto;
- pode mostrar pequenos acentos da marca em logo/avatar e detalhes;
- mantém contraste, elevação e estados previsíveis;
- não muda sua estrutura por preferência do personal.

#### Tema de marca do aluno

- aplicado ao `appAluno` e ao preview de Aparência;
- controla marca, acento, fundo, superfície, texto, fonte, raio e logo dentro de limites seguros;
- não contamina o painel administrativo.

Se a separação total não for feita imediatamente, aplicar o tema a um contêiner de preview/escopo do aluno em vez do `:root` do painel já elimina a maior parte do risco.

---

### 3.5 A validação do tema mede leitura, mas não mede hierarquia

**Problema confirmado**

A validação atual compara:

- texto × fundo;
- texto × card/surface.

Isso responde “o texto pode ser lido?”, mas não responde:

- página e card são distinguíveis?
- ação primária é distinguível da superfície?
- texto sobre o acento é legível?
- texto secundário permanece legível?
- borda aparece o suficiente?
- seleção, sucesso, aviso e perigo continuam identificáveis?

**Solução**

Adicionar um contrato de tema que valide uma matriz mínima:

- `on-page` × `page`;
- `on-surface` × `surface-1`;
- `muted` × `page` e `surface-1`;
- `on-accent` × `accent`;
- `surface-1` × `page` com separação mínima perceptível;
- `surface-2` × `surface-1` com separação mínima;
- borda × superfícies;
- estados semânticos × seus fundos;
- foco × página/superfície.

Quando uma combinação escolhida falhar na hierarquia, o sistema deve derivar tons seguros. O personal escolhe a intenção da marca; o FlowFit continua responsável pela legibilidade do produto.

---

### 3.6 Tipografia tem muitos níveis pequenos e pouca dominância

**Problema confirmado**

No editor desktop foram encontrados 28 textos visíveis em aproximadamente 11,2 px, 22 em 13 px e 15 em 14,8 px. Agenda e Aparência repetem uma proporção parecida. Eyebrows, labels, ajuda, metadados e status disputam uma faixa estreita de tamanhos e pesos.

**Consequência**

- é difícil identificar o que ler primeiro;
- metadados parecem tão importantes quanto rótulos operacionais;
- títulos de seção precisam de mais borda/card para se destacar;
- textos pequenos aumentam cansaço em uso prolongado.

**Solução**

Reduzir para cinco papéis estáveis:

1. título de página;
2. título de seção;
3. título de item;
4. corpo/controle;
5. metadado/ajuda.

Regras:

- eyebrow apenas quando acrescenta contexto, não para todo agrupamento;
- corpo e controles nunca dependem de 11 px para caber;
- metadado pode ser discreto sem perder legibilidade;
- título + texto de suporte devem resolver a maior parte da hierarquia antes de qualquer borda;
- peso forte deve ser reservado a identidade, valor atual ou ação, não a todos os rótulos.

---

### 3.7 A hierarquia de ações varia e às vezes desaparece no tema

**Problema**

Há regiões com várias ações de peso parecido, especialmente editor, cabeçalhos e toolbars. No tema observado, o acento escuro também deixa o botão primário próximo do fundo. Ações globais, como instalar/sair, podem competir com a tarefa da página.

**Solução**

- uma ação primária por contexto;
- ação secundária com contorno ou texto, não o mesmo peso;
- ações terciárias em menu contextual;
- ação destrutiva separada das ações de continuidade;
- ações globais no chrome/perfil, não na mesma faixa das ações da tarefa;
- barra sticky no editor apenas para estado de salvamento + ação principal;
- nunca depender apenas da cor de marca escolhida: `on-accent` e saliência mínima precisam ser derivados.

---

### 3.8 A responsividade empilha a estrutura do desktop sem redefinir prioridade

**Problema confirmado**

Na lista mobile de alunos, cada item ocupa aproximadamente 368–375 px. Na lista de treinos, um item observado ocupa aproximadamente 383 px. Todos os campos do desktop reaparecem como blocos rotulados, seguidos por ações.

Em Aparência, o editor ocupa cerca de 1112 px e o preview mais 353 px. A seção de cores aberta ocupa aproximadamente 655 px. A quantidade de superfícies detectadas é praticamente a mesma do desktop.

**Consequência**

- baixa densidade operacional;
- excesso de rolagem;
- comparação entre itens fica difícil;
- ações importantes ficam longe da identidade do item;
- o usuário paga no mobile por toda a complexidade do desktop.

**Solução**

Responsividade deve alterar o **conteúdo apresentado**, não apenas o grid:

- linha mobile: identidade + estado principal + um fato decisivo + ação principal;
- detalhes secundários na página dedicada ou menu, não todos expandidos;
- filtros avançados recolhidos;
- preview sob demanda quando não cabe ao lado;
- propriedades extensas em painel/drawer contextual simples;
- cabeçalho e ação principal permanecem próximos;
- labels de coluna não devem virar uma sequência de seis pares label/valor em todo item.

---

## 4. Auditoria por área do professor

### 4.1 Dashboard

**O que funciona**

- cabeçalho compacto;
- situações em linhas, não cards individuais;
- principal pendência e secundárias resumidas;
- atividade recente tratada como secundária;
- mobile relativamente leve comparado às outras telas.

**Problema**

Os dois painéis principais ainda têm peso visual muito semelhante e, com poucos dados, formam grandes blocos escuros cercados por espaço vazio. O estado inicial pode parecer uma estrutura incompleta, não uma decisão deliberada.

**Solução**

- manter Situações atuais como única superfície operacional dominante;
- tratar Atividade recente como seção secundária, possivelmente sem card externo;
- reduzir a altura implícita dos estados vazios;
- usar ação contextual próxima da situação, sem adicionar KPIs decorativos;
- preservar a ordem neutra e as regras de produto atuais.

### 4.2 Lista de alunos

**O que funciona**

- desktop já usa uma lista operacional clara;
- ação principal e menu contextual estão próximos do aluno;
- campos possuem colunas previsíveis.

**Problema**

No mobile, a linha vira um cartão longo com praticamente todas as colunas, seus rótulos e múltiplas ações. Estado do aluno, acesso, última sessão e treino atual recebem pesos próximos.

**Solução**

Desktop:

- preservar o agrupamento único com divisores;
- reduzir superfícies individuais de botões/estados onde texto e ícone bastam;
- manter somente uma ação primária por linha.

Mobile:

- primeira linha: avatar/nome + estado explícito;
- segunda linha: treino atual ou “sem treino”, pois define a ação;
- terceira linha opcional: última sessão, quando existe;
- ação principal alinhada ao rodapé/à direita;
- convite, edição e outras ações no menu;
- objetivo e dados administrativos na visualização dedicada, salvo quando essenciais ao fluxo.

### 4.3 Acompanhamento do aluno

**O que funciona**

- tela relativamente plana;
- métricas agrupadas em uma faixa;
- navegação dedicada adequada para conteúdo extenso.

**Problema**

Quando há poucos dados, o painel ocupa muita largura e o vazio interno domina a percepção. Métricas têm separadores fortes mesmo quando não existe conteúdo suficiente para comparação.

**Solução**

- manter página dedicada;
- usar cabeçalho de identidade do aluno fora de card;
- exibir métricas em uma seção compacta;
- colocar histórico em uma lista única;
- estados vazios contextuais sem preencher artificialmente a página;
- não criar dados ou insights que o backend não sustenta.

### 4.4 Lista de treinos

**O que funciona**

- lista desktop operacional;
- editar como ação principal;
- menu secundário para duplicar/PDF/arquivar;
- navegação entre Alunos, Modelos, Programas e Rascunhos já oferece estrutura.

**Problema**

A navegação segmentada, toolbar e lista usam superfícies de peso parecido. No mobile, o treino se torna um card alto. Quando o editor é aberto, a lista original continua no documento e o editor aparece como mais um grande card acima dela.

**Solução**

- tratar o seletor de domínio como navegação, não como card de conteúdo;
- manter a lista em um único grupo;
- compactar item mobile para aluno/título, estágio, resumo e ação;
- ao editar, entrar em um **modo de edição** que substitui a lista visualmente;
- usar “voltar para Treinos” para restaurar o contexto, preservando busca/filtros;
- não manter a tabela completa competindo atrás/abaixo do editor.

### 4.5 Editor de treino

**Problema confirmado**

É a manifestação mais forte do problema sistêmico:

- o editor inteiro é um card dentro da página de Treinos;
- configurações gerais são outro contêiner;
- estrutura possui header e caixa de ícone;
- quantidade de exercícios, séries e minutos aparecem como caixas independentes;
- preview é outro contêiner;
- exercícios estão em tabela/contêiner;
- adicionar exercício cria outro inset;
- ações e estado de salvamento ficam em outro contêiner;
- a lista de treinos original continua abaixo;
- no mobile, a estrutura completa chega a 1749 px no estado observado.

**Solução estrutural**

1. O editor passa a ocupar o canvas da seção, não um card sobre a listagem.
2. Cabeçalho contém:
   - voltar;
   - nome do treino;
   - aluno/contexto;
   - estado de salvamento;
   - ação publicar/salvar.
3. Configurações gerais ficam em ação compacta e painel recolhível.
4. Estrutura do treino é o conteúdo principal.
5. Métricas viram metadados inline, por exemplo “1 exercício · 3 séries · 28 min”.
6. A lista de exercícios usa uma superfície única com rows.
7. Exercício selecionado abre propriedades em painel contextual confortável no desktop e em página/painel simples no mobile.
8. Preview aparece sob demanda; não precisa de moldura externa e interna simultaneamente.
9. Footer sticky possui uma ação primária e ações secundárias discretas.
10. Reordenação mantém handle e feedback de posição sem criar uma superfície extra para o handle.

**Critério de sucesso**

Em 1366 × 768 e 100% de zoom, o usuário deve ver simultaneamente o contexto do treino, uma parte útil da lista e a ação principal, sem scroll horizontal e sem campos espremidos. Em mobile, a edição não deve coexistir visualmente com a listagem de treinos.

### 4.6 Agenda

**O que funciona**

- dias da semana já são linhas dentro de um grupo;
- separadores ajudam a percorrer a semana;
- edição por dia mantém o modelo compreensível;
- preview do aluno é útil para conferir a configuração.

**Problema**

- painel semanal grande;
- legenda em faixa própria;
- cada ação de dia tem contêiner arredondado;
- regras ficam em outro card;
- coluna direita é card com input, resumo e preview interno também contornado;
- preview tem seus próprios slots/cards;
- 35 botões e 52 superfícies aparentes na tela observada.

**Solução**

- disponibilidade semanal: uma seção + uma lista agrupada;
- legenda pequena no header, sem faixa/card próprio;
- ação de editar transparente, com área de toque adequada;
- regras como form rows na mesma página, separadas por título/divisor;
- preview como único inset legítimo da área, visualmente rotulado como simulação;
- exceções em uma lista, não cards individuais;
- dialogs com rodapé sempre visível e conteúdo rolável, preservando o combobox customizado.

### 4.7 Aparência

**Problema confirmado**

Foi a maior concentração detectada: 71 superfícies aparentes, 69 aninhadas. Há card externo, accordions contornados, seletor de modo, cards de paleta, campos de cor, swatches internos, aviso de contraste, botão de restaurar, card de preview, moldura de telefone e cards dentro do preview.

O preview justifica parte do aninhamento porque simula outro aplicativo; o editor de controles não justifica o mesmo nível.

**Solução**

- manter accordions, mas transformá-los em uma lista de seções com divisores;
- “Paletas” como escolhas visuais compactas, não cards completos;
- “Cores personalizadas” como opção avançada recolhida;
- feedback de contraste como texto/status inline, ampliado apenas em erro;
- autosave discreto no cabeçalho;
- preview com uma única moldura identificada; o conteúdo interno continua representando o aluno;
- em mobile, preview acessível por aba/ação “Visualizar”, em vez de sempre ocupar mais 353 px após um formulário longo;
- aplicar o tema somente ao preview e ao app do aluno, não ao painel inteiro.

### 4.8 Perfil do professor

**Problema**

Formulário, estado de login, preview do aluno, conta e métricas usam caixas de peso semelhante. Os dados de conta ficam visualmente próximos de configurações editáveis embora tenham funções diferentes.

**Solução**

- identidade/editáveis como seção principal;
- autenticação e plano como seções informativas compactas;
- métricas em linhas, sem caixas individuais;
- preview como inset único, se ainda tiver valor operacional;
- ação salvar como única primária; conta/sessão em região secundária.

### 4.9 Sidebar do professor

**O que funciona**

- modo recolhido economiza espaço;
- itens principais são estáveis;
- mobile mantém navegação separada do conteúdo.

**Problema**

- o tema do personal altera o chrome operacional;
- ícones recolhidos dependem muito de memória/tooltip;
- animação e expansão anteriores já mostraram que largura fluida pode deformar labels e componentes.

**Solução**

- sidebar pertence ao tema operacional neutro;
- manter largura fechada e aberta explícitas;
- label entra/sai por opacidade e deslocamento curto, sem reflow de texto durante a transição;
- áreas de ícone permanecem ancoradas;
- no mobile, preservar o comportamento atual de drawer/swipe sem transportar hover do desktop;
- item ativo usa uma única indicação forte, sem borda + fundo + texto + barra competindo.

---

## 5. Auditoria por área do aluno

### 5.1 Home

**O que funciona e deve ser referência**

- tarefa principal evidente;
- um card de treino com CTA claro;
- estatísticas secundárias agrupadas;
- pouca competição visual.

**Ajuste recomendado**

- preservar a estrutura;
- garantir que o tema sempre mantenha diferença entre hero, fundo e botão;
- evitar adicionar novos cards para informações que podem ser texto secundário.

### 5.2 Visão geral do treino

**Problema**

- nome/contexto do treino aparece na página e se repete no card de resumo;
- resumo contém chips, progresso e CTA dentro de uma grande superfície;
- cada exercício vira card independente;
- índice do exercício ganha outra caixa interna;
- a lista fica longa e fragmentada.

**Solução**

- transformar nome/objetivo em cabeçalho da página;
- progresso e CTA em um único bloco principal sem título duplicado;
- exercícios em uma lista agrupada com divisores;
- índice como texto alinhado, não tile, salvo para exercício atual/concluído;
- séries, reps e descanso em uma única linha de metadados;
- acento apenas no exercício atual e na ação principal.

### 5.3 Evolução

**Problema**

- gráfico, cada medida, linha do tempo, cada treino concluído e “novo check-in” recebem cards;
- medidas possuem tile de ícone dentro do card;
- status de séries recebe chip interno;
- em estado com poucos dados, o gráfico pode ser uma grande superfície vazia;
- bottom nav pode competir/encobrir o fim do histórico se o padding não acompanhar sua altura.

**Solução**

- gráfico só ocupa superfície grande quando existe visualização útil;
- medidas recentes em um grupo único com rows;
- linha do tempo como lista vertical simples;
- treinos concluídos em grupo único com divisores;
- check-in como CTA, não como outro card equivalente a conteúdo histórico;
- remover backgrounds de ícone quando o próprio ícone já comunica a categoria;
- calcular padding inferior pelo tamanho real da bottom nav + safe area.

### 5.4 Agenda do aluno

**Problema**

Cada evento reúne card externo, tile de ícone, chip de tipo e botão quadrado de estado. Quatro sinais visuais competem antes de o usuário ler título e horário. “Novo lembrete” também aparece como card, recebendo o mesmo peso de um evento existente.

**Solução**

- filtros como controle segmentado compacto;
- eventos em uma lista agrupada;
- tipo comunicado por um único recurso: ícone **ou** label sem caixa adicional;
- título e data dominam;
- ação de concluir/repetir permanece com hit target adequado, mas sem card interno;
- “Novo lembrete” como botão contextual da seção;
- avaliações/mensagens/treinos podem variar por ícone/cor sem criar layouts diferentes.

### 5.5 Perfil do aluno

**Problema**

Identidade, objetivo/status, personal e preferências são quatro cards equivalentes. Dentro deles, avatar, foto do personal e ações criam novos recortes. O personal, que pode ser uma entidade acionável, não se distingue claramente de dados estáticos.

**Solução**

- identidade como header, sem card externo;
- objetivo e status em lista de fatos;
- personal como único card independente/acionável, abrindo o popup de detalhes já previsto;
- preferências e conta como lista de configurações com divisores;
- ações “Restaurar” e “Sair” alinhadas ao papel, sem transformar a linha inteira em card adicional.

### 5.6 Bottom navigation

**O que funciona**

- navegação persistente e previsível;
- indicação ativa animada;
- adequada ao uso com uma mão.

**Problema**

A barra inteira é mais uma grande superfície arredondada presente em todas as telas. Em páginas que já contêm muitos cards, ela aumenta a sensação de camadas e pode cobrir conteúdo quando o espaço inferior é insuficiente.

**Solução**

- manter apenas uma superfície de navegação, sem bordas internas por item;
- usar ícone + texto + indicador como estados, não cards;
- garantir margem/safe area e padding de conteúdo calculados pela mesma variável;
- manter seleção com fill/acento e barra, mas evitar três indicadores simultâneos se um deles já for suficiente;
- preservar swipe como atalho, sem criar comportamento de carrossel.

### 5.7 Modo Treino

**Direção**

Não aplicar mecanicamente a regra de “lista agrupada” ao runner. Esta tela tem outra missão: reduzir decisões enquanto o aluno executa uma série.

Preservar:

- modo imersivo;
- exercício e série atual dominantes;
- controles grandes de carga/repetições;
- CTA inferior e swipe;
- progresso contínuo com marcadores.

Revisar apenas se algum elemento voltar a criar superfície sem função. Informações históricas devem continuar discretas e posteriores ao registro atual.

---

## 6. Design system proposto

### 6.1 Princípio central

> Personalização define identidade. O design system define legibilidade, prioridade, comportamento e segurança.

O fato de o personal poder mudar cores, fonte e raios torna o sistema de papéis **mais necessário**, não menos possível.

### 6.2 Tokens em três camadas

#### Camada 1 — primitivas

- escala neutra;
- cores de marca;
- escala tipográfica;
- escala de espaço;
- escala de raio;
- durações/easing.

Não devem ser usadas diretamente por features.

#### Camada 2 — semântica

- `page`;
- `surface-group`;
- `surface-inset`;
- `surface-overlay`;
- `text-primary`, `text-secondary`, `text-muted`;
- `border-subtle`, `border-strong`;
- `action-primary`, `action-secondary`;
- `selection`, `focus`;
- `success`, `warning`, `danger`, `info`.

#### Camada 3 — componentes/papéis

- page header;
- section header;
- grouped list;
- entity row;
- independent card;
- form row;
- toolbar;
- dialog;
- popover;
- bottom nav/sidebar;
- workout runner.

Features consomem esta camada, evitando montar aparência com primitivas soltas.

### 6.3 Orçamento de superfícies

Regra inicial verificável:

- uma superfície principal por seção;
- profundidade máxima padrão: 1;
- profundidade 2 apenas para preview/simulação, dialog ou componente interativo que realmente precise de inset;
- coleção de itens: uma superfície externa + divisores;
- métricas internas: texto/alinhamento/divisor, não cards;
- ícone interno: sem fundo por padrão;
- sombra: apenas overlay, navegação flutuante ou elemento sendo arrastado.

### 6.4 Taxonomia de componentes

| Papel | Tem fundo? | Tem borda? | Pode conter outra superfície? | Uso correto |
|---|---|---|---|---|
| Page canvas | página | não | sim | base da rota |
| Section | não por padrão | não | sim, uma | agrupamento por assunto |
| Group | sim, sutil | externa opcional | rows, não cards | listas e formulário agrupado |
| Row | herda | divisor opcional | não | aluno, treino, configuração |
| Inset | sutilmente diferente | opcional | não | preview/dado subordinado |
| Card | sim | opcional | não por padrão | entidade independente/acionável |
| Overlay | sim | opcional | conteúdo interno | dialog, popover, menu |

### 6.5 Regras para chips, ícones e métricas

#### Chip

Usar somente para:

- estado curto que precisa ser escaneado;
- filtro selecionável;
- categoria que participa de comparação.

Não usar para toda unidade, contagem ou metadado.

#### Ícone com fundo

Usar somente para:

- estado semântico;
- seleção;
- avatar/identidade;
- affordance que precise de área de toque.

Ícones decorativos e índices devem ficar sem tile.

#### Métrica

- valor domina, rótulo apoia;
- métricas relacionadas formam uma faixa/lista única;
- não criar um card por métrica;
- não mostrar métrica sem utilidade operacional.

### 6.6 Regras de ação

- uma primária por região;
- no máximo duas ações diretamente visíveis por item;
- restante no menu contextual;
- “Cancelar/voltar” não compete visualmente com “Salvar/publicar”;
- ações destrutivas isoladas;
- mobile mantém a primária perto do polegar, mas sem duplicá-la em header e rodapé;
- estado “Salvando…/Salvo” é feedback, não ação.

### 6.7 Densidade responsiva

Definir variantes explícitas:

- `comfortable`: formulários e edição;
- `compact`: listas operacionais desktop;
- `mobile-summary`: identidade + decisão + ação;
- `immersive`: Modo Treino.

Não calcular mobile apenas diminuindo gaps. Cada componente deve declarar quais dados permanecem, quais são resumidos e onde os demais ficam acessíveis.

---

## 7. Arquitetura de personalização recomendada

### 7.1 O que o personal pode controlar

- logo e avatar;
- nome e tagline;
- cor de marca/acento;
- modo/paleta dentro de limites;
- preset tipográfico;
- preset de raio;
- fundo decorativo do aluno;
- moldura da logo.

### 7.2 O que o produto deve controlar

- contraste mínimo;
- diferença entre níveis de superfície;
- cores de texto secundário;
- foco;
- estados semânticos;
- seleção;
- tamanhos de toque;
- estrutura dos componentes;
- quantidade de nesting;
- hierarquia de ações;
- comportamento responsivo;
- tema operacional do professor.

### 7.3 Derivação segura

Em vez de usar diretamente uma única `surfaceColor` para muitos contextos:

1. personal escolhe fundo, superfície base e acento;
2. sistema calcula `surface-group`, `surface-inset`, borda e hover;
3. sistema corrige luminância/croma quando a separação é insuficiente;
4. preview informa quando houve adaptação necessária;
5. temas canônicos extremos entram nos testes visuais.

### 7.4 Presets de raio

Continuar usando presets, com limites por papel:

- “Reto” não remove foco nem área de toque;
- “Suave” e “Arredondado” alteram superfícies e controles proporcionalmente;
- “Pill” só transforma controles/chips apropriados em cápsula;
- cards grandes nunca viram semicírculos porque o valor é limitado por papel;
- avatar e progress track continuam independentes.

---

## 8. Plano de correção recomendado

### P0 — Fundamentos e maiores riscos

- [ ] Documentar e aprovar a taxonomia Page / Section / Group / Row / Inset / Card / Overlay.
- [ ] Separar tema operacional do professor do tema de marca do aluno.
- [ ] Ampliar validação de tema para hierarquia, acento, muted, foco e estados.
- [ ] Definir orçamento de superfícies e nesting.
- [ ] Fazer o editor substituir a listagem durante a edição.
- [ ] Compactar itens mobile de Alunos e Treinos por prioridade de tarefa.
- [ ] Garantir uma ação primária inequívoca por contexto.

### P1 — Fluxos com maior acúmulo visual

- [ ] Achatar controles da página Aparência, preservando preview como exceção.
- [ ] Simplificar Agenda para lista semanal + regras + um preview inset.
- [ ] Achatar Perfil do professor e métricas.
- [ ] Converter Visão geral do treino do aluno em cabeçalho + progresso + lista agrupada.
- [ ] Converter Evolução em grupos com rows, sem card por registro.
- [ ] Converter Agenda do aluno em lista de eventos, reduzindo tile + chip + botão interno.
- [ ] Converter Perfil do aluno em header + listas, preservando o personal como entidade acionável.

### P2 — Consolidação e prevenção de regressões

- [ ] Inventariar componentes e mapear aliases antigos para a nova taxonomia.
- [ ] Dividir CSS de fundação, componentes, layouts e features.
- [ ] Remover overrides obsoletos após cada migração.
- [ ] Criar uma galeria interna de componentes vanilla com todos os temas/presets.
- [ ] Criar screenshots de regressão em 390, 768, 1366, 1440 e 1920 px.
- [ ] Testar temas escuro, claro, acento forte, baixo contraste, sharp e pill.
- [ ] Adicionar auditoria automatizada de overflow e nesting suspeito.
- [ ] Revisar textos corrompidos/encoding separadamente da hierarquia visual.

---

## 9. Sequência segura de implementação

1. Congelar novos componentes de superfície ad hoc enquanto a taxonomia é definida.
2. Criar tokens semânticos novos como aliases dos atuais, sem mudar a aparência.
3. Escopar o tema do aluno e estabilizar o painel do professor.
4. Criar os padrões `grouped-list`, `entity-row`, `form-section` e `inset-preview`.
5. Migrar uma tela de referência simples: lista de Alunos.
6. Validar desktop/mobile e ajustar os padrões.
7. Migrar o editor de treino estruturalmente.
8. Migrar Aparência e Agenda.
9. Migrar páginas do aluno, preservando Home e Modo Treino como referências especiais.
10. Remover CSS morto/duplicado somente após validar cada fluxo.

Essa ordem evita uma reescrita total e reduz a chance de trocar inconsistência antiga por inconsistência nova.

---

## 10. Critérios objetivos de aceite

### Hierarquia

- [ ] Em cinco segundos, um usuário consegue apontar a tarefa principal de cada tela.
- [ ] Existe no máximo uma ação primária por região.
- [ ] Seções são reconhecíveis sem depender de uma borda completa em cada uma.
- [ ] Metadados não têm mais peso que títulos/valores principais.
- [ ] Empty states não criam grandes caixas vazias sem função.

### Superfícies

- [ ] Nenhum card contém outro card, exceto preview/dialog documentado.
- [ ] Listas usam um contêiner + rows/divisores.
- [ ] Ícones não recebem tile decorativo por padrão.
- [ ] Métricas relacionadas não viram cards independentes.
- [ ] Sombras ficam restritas a overlays, navegação flutuante e drag ativo.

### Personalização

- [ ] O tema do aluno não prejudica o painel operacional do professor.
- [ ] Texto, muted, acento, borda, foco e estados passam pela matriz de contraste.
- [ ] Página, grupo e inset continuam distinguíveis em todas as paletas.
- [ ] Preset pill não cria semicírculos em componentes grandes.
- [ ] Preview representa fielmente o tema publicado.

### Responsividade

- [ ] Item mobile de aluno/treino apresenta somente os dados necessários para decidir a próxima ação.
- [ ] Editor mobile não aparece simultaneamente à listagem.
- [ ] Não há scroll horizontal em 390 px.
- [ ] Bottom nav não encobre o último conteúdo.
- [ ] Preview e configurações avançadas podem ser acessados sem uma página permanentemente gigantesca.

### Consistência

- [ ] Todo contêiner novo corresponde a um papel documentado.
- [ ] Estados hover, focus, selected, disabled e error são compartilhados.
- [ ] A mesma entidade usa o mesmo padrão entre listas equivalentes.
- [ ] CSS de feature não redefine tokens globais sem justificativa documentada.

---

## 11. Matriz problema → solução

| Problema observado | Causa sistêmica | Solução recomendada | Prioridade |
|---|---|---|---|
| Cards dentro de cards | ausência de limite de composição | orçamento de superfície e nesting máximo 1 | P0 |
| Tudo parece ter o mesmo peso | card usado para muitos papéis | taxonomia Section/Group/Row/Inset/Card | P0 |
| Tema bonito, mas ação pouco visível | acento e superfície livres sem validação hierárquica | derivação segura + matriz de contraste | P0 |
| Painel do professor muda com a marca | tema aplicado globalmente ao `:root` | separar tema operacional e tema do aluno | P0 |
| Editor parece colocado sobre a lista | editor é mais um card dentro da rota | modo de edição substitui a listagem | P0 |
| Cards mobile muito altos | colunas desktop apenas empilhadas | variante mobile-summary baseada em tarefa | P0 |
| Aparência extremamente densa | controle, seção, paleta e preview contornados | accordion plano + preview como única exceção | P1 |
| Agenda fragmentada | cada nível ganha contêiner próprio | lista semanal agrupada + preview inset | P1 |
| Evolução parece coleção de caixas | todo registro e CTA usam card | grupos únicos com rows/divisores | P1 |
| Evento do aluno tem tile + chip + ação em caixas | múltiplos sinais para a mesma informação | escolher um sinal dominante e remover invólucros | P1 |
| Perfil não mostra o que é acionável | blocos de mesmo peso | header + listas; personal como card independente | P1 |
| Muitos textos minúsculos | tentativa de fazer densidade caber | cinco papéis tipográficos e conteúdo mobile reduzido | P1 |
| Inconsistência reaparece após ajustes | CSS monolítico e overrides tardios | componentes por papel + remoção gradual de legado | P2 |
| Melhorias locais quebram outros temas | falta de matriz de regressão visual | temas canônicos × viewports em screenshots | P2 |

---

## 12. O que não fazer

- Não resolver apenas removendo todas as bordas: sem uma gramática nova, a interface vira uma massa sem agrupamento.
- Não reduzir fonte e padding para “caber”. Isso preserva a carga cognitiva e piora a leitura.
- Não criar mais variantes de card para cada página.
- Não transformar todo conteúdo complexo em drawer/bottom sheet no mobile.
- Não usar somente cor de acento para indicar estado; temas personalizados podem enfraquecê-la.
- Não reconstruir o Modo Treino usando a linguagem do painel administrativo.
- Não redesenhar todos os fluxos de uma vez sem primeiro estabilizar tokens e papéis.
- Não remover informações que dependem de backend apenas para deixar a tela vazia/limpa.
- Não inventar estados, métricas ou regras de produto para preencher hierarquia.

---

## 13. Conclusão

O FlowFit já possui componentes visualmente capazes e uma base de tokens razoável. A sensação de protótipo não vem principalmente da qualidade isolada dos componentes. Ela vem da falta de regras sobre **como eles se relacionam**.

O maior ganho não virá de desenhar cards mais bonitos. Virá de:

1. separar branding de estrutura operacional;
2. reduzir o número de superfícies que disputam atenção;
3. tornar espaço, tipografia e alinhamento responsáveis pela hierarquia;
4. usar cards somente para entidades independentes;
5. adaptar o conteúdo no mobile de acordo com a tarefa;
6. consolidar essas decisões em um contrato verificável.

Com essa base, a personalização deixa de ser um obstáculo ao design system. Ela passa a operar dentro de um sistema que protege legibilidade, coerência e prioridade — justamente o que permite oferecer variedade visual sem que cada tema pareça um aplicativo estruturalmente diferente.
