-- CasaEnRegla — novedades día a día (presentismo): faltas, horas extra, feriados trabajados, notas
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Hoy las carga el empleador. Pensado para el futuro portal del empleado:
--   cargado_por = quién la cargó; confirmado_empleador / confirmado_empleado = acuerdo de ambas partes.

create table public.novedades (
  id                   uuid primary key default gen_random_uuid(),
  empleador_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empleado_id          uuid not null references public.empleados(id) on delete cascade,
  fecha                date not null,
  tipo                 text not null check (tipo in ('falta_injustificada','falta_justificada','horas_extra_50','horas_extra_100','feriado_trabajado','nota')),
  horas                numeric(5,2) check (horas is null or horas > 0),
  descripcion          text,
  archivo              text,               -- justificativo (certificado, etc.) en Storage
  cargado_por          text not null default 'empleador' check (cargado_por in ('empleador','empleado')),
  confirmado_empleador boolean not null default true,
  confirmado_empleado  boolean not null default false,
  creado               timestamptz not null default now()
);
create index novedades_empleado_fecha on public.novedades (empleado_id, fecha);

alter table public.novedades enable row level security;
create policy "ver mis novedades"       on public.novedades for select using (empleador_id = auth.uid());
create policy "cargar mis novedades"    on public.novedades for insert with check (empleador_id = auth.uid());
create policy "modificar mis novedades" on public.novedades for update using (empleador_id = auth.uid()) with check (empleador_id = auth.uid());
create policy "borrar mis novedades"    on public.novedades for delete using (empleador_id = auth.uid());
