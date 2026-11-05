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
- **Aguinaldo (SAC)**: 50% de la mayor remuneración mensual devengada (remunerativa) del semestre; proporcional a los días trabajados. Junio y diciembre.
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
- **Paso B — Robot** ✔ HECHO (`supabase/19_robot.sql`, `20_robot_cron.sql`, `supabase/functions/robot-escalas/index.ts`; se pega en el editor de Edge Functions del panel). Supabase Edge Function que descarga UPACP y el PDF de ARCA, los lee y guarda lo nuevo como
  **propuesta pendiente** (nunca directo a `escalas`). Corre solo 1 vez por día (pg_cron); el navegador no puede leer UPACP directo (CORS).
- **Paso C — Al iniciar la app** ✔ HECHO (dentro de los avisos): avisar si el mes actual no tiene escala/aportes publicados (se usa la última); y si se aprobó una escala
  **retroactiva** que afecta liquidaciones ya guardadas, avisar "hay que recalcular" con la diferencia.
- Regla: **ningún valor llega a los usuarios sin aprobación del dueño** (controles automáticos: 10 renglones, aumento razonable, 3ª = 4ª con retiro).

## Ideas futuras
- **Descuentos con destino** (idea del dueño, 2026-11-05; decidido dejar para más adelante): como en el régimen general, cada descuento
  con su entidad y transferencia a registrar en el cierre (cuota sindical si está afiliado, embargos judiciales, adelantos). Hoy solo existe
  el aporte de obra social acordado, que se retiene y va dentro del VEP (en casas particulares ARCA reparte a OS/SIPA/ART).
- **App/portal del empleado** (idea del dueño, 2026-11-05):
  - Comunicaciones oficiales y acuerdos (medio de pago, descuento de aportes, vacaciones, preaviso) aceptados con firma electrónica, con registro de fecha y hora.
  - **Presentismo diario**: el empleado marca "presente" desde su celular; la app guarda hora y ubicación de ese momento y la compara
    con el lugar de trabajo (radio de X metros alrededor del domicilio de "Mis datos"). El empleador confirma o no.
  - **Ausencias**: el empleado informa y sube la justificación (certificado, etc.); el empleador la marca justificada o injustificada.
  - Todo alimenta las **novedades del mes** (faltas, horas extra) que hoy carga el empleador → la liquidación se arma sola.
  - Cuidados: Ley 25.326 (la ubicación es dato personal): consentimiento informado, ubicación **solo al marcar** (nunca seguimiento continuo),
    finalidad limitada, acceso del empleado a sus datos. El GPS se puede falsear: la ubicación es un indicio, no una prueba;
    por eso la confirmación de ambas partes. En iPhone la PWA solo puede pedir ubicación con la app abierta (alcanza para marcar).
- **Contadores / estudios** como usuarios: que puedan usar la app para varios empleadores-clientes y fijar sus propios criterios
  (ya existe el patrón: criterio general + criterio por empleador, ej. divisor de vacaciones).
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

## Orden de trabajo acordado (2026-11-05)
- SQL 01 a 16 ya ejecutados en Supabase (el dueño confirma; los nuevos SQL van numerados desde el 17).
- Decisión: dominio, mails propios (SMTP + plantillas en español), política de privacidad, ícono PNG, INPI/Instagram
  quedan para **el final**, con el prototipo terminado.
- Próximos bloques: portal/app del empleado · robot de escalas (paso B) + avisos por notificación/mail · cobro con Mercado Pago.

## Estado actual (actualizado 2026-11-04)
- Hecho: pantalla "Nuevo empleado" (HTML/JS simple, sin build) con escaneo DNI (ZXing, PDF417), cálculo de CUIL,
  validaciones, login email+contraseña y guardado en Supabase (proyecto propio de CasaEnRegla, tabla `empleados` con RLS).
  Probado en la PC: guarda bien en la tabla.
