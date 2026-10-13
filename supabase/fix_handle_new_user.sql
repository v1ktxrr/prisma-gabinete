create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_nome text;
    v_cargo public.cargo_usuario;
    v_unidade_id varchar(2);
    v_modulos_acesso jsonb;
begin
    v_nome := coalesce(new.raw_user_meta_data ->> 'full_name', new.email, '');
    v_cargo := coalesce(new.raw_user_meta_data ->> 'cargo', 'assessor')::public.cargo_usuario;
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
