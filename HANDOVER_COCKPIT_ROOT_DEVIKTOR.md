# Handover Técnico - Cockpit de Root (`/deviktor-sys`)

Este documento detalha o redesenho arquitetural para a implementação do **Cockpit de Root (God Mode V2)** no Prisma, um painel exclusivo para desenvolvedores e mantenedores do sistema na rota oculta `/deviktor-sys`.

---

## 1. Visão Geral e Contexto
O antigo conceito de Painel de Admin (/admin) para a equipe foi totalmente substituído por um console técnico ("Ghost System") focado em infraestrutura e domínios. A interface do cockpit de root é 100% invisível para usuários comuns e administradores políticos do gabinete.

O **God Mode V2** introduz capacidades avançadas para administração global, isolamento multi-tenant, auditoria e resiliência da infraestrutura.

---

## 2. Pilares da Arquitetura

### A. Autenticação e Segurança (Whitelist de E-mails)
- **Bloqueio no Middleware:** Qualquer tentativa de acessar `/deviktor-sys` ou `/api/deviktor-sys/*` por usuários sem sessão ativa ou cujos e-mails não estejam na variável de ambiente `DEV_EMAILS` (ex: `DEV_EMAILS="admin@exemplo.com,dev@exemplo.com"`) receberá uma reescrita silenciosa para `/404` (Not Found), simulando que a rota não existe.
- **Defesa em Profundidade nas APIs:** Cada endpoint sob `/api/deviktor-sys/*` valida a whitelist contra a sessão do Supabase localmente antes de usar a chave privilegiada de banco (`SUPABASE_SERVICE_ROLE_KEY`).

### B. Isolamento de Interface (Route Groups do Next.js)
Para separar a experiência visual do console de desenvolvedores do portal operacional da equipe, estruturamos o projeto utilizando Route Groups:
- **`app/layout.tsx`:** Contém apenas o esqueleto HTML básico e o provedor de autenticação (`AuthProvider`).
- **`app/(portal)/`:** Grupo contendo as rotas de usuários (`dashboard`, `agenda`, `oficios`, `briefings`, etc.) e o layout operacional com o menu lateral lateral (`AuthenticatedShell`).
- **`app/(admin)/`:** Layout escuro corporativo minimalista (tons Slate/Zinc/Terminal) sem menu lateral ou cabeçalho herdado. Contém a página `/deviktor-sys`.
- **Limpeza Visual:** O item "Painel de Admin" foi definitivamente removido do arquivo `components/app-sidebar.tsx`.

### C. Estrutura de Banco de Dados (`sprint8_cockpit_root.sql` e `sprint9_unidades.sql`)
1. **`public.configuracoes_sistema`:** Gerencia Feature Flags e configurações dinâmicas como modo manutenção e `broadcast_banner`.
2. **`public.unidades`:** Introduz o conceito de Multi-Tenancy (Gabinetes), armazenando os clientes, CNPJ e o status de acesso (Ativo/Suspenso).
3. **`public.eixos_tematicos` e `public.formatos_midia`:** Guardam taxonomias com leitura pública (RLS) e escrita root.
4. **`public.logs_sistema`:** Tabela de telemetria para erros do sistema e auditoria de ações de infraestrutura.
5. **RPC `public.obter_usuarios_fantasmas()`:** Função `SECURITY DEFINER` que lista os usuários no Auth criados há mais de 10 minutos que falharam em cadastrar o perfil operacional.

---

## 3. APIs Administrativas, Ferramentas & Triggers

O Cockpit é composto por 8 abas de controle integradas às APIs modulares em `/api/deviktor-sys/`:

- **Usuários e Impersonation (`/users/`)**: Permite criar usuários ignorando `unidade_id`. Contém a rota `/impersonate` para gerar um Magic Link do Supabase (`admin.generateLink`) permitindo login em contas de terceiros via aba anônima.
- **Configurações Globais (`/configs/`)**: Gerencia toggles (feature flags) e edição de objetos JSON complexos, como o `broadcast_banner`.
- **Gabinetes / Unidades (`/unidades/`)**: Listagem e edição de status das unidades. A integração com o layout central garante que usuários de unidades marcadas como "suspensa" fiquem totalmente bloqueados de acessar a UI do sistema.
- **Storage (`/storage/`)**: Varre buckets do Supabase para relatar os arquivos mais pesados e contagens agregadas, auxiliando na previsão de custos.
- **Health Checks (`/health/`)**: Endpoints de ping para validar latência e comunicação com o PostgreSQL (Supabase) e checagem de integridade das chaves de integração externas (ex: Apify API).
- **Taxonomias e Domínios (`/domains/`)**: CRUD de eixos temáticos e formatos.
- **Logs Operacionais (`/logs/`)**: Histórico com paginação da telemetria do app.
- **Triggers de Root (`/triggers/`)**:
  - `sync_instagram_post`: Executa a Edge Function `sync-instagram` remotamente.
  - `cleanup_ghost_users`: Expurga contas não inicializadas da tabela Auth.

---

## 4. Integração Resiliente (Calendário)
No arquivo `components/task-modal.tsx`, a listagem dos campos de Eixo Temático e Formato de Mídia consome os dados do banco assincronamente.
- **Segurança Antifalhas:** Para proteger o calendário de quebras, caso ocorra lentidão na resposta ou indisponibilidade do banco, o modal ativa arrays estáticos originais como **fallback preventivo de segurança**, garantindo o preenchimento do formulário.
