# Herramientas (no forman parte de la app publicada)

Para regenerar `supabase/09_escalas_historicas.sql` desde el histórico de UPACP:

1. Descargar las páginas anuales de https://upacp.org.ar/historico-de-sueldos/ (una por año) a una carpeta, como `2013.html`, `2014.html`, etc.
2. `python leer_upacp.py <carpeta> escalas.json` → muestra cuántas vigencias leyó y avisa de casos raros.
3. `python generar_sql_escalas.py escalas.json ../supabase/09_escalas_historicas.sql`
