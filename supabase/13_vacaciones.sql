-- CasaEnRegla — vacaciones: divisor para calcular el pago
-- Pegar completo en Supabase > SQL Editor > Run
--
-- 25 = como la LCT (art. 155): sueldo ÷ 25 × días, con "plus vacacional" (criterio más difundido).
-- 30 = "retribución normal y habitual" de la Ley 26.844, sin plus.
-- Se puede cambiar desde Admin > Parámetros.

insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('vacaciones_divisor', '2013-04-12', 25, 'Divisor del pago de vacaciones: 25 (con plus, como LCT art. 155) o 30 (sin plus)')
on conflict (clave, vigencia_desde) do nothing;
