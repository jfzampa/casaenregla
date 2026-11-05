// ===== CasaEnRegla — pantalla "Nuevo empleado" =====

const form = document.getElementById('formEmpleado');
const $ = (name) => form.elements[name];

// ---------- Provincias ----------
const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];
const selProv = document.getElementById('selProvincia');
selProv.innerHTML = '<option value="">Elegir…</option>' +
  PROVINCIAS.map((p) => `<option>${p}</option>`).join('');

// ---------- CUIL ----------
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function digitoVerificador(diez) {
  const suma = diez.split('').reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);
  const resto = suma % 11;
  if (resto === 0) return 0;
  return 11 - resto; // puede dar 10 → hay que cambiar el prefijo
}

function calcularCuil(dni, sexo) {
  dni = String(dni).replace(/\D/g, '').padStart(8, '0');
  if (dni.length !== 8) return null;
  let prefijo = sexo === 'M' ? '20' : sexo === 'F' ? '27' : '23';
  let dv = digitoVerificador(prefijo + dni);
  if (dv === 10) {
    // Regla oficial: se usa prefijo 23 y dígito 9 (varón) o 4 (mujer)
    prefijo = '23';
    dv = sexo === 'F' ? 4 : 9;
  }
  return `${prefijo}-${dni}-${dv}`;
}

function cuilValido(cuil) {
  const n = String(cuil).replace(/\D/g, '');
  if (n.length !== 11) return false;
  const dv = digitoVerificador(n.slice(0, 10));
  return dv !== 10 && dv === Number(n[10]);
}

function formatearCuil(cuil) {
  const n = String(cuil).replace(/\D/g, '');
  return n.length === 11 ? `${n.slice(0, 2)}-${n.slice(2, 10)}-${n[10]}` : cuil;
}

const avisoCuil = document.getElementById('avisoCuil');
document.getElementById('btnCalcularCuil').addEventListener('click', () => {
  const dni = $('dni').value, sexo = $('sexo').value;
  if (!dni || !sexo) {
    avisoCuil.textContent = 'Primero completá DNI y sexo.';
    return;
  }
  $('cuil').value = calcularCuil(dni, sexo);
  avisoCuil.textContent = 'CUIL calculado. Confirmalo con el del empleado (puede ser distinto en casos raros).';
});
$('cuil').addEventListener('blur', () => {
  if ($('cuil').value) $('cuil').value = formatearCuil($('cuil').value);
});

