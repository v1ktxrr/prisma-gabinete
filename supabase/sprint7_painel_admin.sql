-- Migration SQL for Sprint 7: Painel de Admin (Multiunidade, RLS de Ativo e Super Admin)
begin;

-- 1. ADICIONAR VALOR 'super_admin' AO ENUM cargo_usuario SE NÃO EXISTIR
-- Nota: Para compatibilidade com blocos transacionais do PG, verificamos a existência antes
do $$
begin
    if not exists (select 1 from pg_type t join pg_enum e on t.oid = e.enumtypid where t.typname = 'cargo_usuario' and e.enumlabel = 'super_admin') then
        alter type public.cargo_usuario add value 'super_admin';
    end if;
end
$$;

-- 2. ALTERAR TABELA perfis_usuarios (ADICIONAR COLUNAS email E ativo)
alter table public.perfis_usuarios add column if not exists email text;
alter table public.perfis_usuarios add column if not exists ativo boolean not null default true;

-- 3. RETROALIMENTAR EMAILS EXISTENTES A PARTIR DA TABELA DE AUTENTICAÇÃO DO SUPABASE
update public.perfis_usuarios p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 4. ATUALIZAR TRIGGER FUNCTION handle_new_user PARA INCLUIR EMAIL E ATIVO
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_nome text;
    v_cargo public.cargo_usuario;
    v_unidade_id varchar(2);
    v_modulos_acesso jsonb;
begin
    v_nome := coalesce(new.raw_user_meta_data ->> 'full_name', new.email, '');
    v_cargo := coalesce(new.raw_user_meta_data ->> 'cargo', 'assessoria')::public.cargo_usuario;
    v_unidade_id := coalesce(new.raw_user_meta_data ->> 'unidade_id', 'CG');
    v_modulos_acesso := coalesce(new.raw_user_meta_data -> 'modulos_acesso', '[]'::jsonb);

    insert into public.profiles (
        id,
        nome,
        cargo
    )
    values (
        new.id,
        v_nome,
        v_cargo::text
    )
    on conflict (id) do update
    set
        nome = excluded.nome,
        cargo = excluded.cargo;

    insert into public.perfis_usuarios (
        id,
        nome,
        email,
        cargo,
        unidade_id,
        modulos_acesso,
        ativo
    )
    values (
        new.id,
        v_nome,
        new.email,
        v_cargo,
        v_unidade_id,
        v_modulos_acesso,
        true
    )
    on conflict (id) do update
    set
        nome = excluded.nome,
        email = excluded.email,
        cargo = excluded.cargo,
        unidade_id = excluded.unidade_id,
        modulos_acesso = excluded.modulos_acesso,
        ativo = coalesce(excluded.ativo, perfis_usuarios.ativo);

    return new;
end;
$function$;
-- 5. ATIVAR E REDEFINIR POLÍTICAS DE RLS PARA A TABELA perfis_usuarios
alter table public.perfis_usuarios enable row level security;
alter table public.perfis_usuarios force row level security;

-- Funções auxiliares SECURITY DEFINER para evitar recursão nas políticas RLS
create or replace function public.get_my_cargo()
returns public.cargo_usuario
language sql
security definer
set search_path = public
as $$
    select cargo from public.perfis_usuarios where id = auth.uid() limit 1;
$$;

create or replace function public.get_my_unidade()
returns varchar(2)
language sql
security definer
set search_path = public
as $$
    select unidade_id from public.perfis_usuarios where id = auth.uid() limit 1;
$$;

create or replace function public.is_my_ativo()
returns boolean
language sql
security definer
set search_path = public
as $$
    select coalesce(ativo, false) from public.perfis_usuarios where id = auth.uid() limit 1;
$$;

create or replace function public.has_my_modulo(tag text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select coalesce(modulos_acesso ? tag, false) from public.perfis_usuarios where id = auth.uid() limit 1;
$$;

drop policy if exists "perfis_usuarios_select_policy" on public.perfis_usuarios;
drop policy if exists "perfis: usuario ve o proprio perfil" on public.perfis_usuarios;
drop policy if exists "perfis: chefe ve todos os perfis" on public.perfis_usuarios;
drop policy if exists "perfis: usuario atualiza proprio perfil sem alterar cargo" on public.perfis_usuarios;
drop policy if exists "perfis: chefe altera cargo de qualquer usuario" on public.perfis_usuarios;
create policy "perfis_usuarios_select_policy"
    on public.perfis_usuarios
    for select
    to authenticated
    using (
        id = auth.uid()
        or (
            is_my_ativo() = true
            and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
        )
    );

drop policy if exists "perfis_usuarios_self_update_policy" on public.perfis_usuarios;
create policy "perfis_usuarios_self_update_policy"
    on public.perfis_usuarios
    for update
    to authenticated
    using (id = auth.uid() and is_my_ativo() = true)
    with check (id = auth.uid() and is_my_ativo() = true);

drop policy if exists "perfis_usuarios_admin_update_policy" on public.perfis_usuarios;
create policy "perfis_usuarios_admin_update_policy"
    on public.perfis_usuarios
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and (has_my_modulo('usuarios_gerenciar') or get_my_cargo() = 'super_admin')
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    )
    with check (
        is_my_ativo() = true
        and (has_my_modulo('usuarios_gerenciar') or get_my_cargo() = 'super_admin')
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    );

