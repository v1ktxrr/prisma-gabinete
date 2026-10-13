begin;

alter table public.briefings
    add column if not exists tipo_localidade varchar(20) not null default 'INTERIOR';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'briefings_tipo_localidade_check'
    ) then
        alter table public.briefings
            add constraint briefings_tipo_localidade_check
            check (tipo_localidade in ('INTERIOR', 'CAPITAL'));
    end if;
end
$$;

commit;
