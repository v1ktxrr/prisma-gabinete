-- Migration: Sprint 12 - Cockpit de Root Advanced Security
-- Created to support database telemetry, session management, and LGPD features

-- 1. obter_tamanho_banco()
CREATE OR REPLACE FUNCTION public.obter_tamanho_banco()
RETURNS bigint
SECURITY DEFINER
AS $$
BEGIN
    RETURN pg_database_size(current_database());
END;
$$ LANGUAGE plpgsql;

-- 2. obter_tamanho_tabelas()
CREATE OR REPLACE FUNCTION public.obter_tamanho_tabelas()
RETURNS TABLE(tabela text, tamanho bigint)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        relname::text AS tabela,
        pg_total_relation_size(c.oid) AS tamanho
    FROM 
        pg_class c
    JOIN 
        pg_namespace n ON n.oid = c.relnamespace
    WHERE 
        n.nspname = 'public'
        AND c.relkind = 'r'
    ORDER BY 
        tamanho DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. obter_sessoes_ativas()
CREATE OR REPLACE FUNCTION public.obter_sessoes_ativas()
RETURNS TABLE(
    id uuid,
    user_id uuid,
    email text,
    ip text,
    user_agent text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    aal text
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        u.email::text,
        s.ip::text,
        s.user_agent,
        s.created_at,
        s.updated_at,
        s.aal::text
    FROM auth.sessions s
    LEFT JOIN auth.users u ON u.id = s.user_id
    ORDER BY s.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. revogar_sessao(session_id uuid)
CREATE OR REPLACE FUNCTION public.revogar_sessao(session_id uuid)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth.sessions WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

-- Restringir permissões de execução
REVOKE ALL ON FUNCTION public.obter_tamanho_banco() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_tamanho_banco() TO service_role;

REVOKE ALL ON FUNCTION public.obter_tamanho_tabelas() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_tamanho_tabelas() TO service_role;

REVOKE ALL ON FUNCTION public.obter_sessoes_ativas() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_sessoes_ativas() TO service_role;

REVOKE ALL ON FUNCTION public.revogar_sessao(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_sessao(uuid) TO service_role;