-- 6. REDEFINIR POLÍTICAS RLS DA TABELA tasks COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "tasks_select_policy" on public.tasks;
create policy "tasks_select_policy"
    on public.tasks
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (
            (tipo_agenda = 'GLOBAL' and (has_my_modulo('agenda_global_ver') or has_my_modulo('agenda_global_editar')) and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id))
            or
            (tipo_agenda = 'COMUNICACAO' and (has_my_modulo('agenda_comunicacao_ver') or has_my_modulo('agenda_comunicacao_editar')))
        )
    );

drop policy if exists "tasks_insert_policy" on public.tasks;
create policy "tasks_insert_policy"
    on public.tasks
    for insert
    to authenticated
    with check (
        created_by = auth.uid()
        and is_my_ativo() = true
        and (
            (tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id))
            or
            (tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
        )
    );

drop policy if exists "tasks_update_policy" on public.tasks;
create policy "tasks_update_policy"
    on public.tasks
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and (
            (tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id))
            or
            (tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
        )
    )
    with check (
        is_my_ativo() = true
        and (
            (tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id))
            or
            (tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
        )
    );

drop policy if exists "tasks_delete_policy" on public.tasks;
create policy "tasks_delete_policy"
    on public.tasks
    for delete
    to authenticated
    using (
        is_my_ativo() = true
        and (
            (tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id))
            or
            (tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
        )
    );

-- 7. REDEFINIR POLÍTICAS RLS DA TABELA briefings COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "briefings_select_policy" on public.briefings;
create policy "briefings_select_policy"
    on public.briefings
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (has_my_modulo('briefing_editar') or has_my_modulo('agenda_comunicacao_ver'))
        and (
            get_my_cargo() = 'super_admin'
            or briefings.agenda_id is null
            or exists (
                select 1 from public.tasks t
                where t.id = briefings.agenda_id
                  and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade())
            )
        )
    );

drop policy if exists "briefings_insert_policy" on public.briefings;
create policy "briefings_insert_policy"
    on public.briefings
    for insert
    to authenticated
    with check (
        is_my_ativo() = true
        and (has_my_modulo('briefing_editar') or has_my_modulo('agenda_comunicacao_editar'))
        and (
            get_my_cargo() = 'super_admin'
            or briefings.agenda_id is null
            or exists (
                select 1 from public.tasks t
                where t.id = briefings.agenda_id
                  and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade())
            )
        )
    );

drop policy if exists "briefings_update_policy" on public.briefings;
create policy "briefings_update_policy"
    on public.briefings
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and (has_my_modulo('briefing_editar') or has_my_modulo('agenda_comunicacao_editar'))
        and (
            get_my_cargo() = 'super_admin'
            or briefings.agenda_id is null
            or exists (
                select 1 from public.tasks t
                where t.id = briefings.agenda_id
                  and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade())
            )
        )
    )
    with check (
        is_my_ativo() = true
        and (has_my_modulo('briefing_editar') or has_my_modulo('agenda_comunicacao_editar'))
        and (
            get_my_cargo() = 'super_admin'
            or briefings.agenda_id is null
            or exists (
                select 1 from public.tasks t
                where t.id = briefings.agenda_id
                  and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade())
            )
        )
    );

drop policy if exists "briefings_delete_policy" on public.briefings;
create policy "briefings_delete_policy"
    on public.briefings
    for delete
    to authenticated
    using (
        is_my_ativo() = true
        and (has_my_modulo('briefing_editar') or has_my_modulo('agenda_comunicacao_editar'))
        and (
            get_my_cargo() = 'super_admin'
            or briefings.agenda_id is null
            or exists (
                select 1 from public.tasks t
                where t.id = briefings.agenda_id
                  and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade())
            )
        )
    );

