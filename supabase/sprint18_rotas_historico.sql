-- Migration: Criação da tabela de histórico de rotas e localização para adequação LGPD
-- Objetivo: Rastrear pesquisas e trajetos de forma isolada por unidade e usuário, garantindo a RLS ativa.

CREATE TABLE IF NOT EXISTS public.rotas_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unidade_id VARCHAR(2) NOT NULL CHECK (unidade_id IN ('CG', 'DD')),
    origem TEXT NOT NULL,
    destino TEXT NOT NULL,
    latitude_origem NUMERIC(9,6) CHECK (latitude_origem BETWEEN -90 AND 90),
    longitude_origem NUMERIC(9,6) CHECK (longitude_origem BETWEEN -180 AND 180),
    latitude_destino NUMERIC(9,6) CHECK (latitude_destino BETWEEN -90 AND 90),
    longitude_destino NUMERIC(9,6) CHECK (longitude_destino BETWEEN -180 AND 180),
    distancia_metros INTEGER CHECK (distancia_metros >= 0),
    duracao_segundos INTEGER CHECK (duracao_segundos >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.rotas_historico ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para isolamento total do histórico por usuário
CREATE POLICY "Permitir select do próprio usuário"
    ON public.rotas_historico
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir insert do próprio usuário"
    ON public.rotas_historico
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir delete do próprio usuário"
    ON public.rotas_historico
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Adicionar comentários explicativos para auditoria
COMMENT ON TABLE public.rotas_historico IS 'Tabela que armazena histórico de buscas de rotas do usuário logado (LGPD Sensível).';
COMMENT ON COLUMN public.rotas_historico.user_id IS 'UUID de auth.users ao qual pertence este histórico.';
COMMENT ON COLUMN public.rotas_historico.unidade_id IS 'Unidade de controle (CG ou DD) que gerou o registro.';
