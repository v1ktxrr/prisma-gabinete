# HANDOVER - Projeto Gabinete Virtual

Este documento serve como a base de conhecimento técnica para a continuidade do desenvolvimento do Gabinete Virtual.

## Índice de Handovers Ativos
Para trabalhar em módulos específicos, consulte os seguintes documentos de contexto técnico detalhados:

| Módulo / Funcionalidade | Arquivo de Handover | Última Atualização | Status |
| :--- | :--- | :--- | :--- |
| **Geral / Contatos / Cockpit / Atendimentos / Briefings** | [HANDOVER.md](./HANDOVER.md) | 2026-07-04 | Estável |
| **Cockpit de Root (/deviktor-sys)** | [HANDOVER_COCKPIT_ROOT_DEVIKTOR.md](./HANDOVER_COCKPIT_ROOT_DEVIKTOR.md) | 2026-06-12 | Estável |
| **Relatórios de Comunicação** | [HANDOVER_RELATORIOS_COMUNICACAO.md](./HANDOVER_RELATORIOS_COMUNICACAO.md) | 2026-06-12 | Estável |
| **Sincronização Google Agenda** | [HANDOVER_SINCRONIZACAO_GOOGLE_AGENDA.md](./HANDOVER_SINCRONIZACAO_GOOGLE_AGENDA.md) | 2026-06-15 | Novo / Em validação |

---

## 1. STACK TECNOLÓGICA
O projeto utiliza uma stack moderna focada em performance, tipagem rigorosa e facilidade de deploy:

- **Framework**: Next.js 16.1.6 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS 4 (com processamento via PostCSS)
- **Componentes UI**: Shadcn/UI (baseado em Radix UI e Lucide React)
- **Banco de Dados & Auth**: Supabase (utilizando `@supabase/ssr` para gestão de sessões)
- **Estado Global**: Zustand (ver `lib/store.ts`)
- **Planilhas**: xlsx (para importação de contatos)
- **Calendário**: FullCalendar React
- **Deploy**: Otimizado para Cloudflare/Vercel (ver `wrangler.jsonc` e `open-next.config.ts`)

---

## 2. ARQUITETURA DO BANCO DE DADOS (Supabase)
O banco está estruturado para suportar o controle hierárquico, isolamento multiunidade e compartilhamento de contatos:

### Tabela: `perfis_usuarios`
Armazena os dados complementares dos usuários autenticados.
- `id`: `uuid` (PK, vinculada a `auth.users`)
- `nome`: `text` (Nome completo ou institucional)
- `cargo`: `text` (Valores: `'chefia'`, `'assessoria'`, `'secretaria'`, `'comunicacao'`, `'super_admin'`)
- `unidade_id`: `varchar(2)` (Valores: `'CG'` - Sede Central, `'DD'` - Sede Regional)
- `modulos_acesso`: `jsonb` (Módulos atribuídos ao usuário)

### Tabela: `tasks`
Tabela unificada de compromissos da agenda e atividades de comunicação.
- `id`: `uuid` (PK)
- `titulo`: `text`
- `descricao`: `text`
- `status`: `text` (Valores: `'pendente'`, `'publicado'`)
- `tipo_agenda`: `text` (Valores: `'GLOBAL'`, `'COMUNICACAO'`)
- `event_type`: `text` (Valores: `'agenda_oficial'`, `'acontecendo'`, `'aniversario_cidade'`, `'data_comemorativa'`, `'diversos'`)
- `unidade_id`: `varchar(2)`
- `google_event_id`: `text`
- `is_agenda_oficial`: `boolean` (Define se está consolidado na folha oficial)
- `municipio_id`: `uuid` (FK, `public.municipios(id)`)
- `atendimento_id`: `uuid` (FK, `public.atendimentos(id) ON DELETE SET NULL`)

### Tabela: `aniversariantes` (Módulo de Contatos)
Lista de contatos, lideranças políticas e aniversariantes compartilhada.
- `id`: `uuid` (PK)
- `nome`: `text` (Nome completo)
- `cargo`: `text` (Cargo ou função pública)
- `dia`: `integer` (Dia de aniversário: 1 a 31)
- `mes`: `integer` (Mês de aniversário: 1 a 12)
- `telefone`: `text` (Número de telefone)
- `cidade`: `text` (Cidade de atuação - texto legado)
- `municipio_id`: `uuid` (FK, `public.municipios(id)`)
- `unidade_id`: `varchar(2)` (Identificação da unidade de cadastro inicial)
- `criado_em`: `timestamptz`

### Tabela: `municipios`
Eixo de padronização geopolítica dos 79 municípios de Mato Grosso do Sul.
- `id`: `uuid` (PK)
- `nome`: `text` (Nome oficial)
- `codigo_ibge`: `varchar(7)` (Código de 7 dígitos único do IBGE)
- `criado_em`: `timestamptz`

