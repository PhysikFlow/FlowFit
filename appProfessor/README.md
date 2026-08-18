# FlowFit Professor

Painel usado pelo personal para administrar alunos, publicar treinos e personalizar o app do aluno.

## Estado atual

- HTML, CSS e JavaScript puros.
- Navegação por hash.
- Login por email/senha ou Google, com validação do papel de professor.
- Alunos, convites, treinos e perfil sincronizados pelo Supabase.
- Logo e foto são otimizadas localmente e publicadas no Storage do Supabase; a cópia local permanece como fallback offline.
- Layout responsivo para desktop, tablet e celular, com navegação inferior no mobile.
- Tokens, componentes e ícones compartilhados com o `appAluno`.

## Áreas disponíveis

- Dashboard: indicadores, pendências e atividade recente.
- Alunos: cadastro, convite, importação e acompanhamento de execuções.
- Treinos: criação, edição, agendamento, publicação e arquivamento.
- Aparência: marca, cores, tipografia, formas, fundo, logo, foto e prévia do aluno.
- Perfil: informações profissionais, contato, CREF e uso do plano.

## Próximos passos naturais

1. Validar o fluxo autenticado completo com dados reais em celular e desktop.
2. Ampliar filtros e acompanhamento conforme o volume real de alunos crescer.
3. Automatizar cobrança e limites apenas depois de validar o produto principal.
