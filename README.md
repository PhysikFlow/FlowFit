# FlowFit

Base web, mobile-first e sem dependencias de framework para um produto de treino com app do aluno, painel do personal e caminho futuro para PWA/WebView.

## Estrutura

- `appAluno/`: primeira superficie funcional do produto.
- `appAluno/js/data/`: dados mockados usados pela demonstracao do aluno e repositorios de dados.
- `appAluno/js/core/`: adaptadores de plataforma, tema e estado local.
- `appProfessor/`: painel administrativo do personal.
- `supabase/schema.sql`: schema do backend Supabase para marca branca.
- `PLANEJAMENTO.md`: arquitetura, fases e criterios de evolucao.

## Estado atual do prototipo

- Entrada/onboarding mockado com nome, objetivo e frequencia salvos localmente.
- Navegacao mobile com Inicio, Treino, Evolucao, Agenda e Perfil.
- Central de notificacoes mockadas com lido/nao lido persistido localmente.
- Agenda com filtros, status pendente/concluido e criacao local de lembretes.
- Treino do aluno renderizado a partir de dados mockados.
- Treino publicado pelo professor salvo localmente e consumido pelo app do aluno quando a origem HTTP e a mesma.
- Registro de series, carga e repeticoes com persistencia local no navegador.
- Cronometro simples de descanso durante a execucao do treino.
- Conclusao de treino gerando historico local.
- Evolucao com check-in local de peso, cintura e braco, grafico e linha do tempo.
- Tema com cor de destaque, modo claro/escuro, nome da marca e frase curta configuraveis.
- Sincronizacao de marca branca entre o painel do professor e o app do aluno via Supabase, com fallback local.
- Preview estruturado no painel do professor antes de publicar um treino colado/digitado.
- Service Worker registrado apenas em navegador/PWA, nao em WebView/QML.
- Ajustes de responsividade e foco visivel para controles do prototipo mobile.

## Executar localmente

O app usa modulos JavaScript e Service Worker, por isso deve ser servido por HTTP:

```powershell
python -m http.server 8080
```

Depois abra:

- `http://localhost:8080/appAluno/`
- `http://localhost:8080/appProfessor/`

> Abrir o `index.html` diretamente ainda exibe a interface, mas recursos de PWA podem ficar indisponiveis.

## Sincronizacao de marca branca

O primeiro fluxo com dados reais e o tema: o personal edita nome, frase, cor e modo no `appProfessor` e o aluno ve a mudanca no `appAluno`.

### Modo local

Sem Supabase, tudo continua funcionando no mesmo navegador e mesma origem HTTP. O professor salva em `localStorage`; o app do aluno aplica o tema ao abrir ou ao receber o evento de storage.

1. Abra `http://localhost:8080/appProfessor/`.
2. Va em `Aparencia`.
3. Mude nome, frase, cor ou modo.
4. Clique em `Salvar e aplicar no app do aluno`.
5. Abra ou recarregue `http://localhost:8080/appAluno/`.

### Modo Supabase

1. Crie um projeto em <https://supabase.com>.
2. No SQL Editor, rode o conteudo de `supabase/schema.sql`.
3. Abra `appAluno/js/config.js`.
4. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
5. No `appProfessor`, salve a aparencia e aguarde o status de marca branca salva na nuvem.
6. Abra `appAluno/` para ver o tema aplicado.

> O `DEMO_COACH_ID` (`coach-demo`) isola o tenant enquanto nao existe login. Quando a autenticacao chegar, as policies de RLS devem ser trocadas por `auth.uid()` ou claims do JWT.

## Publicacao local de treinos

Sem backend, o painel do professor ja consegue publicar um treino no `localStorage` usando `flowfit.published-workouts`. O app do aluno tenta carregar o treino mais recente do aluno atual; se nao encontrar, usa o treino mockado original.

Para testar:

1. Sirva o projeto por HTTP.
2. Abra `http://localhost:8080/appProfessor/#workouts`.
3. Publique um treino para `Lucas Andrade`.
4. Abra ou recarregue `http://localhost:8080/appAluno/#workout`.

Isso e uma ponte temporaria de prototipo. No produto real, o mesmo contrato deve ser implementado por API/Supabase/Firebase.
