// ===== CasaEnRegla =====
// Secciones: utilidades · CUIL · DNI y cámara · navegación · empleados · mis datos · mi cuenta · login

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const URL_APP = location.origin + location.pathname; // a dónde vuelven los links de los mails

// ================= Utilidades =================
const el = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

let temporizadorToast = null;
function toast(texto, mal = false) {
  const t = el('toast');
  if (!t) return;
  t.textContent = texto;
  t.classList.toggle('mal', mal);
  t.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => { t.hidden = true; }, 2800);
}

function mostrarEstado(nodo, texto, mal = false) {
  if (!mal && typeof texto === 'string' && texto.startsWith('✓')) toast(texto);
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
const VISTAS = ['vistaInicio', 'vistaNovedades', 'vistaLista', 'vistaFicha', 'vistaForm', 'vistaLiquidar', 'vistaTrabajo', 'vistaInvitacion', 'vistaPerfil', 'vistaCuenta', 'vistaAdmin'];
const ALCARGAR = {
  vistaLista: () => cargarLista(), vistaPerfil: () => cargarPerfil(), vistaCuenta: () => cargarCuenta(),
  vistaAdmin: () => window.cargarAdmin?.(),
  vistaTrabajo: () => window.cargarTrabajo?.(),
  vistaInicio: () => cargarInicio(),
  vistaNovedades: () => cargarVistaNovedades(),
};

function irA(vista) {
  detenerEscaneo();
  VISTAS.forEach((v) => { el(v).hidden = v !== vista; });
  const pestania = ['vistaFicha', 'vistaForm', 'vistaLiquidar'].includes(vista) ? 'vistaLista' : vista;
  document.querySelectorAll('.barra-inferior button').forEach((b) => b.classList.toggle('activa', b.dataset.vista === pestania));
  el('menuUsuario').hidden = true;
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
  data.sort((x, y) => (x.fecha_egreso ? 1 : 0) - (y.fecha_egreso ? 1 : 0));
  empleados = data;
  listaEl.innerHTML = data.length
    ? data.map((e) => `
        <div class="item-fila">
          <button type="button" class="item" data-id="${e.id}">
            <b>${escapar(e.apellido)}, ${escapar(e.nombre)}</b>
            <span>${e.categoria}ª ${CATEGORIAS[e.categoria] || ''} · ${e.modalidad === 'sin_retiro' ? 'Sin retiro' : 'Con retiro'} · desde ${fechaCorta(e.fecha_ingreso)}${e.fecha_egreso ? ` · <b class="baja">Baja ${fechaCorta(e.fecha_egreso)}</b>` : ''}</span>
          </button>
          <button type="button" class="btn-liquidar" data-liquidar="${e.id}">💰<br>Liquidar</button>
        </div>`).join('')
    : '<p class="vacio">Todavía no cargaste ningún empleado.</p>';
}

// ================= Encabezado con el usuario =================
let nombreUsuario = '';
window.mostrarUsuario = (nombre, email) => {
  nombreUsuario = nombre || '';
  const base = (nombre || email || '?').trim();
  const partes = base.split(/[\s@.]+/).filter(Boolean);
  el('avatarIniciales').textContent = ((partes[0] || '?')[0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
  el('menuNombre').textContent = nombre || 'Mi cuenta';
  el('menuEmail').textContent = email || '';
  el('btnUsuario').hidden = false;
};
el('btnUsuario').addEventListener('click', (ev) => { ev.stopPropagation(); el('menuUsuario').hidden = !el('menuUsuario').hidden; });
document.addEventListener('click', (ev) => {
  if (!el('menuUsuario').hidden && !ev.target.closest('#menuUsuario')) el('menuUsuario').hidden = true;
});
el('btnSalirMenu').addEventListener('click', () => db.auth.signOut());

// ================= Inicio =================
const CLAVE_PASOS = 'casaenregla_pasos_ocultos';
let pasosInicio = [];

async function cargarInicio() {
  const ahora = new Date();
  const h = ahora.getHours();
  el('saludo').textContent = `${h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'}${nombreUsuario ? `, ${nombreUsuario.split(' ')[0]}` : ''}`;
  el('fechaHoy').textContent = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const mes = mesActual();
  const [a, m] = mes.split('-').map(Number);
  const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  const sig2 = m >= 11 ? `${a + 1}-${String(((m + 1) % 12) + 1).padStart(2, '0')}` : `${a}-${String(m + 2).padStart(2, '0')}`;
  const [emps, perfil, liqsMes, todas, invs, fer] = await Promise.all([
    db.from('empleados').select('*').order('apellido').order('nombre'),
    db.from('empleadores').select('apellido, cuil, trabajo_lat').maybeSingle(),
    db.from('liquidaciones').select('empleado_id, periodo, estado, neto, pago_arca').eq('periodo', `${mes}-01`),
    db.from('liquidaciones').select('id', { count: 'exact', head: true }),
    db.from('invitaciones').select('codigo', { count: 'exact', head: true }),
    db.from('feriados').select('fecha').gte('fecha', `${sig}-01`).lt('fecha', `${sig2}-01`),
  ]);
  const lista = emps.data || [];
  empleados = lista;
  const hoy = hoyIso();
  const activos = lista.filter((e) => !e.fecha_egreso || e.fecha_egreso >= hoy);
  const pf = perfil.data || {};

  // ---- Primeros pasos ----
  pasosInicio = [
    { ok: !!(pf.apellido && pf.cuil), texto: 'Completá tus datos de empleador', ir: () => irA('vistaPerfil') },
    { ok: lista.length > 0, texto: 'Cargá a tu primer empleado (podés escanear su DNI)', ir: () => abrirEmpleado() },
    { ok: !!pf.trabajo_lat, texto: 'Guardá la ubicación del lugar de trabajo', ir: () => irA('vistaPerfil') },
    { ok: lista.some((e) => e.usuario_id) || (invs.count || 0) > 0, texto: 'Invitá a tu empleado a la app', ir: () => (activos[0] ? abrirFicha(activos[0]) : abrirEmpleado()) },
    { ok: (todas.count || 0) > 0, texto: 'Hacé tu primera liquidación', ir: () => (activos[0] ? abrirLiquidacion(activos[0]) : abrirEmpleado()) },
  ];
  const hechos = pasosInicio.filter((p) => p.ok).length;
  let ocultos = false;
  try { ocultos = localStorage.getItem(CLAVE_PASOS) === '1'; } catch { /* sin almacenamiento */ }
  el('cajaPasos').hidden = ocultos || hechos === pasosInicio.length;
  el('barraPasos').style.width = `${Math.round(hechos / pasosInicio.length * 100)}%`;
  el('textoPasos').textContent = hechos ? `Vas ${hechos} de ${pasosInicio.length}. ¡Seguí así!` : 'Te guiamos para dejar todo en regla en pocos minutos.';
  el('listaPasos').innerHTML = pasosInicio.map((p, i) => `
    <li class="${p.ok ? 'ok' : ''}"><button type="button" data-paso="${i}"><span class="marca-paso">${p.ok ? '✓' : i + 1}</span>${escapar(p.texto)}</button></li>`).join('');

  // ---- Resumen del mes ----
  el('tituloMes').textContent = `${NOMBRE_MES[m - 1][0].toUpperCase()}${NOMBRE_MES[m - 1].slice(1)} ${a}`;
  if (!activos.length) {
    el('resumenMes').innerHTML = '<p class="ayuda">Todavía no cargaste empleados. Empezá por "Nuevo empleado".</p>';
  } else {
    const delMes = (liqsMes.data || []).filter((l) => activos.some((e) => e.id === l.empleado_id));
    const pagadas = delMes.filter((l) => l.estado === 'pagada').length;
    const costo = delMes.reduce((s, l) => s + Number(l.neto) + Number(l.pago_arca), 0);
    const feriados = new Set((fer.data || []).map((f) => f.fecha));
    const vSueldo = Liquidacion.diaHabil(sig, 4, feriados);
    const vVep = Liquidacion.habilDesde(`${sig}-10`, feriados);
    const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const conDia = (iso) => `${DIAS[new Date(iso + 'T12:00').getDay()]} ${fechaCorta(iso).slice(0, 5)}`;
    el('resumenMes').innerHTML = `
      <div class="cifras">
        <div class="cifra"><small>Empleados activos</small><b>${activos.length}</b></div>
        <div class="cifra"><small>Liquidados este mes</small><b>${delMes.length} de ${activos.length}</b> <small>${pagadas} pagado${pagadas === 1 ? '' : 's'}</small></div>
        <div class="cifra grande"><small>Costo del mes (sueldos + ARCA)</small><b>${delMes.length ? pesos(costo) : 'Todavía sin liquidar'}</b></div>
      </div>
      <ul class="vencimientos">
        <li><span>Pagar los sueldos de ${NOMBRE_MES[m - 1]}</span><b>hasta el ${conDia(vSueldo)}</b></li>
        <li><span>Pagar el VEP de aportes en ARCA</span><b>aprox. ${conDia(vVep)}</b></li>
        ${m === 6 || m === 12 ? `<li><span>Aguinaldo del semestre</span><b>con el sueldo de ${NOMBRE_MES[m - 1]}</b></li>` : ''}
      </ul>`;
  }

  // ---- Tareas pendientes (avisos) ----
  cargarAvisos(lista).catch((err) => console.error('avisos', err));
}

el('listaPasos').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-paso]');
  if (b) pasosInicio[Number(b.dataset.paso)].ir();
});
el('btnOcultarPasos').addEventListener('click', () => {
  try { localStorage.setItem(CLAVE_PASOS, '1'); } catch { /* sin almacenamiento */ }
  el('cajaPasos').hidden = true;
  toast('Podés seguir los pasos desde cada sección cuando quieras.');
});

