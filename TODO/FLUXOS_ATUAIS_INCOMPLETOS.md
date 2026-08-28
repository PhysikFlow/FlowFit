# Checklist — lacunas dos fluxos atuais do FlowFit

> Auditoria de código em 26/08/2026. Esta lista registra somente lacunas em telas, ações e domínios que **já existem** no FlowFit. Não é um roadmap de novas funcionalidades.

## Como usar este documento

- `[ ]` significa que a lacuna continua presente.
- P0 indica risco de mistura, perda ou envio de dados para a conta errada.
- P1 indica que um fluxo já exposto ao usuário ainda não pode ser concluído ou corrigido adequadamente.
- P2 indica gestão incompleta, recuperação ausente ou validação necessária antes do deploy.
- Cada item só deve ser marcado depois de teste com o critério de aceite descrito.

## P0 — isolamento e segurança do estado local

### [ ] P0.1 Isolar todos os caches e filas por usuário/personal

Hoje algumas chaves são globais para a origem inteira, embora possam existir contas diferentes no mesmo navegador:

- `flowfit.programming.*` guarda modelos, programas, atribuições e filas sem namespace de `coachId`;
- `flowfit.professor.agenda.v2` guarda a agenda sem namespace de `coachId`;
- `flowfit.brand-assets` e `flowfit.theme` guardam aparência e imagens locais sem vínculo com a conta;
- `flowfit.students` e `flowfit.published-workouts` misturam registros de vários personals na mesma coleção; os registros possuem `coachId`, mas a hidratação inicial do painel não filtra antes de renderizar;
- o logout limpa o estado em memória, mas não separa essas coleções locais.

Risco concreto: ao sair da conta A e entrar na conta B no mesmo navegador, dados da conta A podem aparecer offline ou durante a hidratação. No domínio de Programas, um item pendente nem sequer carrega `coachId`, então há risco de ser sincronizado sob a conta B.

Subtarefas:

- [ ] Criar namespace local por `user.id`/`coachId` para Programas, Agenda, aparência e respectivas filas.
- [ ] Filtrar Alunos e Treinos pelo personal autenticado **antes** da primeira renderização, inclusive offline.
- [ ] Migrar com segurança as chaves legadas, sem atribuir automaticamente dado ambíguo à conta atual.
- [ ] Garantir que o logout não apague trabalho pendente da conta anterior e que a próxima conta não consiga vê-lo ou enviá-lo.
- [ ] Impedir que logo/foto pendente de um personal seja publicada no perfil de outro.
- [ ] Remover o uso de `DEMO_COACH_ID` como fallback em qualquer gravação autenticada de produção.

Critério de aceite:

- conta A cria dados offline e sai;
- conta B entra, inclusive offline, e não vê nem sincroniza nada de A;
- ao voltar para A, os dados pendentes reaparecem e sincronizam somente em A;
- o mesmo teste cobre alunos, treinos, modelos, programas, atribuições, agenda, tema, logo e foto.

Banco/SQL: **não deveria exigir migration**; é correção de escopo do cache e dos objetos locais.

Evidências principais:

- `appAluno/js/data/repositories/programming-repository.js`
- `appProfessor/js/screens/agenda/agenda-planner.js`
- `appProfessor/js/screens/appearance/local-assets-editor.js`
- `appAluno/js/core/theme.js`
- `appAluno/js/data/repositories/student-repository.js`
- `appAluno/js/data/repositories/workout-repository.js`
- `appProfessor/js/app.js`

## P1 — fluxos operacionais incompletos

### [ ] P1.1 Permitir editar o cadastro administrativo de um aluno

O painel cria ou atualiza um vínculo quando o personal informa novamente o mesmo email, mas a lista não oferece uma ação explícita de editar e não preenche o formulário com o aluno escolhido. Isso deixa nome original, email, objetivo e status difíceis de corrigir depois do cadastro.

- [ ] Adicionar “Editar aluno” ao menu contextual da linha.
- [ ] Abrir o formulário existente preenchido, sem criar outro componente paralelo.
- [ ] Preservar `id`, `coachId`, convite, `studentUserId` e nome de exibição definido pelo aluno.
- [ ] Atualizar somente o vínculo daquele personal.
- [ ] Exibir erro/pending e permitir retry como já ocorre no cadastro.

Critério de aceite: alterar nome, email, objetivo e status de um aluno existente não cria duplicata nem modifica o vínculo do mesmo usuário com outro personal.

Banco/SQL: **não**; os campos já existem em `students`.

Evidências: `appProfessor/index.html`, `appProfessor/js/screens/students/students-screen.js` e handler do formulário em `appProfessor/js/app.js`.

