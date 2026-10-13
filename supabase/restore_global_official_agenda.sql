begin;

update public.tasks
set registro_status = 'ativo'
where registro_status = 'arquivado'
  and coalesce(tipo_agenda, 'GLOBAL') = 'GLOBAL'
  and (
      google_event_id is not null
      or event_type = 'agenda_oficial'
      or (
          event_type is null
          and (
              created_by is not null
              or unidade_id is not null
          )
      )
  );

commit;
