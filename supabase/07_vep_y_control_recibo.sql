-- CasaEnRegla — pago de aportes (VEP) y control del recibo de ARCA concepto por concepto
-- Pegar completo en Supabase > SQL Editor > Run  (después del 06)

alter table public.liquidaciones
  add column vep_numero            text,            -- Nº de VEP de aportes, contribuciones y ART
  add column vep_importe           numeric(14,2),   -- importe pagado según el comprobante del VEP
  add column vep_fecha             date,
  add column vep_archivo           text,
  add column recibo_arca_conceptos jsonb,           -- conceptos leídos del recibo de ARCA [{nombre, importe}]
  add column desvio_vep            numeric(14,2) generated always as (vep_importe - pago_arca) stored;
