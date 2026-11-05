-- CasaEnRegla — liquidación final: baja del empleado
-- Pegar completo en Supabase > SQL Editor > Run
-- Se completa sola al guardar una liquidación con "Este mes termina la relación".

alter table public.empleados
  add column fecha_egreso date,
  add column causa_egreso text check (causa_egreso in ('renuncia','despido_sin_causa','periodo_prueba','mutuo_acuerdo','despido_con_causa'));
