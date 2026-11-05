// ===== CasaEnRegla =====
// Secciones: utilidades · CUIL · DNI y cámara · navegación · empleados · mis datos · mi cuenta · login

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const URL_APP = location.origin + location.pathname; // a dónde vuelven los links de los mails

// ================= Utilidades =================
const el = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function mostrarEstado(nodo, texto, mal = false) {
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.classList.toggle('mal', mal);
}
const estadoDe = (form, clase = 'estado') => form.querySelector(`.${clase}`);

function limpiarMarcas(form) {
  form.querySelectorAll('.invalido').forEach((n) => n.classList.remove('invalido'));
  form.querySelectorAll('.estado, .errores, .aviso-cuil').forEach((n) => { n.textContent = ''; n.classList.remove('mal'); });
}

// Lee los campos indicados de un formulario (texto recortado, vacío → null)
function leerCampos(form, campos) {
  const f = new FormData(form);
  const datos = {};
  for (const c of campos) {
    const v = f.get(c);
    datos[c] = typeof v === 'string' ? (v.trim() || null) : v;
  }
  return datos;
}

// Completa un formulario con los datos de un objeto
function llenarForm(form, obj) {
  for (const [campo, valor] of Object.entries(obj || {})) {
    const n = form.elements[campo];
    if (!n || valor == null) continue;
    if (n.type === 'checkbox') n.checked = !!valor;
    else if (n instanceof RadioNodeList && n[0]?.type === 'checkbox') {
      n.forEach((c) => { c.checked = (valor || []).includes(c.value); });
    } else n.value = campo === 'cuil' ? formatearCuil(valor) : valor;
  }
}

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];
document.querySelectorAll('.sel-provincia').forEach((s) => {
  s.innerHTML = '<option value="">Elegir…</option>' + PROVINCIAS.map((p) => `<option>${p}</option>`).join('');
});

const claveValida = (p) => typeof p === 'string' && p.length >= 8;
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

// Traduce los errores de Supabase al español
function traducirError(error) {
  const c = error?.code || '';
  const m = (error?.message || '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'Todavía no confirmaste tu email. Buscá el mail que te mandamos (fijate también en spam).';
  if (c === 'user_already_exists' || c === 'email_exists' || m.includes('already registered')) return 'Ya existe una cuenta con ese email.';
  if (c === 'email_address_not_authorized') return 'Por ahora no se pueden mandar mails a esa dirección (falta configurar el envío de mails).';
  if (c.startsWith('over_') || m.includes('rate limit')) return 'Se hicieron muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (c === 'weak_password' || m.includes('password should')) return 'La contraseña es muy débil. Usá al menos 8 caracteres.';
  if (c === 'same_password' || m.includes('different from the old')) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  if (c === 'email_address_invalid' || m.includes('invalid format') || m.includes('is invalid')) return 'Ese email no es válido.';
  if (c === 'reauthentication_needed') return 'Por seguridad, salí y volvé a entrar antes de hacer este cambio.';
  return 'Hubo un problema. Revisá la conexión y probá de nuevo.';
}

// ================= CUIL =================
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function digitoVerificador(diez) {
  const suma = diez.split('').reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);
  const resto = suma % 11;
  return resto === 0 ? 0 : 11 - resto; // 10 → hay que cambiar el prefijo
}

function calcularCuil(dni, sexo) {
  dni = String(dni).replace(/\D/g, '').padStart(8, '0');
  if (dni.length !== 8) return null;
  let prefijo = sexo === 'M' ? '20' : sexo === 'F' ? '27' : '23';
  let dv = digitoVerificador(prefijo + dni);
  if (dv === 10) { prefijo = '23'; dv = sexo === 'F' ? 4 : 9; } // regla oficial
  return `${prefijo}-${dni}-${dv}`;
}

function cuilValido(cuil) {
  const n = String(cuil || '').replace(/\D/g, '');
  if (n.length !== 11) return false;
  const dv = digitoVerificador(n.slice(0, 10));
  return dv !== 10 && dv === Number(n[10]);
}

function formatearCuil(cuil) {
  const n = String(cuil).replace(/\D/g, '');
  return n.length === 11 ? `${n.slice(0, 2)}-${n.slice(2, 10)}-${n[10]}` : cuil;
}

// Botón "Calcular" y formato automático del CUIL en cada formulario que lo tenga
document.querySelectorAll('form').forEach((form) => {
  const btn = form.querySelector('[data-calcular-cuil]');
  if (!btn) return;
  const aviso = form.querySelector('.aviso-cuil');
  btn.addEventListener('click', () => {
    const dni = form.elements.dni.value, sexo = form.elements.sexo.value;
    if (!dni || !sexo) { aviso.textContent = 'Primero completá DNI y sexo.'; return; }
    form.elements.cuil.value = calcularCuil(dni, sexo);
    aviso.textContent = 'CUIL calculado. Confirmalo con el real (puede ser distinto en casos raros).';
  });
  form.elements.cuil.addEventListener('blur', () => {
    if (form.elements.cuil.value) form.elements.cuil.value = formatearCuil(form.elements.cuil.value);
  });
});

// ================= DNI y cámara =================
function fechaAIso(f) { // "dd/mm/aaaa" → "aaaa-mm-dd"
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((f || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
const capitalizar = (t) => (t || '').trim().toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());

function leerTextoDni(texto) {
  const p = texto.split('@').map((s) => s.trim());
  // DNI tarjeta: trámite@APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISIÓN@...
  if (p.length >= 8 && /^\d+$/.test(p[0]) && /^[MFX]$/.test(p[3])) {
    return { apellido: p[1], nombre: p[2], sexo: p[3], dni: p[4], nacimiento: p[6] };
  }
  // DNI libreta: @DNI@EJEMPLAR@?@APELLIDO@NOMBRE@NACIONALIDAD@NACIMIENTO@SEXO@...
  if (p.length >= 9 && p[0] === '' && /^[MFX]$/.test(p[8])) {
    return { apellido: p[4], nombre: p[5], sexo: p[8], dni: p[1], nacimiento: p[7] };
  }
  return null;
}

function completarConDni(form, d) {
  const dni = d.dni.replace(/\D/g, '');
  llenarForm(form, {
    apellido: capitalizar(d.apellido), nombre: capitalizar(d.nombre), sexo: d.sexo, dni,
    fecha_nacimiento: fechaAIso(d.nacimiento), cuil: calcularCuil(dni, d.sexo) || '',
  });
  form.querySelector('.aviso-cuil').textContent = 'CUIL calculado a partir del DNI. Confirmalo con el real.';
}

const visor = el('visor');
let lector = null;

function detenerEscaneo() {
  if (lector) lector.reset();
  lector = null;
  visor.hidden = true;
}

async function escanearDni(form) {
  const estado = estadoDe(form, 'estado-scan');
  if (!window.ZXing) { mostrarEstado(estado, 'No se pudo cargar el lector. Revisá la conexión a internet.', true); return; }
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  lector = new ZXing.BrowserMultiFormatReader(hints, 300);
  visor.hidden = false;
  el('estadoVisor').textContent = 'Buscando el código de barras…';

  try {
    await lector.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
      el('video'),
      (resultado) => {
        if (!resultado) return;
        const datos = leerTextoDni(resultado.getText());
        if (!datos) { el('estadoVisor').textContent = 'Leí un código pero no parece de un DNI. Probá de nuevo.'; return; }
        detenerEscaneo();
        completarConDni(form, datos);
        mostrarEstado(estado, '✓ Datos cargados. Revisalos antes de guardar.');
      },
    );
  } catch (e) {
    detenerEscaneo();
    mostrarEstado(estado, 'No se pudo abrir la cámara. Revisá que la app tenga permiso.', true);
    console.error(e);
  }
}

document.querySelectorAll('[data-escanear]').forEach((b) => b.addEventListener('click', () => escanearDni(b.closest('form'))));
el('btnCancelarScan').addEventListener('click', detenerEscaneo);

// ================= Navegación dentro de la app =================
const VISTAS = ['vistaLista', 'vistaFicha', 'vistaForm', 'vistaLiquidar', 'vistaPerfil', 'vistaCuenta', 'vistaAdmin'];
const ALCARGAR = {
  vistaLista: () => cargarLista(), vistaPerfil: () => cargarPerfil(), vistaCuenta: () => cargarCuenta(),
  vistaAdmin: () => window.cargarAdmin?.(),
};

function irA(vista) {
  detenerEscaneo();
  VISTAS.forEach((v) => { el(v).hidden = v !== vista; });
  const pestania = ['vistaFicha', 'vistaForm', 'vistaLiquidar'].includes(vista) ? 'vistaLista' : vista;
  document.querySelectorAll('.pestanias button').forEach((b) => b.classList.toggle('activa', b.dataset.vista === pestania));
  window.scrollTo({ top: 0 });
  ALCARGAR[vista]?.();
}
document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));

