# CasaEnRegla — Resumen del proyecto

## Qué es
App para **empleadores de personal de casas particulares** (empleadas domésticas) en Argentina (Ley 26.844).
Objetivo: que sea un producto comercial que genere ingresos extra.

## Por qué alguien pagaría
Calcular el sueldo ya es gratis (calculadora de UPACP, herramienta de ARCA, varias webs).
Lo que vende CasaEnRegla es **ocuparse de todo el mes por el empleador**:
- Avisos automáticos: día de pago, aguinaldo, vacaciones, aumentos de escala.
- Registro de faltas, horas extra y feriados durante el mes.
- Historial ordenado de pagos y recibos.
- Enviar el recibo por WhatsApp con un toque.
- Cálculo de liquidación final.

## Sobre mí (el dueño)
- Trabajo en liquidación de haberes: conozco bien el tema de sueldos.
- Necesito guías **paso a paso, pasos cortos**, y que me traduzcas al español los botones y pantallas en inglés.
- Trabajo en VS Code. Ya hice otra app (Alcanza) con el mismo esquema técnico.

## Tecnología (todo gratis)
- PWA (se instala en el iPhone desde Safari).
- Supabase para la base de datos y el login (proyecto **nuevo**, separado de Alcanza).
- GitHub Pages para publicarla.
- Cobro futuro: suscripción mensual baja con Mercado Pago.

## Decisiones tomadas
- **Lenguaje genérico**: en la app se dice "empleado/empleados" (no "empleada"). Tabla: `empleados`.
- **Datos personales**: se toman escaneando el **código de barras del DNI** (apellido, nombre, sexo, DNI, fecha de nacimiento).
  **No se guarda la foto del DNI**, solo los datos.
- Se cargan a mano (con listas para elegir): CUIL (se puede calcular con DNI + sexo y confirmar), domicilio,
  fecha de ingreso, categoría, con/sin retiro, horas semanales, días de trabajo.
- Las escalas salariales cambian varias veces al año: tienen que poder actualizarse fácil (tabla aparte, no escritas en el código).
- Antes de cobrar: revisar cumplimiento de la Ley de Protección de Datos Personales (25.326).
- No imitar nombre ni estética de AFIP/ARCA: tiene que quedar claro que es una app privada.

## Reglas de liquidación (decididas 2026-11-04)
- **Mensualizado** (≥ 24 hs semanales, parámetro `horas_mensualizado`): valor mensual × horas semanales ÷ 48 (Res. CNTCP 1/2020).
- **Por hora** (< 24 hs): horas realmente trabajadas en el mes (días de trabajo del calendario × horas/día − faltas + extras).
- **Antigüedad**: 1% por año sobre el mensual, contando desde 01/09/2020. **Zona desfavorable**: 31% (provincias patagónicas + Patagones).
- **Horas extra** (> 8 hs diarias o 48 semanales): 50% días comunes; 100% sábado después de las 13, domingo y feriado (art. 25 Ley 26.844, no lo cambió la Ley 27.802).
- **Costo total del empleador** = asignaciones (rem + no rem) + aportes y contribuciones a su cargo = neto + VEP a ARCA
  (si se retiene el aporte de obra social al empleado, no se cuenta dos veces). Columna `costo_total` (SQL 11); `costo_real` = sueldo pagado + VEP.
- **Faltas injustificadas**: forma clásica: sueldo ÷ 30 × días de falta (por hora: no se pagan esas horas).
- **Aportes**: por defecto NO se descuentan del recibo (los paga el empleador). Opción por empleado "descontar aporte de obra social",
  solo con acuerdo previo con el empleado. Montos fijos de ARCA por franja horaria (< 12, 12 a < 16, ≥ 16) y tipo (activo / menor de 18 / jubilado): van en una tabla que se actualiza todos los meses.
- **Ley 27.802 (B.O. 6/3/2026)** modificó la 26.844: período de prueba 6 meses (art. 7), jornada 8 hs/48 semanales con descanso de 35 hs desde el sábado 13 hs (art. 14),
  y **el recibo debe ser electrónico, emitido por el sistema que determine ARCA (art. 20)** → el recibo legal lo emite ARCA; CasaEnRegla calcula, arma el detalle y ayuda a cargarlo.