// ---------- Lectura del código de barras del DNI ----------
// "dd/mm/aaaa" → "aaaa-mm-dd" (formato que usa el campo fecha)
function fechaAIso(f) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((f || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function capitalizar(t) {
  return (t || '').trim().toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
}

function leerTextoDni(texto) {
  const p = texto.split('@').map((s) => s.trim());
  // DNI tarjeta (nuevo): trámite@APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISIÓN@...
  if (p.length >= 8 && /^\d+$/.test(p[0]) && /^[MFX]$/.test(p[3])) {
    return { apellido: p[1], nombre: p[2], sexo: p[3], dni: p[4], nacimiento: p[6] };
  }
  // DNI libreta (viejo): @DNI@EJEMPLAR@?@APELLIDO@NOMBRE@NACIONALIDAD@NACIMIENTO@SEXO@...
  if (p.length >= 9 && p[0] === '' && /^[MFX]$/.test(p[8])) {
    return { apellido: p[4], nombre: p[5], sexo: p[8], dni: p[1], nacimiento: p[7] };
  }
  return null;
}

function completarConDni(d) {
  $('apellido').value = capitalizar(d.apellido);
  $('nombre').value = capitalizar(d.nombre);
  $('sexo').value = d.sexo;
  $('dni').value = d.dni.replace(/\D/g, '');
  $('fecha_nacimiento').value = fechaAIso(d.nacimiento);
  $('cuil').value = calcularCuil($('dni').value, d.sexo) || '';
  avisoCuil.textContent = 'CUIL calculado a partir del DNI. Confirmalo con el del empleado.';
}

const btnEscanear = document.getElementById('btnEscanear');
const visor = document.getElementById('visor');
const video = document.getElementById('video');
const estadoScan = document.getElementById('estadoScan');
let lector = null;

function mostrarEstado(el, texto, mal = false) {
  el.textContent = texto;
  el.classList.toggle('mal', mal);
}

function detenerEscaneo() {
  if (lector) lector.reset();
  lector = null;
  visor.hidden = true;
  btnEscanear.hidden = false;
}

btnEscanear.addEventListener('click', async () => {
  if (!window.ZXing) {
    mostrarEstado(estadoScan, 'No se pudo cargar el lector. Revisá la conexión a internet.', true);
    return;
  }
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  lector = new ZXing.BrowserMultiFormatReader(hints, 300);

  visor.hidden = false;
  btnEscanear.hidden = true;
  mostrarEstado(estadoScan, 'Buscando el código de barras…');

  try {
    await lector.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
      video,
      (resultado) => {
        if (!resultado) return;
        const datos = leerTextoDni(resultado.getText());
        if (!datos) {
          mostrarEstado(estadoScan, 'Leí un código pero no parece de un DNI. Probá de nuevo.', true);
          return;
        }
        detenerEscaneo();
        completarConDni(datos);
        mostrarEstado(estadoScan, '✓ Datos cargados. Revisalos antes de guardar.');
      },
    );
  } catch (e) {
    detenerEscaneo();
    mostrarEstado(estadoScan, 'No se pudo abrir la cámara. Revisá que la app tenga permiso.', true);
    console.error(e);
  }
});
document.getElementById('btnCancelarScan').addEventListener('click', () => {
  detenerEscaneo();
  mostrarEstado(estadoScan, '');
});

// ---------- Validación y guardado ----------
function leerFormulario() {
  const f = new FormData(form);
  return {
    apellido: f.get('apellido').trim(),
    nombre: f.get('nombre').trim(),
    dni: f.get('dni').trim(),
    sexo: f.get('sexo'),
    fecha_nacimiento: f.get('fecha_nacimiento') || null,
    cuil: f.get('cuil').replace(/\D/g, ''),
    calle: f.get('calle').trim(),
    numero: f.get('numero').trim(),
    piso_depto: f.get('piso_depto').trim(),
    codigo_postal: f.get('codigo_postal').trim(),
    localidad: f.get('localidad').trim(),
    provincia: f.get('provincia'),
    fecha_ingreso: f.get('fecha_ingreso') || null,
    categoria: f.get('categoria') ? Number(f.get('categoria')) : null,
    modalidad: f.get('modalidad'),
    horas_semanales: f.get('horas_semanales') ? Number(f.get('horas_semanales')) : null,
    dias: f.getAll('dias'),
  };
}

function validar(e) {
  const errores = [];
  const marcar = (campo, msj) => { form.elements[campo]?.classList?.add('invalido'); errores.push(msj); };
  form.querySelectorAll('.invalido').forEach((el) => el.classList.remove('invalido'));

  if (!e.apellido) marcar('apellido', 'Falta el apellido.');
  if (!e.nombre) marcar('nombre', 'Falta el nombre.');
  if (!/^\d{7,8}$/.test(e.dni)) marcar('dni', 'El DNI tiene que tener 7 u 8 números.');
  if (!e.sexo) marcar('sexo', 'Elegí el sexo.');
  if (!cuilValido(e.cuil)) marcar('cuil', 'El CUIL no es válido.');
  if (!e.fecha_ingreso) marcar('fecha_ingreso', 'Falta la fecha de ingreso.');
  if (!e.categoria) marcar('categoria', 'Elegí la categoría.');
  if (!e.modalidad) errores.push('Elegí la modalidad (con o sin retiro).');
  return errores;
}

async function guardarEmpleado(empleado) {
  const { error } = editandoId
    ? await db.from('empleados').update(empleado).eq('id', editandoId)
    : await db.from('empleados').insert(empleado);
  if (error) {
    if (error.code === '23505') throw new Error('Ya tenés cargado un empleado con ese DNI.');
    throw error;
  }
}

const estadoGuardar = document.getElementById('estadoGuardar');
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const empleado = leerFormulario();
  const errores = validar(empleado);
  document.getElementById('errores').textContent = errores.join('\n');
  if (errores.length) {
    mostrarEstado(estadoGuardar, '');
    return;
  }
  const btnGuardar = document.getElementById('btnGuardar');
  btnGuardar.disabled = true;
  try {
    await guardarEmpleado(empleado);
    const msj = `✓ ${empleado.nombre} ${empleado.apellido} ${editandoId ? 'actualizado' : 'guardado'}.`;
    await mostrarLista();
    mostrarEstado(estadoLista, msj);
  } catch (err) {
    mostrarEstado(estadoGuardar, err.message?.startsWith('Ya tenés') ? err.message : 'No se pudo guardar. Revisá la conexión y probá de nuevo.', true);
    console.error(err);
  } finally {
    btnGuardar.disabled = false;
  }
});