### [ ] P1.2 Tornar as atribuições de Programas gerenciáveis depois da aplicação

O personal consegue aplicar um Programa, e o domínio já possui `program_assignments` com status `scheduled`, `active`, `completed` e `cancelled`. Porém a interface mostra apenas uma contagem; não existe uma lista operacional das atribuições nem ação para abrir, acompanhar, tentar novamente ou cancelar uma atribuição.

- [ ] Exibir aluno, data inicial, estado e situação de sincronização de cada atribuição.
- [ ] Permitir abrir os treinos gerados pela atribuição.
- [ ] Expor retry para aplicação pendente/falha sem criar duplicatas.
- [ ] Expor cancelamento usando o estado `cancelled` já previsto no contrato.
- [ ] Definir antes da implementação, sem inferência, o que cancelar faz com sessões futuras já publicadas; não alterar histórico executado.

Critério de aceite: o personal identifica exatamente quem recebeu o Programa, consegue recuperar uma aplicação interrompida e não deixa atribuição órfã ou duplicada.

Banco/SQL: **provavelmente não**; o status e os IDs já existem. Confirmar se a política para treinos futuros cabe nos contratos atuais.

Evidências: `renderProgramCard()` em `appProfessor/js/app.js` e `normalizeAssignment()` em `appAluno/js/data/repositories/programming-repository.js`.

### [ ] P1.3 Persistir e permitir corrigir check-ins de Evolução

A tela de Evolução e o formulário “Novo check-in” existem, mas peso, cintura e braço são gravados somente em `Store.progressEntries` no aparelho. O usuário também não consegue editar ou excluir um lançamento incorreto.

- [ ] Criar persistência por aluno no Supabase com RLS coerente com o vínculo professor–aluno.
- [ ] Manter cache local e fila idempotente para uso offline.
- [ ] Restaurar os check-ins em outro dispositivo da mesma conta.
- [ ] Permitir editar/excluir um registro próprio com confirmação adequada.
- [ ] Decidir explicitamente se o personal pode visualizar essas medidas no Acompanhamento; não assumir compartilhamento silencioso.

Critério de aceite: criar offline, recarregar, reconectar, editar e abrir em outro dispositivo mantém uma única linha correta e pertencente ao aluno certo.

Banco/SQL: **sim, provavelmente**; não foi encontrado contrato persistente para medidas/check-ins. A migration deve ser separada, aditiva e acompanhada de RLS.

Evidências: `appAluno/js/screens/evolution/evolution-screen.js`, handler de `[data-progress-form]` em `appAluno/js/app.js` e `appAluno/js/core/store.js`.

### [ ] P1.4 Completar a Agenda do aluno que já expõe Treino, Mensagem e Avaliação

A Agenda já mostra filtros para Treino, Mensagem e Avaliação, mas `scheduleItems` é inicializado como array vazio. Na prática, somente treinos publicados e lembretes criados localmente conseguem aparecer; não há fonte real para Mensagem ou Avaliação.

- [ ] Criar uma fonte persistente para os tipos já exibidos na Agenda ou ligar esses tipos a um contrato existente.
- [ ] Manter treinos futuros vindos de `workout_plans` sem duplicá-los na nova fonte.
- [ ] Sincronizar lembretes pessoais entre dispositivos ou deixar explícito, por regra de produto, que são exclusivamente locais.
- [ ] Permitir editar e excluir lembretes pessoais; hoje só é possível dispensar/reativar.
- [ ] Preservar filtros, datas, estado vazio e funcionamento offline.

Critério de aceite: cada filtro visível pode receber dados reais; um lembrete digitado errado pode ser corrigido; o mesmo item não aparece duplicado depois de reconexão.

Banco/SQL: **sim** para Mensagem/Avaliação e sincronização de lembretes, salvo se um contrato existente for reutilizado após análise.

Evidências: `scheduleItems = []` em `appAluno/js/app.js`, `appAluno/index.html` e `appAluno/js/screens/agenda/agenda-screen.js`.

### [ ] P1.5 Ligar a Central de Notificações a eventos reais

A página, o contador, o estado lido/não lido e os botões de ação existem, mas `notificationItems` também é um array vazio fixo. Portanto nenhum evento real do produto chega à central.

- [ ] Definir os eventos atuais que geram aviso, limitados a fatos já existentes, por exemplo treino publicado/atualizado, item de agenda e falha de sincronização relevante.
- [ ] Criar repositório/fonte de leitura em vez de montar avisos estáticos na tela.
- [ ] Manter ID estável para que “lido” não volte a aparecer em todo refresh.
- [ ] Sincronizar o estado lido entre dispositivos se a notificação for dado de conta; caso contrário, documentar que é preferência local.
- [ ] Manter o botão do sino oculto quando realmente não houver itens.

