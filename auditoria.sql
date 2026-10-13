-- Tabela de auditoria imutavel para eventos sensiveis da aplicacao.
create table if not exists public.logs_auditoria (
    id uuid primary key default gen_random_uuid(),
    acao text not null,
    descricao text not null,
    realizado_por uuid not null references auth.users(id),
    criado_em timestamp with time zone not null default now()
);

alter table public.logs_auditoria enable row level security;
alter table public.logs_auditoria force row level security;

-- Permissoes basicas para clientes Supabase. Rotas com service_role continuam bypassando RLS.
grant insert, select on public.logs_auditoria to authenticated;
revoke update, delete on public.logs_auditoria from anon, authenticated;

-- INSERT permitido somente para usuarios autenticados registrando a propria acao.
drop policy if exists "logs_auditoria_insert_autenticado" on public.logs_auditoria;
create policy "logs_auditoria_insert_autenticado"
    on public.logs_auditoria
    for insert
    to authenticated
    with check (auth.uid() = realizado_por);

-- SELECT exclusivo para usuarios com cargo chefe_gabinete em perfis_usuarios.
drop policy if exists "logs_auditoria_select_chefe_gabinete" on public.logs_auditoria;
create policy "logs_auditoria_select_chefe_gabinete"
    on public.logs_auditoria
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.perfis_usuarios p
            where p.id = auth.uid()
              and p.cargo = 'chefe_gabinete'
        )
    );

-- Sem policies de UPDATE ou DELETE: com RLS ativo, anon/authenticated nao conseguem alterar nem apagar registros.
