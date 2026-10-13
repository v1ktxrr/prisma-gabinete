### Isolamento no Nível de Banco de Dados (Row Level Security)
O Prisma adota uma arquitetura de isolamento multi-inquilinato estrito baseado na coluna `unidade_id` (valores aceitos: `CG` para Gabinete Central, `DD` para Diretoria/Demais Unidades).

Nenhuma query executada do lado do cliente (Client-Side) pode ler ou alterar dados de outra unidade, independente do estado dos filtros do frontend.

### Políticas de RLS Homologadas

1. **Tabela `public.briefings` (Blindada na Sprint 1):**
   - `ENABLE ROW LEVEL SECURITY;`
   - `FORCE ROW LEVEL SECURITY;`
   - *SELECT*: Usuário deve possuir módulo condizente e o `unidade_id` do evento em `tasks` deve ser igual ao `unidade_id` do perfil do usuário.
   - *INSERT/UPDATE*: Restrito a detentores de `briefing_editar` ou `agenda_comunicacao_editar`.

2. **Tabela `public.tasks` (Endurecida na Sprint 1):**
   - Divisão rigorosa por `tipo_agenda`.
   - Registros `GLOBAL` exigem correspondência exata de `unidade_id` do usuário com o `unidade_id` da linha para qualquer operação, além dos módulos de agenda oficial.
   - Registros `COMUNICACAO` isolados por escopo de módulo de comunicação.

3. **Tabela `public.atendimentos` (Hub - Criada na Sprint 3):**
   - Política baseada em predicado determinístico:
     ```sql
     CREATE POLICY atendimentos_isolation_policy ON public.atendimentos
     AS RESTRICTIVE USING (
       EXISTS (
         SELECT 1 FROM public.perfis_usuarios p
         WHERE p.id = auth.uid() AND p.unidade_id = public.atendimentos.unidade_id
       )
     );
     ```

4. **Tabela `public.oficios` e `public.oficios_historico` (Sprint 4):**
   - Vinculadas por integridade referencial (`ON DELETE CASCADE`).
   - Protegidas por RLS que cruza o `unidade_id` do documento com a unidade real mapeada no token do usuário através da tabela `perfis_usuarios`.

5. **Tabela `public.aniversariantes` (Contatos & Lideranças - Alpha 1.1 Refinements):**
   - RLS ativa, porém configurada para permitir compartilhamento global.
   - Qualquer usuário autenticado com acesso ao módulo pode visualizar, inserir, atualizar ou excluir registros (`USING (true)` / `WITH CHECK (true)`). Isso permite a colaboração interunidades (CG e DD) no gerenciamento centralizado de contatos, parceiros políticos e lideranças de todo o estado.

### Saneamento de Enums de Domínio
Para mitigar falhas de integridade biunívoca entre a interface e as tabelas, foram eliminados os seguintes estados órfãos do banco de dados PostgreSQL:
- `tasks.status`: Removido valor legado `agendado`. Estados válidos: `pendente`, `publicado`.
- `relatorios_agenda.categoria`: Removidos valores legados `despesa` e `visita_base`. Estados válidos: `atendimento`, `reuniao`, `visita`, `representacao`. Finanças e despesas agora são tratados como atributos numéricos de controle, não como categorias de atividade de campo.
