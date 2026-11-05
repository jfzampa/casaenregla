-- CasaEnRegla — suscripción con Mercado Pago: prueba gratis, plan activo y modo solo lectura
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Reglas: cada empleador tiene una prueba de N días (parámetro dias_prueba, 30) desde que creó su cuenta.
-- Sin plan vigente queda en SOLO LECTURA: la base rechaza cargar/modificar empleados, liquidaciones, novedades,
-- acuerdos e invitaciones. El portal del empleado sigue funcionando. El admin nunca queda bloqueado.
-- Mientras el parámetro cobro_activo = 0 (arranca así), NADIE queda bloqueado (etapa de prueba con conocidos).

insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('precio_mensual', '2026-11-01', 4990, 'Precio de la suscripción mensual del empleador (ARS)'),
  ('dias_prueba',    '2026-11-01', 30,   'Días de prueba gratis desde que se crea la cuenta'),
  ('cobro_activo',   '2026-11-01', 0,    '1 = se exige suscripción al terminar la prueba; 0 = nadie queda bloqueado')
on conflict (clave, vigencia_desde) do nothing;

create table public.suscripciones (
  usuario_id       uuid primary key references auth.users(id) on delete cascade,
  estado           text not null default 'prueba' check (estado in ('prueba','pendiente','activa','pausada','cancelada','cortesia')),
  prueba_hasta     date not null,
  mp_preapproval_id text,
  monto            numeric(12,2),
  proximo_cobro    date,
  actualizado      timestamptz not null default now(),
  notas            text
);
alter table public.suscripciones enable row level security;
create policy "ver mi suscripcion" on public.suscripciones for select using (usuario_id = auth.uid() or public.es_admin());
create policy "admin modifica suscripciones" on public.suscripciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Valor vigente de un parámetro
create or replace function public.parametro(p_clave text)
returns numeric language sql stable security definer set search_path = '' as $$
  select valor from public.parametros where clave = p_clave and vigencia_desde <= current_date
  order by vigencia_desde desc limit 1;
$$;

-- Mi plan (crea la prueba la primera vez)
create or replace function public.mi_plan()
returns table (estado text, prueba_hasta date, dias_restantes int, puede_editar boolean, cobro_activo boolean,
               precio numeric, proximo_cobro date, es_admin boolean)
language plpgsql security definer set search_path = '' as $$
declare s public.suscripciones; creado timestamptz; activo boolean; adm boolean;
begin
  if auth.uid() is null then return; end if;
  select * into s from public.suscripciones where usuario_id = auth.uid();
  if not found then
    select created_at into creado from auth.users where id = auth.uid();
    insert into public.suscripciones (usuario_id, estado, prueba_hasta)
    values (auth.uid(), 'prueba', (coalesce(creado, now()) at time zone 'America/Argentina/Buenos_Aires')::date
                                  + coalesce(public.parametro('dias_prueba'), 30)::int)
    on conflict (usuario_id) do nothing;
    select * into s from public.suscripciones where usuario_id = auth.uid();
  end if;
  activo := coalesce(public.parametro('cobro_activo'), 0) = 1;
  adm := public.es_admin();
  return query select s.estado, s.prueba_hasta, (s.prueba_hasta - current_date)::int,
    (adm or not activo or s.estado in ('activa', 'cortesia') or current_date <= s.prueba_hasta),
    activo, public.parametro('precio_mensual'), s.proximo_cobro, adm;
end $$;

create or replace function public.puede_editar()
returns boolean language sql security definer set search_path = '' as $$
  select coalesce((select puede_editar from public.mi_plan()), true);
$$;

grant execute on function public.parametro(text), public.mi_plan(), public.puede_editar() to authenticated;

-- Solo lectura: las reglas de escritura del empleador exigen plan vigente
alter policy "cargar mis empleados"    on public.empleados    with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "modificar mis empleados" on public.empleados    using (empleador_id = auth.uid()) with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "cargar mis liquidaciones"    on public.liquidaciones with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "modificar mis liquidaciones" on public.liquidaciones using (empleador_id = auth.uid()) with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "cargar mis novedades"    on public.novedades    with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "modificar mis novedades" on public.novedades    using (empleador_id = auth.uid()) with check (empleador_id = auth.uid() and public.puede_editar());
alter policy "enviar acuerdos"         on public.acuerdos     with check (empleador_id = auth.uid() and estado = 'pendiente' and public.puede_editar());
alter policy "mis invitaciones"        on public.invitaciones using (empleador_id = auth.uid()) with check (empleador_id = auth.uid() and public.puede_editar());

-- Listado para el admin (con email y nombre)
create or replace function public.admin_suscripciones()
returns table (usuario_id uuid, email text, nombre text, estado text, prueba_hasta date, proximo_cobro date, empleados bigint, creado timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'Solo para administradores.'; end if;
  return query
  select u.id, u.email::text, nullif(trim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, '')), ''),
         s.estado, s.prueba_hasta, s.proximo_cobro,
         (select count(*) from public.empleados e where e.empleador_id = u.id), u.created_at
  from auth.users u
  left join public.suscripciones s on s.usuario_id = u.id
  left join public.empleadores p on p.id = u.id
  order by u.created_at desc;
end $$;
grant execute on function public.admin_suscripciones() to authenticated;

-- Dar o quitar cortesía (uso gratis) a un usuario — solo admin
create or replace function public.admin_cortesia(p_usuario uuid, p_cortesia boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare creado timestamptz;
begin
  if not public.es_admin() then raise exception 'Solo para administradores.'; end if;
  select created_at into creado from auth.users where id = p_usuario;
  insert into public.suscripciones (usuario_id, estado, prueba_hasta)
  values (p_usuario, case when p_cortesia then 'cortesia' else 'prueba' end,
          (coalesce(creado, now()) at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(public.parametro('dias_prueba'), 30)::int)
  on conflict (usuario_id) do update
    set estado = case when p_cortesia then 'cortesia'
                      when public.suscripciones.estado = 'cortesia' then 'prueba'
                      else public.suscripciones.estado end,
        actualizado = now();
end $$;
grant execute on function public.admin_cortesia(uuid, boolean) to authenticated;