// ================= Empleados =================
const CATEGORIAS = { 1: 'Supervisor/a', 2: 'Tareas específicas', 3: 'Caseros', 4: 'Asistencia y cuidado', 5: 'Tareas generales' };
const CAMPOS_EMPLEADO = [
  'apellido', 'nombre', 'dni', 'sexo', 'fecha_nacimiento', 'cuil',
  'calle', 'numero', 'piso_depto', 'codigo_postal', 'localidad', 'provincia',
  'fecha_ingreso', 'categoria', 'modalidad', 'horas_semanales',
  'telefono', 'pago_medio_acordado', 'pago_alias',
];
const formEmpleado = el('formEmpleado');
const listaEl = el('listaEmpleados');
const estadoLista = el('estadoLista');
let empleados = [];
let editandoId = null;
let mensajeLista = ''; // mensaje para mostrar cuando termine de cargar la lista

async function cargarLista() {
  fichaActual = null;
  mostrarEstado(estadoLista, 'Cargando…');
  const [{ data, error }, perfil] = await Promise.all([
    db.from('empleados').select('*').order('apellido').order('nombre'),
    db.from('empleadores').select('apellido, cuil').maybeSingle(),
  ]);
  el('bannerPerfil').hidden = !!(perfil.data?.apellido && perfil.data?.cuil);
  if (error) { mostrarEstado(estadoLista, 'No se pudo cargar la lista. Revisá la conexión.', true); console.error(error); return; }
  mostrarEstado(estadoLista, mensajeLista);
  mensajeLista = '';
  empleados = data;
  listaEl.innerHTML = data.length
    ? data.map((e) => `
        <div class="item-fila">
          <button type="button" class="item" data-id="${e.id}">
            <b>${escapar(e.apellido)}, ${escapar(e.nombre)}</b>
            <span>${e.categoria}ª ${CATEGORIAS[e.categoria] || ''} · ${e.modalidad === 'sin_retiro' ? 'Sin retiro' : 'Con retiro'} · desde ${fechaCorta(e.fecha_ingreso)}</span>
          </button>
          <button type="button" class="btn-liquidar" data-liquidar="${e.id}">💰<br>Liquidar</button>
        </div>`).join('')
    : '<p class="vacio">Todavía no cargaste ningún empleado.</p>';
}

function abrirEmpleado(empleado = null) {
  editandoId = empleado?.id || null;
  formEmpleado.reset();
  limpiarMarcas(formEmpleado);
  llenarForm(formEmpleado, empleado);
  el('tituloForm').textContent = empleado ? `${empleado.nombre} ${empleado.apellido}` : 'Nuevo empleado';
  formEmpleado.querySelector('[type=submit]').textContent = empleado ? 'Guardar cambios' : 'Guardar';
  irA('vistaForm');
  actualizarCajaEscala();
}

listaEl.addEventListener('click', (ev) => {
  const liq = ev.target.closest('[data-liquidar]');
  if (liq) { abrirLiquidacion(empleados.find((e) => e.id === liq.dataset.liquidar)); return; }
  const item = ev.target.closest('.item');
  if (item) abrirFicha(empleados.find((e) => e.id === item.dataset.id));
});
el('btnNuevo').addEventListener('click', () => abrirEmpleado());

function validarEmpleado(e) {
  const errores = [];
  const marcar = (campo, msj) => { formEmpleado.elements[campo]?.classList?.add('invalido'); errores.push(msj); };
  if (!e.apellido) marcar('apellido', 'Falta el apellido.');
  if (!e.nombre) marcar('nombre', 'Falta el nombre.');
  if (!/^\d{7,8}$/.test(e.dni || '')) marcar('dni', 'El DNI tiene que tener 7 u 8 números.');
  if (!e.sexo) marcar('sexo', 'Elegí el sexo.');
  if (!cuilValido(e.cuil)) marcar('cuil', 'El CUIL no es válido.');
  if (!e.fecha_ingreso) marcar('fecha_ingreso', 'Falta la fecha de ingreso.');
  if (!e.categoria) marcar('categoria', 'Elegí la categoría.');
  if (!e.modalidad) errores.push('Elegí la modalidad (con o sin retiro).');
  if (e.telefono && e.telefono.replace(/\D/g, '').length !== 10) marcar('telefono', 'El celular tiene que tener 10 números (código de área sin 0 + número sin 15).');
  return errores;
}

formEmpleado.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limpiarMarcas(formEmpleado);
  const e = leerCampos(formEmpleado, CAMPOS_EMPLEADO);
  e.cuil = (e.cuil || '').replace(/\D/g, '');
  e.categoria = e.categoria ? Number(e.categoria) : null;
  e.horas_semanales = e.horas_semanales ? Number(e.horas_semanales) : null;
  e.dias = new FormData(formEmpleado).getAll('dias');
  e.es_jubilado = formEmpleado.elements.es_jubilado.checked;
  e.descuenta_aporte = formEmpleado.elements.descuenta_aporte.checked;

  const errores = validarEmpleado(e);
  formEmpleado.querySelector('.errores').textContent = errores.join('\n');
  if (errores.length) return;

  const btn = formEmpleado.querySelector('[type=submit]');
  btn.disabled = true;
  const { error } = editandoId
    ? await db.from('empleados').update(e).eq('id', editandoId)
    : await db.from('empleados').insert(e);
  btn.disabled = false;

  if (error) {
    const msj = error.code === '23505' ? 'Ya tenés cargado un empleado con ese DNI.' : 'No se pudo guardar. Revisá la conexión y probá de nuevo.';
    mostrarEstado(estadoDe(formEmpleado, 'estado-guardar'), msj, true);
    console.error(error);
    return;
  }
  mensajeLista = `✓ ${e.nombre} ${e.apellido} ${editandoId ? 'actualizado' : 'guardado'}.`;
  irA('vistaLista');
});

// ================= Escalas salariales =================
const pesos = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const hoyIso = () => new Date().toLocaleDateString('sv'); // aaaa-mm-dd en hora local
let escalasCache = new Map(); // "cat|modalidad|fecha" -> fila (se vacía cuando el admin guarda)

