begin;

alter table public.tasks
    add column if not exists google_event_id text,
    add column if not exists unidade_id varchar(2);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'tasks_unidade_id_check'
    ) then
        alter table public.tasks
            add constraint tasks_unidade_id_check
            check (unidade_id in ('CG', 'DD'));
    end if;
end
$$;

create unique index if not exists idx_tasks_google_event_id_unidade
    on public.tasks (google_event_id, unidade_id);

commit;
