-- Migration SQL: Add telefone to public.aniversariantes
begin;

ALTER TABLE public.aniversariantes ADD COLUMN IF NOT EXISTS telefone text;

commit;