// Escala que rige en una fecha para una categoría y modalidad
// Pide solo la escala que hace falta (la más reciente vigente a esa fecha)
async function escalaVigente(categoria, modalidad, fecha = hoyIso()) {
  const clave = `${categoria}|${modalidad}|${fecha}`;
  if (escalasCache.has(clave)) return escalasCache.get(clave);
  const { data, error } = await db.from('escalas').select('*')
    .eq('categoria', Number(categoria)).eq('modalidad', modalidad).lte('vigencia_desde', fecha)
    .order('vigencia_desde', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  escalasCache.set(clave, data);
  return data;
}

async function actualizarCajaEscala() {
  const caja = el('cajaEscala');
  const categoria = formEmpleado.elements.categoria.value;
  const modalidad = formEmpleado.elements.modalidad.value;
  if (!categoria || !modalidad) { caja.hidden = true; return; }
  try {
    const e = await escalaVigente(categoria, modalidad);
    caja.hidden = false;
    caja.innerHTML = e
      ? `Escala vigente desde ${fechaCorta(e.vigencia_desde)}${e.resolucion ? ` (Res. ${escapar(e.resolucion)})` : ''}:
         <div class="montos"><span><b>${pesos(e.valor_hora)}</b><small>por hora</small></span>
         <span><b>${pesos(e.valor_mensual)}</b><small>por mes (jornada completa)</small></span></div>`
      : 'No hay escala cargada para esta categoría y modalidad.';
  } catch (err) {
    caja.hidden = false;
    caja.textContent = 'No se pudo cargar la escala salarial.';
    console.error(err);
  }
}
formEmpleado.elements.categoria.addEventListener('change', actualizarCajaEscala);
formEmpleado.querySelectorAll('input[name="modalidad"]').forEach((r) => r.addEventListener('change', actualizarCajaEscala));

// ================= Ficha del empleado: resumen e historial =================
let fichaActual = null;     // empleado cuya ficha está abierta (para volver a ella)
let liqsFicha = [];
const ESTADOS_LIQ = { borrador: 'Borrador', confirmada: 'Recibo emitido', pagada: 'Pagada ✓' };

document.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', () => {
  if (fichaActual) abrirFicha(fichaActual); else irA('vistaLista');
}));

