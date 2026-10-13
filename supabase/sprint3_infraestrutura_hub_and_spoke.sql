-- Migration SQL for Sprint 3: Hub-and-Spoke Infrastructure
begin;

-- 1. CRIAÇÃO DO HUB (public.atendimentos)
CREATE TABLE IF NOT EXISTS public.atendimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data timestamptz NOT NULL DEFAULT now(),
    titulo text NOT NULL,
    status text NOT NULL,
    unidade_id varchar(2) NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_atendimentos_status CHECK (status IN ('aberto', 'em_andamento', 'concluido', 'arquivado')),
    CONSTRAINT chk_atendimentos_unidade CHECK (unidade_id IN ('CG', 'DD'))
);

-- 2. ATIVAÇÃO DE SEGURANÇA (RLS)
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atendimentos_select_policy" ON public.atendimentos;
CREATE POLICY "atendimentos_select_policy"
    ON public.atendimentos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = atendimentos.unidade_id
        )
    );

DROP POLICY IF EXISTS "atendimentos_insert_policy" ON public.atendimentos;
CREATE POLICY "atendimentos_insert_policy"
    ON public.atendimentos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = atendimentos.unidade_id
        )
    );

DROP POLICY IF EXISTS "atendimentos_update_policy" ON public.atendimentos;
CREATE POLICY "atendimentos_update_policy"
    ON public.atendimentos
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = atendimentos.unidade_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = atendimentos.unidade_id
        )
    );

DROP POLICY IF EXISTS "atendimentos_delete_policy" ON public.atendimentos;
CREATE POLICY "atendimentos_delete_policy"
    ON public.atendimentos
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = atendimentos.unidade_id
        )
    );

-- 3. CONEXÃO DOS SPOKES (Foreign Keys)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS atendimento_id uuid;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_atendimento;
ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_atendimento FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE SET NULL;

ALTER TABLE public.briefings ADD COLUMN IF NOT EXISTS atendimento_id uuid;
ALTER TABLE public.briefings DROP CONSTRAINT IF EXISTS fk_briefings_atendimento;
ALTER TABLE public.briefings ADD CONSTRAINT fk_briefings_atendimento FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE SET NULL;

-- 4. OTIMIZAÇÃO DE CONSULTAS (Índices)
CREATE INDEX IF NOT EXISTS idx_tasks_atendimento_id ON public.tasks(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_briefings_atendimento_id ON public.briefings(atendimento_id);

commit;
