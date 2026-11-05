import json, sys
sys.stdout.reconfigure(encoding='utf-8')
filas = json.load(open(sys.argv[1], encoding='utf8'))
filas.sort(key=lambda x: (x['vigencia'], x['cat'], x['mod']))

def n(v):
    return f'{v:.2f}'

out = []
out.append("""-- CasaEnRegla — ESCALAS HISTÓRICAS completas (09/2013 a 10/2026)
-- Pegar completo en Supabase > SQL Editor > Run  (se puede correr más de una vez: actualiza sin duplicar)
--
-- Fuente: UPACP, "Histórico de sueldos" (upacp.org.ar/historico-de-sueldos), una página por año.
-- Leído con un programa (no a mano). Controles: 4ª con retiro 05/2022 = $43.046 (igual a un recibo real de ARCA).
-- Caseros (3ª) no distingue modalidad: se carga igual en las dos.
-- Nota: en 10/2026 la página publica 5ª sin retiro $548.429,33 y 3ª/4ª $548.429,23 (posible tipeo de origen; se respeta lo publicado).
-- Se corrigió un tipeo de la fuente: "26.007.00" → 26007,00.
""")
out.append('insert into public.escalas (vigencia_desde, categoria, modalidad, valor_hora, valor_mensual, resolucion) values')
vals = [f"  ('{x['vigencia']}', {x['cat']}, '{x['mod']}', {n(x['hora'])}, {n(x['mensual'])}, 'UPACP histórico')" for x in filas]
out.append(',\n'.join(vals))
out.append("""on conflict (vigencia_desde, categoria, modalidad) do update
  set valor_hora = excluded.valor_hora, valor_mensual = excluded.valor_mensual, resolucion = excluded.resolucion;
""")

# Historia de la zona desfavorable (solo cuando cambia)
zonas, ultimo = [], None
for x in filas:
    if x['zona'] is not None and x['zona'] != ultimo:
        zonas.append((x['vigencia'], x['zona']))
        ultimo = x['zona']
out.append('-- Historia del adicional por zona desfavorable (según cada página de UPACP)')
out.append('insert into public.parametros (clave, vigencia_desde, valor, descripcion) values')
out.append(',\n'.join(f"  ('zona_desfavorable_pct', '{v}', {z}, 'Adicional zona desfavorable (UPACP histórico)')" for v, z in zonas) + ',')
out.append("""  ('antiguedad_pct_anual',  '2021-09-01', 1,        '1% por año, pagadero desde 09/2021 (antes no existía este adicional)'),
  ('antiguedad_desde',      '2021-09-01', 20200901, 'La antigüedad se cuenta desde 01/09/2020'),
  ('horas_mensualizado',    '2020-03-01', 24,       'Res. CNTCP 1/2020: desde 24 hs semanales se liquida mensual proporcional')
on conflict (clave, vigencia_desde) do update set valor = excluded.valor, descripcion = excluded.descripcion;""")

open(sys.argv[2], 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('vigencias:', len({x['vigencia'] for x in filas}), '| filas:', len(filas), '| zonas:', zonas)
