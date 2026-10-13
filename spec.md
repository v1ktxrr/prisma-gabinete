# SPEC Técnica Oficial Prisma - Próximo Ciclo

**Versão:** 1.0
**Data:** 25/05/2026
**Base:** PRD retroativo `PRD-Prisma-Atual.md`
**Objetivo:** reduzir dívida técnica crítica, fechar riscos de segurança, alinhar RBAC/UI/banco e preparar o Prisma para escalar por uma arquitetura Hub-and-Spoke.

## 1. Gaps Técnicos E De Segurança

### 1.1 Falta Crítica De RLS Em `briefings`

A tabela `public.briefings` contém dados sensíveis de agenda, autoridades, cronograma, contexto político, informações confidenciais e blocos customizados com conteúdo potencialmente sigiloso. Hoje ela está sem RLS efetiva, o que deixa a proteção dependente demais das rotas server-side e da disciplina do frontend.

Risco: qualquer falha de client, endpoint, chave pública ou grant permissivo pode expor briefings entre unidades, cargos ou usuários sem módulo autorizado.

Correção obrigatória:

- Ativar e forçar RLS em `public.briefings`.
- Criar políticas explícitas de `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
- Permitir leitura apenas para usuários com `briefing_editar`, `agenda_comunicacao_ver` ou permissão equivalente definida.
- Permitir escrita apenas para usuários com `briefing_editar` ou `agenda_comunicacao_editar`.
- Restringir briefings vinculados a agenda pela unidade do evento em `tasks`.
- Garantir que briefings independentes tenham regra de unidade ou vínculo futuro via `atendimento_id`.

### 1.2 Permissividade Excessiva Em `tasks`

A tabela `public.tasks` é o centro atual de agenda oficial e comunicação. Ela mistura compromissos oficiais, pautas de comunicação, eventos sincronizados do Google e publicações com métricas sociais.

Problema: as políticas atuais são permissivas demais para usuários autenticados, enquanto parte relevante das operações ainda é feita diretamente do client Supabase. Isso permite risco de leitura, alteração ou exclusão fora do módulo, unidade ou escopo funcional do usuário.

Correção obrigatória:

- Separar políticas por `tipo_agenda`: `GLOBAL` e `COMUNICACAO`.
- Para `GLOBAL`, exigir `unidade_id` compatível com `perfis_usuarios.unidade_id`.
- Para `GLOBAL`, leitura deve exigir `agenda_global_ver` ou `agenda_global_editar`.
- Para `GLOBAL`, escrita deve exigir `agenda_global_editar`.
- Para `COMUNICACAO`, leitura deve exigir `agenda_comunicacao_ver` ou `agenda_comunicacao_editar`.
- Para `COMUNICACAO`, escrita deve exigir `agenda_comunicacao_editar`.
- Inserts devem exigir `created_by = auth.uid()`.
- Updates/deletes devem ser bloqueados quando o usuário não tiver permissão modular explícita.
- O fluxo de comunicação precisa gravar `unidade_id` ou ter regra formal para isolamento multiunidade.

### 1.3 Inconsistência De Roteamento E RBAC Em `/agenda-comunicacao`

Há uma divergência entre sidebar e página:

- O sidebar mostra `/agenda-comunicacao` para quem tem `agenda_comunicacao_ver` ou `agenda_comunicacao_editar`.
- A página `/agenda-comunicacao` bloqueia quem não possui `agenda_comunicacao_ver`.

Impacto: um usuário com permissão de edição, mas sem permissão explícita de leitura, pode ver a rota no menu e ser bloqueado ao abrir. Isso revela inconsistência conceitual no RBAC.

Decisão técnica recomendada: `*_editar` deve implicar leitura. A página deve aceitar `agenda_comunicacao_ver` ou `agenda_comunicacao_editar`, e o cadastro de usuários deve evitar combinações ambíguas.

Também há desalinhamento secundário em `briefings`: a regra real de acesso aceita mais módulos do que alguns pontos de navegação expõem. O menu deve refletir a mesma matriz de permissão usada nas páginas e APIs.

### 1.4 Gaps Entre Status/Categorias Do Banco E UI

O banco e a UI não falam exatamente a mesma linguagem de domínio.

Tabela `tasks`:

| Campo | Banco aceita | UI consome |
|---|---|---|
| `status` | `pendente`, `agendado`, `publicado` | `pendente`, `publicado` |

Tabela `relatorios_agenda`:

| Campo | Banco aceita | UI consome |
|---|---|---|
| `categoria` | `atendimento`, `reuniao`, `despesa`, `visita_base`, `visita`, `representacao` | `atendimento`, `reuniao`, `visita`, `representacao` |

Risco: estados órfãos podem existir no banco sem representação visual consistente, quebrando filtros, relatórios, contagens e regras de negócio.

Correção obrigatória:

- Definir um dicionário canônico de status e categorias.
- Remover valores obsoletos do banco ou reintroduzi-los corretamente na UI.
- Tratar `despesa` como atributo financeiro, não como categoria operacional, se essa for a decisão de produto vigente.
- Garantir que migrations, tipos TypeScript, formulários, filtros e relatórios usem a mesma enumeração.

## 2. Nova Arquitetura Hub-And-Spoke

### 2.1 Objetivo Arquitetural

O Prisma deve deixar de tratar agenda, briefing, ofícios e registros como ilhas separadas. O novo modelo precisa permitir que um atendimento, demanda ou caso seja o centro de uma linha do tempo única.

A arquitetura proposta é Hub-and-Spoke:

| Papel | Objeto |
|---|---|
| Hub | `public.atendimentos` |
| Spokes atuais | `tasks`, `briefings` |
| Spokes futuros | `oficios`, reuniões, anexos, documentos, interações, histórico |

### 2.2 Nova Tabela Central `public.atendimentos`

Tabela mínima obrigatória:

| Coluna | Tipo esperado | Regra |
|---|---|---|
| `id` | `uuid` | PK, gerado automaticamente |
| `data` | `timestamptz` ou `date` | data principal do atendimento |
| `titulo` | `text` | obrigatório |
| `status` | `text` ou enum | obrigatório |
| `unidade_id` | `varchar(2)` | obrigatório, `CG` ou `DD` |

Status recomendado para primeira versão:

| Status | Uso |
|---|---|
| `aberto` | atendimento registrado, ainda em andamento |
| `em_andamento` | atendimento com ações vinculadas |
| `concluido` | atendimento finalizado operacionalmente |
| `arquivado` | atendimento preservado, fora do fluxo ativo |

Regras obrigatórias:

- `unidade_id` deve ser a base de isolamento multiunidade.
- RLS deve impedir acesso cruzado entre `CG` e `DD`.
- Usuários devem enxergar atendimentos apenas se tiverem módulo compatível.
- O hub não substitui `tasks` nem `briefings` no primeiro momento; ele cria o eixo de vínculo.

### 2.3 Alteração Em `tasks`

Adicionar coluna:

| Coluna | Tipo | Regra |
|---|---|---|
| `atendimento_id` | `uuid nullable` | FK para `public.atendimentos(id)` |

Diretrizes:

- A FK deve ser `NULLable` para não quebrar dados legados.
- Eventos existentes continuam funcionando sem atendimento vinculado.
- Novos eventos poderão ser associados a um atendimento quando o fluxo estiver disponível.
- A exclusão de atendimento não deve apagar eventos históricos automaticamente.
- O vínculo deve permitir montar uma linha do tempo com compromissos, pautas e publicações.

### 2.4 Alteração Em `briefings`

Adicionar coluna:

| Coluna | Tipo | Regra |
|---|---|---|
| `atendimento_id` | `uuid nullable` | FK para `public.atendimentos(id)` |

Diretrizes:

- A FK deve ser `NULLable` para preservar briefings independentes e vinculados apenas a `agenda_id`.
- Briefings vinculados a `tasks` podem herdar o atendimento do evento no futuro.
- Briefings independentes passam a poder ser amarrados diretamente ao hub.
- A RLS de `briefings` deve considerar `atendimento_id`, `agenda_id` e permissões modulares.

### 2.5 Princípio De Evolução

A Sprint 3 deve criar a infraestrutura sem forçar migração completa de produto. O backfill automático pode ser planejado depois, quando houver decisão de produto sobre o que constitui um atendimento.

Primeira entrega esperada:

- Tabela `atendimentos` criada.
- RLS de `atendimentos` ativa.
- `tasks.atendimento_id` criado e indexado.
- `briefings.atendimento_id` criado e indexado.
- FKs aplicadas sem quebrar dados existentes.
- Nenhuma rota antiga deve deixar de funcionar.

## 3. Plano De Ação Por Sprints

## Sprint 1: Blindagem De Segurança E Correção De Bugs

**Foco:** fechar RLS Supabase, corrigir RBAC de frontend e eliminar inconsistências críticas de acesso.

Entregáveis:

- Migration SQL de RLS para `briefings`.
- Migration SQL de endurecimento de RLS para `tasks`.
- Revisão das policies de `task_assignments`.
- Correção de RBAC em `/agenda-comunicacao`.
- Alinhamento do menu lateral com as regras reais das páginas.
- Definição oficial das enums de `tasks.status` e `relatorios_agenda.categoria`.

Tarefas técnicas:

- Ativar `enable row level security` e `force row level security` em `briefings`.
- Criar policies de leitura/escrita para `briefings` baseadas em `perfis_usuarios.modulos_acesso`.
- Restringir `briefings` por unidade quando houver vínculo com `tasks`.
- Revisar grants públicos e autenticados das tabelas sensíveis.
- Substituir policies permissivas de `tasks` por policies separadas por módulo, unidade e `tipo_agenda`.
- Garantir que usuários sem `agenda_global_editar` não alterem eventos `GLOBAL`.
- Garantir que usuários sem `agenda_comunicacao_editar` não alterem eventos `COMUNICACAO`.
- Corrigir `/agenda-comunicacao` para aceitar `agenda_comunicacao_ver` ou `agenda_comunicacao_editar`.
- Atualizar o sidebar para usar a mesma função de permissão das páginas.
- Documentar decisão final sobre `agendado`, `despesa` e `visita_base`.

Critérios de aceite:

- Usuário de `CG` não consegue ler nem alterar dados de `DD`.
- Usuário sem módulo de briefing não consegue ler `briefings`, mesmo chamando Supabase diretamente.
- Usuário com permissão de edição de comunicação consegue abrir `/agenda-comunicacao`.
- Usuário sem permissão de edição não consegue criar, mover, editar ou excluir pautas.
- APIs com `service_role` continuam validando RBAC antes de qualquer operação privilegiada.
- Não existem valores de status/categoria sem decisão explícita de produto.

## Sprint 2: Refatoração Visual

**Foco:** aplicar o Design System limpo nas rotas existentes, sem alterar domínio ou banco.

Entregáveis:

- Layout visual padronizado nas rotas principais.
- Componentes de card, formulário, modal, empty state, loading state e tabelas consolidados.
- Calendários visualmente consistentes entre Agenda Oficial e Comunicação.
- Briefings com UI mais limpa, preservando fluxo atual.
- Perfil, Dashboard, Raio-X e Meus Registros alinhados ao mesmo sistema visual.

Rotas alvo:

| Rota | Objetivo |
|---|---|
| `/dashboard` | clareza executiva e hierarquia de indicadores |
| `/agenda-global` | agenda oficial com foco operacional |
| `/agenda-comunicacao` | calendário e modal de pauta mais legíveis |
| `/briefings` | edição e leitura com menos ruído visual |
| `/agenda` | registro de campo rápido e responsivo |
| `/visao-geral` | auditoria e filtros com leitura executiva |
| `/profile` | gestão de perfil e usuários mais coesa |

Critérios de aceite:

- Nenhuma regra de acesso é enfraquecida durante a refatoração.
- Todos os fluxos existentes continuam funcionais.
- Estados de loading, erro, vazio e offline são tratados visualmente.
- Interface mobile continua utilizável.
- Não há introdução de novo módulo funcional nesta sprint.

## Sprint 3: Infraestrutura Hub-And-Spoke

**Foco:** criar o hub `atendimentos` e preparar `tasks` e `briefings` para vínculo futuro.

Entregáveis:

- Migration SQL criando `public.atendimentos`.
- RLS inicial de `atendimentos`.
- Coluna `tasks.atendimento_id`.
- Coluna `briefings.atendimento_id`.
- Índices para consulta por atendimento.
- Documentação do modelo Hub-and-Spoke.
- Tipos e contratos internos atualizados para reconhecer `atendimento_id`.

Tarefas técnicas:

- Criar tabela `public.atendimentos` com `id`, `data`, `titulo`, `status`, `unidade_id`.
- Aplicar constraint de `unidade_id` para `CG` e `DD`.
- Aplicar constraint ou enum para `status`.
- Criar policies de leitura e escrita para `atendimentos`.
- Adicionar FK nullable em `tasks.atendimento_id`.
- Adicionar FK nullable em `briefings.atendimento_id`.
- Criar índices em `tasks(atendimento_id)` e `briefings(atendimento_id)`.
- Garantir que migrations sejam compatíveis com dados legados.
- Não exigir backfill obrigatório nesta sprint.

Critérios de aceite:

- Deploy da migration não quebra rotas atuais.
- Eventos e briefings existentes continuam visíveis.
- Novos vínculos podem ser gravados por scripts ou APIs futuras.
- RLS de `atendimentos` respeita unidade e perfil.
- O modelo permite consultar uma futura linha do tempo por `atendimento_id`.

## Sprint 4: Novo Módulo De Ofícios

**Foco:** construir CRUD completo de ofícios integrado ao ecossistema e ao hub de atendimentos.

Entregáveis:

- Tabela `public.oficios`.
- RLS de `oficios`.
- CRUD completo no frontend.
- Integração opcional ou obrigatória com `atendimento_id`, conforme regra final de produto.
- Listagem, criação, edição, exclusão controlada e visualização detalhada.
- Filtros por status, unidade, data, destinatário e atendimento.
- Registro de auditoria para ações sensíveis.

Modelo mínimo recomendado para `oficios`:

| Campo | Papel |
|---|---|
| `id` | identificador do ofício |
| `atendimento_id` | vínculo com o hub |
| `unidade_id` | isolamento multiunidade |
| `numero` | número oficial ou interno |
| `titulo` | título resumido |
| `destinatario` | órgão, pessoa ou entidade |
| `status` | rascunho, enviado, respondido, arquivado |
| `data_emissao` | data do documento |
| `prazo_resposta` | prazo quando existir |
| `created_by` | usuário criador |
| `created_at` | criação |
| `updated_at` | atualização |

Critérios de aceite:

- Usuário sem permissão não acessa o módulo.
- Usuário de uma unidade não acessa ofícios de outra unidade.
- Ofício pode ser vinculado a um atendimento.
- Atendimento passa a exibir ofícios como parte da linha do tempo futura.
- Operações sensíveis são auditáveis.
- CRUD funciona sem depender de ajustes manuais no banco.

## 4. Ordem De Prioridade

A ordem é obrigatória:

1. Sprint 1 fecha risco de vazamento e inconsistência de acesso.
2. Sprint 2 melhora usabilidade sem mexer na fundação de dados.
3. Sprint 3 prepara a arquitetura de escala.
4. Sprint 4 entrega novo valor funcional sobre uma base já saneada.

Não iniciar o módulo de Ofícios antes da Sprint 1. Construir CRUD novo sobre RLS permissivo ampliaria a superfície de risco do sistema.
