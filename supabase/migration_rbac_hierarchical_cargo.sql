-- Migration: Refactoring RBAC to hierarchical structure
-- Alters the cargo_usuario enum values and updates all related tables

-- 1. Rename existing enum values in cargo_usuario
ALTER TYPE public.cargo_usuario RENAME VALUE 'assessor' TO 'assessoria';
ALTER TYPE public.cargo_usuario RENAME VALUE 'chefe_gabinete' TO 'chefia';

-- 2. Add 'secretaria' to cargo_usuario
ALTER TYPE public.cargo_usuario ADD VALUE IF NOT EXISTS 'secretaria';

-- 3. Update existing records in public.profiles (since it is a text column)
UPDATE public.profiles SET cargo = 'assessoria' WHERE cargo = 'assessor';
UPDATE public.profiles SET cargo = 'chefia' WHERE cargo = 'chefe_gabinete';

-- 4. Update the handle_new_user trigger function default to 'assessoria'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
        cargo,
        unidade_id,
        modulos_acesso
    )
    values (
        new.id,
        v_nome,
        v_cargo,
        v_unidade_id,
        v_modulos_acesso
    )
    on conflict (id) do update
    set
        nome = excluded.nome,
        cargo = excluded.cargo,
        unidade_id = excluded.unidade_id,
        modulos_acesso = excluded.modulos_acesso;

    return new;
end;
$function$;

-- 5. Update raw_user_meta_data in auth.users for compatibility with Supabase Auth
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{cargo}', '"assessoria"')
WHERE raw_user_meta_data ->> 'cargo' = 'assessor';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{cargo}', '"chefia"')
WHERE raw_user_meta_data ->> 'cargo' = 'chefe_gabinete';
