-- CasaEnRegla — programar el envío diario de notificaciones (8:30 hora Argentina = 11:30 UTC)
-- Pegar en Supabase > SQL Editor.
-- ⚠ ANTES de tocar "Run": reemplazá PONER_SECRETO por el valor de ROBOT_SECRETO (es el mismo secreto del robot).

select cron.schedule(
  'enviar-avisos-diario',
  '30 11 * * *',
  $$
  select net.http_post(
    url     := 'https://bytrghqvrpgcuvdbfnkn.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-robot', 'PONER_SECRETO'),
    body    := '{}'::jsonb
  );
  $$
);

-- Ver tareas programadas: select jobname, schedule, active from cron.job;
-- Para desprogramarlo:    select cron.unschedule('enviar-avisos-diario');