Critério de aceite: publicar ou atualizar um fato elegível gera uma única notificação para o aluno correto, com ação que navega para o destino existente.

Banco/SQL: **provavelmente sim** para uma caixa de notificações persistente. Push notification do sistema operacional não é requisito deste item.

Evidências: `notificationItems = []` em `appAluno/js/app.js` e `appAluno/js/screens/notifications/notifications-screen.js`.

### [ ] P1.6 Fazer o perfil profissional preenchido pelo personal chegar ao app do aluno

A página Perfil afirma que nome, descrição, bio, cidade, CREF e contatos são dados exibidos também no app do aluno. Hoje a consulta do aluno busca somente `user_id`, `name` e `headline`, e o card “Seu personal” mostra apenas foto, nome e descrição curta. Bio, cidade, CREF, email público, WhatsApp e telefone são preenchidos e salvos, mas não possuem destino no app do aluno.

- [ ] Carregar os campos públicos somente para alunos realmente vinculados ao personal.
- [ ] Exibir os dados em uma visualização simples do personal, reutilizando o card/diálogo existente quando isso couber naturalmente.
- [ ] Transformar email/telefone/WhatsApp em ações somente quando o valor existir e for válido.
- [ ] Não expor email de login nem campos administrativos privados.
- [ ] Manter o seletor de personal funcionando quando houver mais de um vínculo.

Critério de aceite: o personal preenche um campo público, um aluno vinculado consegue vê-lo, um aluno não vinculado não consegue consultá-lo e campos vazios não deixam lacunas visuais.

Banco/SQL: **não esperado**; os campos já existem em `profiles`, mas as policies e a consulta vinculada precisam ser confirmadas antes de ampliar o `select`.

Evidências: formulário `[data-coach-profile-form]` em `appProfessor/index.html`, `renderCoachProfile()` em `appProfessor/js/app.js`, `fetchCurrentStudent()` em `student-repository.js` e card `[data-coach-card]` em `appAluno/index.html`.

### [ ] P1.7 Tornar a Agenda/Disponibilidade do personal recuperável em outra sessão

A área “Disponibilidade e regras” é funcional para editar semana, períodos e exceções, mas salva tudo apenas em `flowfit.professor.agenda.v2` e declara “neste dispositivo”. Mesmo antes de existir reserva online, uma configuração operacional do personal não deveria sumir ao trocar de navegador.

- [ ] Persistir disponibilidade, regras e exceções por `coachId`.
- [ ] Manter o autosave local-first com estado “Salvando/Salvo/Erro”.
- [ ] Reconciliar edição offline sem substituir silenciosamente uma versão mais nova.
- [ ] Restaurar a agenda em outro dispositivo do mesmo personal.
- [ ] Não criar fluxo de reserva nesta tarefa; a prévia atual pode continuar sem gerar reservas.

Critério de aceite: editar a semana no dispositivo A e entrar no dispositivo B recupera exatamente os mesmos períodos, regras e exceções, sem misturar contas.

Banco/SQL: **sim, provavelmente**; não foi encontrada tabela/RPC de disponibilidade. Exige migration e RLS separadas.

Evidências: `appProfessor/js/screens/agenda/agenda-planner.js`.

## P2 — recuperação e gestão do conteúdo existente

### [ ] P2.1 Permitir restaurar ou consultar Treinos arquivados

“Arquivar” já existe e remove o treino da lista, mas não há filtro/tela de arquivados nem ação de restaurar. Depois da confirmação nativa, o painel não oferece recuperação.

- [ ] Criar visualização/filtro de arquivados sem misturar com a lista ativa padrão.
- [ ] Permitir restaurar um treino quando o contrato e o vínculo ainda forem válidos.
- [ ] Preservar histórico do aluno em arquivamento e restauração.
- [ ] Trocar a confirmação nativa somente se isso puder reutilizar o diálogo padrão sem ampliar o escopo.

Banco/SQL: **não esperado**; `workout_plans.status = archived` já é usado.

Evidências: handler de `[data-workout-archive]` em `appProfessor/js/app.js` e `archivePublishedWorkout()`.

### [ ] P2.2 Permitir arquivar Modelos e Programas que não são mais usados

As bibliotecas permitem criar, editar, usar e duplicar, mas não expõem arquivamento. O repositório possui `removeTemplate()`/`removeProgram()` apenas localmente, enquanto a leitura remota já ignora status `archived`.

