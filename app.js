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
const VISTAS = ['vistaLista', 'vistaForm', 'vistaPerfil', 'vistaCuenta'];
const ALCARGAR = { vistaLista: () => cargarLista(), vistaPerfil: () => cargarPerfil(), vistaCuenta: () => cargarCuenta() };

function irA(vista) {
  detenerEscaneo();
  VISTAS.forEach((v) => { el(v).hidden = v !== vista; });
  const pestania = vista === 'vistaForm' ? 'vistaLista' : vista;
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
];
const formEmpleado = el('formEmpleado');
const listaEl = el('listaEmpleados');
const estadoLista = el('estadoLista');
let empleados = [];
let editandoId = null;
let mensajeLista = ''; // mensaje para mostrar cuando termine de cargar la lista

async function cargarLista() {
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
        <button type="button" class="item" data-id="${e.id}">
          <b>${escapar(e.apellido)}, ${escapar(e.nombre)}</b>
          <span>${e.categoria}ª ${CATEGORIAS[e.categoria] || ''} · ${e.modalidad === 'sin_retiro' ? 'Sin retiro' : 'Con retiro'} · desde ${fechaCorta(e.fecha_ingreso)}</span>
        </button>`).join('')
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
}

listaEl.addEventListener('click', (ev) => {
  const item = ev.target.closest('.item');
  if (item) abrirEmpleado(empleados.find((e) => e.id === item.dataset.id));
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

el('formBorrar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target, estado = estadoDe(form);
  if (form.elements.confirmacion.value.trim().toUpperCase() !== 'BORRAR') {
    mostrarEstado(estado, 'Escribí BORRAR para confirmar.', true);
    return;
  }
  if (!confirm('¿Seguro? Se borran tu cuenta y todos los datos de tu personal. No se puede deshacer.')) return;
  mostrarEstado(estado, 'Borrando…');
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
