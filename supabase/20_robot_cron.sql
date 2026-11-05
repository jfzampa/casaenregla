-- CasaEnRegla — programar el robot para que corra solo todos los días a las 8:00 (hora Argentina = 11:00 UTC)
-- Pegar en Supabase > SQL Editor.
-- ⚠ ANTES de tocar "Run": reemplazá PONER_SECRETO por el mismo valor que cargaste en
--   Edge Functions > Secrets > ROBOT_SECRETO. (No se sube a GitHub con el valor real.)

-- 1) Activar las extensiones de tareas programadas (pg_cron) y de llamadas web (pg_net)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- 2) Programar el robot (si ya existía con este nombre, se reemplaza)
select cron.schedule(
  'robot-escalas-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := 'https://azaeasfifcamwqqlfztb.supabase.co/functions/v1/robot-escalas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-robot', 'PONER_SECRETO'),
    body    := '{}'::jsonb
  );
  $$
);

-- Para ver si corrió:   select * from public.robot_ejecuciones order by ejecutado desc limit 5;
-- Ver tareas programadas: select jobname, schedule, active from cron.job;
-- Para desprogramarlo:  select cron.unschedule('robot-escalas-diario');
