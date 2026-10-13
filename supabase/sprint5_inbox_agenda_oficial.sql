-- Migration SQL for Sprint 5: Inbox Funnel and Agenda Oficial Triaging

-- 1. ADD COLUMN
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_agenda_oficial boolean NOT NULL DEFAULT false;

-- 2. CREATE BEFORE UPDATE TRIGGER FOR ACCESS CONTROL
CREATE OR REPLACE FUNCTION public.validar_update_agenda_oficial()
RETURNS TRIGGER AS $$
DECLARE
    v_cargo public.cargo_usuario;
    v_modulos jsonb;
BEGIN
    -- Permitir o bypass se a alteração for feita pelo sistema/service_role (auth.uid() is null)
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF OLD.is_agenda_oficial IS DISTINCT FROM NEW.is_agenda_oficial THEN
        -- Get current user's cargo and modules from profiles
        SELECT cargo, modulos_acesso INTO v_cargo, v_modulos
        FROM public.perfis_usuarios
        WHERE id = auth.uid();

        IF v_cargo IS NULL OR (
            v_cargo::text NOT IN ('secretaria', 'chefia', 'super_admin') AND
            NOT (v_modulos ? 'agenda_global_editar')
        ) THEN
            RAISE EXCEPTION 'Apenas usuários da secretaria, chefia ou com permissão agenda_global_editar podem alterar o status de Agenda Oficial.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_validar_update_agenda_oficial ON public.tasks;

CREATE TRIGGER trigger_validar_update_agenda_oficial
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validar_update_agenda_oficial();
