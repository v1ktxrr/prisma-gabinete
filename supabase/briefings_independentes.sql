begin;

alter table public.briefings
    alter column agenda_id drop not null;

alter table public.briefings
    add column if not exists titulo_customizado text,
    add column if not exists data_customizada date,
    add column if not exists hora_customizada time,
    add column if not exists local_customizado text;

commit;