-- 8. REDEFINIR POLÍTICAS RLS DA TABELA atendimentos COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "atendimentos_select_policy" on public.atendimentos;
create policy "atendimentos_select_policy"
    on public.atendimentos
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = atendimentos.unidade_id)
    );

drop policy if exists "atendimentos_insert_policy" on public.atendimentos;
create policy "atendimentos_insert_policy"
    on public.atendimentos
    for insert
    to authenticated
    with check (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = atendimentos.unidade_id)
    );

drop policy if exists "atendimentos_update_policy" on public.atendimentos;
create policy "atendimentos_update_policy"
    on public.atendimentos
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = atendimentos.unidade_id)
    )
    with check (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = atendimentos.unidade_id)
    );

drop policy if exists "atendimentos_delete_policy" on public.atendimentos;
create policy "atendimentos_delete_policy"
    on public.atendimentos
    for delete
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = atendimentos.unidade_id)
    );

-- 9. REDEFINIR POLÍTICAS RLS DA TABELA oficios COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "oficios_select_policy" on public.oficios;
create policy "oficios_select_policy"
    on public.oficios
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = oficios.unidade_id)
        and (
            get_my_cargo() = 'super_admin'
            or get_my_cargo() = 'chefia'
            or has_my_modulo('oficios_ver')
            or has_my_modulo('oficios_tramitar')
        )
    );

drop policy if exists "oficios_insert_policy" on public.oficios;
create policy "oficios_insert_policy"
    on public.oficios
    for insert
    to authenticated
    with check (
        created_by = auth.uid()
        and is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = oficios.unidade_id)
        and (
            get_my_cargo() = 'super_admin'
            or get_my_cargo() = 'chefia'
            or has_my_modulo('oficios_tramitar')
        )
    );

drop policy if exists "oficios_update_policy" on public.oficios;
create policy "oficios_update_policy"
    on public.oficios
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = oficios.unidade_id)
        and (
            get_my_cargo() = 'super_admin'
            or get_my_cargo() = 'chefia'
            or has_my_modulo('oficios_tramitar')
        )
    )
    with check (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = oficios.unidade_id)
        and (
            get_my_cargo() = 'super_admin'
            or get_my_cargo() = 'chefia'
            or has_my_modulo('oficios_tramitar')
        )
    );

drop policy if exists "oficios_delete_policy" on public.oficios;
create policy "oficios_delete_policy"
    on public.oficios
    for delete
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = oficios.unidade_id)
        and (
            get_my_cargo() = 'super_admin'
            or get_my_cargo() = 'chefia'
            or has_my_modulo('oficios_tramitar')
        )
    );

-- 10. REDEFINIR POLÍTICAS RLS DA TABELA oficios_historico COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "oficios_historico_select_policy" on public.oficios_historico;
create policy "oficios_historico_select_policy"
    on public.oficios_historico
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and exists (
            select 1 from public.oficios o
            where o.id = oficios_historico.oficio_id
              and (get_my_cargo() = 'super_admin' or o.unidade_id = get_my_unidade())
              and (
                  get_my_cargo() = 'super_admin'
                  or get_my_cargo() = 'chefia'
                  or has_my_modulo('oficios_ver')
                  or has_my_modulo('oficios_tramitar')
              )
        )
    );

drop policy if exists "oficios_historico_insert_policy" on public.oficios_historico;
create policy "oficios_historico_insert_policy"
    on public.oficios_historico
    for insert
    to authenticated
    with check (
        realizado_por = auth.uid()
        and is_my_ativo() = true
        and exists (
            select 1 from public.oficios o
            where o.id = oficios_historico.oficio_id
              and (get_my_cargo() = 'super_admin' or o.unidade_id = get_my_unidade())
              and (
                  get_my_cargo() = 'super_admin'
                  or get_my_cargo() = 'chefia'
                  or has_my_modulo('oficios_tramitar')
              )
        )
    );

-- 11. REDEFINIR POLÍTICAS RLS DA TABELA relatorios_agenda COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "relatorios_agenda_select_policy" on public.relatorios_agenda;
drop policy if exists "relatorios_select_own" on public.relatorios_agenda;
drop policy if exists "relatorios_select_audit" on public.relatorios_agenda;
drop policy if exists "relatorios_insert_own_unit" on public.relatorios_agenda;
drop policy if exists "relatorios_update_own_unit" on public.relatorios_agenda;
drop policy if exists "relatorios_delete_own_unit" on public.relatorios_agenda;
create policy "relatorios_agenda_select_policy"
    on public.relatorios_agenda
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (
            user_id = auth.uid()
            or (
                (get_my_cargo() = 'chefia' or has_my_modulo('visao_geral_auditoria') or get_my_cargo() = 'super_admin')
                and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
            )
        )
    );