function antiguedadTexto(fechaIngreso) {
  if (!fechaIngreso) return '';
  const [a, m] = fechaIngreso.split('-').map(Number);
  const hoy = new Date();
  let meses = (hoy.getFullYear() - a) * 12 + (hoy.getMonth() + 1 - m);
  if (hoy.getDate() < Number(fechaIngreso.slice(8, 10))) meses--;
  const anios = Math.floor(meses / 12), resto = meses % 12;
  return [anios ? `${anios} año${anios === 1 ? '' : 's'}` : '', resto ? `${resto} mes${resto === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' y ') || 'menos de un mes';
}

async function abrirFicha(empleado) {
  fichaActual = empleado;
  irA('vistaFicha');
  const e = empleado;
  el('tituloFicha').textContent = `${e.nombre} ${e.apellido}`;
  el('datosFicha').textContent = [
    `${e.categoria}ª ${CATEGORIAS[e.categoria] || ''}`,
    e.modalidad === 'sin_retiro' ? 'Sin retiro' : 'Con retiro',
    e.horas_semanales ? `${e.horas_semanales} hs semanales` : '',
    `Ingreso ${fechaCorta(e.fecha_ingreso)} (${antiguedadTexto(e.fecha_ingreso)})`,
  ].filter(Boolean).join(' · ');
  el('resumenFicha').innerHTML = '<p class="ayuda">Cargando…</p>';
  el('listaLiqFicha').innerHTML = '';

  const { data, error } = await db.from('liquidaciones').select('*').eq('empleado_id', e.id).order('periodo', { ascending: false });
  if (fichaActual !== empleado) return; // se cambió de pantalla mientras cargaba
  if (error) { el('resumenFicha').innerHTML = '<p class="estado mal">No se pudieron cargar las liquidaciones.</p>'; console.error(error); return; }
  liqsFicha = data;

  const anioActual = new Date().getFullYear();
  const anios = [...new Set([anioActual, ...data.map((l) => Number(l.periodo.slice(0, 4)))])].sort((a, b) => b - a);
  el('selAnioFicha').innerHTML = anios.map((a) => `<option>${a}</option>`).join('');
  dibujarFicha(anioActual);
}

const costoDe = (l) => Number(l.neto) + Number(l.pago_arca);
const tieneDesvio = (l) => ['desvio_recibo', 'desvio_pago', 'desvio_vep'].some((c) => l[c] != null && Math.abs(Number(l[c])) >= 1);

function dibujarFicha(anio) {
  const e = fichaActual;
  const delAnio = liqsFicha.filter((l) => Number(l.periodo.slice(0, 4)) === Number(anio));
  const suma = (f) => delAnio.reduce((acc, l) => acc + f(l), 0);
  const pagadas = delAnio.filter((l) => l.estado === 'pagada').length;
  const mejor = delAnio.reduce((m, l) => Math.max(m, Number(l.total_remunerativo)), 0);
  const conDesvio = delAnio.filter(tieneDesvio).length;

  // Meses del año (hasta el actual) sin liquidación, desde el ingreso
  const hoyMes = mesActual();
  const desde = e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) > `${anio}-01` ? e.fecha_ingreso.slice(0, 7) : `${anio}-01`;
  const hechos = new Set(delAnio.map((l) => l.periodo.slice(0, 7)));
  const faltan = [];
  for (let m = 1; m <= 12; m++) {
    const p = `${anio}-${String(m).padStart(2, '0')}`;
    if (p >= desde && p <= hoyMes && !hechos.has(p)) faltan.push(p);
  }
  const textoFaltan = faltan.length ? `<p class="pendientes">Sin liquidar: ${faltan.map((p) => nombrePeriodo(p)).join(', ')}.</p>` : '';

  el('resumenFicha').innerHTML = delAnio.length ? `
    <div class="cifras">
      <div class="cifra grande"><small>Costo total ${anio} (sueldos + ARCA)</small><b>${pesos(suma(costoDe))}</b></div>
      <div class="cifra"><small>Neto cobrado por el empleado</small><b>${pesos(suma((l) => Number(l.neto)))}</b></div>
      <div class="cifra"><small>Pagado a ARCA (VEP)</small><b>${pesos(suma((l) => Number(l.pago_arca)))}</b></div>
      <div class="cifra"><small>Liquidaciones</small><b>${delAnio.length}</b> <small>${pagadas} pagada${pagadas === 1 ? '' : 's'}</small></div>
      <div class="cifra"><small>Mayor remuneración del año</small><b>${pesos(mejor)}</b> <small>base para aguinaldo</small></div>
    </div>
    ${conDesvio ? `<p class="pendientes">⚠ ${conDesvio} liquidación${conDesvio === 1 ? '' : 'es'} con diferencias entre lo liquidado y lo emitido o pagado.</p>` : ''}
    ${textoFaltan}`
    : `<p class="ayuda">No hay liquidaciones en ${anio}.</p>${textoFaltan}`;

  el('listaLiqFicha').innerHTML = delAnio.length ? delAnio.map((l) => `
    <button type="button" class="item liq-item" data-periodo="${l.periodo.slice(0, 7)}">
      <div class="fila-liq"><b>${nombrePeriodo(l.periodo.slice(0, 7))}</b><span class="estado-liq-chip ${l.estado}">${ESTADOS_LIQ[l.estado] || l.estado}</span></div>
      <span>Neto ${pesos(l.neto)} · Costo total ${pesos(costoDe(l))}${l.pago_fecha ? ` · pagado el ${fechaCorta(l.pago_fecha)}` : ''}</span>
      ${tieneDesvio(l) ? '<span class="desvios">⚠ Tiene diferencias: revisalas en el cierre del mes</span>' : ''}
    </button>`).join('') : '<p class="vacio">Todavía no hay liquidaciones este año.</p>';
}

el('selAnioFicha').addEventListener('change', (ev) => dibujarFicha(ev.target.value));
el('listaLiqFicha').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-periodo]');
  if (b) abrirLiquidacion(fichaActual, b.dataset.periodo);
});
el('btnFichaLiquidar').addEventListener('click', () => abrirLiquidacion(fichaActual));
el('btnFichaEditar').addEventListener('click', () => abrirEmpleado(fichaActual));

// ================= Liquidar mes =================
const formLiq = el('formLiq');
const resultadoLiq = el('resultadoLiq');
const listaOtros = el('listaOtros');
let liq = { empleado: null, datos: null, resultado: null };

const mesActual = () => hoyIso().slice(0, 7);
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombrePeriodo = (p) => `${NOMBRE_MES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

// ---- Renglones de "Otros conceptos" ----
function agregarOtro(o = {}) {
  const div = document.createElement('div');
  div.className = 'otro';
  div.innerHTML = `
    <label>Concepto <input data-campo="descripcion" placeholder="Ej.: Reintegro de transporte" value="${escapar(o.descripcion || '')}"></label>
    <div class="fila">
      <label>Importe $ <input data-campo="importe" type="number" min="0" step="0.01" inputmode="decimal" value="${o.importe ?? ''}"></label>
      <label>Tipo
        <select data-campo="tipo">
          <option value="norem"${o.tipo !== 'rem' ? ' selected' : ''}>No remunerativo</option>
          <option value="rem"${o.tipo === 'rem' ? ' selected' : ''}>Remunerativo</option>
        </select>
      </label>
    </div>
    <div class="fila">
      <label class="opcion"><input type="checkbox" data-campo="fijo"${o.fijo ? ' checked' : ''}> Todos los meses</label>
      <button type="button" class="quitar">Quitar</button>
    </div>`;
  div.querySelector('.quitar').addEventListener('click', () => { div.remove(); recalcular(); });
  listaOtros.appendChild(div);
}
el('btnAgregarOtro').addEventListener('click', () => { agregarOtro(); listaOtros.lastElementChild.querySelector('input').focus(); });

function leerOtros() {
  return [...listaOtros.querySelectorAll('.otro')].map((d) => ({
    descripcion: d.querySelector('[data-campo=descripcion]').value.trim(),
    importe: Number(d.querySelector('[data-campo=importe]').value) || 0,
    tipo: d.querySelector('[data-campo=tipo]').value,
    fijo: d.querySelector('[data-campo=fijo]').checked,
  })).filter((o) => o.descripcion || o.importe);
}

function leerNovedades() {
  const n = (c) => Number(formLiq.elements[c].value) || 0;
  return {
    faltas_dias: n('faltas_dias'), horas_extra_50: n('horas_extra_50'),
    horas_extra_100: n('horas_extra_100'), horas_feriado: n('horas_feriado'), otros: leerOtros(),
  };
}

// ---- Datos que necesita el cálculo para un período ----
async function datosDelPeriodo(empleado, periodo) {
  const fecha = `${periodo}-01`;
  const [escala, params, aportes, perfil, existente] = await Promise.all([
    escalaVigente(empleado.categoria, empleado.modalidad, fecha),
    db.from('parametros').select('*').lte('vigencia_desde', fecha).order('vigencia_desde', { ascending: false }),
    db.from('aportes_arca').select('*').lte('periodo_desde', fecha).order('periodo_desde', { ascending: false }),
    db.from('empleadores').select('provincia, localidad, trabajo_mismo_domicilio, trabajo_provincia, trabajo_localidad').maybeSingle(),
    db.from('liquidaciones').select('*').eq('empleado_id', empleado.id).eq('periodo', fecha).maybeSingle(),
  ]);
  for (const r of [params, aportes, perfil, existente]) if (r.error) throw r.error;

  const param = {};
  for (const p of params.data) if (!(p.clave in param)) param[p.clave] = Number(p.valor);
  if (param.antiguedad_desde) { // viene como aaaammdd
    const s = String(param.antiguedad_desde);
    param.antiguedad_desde = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const filasAportes = aportes.data.filter((a) => a.periodo_desde === aportes.data[0]?.periodo_desde);

  const pf = perfil.data;
  const zona = pf ? (pf.trabajo_mismo_domicilio
    ? Liquidacion.esZonaDesfavorable(pf.provincia, pf.localidad)
    : Liquidacion.esZonaDesfavorable(pf.trabajo_provincia, pf.trabajo_localidad)) : false;

  return { escala, param, aportes: filasAportes, zona, sinPerfil: !pf, existente: existente.data };
}

function abrirLiquidacion(empleado, periodo = mesActual()) {
  liq = { empleado, datos: null, resultado: null };
  el('tituloLiq').textContent = `Liquidar a ${empleado.nombre} ${empleado.apellido}`;
  formLiq.reset();
  limpiarMarcas(formLiq);
  formLiq.elements.periodo.value = periodo;
  irA('vistaLiquidar');
  cargarPeriodo();
}

async function cargarPeriodo() {
  const periodo = formLiq.elements.periodo.value;
  if (!periodo) return;
  limpiarMarcas(formLiq);
  liq.fila = null;
  formCierre.hidden = true;
  listaOtros.innerHTML = '';
  ['faltas_dias', 'horas_extra_50', 'horas_extra_100', 'horas_feriado'].forEach((c) => { formLiq.elements[c].value = ''; });
  resultadoLiq.innerHTML = '<p class="ayuda">Cargando…</p>';

  try {
    liq.datos = await datosDelPeriodo(liq.empleado, periodo);
  } catch (err) {
    resultadoLiq.innerHTML = '<p class="estado mal">No se pudieron cargar los datos. Revisá la conexión.</p>';
    console.error(err);
    return;
  }

  const ex = liq.datos.existente;
  liq.fila = ex;
  mostrarCierre();
  const estado = estadoDe(formLiq, 'estado-liq');
  if (ex) {
    const n = ex.novedades || {};
    ['faltas_dias', 'horas_extra_50', 'horas_extra_100', 'horas_feriado'].forEach((c) => { formLiq.elements[c].value = n[c] || ''; });
    (n.otros || []).forEach(agregarOtro);
    mostrarEstado(estado, `Ya hay una liquidación guardada de ${nombrePeriodo(periodo)} (${new Date(ex.actualizado).toLocaleDateString('es-AR')}). Si cambiás algo, guardala de nuevo.`);
  } else {
    (liq.empleado.conceptos_fijos || []).forEach((o) => agregarOtro({ ...o, fijo: true }));
    mostrarEstado(estado, '');
  }
  recalcular();
}
formLiq.elements.periodo.addEventListener('change', cargarPeriodo);
formLiq.addEventListener('input', (ev) => { if (ev.target.name !== 'periodo') recalcular(); });

function recalcular() {
  const d = liq.datos;
  if (!d) return;
  const periodo = formLiq.elements.periodo.value;
  if (!d.escala) {
    liq.resultado = null;
    resultadoLiq.innerHTML = `<p class="estado mal">No hay escala salarial cargada para ${nombrePeriodo(periodo)}.</p>`;
    return;
  }
  const r = Liquidacion.calcular({
    empleado: liq.empleado, periodo, escala: d.escala, param: d.param,
    zona: d.zona, aportes: d.aportes, novedades: leerNovedades(),
  });
  liq.resultado = r;
  if (d.sinPerfil) r.avisos.push('Completá "Mis datos" para saber si corresponde zona desfavorable.');

  const fila = (x) => `<tr><td>${escapar(x.concepto)}<small>${escapar(x.detalle)}</small></td>
    <td class="monto${x.importe < 0 ? ' negativo' : ''}">${pesos(x.importe)}</td></tr>`;
  const grupo = (tipo) => r.renglones.filter((x) => x.tipo === tipo).map(fila).join('');
  const horas = liq.empleado.horas_semanales;

  resultadoLiq.innerHTML = `
    ${r.avisos.length ? `<ul class="avisos">${r.avisos.map((a) => `<li>${escapar(a)}</li>`).join('')}</ul>` : ''}
    <p class="info-liq">${r.modalidad_liquidacion === 'mensual' ? `Mensualizado (${horas} hs semanales)` : `Por hora (${horas} hs semanales, menos de ${d.param.horas_mensualizado || 24})`}
      · Escala desde ${fechaCorta(d.escala.vigencia_desde)}${d.zona ? ' · Zona desfavorable' : ''}</p>
    <table class="tabla-liq">
      ${grupo('rem')}
      <tr class="subtotal"><td>Total remunerativo</td><td class="monto">${pesos(r.total_remunerativo)}</td></tr>
      ${r.total_no_remun ? `${grupo('norem')}<tr class="subtotal"><td>Total no remunerativo</td><td class="monto">${pesos(r.total_no_remun)}</td></tr>` : ''}
      ${r.total_descuentos ? `${grupo('desc')}<tr class="subtotal"><td>Total descuentos</td><td class="monto negativo">-${pesos(r.total_descuentos)}</td></tr>` : ''}
    </table>
    <div class="neto"><small>Neto a cobrar</small><b>${pesos(r.neto)}</b><small>${escapar(r.neto_letras)}</small></div>
    ${r.arca ? `<div class="caja-arca"><b>A pagar en ARCA (VEP): ${pesos(r.pago_arca)}</b><br>
      Aporte obra social ${pesos(r.arca.aporte_os)} · Contribución SIPA ${pesos(r.arca.contribucion_sipa)} · ART ${pesos(r.arca.cuota_art)}
      ${liq.empleado.descuenta_aporte ? '<br><small>El aporte de obra social se le descuenta al empleado (acordado).</small>' : ''}</div>` : ''}
    <div class="caja-costo">
      <h4>Costo total del mes para el empleador</h4>
      <table class="tabla-liq">
        <tr><td>Asignaciones remunerativas</td><td class="monto">${pesos(r.total_remunerativo)}</td></tr>
        ${r.total_no_remun ? `<tr><td>Asignaciones no remunerativas</td><td class="monto">${pesos(r.total_no_remun)}</td></tr>` : ''}
        <tr><td>Aportes y contribuciones a tu cargo<small>${liq.empleado.descuenta_aporte ? 'SIPA + ART (la obra social la aporta el empleado)' : 'Obra social + SIPA + ART'}</small></td>
          <td class="monto">${pesos(r.cargas_empleador)}</td></tr>
        <tr class="subtotal"><td>Costo total</td><td class="monto">${pesos(r.costo_total)}</td></tr>
      </table>
      <small>Es lo que sale de tu bolsillo: neto al empleado (${pesos(r.neto)}) + VEP a ARCA (${pesos(r.pago_arca)}).</small>
    </div>`;
}

formLiq.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = liq.resultado;
  const estado = estadoDe(formLiq, 'estado-guardar');
  if (!r) { mostrarEstado(estado, 'No se puede guardar: falta la escala salarial del período.', true); return; }

  const periodo = formLiq.elements.periodo.value;
  const novedades = leerNovedades();
  const fila = {
    empleado_id: liq.empleado.id,
    periodo: `${periodo}-01`,
    novedades,
    detalle: { renglones: r.renglones, modalidad_liquidacion: r.modalidad_liquidacion, anios_antiguedad: r.anios_antiguedad,
      horas_liquidadas: r.horas_liquidadas, valor_hora: r.valor_hora, arca: r.arca, neto_letras: r.neto_letras, escala: liq.datos.escala, zona: liq.datos.zona,
      cargas_empleador: r.cargas_empleador, costo_total: r.costo_total },
    total_remunerativo: r.total_remunerativo,
    total_no_remun: r.total_no_remun,
    total_descuentos: r.total_descuentos,
    neto: r.neto,
    pago_arca: r.pago_arca,
    actualizado: new Date().toISOString(),
  };

  const btn = formLiq.querySelector('[type=submit]');
  btn.disabled = true;
  mostrarEstado(estado, 'Guardando…');
  const fijos = novedades.otros.filter((o) => o.fijo).map(({ descripcion, importe, tipo }) => ({ descripcion, importe, tipo }));
  const [res, resFijos] = await Promise.all([
    db.from('liquidaciones').upsert(fila, { onConflict: 'empleado_id,periodo' }).select().single(),
    db.from('empleados').update({ conceptos_fijos: fijos }).eq('id', liq.empleado.id),
  ]);
  btn.disabled = false;
  if (res.error || resFijos.error) {
    mostrarEstado(estado, 'No se pudo guardar la liquidación. Probá de nuevo.', true);
    console.error(res.error || resFijos.error);
    return;
  }
  liq.empleado.conceptos_fijos = fijos;
  liq.fila = res.data;
  mostrarCierre();
  mostrarEstado(estado, `✓ Liquidación de ${nombrePeriodo(periodo)} guardada. Abajo podés cerrar el mes.`);
});

// ================= Cierre del mes: ARCA, pago, comprobantes, WhatsApp =================
const formCierre = el('formCierre');
const numArca = (n) => Number(n).toFixed(2).replace('.', ','); // formato para pegar: 1234,56

function mostrarCierre() {
  const f = liq.fila;
  formCierre.hidden = !f;
  if (!f) return;
  formCierre.reset();
  limpiarMarcas(formCierre);
  const det = f.detalle || {};

  // ---- Valores para copiar en ARCA ----
  const valores = [
    ['Período', `${f.periodo.slice(5, 7)}/${f.periodo.slice(0, 4)}`],
    ['Modalidad de liquidación', det.modalidad_liquidacion === 'por_hora' ? 'Por hora' : 'Mensual'],
    ['Horas semanales', String(liq.empleado.horas_semanales ?? '')],
  ];
  if (f.vep_numero) valores.push(['Nº de comprobante de pago de aportes (VEP)', f.vep_numero]);
  if (det.modalidad_liquidacion === 'por_hora' && det.horas_liquidadas != null) {
    valores.push(['Cantidad de horas', numArca(det.horas_liquidadas)], ['Valor hora', numArca(det.valor_hora)]);
  }
  for (const x of det.renglones || []) {
    const tipo = x.tipo === 'norem' ? 'No remunerativo' : x.tipo === 'desc' ? 'Descuento' : 'Remunerativo';
    valores.push([x.concepto, numArca(Math.abs(x.importe)), tipo + (x.importe < 0 && x.tipo === 'rem' ? ' · se resta' : '')]);
  }
  valores.push(['Neto a cobrar (para controlar)', numArca(f.neto)]);
  el('valoresArca').innerHTML = valores.map(([k, v, nota]) => `
    <div class="valor-arca"><span>${escapar(k)}${nota ? `<small>${escapar(nota)}</small>` : ''}</span>
    <b>${escapar(v)}</b><button type="button" data-copiar="${escapar(v)}">Copiar</button></div>`).join('');

  // ---- Datos ya registrados (o sugeridos) ----
  formCierre.querySelector('.monto-arca').textContent = pesos(f.pago_arca);
  llenarForm(formCierre, {
    vep_numero: f.vep_numero,
    vep_fecha: f.vep_fecha,
    vep_importe: f.vep_importe,
    recibo_arca_neto: f.recibo_arca_neto,
    pago_fecha: f.pago_fecha,
    pago_medio: f.pago_medio || liq.empleado.pago_medio_acordado,
    pago_transaccion: f.pago_transaccion,
    pago_importe: f.pago_importe ?? f.neto,
    observaciones: f.observaciones,
  });
  ['vep_archivo', 'recibo_arca_archivo', 'pago_archivo'].forEach(mostrarArchivo);
  mostrarControlRecibo(f.recibo_arca_conceptos);
  actualizarCierre();
}

// Compara lo que dice el recibo de ARCA con la liquidación
function mostrarControlRecibo(a) {
  const caja = el('controlRecibo');
  if (!a) { caja.innerHTML = ''; return; }
  const f = liq.fila;
  const chequeos = [];
  if (a.periodo) {
    chequeos.push(a.periodo === f.periodo.slice(0, 7)
      ? ['ok', `Período correcto (${nombrePeriodo(a.periodo)}).`]
      : ['mal', `El recibo es de ${nombrePeriodo(a.periodo)}, pero estás liquidando ${nombrePeriodo(f.periodo.slice(0, 7))}.`]);
  }
  const cuil = String(liq.empleado.cuil || '');
  if (a.cuiles && a.cuiles.length) {
    chequeos.push(a.cuiles.includes(cuil)
      ? ['ok', 'El CUIL del empleado coincide.']
      : ['mal', 'No encontré el CUIL de este empleado en el recibo: puede ser de otra persona.']);
  }

  // Conceptos: ARCA vs CasaEnRegla, agrupados por tipo
  const nuestros = {};
  for (const x of (f.detalle && f.detalle.renglones) || []) {
    if (x.tipo === 'desc') continue;
    const k = Liquidacion.claveConcepto(x.concepto);
    nuestros[k] = nuestros[k] || { nombre: x.concepto, importe: 0 };
    nuestros[k].importe += x.importe;
  }
  const filas = [];
  const vistos = new Set();
  for (const c of a.conceptos || []) {
    const k = Liquidacion.claveConcepto(c.nombre);
    vistos.add(k);
    const n = nuestros[k] ? nuestros[k].importe : null;
    const ok = n != null && Math.abs(n - c.importe) < 1;
    filas.push(`<tr><td>${escapar(c.nombre)}</td><td>${pesos(c.importe)}</td><td class="${ok ? 'ok' : 'mal'}">${n != null ? pesos(n) : '—'}</td></tr>`);
  }
  for (const [k, n] of Object.entries(nuestros)) {
    if (!vistos.has(k)) filas.push(`<tr><td>${escapar(n.nombre)}</td><td class="mal">—</td><td>${pesos(n.importe)}</td></tr>`);
  }
  caja.innerHTML = `<div class="control"><h4>Control del recibo de ARCA</h4>
    <ul>${chequeos.map(([c, t]) => `<li class="${c}">${c === 'ok' ? '✓' : '⚠'} ${escapar(t)}</li>`).join('')}</ul>
    ${filas.length ? `<table><tr><th>Concepto</th><th>ARCA</th><th>CasaEnRegla</th></tr>${filas.join('')}</table>` : ''}</div>`;
}

el('valoresArca').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-copiar]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.copiar);
    b.textContent = '✓ Copiado';
    setTimeout(() => { b.textContent = 'Copiar'; }, 1500);
  } catch { b.textContent = 'No se pudo'; }
});