## Recibo oficial de ARCA (investigado 2026-11-04)
- **RG ARCA 5850/2026** (BO 21/05/2026, desde devengado mayo 2026): el recibo se emite SOLO en forma electrónica en el servicio con Clave Fiscal
  "Personal de Casas Particulares" (Registro Especial, RG 3491) → ficha del trabajador → "Generar recibo de sueldo".
  Se informa: período, modalidad de liquidación, remuneración y demás conceptos. Sin firma del empleador (vale la Clave Fiscal).
  - Pago electrónico: conservar el **nº de transacción** del comprobante (necesario para deducir en Ganancias).
  - Pago en efectivo (o si el trabajador lo pide): imprimir por duplicado; el trabajador firma el duplicado que guarda el empleador.
  - El trabajador ve el recibo en su Clave Fiscal; el empleador ve la "fecha de lectura".
- **RG ARCA 5912/2026** (vigente 15/10/2026): "Recibo Asistido": ARCA sugiere zona desfavorable, antigüedad y SAC. Faltas y horas extra se cargan a mano.
- **No hay web service/API de ARCA** para casas particulares ni recibos (revisado el catálogo oficial de web services). No automatizar el ingreso
  con la Clave Fiscal del usuario (riesgo de seguridad y legal). → CasaEnRegla calcula y muestra una **guía de carga** con los valores exactos para copiar en ARCA.
- **Contenido mínimo del recibo (art. 21 Ley 26.844)**: empleador (nombre, domicilio, CUIT/CUIL); trabajador (nombre, categoría); cada concepto y cómo se calcula;
  bruto (y horas/jornadas si es por hora, período); retenciones; neto en números y letras; constancia de entrega; fecha de ingreso y categoría; lugar y fecha de pago.
- **Plazo de pago (art. 19)**: mensualizados, hasta el 4º día hábil del mes siguiente; por hora, al terminar la jornada o la semana, según lo acordado.

## Metodología de actualización de escalas (propuesta 2026-11-04)
- **Histórico cargado**: `supabase/09_escalas_historicas.sql` = 69 vigencias 09/2013–10/2026 leídas de UPACP con `herramientas/leer_upacp.py`
  (+ 11/2026 en el 04). Incluye historia de zona desfavorable (20%→25%→28%→30%→31%) y antigüedad desde 09/2021.
- **Fuentes**: UPACP `/sueldos/` (vigente) e histórico; Boletín Oficial (resolución CNTCP); ARCA PDF mensual de aportes
  (URL predecible: `.../casasparticulares/aportes-contribuciones-ART/documentos/AAAA/Casas-particulares-aportes-y-contribuciones-MM-AA.pdf`).
- **Paso A — Administración** ✔ HECHO (`supabase/10_admin.sql`, `admin.js`): tabla `admins` + función `es_admin()`; pestaña "Admin"
  solo para el dueño. Escalas: ver/editar por vigencia, nueva vigencia por % de aumento o pegando la tabla de UPACP, % vs anterior y
  controles automáticos (`Liquidacion.controlarEscala`). Aportes: nuevo período subiendo el PDF de ARCA (`analizarAportesArca`, reconstruye
  columnas por aritmética y cruce entre bloques). Parámetros: alta/baja. La app pide solo la escala vigente que necesita (no todas).
  Los controles marcan 5 de 69 vigencias históricas: 2013-09, 2020-05, 2024-12 (5ª sin retiro hora $3.413, probable tipeo de UPACP), 2025-01, 2026-10.
- **Paso B — Robot**: Supabase Edge Function que descarga UPACP y el PDF de ARCA, los lee y guarda lo nuevo como
  **propuesta pendiente** (nunca directo a `escalas`). Corre solo 1 vez por día (pg_cron); el navegador no puede leer UPACP directo (CORS).
- **Paso C — Al iniciar la app**: avisar si el mes actual no tiene escala/aportes publicados (se usa la última); y si se aprobó una escala
  **retroactiva** que afecta liquidaciones ya guardadas, avisar "hay que recalcular" con la diferencia.
- Regla: **ningún valor llega a los usuarios sin aprobación del dueño** (controles automáticos: 10 renglones, aumento razonable, 3ª = 4ª con retiro).

## Ideas futuras
- **Acceso del empleado**: que el empleado vea sus recibos y los acuerdos (descuento de aportes, medio de pago acordado) y los acepte con firma electrónica, quedando asentado.

## Etapas
1. **Versión para uso propio** (pruebo con mis propios datos; todavía no tengo empleada).
2. Prueba gratis con unos 10 conocidos que tengan empleada.
3. Empezar a cobrar.

## Primer paso a hacer
(Hecho) Armar la pantalla **"Nuevo empleado"**:
1. Botón "Escanear DNI" → cámara → completa datos personales.
2. Datos laborales con listas para elegir.
3. Botón "Guardar" en Supabase.

