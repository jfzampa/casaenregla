-- CasaEnRegla — datos del empleador ("Mis datos") y eliminación de cuenta
-- Pegar completo en Supabase > SQL Editor > Run

-- 1) Datos del empleador: una fila por usuario
create table public.empleadores (
  id                      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  creado                  timestamptz not null default now(),
  actualizado             timestamptz not null default now(),

  apellido                text,
  nombre                  text,
  dni                     text check (dni ~ '^\d{7,8}$'),
  sexo                    text check (sexo in ('F','M','X')),
  fecha_nacimiento        date,
  cuil                    text check (cuil ~ '^\d{11}$'),
  telefono                text,

  -- Domicilio particular del empleador
  calle                   text,
  numero                  text,
  piso_depto              text,
  codigo_postal           text,
  localidad               text,
  provincia               text,

  -- Lugar donde trabaja el personal (si es distinto)
  trabajo_mismo_domicilio boolean not null default true,
  trabajo_calle           text,
  trabajo_numero          text,
  trabajo_piso_depto      text,
  trabajo_codigo_postal   text,
  trabajo_localidad       text,
  trabajo_provincia       text
);

alter table public.empleadores enable row level security;

create policy "ver mis datos"       on public.empleadores for select using (id = auth.uid());
create policy "cargar mis datos"    on public.empleadores for insert with check (id = auth.uid());
create policy "modificar mis datos" on public.empleadores for update using (id = auth.uid()) with check (id = auth.uid());

-- 2) Eliminar mi cuenta (Ley 25.326): borra el usuario y, en cascada,
--    sus datos de empleador y todos sus empleados.
create or replace function public.borrar_mi_cuenta()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
