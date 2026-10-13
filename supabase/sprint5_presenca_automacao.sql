-- Migration SQL for Sprint 5: Presence Check-in Automation

-- 1. ADD VALUE TO ENUM
ALTER TYPE public.categoria_evento ADD VALUE IF NOT EXISTS 'participacao';

-- 2. CREATE OR REPLACE FUNCTION FOR PRESENCE TRIGGER (INSERT / UPDATE / DELETE)
CREATE OR REPLACE FUNCTION public.registrar_presenca_relatorio()
RETURNS TRIGGER AS $$
DECLARE
    v_titulo text;
    v_tipo_agenda text;
    v_unidade_id varchar;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Only run when activity_type is 'captacao'
        IF OLD.activity_type = 'captacao' THEN
            -- Get task info
            SELECT titulo INTO v_titulo
            FROM public.tasks
            WHERE id = OLD.task_id;

            -- Delete matching reports in relatorios_agenda
            DELETE FROM public.relatorios_agenda
            WHERE user_id = OLD.user_id
              AND categoria = 'participacao'::public.categoria_evento
              AND (
                  descricao_resolucao = 'Presença confirmada na Agenda Global - ' || v_titulo
                  OR descricao_resolucao = 'Estive presente  - ' || v_titulo
              );
        END IF;
        RETURN OLD;
    ELSE
        -- INSERT or UPDATE
        -- Only run when activity_type is 'captacao' (presence confirmed)
        IF NEW.activity_type = 'captacao' THEN
            -- Get task info
            SELECT titulo, tipo_agenda INTO v_titulo, v_tipo_agenda
            FROM public.tasks
            WHERE id = NEW.task_id;

            -- We only care about GLOBAL agenda tasks
            IF v_tipo_agenda = 'GLOBAL' THEN
                -- Get user's unit
                SELECT unidade_id INTO v_unidade_id
                FROM public.perfis_usuarios
                WHERE id = NEW.user_id;

                -- Check if a report for this user and task already exists to avoid duplicates
                IF NOT EXISTS (
                    SELECT 1
                    FROM public.relatorios_agenda
                    WHERE user_id = NEW.user_id
                      AND categoria = 'participacao'::public.categoria_evento
                      AND (
                          descricao_resolucao = 'Presença confirmada na Agenda Global - ' || v_titulo
                          OR descricao_resolucao = 'Estive presente  - ' || v_titulo
                      )
                ) THEN
                    INSERT INTO public.relatorios_agenda (
                        user_id,
                        unidade_id,
                        categoria,
                        descricao_resolucao,
                        data_evento,
                        valor_gasto
                    ) VALUES (
                        NEW.user_id,
                        COALESCE(v_unidade_id, 'CG'),
                        'participacao'::public.categoria_evento,
                        'Estive presente  - ' || v_titulo,
                        CURRENT_DATE,
                        0.00
                    );
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger trigger_registrar_presenca_relatorio
DROP TRIGGER IF EXISTS trigger_registrar_presenca_relatorio ON public.task_assignments;

CREATE TRIGGER trigger_registrar_presenca_relatorio
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.registrar_presenca_relatorio();


-- 3. FUTURE PRESENCE CHECK-IN PREVENTION
CREATE OR REPLACE FUNCTION public.validar_presenca_futura()
RETURNS TRIGGER AS $$
DECLARE
    v_data_inicio timestamp with time zone;
    v_tipo_agenda text;
BEGIN
    -- Only check for presence assignments (activity_type = 'captacao')
    IF NEW.activity_type = 'captacao' THEN
        SELECT data_inicio, tipo_agenda INTO v_data_inicio, v_tipo_agenda
        FROM public.tasks
        WHERE id = NEW.task_id;

        IF v_tipo_agenda = 'GLOBAL' AND v_data_inicio IS NOT NULL AND v_data_inicio > NOW() THEN
            RAISE EXCEPTION 'Não é permitido registrar presença em compromissos futuros.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger trigger_validar_presenca_futura
DROP TRIGGER IF EXISTS trigger_validar_presenca_futura ON public.task_assignments;

CREATE TRIGGER trigger_validar_presenca_futura
BEFORE INSERT OR UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validar_presenca_futura();
