-- Criação da tabela unidades
CREATE TABLE IF NOT EXISTS public.unidades (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    status TEXT DEFAULT 'ativo', -- pode ser 'ativo' ou 'suspenso'
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura publica para unidades"
    ON public.unidades FOR SELECT
    USING (true);

-- Sem políticas de INSERT/UPDATE/DELETE.
-- Escrita exclusiva de service_role (root cockpit).

-- Seed inicial de unidades extraídas de perfis_usuarios
INSERT INTO public.unidades (id, nome)
SELECT DISTINCT unidade_id, UPPER(unidade_id)
FROM public.perfis_usuarios
WHERE unidade_id IS NOT NULL AND unidade_id != ''
ON CONFLICT (id) DO NOTHING;

-- Seeding do Broadcast Banner em configuracoes_sistema
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
('broadcast_banner', '{"ativo": false, "mensagem": "O sistema passará por manutenção à meia-noite.", "tipo": "warning"}'::jsonb, 'Banner de anúncios global do sistema')
ON CONFLICT (chave) DO NOTHING;