drop policy if exists "relatorios_agenda_insert_policy" on public.relatorios_agenda;
create policy "relatorios_agenda_insert_policy"
    on public.relatorios_agenda
    for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    );

drop policy if exists "relatorios_agenda_update_policy" on public.relatorios_agenda;
create policy "relatorios_agenda_update_policy"
    on public.relatorios_agenda
    for update
    to authenticated
    using (
        user_id = auth.uid()
        and is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    )
    with check (
        user_id = auth.uid()
        and is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    );

drop policy if exists "relatorios_agenda_delete_policy" on public.relatorios_agenda;
create policy "relatorios_agenda_delete_policy"
    on public.relatorios_agenda
    for delete
    to authenticated
    using (
        user_id = auth.uid()
        and is_my_ativo() = true
        and (get_my_cargo() = 'super_admin' or get_my_unidade() = unidade_id)
    );

-- 12. REDEFINIR POLÍTICAS RLS DA TABELA logs_auditoria COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "logs_auditoria_select_policy" on public.logs_auditoria;
drop policy if exists "logs_auditoria_insert_autenticado" on public.logs_auditoria;
drop policy if exists "logs_auditoria_select_chefe_gabinete" on public.logs_auditoria;
create policy "logs_auditoria_select_policy"
    on public.logs_auditoria
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and (get_my_cargo() = 'chefia' or has_my_modulo('usuarios_gerenciar') or get_my_cargo() = 'super_admin')
        and (
            get_my_cargo() = 'super_admin'
            or exists (
                select 1 from public.perfis_usuarios executor
                where executor.id = logs_auditoria.realizado_por
                  and executor.unidade_id = get_my_unidade()
            )
        )
    );

drop policy if exists "logs_auditoria_insert_policy" on public.logs_auditoria;
create policy "logs_auditoria_insert_policy"
    on public.logs_auditoria
    for insert
    to authenticated
    with check (
        realizado_por = auth.uid()
        and is_my_ativo() = true
    );

-- 13. REDEFINIR POLÍTICAS RLS DA TABELA task_assignments COM VALIDAÇÃO DE ATIVO E SUPER ADMIN
drop policy if exists "task_assignments_select" on public.task_assignments;
create policy "task_assignments_select"
    on public.task_assignments
    for select
    to authenticated
    using (
        is_my_ativo() = true
        and exists (
            select 1 from public.tasks t
            where t.id = task_assignments.task_id
        )
    );

drop policy if exists "task_assignments_insert" on public.task_assignments;
create policy "task_assignments_insert"
    on public.task_assignments
    for insert
    to authenticated
    with check (
        is_my_ativo() = true
        and exists (
            select 1 from public.tasks t
            join public.perfis_usuarios p on p.id = auth.uid() and p.ativo = true
            where t.id = task_assignments.task_id
              and (
                  (t.tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade()))
                  or
                  (t.tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
              )
        )
    );

drop policy if exists "task_assignments_update" on public.task_assignments;
create policy "task_assignments_update"
    on public.task_assignments
    for update
    to authenticated
    using (
        is_my_ativo() = true
        and exists (
            select 1 from public.tasks t
            join public.perfis_usuarios p on p.id = auth.uid() and p.ativo = true
            where t.id = task_assignments.task_id
              and (
                  (t.tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade()))
                  or
                  (t.tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
              )
        )
    )
    with check (
        is_my_ativo() = true
        and exists (
            select 1 from public.tasks t
            join public.perfis_usuarios p on p.id = auth.uid() and p.ativo = true
            where t.id = task_assignments.task_id
              and (
                  (t.tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or t.unidade_id = get_my_unidade()))
                  or
                  (t.tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
              )
        )
    );

drop policy if exists "task_assignments_delete" on public.task_assignments;
create policy "task_assignments_delete"
    on public.task_assignments
    for delete
    to authenticated
    using (
        is_my_ativo() = true
        and exists (
            select 1 from public.tasks t
            join public.perfis_usuarios p on p.id = auth.uid() and p.ativo = true
            where t.id = task_assignments.task_id
              and (
                  (t.tipo_agenda = 'GLOBAL' and has_my_modulo('agenda_global_editar') and (get_my_cargo() = 'super_admin' or t.unidade_id = t.unidade_id))
                  or
                  (t.tipo_agenda = 'COMUNICACAO' and has_my_modulo('agenda_comunicacao_editar'))
              )
        )
    );

commit;
