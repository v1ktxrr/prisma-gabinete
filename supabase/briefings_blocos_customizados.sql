begin;

alter table public.briefings
    add column if not exists blocos_customizados jsonb not null default '[]'::jsonb;

update public.briefings
set blocos_customizados = jsonb_build_array(
    jsonb_build_object(
        'id', 'contexto_geral',
        'titulo', 'Contexto Geral do Evento',
        'conteudo_html', case
            when contexto_geral is null or btrim(contexto_geral) = '' then ''
            else '<p>' || replace(contexto_geral, E'\n', '</p><p>') || '</p>'
        end,
        'sigiloso', false
    ),
    jsonb_build_object(
        'id', 'destaques_ms',
        'titulo', 'Destaques do MS / Protagonismo',
        'conteudo_html', case
            when destaques_ms is null or btrim(destaques_ms) = '' then ''
            else '<p>' || replace(destaques_ms, E'\n', '</p><p>') || '</p>'
        end,
        'sigiloso', false
    ),
    jsonb_build_object(
        'id', 'info_confidencial',
        'titulo', 'Informações Confidenciais',
        'conteudo_html', case
            when info_confidencial is null or btrim(info_confidencial) = '' then ''
            else '<p>' || replace(info_confidencial, E'\n', '</p><p>') || '</p>'
        end,
        'sigiloso', true
    )
)
where blocos_customizados = '[]'::jsonb
  and (
      contexto_geral is not null
      or destaques_ms is not null
      or info_confidencial is not null
  );

commit;