// ---------- Lista de empleados y edición ----------
const CATEGORIAS = {
  1: 'Supervisor/a', 2: 'Tareas específicas', 3: 'Caseros',
  4: 'Asistencia y cuidado', 5: 'Tareas generales',
};
const vistaLista = document.getElementById('vistaLista');
const vistaForm = document.getElementById('vistaForm');
const listaEl = document.getElementById('listaEmpleados');
const estadoLista = document.getElementById('estadoLista');
let editandoId = null;
let empleados = [];

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

async function mostrarLista() {
  detenerEscaneo();
  vistaForm.hidden = true;
  vistaLista.hidden = false;
  mostrarEstado(estadoLista, 'Cargando…');
  window.scrollTo({ top: 0 });

  const { data, error } = await db.from('empleados').select('*').order('apellido').order('nombre');
  if (error) {
    mostrarEstado(estadoLista, 'No se pudo cargar la lista. Revisá la conexión.', true);
    console.error(error);
    return;
  }
  mostrarEstado(estadoLista, '');
  empleados = data;
  listaEl.innerHTML = data.length
    ? data.map((e) => `
        <button type="button" class="item" data-id="${e.id}">
          <b>${escapar(e.apellido)}, ${escapar(e.nombre)}</b>
          <span>${e.categoria}ª ${CATEGORIAS[e.categoria] || ''} · ${e.modalidad === 'sin_retiro' ? 'Sin retiro' : 'Con retiro'} · desde ${fechaCorta(e.fecha_ingreso)}</span>
        </button>`).join('')
    : '<p class="vacio">Todavía no cargaste ningún empleado.</p>';
}

function abrirFormulario(empleado = null) {
  editandoId = empleado?.id || null;
  form.reset();
  form.querySelectorAll('.invalido').forEach((el) => el.classList.remove('invalido'));
  ['errores', 'estadoGuardar', 'estadoScan'].forEach((id) => { document.getElementById(id).textContent = ''; });
  avisoCuil.textContent = '';

  if (empleado) {
    for (const [campo, valor] of Object.entries(empleado)) {
      const el = form.elements[campo];
      if (!el || valor == null || campo === 'dias') continue;
      el.value = campo === 'cuil' ? formatearCuil(valor) : valor;
    }
    form.querySelectorAll('input[name="dias"]').forEach((c) => { c.checked = (empleado.dias || []).includes(c.value); });
  }

  document.getElementById('tituloForm').textContent = empleado ? `${empleado.nombre} ${empleado.apellido}` : 'Nuevo empleado';
  document.getElementById('btnGuardar').textContent = empleado ? 'Guardar cambios' : 'Guardar';
  vistaLista.hidden = true;
  vistaForm.hidden = false;
  window.scrollTo({ top: 0 });
}

listaEl.addEventListener('click', (ev) => {
  const item = ev.target.closest('.item');
  if (item) abrirFormulario(empleados.find((e) => e.id === item.dataset.id));
});
document.getElementById('btnNueva').addEventListener('click', () => abrirFormulario());
document.getElementById('btnVolver').addEventListener('click', () => mostrarLista());

// ---------- Login (Supabase) ----------
const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const pantallaLogin = document.getElementById('pantallaLogin');
const pantallaApp = document.getElementById('pantallaApp');
const estadoLogin = document.getElementById('estadoLogin');

let usuarioActual = null;
function mostrarPantalla(sesion) {
  pantallaLogin.hidden = !!sesion;
  pantallaApp.hidden = !sesion;
  document.getElementById('emailUsuario').textContent = sesion?.user?.email || '';
  const nuevoUsuario = sesion?.user?.id || null;
  if (nuevoUsuario && nuevoUsuario !== usuarioActual) mostrarLista();
  usuarioActual = nuevoUsuario;
}

// setTimeout: Supabase recomienda no hacer consultas dentro de este aviso directamente
db.auth.onAuthStateChange((_evento, sesion) => setTimeout(() => mostrarPantalla(sesion), 0));

document.getElementById('formLogin').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  mostrarEstado(estadoLogin, 'Entrando…');
  const { error } = await db.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
  if (error) {
    mostrarEstado(estadoLogin, 'Email o contraseña incorrectos.', true);
    console.error(error);
  } else {
    mostrarEstado(estadoLogin, '');
  }
});

document.getElementById('btnSalir').addEventListener('click', () => db.auth.signOut());

// ---------- Instalación como app (PWA) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
