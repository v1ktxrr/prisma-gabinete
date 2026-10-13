begin;

alter table public.briefings
    add column if not exists status varchar(20) not null default 'RASCUNHO';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'briefings_status_check'
    ) then
        alter table public.briefings
            add constraint briefings_status_check
            check (status in ('RASCUNHO', 'FINALIZADO'));
    end if;
end
$$;

commit;
