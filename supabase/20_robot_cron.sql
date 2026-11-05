-- CasaEnRegla — programar el robot para que corra solo todos los días a las 8:00 (hora Argentina = 11:00 UTC)
-- Pegar en Supabase > SQL Editor.
-- ⚠ ANTES de tocar "Run": reemplazá PONER_SECRETO por el mismo valor que cargaste en
--   Edge Functions > Secrets > ROBOT_SECRETO. (No se sube a GitHub con el valor real.)
-- Requiere las extensiones pg_cron y pg_net activadas (Database > Extensions).

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
-- Para desprogramarlo:  select cron.unschedule('robot-escalas-diario');
