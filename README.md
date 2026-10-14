# Prisma

Aplicação web para operação de gabinete, gestão de agenda institucional, comunicação, briefings oficiais, ofícios e prestação de contas de equipe.

Apesar do nome do produto ser **Prisma**, a persistência atual não usa Prisma ORM. A camada de dados real é **Supabase PostgreSQL**, com autenticação Supabase, Row Level Security, buckets de arquivos e Edge Functions.

## Visão Geral

O Prisma organiza a rotina operacional e estratégica de gabinete em núcleos integrados:

- **Dashboard executivo** para leitura rápida de indicadores e atividades.
- **Agenda oficial global** com cadastro manual e sincronização externa via Google Apps Script.
- **Agenda de comunicação** para planejamento de pautas, publicações e métricas sociais.
- **Briefings táticos/oficiais** vinculados a eventos da agenda oficial ou criados de forma independente.
- **Ofícios** com protocolo, tramitação e histórico de ações.
- **Prestação de contas de assessores** com registros de campo, despesas, anexos e auditoria pela chefia.
- **Gestão de perfil e usuários internos** com cargos, unidade e módulos de acesso.

## Stack

- **Framework:** Next.js 16.1.6 com App Router.
- **Frontend:** React 19, TypeScript e Tailwind CSS 4.
- **UI:** Lucide React, FullCalendar e Tiptap.
- **Estado local/offline:** Zustand com persistência em IndexedDB via `idb-keyval`.
- **Banco, Auth e Storage:** Supabase (`@supabase/supabase-js` e `@supabase/ssr`).
- **Runtime server-side:** rotas `app/api/*` em Edge Runtime.
- **Integrações:** Google Apps Script, Meta Graph API, Apify e Supabase Edge Functions.
- **Deploy:** scripts para Next.js, Cloudflare/OpenNext e `next-on-pages`.

## Módulos Principais

### Agenda Oficial (`/pre-agenda` e `/agenda-oficial`)

Agenda institucional compartilhada. Pode receber eventos cadastrados manualmente ou sincronizados a partir de uma URL intermediária de Google Apps Script definida em `GOOGLE_APPS_SCRIPT_URL`.

Os eventos entram inicialmente na `/pre-agenda` e são organizados via drag-and-drop no cockpit `/agenda-oficial`. Eles são persistidos em `public.tasks` com `tipo_agenda = GLOBAL`, `registro_status = ativo`, `status = pendente` e, quando sincronizados, `google_event_id`.

### Agenda de Comunicação (`/agenda-comunicacao`)

Calendário estratégico para pautas, publicações e cobertura. Também usa `public.tasks`, isolando registros por `tipo_agenda = COMUNICACAO`.

Quando uma pauta publicada possui `post_url`, o frontend aciona a Edge Function `sync-instagram`, que busca métricas na Meta Graph API e complementa dados via Apify quando disponível. Thumbnails ficam no bucket público `thumbnails`.

### Briefings (`/briefings`)

Módulo de criação, edição, listagem e impressão de briefings. Um briefing pode ser:

- vinculado a um evento `GLOBAL` da agenda oficial por `agenda_id`;
- independente, usando título, data, hora e local próprios.

A impressão/PDF é feita por HTML/CSS com `window.print()`, preservando layout oficial e campos sigilosos quando aplicável.

### Ofícios (`/oficios`)

Sistema de protocolo e tramitação eletrônica. As tabelas `public.oficios` e `public.oficios_historico` mantêm os documentos e a linha do tempo de ações. Alterações relevantes registram histórico para auditoria.

### Prestação de Contas (`/agenda` e `/visao-geral`)

Usuários de assessoria registram atividades de campo em `public.relatorios_agenda`, com categorias canônicas:

- `atendimento`
- `reuniao`
- `visita`
- `representacao`

Despesas são tratadas como atributo numérico (`valor_gasto`) de qualquer registro, não como categoria operacional. Comprovantes são armazenados no bucket privado `comprovantes` e acessados por Signed URLs.

A rota `/visao-geral` oferece à chefia uma leitura auditável da equipe, com filtros, KPIs e exportação por impressão do navegador.

## RBAC e Rotas

A autenticação é obrigatória em todas as rotas privadas. O sistema combina sessão Supabase, perfil em `perfis_usuarios`, cargo funcional e módulos de acesso.