// Muestra si hay diferencia entre un importe y lo que correspondía según la liquidación
function mostrarDesvio(nodo, valor, referencia, que = 'lo liquidado') {
  nodo.classList.remove('ok', 'mal');
  if (valor === '' || valor == null || !liq.fila) { nodo.textContent = ''; return; }
  const dif = Math.round((Number(valor) - Number(referencia)) * 100) / 100;
  if (Math.abs(dif) < 1) { nodo.textContent = `✓ Coincide con ${que}.`; nodo.classList.add('ok'); return; }
  nodo.textContent = `⚠ Diferencia de ${pesos(Math.abs(dif))} (${dif > 0 ? 'más' : 'menos'} que ${que}: ${pesos(referencia)}). Revisá o anotá el motivo en Observaciones.`;
  nodo.classList.add('mal');
}

function actualizarCierre() {
  if (!liq.fila) return;
  mostrarDesvio(formCierre.querySelector('.desvio-vep'), formCierre.elements.vep_importe.value, liq.fila.pago_arca, 'lo calculado para ARCA');
  mostrarDesvio(formCierre.querySelector('.desvio-recibo'), formCierre.elements.recibo_arca_neto.value, liq.fila.neto);
  mostrarDesvio(formCierre.querySelector('.desvio-pago'), formCierre.elements.pago_importe.value, liq.fila.neto);
  // Costo real del mes (sueldo pagado + VEP) contra el costo total liquidado
  const sueldo = formCierre.elements.pago_importe.value, vep = formCierre.elements.vep_importe.value;
  const nodoCosto = formCierre.querySelector('.costo-real');
  if (sueldo !== '' && vep !== '') {
    mostrarDesvio(nodoCosto, Number(sueldo) + Number(vep), Number(liq.fila.neto) + Number(liq.fila.pago_arca), 'el costo total liquidado');
    nodoCosto.textContent = `Costo real del mes: ${pesos(Number(sueldo) + Number(vep))} (sueldo + VEP). ` + nodoCosto.textContent;
  } else nodoCosto.textContent = '';
  const medio = formCierre.elements.pago_medio.value;
  formCierre.querySelectorAll('.solo-transferencia').forEach((n) => { n.hidden = medio !== 'transferencia'; });
  formCierre.querySelectorAll('.solo-efectivo').forEach((n) => { n.hidden = medio !== 'efectivo'; });
  const alias = liq.empleado.pago_alias;
  formCierre.querySelector('.alias-pago').textContent = medio === 'transferencia' && alias ? `Alias / CBU del empleado: ${alias}` : '';
}
formCierre.addEventListener('input', actualizarCierre);
formCierre.addEventListener('change', actualizarCierre);

