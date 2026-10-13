-- ====================================================================
-- Script: security_policies.sql
-- Description: Defesas de RLS Multi-Tenant definitivas para o Prisma.
-- Applied on: Supabase PostgreSQL (public schema)
-- ====================================================================

BEGIN;

-- 1. ATIVAR RLS EM TODAS AS TABELAS CRÍTICAS
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniversariantes ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- SEÇÃO 1: HARDENING DA TABELA ANIVERSARIANTES (Fechando brechas)
-- ====================================================================

DROP POLICY IF EXISTS "aniversariantes_select_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_select_policy"
    ON public.aniversariantes
    FOR SELECT
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (get_my_cargo() = 'super_admin'::cargo_usuario) OR 
            ((get_my_unidade())::text = (unidade_id)::text)
        )
    );

DROP POLICY IF EXISTS "aniversariantes_insert_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_insert_policy"
    ON public.aniversariantes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (is_my_ativo() = true) AND (
            (get_my_cargo() = 'super_admin'::cargo_usuario) OR 
            ((get_my_unidade())::text = (unidade_id)::text)
        )
    );

DROP POLICY IF EXISTS "aniversariantes_update_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_update_policy"
    ON public.aniversariantes
    FOR UPDATE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (get_my_cargo() = 'super_admin'::cargo_usuario) OR 
            ((get_my_unidade())::text = (unidade_id)::text)
        )
    )
    WITH CHECK (
        (is_my_ativo() = true) AND (
            (get_my_cargo() = 'super_admin'::cargo_usuario) OR 
            ((get_my_unidade())::text = (unidade_id)::text)
        )
    );

DROP POLICY IF EXISTS "aniversariantes_delete_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_delete_policy"
    ON public.aniversariantes
    FOR DELETE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (get_my_cargo() = 'super_admin'::cargo_usuario) OR 
            ((get_my_unidade())::text = (unidade_id)::text)
        )
    );

-- ====================================================================
-- SEÇÃO 2: POLÍTICAS DE OFÍCIOS (Isolamento por Unidade + Permissões)
-- ====================================================================

DROP POLICY IF EXISTS "oficios_select_policy" ON public.oficios;
CREATE POLICY "oficios_select_policy"
    ON public.oficios
    FOR SELECT
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (get_my_cargo() = 'chefia'::cargo_usuario) OR has_my_modulo('oficios_ver'::text) OR has_my_modulo('oficios_tramitar'::text))
    );

DROP POLICY IF EXISTS "oficios_insert_policy" ON public.oficios;
CREATE POLICY "oficios_insert_policy"
    ON public.oficios
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (created_by = auth.uid()) AND 
        (is_my_ativo() = true) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (get_my_cargo() = 'chefia'::cargo_usuario) OR has_my_modulo('oficios_tramitar'::text))
    );

DROP POLICY IF EXISTS "oficios_update_policy" ON public.oficios;
CREATE POLICY "oficios_update_policy"
    ON public.oficios
    FOR UPDATE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (get_my_cargo() = 'chefia'::cargo_usuario) OR has_my_modulo('oficios_tramitar'::text))
    )
    WITH CHECK (
        (is_my_ativo() = true) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (get_my_cargo() = 'chefia'::cargo_usuario) OR has_my_modulo('oficios_tramitar'::text))
    );

DROP POLICY IF EXISTS "oficios_delete_policy" ON public.oficios;
CREATE POLICY "oficios_delete_policy"
    ON public.oficios
    FOR DELETE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (get_my_cargo() = 'chefia'::cargo_usuario) OR has_my_modulo('oficios_tramitar'::text))
    );

-- ====================================================================
-- SEÇÃO 3: POLÍTICAS DE BRIEFINGS (Isolamento Acoplado à Agenda/Tarefa)
-- ====================================================================

DROP POLICY IF EXISTS "briefings_select_policy" ON public.briefings;
CREATE POLICY "briefings_select_policy"
    ON public.briefings
    FOR SELECT
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        (has_my_modulo('briefing_editar'::text) OR has_my_modulo('agenda_comunicacao_ver'::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (agenda_id IS NULL) OR (EXISTS ( SELECT 1 FROM tasks t WHERE ((t.id = briefings.agenda_id) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((t.unidade_id)::text = (get_my_unidade())::text))))))
    );

