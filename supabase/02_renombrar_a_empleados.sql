-- CasaEnRegla — se habla en genérico: "empleados" en lugar de "empleadas".
-- Renombra la tabla y sus reglas. Los datos cargados se conservan.
-- Pegar completo en Supabase > SQL Editor > Run

alter table public.empleadas rename to empleados;

alter policy "ver mis empleadas"       on public.empleados rename to "ver mis empleados";
alter policy "cargar mis empleadas"    on public.empleados rename to "cargar mis empleados";
alter policy "modificar mis empleadas" on public.empleados rename to "modificar mis empleados";
alter policy "borrar mis empleadas"    on public.empleados rename to "borrar mis empleados";
