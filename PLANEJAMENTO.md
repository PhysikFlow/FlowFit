# FlowFit - Planejamento de longo prazo

## Visao do produto

Criar uma plataforma para personais e alunos que reduza o trabalho operacional do profissional. O mesmo front-end do aluno deve funcionar como site, PWA e, futuramente, dentro de um WebView/QML.

Os tres pilares do produto sao:

1. migracao sem retrabalho;
2. IA como assistente do personal;
3. gestao de treino e negocio em um unico lugar.

## Principios tecnicos

- **Web primeiro:** HTML semantico, CSS responsivo e JavaScript modular.
- **Sem acoplamento de plataforma:** recursos nativos passam por `Platform`, nunca por verificacoes espalhadas de `window.qt`, Android ou PWA.
- **Tema como dado:** cores, tipografia, raios e identidade visual sao tokens CSS. No futuro, o painel do professor salva uma configuracao de marca por conta.
- **Offline consciente:** o Service Worker e registrado apenas no navegador. No WebView, os arquivos locais dispensam cache de PWA.
- **Acessibilidade desde a base:** foco visivel, contraste, areas de toque e suporte a reducao de movimento.
- **Dados separados da interface:** os dados demonstrativos atuais serao trocados por repositorios/API sem reescrever os componentes.

## Arquitetura alvo

```text
FlowFit/
|-- appAluno/                # experiencia mobile do aluno
|   |-- css/                 # tokens, componentes e composicao das telas
|   |-- js/
|   |   |-- core/            # plataforma, tema, estado e futuramente API
|   |   |-- data/            # dados mockados e repositorios locais/Supabase
|   |   `-- app.js           # navegacao e interacoes da demonstracao
|   |-- index.html
|   |-- manifest.webmanifest
|   `-- sw.js
|-- appProfessor/            # painel administrativo (fase posterior)
`-- PLANEJAMENTO.md
```

Quando o produto crescer, cada dominio (`treinos`, `alunos`, `avaliacoes`, `financeiro`) deve receber seu proprio modulo de dados e interface. Um framework so deve ser introduzido quando a complexidade real justificar a migracao.

## Camada de plataforma

A interface chama uma API estavel:

```js
Platform.storage.get("theme");
Platform.notify("Treino concluido");
Platform.share({ title: "Meu treino" });
Platform.vibrate(40);
```

Hoje ela usa APIs do navegador. No WebView, uma implementacao QML podera substituir somente esse adaptador.

## Modelo de tema e marca branca

Os componentes consomem tokens semanticos, nunca cores de marca diretamente:

- `--color-accent`: cor principal configuravel;
- `--color-bg`, `--color-surface`: fundos do tema;
- `--color-text`, `--color-muted`: hierarquia de texto;
- `--radius-*`, `--shadow-*`: personalidade visual;
- `--brand-name`: mantido como dado JavaScript, nao embutido nos componentes.

O painel do professor futuramente controlara logo, nome, acento, modo claro/escuro, raio dos componentes e imagem de capa. A configuracao sera entregue ao app do aluno no login/bootstrap.

## Roadmap

### Fase 0 - Fundacao (entrega atual)

- shell mobile e navegacao principal;
- entrada/onboarding mockado com dados locais do aluno;
- tokens e componentes CSS reutilizaveis;
- troca de modo e cor de acento persistida localmente;
- dados mockados separados da interface;
- telas demonstrativas de inicio, treino, evolucao, agenda e perfil;
- registro local de series, carga, repeticoes, descanso, conclusao de treino e historico de sessoes;
- check-in local de evolucao com peso, cintura, braco, grafico e linha do tempo;
- central local de notificacoes com lido/nao lido;
- agenda local com filtros, status e criacao de lembretes mockados;
- perfil com objetivo/frequencia locais e identidade de marca configuravel;
- ajustes de responsividade, foco visivel e limpeza de textos para o prototipo mobile;
- adaptador navegador/WebView;
- painel do professor com publicacao local de treino para o app do aluno;
- repositorio local-first `flowfit.published-workouts` com sincronizacao Supabase opcional;
- schema Supabase inicial para `students`, `workout_plans` e `workout_exercises` com RLS de tenant demo;
- preview estruturado no painel do professor para conferir exercicios interpretados antes de publicar;
- manifest e Service Worker basicos.

### Fase 1 - MVP de treino

- autenticacao e convite do aluno;
- plano A/B/C/D com series, repeticoes, carga, RPE/RIR, descanso e observacoes;
- execucao guiada, cronometro, registro de carga, repeticoes e conclusao;
- historico de sessoes e sincronizacao offline;
- cadastro basico de aluno e biblioteca de exercicios no painel do professor.

### Fase 2 - Evolucao e relacionamento

- peso, medidas, fotos e avaliacoes;
- graficos de progressao e recordes;
- agenda, lembretes, avisos e chat;
- metas, sequencias e conquistas simples;
- notificacoes push com consentimento.

### Fase 3 - Migracao e IA

- importacao CSV/Excel e colagem de treino;
- pipeline de revisao antes de salvar dados importados;
- leitura de PDF e mapeamento assistido;
- criacao e alteracao de treinos por linguagem natural;
- alertas de estagnacao e sugestoes de progressao;
- trilha de auditoria: sugestoes de IA nunca alteram prescricao sem aprovacao do profissional.

### Fase 4 - Negocio do personal

- mensalidades, PIX, cartao recorrente e inadimplencia;
- agenda de avaliacoes e servicos;
- dashboards de receita, retencao e cancelamento;
- marca branca, dominio proprio e checkout;
- papeis e permissoes para equipes.

### Fase 5 - Ecossistema

- Apple Health, Health Connect/Google Fit, Garmin, Fitbit e Strava;
- cursos, lives, comunidade e area de membros;
- empacotamento WebView/QML e publicacao nas lojas;
- observabilidade, experimentos e automacoes de suporte.

## Entidades iniciais de dados

- `User`, `StudentProfile`, `CoachProfile`, `BrandTheme`;
- `Exercise`, `WorkoutPlan`, `WorkoutDay`, `ExercisePrescription`;
- `WorkoutSession`, `SetLog`, `PersonalRecord`;
- `Assessment`, `Measurement`, `ProgressPhoto`;
- `Conversation`, `Message`, `Notification`;
- `Subscription`, `Invoice`, `Payment`;
- `ImportJob`, `ImportReview`, `AiSuggestion`.

Toda entidade sincronizavel deve ter identificador estavel, `createdAt`, `updatedAt`, versao e estado de exclusao logica.

## Seguranca e saude

- separar dados por profissional/organizacao desde a primeira API;
- aplicar controle de acesso no servidor, nao apenas na interface;
- criptografar trafego e proteger fotos/avaliacoes com URLs temporarias;
- coletar somente dados necessarios e oferecer exportacao/exclusao (LGPD);
- tratar dieta, dor e lesao como fluxos que exigem responsabilidade profissional;
- manter logs de alteracoes em prescricoes e sugestoes de IA.

## Criterio para evoluir o appProfessor

O painel ja existe como esqueleto. A proxima evolucao deve priorizar fluxos verticais pequenos: detalhe do aluno, builder de treino, publicacao/sincronizacao e historico de alteracoes. Assim, ele cresce em torno de dados reutilizaveis e nao de telas soltas.