Regra de hierarquia: permissões de escrita (`*_editar`) implicam permissão de leitura (`*_ver`).

| Rota | Função | Acesso esperado |
| --- | --- | --- |
| `/login` | Autenticação e auto-cadastro | Público |
| `/dashboard` | Painel executivo | Usuário autenticado |
| `/pre-agenda` | Entrada de eventos e sync | `agenda_global_ver` ou `agenda_global_editar` |
| `/agenda-oficial` | Cockpit de fechamento | `agenda_global_ver` ou `agenda_global_editar` |
| `/agenda-comunicacao` | Calendário de comunicação | `agenda_comunicacao_ver` ou `agenda_comunicacao_editar` |
| `/briefings` | Briefings táticos/oficiais | `briefing_editar`, `agenda_comunicacao_ver` ou `agenda_comunicacao_editar` |
| `/oficios` | Protocolo e tramitação | Cargo `chefia`, `oficios_ver` ou `oficios_tramitar` |
| `/atendimentos` | Hub centralizador de casos | Usuário autenticado da mesma unidade |
| `/agenda` | Registro de campo | Cargo `assessoria` ou `chefia` |
| `/visao-geral` | Auditoria operacional | Cargo `chefia` ou `visao_geral_auditoria` |
| `/contatos` | Gestão de contatos e lideranças | Cargos `chefia`, `secretaria`, `comunicacao` ou `aniversariantes_gerenciar` |
| `/profile` | Perfil e gestão básica de usuários | Usuário autenticado |

## Modelo de Dados

Principais objetos do Supabase:

- `perfis_usuarios`: perfil principal de RBAC, cargo, unidade e módulos de acesso.
- `profiles`: dados complementares de perfil, nome e avatar.
- `tasks`: tabela central de agendas, pautas, publicações e eventos sincronizados.
- `task_assignments`: presença/check-in e autoatribuição de atividades.
- `briefings`: documentos de briefing vinculados ou independentes.
- `atendimentos`: hub central da arquitetura Hub-and-Spoke.
- `oficios`: documentos protocolados.
- `oficios_historico`: linha do tempo de tramitação dos ofícios.
- `relatorios_agenda`: registros de campo e prestação de contas.
- `logs_auditoria`: ações administrativas.
- `instagram_account_insights`: snapshots analíticos de audiência.

## Arquitetura Hub-and-Spoke

O Prisma evolui para uma arquitetura em que `public.atendimentos` atua como hub operacional de uma demanda, caso ou atendimento. Os demais objetos podem se conectar a esse hub:

- `tasks.atendimento_id`
- `briefings.atendimento_id`
- `oficios.atendimento_id`

Essa estrutura permite formar uma linha do tempo institucional com agendas, briefings, documentos, anexos e movimentações relacionadas ao mesmo atendimento.

## Multiunidade e Segurança

O isolamento multi-inquilino é baseado em `unidade_id`, com valores como `CG` e `DD`. A regra esperada é que dados de uma unidade não sejam lidos ou alterados por usuários de outra unidade, independentemente dos filtros visuais no frontend.

Cargos funcionais atuais:

- `chefia`
- `assessoria`
- `secretaria`
- `comunicacao`

Pontos importantes:

- RLS deve permanecer ativa e restritiva nas tabelas sensíveis.
- APIs com `SUPABASE_SERVICE_ROLE_KEY` precisam validar RBAC antes de operações privilegiadas.
- `tasks` deve respeitar `tipo_agenda`, `unidade_id` e módulos de acesso.
- `briefings`, `oficios` e `atendimentos` carregam dados sensíveis e exigem políticas explícitas.

## Estrutura do Projeto

```text
app/
  agenda/                 Registros de campo do assessor
  agenda-global/          Agenda oficial e sincronização Google
  agenda-comunicacao/     Calendário de comunicação
  api/                    Rotas server-side com validação de acesso
  briefings/              Gestão e impressão de briefings
  dashboard/              Painel executivo
  login/                  Autenticação
  oficios/                Protocolo e tramitação
  profile/                Perfil e gestão de usuários
  visao-geral/            Auditoria da chefia
components/               Componentes de UI e views compartilhadas
hooks/                    Hooks de autenticação, cargo e permissões
lib/                      Supabase, auth context, store, tipos e integrações
src/data/                 Dados estáticos de apoio
supabase/                 SQLs, migrations e Edge Functions
```

