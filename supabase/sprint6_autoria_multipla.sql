-- Migration: Add multi-authorship and strategic categorization to tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS captacao_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS edicao_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS texto_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS publicacao_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS formato_midia varchar(50) NULL,
ADD COLUMN IF NOT EXISTS eixo_tematico varchar(50) NULL;