const activosDe = (lista) => lista.filter((e) => !e.fecha_egreso || e.fecha_egreso >= hoyIso());
el('accLiquidar').addEventListener('click', () => {
  const activos = activosDe(empleados);
  if (activos.length === 1) abrirLiquidacion(activos[0]);
  else if (!activos.length) { toast('Primero cargá a tu empleado.'); abrirEmpleado(); }
  else { irA('vistaLista'); toast('Elegí a quién liquidar: tocá "💰 Liquidar".'); }
});
el('accNovedad').addEventListener('click', () => irA('vistaNovedades'));
el('accNuevo').addEventListener('click', () => abrirEmpleado());

// ================= Novedades: elegir a quién =================
async function abrirNovedadesDe(e) {
  await abrirFicha(e);
  el('calendario').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cargarVistaNovedades() {
  const { data, error } = await db.from('empleados').select('*').order('apellido').order('nombre');
  if (error) { el('listaNovedadesEmpleados').innerHTML = '<p class="estado mal">No se pudieron cargar los empleados.</p>'; return; }
  const activos = activosDe(data);
  empleados = data;
  if (activos.length === 1) { abrirNovedadesDe(activos[0]); return; }
  el('listaNovedadesEmpleados').innerHTML = activos.length ? activos.map((e) => `
    <button type="button" class="item" data-nov-emp="${e.id}">
      <b>${escapar(e.apellido)}, ${escapar(e.nombre)}</b>
      <span>Tocá para abrir su calendario del mes</span>
    </button>`).join('') : '<p class="vacio">Todavía no cargaste empleados.</p>';
}
el('listaNovedadesEmpleados').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-nov-emp]');
  if (b) abrirNovedadesDe(empleados.find((e) => e.id === b.dataset.novEmp));
});

