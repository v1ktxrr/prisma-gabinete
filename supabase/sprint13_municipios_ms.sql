-- Migration SQL for Sprint 13: Municípios de MS & Geocodificação
begin;

-- 1. CRIAÇÃO DA TABELA DE MUNICÍPIOS
CREATE TABLE IF NOT EXISTS public.municipios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    codigo_ibge varchar(7) UNIQUE NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2. ATIVAÇÃO DE SEGURANÇA (RLS)
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "municipios_select_authenticated" ON public.municipios;
CREATE POLICY "municipios_select_authenticated"
    ON public.municipios
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. INSERÇÃO DOS 79 MUNICÍPIOS DE MATO GROSSO DO SUL
INSERT INTO public.municipios (nome, codigo_ibge) VALUES
('Água Clara', '5000203'),
('Alcinópolis', '5000252'),
('Amambai', '5000609'),
('Anastácio', '5000708'),
('Anaurilândia', '5000807'),
('Angélica', '5000906'),
('Antônio João', '5001003'),
('Aparecida do Taboado', '5001102'),
('Aquidauana', '5001201'),
('Aral Moreira', '5001409'),
('Bandeirantes', '5001508'),
('Bataguassu', '5001904'),
('Batayporã', '5002001'),
('Bela Vista', '5002100'),
('Bodoquena', '5002159'),
('Bonito', '5002209'),
('Brasilândia', '5002308'),
('Caarapó', '5002407'),
('Camapuã', '5002605'),
('Campo Grande', '5002704'),
('Caracol', '5002803'),
('Cassilândia', '5002902'),
('Chapadão do Sul', '5002951'),
('Corguinho', '5003108'),
('Coronel Sapucaia', '5003157'),
('Corumbá', '5003207'),
('Costa Rica', '5003256'),
('Coxim', '5003306'),
('Deodápolis', '5003454'),
('Dois Irmãos do Buriti', '5003488'),
('Douradina', '5003751'),
('Dourados', '5003702'),
('Eldorado', '5003801'),
('Fátima do Sul', '5003900'),
('Figueirão', '5003959'),
('Glória de Dourados', '5004007'),
('Guia Lopes da Laguna', '5004106'),
('Iguatemi', '5004304'),
('Inocência', '5004403'),
('Itaporã', '5004502'),
('Itaquiraí', '5004601'),
('Ivinhema', '5004700'),
('Japorã', '5004809'),
('Jaraguari', '5004908'),
('Jardim', '5005004'),
('Jateí', '5005103'),
('Juti', '5005202'),
('Ladário', '5005251'),
('Laguna Carapã', '5005301'),
('Maracaju', '5005400'),
('Miranda', '5005608'),
('Mundo Novo', '5005681'),
('Naviraí', '5005707'),
('Nioaque', '5005806'),
('Nova Alvorada do Sul', '5006002'),
('Nova Andradina', '5006200'),
('Novo Horizonte do Sul', '5006259'),
('Paraíso das Águas', '5006275'),
('Paranaíba', '5006309'),
('Paranhos', '5006358'),
('Pedro Gomes', '5006408'),
('Ponta Porã', '5006606'),
('Porto Murtinho', '5006903'),
('Ribas do Rio Pardo', '5007109'),
('Rio Brilhante', '5007208'),
('Rio Negro', '5007307'),
('Rio Verde de Mato Grosso', '5007406'),
('Rochedo', '5007505'),
('Santa Rita do Pardo', '5007554'),
('São Gabriel do Oeste', '5007695'),
('Selvíria', '5007802'),
('Sete Quedas', '5007703'),
('Sidrolândia', '5007901'),
('Sonora', '5007935'),
('Tacuru', '5007950'),
('Taquarussu', '5007976'),
('Terenos', '5008008'),
('Três Lagoas', '5008305'),
('Vicentina', '5008404')
ON CONFLICT (codigo_ibge) DO UPDATE SET nome = EXCLUDED.nome;

-- 4. ADIÇÃO DE CHAVES ESTRANGEIRAS NAS TABELAS CORE
-- A. Tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS municipio_id uuid;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_municipio;
ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_municipio FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_municipio_id ON public.tasks(municipio_id);

-- B. Briefings
ALTER TABLE public.briefings ADD COLUMN IF NOT EXISTS municipio_id uuid;
ALTER TABLE public.briefings DROP CONSTRAINT IF EXISTS fk_briefings_municipio;
ALTER TABLE public.briefings ADD CONSTRAINT fk_briefings_municipio FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_briefings_municipio_id ON public.briefings(municipio_id);

-- C. Atendimentos
ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS municipio_id uuid;
ALTER TABLE public.atendimentos DROP CONSTRAINT IF EXISTS fk_atendimentos_municipio;
ALTER TABLE public.atendimentos ADD CONSTRAINT fk_atendimentos_municipio FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_atendimentos_municipio_id ON public.atendimentos(municipio_id);

-- D. Aniversariantes (Contatos)
ALTER TABLE public.aniversariantes ADD COLUMN IF NOT EXISTS municipio_id uuid;
ALTER TABLE public.aniversariantes DROP CONSTRAINT IF EXISTS fk_aniversariantes_municipio;
ALTER TABLE public.aniversariantes ADD CONSTRAINT fk_aniversariantes_municipio FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_aniversariantes_municipio_id ON public.aniversariantes(municipio_id);

COMMIT;
