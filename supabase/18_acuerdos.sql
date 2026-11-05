-- CasaEnRegla — portal del empleado (parte 2): acuerdos y comunicaciones con firma electrónica
-- Pegar completo en Supabase > SQL Editor > Run  (después del 17)
--
-- Firma electrónica (Ley 25.506): el empleado acepta estando identificado (su cuenta), confirma con su DNI,
-- y queda registrada fecha y hora, dispositivo, IP y la huella (SHA-256) del texto. El texto no se puede
-- modificar una vez enviado (no hay permiso de edición); si cambia, se envía un acuerdo nuevo.

create extension if not exists pgcrypto with schema extensions;

create table public.acuerdos (
  id              uuid primary key default gen_random_uuid(),
  empleador_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  tipo            text not null check (tipo in ('medio_pago','descuento_aporte','vacaciones','horario','preaviso','comunicacion','otro')),
  titulo          text not null,
  texto           text not null,
  requiere_firma  boolean not null default true,
  huella          text generated always as (encode(extensions.digest(titulo || E'\n' || texto, 'sha256'), 'hex')) stored,
  creado          timestamptz not null default now(),
  estado          text not null default 'pendiente' check (estado in ('pendiente','aceptado','rechazado','leido')),
  leido_en        timestamptz,
  respondido_en   timestamptz,
  respondido_por  uuid references auth.users(id) on delete set null,
  observacion     text,             -- motivo si el empleado no acepta
  firma_ip        text,
  firma_dispositivo text
);
create index acuerdos_empleado on public.acuerdos (empleado_id, creado desc);

alter table public.acuerdos enable row level security;
create policy "ver mis acuerdos"    on public.acuerdos for select using (empleador_id = auth.uid());
create policy "enviar acuerdos"     on public.acuerdos for insert with check (empleador_id = auth.uid() and estado = 'pendiente');
-- el empleador solo puede borrar los que todavía nadie respondió; no puede editarlos
create policy "anular pendientes"   on public.acuerdos for delete using (empleador_id = auth.uid() and estado = 'pendiente' and leido_en is null);

-- ---- Funciones del empleado ----

create or replace function public.mis_acuerdos(p_empleado uuid)
returns setof public.acuerdos
language sql stable security definer set search_path = '' as $$
  select a.* from public.acuerdos a join public.empleados e on e.id = a.empleado_id
  where a.empleado_id = p_empleado and e.usuario_id = auth.uid()
  order by (a.estado = 'pendiente') desc, a.creado desc;
$$;

-- Marcar como leído (al abrirlo). Las comunicaciones que no requieren firma quedan en estado "leido".
create or replace function public.leer_acuerdo(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.acuerdos a set leido_en = coalesce(a.leido_en, now()),
         estado = case when not a.requiere_firma and a.estado = 'pendiente' then 'leido' else a.estado end
  from public.empleados e
  where a.id = p_id and e.id = a.empleado_id and e.usuario_id = auth.uid();
end $$;

-- Firmar (aceptar) o rechazar. Para aceptar hay que confirmar el DNI.
create or replace function public.responder_acuerdo(p_id uuid, p_acepta boolean, p_dni text default null, p_observacion text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare ac public.acuerdos; emp public.empleados; hdr json;
begin
  select a.* into ac from public.acuerdos a join public.empleados e on e.id = a.empleado_id
  where a.id = p_id and e.usuario_id = auth.uid();
  if not found then raise exception 'Acuerdo no encontrado.'; end if;
  if ac.estado <> 'pendiente' then raise exception 'Este acuerdo ya fue respondido.'; end if;
  select * into emp from public.empleados where id = ac.empleado_id;
  if p_acepta and emp.dni <> regexp_replace(coalesce(p_dni, ''), '\D', '', 'g') then
    raise exception 'El DNI no coincide: no se registró la firma.'; end if;
  hdr := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  update public.acuerdos set
    estado = case when p_acepta then 'aceptado' else 'rechazado' end,
    respondido_en = now(), respondido_por = auth.uid(), leido_en = coalesce(leido_en, now()),
    observacion = case when p_acepta then null else nullif(trim(p_observacion), '') end,
    firma_ip = split_part(coalesce(hdr ->> 'x-forwarded-for', hdr ->> 'x-real-ip', ''), ',', 1),
    firma_dispositivo = left(hdr ->> 'user-agent', 300)
  where id = p_id;
end $$;

grant execute on function public.mis_acuerdos(uuid), public.leer_acuerdo(uuid),
  public.responder_acuerdo(uuid, boolean, text, text) to authenticated;
