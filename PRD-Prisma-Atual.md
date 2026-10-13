## 1. VISÃO GERAL DO PRODUTO

O sistema “Prisma” hoje é uma aplicação web Next.js para operação de gabinete, com seis núcleos funcionais implementados no código:

- Agenda oficial compartilhada, com sincronização externa e cadastro manual de compromissos.
- Agenda de comunicação, usada para planejar pautas e publicações.
- Briefings táticos/oficiais, vinculados a eventos da agenda oficial ou criados de forma independente, com impressão em layout oficial.
- Prestação de contas/registro de campo de assessores, com anexos e auditoria pela chefia.
- Gestão básica de perfil e criação de usuários internos com cargos e módulos de acesso.
- Contatos & Lideranças, reunindo aniversariantes, parceiros e lideranças regionais de todas as unidades, com importador em massa de planilhas.

Na prática, o produto atual não usa Prisma ORM; o nome do sistema é “Prisma”, mas a camada de dados real é Supabase. A evidência principal está em [package.json](package.json), [lib/supabase.ts](lib/supabase.ts), [app/dashboard/page.tsx](app/dashboard/page.tsx), [app/agenda-global/page.tsx](app/agenda-global/page.tsx), [app/briefings/page.tsx](app/briefings/page.tsx) e [app/agenda/page.tsx](app/agenda/page.tsx).

## 2. STACK TECNOLÓGICA E INFRAESTRUTURA

- Framework principal: Next.js 16.1.6 com App Router.
- Frontend: React 19.2.3, TypeScript, Tailwind CSS 4.
- UI/UX: FullCalendar, Lucide React, Tiptap rich text editor.
- Estado local/offline: Zustand com persistência em IndexedDB via `idb-keyval`.
- BaaS/Auth/DB: Supabase (`@supabase/ssr`, `@supabase/supabase-js`).
- Storage Supabase:
  - Bucket `comprovantes`: privado.
  - Bucket `thumbnails`: público.
- Edge/Server runtimes:
  - `middleware.ts` em edge.
  - Rotas `app/api/...` em edge.
  - Server Action para sincronização Google em [app/agenda-global/actions.ts](app/agenda-global/actions.ts).
- Integrações externas efetivas:
  - Google Agenda via `GOOGLE_APPS_SCRIPT_URL`, consumindo um Google Apps Script que retorna JSON.
  - Meta Graph API na Edge Function `sync-instagram`.
  - Apify na mesma Edge Function para complementar métricas de Instagram.
  - Google Maps via link de busca montado no frontend.
  - Geração de PDF de briefing via HTML + `window.print()`, não via biblioteca de PDF server-side.
- Deploy/build:
  - Scripts para Cloudflare/OpenNext e `next-on-pages`.
