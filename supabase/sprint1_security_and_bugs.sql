-- migration SQL for Sprint 1: Security Shielding and Bug Fixes
begin;

-- 1. CLEAN UP OBSOLETE RECORD VALUES (DOMAIN ALIGNMENT)
-- Update any tasks with status 'agendado' to 'pendente'
UPDATE public.tasks
SET status = 'pendente'::text::public.task_status
WHERE status = 'agendado';

-- Update any relatorios_agenda with categoria 'despesa' or 'visita_base' to 'atendimento'
UPDATE public.relatorios_agenda
SET categoria = 'atendimento'::text::public.categoria_evento
WHERE categoria IN ('despesa', 'visita_base');


-- 2. DROP DEPENDENT VIEWS TEMPORARILY
DROP VIEW IF EXISTS public.v_calendario;


-- 3. RECREATE ENUMS WITHOUT GHOST VALUES
-- Recreate task_status enum to remove 'agendado'
ALTER TYPE public.task_status RENAME TO task_status_old;
CREATE TYPE public.task_status AS ENUM ('pendente', 'publicado');
ALTER TABLE public.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.tasks
    ALTER COLUMN status TYPE public.task_status
    USING status::text::public.task_status;
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'pendente'::public.task_status;
DROP TYPE public.task_status_old;

-- Recreate categoria_evento enum to remove 'despesa' and 'visita_base'
ALTER TYPE public.categoria_evento RENAME TO categoria_evento_old;
CREATE TYPE public.categoria_evento AS ENUM ('atendimento', 'reuniao', 'visita', 'representacao');
ALTER TABLE public.relatorios_agenda
    ALTER COLUMN categoria TYPE public.categoria_evento
    USING categoria::text::public.categoria_evento;
DROP TYPE public.categoria_evento_old;


-- 4. RECREATE DEPENDENT VIEWS
CREATE OR REPLACE VIEW public.v_calendario AS
 SELECT (t.id)::text AS id,
    t.titulo AS title,
    COALESCE(t.data_inicio, t.data_publicacao, t.created_at) AS start,
    COALESCE(t.data_fim, t.data_publicacao, t.created_at) AS "end",
    (t.status)::text AS status,
    (t.event_type)::text AS event_type,
    t.descricao,
    t.post_url,
    t.metrics_snapshot,
    t.tema
   FROM public.tasks t;


-- 5. DROP EXISTING POLICIES FOR TASKS AND TASK_ASSIGNMENTS
DROP POLICY IF EXISTS "tasks_delete_authenticated" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_authenticated" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_authenticated" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_authenticated" ON public.tasks;

DROP POLICY IF EXISTS "Task assignments deletable by authenticated users" ON public.task_assignments;
DROP POLICY IF EXISTS "Task assignments insertable by authenticated users" ON public.task_assignments;
DROP POLICY IF EXISTS "Task assignments updatable by authenticated users" ON public.task_assignments;
DROP POLICY IF EXISTS "Task assignments viewable by everyone" ON public.task_assignments;


-- 6. HARDEN SECURITY AND POLICIES FOR public.briefings
-- Enable and force RLS
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefings FORCE ROW LEVEL SECURITY;

-- SELECT policy: read requires briefing_editar OR agenda_comunicacao_ver.
-- If linked to an agenda event (tasks), the user's unit must match the event's unit.
DROP POLICY IF EXISTS "briefings_select_policy" ON public.briefings;
CREATE POLICY "briefings_select_policy"
    ON public.briefings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'briefing_editar' OR p.modulos_acesso ? 'agenda_comunicacao_ver')
              AND (
                  briefings.agenda_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.tasks t
                      WHERE t.id = briefings.agenda_id
                        AND t.unidade_id = p.unidade_id
                  )
              )
        )
    );

-- INSERT policy: insert requires briefing_editar OR agenda_comunicacao_editar.
-- If linked, unit must match.
DROP POLICY IF EXISTS "briefings_insert_policy" ON public.briefings;
CREATE POLICY "briefings_insert_policy"
    ON public.briefings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'briefing_editar' OR p.modulos_acesso ? 'agenda_comunicacao_editar')
              AND (
                  briefings.agenda_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.tasks t
                      WHERE t.id = briefings.agenda_id
                        AND t.unidade_id = p.unidade_id
                  )
              )
        )
    );

-- UPDATE policy: update requires briefing_editar OR agenda_comunicacao_editar.
-- If linked, unit must match.
DROP POLICY IF EXISTS "briefings_update_policy" ON public.briefings;
CREATE POLICY "briefings_update_policy"
    ON public.briefings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'briefing_editar' OR p.modulos_acesso ? 'agenda_comunicacao_editar')
              AND (
                  briefings.agenda_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.tasks t
                      WHERE t.id = briefings.agenda_id
                        AND t.unidade_id = p.unidade_id
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'briefing_editar' OR p.modulos_acesso ? 'agenda_comunicacao_editar')
              AND (
                  briefings.agenda_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.tasks t
                      WHERE t.id = briefings.agenda_id
                        AND t.unidade_id = p.unidade_id
                  )
              )
        )
    );

-- DELETE policy: delete requires briefing_editar OR agenda_comunicacao_editar.
-- If linked, unit must match.
DROP POLICY IF EXISTS "briefings_delete_policy" ON public.briefings;
CREATE POLICY "briefings_delete_policy"
    ON public.briefings
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'briefing_editar' OR p.modulos_acesso ? 'agenda_comunicacao_editar')
              AND (
                  briefings.agenda_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.tasks t
                      WHERE t.id = briefings.agenda_id
                        AND t.unidade_id = p.unidade_id
                  )
              )
        )
    );