// ---- Archivos (recibo de ARCA y comprobante de pago) ----
function mostrarArchivo(campo) {
  const p = formCierre.querySelector(`.archivo-${campo}`);
  const ruta = liq.fila?.[campo];
  p.innerHTML = ruta ? `✓ Archivo cargado · <button type="button" class="link" data-ver="${escapar(ruta)}">Ver</button>` : '';
}

formCierre.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-ver]');
  if (!b) return;
  const { data, error } = await db.storage.from('comprobantes').createSignedUrl(b.dataset.ver, 120);
  if (error) { alert('No se pudo abrir el archivo.'); console.error(error); return; }
  window.open(data.signedUrl, '_blank');
});

formCierre.querySelectorAll('[data-archivo]').forEach((input) => input.addEventListener('change', async () => {
  const archivo = input.files[0];
  if (!archivo) return;
  const campo = input.dataset.archivo;
  const aviso = formCierre.querySelector(`.archivo-${campo}`);
  if (archivo.size > 10 * 1024 * 1024) { aviso.textContent = 'El archivo es muy grande (máximo 10 MB).'; return; }

  aviso.textContent = 'Subiendo…';
  const { data: { user } } = await db.auth.getUser();
  const ext = (archivo.name.split('.').pop() || 'pdf').toLowerCase();
  const nombres = { pago_archivo: 'pago', recibo_arca_archivo: 'recibo-arca', vep_archivo: 'vep' };
  const ruta = `${user.id}/${liq.fila.id}/${nombres[campo]}.${ext}`;
  const subida = await db.storage.from('comprobantes').upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (subida.error) { aviso.textContent = 'No se pudo subir el archivo. Probá de nuevo.'; console.error(subida.error); return; }
  const { error } = await db.from('liquidaciones').update({ [campo]: ruta }).eq('id', liq.fila.id);
  if (error) { aviso.textContent = 'Se subió, pero no se pudo registrar. Probá de nuevo.'; console.error(error); return; }
  liq.fila[campo] = ruta;
  mostrarArchivo(campo);

  // Si es un PDF de ARCA, intento leer los datos solo
  if (archivo.type === 'application/pdf' && campo !== 'pago_archivo') {
    const texto = await textoDePdf(archivo).catch((e) => { console.error(e); return ''; });
    if (campo === 'vep_archivo') {
      const v = Liquidacion.analizarVep(texto);
      if (v.numero) formCierre.elements.vep_numero.value = v.numero;
      if (v.fecha) formCierre.elements.vep_fecha.value = v.fecha;
      if (v.importe != null) formCierre.elements.vep_importe.value = v.importe;
      aviso.innerHTML += v.importe != null ? ' · Leí los datos del VEP: revisalos y guardá.' : ' · No pude leer el VEP: completá los datos a mano.';
      if (v.periodo && v.periodo !== liq.fila.periodo.slice(0, 7)) {
        aviso.innerHTML += ` <b>⚠ El VEP es del período ${nombrePeriodo(v.periodo)}.</b>`;
      }
    } else {
      const a = Liquidacion.analizarReciboArca(texto);
      if (a.total != null) formCierre.elements.recibo_arca_neto.value = a.total;
      aviso.innerHTML += a.total != null ? ' · Leí el recibo: mirá el control de abajo.' : ' · No pude leer el total del recibo: escribilo abajo.';
      liq.fila.recibo_arca_conceptos = a;
      await db.from('liquidaciones').update({ recibo_arca_conceptos: a }).eq('id', liq.fila.id);
      mostrarControlRecibo(a);
    }
    actualizarCierre();
  }
  input.value = '';
}));