- [ ] Preferir arquivamento persistente a exclusão local destrutiva.
- [ ] Impedir arquivamento sem explicar dependências quando houver atribuições/sessões que usam o item.
- [ ] Preservar treinos já publicados e histórico.
- [ ] Oferecer restauração se o item arquivado continuar no banco.

Banco/SQL: **não esperado**; as tabelas já possuem `status`, mas é preciso confirmar RPC/RLS para a atualização.

Evidências: `renderProgrammingWorkspace()` em `appProfessor/js/app.js` e `programming-repository.js`.

### [ ] P2.3 Fazer a aba Rascunhos corresponder ao plural e ao uso entre dispositivos

A aba “Rascunhos” existe, porém há apenas uma chave local por personal e ela armazena um único editor. Não existe lista de vários rascunhos nem sincronização remota.

- [ ] Decidir e comunicar uma das duas regras: “um rascunho atual” ou biblioteca de múltiplos rascunhos.
- [ ] Se mantiver “Rascunhos”, permitir mais de um item com ID próprio.
- [ ] Permitir renomear, continuar e descartar explicitamente.
- [ ] Avaliar sincronização remota para continuidade entre dispositivos, preservando o salvamento local imediato.
- [ ] Manter a proteção já implementada para que abrir/editar um modelo não apague o rascunho independente.

Banco/SQL: **somente se** for aprovada sincronização remota/múltiplos rascunhos.

Evidências: `getWorkoutDraftStorageKey()` e ramo `workoutDomain === "drafts"` em `appProfessor/js/app.js`.

### [ ] P2.4 Dar resultado auditável à importação CSV de alunos

A importação descarta linhas inválidas e duplicadas durante o parsing/deduplicação e informa apenas quantos alunos foram sincronizados. Para um fluxo em lote, falta saber exatamente o que não entrou e por quê.

- [ ] Informar total lido, válido, atualizado, duplicado, inválido, sincronizado e pendente.
- [ ] Mostrar erros por linha sem expor dados de outros personals.
- [ ] Permitir retry apenas dos registros pendentes/falhos.
- [ ] Não importar novamente os registros já confirmados ao repetir o fluxo.

Banco/SQL: **não**.

Evidência: handler de `[data-student-import-form]` em `appProfessor/js/app.js`.

## Validação necessária antes de considerar os fluxos completos

### [ ] V1 Executar E2E autenticado com Supabase real

- [ ] professor cria/edita aluno e envia convite;
- [ ] aluno aceita e entra;
- [ ] professor publica treino individual e Programa;
- [ ] aluno executa, pausa, retoma, corrige e conclui;
- [ ] professor recebe sessão, séries e feedback;
- [ ] retry offline não duplica aluno, atribuição, treino ou sessão;
- [ ] duas contas de personal no mesmo navegador permanecem isoladas.

### [ ] V2 Validar PWA em dispositivos físicos

- [ ] Android/Chrome instalado;
- [ ] iPhone/Safari e PWA instalado;
- [ ] atualização de Service Worker sem ritual de limpar cache;
- [ ] retomada após background/inatividade;
- [ ] gestos sem conflito com bordas do sistema;
- [ ] upload/recorte de avatar, logo e foto;
- [ ] selects, diálogos, scroll interno e teclado virtual.

### [ ] V3 Atualizar documentação que ficou atrás do código

`README.md` e `PROJECT_GUIDE.md` ainda dizem que logo/foto do personal não usam Supabase Storage, embora o código atual já tenha upload e cache remoto. Revisar também as descrições antigas de histórico “local” e as migrations realmente obrigatórias.

## Não incluir automaticamente neste checklist

Os itens abaixo seriam novas decisões de produto, e não lacunas obrigatórias dos fluxos atuais:

- chat completo entre personal e aluno;
- pagamentos, cobrança e inadimplência calculada;
- marketplace de personals;
- nutrição/dieta;
- avaliações físicas completas além dos campos já expostos;
- reservas online na Agenda do personal;
- push notification nativa;
- alterações nos aplicativos nativos Android/iOS.

Se algum deles for aprovado futuramente, deve ganhar plano próprio, contrato de dados e validação de produto antes de entrar nesta lista.

## Ordem recomendada

1. P0.1 — isolamento por conta e migração segura dos caches.
2. P1.1 e P1.2 — gestão de alunos e atribuições já existentes.
3. P1.3 a P1.7 — completar dados públicos e substituir estados locais/vazios por persistência real, uma migration por domínio quando necessária.
4. P2.1 a P2.4 — recuperação, arquivamento, rascunhos e auditoria da importação.
5. V1 a V3 — validação autenticada, dispositivos físicos e documentação.
