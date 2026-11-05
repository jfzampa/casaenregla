-- CasaEnRegla — avisos: feriados (para calcular días hábiles) y parámetros de vencimientos
-- Pegar completo en Supabase > SQL Editor > Run  (después del 10)

create table public.feriados (
  fecha       date primary key,
  descripcion text not null
);
alter table public.feriados enable row level security;
create policy "leer feriados"        on public.feriados for select to authenticated using (true);
create policy "admin escribe feriados" on public.feriados for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Feriados nacionales (Ley 27.399). Los trasladables se movieron según la regla general
-- (martes/miércoles → lunes anterior; jueves/viernes → lunes siguiente): VERIFICAR con el decreto de cada año
-- y agregar desde "Admin > Feriados" los que decida el Gobierno (puentes, feriados especiales, etc.).
insert into public.feriados (fecha, descripcion) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-02-16', 'Carnaval'),
  ('2026-02-17', 'Carnaval'),
  ('2026-03-24', 'Día de la Memoria'),
  ('2026-04-02', 'Malvinas'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajador'),
  ('2026-05-25', 'Revolución de Mayo'),
  ('2026-06-15', 'Güemes (trasladado del 17/6 — verificar)'),
  ('2026-06-20', 'Belgrano'),
  ('2026-07-09', 'Independencia'),
  ('2026-08-17', 'San Martín'),
  ('2026-10-12', 'Diversidad Cultural'),
  ('2026-11-23', 'Soberanía Nacional (trasladado del 20/11 — verificar)'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-02-08', 'Carnaval'),
  ('2027-02-09', 'Carnaval'),
  ('2027-03-24', 'Día de la Memoria'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-04-02', 'Malvinas'),
  ('2027-05-01', 'Día del Trabajador'),
  ('2027-05-25', 'Revolución de Mayo'),
  ('2027-06-21', 'Güemes (trasladado del 17/6 — verificar)'),
  ('2027-06-20', 'Belgrano'),
  ('2027-07-09', 'Independencia'),
  ('2027-08-16', 'San Martín (trasladado del 17/8 — verificar)'),
  ('2027-10-11', 'Diversidad Cultural (trasladado del 12/10 — verificar)'),
  ('2027-11-20', 'Soberanía Nacional'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-25', 'Navidad')
on conflict (fecha) do nothing;

insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('vep_dia_vencimiento',  '2020-01-01', 10, 'Día del mes siguiente en que vence el VEP de aportes (si es feriado, el hábil siguiente). Aproximado: confirmar en el calendario de ARCA.'),
  ('periodo_prueba_meses', '2026-03-06', 6,  'Ley 27.802 (art. 7 Ley 26.844): período de prueba de 6 meses')
on conflict (clave, vigencia_desde) do nothing;
