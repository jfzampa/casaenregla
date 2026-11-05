-- CasaEnRegla — criterio de vacaciones: general 30 y elegible por cada empleador
-- Pegar completo en Supabase > SQL Editor > Run  (después del 13)

-- 1) Criterio general: 30 (sin plus)
insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('vacaciones_divisor', '2013-04-12', 30, 'Divisor general del pago de vacaciones: 30 (sin plus). Cada empleador puede elegir 25 en Mis datos.')
on conflict (clave, vigencia_desde) do update set valor = excluded.valor, descripcion = excluded.descripcion;

-- 2) Cada empleador puede elegir su criterio (vacío = usa el general)
alter table public.empleadores
  add column vacaciones_divisor smallint check (vacaciones_divisor in (25, 30));
