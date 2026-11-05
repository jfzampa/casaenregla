-- CasaEnRegla — notificaciones al celular (Web Push): dispositivos suscriptos
-- Pegar completo en Supabase > SQL Editor > Run

create table public.suscripciones_push (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  dispositivo text,
  creado      timestamptz not null default now()
);
alter table public.suscripciones_push enable row level security;
create policy "mis dispositivos" on public.suscripciones_push for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
-- (la función "enviar-avisos" lee todas con la clave de servicio)
