begin;

create table if not exists public.briefings (
    id uuid primary key default gen_random_uuid(),
    agenda_id uuid not null unique references public.tasks(id) on delete cascade,
    organizacao text,
    contato_local text,
    traje text,
    apoio_governo_ms text,
    autoridades jsonb not null default '[]'::jsonb,
    cronograma jsonb not null default '[]'::jsonb,
    contexto_geral text,
    destaques_ms text,
    info_confidencial text,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists idx_briefings_agenda_id on public.briefings (agenda_id);

create or replace function public.set_briefings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
    new.atualizado_em = now();
    return new;
end;
$function$;

drop trigger if exists trg_briefings_updated_at on public.briefings;
create trigger trg_briefings_updated_at
before update on public.briefings
for each row
execute function public.set_briefings_updated_at();

commit;
