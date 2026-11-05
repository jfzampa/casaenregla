-- CasaEnRegla — costo total del mes para el empleador
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Costo total = neto al empleado + VEP a ARCA
--             = asignaciones (remunerativas + no remunerativas) + aportes y contribuciones a cargo del empleador
-- Se calcula solo (no hace falta cargarlo) y sirve para el historial y la deducción de Ganancias.

alter table public.liquidaciones
  add column costo_total numeric(14,2) generated always as (neto + pago_arca) stored,
  -- lo realmente pagado: sueldo + VEP (cuando ya están registrados)
  add column costo_real  numeric(14,2) generated always as (pago_importe + vep_importe) stored;
