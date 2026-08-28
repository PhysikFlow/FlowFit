# Checklist — o que falta para o FlowFit ser um produto final

> Documento de produto criado em 26/08/2026. Diferentemente de `FLUXOS_ATUAIS_INCOMPLETOS.md`, esta lista inclui **novos módulos e capacidades** que ainda não existem. Não representa autorização automática para implementar tudo.

## Definição usada neste documento

“Produto final” significa um FlowFit comercialmente utilizável por personal e aluno, com operação diária, cobrança, suporte, privacidade, continuidade entre dispositivos e espaço seguro para atuação multiprofissional.

Não significa possuir toda funcionalidade vista em concorrentes. Plataformas atuais como ABC Trainerize, Everfit e TrueCoach convergem em treino, nutrição/hábitos, mensagens, agenda, progresso e pagamentos; isso serve como referência de cobertura, não como obrigação de copiar cada recurso.

## Legenda

- **Essencial**: necessário antes de vender o produto como solução completa.
- **Núcleo**: necessário para a proposta completa de acompanhamento, mas pode entrar depois de uma primeira versão comercial controlada.
- **Expansão**: aumenta mercado, retenção ou escala; não deve bloquear o núcleo.
- **SQL: sim**: provavelmente exige migration, RLS, RPC ou Storage. Nenhum SQL está sendo criado neste documento.
- `[ ]` significa não implementado ou ainda não validado.

## Regra crítica para Nutrição/Dieta

A Lei nº 8.234/1991 inclui atividades de assistência nutricional e dietética no campo profissional do nutricionista, e o CFN trata prescrição dietética como atividade privativa. Portanto, o FlowFit **não deve liberar para qualquer conta de personal um editor irrestrito de dieta individualizada**.

Antes de desenvolver o módulo:

- [ ] Obter revisão jurídica/profissional do escopo permitido para personal, nutricionista e equipe multidisciplinar.
- [ ] Criar papel específico de nutricionista, com CRN e situação de verificação.
- [ ] Separar orientação geral/hábitos de uma prescrição alimentar individualizada.
- [ ] Registrar autoria, habilitação, publicação e versão de cada plano alimentar.
- [ ] Não permitir que IA ou automação publique dieta, suplemento ou conduta clínica sem profissional habilitado e responsável.

