-- Migration SQL for Phase 5: Banco de Promessas & Alertas
begin;

CREATE TABLE IF NOT EXISTS public.demandas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
    municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
    solicitante text NOT NULL,
    descricao text NOT NULL,
    status text NOT NULL DEFAULT 'em_andamento',
    unidade_id varchar(2) NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_demandas_status CHECK (status IN ('em_andamento', 'entregue', 'negado')),
    CONSTRAINT chk_demandas_unidade CHECK (unidade_id IN ('CG', 'DD'))
);

-- Enable RLS
ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandas FORCE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "demandas_select_policy" ON public.demandas;
CREATE POLICY "demandas_select_policy"
    ON public.demandas
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = demandas.unidade_id
        )
    );

DROP POLICY IF EXISTS "demandas_insert_policy" ON public.demandas;
CREATE POLICY "demandas_insert_policy"
    ON public.demandas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = demandas.unidade_id
        )
    );

DROP POLICY IF EXISTS "demandas_update_policy" ON public.demandas;
CREATE POLICY "demandas_update_policy"
    ON public.demandas
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = demandas.unidade_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = demandas.unidade_id
        )
    );

DROP POLICY IF EXISTS "demandas_delete_policy" ON public.demandas;
CREATE POLICY "demandas_delete_policy"
    ON public.demandas
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = demandas.unidade_id
        )
    );

-- Indices for optimization
CREATE INDEX IF NOT EXISTS idx_demandas_atendimento_id ON public.demandas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_demandas_municipio_id ON public.demandas(municipio_id);
CREATE INDEX IF NOT EXISTS idx_demandas_municipio_status ON public.demandas(municipio_id, status);

commit;
