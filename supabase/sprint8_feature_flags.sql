-- Criação da tabela configuracoes_sistema
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Select público (ou autenticado, dependendo de como as configs são consumidas)
-- Permitimos leitura pública para que o status do sistema possa ser lido antes do login, como no modo de manutenção.
CREATE POLICY "Leitura publica para configuracoes_sistema"
    ON public.configuracoes_sistema FOR SELECT
    USING (true);

-- Sem políticas de INSERT/UPDATE/DELETE.
-- Escrita será exclusiva de usuários com SUPABASE_SERVICE_ROLE_KEY.

-- Inserção de dados iniciais
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
('modo_manutencao', 'false'::jsonb, 'Ativa o modo de manutenção global bloqueando o uso'),
('sync_google', 'true'::jsonb, 'Habilita a sincronização em background com o Google Calendar')
ON CONFLICT (chave) DO NOTHING;