### Tabela: `demandas`
CRM para controle de demandas políticas regionalizadas e promessas do gabinete.
- `id`: `uuid` (PK)
- `atendimento_id`: `uuid` (FK, `public.atendimentos(id) ON DELETE CASCADE`)
- `municipio_id`: `uuid` (FK, `public.municipios(id) ON DELETE RESTRICT`)
- `solicitante`: `text`
- `descricao`: `text`
- `status`: `text` (Valores: `'em_andamento'`, `'entregue'`, `'negado'`)
- `unidade_id`: `varchar(2)`
- `criado_em`: `timestamptz`
- `atualizado_em`: `timestamptz`

### Regras de RLS (Row Level Security)
- **Agenda/Tarefas/Relatórios/Demandas**: Isolados rigorosamente por `unidade_id` (a menos que ignorado via service role em scripts autorizados).
- **Contatos (Tabela `aniversariantes`)**: Compartilhada globalmente. Qualquer usuário autenticado pode ler, inserir, atualizar ou excluir registros (`USING (true)` / `WITH CHECK (true)`), permitindo que contatos de CG e DD sejam gerenciados de forma centralizada.

---

## 3. REGRAS DE NEGÓCIO E RBAC
O sistema é blindado por uma estrutura de 3 camadas de segurança:

1. **Middleware (`middleware.ts`)**: Intercepta as rotas do portal e valida a sessão JWT do cookie via Supabase SSR localmente (usando `getSession()` para evitar latência de rede). Acesso exclusivo para cockpit de root `/deviktor-sys` é blindado por whitelist de emails e validações de IP/Cloudflare Access.
2. **Auth Context (`lib/auth-context.tsx`)**: Centraliza o estado do usuário, perfil e cargo (`chefia`, `assessoria`, `secretaria` etc.).
3. **Módulos de Acesso**: Permissões baseadas em flags de strings (ex: `aniversariantes_gerenciar` para gerenciar contatos).

---

## 4. ESTADO ATUAL DAS TELAS E FLUXOS

### `/pre-agenda` (Antiga Agenda Global)
- **Objetivo**: Entrada bruta de eventos sincronizados do Google Agenda e inseridos manualmente (com `status = 'pendente'` por padrão).
- **Fluxo**: Eventos ficam pendentes até que o operador confirme no cockpit de fechamento da agenda.

### `/agenda-oficial` (Cockpit de Fechamento)
- **Funcionalidade**: Consolidação visual da agenda para o dia seguinte.
  - Painel esquerdo: Inbox com eventos pendentes da Pré-Agenda. Confirmação rápida envia para a agenda oficial.
  - Painel direito: Divisão em duas colunas de compromissos ("Agendas Confirmadas" - Preto e "Acontecendo" - Azul) e painel de aniversariantes do dia.
  - **Drag-and-Drop**: Permite arrastar eventos livremente entre a coluna Preta (compromissos do titular) e Azul (eventos de gabinete ocorrendo sem o titular), persistindo a alteração de `event_type` (`'agenda_oficial'` ou `'acontecendo'`) em tempo real no banco.
  - Impressão oficial formatada (/agenda-oficial/print) gerando folha timbrada limpa e elegante contendo compromissos, acontecimentos e aniversariantes (com telefones ao lado se cadastrados).

### `/contatos` (Antiga aba de Aniversariantes)
- **Acesso**: Restrito aos cargos `chefia`, `secretaria`, `comunicacao` ou assessores com o módulo `aniversariantes_gerenciar`.
- **Funcionalidades**:
  - Busca por nome, cargo, telefone ou cidade.
  - Filtro por Mês do Aniversário e filtro rápido por Cidade (gerado dinamicamente das cidades cadastradas).
  - CRUD manual completo integrado com campos de telefone e cidade.
  - **Importação Planilha**: Aceita copiar e colar texto ou upload de CSV/JSON. Possui pré-visualização em tabela de 5 linhas e importação em massa estruturada com suporte aos formatos seriais do Excel e data string.