// Devuelve el texto de un PDF (con pdf.js, que se carga solo cuando hace falta)
async function textoDePdf(archivo) {
  if (!window.pdfjsLib) {
    await new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = ok; s.onerror = mal;
      document.head.appendChild(s);
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const pdf = await pdfjsLib.getDocument({ data: await archivo.arrayBuffer() }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    texto += (await pagina.getTextContent()).items.map((it) => it.str).join(' ') + '\n';
  }
  return texto;
}

// ---- Guardar el cierre ----
formCierre.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limpiarMarcas(formCierre);
  const c = leerCampos(formCierre, ['vep_numero', 'vep_fecha', 'vep_importe', 'recibo_arca_neto', 'pago_fecha', 'pago_medio', 'pago_transaccion', 'pago_importe', 'observaciones']);
  c.recibo_arca_neto = c.recibo_arca_neto != null ? Number(c.recibo_arca_neto) : null;
  c.pago_importe = c.pago_importe != null ? Number(c.pago_importe) : null;
  c.vep_importe = c.vep_importe != null ? Number(c.vep_importe) : null;
  if (c.pago_medio !== 'transferencia') c.pago_transaccion = null;

  const errores = [];
  if (c.pago_fecha && !c.pago_medio) errores.push('Elegí el medio de pago.');
  if (c.pago_fecha && c.pago_importe == null) errores.push('Escribí el importe pagado.');
  formCierre.querySelector('.errores').textContent = errores.join('\n');
  if (errores.length) return;

  c.recibo_arca = !!(liq.fila.recibo_arca_archivo || c.recibo_arca_neto != null);
  c.estado = c.pago_fecha ? 'pagada' : c.recibo_arca ? 'confirmada' : 'borrador';
  c.actualizado = new Date().toISOString();

  const estado = estadoDe(formCierre, 'estado-guardar');
  const { data, error } = await db.from('liquidaciones').update(c).eq('id', liq.fila.id).select().single();
  if (error) { mostrarEstado(estado, 'No se pudo guardar. Probá de nuevo.', true); console.error(error); return; }
  liq.fila = data;
  const textos = { pagada: '✓ Mes cerrado: liquidación pagada.', confirmada: '✓ Guardado. Falta registrar el pago.', borrador: '✓ Guardado.' };
  mostrarEstado(estado, textos[data.estado]);
});