- SQL de la base en `supabase/` (numerados). Conexión en `config.js`. **Proyecto Supabase de CasaEnRegla: `bytrghqvrpgcuvdbfnkn`** (https://bytrghqvrpgcuvdbfnkn.supabase.co). OJO: `azaeasfifcamwqqlfztb` es OTRO proyecto (no usar).
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
- Aguinaldo (SAC) ✔: en la liquidación de junio/diciembre, opción "Incluir aguinaldo". 50% de la mayor remuneración remunerativa
  del semestre (art. 26), proporcional por días desde el ingreso (`Liquidacion.calcularSac`). Propone la mayor entre los meses
  guardados del semestre (sin contar aguinaldos, `detalle.sac_importe`) y el mes actual; se puede escribir a mano.
- Avisos ✔ (`supabase/12_avisos.sql`, `Liquidacion.generarAvisos`): tarjeta en el inicio con prioridad (urgente/atención/info) y botón
  para ir a liquidar o cerrar el mes. Reglas: liquidar/pagar el mes anterior (vence 4° día hábil, art. 19), VEP (día `vep_dia_vencimiento`
  o hábil siguiente, aprox.), recibo ARCA sin emitir, aguinaldo en junio/diciembre, fin de mes, vacaciones (sep–nov: días según
  antigüedad art. 29; proporcional 1/20 si ingresó en el 2° semestre), fin del período de prueba (6 meses, ingresos desde 06/03/2026),
  escala retroactiva (liquidación hecha con una escala anterior a la vigente) y escala del mes no cargada.
  Tabla `feriados` (admin, pestaña Feriados) para días hábiles; trasladables de 2026/2027 cargados por regla general: verificar.
  Avisos por notificación/mail (fuera de la app): pendiente, requiere Edge Function + cron (junto con el paso B).
- Vacaciones ✔: en Novedades, "días que empieza a tomar este mes" + desde (todos los días en el mes de inicio: se pagan antes, art. 32).
  Renglones: "Vacaciones N días" = base ÷ divisor × N y "Días de vacaciones (no trabajados)" = − base ÷ 30 × N (base = básico + antig. + zona).
  Divisor: general **30** (decisión del dueño, sin plus) en `parametros`; cada empleador puede elegir 25 o 30 en Mis datos
  ("Criterios de liquidación", columna `empleadores.vacaciones_divisor`, SQL 14). Vacío = usa el general.
- Liquidación final ✔ (`supabase/15_egreso.sql`): en Liquidar, "Este mes termina la relación" + último día + causa
  (renuncia, despido sin causa/indirecto, período de prueba, mutuo acuerdo, despido con causa). Siempre: días trabajados (÷30 × días;
  por hora: días de trabajo hasta el egreso), SAC proporcional hasta el egreso, vacaciones no gozadas (proporcional del año + ajuste ±,
  base mes completo ÷ divisor del empleador, no remunerativo). Despido sin causa: preaviso 10/30 días (art. 43) e integración (art. 44)
  si no se preavisó, SAC s/ ambos (opcional, tildado), indemnización art. 48 (años + fracción > 3 meses, mín. 1, mejor remuneración
  últimos 12 meses sin SAC, editable). Dentro del período de prueba avisa que no corresponde. Al guardar se registra la baja en
  `empleados.fecha_egreso/causa_egreso`; las bajas se muestran marcadas y no generan avisos. También: ingreso a mitad de mes = proporcional.
- Novedades día a día ✔ (`supabase/16_novedades.sql`): calendario del mes en la ficha del empleado; tocar un día → falta injustificada
  (se descuenta), falta justificada (con justificativo en Storage `<uid>/novedades/`), horas extra 50/100, feriado trabajado, nota.
  Al liquidar un mes nuevo se cargan solas (`Liquidacion.resumirNovedades`); botón "Traer las novedades del calendario" para actualizar.
  Cada novedad guarda `cargado_por` y `confirmado_empleador/empleado` → base del presentismo con confirmación de ambas partes (portal).
  La carga manual del empleador queda siempre (por si el empleado no tiene o no puede usar el celular).
- Portal del empleado parte 1 ✔ (`supabase/17_portal_empleado.sql`, `empleado.js`): el empleador invita desde la ficha (WhatsApp con link
  `?invitacion=código`, vence 14 días); el empleado crea su cuenta y confirma con su DNI (`aceptar_invitacion`) → `empleados.usuario_id`.
  Pestaña "Mi trabajo": marcar presente con ubicación (solo al marcar; `marcar_presente` calcula la distancia al lugar de trabajo que el
  empleador guarda en Mis datos), avisar ausencias/extras con justificativo (quedan pendientes de confirmar por el empleador), responder
  conforme/no conforme a lo que cargó el empleador, y ver sus liquidaciones. El empleado solo usa funciones rpc (nunca lee tablas).
  Si solo es empleado, se ocultan Empleados y Mis datos. Lo cargado por el empleado entra en la liquidación solo si el empleador lo confirma.
  ⚠ Para PROBAR con cuentas de empleados: desactivar "Confirm email" en Supabase (el envío de mails gratis solo llega al dueño);
  volver a activarlo en la fase final junto con el SMTP propio.
- Robot ✔: deja `robot_hallazgos` (escala nueva, escala publicada distinta de la cargada, PDF de aportes publicado) y registra cada corrida en
  `robot_ejecuciones`. Admin > 🤖 Robot: "Revisar ahora" (invoca la función con la sesión del admin), "Revisar y cargar" abre el editor de
  escalas con los valores leídos (o Aportes > nuevo período) y al guardar marca el hallazgo como aplicado; aviso en el inicio para el admin.
  La función valida: encabezado x-robot = secreto ROBOT_SECRETO (cron) o JWT de un usuario admin. "Verify JWT" desactivado en la función.
  El secreto NO está en el repo (20_robot_cron.sql tiene PONER_SECRETO).
- Experiencia de usuario ✔: encabezado con iniciales y menú (Mis datos, Mi cuenta, Administración, Salir); barra inferior tipo app
  (Inicio, Empleados, Novedades, Mi trabajo si corresponde, Cuenta); pantalla de Inicio (saludo con nombre, Primeros pasos con progreso
  — se ocultan con localStorage —, accesos rápidos, Tareas pendientes = avisos, resumen del mes con costo y vencimientos); vista Novedades
  para elegir a quién anotar; mensajes flotantes (toast) para toda confirmación "✓ …" de mostrarEstado.
- Instalación verificada (2026-11-05): funciones `robot-escalas` y `enviar-avisos` publicadas (Verify JWT apagado), 4 secretos OK
  (ROBOT_SECRETO, VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTACTO), tareas cron `robot-escalas-diario` (11:00 UTC) y
  `enviar-avisos-diario` (11:30 UTC) con la clave correcta. Ojo: en el cron va la CLAVE, no el "digest" que muestra el panel.
- Robot verificado en producción (2026-11-05): responde el informe correcto con el secreto; sin secreto devuelve 401.
- Notificaciones push ✔ (`supabase/21_notificaciones.sql`, `22_avisos_cron.sql`, `supabase/functions/enviar-avisos/index.ts`):
  Web Push con claves VAPID (pública en config.js; privada solo en Secrets: VAPID_PRIVADA, + VAPID_PUBLICA, VAPID_CONTACTO opcional).
  Cuenta > 🔔 Notificaciones: activar/desactivar por dispositivo y "Enviarme una de prueba"; banner en Inicio. En iPhone solo con la
  app instalada (iOS 16.4+). La función carga el motor `liquidacion.js` publicado en GitHub Pages (new Function) y manda 1 resumen
  diario con lo urgente (avisos no-info, novedades a confirmar, hallazgos del robot para admin, acuerdos/novedades para el empleado).
  Mail: en la fase final con SMTP.
- Portal del empleado parte 2 ✔ (`supabase/18_acuerdos.sql`): acuerdos y comunicaciones con firma electrónica (Ley 25.506).
  El empleador redacta desde la ficha con modelos (medio de pago, descuento de aporte, vacaciones, horario, preaviso, comunicación, otro)
  que se completan con los datos de la ficha y de Mis datos; una vez enviado el texto no se puede editar (sin permiso de update;
  se puede anular solo si nadie lo leyó). El empleado firma con "Leí el texto completo" + DNI (`responder_acuerdo` valida el DNI) o
  rechaza con motivo; las comunicaciones quedan "leídas" al abrirlas. Constancia: fecha y hora de envío/lectura/firma, IP y dispositivo
  (de los headers del pedido) y huella SHA-256 del título + texto (columna generada `huella`).
- No incluido en la liquidación final (a pedido se agrega): multas por falta de registración (art. 50), SAC s/ vacaciones no gozadas.
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