-- 7. HARDEN SECURITY AND POLICIES FOR public.tasks
-- Enforce RLS forcing
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- SELECT policy: GLOBAL (agenda_global_ver or agenda_global_editar + same unit) or COMUNICACAO (agenda_comunicacao_ver or agenda_comunicacao_editar)
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy"
    ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        (tipo_agenda = 'GLOBAL' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'agenda_global_ver' OR p.modulos_acesso ? 'agenda_global_editar')
              AND p.unidade_id = tasks.unidade_id
        ))
        OR
        (tipo_agenda = 'COMUNICACAO' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND (p.modulos_acesso ? 'agenda_comunicacao_ver' OR p.modulos_acesso ? 'agenda_comunicacao_editar')
        ))
    );

-- INSERT policy: created_by = auth.uid() + appropriate editorial write rights
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy"
    ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND (
            (tipo_agenda = 'GLOBAL' AND EXISTS (
                SELECT 1 FROM public.perfis_usuarios p
                WHERE p.id = auth.uid()
                  AND p.modulos_acesso ? 'agenda_global_editar'
                  AND p.unidade_id = tasks.unidade_id
            ))
            OR
            (tipo_agenda = 'COMUNICACAO' AND EXISTS (
                SELECT 1 FROM public.perfis_usuarios p
                WHERE p.id = auth.uid()
                  AND p.modulos_acesso ? 'agenda_comunicacao_editar'
            ))
        )
    );

-- UPDATE policy: appropriate editorial write rights
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy"
    ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        (tipo_agenda = 'GLOBAL' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_global_editar'
              AND p.unidade_id = tasks.unidade_id
        ))
        OR
        (tipo_agenda = 'COMUNICACAO' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_comunicacao_editar'
        ))
    )
    WITH CHECK (
        (tipo_agenda = 'GLOBAL' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_global_editar'
              AND p.unidade_id = tasks.unidade_id
        ))
        OR
        (tipo_agenda = 'COMUNICACAO' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_comunicacao_editar'
        ))
    );

-- DELETE policy: appropriate editorial write rights
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy"
    ON public.tasks
    FOR DELETE
    TO authenticated
    USING (
        (tipo_agenda = 'GLOBAL' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_global_editar'
              AND p.unidade_id = tasks.unidade_id
        ))
        OR
        (tipo_agenda = 'COMUNICACAO' AND EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.modulos_acesso ? 'agenda_comunicacao_editar'
        ))
    );


-- 8. HARDEN SECURITY AND POLICIES FOR public.task_assignments
-- Enforce RLS forcing
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;

-- SELECT policy: only viewable if the corresponding task is viewable
DROP POLICY IF EXISTS "task_assignments_select" ON public.task_assignments;
CREATE POLICY "task_assignments_select"
    ON public.task_assignments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_assignments.task_id
        )
    );

-- INSERT policy: only insertable if the user is allowed to edit/write to the corresponding task
DROP POLICY IF EXISTS "task_assignments_insert" ON public.task_assignments;
CREATE POLICY "task_assignments_insert"
    ON public.task_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.perfis_usuarios p ON p.id = auth.uid()
            WHERE t.id = task_assignments.task_id
              AND (
                  (t.tipo_agenda = 'GLOBAL' AND p.modulos_acesso ? 'agenda_global_editar' AND p.unidade_id = t.unidade_id)
                  OR
                  (t.tipo_agenda = 'COMUNICACAO' AND p.modulos_acesso ? 'agenda_comunicacao_editar')
              )
        )
    );

-- UPDATE policy: only updatable if the user is allowed to edit/write to the corresponding task
DROP POLICY IF EXISTS "task_assignments_update" ON public.task_assignments;
CREATE POLICY "task_assignments_update"
    ON public.task_assignments
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.perfis_usuarios p ON p.id = auth.uid()
            WHERE t.id = task_assignments.task_id
              AND (
                  (t.tipo_agenda = 'GLOBAL' AND p.modulos_acesso ? 'agenda_global_editar' AND p.unidade_id = t.unidade_id)
                  OR
                  (t.tipo_agenda = 'COMUNICACAO' AND p.modulos_acesso ? 'agenda_comunicacao_editar')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.perfis_usuarios p ON p.id = auth.uid()
            WHERE t.id = task_assignments.task_id
              AND (
                  (t.tipo_agenda = 'GLOBAL' AND p.modulos_acesso ? 'agenda_global_editar' AND p.unidade_id = t.unidade_id)
                  OR
                  (t.tipo_agenda = 'COMUNICACAO' AND p.modulos_acesso ? 'agenda_comunicacao_editar')
              )
        )
    );

-- DELETE policy: only deletable if the user is allowed to edit/write to the corresponding task
DROP POLICY IF EXISTS "task_assignments_delete" ON public.task_assignments;
CREATE POLICY "task_assignments_delete"
    ON public.task_assignments
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.perfis_usuarios p ON p.id = auth.uid()
            WHERE t.id = task_assignments.task_id
              AND (
                  (t.tipo_agenda = 'GLOBAL' AND p.modulos_acesso ? 'agenda_global_editar' AND p.unidade_id = t.unidade_id)
                  OR
                  (t.tipo_agenda = 'COMUNICACAO' AND p.modulos_acesso ? 'agenda_comunicacao_editar')
              )
        )
    );

commit;
