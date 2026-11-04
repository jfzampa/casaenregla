-- CasaEnRegla — tabla de empleadas
-- Pegar completo en Supabase > SQL Editor > Run

create table public.empleadas (
  id               uuid primary key default gen_random_uuid(),
  empleador_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado           timestamptz not null default now(),

  -- Datos personales (del código de barras del DNI; NO se guarda la foto)
  apellido         text not null,
  nombre           text not null,
  dni              text not null check (dni ~ '^\d{7,8}$'),
  sexo             text not null check (sexo in ('F','M','X')),
  fecha_nacimiento date,
  cuil             text not null check (cuil ~ '^\d{11}$'),

  -- Domicilio
  calle            text,
  numero           text,
  piso_depto       text,
  codigo_postal    text,
  localidad        text,
  provincia        text,

  -- Datos laborales
  fecha_ingreso    date not null,
  categoria        smallint not null check (categoria between 1 and 5),
  modalidad        text not null check (modalidad in ('con_retiro','sin_retiro')),
  horas_semanales  smallint check (horas_semanales between 1 and 48),
  dias             text[] not null default '{}',

  unique (empleador_id, dni)
);

-- Seguridad: cada empleador solo ve y modifica SUS empleadas
alter table public.empleadas enable row level security;

create policy "ver mis empleadas"       on public.empleadas for select using (empleador_id = auth.uid());
create policy "cargar mis empleadas"    on public.empleadas for insert with check (empleador_id = auth.uid());
create policy "modificar mis empleadas" on public.empleadas for update using (empleador_id = auth.uid()) with check (empleador_id = auth.uid());
create policy "borrar mis empleadas"    on public.empleadas for delete using (empleador_id = auth.uid());
