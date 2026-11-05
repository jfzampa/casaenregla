-- CasaEnRegla — portal del empleado (parte 1): vinculación por invitación, presentismo con ubicación,
-- novedades confirmadas por ambas partes y consulta de liquidaciones.
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Seguridad: el empleado NO lee las tablas directamente; usa funciones (security definer) que
-- solo devuelven lo suyo. El empleador sigue usando sus tablas con las reglas de siempre.

-- 1) Vínculo empleado ↔ usuario de la app
alter table public.empleados add column usuario_id uuid references auth.users(id) on delete set null;
create unique index empleados_usuario_por_empleador on public.empleados (empleador_id, usuario_id) where usuario_id is not null;

-- 2) Ubicación del lugar de trabajo (la marca el empleador desde "Mis datos")
alter table public.empleadores
  add column trabajo_lat double precision,
  add column trabajo_lng double precision;

-- 3) Novedades: presentismo y respuesta del empleado
alter table public.novedades drop constraint novedades_tipo_check;
alter table public.novedades add constraint novedades_tipo_check
  check (tipo in ('presente','falta_injustificada','falta_justificada','horas_extra_50','horas_extra_100','feriado_trabajado','nota'));
alter table public.novedades
  add column marcado_en           timestamptz,
  add column lat                  double precision,
  add column lng                  double precision,
  add column precision_m          numeric,
  add column distancia_m          numeric,          -- distancia al lugar de trabajo al marcar
  add column observacion_empleado text;             -- si el empleado no está conforme, el motivo

-- 4) Invitaciones (las crea el empleador; el link se manda por WhatsApp)
create table public.invitaciones (
  codigo       text primary key,
  empleador_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empleado_id  uuid not null references public.empleados(id) on delete cascade,
  creado       timestamptz not null default now(),
  usado_por    uuid references auth.users(id) on delete set null,
  usado_en     timestamptz
);
alter table public.invitaciones enable row level security;
create policy "mis invitaciones" on public.invitaciones for all
  using (empleador_id = auth.uid()) with check (empleador_id = auth.uid());

-- 5) Funciones del empleado ----------------------------------------------------------

-- Aceptar la invitación (confirma con su DNI)
create or replace function public.aceptar_invitacion(p_codigo text, p_dni text)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.invitaciones; emp public.empleados;
begin
  select * into inv from public.invitaciones where codigo = p_codigo;
  if not found then raise exception 'La invitación no existe.'; end if;
  if inv.usado_por is not null and inv.usado_por <> auth.uid() then raise exception 'La invitación ya fue usada.'; end if;
  if inv.creado < now() - interval '14 days' then raise exception 'La invitación venció: pedile una nueva a tu empleador.'; end if;
  select * into emp from public.empleados where id = inv.empleado_id;
  if emp.dni <> regexp_replace(coalesce(p_dni, ''), '\D', '', 'g') then raise exception 'El DNI no coincide con el que cargó tu empleador.'; end if;
  if emp.usuario_id is not null and emp.usuario_id <> auth.uid() then raise exception 'Este empleado ya está vinculado a otra cuenta.'; end if;
  update public.empleados set usuario_id = auth.uid() where id = emp.id;
  update public.invitaciones set usado_por = auth.uid(), usado_en = now() where codigo = p_codigo;
  return emp.nombre;
end $$;

-- Mis empleos (puede trabajar para más de un empleador)
create or replace function public.mi_empleo()
returns table (empleado_id uuid, nombre text, apellido text, categoria smallint, modalidad text, horas_semanales smallint,
               fecha_ingreso date, fecha_egreso date, empleador text, tiene_ubicacion boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.nombre, e.apellido, e.categoria, e.modalidad, e.horas_semanales, e.fecha_ingreso, e.fecha_egreso,
         coalesce(nullif(trim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, '')), ''), 'Tu empleador'),
         p.trabajo_lat is not null
  from public.empleados e left join public.empleadores p on p.id = e.empleador_id
  where e.usuario_id = auth.uid()
  order by e.fecha_egreso nulls first, e.fecha_ingreso desc;
$$;

-- Mis liquidaciones (solo lo que el empleado necesita ver)
create or replace function public.mis_liquidaciones(p_empleado uuid)
returns table (periodo date, estado text, neto numeric, total_remunerativo numeric, total_no_remun numeric,
               total_descuentos numeric, renglones jsonb, neto_letras text, pago_fecha date, pago_medio text, recibo_arca boolean)
language sql stable security definer set search_path = '' as $$
  select l.periodo, l.estado, l.neto, l.total_remunerativo, l.total_no_remun, l.total_descuentos,
         l.detalle -> 'renglones', l.detalle ->> 'neto_letras', l.pago_fecha, l.pago_medio, l.recibo_arca
  from public.liquidaciones l join public.empleados e on e.id = l.empleado_id
  where l.empleado_id = p_empleado and e.usuario_id = auth.uid()
  order by l.periodo desc;
