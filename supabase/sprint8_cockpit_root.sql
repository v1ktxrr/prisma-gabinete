-- Migration: Sprint 8 - Cockpit de Root (Dynamic Domains & Logs)
-- Created by Senior Database Architect / DBA

-- 1. Tabela de Eixos Temáticos
CREATE TABLE IF NOT EXISTS public.eixos_tematicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave text UNIQUE NOT NULL,
    nome text NOT NULL,
    cor text NOT NULL DEFAULT '#64748b',
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Tabela de Formatos de Mídia
CREATE TABLE IF NOT EXISTS public.formatos_midia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave text UNIQUE NOT NULL,
    nome text NOT NULL,
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Tabela de Logs de Sistema
CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    classe text NOT NULL, -- ex: INFRA, METRICS_SYNC, GHOST_CLEANUP, DATABASE
    nivel text NOT NULL,  -- ex: ERROR, WARNING, INFO
    mensagem text NOT NULL,
    detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
    criado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS) em todas as novas tabelas
ALTER TABLE public.eixos_tematicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eixos_tematicos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.formatos_midia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formatos_midia FORCE ROW LEVEL SECURITY;

ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema FORCE ROW LEVEL SECURITY;

-- Políticas de RLS para eixos_tematicos
DROP POLICY IF EXISTS "eixos_tematicos_select_public" ON public.eixos_tematicos;
CREATE POLICY "eixos_tematicos_select_public"
    ON public.eixos_tematicos
    FOR SELECT
    TO authenticated
    USING (true);

-- Políticas de RLS para formatos_midia
DROP POLICY IF EXISTS "formatos_midia_select_public" ON public.formatos_midia;
CREATE POLICY "formatos_midia_select_public"
    ON public.formatos_midia
    FOR SELECT
    TO authenticated
    USING (true);

-- Nota: Não são criadas políticas de escrita (INSERT/UPDATE/DELETE) para eixos_tematicos ou formatos_midia,
-- e nenhuma política de SELECT/escrita para logs_sistema. Apenas chamadas com a service_role (que bypassa RLS)
-- serão capazes de realizar essas operações, conforme as validações do backend do Cockpit de Root.

-- Conceder permissões para usuários autenticados
GRANT SELECT ON public.eixos_tematicos TO authenticated;
GRANT SELECT ON public.formatos_midia TO authenticated;

-- 4. Função de Segurança para Auditoria de Usuários Fantasmas (Orphãos no Auth)
CREATE OR REPLACE FUNCTION public.obter_usuarios_fantasmas()
RETURNS TABLE(id uuid, email varchar, created_at timestamptz)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email::varchar, u.created_at
    FROM auth.users u
    LEFT JOIN public.perfis_usuarios p ON p.id = u.id
    WHERE p.id IS NULL 
      AND u.created_at < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.obter_usuarios_fantasmas() FROM public, anon, authenticated;
-- Apenas service_role ou superuser executa
GRANT EXECUTE ON FUNCTION public.obter_usuarios_fantasmas() TO service_role;

-- 5. Seed Data Inicial (valores anteriormente hardcoded)
INSERT INTO public.eixos_tematicos (chave, nome, cor) VALUES
    ('saude', 'Saúde', '#ef4444'),
    ('educacao', 'Educação', '#3b82f6'),
    ('seguranca', 'Segurança', '#f59e0b'),
    ('infraestrutura', 'Infraestrutura', '#10b981'),
    ('assistencia_social', 'Assistência Social', '#8b5cf6'),
    ('institucional', 'Institucional', '#64748b')
ON CONFLICT (chave) DO UPDATE SET 
    nome = EXCLUDED.nome,
    cor = EXCLUDED.cor;

INSERT INTO public.formatos_midia (chave, nome) VALUES
    ('video', 'Vídeo'),
    ('card', 'Card'),
    ('cobertura', 'Cobertura'),
    ('foto', 'Foto'),
    ('texto', 'Texto')
ON CONFLICT (chave) DO UPDATE SET 
    nome = EXCLUDED.nome;
