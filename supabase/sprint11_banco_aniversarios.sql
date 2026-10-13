-- Migration SQL for Sprint 11: Banco de Aniversários (BDAY)
begin;

-- 1. CRIAÇÃO DA TABELA
CREATE TABLE IF NOT EXISTS public.aniversariantes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    cargo text,
    dia integer NOT NULL,
    mes integer NOT NULL,
    unidade_id varchar(2) NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_aniversariantes_dia CHECK (dia >= 1 AND dia <= 31),
    CONSTRAINT chk_aniversariantes_mes CHECK (mes >= 1 AND mes <= 12),
    CONSTRAINT chk_aniversariantes_unidade CHECK (unidade_id IN ('CG', 'DD'))
);

-- 2. ATIVAÇÃO DE RLS
ALTER TABLE public.aniversariantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniversariantes FORCE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE ACESSO
DROP POLICY IF EXISTS "aniversariantes_select_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_select_policy"
    ON public.aniversariantes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = aniversariantes.unidade_id
        )
    );

DROP POLICY IF EXISTS "aniversariantes_insert_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_insert_policy"
    ON public.aniversariantes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = aniversariantes.unidade_id
        )
    );

DROP POLICY IF EXISTS "aniversariantes_update_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_update_policy"
    ON public.aniversariantes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = aniversariantes.unidade_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = aniversariantes.unidade_id
        )
    );

DROP POLICY IF EXISTS "aniversariantes_delete_policy" ON public.aniversariantes;
CREATE POLICY "aniversariantes_delete_policy"
    ON public.aniversariantes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios p
            WHERE p.id = auth.uid()
              AND p.unidade_id = aniversariantes.unidade_id
        )
    );

-- 4. OTIMIZAÇÃO DE CONSULTAS (Índices por mês/dia e unidade)
CREATE INDEX IF NOT EXISTS idx_aniversariantes_mes_dia ON public.aniversariantes(mes, dia);
CREATE INDEX IF NOT EXISTS idx_aniversariantes_unidade_id ON public.aniversariantes(unidade_id);

-- 5. INSERÇÃO DE DADOS DE DEMONSTRAÇÃO (CG e DD)
INSERT INTO public.aniversariantes (nome, cargo, dia, mes, unidade_id) VALUES
  ('João da Silva', 'Prefeito Municipal', 24, 6, 'CG'),
  ('Deputado Estadual Exemplo', 'Assembleia Legislativa', 24, 6, 'CG'),
  ('Carlos Pereira', 'Presidente Partidário', 23, 6, 'CG'),
  ('Vereador Exemplo', 'Câmara Municipal', 23, 6, 'CG'),
  ('Prefeita Exemplo', 'Prefeitura', 25, 6, 'CG'),
  ('João da Silva (Regional)', 'Prefeito Municipal', 24, 6, 'DD'),
  ('Deputado Estadual (Regional)', 'Assembleia Legislativa', 24, 6, 'DD'),
  ('Carlos Pereira (Regional)', 'Presidente Partidário', 23, 6, 'DD'),
  ('Vereador Exemplo (Regional)', 'Câmara Municipal', 23, 6, 'DD'),
  ('Prefeita Exemplo (Regional)', 'Prefeitura', 25, 6, 'DD')
ON CONFLICT DO NOTHING;

commit;