## Estado actual (actualizado 2026-11-04)
- Hecho: pantalla "Nuevo empleado" (HTML/JS simple, sin build) con escaneo DNI (ZXing, PDF417), cálculo de CUIL,
  validaciones, login email+contraseña y guardado en Supabase (proyecto propio de CasaEnRegla, tabla `empleados` con RLS).
  Probado en la PC: guarda bien en la tabla.
- SQL de la base en `supabase/` (numerados). Conexión en `config.js`.
- Usuario de prueba creado a mano en Supabase (Authentication > Users). Todavía no hay pantalla de registro.
- Publicada en GitHub Pages: https://jfzampa.github.io/casaenregla/ (repo jfzampa/casaenregla, rama main).
  Probada en el iPhone: se instala y el escaneo del DNI funciona.
- El código de barras del DNI NO trae domicilio (está solo impreso al dorso): el domicilio se carga a mano.
- Hecho también: lista "Mis empleados" y edición.
- Gestión de usuario (en prueba): crear cuenta (con aceptación Ley 25.326 guardada en metadata), olvidé contraseña,
  "Mis datos" del empleador (tabla `empleadores`, incluye lugar de trabajo del personal), cambiar email/contraseña,
  eliminar cuenta (función `borrar_mi_cuenta`, borra en cascada). Mails en español ya escritos en `supabase/mails_en_espanol.md`, pero Supabase no deja cargarlos sin SMTP propio: por ahora salen en inglés.
- Escalas (`supabase/04_escalas.sql`: tablas `escalas` y `parametros`, solo lectura para usuarios) y
  liquidación mensual (`supabase/05_liquidaciones.sql`: `aportes_arca`, `liquidaciones`; motor de cálculo puro en `liquidacion.js`).
  Pantalla "Liquidar": novedades (faltas, extras 50/100, horas en feriado), otros conceptos rem/no rem (los "todos los meses"
  se guardan en `empleados.conceptos_fijos`), detalle, neto en letras y monto a pagar en ARCA.
- Cierre del mes (`supabase/06_cierre_mes.sql`): valores para copiar en ARCA, subir recibo de ARCA (lee el neto del PDF con pdf.js),
  registrar pago (fecha, medio, nº transacción, importe, comprobante), desvíos recibo/pago vs neto (columnas calculadas) con observaciones,
  y envío del detalle por WhatsApp (wa.me). Archivos en Storage, bucket privado `comprobantes`, carpeta por usuario.
  Ficha del empleado: celular, medio de pago acordado, alias/CBU.
- Pago de aportes con VEP (`supabase/07_vep_y_control_recibo.sql`): se sube el comprobante del VEP, se leen nº, período, fecha e importe y se compara con `pago_arca`.
  El recibo de ARCA se compara concepto por concepto (período, CUIL del empleado, Básico/Antigüedad/etc.).
  Formatos reales (2022): recibo ARCA dice "Total $ x" (no "Neto"), "PERÍODO: Mayo 2022", conceptos en "Detalle de la Remuneración",
  y referencia el nº de VEP; comprobante VEP trae "Nro. VEP", "Periodo: aaaamm", "IMPORTE PAGADO", "Fecha de Pago: d/m/aaaa". Lectura en `liquidacion.js`.
- Ficha del empleado (tocar un empleado en la lista): datos, antigüedad, resumen por año (costo total, neto, ARCA, liquidaciones
  pagadas, mayor remuneración = base SAC, desvíos, meses sin liquidar) e historial; tocar una liquidación abre ese mes. Base para el portal del empleado.
- Pendiente: aguinaldo (SAC), vacaciones, avisos, liquidación final.
- Pendiente: ícono PNG para iPhone (hoy es SVG).
- Pendiente antes de la etapa 2: registrar dominio y configurar SMTP propio en Supabase (ej. Resend/Brevo con el dominio), y recién ahí cargar las plantillas en español. El envío de mails que trae
  Supabase gratis solo manda a emails del equipo del proyecto y tiene pocos envíos por hora.
- Pendiente antes de cobrar: texto de política de privacidad / términos.

## Marca
- Nombre: **CasaEnRegla**
- Idea central: "todo en orden con tu empleado, sin vueltas".
- Colores sugeridos: verde (en regla, confianza) + azul oscuro (seriedad). Evitar el celeste/azul institucional de ARCA.
- Logo sugerido: una casita con un tilde ✓ adentro o en el techo.
- Slogans posibles: "Tu empleado, en regla." / "Sueldo, recibo y avisos, sin vueltas."
- Pendiente: buscar el nombre en INPI, registrar dominio en NIC Argentina, reservar @casaenregla en Instagram.
