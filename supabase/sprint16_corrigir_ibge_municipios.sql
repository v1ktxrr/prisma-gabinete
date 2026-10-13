-- Migration SQL to correct shifting IBGE codes for Mato Grosso do Sul municipalities
begin;

-- Temporarily set unique temporary codes to avoid unique constraint violations
UPDATE public.municipios SET codigo_ibge = 't000001' WHERE nome = 'Angélica';
UPDATE public.municipios SET codigo_ibge = 't000002' WHERE nome = 'Antônio João';
UPDATE public.municipios SET codigo_ibge = 't000003' WHERE nome = 'Aparecida do Taboado';
UPDATE public.municipios SET codigo_ibge = 't000004' WHERE nome = 'Aquidauana';
UPDATE public.municipios SET codigo_ibge = 't000005' WHERE nome = 'Aral Moreira';
UPDATE public.municipios SET codigo_ibge = 't000006' WHERE nome = 'Douradina';
UPDATE public.municipios SET codigo_ibge = 't000007' WHERE nome = 'Eldorado';
UPDATE public.municipios SET codigo_ibge = 't000008' WHERE nome = 'Fátima do Sul';
UPDATE public.municipios SET codigo_ibge = 't000009' WHERE nome = 'Figueirão';
UPDATE public.municipios SET codigo_ibge = 't000010' WHERE nome = 'Juti';
UPDATE public.municipios SET codigo_ibge = 't000011' WHERE nome = 'Ladário';
UPDATE public.municipios SET codigo_ibge = 't000012' WHERE nome = 'Laguna Carapã';

-- Apply correct official IBGE codes
UPDATE public.municipios SET codigo_ibge = '5000856' WHERE nome = 'Angélica';
UPDATE public.municipios SET codigo_ibge = '5000906' WHERE nome = 'Antônio João';
UPDATE public.municipios SET codigo_ibge = '5001003' WHERE nome = 'Aparecida do Taboado';
UPDATE public.municipios SET codigo_ibge = '5001102' WHERE nome = 'Aquidauana';
UPDATE public.municipios SET codigo_ibge = '5001243' WHERE nome = 'Aral Moreira';
UPDATE public.municipios SET codigo_ibge = '5003504' WHERE nome = 'Douradina';
UPDATE public.municipios SET codigo_ibge = '5003751' WHERE nome = 'Eldorado';
UPDATE public.municipios SET codigo_ibge = '5003801' WHERE nome = 'Fátima do Sul';
UPDATE public.municipios SET codigo_ibge = '5003900' WHERE nome = 'Figueirão';
UPDATE public.municipios SET codigo_ibge = '5005152' WHERE nome = 'Juti';
UPDATE public.municipios SET codigo_ibge = '5005202' WHERE nome = 'Ladário';
UPDATE public.municipios SET codigo_ibge = '5005251' WHERE nome = 'Laguna Carapã';

commit;
