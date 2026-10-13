-- Migration SQL for Sprint 4: Módulo de Ofícios (Sistema de Protocolo)
begin;

-- DROP DAS TABELAS CASO JÁ EXISTAM PARA RECRIAÇÃO LIMPA
DROP TABLE IF EXISTS public.oficios_historico CASCADE;
DROP TABLE IF EXISTS public.oficios CASCADE;

-- 1. CRIAÇÃO DA TABELA DE OFÍCIOS
CREATE TABLE public.oficios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid,
    unidade_id varchar(2) NOT NULL,
    numero text NOT NULL,
    titulo text NOT NULL,
    destinatario text NOT NULL,
    status text NOT NULL,
    data_emissao date NOT NULL,
    prazo_resposta date,
    data_recebimento timestamptz,
    created_by uuid NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_oficios_atendimento FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE SET NULL,
    CONSTRAINT fk_oficios_created_by FOREIGN KEY (created_by) REFERENCES public.profiles(id),
    CONSTRAINT chk_oficios_unidade CHECK (unidade_id IN ('CG', 'DD')),
    CONSTRAINT chk_oficios_status CHECK (status IN ('pendente', 'em_analise', 'encaminhado', 'concluido', 'arquivado'))
);

-- 2. CRIAÇÃO DA TABELA DE HISTÓRICO DE TRAMITAÇÃO
CREATE TABLE public.oficios_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    oficio_id uuid NOT NULL,
    acao text NOT NULL,
    descricao text,
    realizado_por uuid NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_historico_oficio FOREIGN KEY (oficio_id) REFERENCES public.oficios(id) ON DELETE CASCADE,
    CONSTRAINT fk_historico_realizado_por FOREIGN KEY (realizado_por) REFERENCES public.profiles(id)
);

-- 3. CRIAÇÃO DE ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_oficios_atendimento_id ON public.oficios(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_oficios_unidade_id ON public.oficios(unidade_id);
CREATE INDEX IF NOT EXISTS idx_oficios_created_by ON public.oficios(created_by);
CREATE INDEX IF NOT EXISTS idx_oficios_status ON public.oficios(status);

CREATE INDEX IF NOT EXISTS idx_historico_oficio_id ON public.oficios_historico(oficio_id);
CREATE INDEX IF NOT EXISTS idx_historico_realizado_por ON public.oficios_historico(realizado_por);

-- 4. TRIGGER PARA ATUALIZAR O CAMPO atualizado_em
CREATE OR REPLACE FUNCTION public.set_oficios_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oficios_updated_at ON public.oficios;
CREATE TRIGGER trg_oficios_updated_at
BEFORE UPDATE ON public.oficios
FOR EACH ROW
EXECUTE FUNCTION public.set_oficios_updated_at();

-- 5. ATIVAÇÃO DO RLS
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficios FORCE ROW LEVEL SECURITY;

ALTER TABLE public.oficios_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficios_historico FORCE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE SEGURANÇA (RLS) - OFÍCIOS
-- SELECT
DROP POLICY IF EXISTS "oficios_select_policy" ON public.oficios;
CREATE POLICY "oficios_select_policy"
    ON public.oficios
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = (select auth.uid())
              AND p.unidade_id = oficios.unidade_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_ver'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
    );

-- INSERT
DROP POLICY IF EXISTS "oficios_insert_policy" ON public.oficios;
CREATE POLICY "oficios_insert_policy"
    ON public.oficios
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = (select auth.uid())
              AND p.unidade_id = oficios.unidade_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
        AND created_by = (select auth.uid())
    );

-- UPDATE
DROP POLICY IF EXISTS "oficios_update_policy" ON public.oficios;
CREATE POLICY "oficios_update_policy"
    ON public.oficios
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = (select auth.uid())
              AND p.unidade_id = oficios.unidade_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = (select auth.uid())
              AND p.unidade_id = oficios.unidade_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
    );

-- DELETE
DROP POLICY IF EXISTS "oficios_delete_policy" ON public.oficios;
CREATE POLICY "oficios_delete_policy"
    ON public.oficios
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = (select auth.uid())
              AND p.unidade_id = oficios.unidade_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
    );

-- 7. POLÍTICAS DE SEGURANÇA (RLS) - HISTÓRICO DE TRAMITAÇÃO
-- SELECT: apenas históricos de ofícios que pertencem à unidade do usuário logado
DROP POLICY IF EXISTS "oficios_historico_select_policy" ON public.oficios_historico;
CREATE POLICY "oficios_historico_select_policy"
    ON public.oficios_historico
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.oficios o
            JOIN public.perfis_usuarios p ON p.id = (select auth.uid()) AND p.unidade_id = o.unidade_id
            WHERE o.id = oficios_historico.oficio_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_ver'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
    );

-- INSERT: apenas inserir histórico se o ofício pertence à unidade do usuário logado e realizado_por = usuário logado
DROP POLICY IF EXISTS "oficios_historico_insert_policy" ON public.oficios_historico;
CREATE POLICY "oficios_historico_insert_policy"
    ON public.oficios_historico
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.oficios o
            JOIN public.perfis_usuarios p ON p.id = (select auth.uid()) AND p.unidade_id = o.unidade_id
            WHERE o.id = oficios_historico.oficio_id
              AND (
                  p.cargo = 'chefia'
                  OR p.modulos_acesso ? 'oficios_tramitar'
              )
        )
        AND realizado_por = (select auth.uid())
    );

COMMIT;