## 🧪 Ambiente de Testes e Demonstração (Quick Start em 1 Minuto)

> **Nota:** Este repositório é disponibilizado como referência técnica de engenharia, arquitetura e avaliação de fluxos para a comunidade GovTech.

Para rodar localmente sem precisar criar conta ou configurar banco de dados do zero:

### 1. Clonar e Instalar Dependências

```bash
git clone https://github.com/v1ktxrr/prisma-gabinete.git
cd prisma-gabinete
npm install
```

### 2. Copiar o Ambiente de Teste

O arquivo `.env.example` já vem pré-configurado com as credenciais da instância pública de demonstração (Sandbox):

```bash
cp .env.example .env.local
```

### 3. Iniciar o Servidor Local

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

### 🔑 Contas de Teste Pré-Configuradas

O ambiente sandbox já possui usuários criados para validação dos diferentes níveis de permissão e RBAC do sistema:

| Perfil / Cargo | E-mail de Acesso | Senha Padrão | Módulos e Visão |
| :--- | :--- | :--- | :--- |
| **Chefe de Gabinete** | `chefe@exemplo.com` | `Prisma@Temporaria123` | Visão Geral, Auditoria, Pautas e Aprovações |
| **Secretária Executiva** | `secretaria@exemplo.com` | `Prisma@Temporaria123` | Agenda Oficial, Briefings e Impressão |
| **Comunicação** | `comunicacao@exemplo.com` | `Prisma@Temporaria123` | Calendário de Pautas, Métricas e Redes |
| **Assessor de Campo** | `assessor@exemplo.com` | `Prisma@Temporaria123` | Registro de Campo e Prestação de Contas |
| **Cockpit de Root** | `admin@exemplo.com` | `Prisma@Temporaria123` | Console Administrativo (`/deviktor-sys`) |

---

### 4. Validar o Projeto

```bash
npm run lint
npm run build
```

Para build voltado a Cloudflare Pages:

```bash
npm run cloudflare-build
```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor local de desenvolvimento |
| `npm run build` | Executa build Next.js |
| `npm run start` | Sobe a build local |
| `npm run lint` | Executa ESLint |
| `npm run cloudflare-build` | Gera artefatos para Cloudflare Pages |
| `npm run deploy` | Build e deploy via OpenNext Cloudflare |
| `npm run graph` | Gera/atualiza o grafo de conhecimento e relatório do repositório (`Graphify`) |
| `npm run graph:update` | Atualização incremental rápida do grafo de conhecimento |

## Mapeamento de Arquitetura com Graphify

O repositório utiliza o **Graphify** ([Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)) para análise estática AST do código-fonte e mapeamento de dependências.

### Como Gerar / Atualizar o Grafo:
```bash
# Análise completa do código
.venv/bin/graphify extract . --code-only && .venv/bin/graphify cluster-only .

# Ou via atalho incremental
.venv/bin/graphify update .
```

Artefatos gerados no diretório `graphify-out/`:
- `GRAPH_REPORT.md`: Visão arquitetural em linguagem natural com hubs e comunidades de código.
- `graph.html`: Visualização gráfica e interativa para navegação via browser.
- `graph.json`: Grafo estruturado em JSON com nós e arestas de relacionamento.

## Documentação de Contexto

Os documentos abaixo detalham o estado técnico, decisões e próximos ciclos:

- `AGENTS.md`: orientações para agentes e desenvolvedores na fase Alpha 1.0.
- `VERSIONING.md`: classificação de versões do produto.
- `CHANGELOG.md`: histórico de marcos e releases.
- `PRD-Prisma-Atual.md`: visão retroativa do produto implementado.
- `spec.md`: especificação técnica do próximo ciclo.
- `PRISMA_ARCHITECTURE.md`: visão arquitetural e camadas do sistema.
- `PRISMA_MULTITENANCY_STRUCTURE.md`: isolamento multiunidade e RLS.
- `PRISMA_MODULAR_ACCESS_MATRIX.md`: matriz de rotas, cargos e módulos.
- `HANDOVER.md`: base de continuidade técnica.
- `COMMIT_PREP.md`: checklist de segurança, validação e commit.
- `relatorio_tecnico_gabinete_virtual.md`: histórico da evolução inicial do Gabinete Virtual.
