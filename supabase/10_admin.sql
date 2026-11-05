-- CasaEnRegla — rol de administrador (solo el dueño): puede cargar y corregir escalas, parámetros y aportes desde la app
-- Pegar completo en Supabase > SQL Editor.
-- ⚠ ANTES de tocar "Run": en la última línea reemplazá TU_EMAIL por tu email (el de tu usuario de la app).

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "ver si soy admin" on public.admins for select to authenticated using (user_id = auth.uid());

-- ¿El usuario actual es administrador?
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.es_admin() to authenticated;

-- Solo los administradores pueden escribir en las tablas de valores oficiales
create policy "admin escribe escalas"    on public.escalas      for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin escribe parametros" on public.parametros   for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin escribe aportes"    on public.aportes_arca for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Lista de vigencias de escalas y de períodos de aportes (sin traer todos los renglones)
create or replace function public.vigencias_escalas()
returns setof date language sql stable set search_path = ''
as $$ select distinct vigencia_desde from public.escalas order by 1 desc; $$;
create or replace function public.periodos_aportes()
returns setof date language sql stable set search_path = ''
as $$ select distinct periodo_desde from public.aportes_arca order by 1 desc; $$;
grant execute on function public.vigencias_escalas() to authenticated;
grant execute on function public.periodos_aportes() to authenticated;

-- Darte el rol de administrador (reemplazá TU_EMAIL)
insert into public.admins (user_id) select id from auth.users where email = 'TU_EMAIL';
