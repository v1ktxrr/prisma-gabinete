# Changelog

Todas as mudancas relevantes do Prisma devem ser registradas neste arquivo.

O formato segue uma versao simples de changelog por marco, com foco em produto, seguranca, arquitetura e operacao.

## Alpha 1.2 - 2026-06-25

Refinamentos de UI/UX visual no portal e alinhamento de termos de comunicação.

### Incluido / Refatorado

- **Identidade Visual (Logo)**: Integração da logo oficial (`icone-prisma.png`) no cabeçalho do Menu Lateral (Sidebar) e no cabeçalho mobile (Header Mobile), unificando a marca do Prisma em todo o portal.
- **Rodapé Global**: Inclusão de rodapé padronizado (`© 2026 - Prisma App`) renderizado de forma fixa na base de todas as páginas internas da aplicação através do layout `AuthenticatedShell`.
- **Painel de Decisão (Dashboard)**: Renomeado o cartão de acesso rápido de "Atividades de Comms" para "Comunicação" para simplificar e tornar o termo mais institucional.
- **Módulo de Atendimentos (Hub centralizador)**: Criação de um módulo autônomo `/atendimentos` estruturado em Master-Detail para gerenciar casos e atendimentos do gabinete. Integra uma linha do tempo unificada que consulta e exibe de forma reativa Ofícios, Compromissos e Briefings do caso, oferecendo mecanismos de associação e desassociação (Link/Unlink) segura baseada na unidade do usuário.

## Alpha 1.1 - 2026-06-24

Refinamentos gerais na agenda oficial e no módulo de contatos, melhoria na integridade regional de aniversários e facilitação do fluxo de fechamento da agenda no cockpit.

### Incluido / Refatorado

- **Módulo de Contatos & Lideranças**: Refatoração completa e renomeação do diretório `/aniversariantes` para `/contatos` (rotas, componentes, sidebar e links).
- **Banco de Dados & Schema**: Adicionado o campo `cidade text` na tabela `public.aniversariantes` para segmentar os registros regionais.
- **Políticas Globais RLS**: Flexibilização de RLS na tabela `public.aniversariantes`, permitindo leitura e escrita globais para usuários autenticados autorizados, habilitando cooperação direta entre as unidades `CG` (Campo Grande) e `DD` (Dourados).
- **Filtros Regionais**: Adicionado filtro dinâmico de cidades (`filtroCidade`) no painel de contatos e no importador de planilhas.
- **Importador de Contatos**: Atualizado o pipeline de importação em lote (CSV/JSON/Planilha) para reconhecer e pré-visualizar opcionalmente a coluna de cidade.
- **Prevenção de Duplicados na Importação**: Implementada verificação programática client-side para evitar a inserção de contatos duplicados (com base em nome case-insensitive). Exibe um resumo pós-importação indicando a contagem de registros importados/ignorados e fornece um botão para baixar o log detalhado de duplicados em formato CSV.
- **Cockpit de Fechamento da Agenda**: Implementação de Drag-and-Drop no cockpit da rota `/agenda-oficial` para transicionar dinamicamente eventos entre "Agendas Confirmadas" (compromissos do titular) e "Acontecendo" (agenda do gabinete), atualizando o `event_type` em tempo real.
- **Visualização de Impressão**: Alteração na folha timbrada `/agenda-oficial/print` para agregar e imprimir os contatos aniversariantes e telefones de todas as unidades sem segregação local.

## Alpha 1.0 - 2026-05-29

Primeira versao do Prisma colocada no ar como aplicativo operacional para controle geral de gabinete politico.

### Incluido

- Dashboard executivo para leitura geral da operacao.
- Agenda oficial global com cadastro manual e sincronizacao externa via Google Apps Script.
- Agenda de comunicacao para planejamento de pautas e publicacoes.
- Briefings taticos/oficiais vinculados a agenda ou independentes.
- Modulo de oficios com protocolo, tramitacao e historico.
- Prestacao de contas de assessoria com registros de campo, despesas e comprovantes.
- Visao geral da chefia para auditoria operacional.
- Autenticacao via Supabase.
- RBAC por cargo e modulos de acesso.
- Estrutura multiunidade baseada em `unidade_id`.
- Supabase PostgreSQL como camada real de dados.
- Buckets para comprovantes e thumbnails.
- Edge Function `sync-instagram` para metricas sociais.

### Arquitetura

- App em Next.js 16 com App Router.
- Frontend em React 19, TypeScript e Tailwind CSS 4.
- Estado local/offline com Zustand e IndexedDB via `idb-keyval`.
- Rotas server-side em Edge Runtime para operacoes privilegiadas.
- Evolucao planejada para arquitetura Hub-and-Spoke com `public.atendimentos` como hub.

### Limitacoes Conhecidas

- Interface ainda passara por polimento visual.
- Algumas funcionalidades serao expandidas apos validacao com usuarios reais.
- Regras de negocio ainda podem ser refinadas durante a Alpha.
- A matriz de permissao deve continuar sendo revisada entre UI, APIs e RLS.
- Testes automatizados e processos de release ainda podem ser fortalecidos.

### Documentacao

- README atualizado para refletir a arquitetura e os modulos atuais.
- Criado `AGENTS.md` com orientacoes para agentes e desenvolvedores.
- Criado `VERSIONING.md` com classificacao de versoes do produto.
