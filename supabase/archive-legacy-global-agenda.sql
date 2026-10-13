begin;

alter table public.tasks
    add column if not exists registro_status varchar(20) not null default 'ativo';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'tasks_registro_status_check'
    ) then
        alter table public.tasks
            add constraint tasks_registro_status_check
            check (registro_status in ('ativo', 'arquivado'));
    end if;
end
$$;

update public.tasks
set registro_status = 'ativo'
where registro_status is null;

commit;
