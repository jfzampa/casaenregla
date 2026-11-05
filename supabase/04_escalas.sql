-- CasaEnRegla — escalas salariales y parámetros (iguales para todos los usuarios)
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Cómo cargar un aumento: agregar 10 renglones nuevos en "escalas" con la nueva
-- vigencia_desde (ver ejemplo al final). NO borrar los anteriores: sirven para
-- recalcular meses pasados. La app siempre toma la vigencia más reciente que
-- corresponda al mes que se liquida.

create table public.escalas (
  id             bigint generated always as identity primary key,
  vigencia_desde date not null,
  categoria      smallint not null check (categoria between 1 and 5),
  modalidad      text not null check (modalidad in ('con_retiro','sin_retiro')),
  valor_hora     numeric(12,2) not null check (valor_hora > 0),
  valor_mensual  numeric(12,2) not null check (valor_mensual > 0),
  resolucion     text,
  unique (vigencia_desde, categoria, modalidad)
);

create table public.parametros (
  id             bigint generated always as identity primary key,
  clave          text not null,
  vigencia_desde date not null,
  valor          numeric(12,4) not null,
  descripcion    text,
  unique (clave, vigencia_desde)
);

-- Todos los usuarios logueados pueden LEER. Nadie puede modificar desde la app:
-- solo el dueño, desde el panel de Supabase.
alter table public.escalas    enable row level security;
alter table public.parametros enable row level security;
create policy "leer escalas"    on public.escalas    for select to authenticated using (true);
create policy "leer parametros" on public.parametros for select to authenticated using (true);

-- ===== Escala vigente desde 01/11/2026 — Res. CNTCP 7/2026 (fuente: upacp.org.ar/sueldos) =====
-- Caseros (3ª) no distingue modalidad: se carga igual en las dos.
insert into public.escalas (vigencia_desde, categoria, modalidad, valor_hora, valor_mensual, resolucion) values
  ('2026-11-01', 1, 'con_retiro', 4923.44, 614186.76, 'CNTCP 7/2026'),
  ('2026-11-01', 1, 'sin_retiro', 5339.08, 677369.70, 'CNTCP 7/2026'),
  ('2026-11-01', 2, 'con_retiro', 4695.59, 574828.75, 'CNTCP 7/2026'),
  ('2026-11-01', 2, 'sin_retiro', 5093.82, 633158.89, 'CNTCP 7/2026'),
  ('2026-11-01', 3, 'con_retiro', 4447.11, 562284.09, 'CNTCP 7/2026'),
  ('2026-11-01', 3, 'sin_retiro', 4447.11, 562284.09, 'CNTCP 7/2026'),
  ('2026-11-01', 4, 'con_retiro', 4447.11, 562284.09, 'CNTCP 7/2026'),
  ('2026-11-01', 4, 'sin_retiro', 4918.66, 619810.80, 'CNTCP 7/2026'),
  ('2026-11-01', 5, 'con_retiro', 4170.52, 511639.37, 'CNTCP 7/2026'),
  ('2026-11-01', 5, 'sin_retiro', 4447.11, 562284.09, 'CNTCP 7/2026');

insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('zona_desfavorable_pct', '2026-11-01', 31,   'Adicional % sobre mínimos: La Pampa, Río Negro, Chubut, Neuquén, Santa Cruz, Tierra del Fuego y Partido de Patagones'),
  ('antiguedad_pct_anual',  '2026-11-01', 1,    '% por año de antigüedad sobre el salario mensual (cómputo desde 01/09/2020)'),
  ('antiguedad_desde',      '2026-11-01', 20200901, 'Fecha (aaaammdd) desde la que se cuenta la antigüedad'),
  ('horas_mensualizado',    '2026-11-01', 24,   'Desde estas horas semanales se cobra el valor mensual proporcional; con menos, por hora');

-- ===== Ejemplo para un aumento futuro (no ejecutar hasta tener los valores) =====
-- insert into public.escalas (vigencia_desde, categoria, modalidad, valor_hora, valor_mensual, resolucion) values
--   ('2026-12-01', 1, 'con_retiro', 0000.00, 000000.00, 'CNTCP x/2026'),
--   ... (los 10 renglones)
