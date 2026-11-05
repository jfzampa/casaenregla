-- CasaEnRegla — liquidación mensual
-- Pegar completo en Supabase > SQL Editor > Run

-- 1) Datos nuevos en la ficha del empleado
alter table public.empleados
  add column es_jubilado      boolean not null default false,
  add column descuenta_aporte boolean not null default false,  -- solo con acuerdo previo con el empleado
  add column conceptos_fijos  jsonb   not null default '[]';   -- conceptos que se repiten todos los meses

-- 2) Montos fijos de ARCA (aportes, contribuciones y ART). Se actualizan todos los meses.
--    tipo:   activo | menor (16 a 18 años) | jubilado
--    franja: menos_12 | 12_a_16 | 16_o_mas (horas semanales)
create table public.aportes_arca (
  id                bigint generated always as identity primary key,
  periodo_desde     date not null,
  tipo              text not null check (tipo in ('activo','menor','jubilado')),
  franja            text not null check (franja in ('menos_12','12_a_16','16_o_mas')),
  aporte_os         numeric(12,2) not null,  -- Aportes (Agentes de Seguro de Salud)
  contribucion_sipa numeric(12,2) not null,  -- Contribuciones (SIPA)
  cuota_art         numeric(12,2) not null,  -- Cuota ART
  unique (periodo_desde, tipo, franja)
);
alter table public.aportes_arca enable row level security;
create policy "leer aportes" on public.aportes_arca for select to authenticated using (true);

-- Período noviembre 2026 (vence en diciembre 2026). Fuente: ARCA, "Casas-particulares-aportes-y-contribuciones-11-26.pdf"
insert into public.aportes_arca (periodo_desde, tipo, franja, aporte_os, contribucion_sipa, cuota_art) values
  ('2026-11-01', 'activo',   'menos_12',  2084.85,   729.90,  8138.91),
  ('2026-11-01', 'activo',   '12_a_16',   3863.30,  1459.48, 11840.02),
  ('2026-11-01', 'activo',   '16_o_mas', 25694.55,  2128.79, 17201.29),
  ('2026-11-01', 'menor',    'menos_12',  2084.85,     0,     8138.91),
  ('2026-11-01', 'menor',    '12_a_16',   3863.30,     0,    11840.02),
  ('2026-11-01', 'menor',    '16_o_mas', 25694.55,     0,    17201.29),
  ('2026-11-01', 'jubilado', 'menos_12',     0,      729.90,  8138.91),
  ('2026-11-01', 'jubilado', '12_a_16',      0,     1459.48, 11840.02),
  ('2026-11-01', 'jubilado', '16_o_mas',     0,     2128.79, 17201.29);

-- 3) Liquidaciones: una por empleado y mes
create table public.liquidaciones (
  id                 uuid primary key default gen_random_uuid(),
  empleador_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empleado_id        uuid not null references public.empleados(id) on delete cascade,
  periodo            date not null check (extract(day from periodo) = 1),  -- primer día del mes liquidado
  novedades          jsonb not null default '{}',   -- faltas, horas extra, otros conceptos, etc.
  detalle            jsonb not null default '[]',   -- renglones calculados
  total_remunerativo numeric(14,2) not null default 0,
  total_no_remun     numeric(14,2) not null default 0,
  total_descuentos   numeric(14,2) not null default 0,
  neto               numeric(14,2) not null default 0,
  pago_arca          numeric(14,2) not null default 0,  -- aportes + contribuciones + ART a pagar en ARCA
  estado             text not null default 'borrador' check (estado in ('borrador','confirmada','pagada')),
  recibo_arca        boolean not null default false,    -- ya se emitió el recibo oficial en ARCA
  pago_fecha         date,
  pago_medio         text check (pago_medio in ('transferencia','efectivo','otro')),
  pago_transaccion   text,                              -- nº de transacción (RG 5850, deducción Ganancias)
  creado             timestamptz not null default now(),
  actualizado        timestamptz not null default now(),
  unique (empleado_id, periodo)
);
alter table public.liquidaciones enable row level security;
create policy "ver mis liquidaciones"       on public.liquidaciones for select using (empleador_id = auth.uid());
create policy "cargar mis liquidaciones"    on public.liquidaciones for insert with check (empleador_id = auth.uid());
create policy "modificar mis liquidaciones" on public.liquidaciones for update using (empleador_id = auth.uid()) with check (empleador_id = auth.uid());
create policy "borrar mis liquidaciones"    on public.liquidaciones for delete using (empleador_id = auth.uid());