### `/atendimentos` (Módulo de Gestão de Casos e Atendimentos)
- **Objetivo**: Eixo centralizador (Hub) de demandas, conectando outros módulos (Spokes) a casos operacionais em uma linha do tempo única.
- **Acesso**: Permitido a todos os cargos autenticados (`chefia`, `secretaria`, `comunicacao`, `assessoria`), pois qualquer perfil de gabinete precisa monitorar ou vincular recursos em casos de sua respectiva unidade.
- **Funcionalidades**:
  - Layout Master-Detail premium com filtros rápidos por status e campo de busca.
  - Seletor rápido de status do caso com sincronização no banco.
  - Linha do tempo unificada exibindo Ofícios, Compromissos de Agenda e Briefings vinculados ao caso selecionado.
  - Associação reativa de Spokes (Link/Unlink), filtrando itens não vinculados da mesma unidade.
  - **Aba de Demandas**: Controle de promessas e demandas locais, com suporte a criação, atualização rápida de status e exclusão.
  - **Alertas Reativos**: Exibição de banners de alerta (CRM) se o município selecionado (no cabeçalho do atendimento ou durante o formulário de cadastro) contiver demandas com status "Em andamento" daquela unidade.
  - **Componente Reutilizável**: Criado o componente [CRMAlertBanner](components/ui/crm-alert-banner.tsx) para centralizar a renderização de avisos regionais do CRM em formulários (TaskModal, BriefingForm) e listagens (Atendimentos).
  - **Geração Automática de Atendimentos**: Integração de fluxos que criam e vinculam automaticamente Atendimentos a partir de novos agendamentos na Agenda Oficial, Briefings e Ofícios, agilizando a vinculação de Spokes.

### `/briefings` (Módulo de Briefings de Agenda e Impressão)
- **Objetivo**: Elaboração e visualização de pautas, dados logísticos e roteiros para suporte às agendas do titular.
- **Acesso**: Usuários com permissões de `agenda_comunicacao_ver`, `briefing_editar` ou `agenda_comunicacao_editar`.
- **Funcionalidades**:
  - Cadastro de traje oficial, organização, contato local e apoio do governo do estado.
  - Listas de autoridades previstas e cronogramas (cerimoniais).
  - Redação de contexto e pautas em editor rich text com suporte a blocos públicos e sigilosos (reservados).
  - **Impressão Limpa e Segura (/briefings/[id]/print)**:
    - Rota blindada que ignora o layout do painel (`AuthenticatedShell`) e renderiza uma folha timbrada pura.
    - Moldura em CSS `@media print` (`.print-page-frame`) ajustada em `top: 0` para circundar perfeitamente a área útil imprimível da folha A4.
    - Omissão de bordas duplicadas na impressão via classe `print:border-0`.
    - Resolução geopolítica precisa da Cidade (Bloco 5) baseada no relacionamento direto com a tabela `municipios`, mantendo a linha de endereço do local apenas nas informações logísticas (Bloco 7).
    - Desativação visual de elementos e ícones injetados por extensões de navegadores comuns (como *Mote*, *Grammarly*, etc.) para assegurar a geração de um PDF sem ruídos.

### `/dashboard` (Painel de Decisão)
- **Funcionalidades**:
  - **Mapa de Calor Político (Mato Grosso do Sul)**: Mapa dinâmico baseado em malhas simplificadas do IBGE exibindo de forma interativa a densidade de visitas da agenda oficial (`count_agenda`) e a cobertura de comunicação (`count_comunicacao`) por município.
  - **Correção de Queries & Multitenancy**: Consultas otimizadas para carregar dados ativos de visitas por `unidade_id` e atividades globais de comunicação de forma paralela.
  - **Interação Fina**: Suporte a seleção e clique em municípios com deseleção instantânea ao clicar fora do mapa ou no fundo da área visual.

### Segurança de Mapas & LGPD
- **Backend Proxy**: Para mitigar vulnerabilidades e atender à LGPD, as consultas geopolíticas que não exigem exibição no cliente (Directions, Geocoding, Distance Matrix) foram migradas para o backend do Next.js:
  - Rota de Geocodificação: `/api/maps/geocode`
  - Rota de Rotas/Direções: `/api/maps/directions`
- **Blindagem de Segredos**: As chaves de API do Google Maps/Mapbox foram removidas do código front-end (React/Next) e protegidas por variáveis de ambiente (`process.env.GOOGLE_MAPS_API_KEY`) no backend.
- **Validação com Zod**: Esquemas rigorosos de validação implementados nas rotas de mapas para evitar ataques de injeção de dados.

### Menu Lateral Inteligente (Collapsible Sidebar)
- **Categorias Retráteis**: As categorias (**Principal**, **Operacional**, **Comunicação**) do menu lateral são interativas e colapsáveis para uma interface mais limpa.
- **Persistência de Estado**: As preferências de abertura/fechamento do menu são memorizadas automaticamente no `localStorage` do navegador.

---

## 5. PRÓXIMOS PASSOS
1. **Auditoria de Permissões**: Verificar a conformidade do RBAC no portal entre os menus exibidos e os endpoints correspondentes.
2. **Integração Adicional de Notificações**: Expandir o envio de resumos de briefings via canais automatizados (Fase 6 do Roadmap).
