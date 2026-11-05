-- CasaEnRegla — robot de escalas y aportes (paso B): tablas donde deja lo que encuentra
-- Pegar completo en Supabase > SQL Editor > Run
--
-- El robot (Edge Function "robot-escalas") revisa UPACP y ARCA todos los días.
-- NUNCA carga valores oficiales: deja "hallazgos" pendientes que el admin revisa y aprueba.

create table public.robot_hallazgos (
  id      uuid primary key default gen_random_uuid(),
  tipo    text not null check (tipo in ('escala','escala_diferente','aportes')),
  clave   text not null unique,            -- ej.: escala:2026-12-01 / aportes:2026-12 (evita repetir avisos)
  datos   jsonb not null,
  creado  timestamptz not null default now(),
  estado  text not null default 'pendiente' check (estado in ('pendiente','aplicado','descartado'))
);

create table public.robot_ejecuciones (
  id         bigint generated always as identity primary key,
  ejecutado  timestamptz not null default now(),
  informe    text
);

alter table public.robot_hallazgos   enable row level security;
alter table public.robot_ejecuciones enable row level security;
create policy "admin ve hallazgos"      on public.robot_hallazgos   for select to authenticated using (public.es_admin());
create policy "admin resuelve hallazgos" on public.robot_hallazgos  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin ve ejecuciones"    on public.robot_ejecuciones for select to authenticated using (public.es_admin());
-- (el robot escribe con la clave de servicio, que no pasa por estas reglas)
