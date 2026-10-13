-- Supabase SQL Script: Safe cleanup of test users for homologation
-- Created by Senior Supabase DBA

-- Define the list of test user IDs to be removed
-- The primary super_admin user is strictly excluded and preserved.

DO $$
DECLARE
    test_user_ids uuid[] := ARRAY[
        '55f33d52-fd1f-4a20-9b2e-9940093641b2'::uuid, -- Chefe de Gabinete
        '7982a089-668f-4aee-b5f1-faf2dc44c7ae'::uuid, -- Comunicação Teste
        '17170006-c6df-423c-be76-12dea7696845'::uuid, -- Chefe CG Teste
        '0052c656-7f87-4e41-b92d-93c4ad57422a'::uuid, -- Assessor Teste
        '093a6050-2cc8-4736-8ec5-62debb96bb56'::uuid, -- Assessor DD Teste
        '0a1a4167-2391-4353-8416-1e6111a6597d'::uuid, -- testador 2
        '3a1f3ed9-fe67-421e-a952-4fa835bc665c'::uuid  -- auditor
    ];
BEGIN
    -- 1. Remove records from operational tables to avoid foreign key constraint violations

    -- task_assignments refers to tasks(id) and profiles(id)
    DELETE FROM public.task_assignments WHERE user_id = ANY(test_user_ids);

    -- tasks refers to profiles(id) via created_by
    DELETE FROM public.tasks WHERE created_by = ANY(test_user_ids);

    -- relatorios_agenda refers to perfis_usuarios(id) via user_id
    DELETE FROM public.relatorios_agenda WHERE user_id = ANY(test_user_ids);

    -- oficios_historico refers to profiles(id) via realizado_por
    DELETE FROM public.oficios_historico WHERE realizado_por = ANY(test_user_ids);

    -- oficios refers to profiles(id) via created_by
    DELETE FROM public.oficios WHERE created_by = ANY(test_user_ids);

    -- logs_auditoria refers to auth.users(id) via realizado_por
    DELETE FROM public.logs_auditoria WHERE realizado_por = ANY(test_user_ids);

    -- 2. Remove records from public profile and permission tables

    -- public.perfis_usuarios refers to auth.users(id)
    DELETE FROM public.perfis_usuarios WHERE id = ANY(test_user_ids);

    -- public.profiles refers to auth.users(id)
    DELETE FROM public.profiles WHERE id = ANY(test_user_ids);

    -- 3. Remove users permanently from Supabase Auth
    DELETE FROM auth.users WHERE id = ANY(test_user_ids);

    RAISE NOTICE 'Cleanup completed successfully. 7 test users and their operational records have been removed.';
END $$;
