### Princípio de Hierarquia RBAC
A autorização do sistema foi corrigida na Sprint 1 para eliminar falhas de consistência visual. Fica instituída a regra: **Permissões de escrita (`*_editar`) implicam automaticamente permissões de leitura (`*_ver`)**. O sidebar e os middlewares de rota devem consumir esta lógica flexível.

### Matriz de Rotas e Módulos

| Rota | Função Operacional | Cargos Autorizados | Módulos Requeridos (JWT + DB) |
| :--- | :--- | :--- | :--- |
| `/login` | Autenticação e auto-cadastro | Público | Nenhum |
| `/dashboard` | Painel executivo de tomadas de decisão | Todos (Autenticados) | Qualquer sessão válida |
| `/pre-agenda` | Entrada de eventos oficiais e sincronização | `chefia`, `comunicacao`, `assessoria`, `secretaria` | `agenda_global_ver` OU `agenda_global_editar` |
| `/agenda-oficial` | Cockpit de fechamento da agenda | `chefia`, `comunicacao`, `assessoria`, `secretaria` | `agenda_global_ver` OU `agenda_global_editar` |
| `/agenda-comunicacao` | Calendário estratégico de pautas e posts | `chefia`, `comunicacao` | `agenda_comunicacao_ver` OU `agenda_comunicacao_editar` |
| `/briefings` | Criação e listagem de briefings táticos | `chefia`, `comunicacao` | `briefing_editar` OU `agenda_comunicacao_ver` |
| `/oficios` | Sistema de protocolo e tramitação eletrônica | `chefia`, `assessoria`, `comunicacao` | `oficios_ver` OU `oficios_tramitar` |
| `/contatos` | Gestão de contatos, parceiros políticos e aniversariantes | `chefia`, `secretaria`, `comunicacao`, `assessoria` | `aniversariantes_gerenciar` (para assessoria) ou cargos nativos |
| `/atendimentos` | Centralizador de casos, demandas e linha do tempo de atividades | Todos (Autenticados) | Qualquer sessão válida vinculada à unidade |
| `/agenda` | Registro de campo e prestação de contas | `assessoria` | Cargo funcional `assessoria` |
| `/visao-geral` | Auditoria operacional do gabinete | `chefia` | Cargo funcional `chefia` |


### Fluxo Automático de Protocolo (Sprint 4)
- Todo `INSERT` ou `UPDATE` de status na tabela `public.oficios` dispara uma inserção silenciosa no backend (`app/api/oficios/route.ts`) gravando a ação na tabela `public.oficios_historico`. Isso impede que movimentações de documentos oficiais sejam omitidas da auditoria da chefia.
