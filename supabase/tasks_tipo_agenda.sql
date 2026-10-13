begin;

alter table public.tasks
    add column if not exists tipo_agenda varchar(20);

update public.tasks
set tipo_agenda = 'GLOBAL'
where tipo_agenda is null;

alter table public.tasks
    alter column tipo_agenda set default 'GLOBAL';

alter table public.tasks
    alter column tipo_agenda set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'tasks_tipo_agenda_check'
    ) then
        alter table public.tasks
            add constraint tasks_tipo_agenda_check
            check (tipo_agenda in ('GLOBAL', 'COMUNICACAO'));
    end if;
end
$$;

create index if not exists idx_tasks_tipo_agenda
    on public.tasks (tipo_agenda);

commit;
