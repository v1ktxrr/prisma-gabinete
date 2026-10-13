-- Migration: Make anniversaries globally readable and manageable by all authenticated users
BEGIN;

DROP POLICY IF EXISTS "aniversariantes_select_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_select_policy"
    ON public.aniversariantes
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "aniversariantes_insert_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_insert_policy"
    ON public.aniversariantes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "aniversariantes_update_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_update_policy"
    ON public.aniversariantes
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "aniversariantes_delete_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_delete_policy"
    ON public.aniversariantes
    FOR DELETE
    TO authenticated
    USING (true);

COMMIT;
