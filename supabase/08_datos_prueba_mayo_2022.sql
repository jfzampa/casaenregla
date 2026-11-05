-- CasaEnRegla — DATOS DE PRUEBA: escala de mayo 2022 (para probar con recibos reales de ese mes)
-- Pegar completo en Supabase > SQL Editor > Run
--
-- Fuente: Diario de Cuyo (29/04/2022), acuerdo CNTCP 2022: +9% en mayo sobre los mínimos de abril.
-- Control: 4ª con retiro $43.046 mensual = recibo real de ARCA (básico $21.523 por 24 hs semanales).
-- La 5ª categoría NO estaba publicada en la fuente: se estimó como abril × 1,09 (verificar).

insert into public.escalas (vigencia_desde, categoria, modalidad, valor_hora, valor_mensual, resolucion) values
  ('2022-05-01', 1, 'con_retiro', 380.50, 47489.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 1, 'sin_retiro', 416.50, 52897.50, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 2, 'con_retiro', 360.00, 44120.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 2, 'sin_retiro', 395.00, 49113.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 3, 'con_retiro', 339.50, 43046.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 3, 'sin_retiro', 339.50, 43046.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 4, 'con_retiro', 339.50, 43046.00, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 4, 'sin_retiro', 380.50, 47970.50, 'CNTCP 2022 (+9% mayo)'),
  ('2022-05-01', 5, 'con_retiro', 315.00, 38710.80, 'ESTIMADO abril x 1,09 — verificar'),
  ('2022-05-01', 5, 'sin_retiro', 339.50, 43046.00, 'ESTIMADO abril x 1,09 — verificar');

-- Parámetros vigentes antes de noviembre 2026 (antigüedad 1% desde 09/2021, cómputo desde 01/09/2020)
insert into public.parametros (clave, vigencia_desde, valor, descripcion) values
  ('antiguedad_pct_anual',  '2021-09-01', 1,        '% por año de antigüedad (pagadero desde 09/2021)'),
  ('antiguedad_desde',      '2021-09-01', 20200901, 'Fecha (aaaammdd) desde la que se cuenta la antigüedad'),
  ('horas_mensualizado',    '2021-09-01', 24,       'Desde estas horas semanales se cobra el mensual proporcional'),
  ('zona_desfavorable_pct', '2021-09-01', 30,       'Adicional zona desfavorable (valor de esa época: verificar)');

-- Aportes ARCA de mayo 2022: NO se cargan porque no se encontró el desglose oficial
-- (solo el total de $3.338,97 para 16 hs o más). La app avisará que faltan y el control del VEP
-- mostrará la diferencia: sirve para ver cómo se marcan los desvíos.