// ---- WhatsApp ----
el('btnWhatsapp').addEventListener('click', () => {
  const f = liq.fila, e = liq.empleado;
  if (!f) return;
  const lineas = (f.detalle?.renglones || []).map((x) => `• ${x.concepto}: ${pesos(x.importe)}`);
  const texto = [
    `Hola ${e.nombre}! Te paso el detalle de tu sueldo de ${nombrePeriodo(f.periodo.slice(0, 7))}:`,
    '', ...lineas, '',
    `*Neto a cobrar: ${pesos(f.neto)}*`,
    f.pago_fecha ? `Pagado el ${fechaCorta(f.pago_fecha)}${f.pago_medio ? ` por ${f.pago_medio}` : ''}.` : '',
    '',
    'El recibo oficial lo ves en ARCA: Clave Fiscal → Personal de Casas Particulares → Detalle del Trabajo → Recibos de Sueldo.',
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
  const tel = (e.telefono || '').replace(/\D/g, '');
  const url = `https://wa.me/${tel.length === 10 ? '549' + tel : ''}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
});

// ================= Mis datos (empleador) =================
const CAMPOS_PERFIL = [
  'apellido', 'nombre', 'dni', 'sexo', 'fecha_nacimiento', 'cuil', 'telefono',
  'calle', 'numero', 'piso_depto', 'codigo_postal', 'localidad', 'provincia',
  'trabajo_calle', 'trabajo_numero', 'trabajo_piso_depto', 'trabajo_codigo_postal', 'trabajo_localidad', 'trabajo_provincia',
];
const formPerfil = el('formPerfil');
const chkMismo = formPerfil.elements.trabajo_mismo_domicilio;
const actualizarBloqueTrabajo = () => { el('bloqueTrabajo').hidden = chkMismo.checked; };
chkMismo.addEventListener('change', actualizarBloqueTrabajo);

async function cargarPerfil() {
  formPerfil.reset();
  limpiarMarcas(formPerfil);
  const estado = estadoDe(formPerfil, 'estado-guardar');
  const { data, error } = await db.from('empleadores').select('*').maybeSingle();
  if (error) { mostrarEstado(estado, 'No se pudieron cargar tus datos. Revisá la conexión.', true); console.error(error); }
  llenarForm(formPerfil, data);
  actualizarBloqueTrabajo();
}

formPerfil.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limpiarMarcas(formPerfil);
  const p = leerCampos(formPerfil, CAMPOS_PERFIL);
  p.cuil = (p.cuil || '').replace(/\D/g, '');
  p.trabajo_mismo_domicilio = chkMismo.checked;

  const errores = [];
  const marcar = (campo, msj) => { formPerfil.elements[campo].classList.add('invalido'); errores.push(msj); };
  if (!p.apellido) marcar('apellido', 'Falta el apellido.');
  if (!p.nombre) marcar('nombre', 'Falta el nombre.');
  if (p.dni && !/^\d{7,8}$/.test(p.dni)) marcar('dni', 'El DNI tiene que tener 7 u 8 números.');
  if (!cuilValido(p.cuil)) marcar('cuil', 'El CUIL / CUIT no es válido.');
  if (p.telefono && p.telefono.replace(/\D/g, '').length < 8) marcar('telefono', 'Revisá el teléfono (con código de área).');
  formPerfil.querySelector('.errores').textContent = errores.join('\n');
  if (errores.length) return;

  const { data: { user } } = await db.auth.getUser();
  const btn = formPerfil.querySelector('[type=submit]');
  btn.disabled = true;
  const { error } = await db.from('empleadores').upsert({ id: user.id, ...p, actualizado: new Date().toISOString() });
  btn.disabled = false;
  const estado = estadoDe(formPerfil, 'estado-guardar');
  if (error) { mostrarEstado(estado, 'No se pudieron guardar tus datos. Probá de nuevo.', true); console.error(error); return; }
  mostrarEstado(estado, '✓ Tus datos quedaron guardados.');
});

// ================= Mi cuenta =================
async function cargarCuenta() {
  ['formEmail', 'formClave', 'formBorrar'].forEach((id) => { el(id).reset(); limpiarMarcas(el(id)); });
  const { data: { user } } = await db.auth.getUser();
  el('emailActual').textContent = user?.email || '';
}

el('formEmail').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const email = form.elements.email.value.trim();
  if (!emailValido(email)) { mostrarEstado(estado, 'Escribí un email válido.', true); return; }
  mostrarEstado(estado, 'Enviando…');
  const { error } = await db.auth.updateUser({ email }, { emailRedirectTo: URL_APP });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  form.reset();
  mostrarEstado(estado, 'Te mandamos un mail para confirmar el cambio (puede llegar a la dirección nueva y a la actual). Hasta que lo confirmes, seguís entrando con el email actual.');
});

el('formClave').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const { password, password2 } = Object.fromEntries(new FormData(form));
  if (!claveValida(password)) { mostrarEstado(estado, 'La contraseña tiene que tener al menos 8 caracteres.', true); return; }
  if (password !== password2) { mostrarEstado(estado, 'Las dos contraseñas no coinciden.', true); return; }
  mostrarEstado(estado, 'Guardando…');
  const { error } = await db.auth.updateUser({ password });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  form.reset();
  mostrarEstado(estado, '✓ Contraseña cambiada.');
});

el('btnSalir').addEventListener('click', () => db.auth.signOut());

// Borra todos los comprobantes del usuario (carpeta <usuario>/<liquidación>/archivo)
async function borrarMisArchivos() {
  const { data: { user } } = await db.auth.getUser();
  const bucket = db.storage.from('comprobantes');
  const { data: carpetas, error } = await bucket.list(user.id, { limit: 1000 });
  if (error) throw error;
  const rutas = [];
  for (const c of carpetas || []) {
    const { data: archivos } = await bucket.list(`${user.id}/${c.name}`, { limit: 100 });
    (archivos || []).forEach((a) => rutas.push(`${user.id}/${c.name}/${a.name}`));
  }
  if (rutas.length) await bucket.remove(rutas);
}

el('formBorrar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  if (form.elements.confirmacion.value.trim().toUpperCase() !== 'BORRAR') {
    mostrarEstado(estado, 'Escribí BORRAR para confirmar.', true);
    return;
  }
  if (!confirm('¿Seguro? Se borran tu cuenta y todos los datos de tu personal. No se puede deshacer.')) return;
  mostrarEstado(estado, 'Borrando…');
  await borrarMisArchivos().catch(console.error); // los archivos no se borran solos con la cuenta
  const { error } = await db.rpc('borrar_mi_cuenta');
  if (error) { mostrarEstado(estado, 'No se pudo borrar la cuenta. Probá de nuevo.', true); console.error(error); return; }
  await db.auth.signOut({ scope: 'local' });
  mostrarLogin('vistaEntrar', 'Tu cuenta y todos tus datos fueron borrados.');
});

// ================= Login, crear cuenta, recuperar contraseña =================
function mostrarLogin(vista, aviso = '', mal = false) {
  el('pantallaLogin').hidden = false;
  el('pantallaApp').hidden = true;
  document.querySelectorAll('.vista-login').forEach((s) => { s.hidden = s.id !== vista; });
  document.querySelectorAll('.vista-login form').forEach(limpiarMarcas);
  mostrarEstado(el('avisoLogin'), aviso, mal);
}
document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => mostrarLogin(b.dataset.ir)));

el('formEntrar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const email = form.elements.email.value.trim(), password = form.elements.password.value;
  if (!emailValido(email) || !password) { mostrarEstado(estado, 'Completá email y contraseña.', true); return; }
  mostrarEstado(estado, 'Entrando…');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  form.reset();
});

el('formCrear').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const email = form.elements.email.value.trim();
  const { password, password2 } = Object.fromEntries(new FormData(form));
  if (!emailValido(email)) { mostrarEstado(estado, 'Escribí un email válido.', true); return; }
  if (!claveValida(password)) { mostrarEstado(estado, 'La contraseña tiene que tener al menos 8 caracteres.', true); return; }
  if (password !== password2) { mostrarEstado(estado, 'Las dos contraseñas no coinciden.', true); return; }
  if (!form.elements.acepto.checked) { mostrarEstado(estado, 'Para crear la cuenta tenés que aceptar el uso de los datos.', true); return; }

  mostrarEstado(estado, 'Creando cuenta…');
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { emailRedirectTo: URL_APP, data: { acepto_privacidad: new Date().toISOString() } },
  });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  // Si el email ya tenía cuenta, Supabase no da error pero devuelve el usuario sin "identities"
  if (data.user && data.user.identities?.length === 0) { mostrarEstado(estado, 'Ya existe una cuenta con ese email.', true); return; }
  form.reset();
  if (!data.session) {
    mostrarLogin('vistaEntrar', `✓ Cuenta creada. Te mandamos un mail a ${email}: tocá el link para confirmarla y después entrá acá. (Si no lo ves, fijate en spam.)`);
  }
});

el('formOlvide').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const email = form.elements.email.value.trim();
  if (!emailValido(email)) { mostrarEstado(estado, 'Escribí un email válido.', true); return; }
  mostrarEstado(estado, 'Enviando…');
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: URL_APP });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  form.reset();
  mostrarEstado(estado, 'Listo. Si ese email tiene cuenta, te llegó un mail con un link para elegir una contraseña nueva.');
});

el('formNuevaClave').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  const { password, password2 } = Object.fromEntries(new FormData(form));
  if (!claveValida(password)) { mostrarEstado(estado, 'La contraseña tiene que tener al menos 8 caracteres.', true); return; }
  if (password !== password2) { mostrarEstado(estado, 'Las dos contraseñas no coinciden.', true); return; }
  mostrarEstado(estado, 'Guardando…');
  const { error } = await db.auth.updateUser({ password });
  if (error) { mostrarEstado(estado, traducirError(error), true); console.error(error); return; }
  form.reset();
  recuperando = false;
  mensajeLista = '✓ Contraseña cambiada. Si usás la app instalada en el iPhone, entrá ahí con la contraseña nueva.';
  const { data } = await db.auth.getSession();
  mostrarApp(data.session);
});

// ================= Estado de la sesión =================
let usuarioActual = null;
let recuperando = false;

function mostrarApp(sesion) {
  el('pantallaLogin').hidden = true;
  el('pantallaApp').hidden = false;
  if (sesion.user.id !== usuarioActual) {
    usuarioActual = sesion.user.id;
    irA('vistaLista');
    window.chequearAdmin?.();
  }
}

// Errores que vienen en el link de un mail (ej.: link vencido)
const paramsUrl = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const errorLink = paramsUrl.get('error_code') || paramsUrl.get('error');
const avisoInicial = errorLink
  ? (errorLink === 'otp_expired' ? 'El link del mail venció o ya se usó. Pedí uno nuevo.' : 'El link del mail no es válido. Pedí uno nuevo.')
  : '';

db.auth.onAuthStateChange((evento, sesion) => {
  // setTimeout: Supabase recomienda no hacer consultas dentro de este aviso directamente
  setTimeout(() => {
    if (location.hash.includes('access_token') || errorLink) history.replaceState(null, '', URL_APP);
    if (evento === 'PASSWORD_RECOVERY') recuperando = true;
    if (recuperando && sesion) { mostrarLogin('vistaNuevaClave'); return; }
    if (sesion) { mostrarApp(sesion); return; }
    usuarioActual = null;
    if (evento === 'INITIAL_SESSION') mostrarLogin('vistaEntrar', avisoInicial, !!avisoInicial);
    else if (el('pantallaLogin').hidden) mostrarLogin('vistaEntrar');
  }, 0);
});

// ================= Instalación como app (PWA) =================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
