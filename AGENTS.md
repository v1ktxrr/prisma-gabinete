# Orientacoes Para Agentes

Este projeto esta na fase **Alpha 1.0**.

O Prisma esta sendo colocado no ar pela primeira vez como aplicativo operacional para controle geral de gabinete politico. A prioridade desta fase e validar os fluxos centrais em uso real, preservar seguranca e manter o sistema evolutivo para novas funcionalidades.

## Estado Do Produto

- **Classificacao atual:** Alpha 1.0.
- **Versao tecnica recomendada:** `v0.1.0-alpha.1`.
- **Escopo atual:** controle geral de gabinete politico com agenda oficial, comunicacao, briefings, oficios, prestacao de contas, dashboard e RBAC.
- **Expectativa da fase:** funcionalidades principais existem, mas ainda passarao por polimento visual, ajustes de fluxo, expansao de modulos e consolidacao de arquitetura.

Nao trate ausencia de polimento, textos temporarios ou fluxos ainda simples como erro critico automaticamente. Primeiro diferencie:

- bug funcional;
- risco de seguranca;
- divida tecnica esperada da fase Alpha;
- melhoria de UX;
- funcionalidade futura ainda nao implementada.

## Prioridades Da Alpha 1.0

1. Preservar autenticacao, RBAC, RLS e isolamento por `unidade_id`.
2. Evitar regressao nos fluxos ja operacionais.
3. Manter mudancas pequenas, verificaveis e alinhadas aos documentos de contexto.
4. Documentar decisoes que afetem regras de negocio, permissoes, banco ou deploy.
5. Preferir estabilidade e clareza operacional a refactors amplos.

## Regras De Seguranca E Dados

- O nome do produto e Prisma, mas a persistencia real e Supabase PostgreSQL.
- Nao introduza Prisma ORM sem instrucao explicita.
- Nao altere schema Supabase sem migration/documentacao correspondente.
- Nao enfraqueca politicas RLS, validacoes server-side ou checagens de permissao.
- APIs que usam `SUPABASE_SERVICE_ROLE_KEY` devem validar RBAC antes de qualquer operacao privilegiada.
- **Criação de Usuários**: Nunca utilize a função de cadastro padrão client-side `supabase.auth.signUp()`. Novos acessos devem ser convidados silenciosamente no backend via `/api/admin/invite` (Server-side) usando a API de administração do Supabase, prevenindo a invalidação da sessão do administrador logado.
- Dados de `CG` e `DD` devem permanecer isolados por `unidade_id`.
- **Controle de Gabinetes**: A tabela `public.unidades` centraliza o status de atividade das sedes (CG e DD). Se uma unidade estiver suspensa, seus respectivos usuários são bloqueados em todas as rotas operacionais do portal.
- Briefings, oficios, atendimentos, comprovantes e historicos devem ser tratados como dados sensiveis.
- Nunca versione `.env`, `.env.local`, chaves, certificados ou tokens.

## Cargos E Modulos Atuais

Cargos funcionais atuais:

- `chefia` (Liderança do gabinete - controle geral e auditoria)
- `assessoria` (Assessores de campo - prestação de contas)
- `secretaria` (Gestão operacional da agenda e briefings)
- `comunicacao` (Gestão estratégica de pautas e publicações)
- `super_admin` (Root/Developer - controle de infraestrutura e multitenancy)

### Whitelist de Desenvolvedores
- O acesso ao Cockpit de Root (`/deviktor-sys`) e suas APIs exclusivas é restrito a e-mails configurados na variável de ambiente `DEV_EMAILS` (validação em middleware + controller).

Principio de permissao:

- permissoes `*_editar` implicam leitura equivalente `*_ver`;
- o menu, as paginas, as APIs e as policies devem permanecer coerentes entre si;
- divergencias entre UI e banco devem ser tratadas como risco de autorizacao.
- **Atalhos de UI (Payloads compostos)**: Certas ações da interface gerenciam mais de um slug técnico simultaneamente no banco. Por exemplo, o checkbox "Agenda da comunicação" injeta/remove tanto `agenda_comunicacao_ver` quanto `agenda_comunicacao_editar` no payload enviado às APIs.

## Como Trabalhar Neste Codigo

- **Passo Inicial Obrigatório (Contexto)**: Em toda nova sessão, leia o arquivo `HANDOVER.md` para entender as últimas alterações e verificar quais sub-handovers de features (`HANDOVER_*.md`) estão ativos e atualizados no Git para carregá-los conforme necessário.
- **Estrutura de Rotas (Route Groups)**:
  - `app/(portal)/`: Contém as páginas funcionais do time de gabinete e herda o layout com menu lateral lateral (`AuthenticatedShell`).
  - `app/(admin)/`: Contém o cockpit técnico do sistema (`/deviktor-sys`), sob layout escuro minimalista independente.
- Leia `README.md`, `VERSIONING.md` e os Markdown de contexto antes de propor mudancas estruturais.
- Use os padroes existentes do app antes de criar novos abstractions.
- Evite refactors fora do escopo solicitado.
- Quando tocar em UI, preserve usabilidade mobile e estados de loading, vazio, erro e offline quando aplicavel.
- Quando tocar em banco, atualize ou crie SQL em `supabase/` e explique o impacto.
- Quando tocar em permissao, teste mentalmente os perfis `chefia`, `assessoria`, `secretaria` e `comunicacao`.

## Documentos De Contexto

- `README.md`: visao geral do projeto e setup.
- `VERSIONING.md`: politica de classificacao de versoes.
- `CHANGELOG.md`: historico de marcos.
- `PRD-Prisma-Atual.md`: produto implementado e regras atuais.
- `spec.md`: especificacao tecnica do proximo ciclo.
- `PRISMA_ARCHITECTURE.md`: arquitetura do sistema.
- `PRISMA_MULTITENANCY_STRUCTURE.md`: isolamento multiunidade e RLS.
- `PRISMA_MODULAR_ACCESS_MATRIX.md`: matriz de rotas, cargos e modulos.
- `COMMIT_PREP.md`: checklist antes de commit/deploy.

<!-- shared-brain -->
## Shared Brain

Este projeto está conectado ao segundo cérebro do Victor em `~/SharedBrain`.
Primeira vez no sistema? Leia `~/SharedBrain/99-Meta/Como funciona o Shared Brain.md`.

**Antes de agir**
1. Leia a nota do projeto: `~/SharedBrain/02-Projetos/Prisma App.md`
2. Leia o que mudou: `~/SharedBrain/02-Projetos/Mudanças/Prisma App — mudanças.md`
   Se contradiz a nota, as mudanças são mais novas.

**Depois de agir**
- **Commit**, se a pasta tem Git, com mensagem dizendo o que mudou e por quê. O vault registra
  sozinho, de hora em hora.
- **Peça de mídia pronta** (vídeo, arte): crie a ficha `.md` com o mesmo nome, ao lado do arquivo.
  Modelo: `~/SharedBrain/90-Templates/Ficha de mídia.md`
- **Porquê e decisões:** em `## 📥 Contribuições` da nota do projeto.

**Nunca:** segredo no Git ou no vault; criar remoto ou fazer push sem o Victor pedir.
<!-- /shared-brain -->
