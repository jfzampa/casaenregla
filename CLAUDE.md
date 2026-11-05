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
- Pendiente: ícono PNG para iPhone (hoy es SVG).

## Marca
- Nombre: **CasaEnRegla**
- Idea central: "todo en orden con tu empleado, sin vueltas".
- Colores sugeridos: verde (en regla, confianza) + azul oscuro (seriedad). Evitar el celeste/azul institucional de ARCA.
- Logo sugerido: una casita con un tilde ✓ adentro o en el techo.
- Slogans posibles: "Tu empleado, en regla." / "Sueldo, recibo y avisos, sin vueltas."
- Pendiente: buscar el nombre en INPI, registrar dominio en NIC Argentina, reservar @casaenregla en Instagram.