$$;

-- Mis novedades de un período
create or replace function public.mis_novedades(p_empleado uuid, p_desde date, p_hasta date)
returns setof public.novedades
language sql stable security definer set search_path = '' as $$
  select n.* from public.novedades n join public.empleados e on e.id = n.empleado_id
  where n.empleado_id = p_empleado and e.usuario_id = auth.uid() and n.fecha >= p_desde and n.fecha < p_hasta
  order by n.fecha, n.creado;
$$;

-- Confirmar (o no) una novedad que cargó el empleador
create or replace function public.responder_novedad(p_id uuid, p_conforme boolean, p_observacion text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.novedades n set confirmado_empleado = p_conforme,
         observacion_empleado = case when p_conforme then null else nullif(trim(p_observacion), '') end
  from public.empleados e
  where n.id = p_id and e.id = n.empleado_id and e.usuario_id = auth.uid();
  if not found then raise exception 'Novedad no encontrada.'; end if;
end $$;

-- Cargar una novedad (ausencia, horas extra, nota): queda pendiente de confirmar por el empleador
create or replace function public.cargar_novedad_empleado(p_empleado uuid, p_fecha date, p_tipo text, p_horas numeric, p_descripcion text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare emp public.empleados; nuevo uuid;
begin
  select * into emp from public.empleados where id = p_empleado and usuario_id = auth.uid();
  if not found then raise exception 'No estás vinculado a este empleo.'; end if;
  if p_tipo not in ('falta_justificada','falta_injustificada','horas_extra_50','horas_extra_100','feriado_trabajado','nota') then
    raise exception 'Tipo de novedad no permitido.'; end if;
  insert into public.novedades (empleador_id, empleado_id, fecha, tipo, horas, descripcion, cargado_por, confirmado_empleador, confirmado_empleado)
  values (emp.empleador_id, emp.id, p_fecha, p_tipo, p_horas, nullif(trim(p_descripcion), ''), 'empleado', false, true)
  returning id into nuevo;
  return nuevo;
end $$;

-- Adjuntar el justificativo a una novedad propia
create or replace function public.adjuntar_justificativo(p_id uuid, p_ruta text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if split_part(p_ruta, '/', 1) <> auth.uid()::text then raise exception 'Ruta no permitida.'; end if;
  update public.novedades n set archivo = p_ruta
  from public.empleados e
  where n.id = p_id and e.id = n.empleado_id and e.usuario_id = auth.uid() and n.cargado_por = 'empleado';
end $$;

-- Marcar presente: guarda hora y ubicación de ESE momento y la distancia al lugar de trabajo
create or replace function public.marcar_presente(p_empleado uuid, p_lat double precision, p_lng double precision, p_precision numeric)
returns table (marcado timestamptz, distancia numeric, ya_estaba boolean)
language plpgsql security definer set search_path = '' as $$
declare emp public.empleados; lugar public.empleadores; hoy date; d numeric; existente public.novedades;
begin
  select * into emp from public.empleados where id = p_empleado and usuario_id = auth.uid();
  if not found then raise exception 'No estás vinculado a este empleo.'; end if;
  hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  select * into existente from public.novedades where empleado_id = emp.id and fecha = hoy and tipo = 'presente' limit 1;
  if found then return query select existente.marcado_en, existente.distancia_m, true; return; end if;
  select * into lugar from public.empleadores where id = emp.empleador_id;
  if lugar.trabajo_lat is not null and p_lat is not null then  -- distancia (fórmula del haversine), en metros
    d := round((6371000 * 2 * asin(sqrt(power(sin(radians(p_lat - lugar.trabajo_lat) / 2), 2) +
          cos(radians(lugar.trabajo_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - lugar.trabajo_lng) / 2), 2))))::numeric);
  end if;
  insert into public.novedades (empleador_id, empleado_id, fecha, tipo, marcado_en, lat, lng, precision_m, distancia_m,
                                cargado_por, confirmado_empleador, confirmado_empleado)
  values (emp.empleador_id, emp.id, hoy, 'presente', now(), p_lat, p_lng, p_precision, d, 'empleado', false, true);
  return query select now(), d, false;
end $$;

grant execute on function public.aceptar_invitacion(text, text), public.mi_empleo(), public.mis_liquidaciones(uuid),
  public.mis_novedades(uuid, date, date), public.responder_novedad(uuid, boolean, text),
  public.cargar_novedad_empleado(uuid, date, text, numeric, text), public.adjuntar_justificativo(uuid, text),
  public.marcar_presente(uuid, double precision, double precision, numeric) to authenticated;

-- 6) El empleador puede ver los justificativos que sube su personal (están en la carpeta del empleado)
create policy "empleador ve comprobantes de su personal" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] in (
    select usuario_id::text from public.empleados where empleador_id = auth.uid() and usuario_id is not null));