// ================= Avisos (pantalla de inicio) =================
async function cargarAvisos(lista) {
  const caja = el('cajaAvisos');
  if (!lista.length) { caja.hidden = true; return; }
  const hoy = hoyIso();
  const mesHoy = hoy.slice(0, 7);
  const [a, m] = mesHoy.split('-').map(Number);
  const ant = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  const hasta = `${m >= 11 ? a + 1 : a}-${String(((m + 1) % 12) + 1).padStart(2, '0')}-01`;

  const [liqs, fer, params, ultima] = await Promise.all([
    db.from('liquidaciones').select('empleado_id, periodo, estado, vep_fecha, recibo_arca, detalle').gte('periodo', `${ant}-01`),
    db.from('feriados').select('fecha').gte('fecha', `${ant}-01`).lt('fecha', hasta),
    db.from('parametros').select('clave, valor, vigencia_desde').in('clave', ['vep_dia_vencimiento', 'periodo_prueba_meses'])
      .lte('vigencia_desde', hoy).order('vigencia_desde', { ascending: false }),
    db.from('escalas').select('vigencia_desde').order('vigencia_desde', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const liquidaciones = liqs.data || [];
  const param = {};
  for (const p of params.data || []) if (!(p.clave in param)) param[p.clave] = Number(p.valor);

  // ¿Hay una escala más nueva que la que se usó en una liquidación reciente? (aumento retroactivo)
  const retroactivas = [];
  for (const l of liquidaciones) {
    const usada = l.detalle && l.detalle.escala && l.detalle.escala.vigencia_desde;
    const e = lista.find((x) => x.id === l.empleado_id);
    if (!usada || !e) continue;
    const vigente = await escalaVigente(e.categoria, e.modalidad, l.periodo).catch(() => null);
    if (vigente && vigente.vigencia_desde > usada) retroactivas.push({ empleado_id: e.id, periodo: l.periodo.slice(0, 7) });
  }

  const avisos = Liquidacion.generarAvisos({
    hoy, empleados: lista, liquidaciones, param, retroactivas,
    feriados: new Set((fer.data || []).map((f) => f.fecha)),
    escalaUltima: ultima.data ? ultima.data.vigencia_desde : null,
  });
  const robot = await db.from('robot_hallazgos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
  if (!robot.error && robot.count) {
    avisos.unshift({ nivel: 'atencion', accion: { tipo: 'admin' },
      texto: `🤖 El robot encontró ${robot.count} novedad${robot.count === 1 ? '' : 'es'} de escalas o aportes: revisala${robot.count === 1 ? '' : 's'} y aprobala${robot.count === 1 ? '' : 's'} en Admin.` });
  }
  caja.hidden = !avisos.length;
  el('listaAvisos').innerHTML = avisos.map((av, i) => `
    <li class="${av.nivel}"><span class="icono"></span><span class="texto">${escapar(av.texto)}</span>
    ${av.accion ? `<button type="button" data-aviso="${i}">${{ cierre: 'Cerrar mes', admin: 'Ir a Admin' }[av.accion.tipo] || 'Liquidar'}</button>` : ''}</li>`).join('');
  el('listaAvisos').onclick = (ev) => {
    const b = ev.target.closest('[data-aviso]');
    if (!b) return;
    const av = avisos[Number(b.dataset.aviso)];
    if (av.accion.tipo === 'admin') { irA('vistaAdmin'); return; }
    const e = lista.find((x) => x.id === av.empleado_id);
    if (!e) return;
    liqIrACierre = av.accion.tipo === 'cierre';
    abrirLiquidacion(e, av.accion.periodo);
  };
}
let liqIrACierre = false;

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
    `Ingreso ${fechaCorta(e.fecha_ingreso)}${e.fecha_egreso ? '' : ` (${antiguedadTexto(e.fecha_ingreso)})`}`,
    e.fecha_egreso ? `Baja ${fechaCorta(e.fecha_egreso)} (${(Liquidacion.CAUSAS_EGRESO[e.causa_egreso] || e.causa_egreso || '').toLowerCase()})` : '',
  ].filter(Boolean).join(' · ');
  el('resumenFicha').innerHTML = '<p class="ayuda">Cargando…</p>';
  el('listaLiqFicha').innerHTML = '';
  window.dibujarVinculo?.(e);
  window.cargarAcuerdosFicha?.(e);
  el('mesNovedades').value = mesActual();
  el('formNovedad').hidden = true;
  cargarNovedades();

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
  const mejor = delAnio.reduce((m, l) => Math.max(m, Number(l.total_remunerativo) - Number((l.detalle && l.detalle.sac_importe) || 0)), 0);
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

// ================= Novedades día a día (calendario del mes) =================
const TIPOS_NOV = {
  presente: 'Presente', falta_injustificada: 'Falta injustificada', falta_justificada: 'Falta justificada',
  horas_extra_50: 'Horas extra 50%', horas_extra_100: 'Horas extra 100%',
  feriado_trabajado: 'Trabajó feriado', nota: 'Nota',
};
const DIA_A_NUM = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
let novedadesMes = [];

const rangoMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return [`${mes}-01`, m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`];
};

async function novedadesDe(empleadoId, mes) {
  const [desde, hasta] = rangoMes(mes);
  const { data, error } = await db.from('novedades').select('*').eq('empleado_id', empleadoId)
    .gte('fecha', desde).lt('fecha', hasta).order('fecha').order('creado');
  if (error) throw error;
  return data;
}

async function cargarNovedades() {
  const e = fichaActual;
  const mes = el('mesNovedades').value || mesActual();
  try {
    novedadesMes = await novedadesDe(e.id, mes);
  } catch (err) {
    novedadesMes = [];
    el('listaNovedades').innerHTML = '<li>No se pudieron cargar las novedades. ¿Corriste el SQL 16?</li>';
    console.error(err);
  }
  if (fichaActual !== e) return;
  dibujarCalendario(mes);
  dibujarListaNovedades();
}
el('mesNovedades').addEventListener('change', cargarNovedades);

function dibujarCalendario(mes) {
  const [a, m] = mes.split('-').map(Number);
  const dias = new Date(a, m, 0).getDate();
  const offset = (new Date(a, m - 1, 1).getDay() + 6) % 7; // semana empieza el lunes
  const laborales = new Set((fichaActual.dias || []).map((d) => DIA_A_NUM[d]));
  const hoy = hoyIso();
  let html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cab">${d}</span>`).join('');
  html += '<span></span>'.repeat(offset);
  for (let d = 1; d <= dias; d++) {
    const fecha = `${mes}-${String(d).padStart(2, '0')}`;
    const tipos = [...new Set(novedadesMes.filter((n) => n.fecha === fecha).map((n) => n.tipo))];
    const clases = [laborales.has(new Date(a, m - 1, d).getDay()) ? 'laboral' : '', fecha === hoy ? 'hoy' : ''].join(' ');
    html += `<button type="button" class="${clases}" data-fecha="${fecha}">${d}
      <span class="puntos">${tipos.map((t) => `<i class="nov-${t}"></i>`).join('')}</span></button>`;
  }
  el('calendario').innerHTML = html;
}

function textoPresente(n) {
  const hora = n.marcado_en ? new Date(n.marcado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  if (n.distancia_m == null) return ` ${hora} · sin ubicación`;
  const d = Number(n.distancia_m);
  const dist = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`;
  return ` ${hora} · ${d <= 150 ? '✓' : '⚠'} a ${dist} del lugar de trabajo${n.precision_m ? ` (±${Math.round(n.precision_m)} m)` : ''}`;
}

function dibujarListaNovedades() {
  el('listaNovedades').innerHTML = novedadesMes.length ? novedadesMes.map((n) => {
    const delEmpleado = n.cargado_por === 'empleado';
    const estadoTxt = delEmpleado
      ? `La cargó ${escapar(fichaActual.nombre)} · Vos: ${n.confirmado_empleador ? '✓ confirmaste' : 'sin confirmar'}`
      : `La cargaste vos · ${escapar(fichaActual.nombre)}: ${n.confirmado_empleado ? '✓ conforme' : n.observacion_empleado ? `no conforme — "${escapar(n.observacion_empleado)}"` : 'sin responder'}`;
    return `<li><i class="nov-${n.tipo}"></i>
      <span class="txt"><b>${fechaCorta(n.fecha)}</b> · ${TIPOS_NOV[n.tipo]}${n.tipo === 'presente' ? textoPresente(n) : ''}${n.horas ? ` · ${Number(n.horas)} hs` : ''}${n.descripcion ? ` — ${escapar(n.descripcion)}` : ''}
        <small>${estadoTxt}${n.archivo ? ` · <button type="button" class="link" data-ver-nov="${escapar(n.archivo)}">Ver justificativo</button>` : ''}</small>
        ${delEmpleado && !n.confirmado_empleador ? `<span class="botones-respuesta"><button type="button" class="si" data-confirmar-nov="${n.id}">✓ Confirmar</button></span>` : ''}
      </span>
      <button type="button" class="borrar" data-borrar-nov="${n.id}">Borrar</button>
    </li>`;
  }).join('') : '<li class="ayuda">Sin novedades este mes.</li>';
}

el('calendario').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-fecha]');
  if (!b) return;
  const f = el('formNovedad');
  f.reset();
  limpiarMarcas(f);
  f.elements.fecha.value = b.dataset.fecha;
  const [a, m, d] = b.dataset.fecha.split('-').map(Number);
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  el('tituloNovedad').textContent = `Novedad del ${DIAS[new Date(a, m - 1, d).getDay()]} ${fechaCorta(b.dataset.fecha)}`;
  actualizarFormNovedad();
  f.hidden = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

function actualizarFormNovedad() {
  const tipo = el('formNovedad').elements.tipo.value;
  el('formNovedad').querySelector('.solo-horas').hidden = !['horas_extra_50', 'horas_extra_100', 'feriado_trabajado'].includes(tipo);
  el('formNovedad').querySelector('.solo-justificada').hidden = !['falta_justificada', 'falta_injustificada', 'nota'].includes(tipo);
}
el('formNovedad').elements.tipo.addEventListener('change', actualizarFormNovedad);
el('btnCancelarNovedad').addEventListener('click', () => { el('formNovedad').hidden = true; });

el('formNovedad').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, estado = estadoDe(f);
  const tipo = f.elements.tipo.value;
  const conHoras = ['horas_extra_50', 'horas_extra_100', 'feriado_trabajado'].includes(tipo);
  const horas = Number(f.elements.horas.value) || null;
  if (conHoras && !horas) { mostrarEstado(estado, 'Indicá la cantidad de horas.', true); return; }
  const fila = {
    empleado_id: fichaActual.id, fecha: f.elements.fecha.value, tipo,
    horas: conHoras ? horas : null, descripcion: f.elements.descripcion.value.trim() || null,
  };
  mostrarEstado(estado, 'Guardando…');
  const { data, error } = await db.from('novedades').insert(fila).select().single();
  if (error) { mostrarEstado(estado, 'No se pudo guardar. ¿Corriste el SQL 16?', true); console.error(error); return; }

  const archivo = f.elements.archivo.files[0];
  if (archivo && !f.querySelector('.solo-justificada').hidden) {
    if (archivo.size > 10 * 1024 * 1024) { mostrarEstado(estado, 'Se guardó, pero el archivo supera 10 MB.', true); }
    else {
      const { data: { user } } = await db.auth.getUser();
      const ext = (archivo.name.split('.').pop() || 'pdf').toLowerCase();
      const ruta = `${user.id}/novedades/${data.id}.${ext}`;
      const sub = await db.storage.from('comprobantes').upload(ruta, archivo, { upsert: true, contentType: archivo.type });
      if (!sub.error) await db.from('novedades').update({ archivo: ruta }).eq('id', data.id);
      else console.error(sub.error);
    }
  }
  f.hidden = true;
  cargarNovedades();
});

el('listaNovedades').addEventListener('click', async (ev) => {
  const conf = ev.target.closest('[data-confirmar-nov]');
  if (conf) {
    const { error } = await db.from('novedades').update({ confirmado_empleador: true }).eq('id', conf.dataset.confirmarNov);
    if (error) { alert('No se pudo confirmar.'); console.error(error); return; }
    cargarNovedades();
    return;
  }
  const ver = ev.target.closest('[data-ver-nov]');
  if (ver) {
    const { data, error } = await db.storage.from('comprobantes').createSignedUrl(ver.dataset.verNov, 120);
    if (error) { alert('No se pudo abrir el archivo.'); return; }
    window.open(data.signedUrl, '_blank');
    return;
  }
  const b = ev.target.closest('[data-borrar-nov]');
  if (!b || !confirm('¿Borrar esta novedad?')) return;
  const n = novedadesMes.find((x) => x.id === b.dataset.borrarNov);
  const { error } = await db.from('novedades').delete().eq('id', b.dataset.borrarNov);
  if (error) { alert('No se pudo borrar.'); console.error(error); return; }
  if (n && n.archivo) db.storage.from('comprobantes').remove([n.archivo]);
  cargarNovedades();
});

// Pasa las novedades del calendario a la liquidación del mes
async function traerNovedades(avisarSiNoHay) {
  const periodo = formLiq.elements.periodo.value;
  const aviso = el('avisoNovedades');
  let lista;
  try { lista = await novedadesDe(liq.empleado.id, periodo); } catch (err) { aviso.textContent = ''; console.error(err); return; }
  const r = Liquidacion.resumirNovedades(lista);
  if (!r.cantidad) {
    aviso.textContent = r.sin_confirmar_empleador
      ? `⚠ Hay ${r.sin_confirmar_empleador} novedad(es) que cargó el empleado y todavía no confirmaste en su ficha.`
      : (avisarSiNoHay ? 'No hay novedades cargadas en el calendario para este mes.' : '');
    return;
  }
  formLiq.elements.faltas_dias.value = r.faltas_dias || '';
  formLiq.elements.horas_extra_50.value = r.horas_extra_50 || '';
  formLiq.elements.horas_extra_100.value = r.horas_extra_100 || '';
  formLiq.elements.horas_feriado.value = r.horas_feriado || '';
  aviso.textContent = `✓ Se cargaron ${r.cantidad} novedad${r.cantidad === 1 ? '' : 'es'} del calendario` +
    (r.sin_confirmar_empleado ? ` (${r.sin_confirmar_empleado} sin confirmar por el empleado)` : '') + '.' +
    (r.sin_confirmar_empleador ? ` ⚠ Hay ${r.sin_confirmar_empleador} que cargó el empleado y todavía no confirmaste: no se incluyeron.` : '');
  recalcular();
}
el('btnTraerNovedades').addEventListener('click', () => traerNovedades(true));

// ================= Liquidar mes =================
const formLiq = el('formLiq');
const resultadoLiq = el('resultadoLiq');
const listaOtros = el('listaOtros');
let liq = { empleado: null, datos: null, resultado: null };

const mesActual = () => hoyIso().slice(0, 7);
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombrePeriodo = (p) => `${NOMBRE_MES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const ultimoDiaDe = (p) => { const [a, m] = p.split('-').map(Number); return `${p}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`; };

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
    vacaciones: n('vac_dias') > 0 ? { dias: n('vac_dias'), desde: formLiq.elements.vac_desde.value || null } : null,
    egreso: formLiq.elements.hay_egreso.checked && formLiq.elements.egreso_fecha.value ? {
      fecha: formLiq.elements.egreso_fecha.value,
      causa: formLiq.elements.egreso_causa.value,
      preaviso_otorgado: formLiq.elements.egreso_preaviso.checked,
      mejor_remuneracion: n('egreso_mejor'),
      mejor_manual: liq.mejorAnioManual,
      sac_indemn: formLiq.elements.egreso_sac_indemn.checked,
      vac_pendientes: n('egreso_vac_ajuste'),
    } : null,
    sac: sacVisible() && formLiq.elements.incluir_sac.checked
      ? { incluir: true, mejor_remuneracion: n('mejor_remuneracion'), manual: liq.sacManual }
      : null,
  };
}

// ---- Datos que necesita el cálculo para un período ----
async function datosDelPeriodo(empleado, periodo) {
  const fecha = `${periodo}-01`;
  const [a, m] = periodo.split('-').map(Number);
  const inicioSem = `${a}-${m <= 6 ? '01' : '07'}-01`;
  const [escala, params, aportes, perfil, existente, semestre, anioAtras] = await Promise.all([
    escalaVigente(empleado.categoria, empleado.modalidad, fecha),
    db.from('parametros').select('*').lte('vigencia_desde', fecha).order('vigencia_desde', { ascending: false }),
    db.from('aportes_arca').select('*').lte('periodo_desde', fecha).order('periodo_desde', { ascending: false }),
    db.from('empleadores').select('*').maybeSingle(),
    db.from('liquidaciones').select('*').eq('empleado_id', empleado.id).eq('periodo', fecha).maybeSingle(),
    db.from('liquidaciones').select('periodo, total_remunerativo, detalle').eq('empleado_id', empleado.id)
      .gte('periodo', inicioSem).lt('periodo', fecha),
    db.from('liquidaciones').select('periodo, total_remunerativo, detalle').eq('empleado_id', empleado.id)
      .gte('periodo', `${m === 12 ? a : a - 1}-${String((m % 12) + 1).padStart(2, '0')}-01`).lt('periodo', fecha),
  ]);
  for (const r of [params, aportes, perfil, existente, semestre, anioAtras]) if (r.error) throw r.error;

  // Mejor remuneración de los últimos 12 meses (art. 48), sin aguinaldos
  let mejorAnio = { importe: 0, periodo: null, meses: anioAtras.data.length };
  for (const l of anioAtras.data) {
    const rem = Number(l.total_remunerativo) - Number((l.detalle && l.detalle.sac_importe) || 0);
    if (rem > mejorAnio.importe) mejorAnio = { ...mejorAnio, importe: rem, periodo: l.periodo.slice(0, 7) };
  }

  // Mayor remuneración guardada en los meses anteriores del semestre (sin contar aguinaldos)
  let mejorGuardada = { importe: 0, periodo: null, meses: semestre.data.length };
  for (const l of semestre.data) {
    const rem = Number(l.total_remunerativo) - Number((l.detalle && l.detalle.sac_importe) || 0);
    if (rem > mejorGuardada.importe) mejorGuardada = { ...mejorGuardada, importe: rem, periodo: l.periodo.slice(0, 7) };
  }

  const param = {};
  for (const p of params.data) if (!(p.clave in param)) param[p.clave] = Number(p.valor);
  if (param.antiguedad_desde) { // viene como aaaammdd
    const s = String(param.antiguedad_desde);
    param.antiguedad_desde = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const filasAportes = aportes.data.filter((a) => a.periodo_desde === aportes.data[0]?.periodo_desde);
  if (perfil.data && perfil.data.vacaciones_divisor) param.vacaciones_divisor = Number(perfil.data.vacaciones_divisor);

  const pf = perfil.data;
  const zona = pf ? (pf.trabajo_mismo_domicilio
    ? Liquidacion.esZonaDesfavorable(pf.provincia, pf.localidad)
    : Liquidacion.esZonaDesfavorable(pf.trabajo_provincia, pf.trabajo_localidad)) : false;

  return { escala, param, aportes: filasAportes, zona, sinPerfil: !pf, existente: existente.data, mejorGuardada, mejorAnio };
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
  el('avisoNovedades').textContent = '';
  liq.fila = null;
  formCierre.hidden = true;
  listaOtros.innerHTML = '';
  ['faltas_dias', 'horas_extra_50', 'horas_extra_100', 'horas_feriado', 'mejor_remuneracion', 'vac_dias', 'vac_desde'].forEach((c) => { formLiq.elements[c].value = ''; });
  const vac = Liquidacion.diasVacaciones(liq.empleado.fecha_ingreso, periodo.slice(0, 4));
  el('ayudaVac').textContent = vac && vac.dias
    ? `Le corresponden ${vac.dias} días corridos de vacaciones en ${periodo.slice(0, 4)}${vac.proporcional ? ' (proporcional)' : ''}, a tomar entre el 1/10 y el 30/4. Se pagan antes de empezar: cargá todos los días en el mes en que comienzan.`
    : '';
  formLiq.elements.incluir_sac.checked = false;
  liq.sacManual = false;
  liq.sacTocado = false;
  liq.mejorAnioManual = false;
  formLiq.elements.hay_egreso.checked = false;
  ['egreso_fecha', 'egreso_mejor', 'egreso_vac_ajuste'].forEach((c) => { formLiq.elements[c].value = ''; });
  formLiq.elements.egreso_causa.value = 'renuncia';
  formLiq.elements.egreso_preaviso.checked = false;
  formLiq.elements.egreso_sac_indemn.checked = true;
  el('cajaSac').hidden = !esMesSac();
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
    if (n.egreso) {
      formLiq.elements.hay_egreso.checked = true;
      formLiq.elements.egreso_fecha.value = n.egreso.fecha || '';
      formLiq.elements.egreso_causa.value = n.egreso.causa || 'renuncia';
      formLiq.elements.egreso_preaviso.checked = !!n.egreso.preaviso_otorgado;
      formLiq.elements.egreso_sac_indemn.checked = n.egreso.sac_indemn !== false;
      formLiq.elements.egreso_vac_ajuste.value = n.egreso.vac_pendientes || '';
      formLiq.elements.egreso_mejor.value = n.egreso.mejor_remuneracion || '';
      liq.mejorAnioManual = !!n.egreso.mejor_manual;
      liq.sacTocado = true;
    }
    if (n.vacaciones) {
      formLiq.elements.vac_dias.value = n.vacaciones.dias || '';
      formLiq.elements.vac_desde.value = n.vacaciones.desde || '';
    }
    if (n.sac && n.sac.incluir) {
      formLiq.elements.incluir_sac.checked = true;
      formLiq.elements.mejor_remuneracion.value = n.sac.mejor_remuneracion || '';
      liq.sacManual = !!n.sac.manual;
    }
    mostrarEstado(estado, `Ya hay una liquidación guardada de ${nombrePeriodo(periodo)} (${new Date(ex.actualizado).toLocaleDateString('es-AR')}). Si cambiás algo, guardala de nuevo.`);
  } else {
    (liq.empleado.conceptos_fijos || []).forEach((o) => agregarOtro({ ...o, fijo: true }));
    mostrarEstado(estado, '');
    traerNovedades(false);
  }
  recalcular();
  if (liqIrACierre) {
    liqIrACierre = false;
    if (!formCierre.hidden) formCierre.scrollIntoView({ behavior: 'smooth' });
  }
}
formLiq.elements.periodo.addEventListener('change', cargarPeriodo);
formLiq.addEventListener('input', (ev) => {
  if (ev.target.name === 'mejor_remuneracion') liq.sacManual = true;
  if (ev.target.name === 'egreso_mejor') liq.mejorAnioManual = true;
  if (ev.target.name === 'incluir_sac') liq.sacTocado = true;
  if (ev.target.name === 'incluir_sac' && ev.target.checked) liq.sacManual = false;
  if (ev.target.name !== 'periodo') recalcular();
});
const esMesSac = () => ['06', '12'].includes((formLiq.elements.periodo.value || '').slice(5, 7));
const sacVisible = () => esMesSac() || formLiq.elements.hay_egreso.checked;

function recalcular() {
  const d = liq.datos;
  if (!d) return;
  const periodo = formLiq.elements.periodo.value;
  if (!d.escala) {
    liq.resultado = null;
    resultadoLiq.innerHTML = `<p class="estado mal">No hay escala salarial cargada para ${nombrePeriodo(periodo)}.</p>`;
    return;
  }
  // Aguinaldo: si no se escribió a mano, proponer la mayor entre los meses guardados del semestre y este mes
  // ---- Liquidación final ----
  const hayEgreso = formLiq.elements.hay_egreso.checked;
  el('bloqueEgreso').hidden = !hayEgreso;
  el('cajaSac').hidden = !sacVisible();
  if (hayEgreso) {
    if (!formLiq.elements.egreso_fecha.value) formLiq.elements.egreso_fecha.value = ultimoDiaDe(periodo);
    const esDespido = formLiq.elements.egreso_causa.value === 'despido_sin_causa';
    formLiq.querySelectorAll('.solo-despido').forEach((n) => { n.hidden = !esDespido; });
    if (!formLiq.elements.incluir_sac.checked && !liq.sacTocado) formLiq.elements.incluir_sac.checked = true; // SAC proporcional siempre
    if (esDespido && !liq.mejorAnioManual) {
      const remMes = Liquidacion.calcular({ empleado: liq.empleado, periodo, escala: d.escala, param: d.param, zona: d.zona, aportes: d.aportes, novedades: { otros: leerOtros() } }).base_mes_completo;
      const g = d.mejorAnio;
      formLiq.elements.egreso_mejor.value = Math.max(g.importe, remMes).toFixed(2);
      el('origenMejorAnio').textContent = (g.importe > remMes ? `Tomada de ${nombrePeriodo(g.periodo)} (${pesos(g.importe)}).` : `Es la del sueldo completo de este mes (${pesos(remMes)}).`) +
        (g.meses < 11 ? ` Solo hay ${g.meses} meses del último año guardados en la app: si alguno fue mayor, escribilo a mano.` : '');
    } else if (liq.mejorAnioManual) el('origenMejorAnio').textContent = 'Valor escrito a mano.';
    el('ayudaEgreso').textContent = {
      renuncia: 'Renuncia: días trabajados + aguinaldo proporcional + vacaciones no gozadas. El trabajador debe preavisar 10 días.',
      despido_sin_causa: 'Despido sin causa: además, preaviso (10 días con menos de 1 año, 30 con más) e integración del mes si no se preavisó, e indemnización por antigüedad (art. 48).',
      periodo_prueba: 'Período de prueba (6 meses): sin preaviso ni indemnización. Corresponden días trabajados, aguinaldo y vacaciones proporcionales.',
      mutuo_acuerdo: 'Mutuo acuerdo: sin indemnización (salvo lo que pacten: cargalo en "Otros conceptos"). Conviene formalizarlo por escrito.',
      despido_con_causa: 'Despido con causa: sin preaviso ni indemnización. La causa debe ser grave y comunicarse por escrito.',
    }[formLiq.elements.egreso_causa.value] || '';
  }

  const conSac = sacVisible() && formLiq.elements.incluir_sac.checked;
  el('bloqueSac').hidden = !conSac;
  if (conSac) {
    const sinSac = { ...leerNovedades(), sac: null, egreso: null };
    const remMes = Liquidacion.calcular({ empleado: liq.empleado, periodo, escala: d.escala, param: d.param, zona: d.zona, aportes: d.aportes, novedades: sinSac }).total_remunerativo;
    const g = d.mejorGuardada;
    if (!liq.sacManual) {
      formLiq.elements.mejor_remuneracion.value = Math.max(g.importe, remMes).toFixed(2);
    }
    const mesesSem = Number(periodo.slice(5, 7)) <= 6 ? Number(periodo.slice(5, 7)) - 1 : Number(periodo.slice(5, 7)) - 7;
    el('origenSac').textContent = liq.sacManual
      ? 'Valor escrito a mano.'
      : (g.importe > remMes ? `Tomada de ${nombrePeriodo(g.periodo)} (${pesos(g.importe)}).` : `Es la de este mes (${pesos(remMes)}).`) +
        (g.meses < mesesSem ? ` Ojo: solo hay ${g.meses} de ${mesesSem} meses anteriores del semestre guardados en la app; si algún mes fue mayor, escribilo a mano.` : '');
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
      cargas_empleador: r.cargas_empleador, costo_total: r.costo_total, sac_importe: r.sac_importe, sac: r.sac },
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
  // Baja del empleado (o anulación de la baja si se destildó)
  const eg = novedades.egreso;
  const bajaEnEsteMes = liq.empleado.fecha_egreso && liq.empleado.fecha_egreso.slice(0, 7) === periodo;
  if (eg || bajaEnEsteMes) {
    const cambio = eg ? { fecha_egreso: eg.fecha, causa_egreso: eg.causa } : { fecha_egreso: null, causa_egreso: null };
    const { error: errBaja } = await db.from('empleados').update(cambio).eq('id', liq.empleado.id);
    if (errBaja) console.error(errBaja); else Object.assign(liq.empleado, cambio);
  }
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
  'vacaciones_divisor',
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
  el('estadoUbicacion').textContent = data && data.trabajo_lat
    ? '✓ Ubicación del lugar de trabajo guardada. Podés volver a guardarla si cambió.'
    : 'Hacelo estando en la casa. Sirve para comparar dónde marca el presente tu personal.';
}

formPerfil.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limpiarMarcas(formPerfil);
  const p = leerCampos(formPerfil, CAMPOS_PERFIL);
  p.cuil = (p.cuil || '').replace(/\D/g, '');
  p.trabajo_mismo_domicilio = chkMismo.checked;
  p.vacaciones_divisor = p.vacaciones_divisor ? Number(p.vacaciones_divisor) : null;

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
  el('btnUsuario').hidden = true;
  el('menuUsuario').hidden = true;
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
    window.chequearAdmin?.();
    if (window.iniciarRol) window.iniciarRol(); else irA('vistaLista');
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
    if (evento === 'INITIAL_SESSION') {
      if (window.invitacionPendiente && !avisoInicial) {
        mostrarLogin('vistaCrear', 'Te invitaron a CasaEnRegla: creá tu cuenta (o tocá "Ya tengo cuenta" si ya tenés una) y después confirmá con tu DNI.');
      } else mostrarLogin('vistaEntrar', avisoInicial, !!avisoInicial);
    }
    else if (el('pantallaLogin').hidden) mostrarLogin('vistaEntrar');
  }, 0);
});

// ================= Instalación como app (PWA) =================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