Referências: [Lei nº 8.234/1991](https://www.planalto.gov.br/ccivil_03/leis/1989_1994/l8234.htm) e [pareceres do CFN sobre prescrição dietética](https://cfn.org.br/index.php/legislacao/pareceres/).

# Parte 1 — base obrigatória para operação comercial

## 1. Privacidade, LGPD e controle dos dados — Essencial

O FlowFit trata peso, medidas, lesões, dor, treino e futuramente alimentação. Dados referentes à saúde são dados pessoais sensíveis segundo a ANPD e precisam de salvaguardas adicionais.

### Transparência e consentimento

- [ ] Política de Privacidade específica e acessível antes do cadastro.
- [ ] Termos de Uso versionados.
- [ ] Registro de aceite com versão, data e usuário.
- [ ] Finalidade e base legal documentadas para cada categoria de dado.
- [ ] Consentimentos separados quando houver compartilhamento entre personal, nutricionista e outros profissionais.
- [ ] Aviso claro sobre o que fica local, o que vai para a nuvem e quem consegue visualizar.
- [ ] Canal de contato do controlador/encarregado.

### Direitos do titular

- [ ] Tela para solicitar cópia/exportação dos próprios dados.
- [ ] Correção de dados pessoais incorretos.
- [ ] Exclusão de conta com explicação do que será eliminado ou retido legalmente.
- [ ] Revogação de consentimentos opcionais.
- [ ] Histórico das entidades/profissionais com quem o dado foi compartilhado.
- [ ] Fluxo administrativo para responder solicitações e registrar o atendimento.

### Segurança

- [ ] MFA para admin e, preferencialmente, personal/nutricionista.
- [ ] Gestão de sessões e opção “sair de todos os dispositivos”.
- [ ] Auditoria de acessos e alterações em dados sensíveis.
- [ ] Storage privado com signed URLs para fotos, documentos e anexos pessoais.
- [ ] Política de retenção, backup e descarte.
- [ ] Plano de resposta a incidente e canal de reporte.
- [ ] Rate limiting e proteção contra abuso em login, convites, mensagens e uploads.
- [ ] Revisão periódica de RLS e testes de isolamento entre tenants.

SQL: **sim**, além de políticas operacionais e documentação. Referência: [direitos dos titulares e dados sensíveis — ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes).

## 2. Ciclo completo de conta e relacionamento — Essencial

### Personal

- [ ] Cadastro com verificação de email.
- [ ] Recuperação e troca de senha.
- [ ] Login social com tratamento de conta já existente.
- [ ] Perfil profissional e credenciais verificáveis.
- [ ] Escolha/alteração de plano comercial.
- [ ] Cancelamento da assinatura sem depender de suporte manual.
- [ ] Exportação dos alunos e conteúdos próprios.
- [ ] Encerramento da conta com tratamento de vínculos ativos.

### Aluno

- [ ] Convite, aceite e associação ao personal.
- [ ] Reenvio, expiração e revogação de convite.
- [ ] Conta vinculada a mais de um profissional sem mistura de dados.
- [ ] Saída voluntária de um vínculo sem excluir os demais.
- [ ] Solicitação para excluir a conta ou remover um vínculo.
- [ ] Troca de email com reverificação segura.
- [ ] Recuperação de acesso sem depender do personal.

### Profissional e aluno

- [ ] Estado claro do relacionamento: convidado, ativo, pausado, encerrado.
- [ ] Data de início e fim do acompanhamento.
- [ ] Histórico mínimo das mudanças de estado.
- [ ] Regra explícita sobre acesso a histórico depois do encerramento.

SQL: **sim** para ciclo de vínculo, auditoria e preferências que ainda não existirem.

## 3. Cobrança, contratos e acesso — Essencial para venda direta

### Produto comercial do FlowFit

- [ ] Planos, preços, limites e período de teste configuráveis.
- [ ] Checkout seguro por provedor de pagamento; nunca armazenar cartão no FlowFit.
- [ ] Assinatura recorrente.
- [ ] Webhooks idempotentes para pagamento aprovado, falho, estornado e cancelado.
- [ ] Fatura/recibo e histórico financeiro do assinante.
- [ ] Upgrade, downgrade, cupom e cancelamento.
- [ ] Período de tolerância e bloqueio baseados somente no estado confirmado pelo provedor.
- [ ] Reconciliação administrativa entre assinatura, pagamento e acesso.

### Cobrança do personal para o aluno

- [ ] Decidir se o FlowFit será apenas software do personal ou também intermediará cobrança ao aluno.
- [ ] Se habilitado: produtos/serviços, pacotes, recorrência, vencimento e recibos.
- [ ] Status financeiro explícito vindo do provedor; nunca inferido por datas locais.
- [ ] Cancelamento, reembolso e contestação.
- [ ] Relatório financeiro simples e exportável.
- [ ] Separação entre mensalidade de software e pagamento do serviço do personal.

SQL: **sim**, mais integração com provedor e tratamento fiscal/jurídico.

## 4. Operação, suporte e confiabilidade — Essencial

- [ ] Monitoramento de erros do frontend e das operações Supabase.
- [ ] Alertas para aumento de falhas de autenticação, publicação e sync.
- [ ] Logs correlacionáveis sem registrar dados sensíveis desnecessários.
- [ ] Pipeline de CI com testes, lint, contratos, migrations e build dos PWAs.
- [ ] Ambiente de staging separado da produção.
- [ ] Processo de migration com backup, rollback e verificação pós-deploy.
- [ ] Feature flags para módulos ainda não liberados.
- [ ] Página/canal de status e comunicação de incidente.
- [ ] Central de ajuda, contato com suporte e envio de diagnóstico com consentimento.
- [ ] Política de compatibilidade de navegador e versão mínima.
- [ ] Testes físicos recorrentes em Android e iOS.

SQL: **parcial**, dependendo de auditoria, suporte e feature flags.

# Parte 2 — módulos centrais do acompanhamento

## 5. Nutrição e alimentação — Núcleo multiprofissional

### 5.1 Papéis e habilitação

- [ ] Papel `nutritionist` separado de `coach` e `student`.
- [ ] Cadastro de CRN, região e situação de verificação.
- [ ] Aprovação/revisão administrativa da credencial.
- [ ] Permissões por ação: criar, revisar, publicar, visualizar e comentar.
- [ ] Personal sem habilitação limitado a hábitos gerais e acompanhamento permitido.
- [ ] Compartilhamento de dados somente com consentimento do aluno.
- [ ] Registro de responsável técnico em cada plano publicado.

### 5.2 Entrada e avaliação nutricional

- [ ] Questionário alimentar inicial.
- [ ] Preferências e aversões.
- [ ] Alergias e intolerâncias com destaque de segurança.
- [ ] Restrições culturais, religiosas e éticas.
- [ ] Rotina, horários e acesso a preparo de alimentos.
- [ ] Objetivo informado pelo aluno e objetivo definido pelo profissional.
- [ ] Histórico de dietas e relação com alimentação, quando apropriado.
- [ ] Condições clínicas, medicamentos e suplementos declarados.
- [ ] Encaminhamento/alerta para avaliação profissional quando necessário, sem diagnóstico automático.
- [ ] Consentimento específico para esses dados sensíveis.

### 5.3 Biblioteca alimentar

- [ ] Base de alimentos com fonte/licença conhecida.
- [ ] Porções, unidades domésticas e conversões.
- [ ] Macronutrientes e micronutrientes quando a licença permitir.
- [ ] Receitas com ingredientes, rendimento e porção.
- [ ] Alimentos/receitas personalizados pelo nutricionista.
- [ ] Busca, favoritos e itens recentes.
- [ ] Detecção de duplicatas e versionamento da base.
- [ ] Importação controlada sem depender de conteúdo sem licença.

### 5.4 Montador de plano alimentar — somente profissional habilitado

- [ ] Criar plano do zero ou por modelo.
- [ ] Definir vigência e dias da semana.
- [ ] Criar refeições e horários.
- [ ] Adicionar alimento, quantidade, unidade e observação.
- [ ] Definir opções equivalentes/substituições autorizadas.
- [ ] Diferenciar obrigação, sugestão e alternativa.
- [ ] Visualizar totais nutricionais conforme o plano é montado.
- [ ] Alertar alergia/restrição conflitante antes de publicar.
- [ ] Adicionar orientações gerais e hidratação.
- [ ] Salvar rascunho, revisar e publicar.
- [ ] Criar nova revisão sem alterar retroativamente a versão anterior.
- [ ] Escolher se a alteração vale agora ou em data futura.
- [ ] Exportar PDF identificado com profissional, CRN e versão.
- [ ] Arquivar/restaurar modelos e planos.

### 5.5 Experiência diária do aluno

- [ ] Tela “Alimentação de hoje” com refeições em ordem temporal.
- [ ] Abrir cada refeição sem carregar o plano inteiro novamente.
- [ ] Ver quantidades, observações e alternativas autorizadas.
- [ ] Marcar refeição como realizada, parcial ou não realizada.
- [ ] Registrar nota e foto opcional da refeição.
- [ ] Registrar água/hidratação sem transformar a tela em jogo obrigatório.
- [ ] Solicitar ajuste ao profissional sem alterar a prescrição por conta própria.
- [ ] Lembretes configuráveis e silenciáveis.
- [ ] Funcionamento offline para o plano vigente e fila de registros.
- [ ] Aviso claro quando uma nova revisão estiver disponível.
- [ ] Acessibilidade para unidades, tabelas e contraste.

### 5.6 Acompanhamento pelo profissional

- [ ] Linha do tempo de registros do aluno.
- [ ] Visão por refeição/dia/semana baseada em eventos reais.
- [ ] Comentários e feedback vinculados ao registro correto.
- [ ] Alertas objetivos, como alergia declarada ou plano expirado.
- [ ] Não classificar automaticamente o aluno como “desobediente”, “em risco” ou “baixa adesão”.
- [ ] Comparar versões do plano.
- [ ] Registrar consulta/revisão e próxima ação acordada.
- [ ] Exportar acompanhamento com consentimento.

### 5.7 Colaboração personal–nutricionista–aluno

- [ ] Convite de outro profissional para o caso.
- [ ] Escopo de acesso por domínio: treino, medidas, alimentação ou todos.
- [ ] Notas privadas do profissional separadas de mensagens ao aluno.
- [ ] Histórico de quem visualizou ou alterou dados sensíveis.
- [ ] Revogação de acesso sem apagar o histórico clínico/profissional exigido.
- [ ] Encaminhamento entre profissionais.

SQL: **sim, amplo**. Exige entidades de credencial, avaliação, alimentos/receitas, planos versionados, refeições, substituições, registros diários, comentários, consentimentos e auditoria, todas com RLS própria.

## 6. Anamnese, prontidão e avaliações — Núcleo

### Formulários

- [ ] Construtor de formulário pelo profissional.
- [ ] Modelos de anamnese e prontidão para atividade física revisados profissionalmente.
- [ ] Campos condicionais e obrigatórios.
- [ ] Termos e consentimentos com versão.
- [ ] Assinatura/aceite eletrônico quando juridicamente adequado.
- [ ] Respostas parciais e retomada.
- [ ] Revisão pelo profissional e pedido de complemento.

### Dados de saúde e segurança

- [ ] Lesões, limitações, cirurgias e condições declaradas.
- [ ] Medicamentos e restrições relevantes declaradas.
- [ ] Contato de emergência.
- [ ] Liberação médica anexável quando necessária.
- [ ] Alertas objetivos, sem diagnóstico ou recomendação médica automática.
- [ ] Visibilidade restrita e trilha de auditoria.

### Avaliação física

- [ ] Peso, altura e medidas configuráveis.
- [ ] Fotos de progresso privadas, com consentimento específico.
- [ ] Protocolos identificados em vez de cálculos opacos.
- [ ] Comparação entre avaliações.
- [ ] Observações do profissional.
- [ ] Agendamento da próxima avaliação.
- [ ] Exportação compartilhável pelo aluno.

SQL: **sim**, com cuidado especial por serem dados de saúde.

## 7. Mensagens e comunicação — Núcleo

### Conversa

- [ ] Thread privada por vínculo profissional–aluno.
- [ ] Texto, imagem, documento e áudio opcional.
- [ ] Estado enviado, entregue e falhou.
- [ ] Retry idempotente, sem mensagem duplicada.
- [ ] Indicador de não lidas.
- [ ] Busca e paginação do histórico.
- [ ] Resposta vinculada a treino, sessão, refeição ou avaliação.
- [ ] Bloqueio de anexos perigosos e limites de tamanho.

### Comunicação operacional

- [ ] Mensagem individual.
- [ ] Anúncio para grupo/turma sem expor destinatários.
- [ ] Mensagens agendadas.
- [ ] Modelos de mensagem reutilizáveis.
- [ ] Preferências de contato e horário silencioso.
- [ ] Email/push como transporte opcional; a conversa deve continuar íntegra no app.

### Central de notificações

- [ ] Eventos reais e IDs estáveis.
- [ ] Lida/não lida sincronizada.
- [ ] Deep link para o item correto.
- [ ] Preferências por categoria.
- [ ] Agrupamento para evitar spam.
- [ ] Push web somente após permissão contextual, nunca no primeiro carregamento.

SQL: **sim**, mais Storage privado e, se aprovado, serviço de push/email.

## 8. Agenda, reservas e presença — Núcleo

O editor de disponibilidade atual pode ser a base visual, mas ainda falta o fluxo operacional.

### Configuração do personal

- [ ] Tipos de atendimento, duração, local e modalidade.
- [ ] Disponibilidade recorrente e exceções.
- [ ] Intervalo, antecedência e capacidade.
- [ ] Atendimento individual ou em grupo.
- [ ] Regras de cancelamento/remarcação.
- [ ] Fuso horário consistente.

### Reserva pelo aluno

- [ ] Visualizar somente horários realmente disponíveis.
- [ ] Reserva direta ou solicitação, conforme a regra do período.
- [ ] Confirmação, recusa e lista de espera.
- [ ] Remarcação e cancelamento.
- [ ] Motivo opcional e política visível antes da ação.
- [ ] Lembretes e deep link para o compromisso.
- [ ] Link/local da sessão.

### Operação do personal

- [ ] Visão diária, semanal e lista.
- [ ] Criar reserva manual.
- [ ] Bloquear horário.
- [ ] Confirmar presença, falta ou cancelamento.
- [ ] Evitar dupla reserva por transação no backend.
- [ ] Histórico do compromisso.
- [ ] Integração com Google/Apple Calendar como expansão, não como fonte primária.

SQL: **sim**, com transação/RPC para reservar e impedir concorrência.

## 9. Hábitos, tarefas e metas — Núcleo

- [ ] Biblioteca de hábitos: hidratação, sono, mobilidade, passos e outros não clínicos.
- [ ] Hábito personalizado pelo profissional.
- [ ] Frequência, período, horário e unidade.
- [ ] Meta definida com o aluno, não imposta por default silencioso.
- [ ] Registro simples diário.
- [ ] Observação e motivo opcional.
- [ ] Lembretes configuráveis.
- [ ] Pausa, edição e encerramento do hábito.
- [ ] Visão de progresso baseada nos registros reais.
- [ ] Comentário do profissional.
- [ ] Não usar streak punitiva nem inferir “falta de comprometimento”.
- [ ] Relacionar hábito a um Programa sem torná-lo requisito para concluir treino.

SQL: **sim**.

## 10. Documentos e recursos — Núcleo

- [ ] Biblioteca privada do profissional.
- [ ] PDFs, vídeos, imagens e links.
- [ ] Pastas/tags e busca.
- [ ] Compartilhamento com um aluno, grupo ou Programa.
- [ ] Data de validade e revogação.
- [ ] Confirmação de leitura quando realmente necessária.
- [ ] Termos/documentos que exigem aceite separados de conteúdo informativo.
- [ ] Versionamento e auditoria.
- [ ] Limite de armazenamento por plano.

SQL: **sim**, mais Storage privado.

## 11. Treino e programação em nível de produto final — Núcleo

O FlowFit já possui um núcleo forte de criação, publicação e execução. Os itens abaixo completariam casos profissionais ainda não cobertos.

### Prescrição

- [ ] Blocos semânticos de aquecimento, principal e volta à calma.
- [ ] Superset, bi-set, tri-set e circuito como estrutura real, não apenas texto.
- [ ] Séries de aquecimento separadas das séries válidas.
- [ ] Faixa de repetições e carga alvo.
- [ ] Progressão planejada de carga/repetições/RIR.
- [ ] Deload e semanas de recuperação.
- [ ] Alternativas de exercício aprovadas pelo personal.
- [ ] Restrições por equipamento, ambiente ou lesão declarada.
- [ ] Notas do dia e instruções do Programa.

### Execução

- [ ] Trocar para alternativa permitida e registrar qual foi usada.
- [ ] Registrar técnica/observação por exercício.
- [ ] Marcar exercício como indisponível com motivo.
- [ ] Ajustar sessão excepcionalmente sem alterar o plano original.
- [ ] Histórico de cargas por exercício e recordes baseados em dados reais.
- [ ] Tratamento claro de treino parcial, cancelado e retomado.
- [ ] Acessibilidade e modo de baixa conectividade completos.

### Gestão pelo personal

- [ ] Comparar planejado versus executado.
- [ ] Revisar alerta de dor/desconforto no contexto da série.
- [ ] Responder ao aluno e registrar conduta.
- [ ] Editar alcance: uma sessão, futuras ou modelo, com preview do impacto.
- [ ] Encerrar/substituir uma atribuição sem apagar histórico.
- [ ] Biblioteca de exercícios próprios com revisão e arquivamento.

SQL: **provavelmente sim** para novos tipos estruturais e histórico; preservar compatibilidade com treinos antigos.

## 12. Progresso e relatórios — Núcleo

### Aluno

- [ ] Check-ins sincronizados entre dispositivos.
- [ ] Metas e medidas com unidade/configuração claras.
- [ ] Histórico de treino, nutrição e hábitos sem pontuação arbitrária.
- [ ] Comparação de períodos escolhidos pelo usuário.
- [ ] Fotos privadas e consentidas.
- [ ] Exportação dos próprios dados.

### Personal

- [ ] Visão por aluno com treino, check-in, mensagens e agenda.
- [ ] Pendência principal baseada somente em estados reais.
- [ ] Relatórios de execução, volume, frequência e respostas registradas.
- [ ] Filtros por período e Programa.
- [ ] Exportação em PDF/CSV.
- [ ] Nenhum rótulo de risco, atraso ou adesão sem regra explícita e auditável.

### Produto

- [ ] Métricas operacionais de uso sem expor conteúdo sensível desnecessário.
- [ ] Consentimento/base legal para analytics.
- [ ] Retenção e anonimização.

SQL: **sim** para check-ins e agregações que ainda não existirem.

# Parte 3 — expansão e escala

## 13. Equipes e atuação multiprofissional — Expansão

- [ ] Organização/academia como tenant.
- [ ] Dono, administrador, personal, nutricionista, recepção e somente leitura.
- [ ] Convite e remoção de membro.
- [ ] Permissões granulares por aluno e domínio.
- [ ] Transferência de carteira de alunos.
- [ ] Agenda compartilhada.
- [ ] Auditoria de ações da equipe.
- [ ] Cobrança por assento ou uso.

SQL: **sim, estrutural**.

## 14. Turmas, aulas e desafios — Expansão

- [ ] Cadastro de turma e capacidade.
- [ ] Matrícula/remoção de alunos.
- [ ] Agenda recorrente da turma.
- [ ] Presença.
- [ ] Treino/programa compartilhado com personalização individual opcional.
- [ ] Anúncios para turma.
- [ ] Desafio com regra transparente e dados escolhidos pelo aluno.
- [ ] Ranking somente quando apropriado e opt-in.

SQL: **sim**.

## 15. Automações — Expansão

- [ ] Gatilhos baseados em eventos reais: convite aceito, treino publicado, sessão concluída, formulário pendente, pagamento confirmado.
- [ ] Ação: enviar mensagem, atribuir formulário, liberar Programa ou criar tarefa.
- [ ] Preview da automação antes de ativar.
- [ ] Horário silencioso e limite de frequência.
- [ ] Log de cada execução.
- [ ] Idempotência e retry.
- [ ] Botão de pausar/desativar.
- [ ] Nunca inferir condição clínica, inadimplência ou desmotivação para disparar ação.

SQL: **sim**, possivelmente Edge Functions/filas.

## 16. Integrações — Expansão

- [ ] Calendário Google/Apple.
- [ ] Provedor de pagamento.
- [ ] Email transacional.
- [ ] Push web.
- [ ] Wearables/Health Connect/HealthKit somente após estratégia de consentimento e plataforma.
- [ ] Importação/exportação padronizada.
- [ ] Webhooks/API para clientes empresariais.
- [ ] Gestão e revogação de conexões pelo usuário.
- [ ] Monitoramento de falhas e reautorização.

SQL: **parcial**, além de serviços externos.

## 17. Internacionalização e acessibilidade — Expansão planejada desde o núcleo

- [ ] Texto preparado para tradução.
- [ ] Datas, horários, números e unidades por localidade.
- [ ] Quilos/libras e centímetros/polegadas sem corromper histórico.
- [ ] WCAG: teclado, leitor de tela, foco, contraste e redução de movimento.
- [ ] Tamanho de fonte ampliado sem clipping.
- [ ] Legendas/transcrição em mídias importantes.
- [ ] Linguagem simples em erros e consentimentos.

SQL: **parcial** para preferências do usuário.

# Parte 4 — jornadas que precisam funcionar de ponta a ponta

## Jornada A — vender e iniciar acompanhamento

- [ ] Personal escolhe plano e paga.
- [ ] Configura perfil e serviço.
- [ ] Cadastra/convida aluno.
- [ ] Aluno aceita termos e vínculo.
- [ ] Preenche anamnese e consentimentos.
- [ ] Personal revisa e cria a primeira programação.
- [ ] Ambos recebem confirmação e sabem a próxima ação.

## Jornada B — aluno treina e recebe acompanhamento

- [ ] Treino chega na data correta.
- [ ] Aluno executa offline/online sem perder séries.
- [ ] Sessão sincroniza uma única vez.
- [ ] Dor/feedback aparece para o personal correto.
- [ ] Personal revisa, responde e ajusta futuras sessões.
- [ ] Aluno vê a resposta e a nova prescrição.

## Jornada C — acompanhamento nutricional

- [ ] Aluno consente e escolhe/recebe profissional habilitado.
- [ ] Preenche avaliação nutricional.
- [ ] Nutricionista monta, revisa e publica plano versionado.
- [ ] Aluno acompanha o dia e registra refeições.
- [ ] Profissional revisa registros e responde.
- [ ] Nova versão entra em vigor sem apagar a anterior.
- [ ] Encerramento/revogação preserva limites legais e privacidade.

## Jornada D — agendar e comparecer

- [ ] Personal publica disponibilidade.
- [ ] Aluno escolhe horário válido.
- [ ] Backend impede concorrência.
- [ ] Reserva é confirmada e lembrada.
- [ ] Uma das partes remarca/cancela dentro da regra.
- [ ] Personal registra presença.

## Jornada E — cobrar e renovar

- [ ] Serviço/plano é contratado.
- [ ] Pagamento é confirmado por webhook.
- [ ] Acesso reflete o estado confirmado.
- [ ] Falha gera aviso e retry seguro.
- [ ] Cancelamento não apaga histórico.
- [ ] Dados financeiros podem ser conciliados e exportados.

## Jornada F — sair do produto

- [ ] Usuário cancela assinatura ou vínculo.
- [ ] Entende o que acontece com acesso e histórico.
- [ ] Exporta dados.
- [ ] Solicita exclusão quando aplicável.
- [ ] Revoga integrações e sessões.
- [ ] Recebe confirmação auditável.

# Parte 5 — decisões que precisam ser tomadas antes de implementar

- [ ] O cliente pagante é o personal, o aluno ou ambos?
- [ ] O FlowFit intermedeia pagamentos do serviço ou somente cobra o SaaS?
- [ ] Nutricionistas terão conta própria ou serão membros da equipe do personal?
- [ ] O aluno pode escolher profissional ou somente aceitar convite?
- [ ] Quais dados continuam acessíveis depois que um vínculo termina?
- [ ] Lembretes pessoais são privados do aluno ou compartilháveis?
- [ ] Mensagens terão retenção permanente ou prazo definido?
- [ ] Fotos de progresso podem ser usadas em comparação automática?
- [ ] A Agenda atende somente sessões individuais ou também turmas?
- [ ] Quais funcionalidades ficam em cada plano comercial?
- [ ] Quem é controlador e quem é operador dos dados em cada cenário?

# Parte 6 — impacto estimado de backend

| Módulo | Migration/RLS | Storage | Serviço externo provável |
| --- | --- | --- | --- |
| LGPD/consentimentos/auditoria | Sim | Exportações | Email/suporte |
| Cobrança | Sim | Recibos opcionais | Provedor de pagamento |
| Nutrição | Sim, ampla | Fotos/documentos privados | Base alimentar licenciada |
| Anamnese/avaliações | Sim | Documentos e fotos privadas | Assinatura, se adotada |
| Mensagens/notificações | Sim | Anexos privados | Push/email opcional |
| Agenda/reservas | Sim | Não essencial | Calendário opcional |
| Hábitos/metas | Sim | Não essencial | Push opcional |
| Documentos | Sim | Sim, privado | Antivírus/processamento |
| Treino avançado | Sim, aditiva | Mídia já existente | Nenhum obrigatório |
| Equipes/turmas | Sim, estrutural | Compartilhado por tenant | Nenhum obrigatório |

# Parte 7 — ordem recomendada de produto

## Etapa 1 — tornar o núcleo vendável e seguro

1. Resolver o checklist `FLUXOS_ATUAIS_INCOMPLETOS.md`.
2. LGPD, consentimentos, exportação/exclusão e auditoria.
3. Ciclo completo de conta, vínculo e isolamento.
4. Cobrança do SaaS.
5. Monitoramento, suporte e CI/CD.

## Etapa 2 — fechar o acompanhamento atual

1. Mensagens e notificações reais.
2. Anamnese e avaliações.
3. Check-ins sincronizados e relatórios.
4. Agenda/reservas.
5. Hábitos e tarefas.
6. Completar programação de treino.

## Etapa 3 — Nutrição segura

1. Validar escopo jurídico e profissional.
2. Criar papel/credencial de nutricionista.
3. Avaliação e consentimentos.
4. Biblioteca e montador versionado.
5. Experiência diária do aluno.
6. Acompanhamento e colaboração multiprofissional.

## Etapa 4 — escala

1. Equipes e organizações.
2. Turmas e desafios.
3. Automações.
4. Integrações e wearables.
5. Internacionalização.

# Referências de mercado e conformidade

- [ABC Trainerize — recursos](https://www.trainerize.com/features/): treino, nutrição, hábitos, metas e operação do coaching.
- [Everfit — comparação de recursos](https://everfit.io/how-we-compare/): tarefas/hábitos, mensagens, formulários, pagamentos, grupos e automações.
- [TrueCoach — visão do produto](https://truecoach.co/about/): programação, comunicação, nutrição, progresso e pagamentos.
- [Lei nº 8.234/1991](https://www.planalto.gov.br/ccivil_03/leis/1989_1994/l8234.htm): regulamentação da profissão de nutricionista.
- [CFN — pareceres](https://cfn.org.br/index.php/legislacao/pareceres/): posicionamento sobre prescrição dietética.
- [ANPD — perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes): dados pessoais sensíveis, bases legais e direitos dos titulares.