DROP POLICY IF EXISTS "briefings_insert_policy" ON public.briefings;
CREATE POLICY "briefings_insert_policy"
    ON public.briefings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (is_my_ativo() = true) AND 
        (has_my_modulo('briefing_editar'::text) OR has_my_modulo('agenda_comunicacao_editar'::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (agenda_id IS NULL) OR (EXISTS ( SELECT 1 FROM tasks t WHERE ((t.id = briefings.agenda_id) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((t.unidade_id)::text = (get_my_unidade())::text))))))
    );

DROP POLICY IF EXISTS "briefings_update_policy" ON public.briefings;
CREATE POLICY "briefings_update_policy"
    ON public.briefings
    FOR UPDATE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        (has_my_modulo('briefing_editar'::text) OR has_my_modulo('agenda_comunicacao_editar'::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (agenda_id IS NULL) OR (EXISTS ( SELECT 1 FROM tasks t WHERE ((t.id = briefings.agenda_id) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((t.unidade_id)::text = (get_my_unidade())::text))))))
    )
    WITH CHECK (
        (is_my_ativo() = true) AND 
        (has_my_modulo('briefing_editar'::text) OR has_my_modulo('agenda_comunicacao_editar'::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (agenda_id IS NULL) OR (EXISTS ( SELECT 1 FROM tasks t WHERE ((t.id = briefings.agenda_id) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((t.unidade_id)::text = (get_my_unidade())::text))))))
    );

DROP POLICY IF EXISTS "briefings_delete_policy" ON public.briefings;
CREATE POLICY "briefings_delete_policy"
    ON public.briefings
    FOR DELETE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND 
        (has_my_modulo('briefing_editar'::text) OR has_my_modulo('agenda_comunicacao_editar'::text)) AND 
        ((get_my_cargo() = 'super_admin'::cargo_usuario) OR (agenda_id IS NULL) OR (EXISTS ( SELECT 1 FROM tasks t WHERE ((t.id = briefings.agenda_id) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((t.unidade_id)::text = (get_my_unidade())::text))))))
    );

-- ====================================================================
-- SEÇÃO 4: POLÍTICAS DE TASKS (Agenda Oficial / Pré-Agenda)
-- ====================================================================

DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy"
    ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (((tipo_agenda)::text = 'GLOBAL'::text) AND (has_my_modulo('agenda_global_ver'::text) OR has_my_modulo('agenda_global_editar'::text)) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text))) OR 
            (((tipo_agenda)::text = 'COMUNICACAO'::text) AND (has_my_modulo('agenda_comunicacao_ver'::text) OR has_my_modulo('agenda_comunicacao_editar'::text)))
        )
    );

DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy"
    ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (created_by = auth.uid()) AND 
        (is_my_ativo() = true) AND (
            (((tipo_agenda)::text = 'GLOBAL'::text) AND has_my_modulo('agenda_global_editar'::text) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text))) OR 
            (((tipo_agenda)::text = 'COMUNICACAO'::text) AND has_my_modulo('agenda_comunicacao_editar'::text))
        )
    );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy"
    ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (((tipo_agenda)::text = 'GLOBAL'::text) AND has_my_modulo('agenda_global_editar'::text) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text))) OR 
            (((tipo_agenda)::text = 'COMUNICACAO'::text) AND has_my_modulo('agenda_comunicacao_editar'::text))
        )
    )
    WITH CHECK (
        (is_my_ativo() = true) AND (
            (((tipo_agenda)::text = 'GLOBAL'::text) AND has_my_modulo('agenda_global_editar'::text) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text))) OR 
            (((tipo_agenda)::text = 'COMUNICACAO'::text) AND has_my_modulo('agenda_comunicacao_editar'::text))
        )
    );

DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy"
    ON public.tasks
    FOR DELETE
    TO authenticated
    USING (
        (is_my_ativo() = true) AND (
            (((tipo_agenda)::text = 'GLOBAL'::text) AND has_my_modulo('agenda_global_editar'::text) AND ((get_my_cargo() = 'super_admin'::cargo_usuario) OR ((get_my_unidade())::text = (unidade_id)::text))) OR 
            (((tipo_agenda)::text = 'COMUNICACAO'::text) AND has_my_modulo('agenda_comunicacao_editar'::text))
        )
    );

COMMIT;