- Variáveis de ambiente observadas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ACCESS_TOKEN`
  - `GOOGLE_APPS_SCRIPT_URL`

Há um módulo de relatórios em código, mas não exposto por rota App Router atual: [components/views/relatorios-view.tsx](components/views/relatorios-view.tsx). Ele usa mocks de GA4/Meta em [lib/api-ga4.ts](lib/api-ga4.ts) e [lib/api-meta.ts](lib/api-meta.ts).

## 3. ARQUITETURA DE DADOS E ESTADO

Tabelas/view confirmadas no schema atual do projeto Supabase vinculado:

| Objeto | Papel no sistema | Colunas principais | FKs / unicidade / segregação |
|---|---|---|---|
| `perfis_usuarios` | Perfil principal de RBAC | `id`, `nome`, `cargo`, `unidade_id`, `modulos_acesso`, `criado_em`, `atualizado_em` | PK `id`; sem FK para `auth.users`; `cargo` enum: `chefe_gabinete`, `comunicacao`, `assessor`; `unidade_id` check: `CG` ou `DD`; `modulos_acesso` é `jsonb` |
| `profiles` | Perfil legado/público para nome/avatar | `id`, `nome`, `cargo`, `avatar_url`, `is_admin`, `created_at`, `updated_at` | PK `id`; sem FK para `auth.users`; usado por FKs de outras tabelas |
| `tasks` | Tabela central de agenda/pautas | `id`, `titulo`, `descricao`, `status`, `data_publicacao`, `data_inicio`, `data_fim`, `link_final`, `meta_media_id`, `created_by`, `created_at`, `updated_at`, `event_type`, `post_url`, `metrics_snapshot`, `tema`, `registro_status`, `google_event_id`, `unidade_id`, `tipo_agenda` | FK `created_by -> profiles.id`; PK `id`; índice único `google_event_id + unidade_id`; segregação: `tipo_agenda` (`GLOBAL`/`COMUNICACAO`), `unidade_id` (`CG`/`DD`), `registro_status` (`ativo`/`arquivado`), `event_type` enum, `status` enum |
| `task_assignments` | Check-in e autoatribuição de atividade | `id`, `task_id`, `user_id`, `activity_type`, `created_at`, `name` | FK `task_id -> tasks.id`; FK `user_id -> profiles.id`; unique `task_id + user_id + activity_type` |
| `briefings` | Documento de briefing | `id`, `agenda_id`, `organizacao`, `contato_local`, `traje`, `apoio_governo_ms`, `autoridades`, `cronograma`, `contexto_geral`, `destaques_ms`, `info_confidencial`, `criado_em`, `atualizado_em`, `blocos_customizados`, `titulo_customizado`, `data_customizada`, `hora_customizada`, `local_customizado`, `tipo_localidade`, `status` | FK `agenda_id -> tasks.id`; unique `agenda_id`; `agenda_id` é nullable; segregação: `tipo_localidade` (`INTERIOR`/`CAPITAL`), `status` (`RASCUNHO`/`FINALIZADO`) |
| `relatorios_agenda` | Prestação de contas/registro de campo | `id`, `user_id`, `data_evento`, `categoria`, `descricao_resolucao`, `valor_gasto`, `criado_em`, `atualizado_em`, `comprovantes_urls`, `unidade_id` | FK `user_id -> perfis_usuarios.id`; PK `id`; segregação: `unidade_id` (`CG`/`DD`); `categoria` enum: `atendimento`, `reuniao`, `despesa`, `visita_base`, `visita`, `representacao` |
| `logs_auditoria` | Log de ações administrativas | `id`, `acao`, `descricao`, `realizado_por`, `criado_em` | PK `id`; sem FK declarada para `realizado_por` |
| `aniversariantes` | Banco de contatos, lideranças e aniversariantes | `id`, `nome`, `cargo`, `dia`, `mes`, `telefone`, `cidade`, `municipio_id`, `unidade_id`, `criado_em` | PK `id`; FK `municipio_id -> municipios.id`; RLS global (leitura e escrita compartilhada para todos os usuários autenticados da plataforma) |
| `atendimentos` | Hub centralizador de casos e demandas | `id`, `data`, `titulo`, `status`, `unidade_id` | PK `id`; segregação estrita por `unidade_id` |
| `oficios` | Sistema de protocolo eletrônico | `id`, `atendimento_id`, `unidade_id`, `numero`, `titulo`, `destinatario`, `status`, `data_emissao` | PK `id`; FK `atendimento_id -> atendimentos.id`; segregação por `unidade_id` |
| `oficios_historico` | Linha do tempo de tramitação | `id`, `oficio_id`, `acao`, `criado_em` | PK `id`; FK `oficio_id -> oficios.id` |
| `instagram_account_insights` | Snapshot analítico de audiência Instagram | `id`, `fetched_at`, `total_followers`, `audience_city`, `raw_response`, `total_reach`, `audience_gender_age`, `impressions` | Sem FK |
| `v_calendario` | View derivada de `tasks` | `id`, `title`, `start`, `end`, `status`, `event_type`, `descricao`, `post_url`, `metrics_snapshot`, `tema` | View; não há uso ativo nas rotas atuais |

Colunas de segregação efetivamente usadas no código:

- `tasks.tipo_agenda`: isola agenda oficial (`GLOBAL`) e agenda de comunicação (`COMUNICACAO`).
- `tasks.unidade_id`: usada nos writes da agenda global e em algumas leituras globais antigas.
- `tasks.registro_status`: usado para excluir itens “arquivados” das listagens.
- `briefings.tipo_localidade`: muda o template visual de impressão.
- `briefings.status`: separa rascunho e finalizado.
- `relatorios_agenda.unidade_id`: filtra indicadores e auditoria por unidade.
- `perfis_usuarios.modulos_acesso`: RBAC por módulo.
- `perfis_usuarios.cargo`: RBAC por cargo.

Observações exatas do estado atual:

- O código referencia os módulos `agenda_global_ver`, `agenda_global_editar`, `agenda_global_presenca`, `agenda_comunicacao_ver`, `agenda_comunicacao_editar`, `usuarios_gerenciar` e `briefing_editar`.
- A UI/API de criação de usuário só permite atribuir os cinco módulos de agenda; `usuarios_gerenciar` e `briefing_editar` são honrados pelo sistema se já existirem no banco, mas não são oferecidos pelo fluxo atual de cadastro.
- `tasks.status` no banco aceita `pendente`, `agendado`, `publicado`, mas a UI atual trabalha só com `pendente` e `publicado`.
- `relatorios_agenda.categoria` no banco aceita `despesa` e `visita_base`, mas a UI atual só expõe `atendimento`, `reuniao`, `visita`, `representacao`.

## 4. MAPA DE NAVEGAÇÃO E RBAC (Role-Based Access Control)

Regra global:

- Todas as rotas, exceto `/login` e assets públicos, passam por autenticação Supabase no [middleware.ts](middleware.ts).
- A autorização fina é feita principalmente no frontend e nas rotas server-side, usando `perfis_usuarios.cargo` e `perfis_usuarios.modulos_acesso`.

### Rotas de página

| Rota | Função | Regra de acesso efetiva |
|---|---|---|
| `/login` | login e auto-cadastro | pública |
| `/` | controlador de entrada | autenticado; redireciona todos os cargos para `/dashboard` |
| `/dashboard` | painel de decisão | qualquer usuário autenticado |
| `/pre-agenda` | entrada de eventos e sync | autenticado + módulo `agenda_global_ver` |
| `/agenda-oficial` | cockpit de fechamento da agenda | autenticado + módulo `agenda_global_ver` |
| `/agenda-comunicacao` | calendário de comunicação | autenticado + módulo `agenda_comunicacao_ver` |
| `/briefings` | lista/edição de briefings | autenticado + um destes: `agenda_comunicacao_ver`, `briefing_editar`, `agenda_comunicacao_editar` |
| `/briefings/[id]/print` | impressão/PDF do briefing | mesma regra de leitura de `/briefings` |
| `/oficios` | sistema de protocolo e tramitação | autenticado + um destes: cargo chefia/assessoria/comunicacao ou módulos de ofício |
| `/atendimentos` | centralizador de casos e linha do tempo | autenticado (qualquer sessão válida vinculada à unidade) |
| `/agenda` | meus registros de campo | autenticado + cargo `assessor` |
| `/visao-geral` | auditoria do gabinete | autenticado + cargo `chefe_gabinete` |
| `/contatos` | contatos e lideranças | autenticado + um destes: cargo chefia/secretaria/comunicacao ou módulo `aniversariantes_gerenciar` |
| `/profile` | perfil do usuário | qualquer usuário autenticado |

### Regras adicionais observadas

- O sidebar só mostra `/visao-geral` para `chefe_gabinete`.
- O sidebar só mostra `/agenda` para `assessor`.
- O botão “Convidar integrante” em `/profile` só aparece com módulo `usuarios_gerenciar`.
- Em `/dashboard`, o layout de métricas “chefia” é ativado se o usuário for `chefe_gabinete` ou tiver `usuarios_gerenciar` ou `agenda_global_editar`.
- Inconsistência real:
  - O sidebar mostra `/agenda-comunicacao` para quem tem `agenda_comunicacao_ver` ou `agenda_comunicacao_editar`.
  - A página `/agenda-comunicacao` só aceita `agenda_comunicacao_ver`.

### Endpoints com controle de acesso próprio

| Endpoint | Regra |
|---|---|
| `/api/admin/create-user` | autenticado + `cargo === chefe_gabinete` |
| `/api/agenda-global/upsert` | autenticado + módulo `agenda_global_editar` |
| `syncGoogleAgendaAction()` | autenticado + módulo `agenda_global_editar` |
| `/api/briefings/upsert` `GET` | autenticado + leitura de briefing |
| `/api/briefings/upsert` `POST` | autenticado + escrita de briefing |

## 5. REGRAS DE NEGÓCIO E FLUXOS CORE (Implementados)

### 5.1 Autenticação e bootstrap de perfil

- O login usa Supabase Auth.
- O `AuthProvider` carrega sessão JWT e depois busca o perfil principal em `perfis_usuarios`; `avatar_url` vem separado de `profiles`.
- O auto-cadastro em `/login` cria usuário Auth com `user_metadata` padrão:
  - `cargo: assessor`
  - `unidade_id: CG`
  - `modulos_acesso: ["agenda_global_ver"]`
- A criação material de `profiles` e `perfis_usuarios` para auto-cadastro depende do trigger `handle_new_user()` em [supabase/fix_handle_new_user.sql](supabase/fix_handle_new_user.sql).

### 5.2 Agenda oficial e sincronização Google

- A sincronização não fala direto com Google Calendar SDK.
- O fluxo atual chama `GOOGLE_APPS_SCRIPT_URL`, espera um JSON de eventos, normaliza os campos e filtra apenas eventos futuros.
- Cada evento sincronizado vira/atualiza uma linha em `tasks` com:
  - `tipo_agenda = GLOBAL`
  - `event_type = agenda_oficial`
  - `status = pendente`
  - `registro_status = ativo`
  - `google_event_id`
  - `unidade_id`
- O upsert usa conflito `google_event_id, unidade_id`.
- A descrição oficial é montada em texto livre, prefixando `Local: ...` quando existir.
- O cadastro manual da agenda oficial usa `/api/agenda-global/upsert`, que sempre força `tipo_agenda = GLOBAL`.
- Os eventos entram inicialmente na `/pre-agenda` e são consolidados e organizados via drag-and-drop no cockpit `/agenda-oficial`.

### 5.3 Separação entre Agenda Global e Agenda de Comunicação

- As duas agendas compartilham a tabela `tasks`.
- O isolamento principal é `tasks.tipo_agenda`.
- Agenda Global:
  - escrita via rota server-side e server action.
  - grava `unidade_id`.
  - briefing só pode ser vinculado a eventos `GLOBAL`.
- Agenda de Comunicação:
  - escrita direta do cliente para `tasks`.
  - usa `tipo_agenda = COMUNICACAO`.
  - não grava `unidade_id` no fluxo principal.
- Em [components/views/calendario-view.tsx](components/views/calendario-view.tsx), a agenda de comunicação ainda sobrepõe eventos estáticos de 2026 vindos de [src/data/calendarioEstrategicoMS.ts](src/data/calendarioEstrategicoMS.ts).
- Quando um evento estático é arrastado no calendário, ele é convertido em registro real de `tasks` e o evento estático passa a ser ocultado localmente no navegador via Zustand/IndexedDB.

### 5.4 Briefings

- O módulo de briefing lê e grava via `/api/briefings/upsert`, não diretamente pelo client Supabase.
- Há dois modos:
  - briefing vinculado a evento da agenda oficial, usando `agenda_id`.
  - briefing independente, com `titulo_customizado`, `data_customizada`, `hora_customizada`, `local_customizado`.
- Se `agenda_id` existir, a API valida que o evento existe em `tasks` e que `tipo_agenda = GLOBAL`.
- Há no máximo um briefing por evento da agenda oficial por causa do unique em `briefings.agenda_id`.
- O conteúdo principal é salvo em `blocos_customizados` com flag `sigiloso`.
- A API também retroalimenta os campos legados `contexto_geral`, `destaques_ms`, `info_confidencial`.
- O overview de `/briefings` carrega:
  - até 60 eventos `GLOBAL` ativos a partir de 7 dias atrás.
  - até 100 briefings, ordenados por `atualizado_em`.
- O PDF não é gerado no backend:
  - a página `/briefings/[id]/print` monta HTML/CSS oficial.
  - `PrintTrigger` altera `document.title` e dispara `window.print()`.

### 5.5 Check-in, atribuição e status de pauta

- `task_assignments` é usado como registro de presença e também como autoatribuição de atividade.
- No check-in da agenda oficial, o sistema:
  - apaga eventual linha anterior do mesmo `task_id`, `user_id`, `activity_type = captacao`
  - insere uma nova linha com `name` e `user_id`
- No `TaskModal`, o usuário pode marcar atividades próprias:
  - `captacao`
  - `edicao`
  - `texto`
  - `publicacao`
- O dashboard conta “eventos participados” usando `task_assignments` com `activity_type = captacao`.

### 5.6 Pautas/publicações e métricas sociais

- A agenda de comunicação usa `TaskModal` para criar, editar e excluir `tasks`.
- Se a pauta for salva com `status = publicado` e tiver `post_url`, o frontend dispara `supabase.functions.invoke("sync-instagram")`.
- A Edge Function `sync-instagram`:
  - busca métricas na Meta Graph API
  - tenta complementar views/engajamento via Apify
  - faz merge dos dados
  - atualiza `tasks.metrics_snapshot`
  - salva thumbnail pública no bucket `thumbnails`
- Se a pauta publicada não tiver `post_url`, o modal permite upload manual de foto para `thumbnails` e grava `metrics_snapshot.local_thumbnail_url`.

### 5.7 Prestação de contas e auditoria operacional

- `/agenda` é o módulo pessoal do assessor, baseado em `relatorios_agenda`.
- O registro contém data, categoria, descrição e anexos.
- Anexos são enviados ao bucket privado `comprovantes`; abertura posterior usa signed URL.
- `/visao-geral` reaproveita o mesmo domínio de `relatorios_agenda`, mas para a chefia:
  - lista registros do próprio chefe
  - lista registros auditáveis da equipe
  - filtra por assessor, categoria e mês
  - calcula alertas operacionais
  - exporta via impressão do navegador

### 5.8 Gestão de usuários

- `/profile` permite ao usuário editar:
  - `profiles.nome`
  - `profiles.avatar_url`
  - `perfis_usuarios.nome`
- Cargo e unidade são apenas exibidos.
- A criação de usuário interno acontece em `/api/admin/create-user`.
- O endpoint:
  - exige que o chamador seja `chefe_gabinete`
  - cria usuário no Auth
  - faz upsert em `perfis_usuarios`
  - faz upsert em `profiles`
  - grava auditoria em `logs_auditoria`
- O fluxo atual de criação só aceita cargos `assessor` e `comunicacao`.

### 5.9 Estado e modo offline

- A agenda de comunicação usa cache persistido em IndexedDB com Zustand.
- Se a leitura de `tasks` falhar, a tela entra em modo offline e usa `eventsCache`.
- Em modo offline, criação, edição e drag-and-drop são bloqueados no frontend.

### 5.10 Estado real de segurança/autorização no banco

- `relatorios_agenda`, `perfis_usuarios`, `profiles` e `logs_auditoria` têm RLS ativa com políticas específicas.
- `tasks` e `task_assignments` têm RLS muito permissiva para usuários autenticados.
- `briefings` está sem RLS.
- Portanto, no estado atual, o controle fino de agenda/briefing depende fortemente de guardas de frontend e de endpoints server-side, não apenas de políticas de banco.
