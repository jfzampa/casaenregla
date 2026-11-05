-- CasaEnRegla — cierre del mes: recibo de ARCA, pago, comprobantes y desvíos
-- Pegar completo en Supabase > SQL Editor > Run

-- 1) Ficha del empleado: contacto y medio de pago acordado
alter table public.empleados
  add column telefono            text,
  add column pago_medio_acordado text check (pago_medio_acordado in ('transferencia','efectivo','otro')),
  add column pago_alias          text;   -- alias o CBU/CVU para transferencias

-- 2) Liquidación: lo que dice el recibo de ARCA, lo que se pagó y las diferencias
alter table public.liquidaciones
  add column recibo_arca_neto    numeric(14,2),   -- neto que figura en el recibo de ARCA
  add column recibo_arca_archivo text,            -- ruta del archivo subido
  add column pago_importe        numeric(14,2),   -- importe realmente pagado
  add column pago_archivo        text,            -- comprobante de transferencia / recibo firmado
  add column observaciones       text,            -- motivo de las diferencias, si las hay
  add column desvio_recibo       numeric(14,2) generated always as (recibo_arca_neto - neto) stored,
  add column desvio_pago         numeric(14,2) generated always as (pago_importe - neto) stored;

-- 3) Depósito privado de comprobantes (máx. 10 MB por archivo).
--    Cada usuario guarda en su carpeta: <id del usuario>/<id de la liquidación>/archivo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic']);

create policy "ver mis comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "subir mis comprobantes" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "reemplazar mis comprobantes" on storage.objects for update to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "borrar mis comprobantes" on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid()::text));
