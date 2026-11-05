// ===== CasaEnRegla — Administración (solo el dueño) =====
// Escalas, aportes de ARCA y parámetros: los valores oficiales que usan todos los usuarios.
// La seguridad real está en la base (solo un admin puede escribir); esto es la pantalla.

(function () {
  const NOMBRE_CAT = { 1: '1ª Supervisor/a', 2: '2ª Tareas específicas', 3: '3ª Caseros', 4: '4ª Asistencia y cuidado', 5: '5ª Tareas generales' };
  const NOMBRE_TIPO = { activo: 'Activo', menor: 'Menor 16-18', jubilado: 'Jubilado' };
  const NOMBRE_FRANJA = { menos_12: '< 12 hs', '12_a_16': '12 a < 16', '16_o_mas': '16 o más' };
  const CLAVES = [];
  for (let c = 1; c <= 5; c++) for (const m of ['con_retiro', 'sin_retiro']) CLAVES.push([c, m]);
  const TIPOS_FRANJAS = [];
  for (const t of ['activo', 'menor', 'jubilado']) for (const f of ['menos_12', '12_a_16', '16_o_mas']) TIPOS_FRANJAS.push([t, f]);
  const MESES_CORTO = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  const st = { vigencias: [], vig: null, anterior: null, nueva: false, periodos: [], per: null, nuevoPer: false };
  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const nombreVig = (v) => `${v.slice(5, 7)}/${v.slice(0, 4)}`;

  // ---------- ¿Es admin? (muestra u oculta la pestaña) ----------
  window.chequearAdmin = async () => {
    const { data } = await db.rpc('es_admin');
    el('tabAdmin').hidden = !data;
  };

  // ---------- Sub-pestañas ----------
  document.querySelectorAll('[data-admin]').forEach((b) => b.addEventListener('click', () => mostrarSub(b.dataset.admin)));
  function mostrarSub(id) {
    ['adminEscalas', 'adminAportes', 'adminParametros', 'adminFeriados'].forEach((s) => { el(s).hidden = s !== id; });
    document.querySelectorAll('[data-admin]').forEach((b) => b.classList.toggle('activa', b.dataset.admin === id));
    ({ adminEscalas: cargarVigencias, adminAportes: cargarPeriodos, adminParametros: cargarParametros, adminFeriados: cargarFeriados })[id]();
  }
  window.cargarAdmin = () => mostrarSub('adminEscalas');

  // =====================================================================
  // ESCALAS
  // =====================================================================
  async function filasDeVigencia(v) {
    if (!v) return null;
    const { data, error } = await db.from('escalas').select('*').eq('vigencia_desde', v);
    if (error) throw error;
    return data;
  }

  async function cargarVigencias(elegida) {
    const { data, error } = await db.rpc('vigencias_escalas');
    if (error) { mostrarEstado(el('estadoEscala'), 'No se pudieron cargar las vigencias. ¿Corriste el SQL 10?', true); console.error(error); return; }
    st.vigencias = data.map((d) => (typeof d === 'string' ? d : d.vigencias_escalas));
    el('selVigencia').innerHTML = st.vigencias.map((v) => `<option value="${v}">${nombreVig(v)}</option>`).join('');
    await abrirVigencia(elegida || st.vigencias[0]);
  }

  async function abrirVigencia(v) {
    st.nueva = false;
    el('nuevaVigencia').hidden = true;
    el('selVigencia').disabled = false;
    el('selVigencia').value = v;
    mostrarEstado(el('estadoEscala'), '');
    const i = st.vigencias.indexOf(v);
    const [filas, anterior] = await Promise.all([filasDeVigencia(v), filasDeVigencia(st.vigencias[i + 1])]);
    st.vig = v;
    st.anterior = anterior;
    el('resolEscala').value = filas[0]?.resolucion || '';
    dibujarEscala(filas);
  }
  el('selVigencia').addEventListener('change', (e) => abrirVigencia(e.target.value));

  function dibujarEscala(filas) {
    const fila = (c, m) => filas.find((f) => f.categoria === c && f.modalidad === m) || {};
    el('tablaEscala').innerHTML = `<tr><th>Categoría</th><th>Hora</th><th>Mensual</th></tr>` +
      CLAVES.map(([c, m]) => {
        const f = fila(c, m);
        return `<tr data-c="${c}" data-m="${m}">
          <td>${NOMBRE_CAT[c]}<small>${m === 'con_retiro' ? 'Con retiro' : 'Sin retiro'}</small></td>
          <td><input data-campo="valor_hora" type="number" step="0.01" inputmode="decimal" value="${f.valor_hora ?? ''}"><small class="pct"></small></td>
          <td><input data-campo="valor_mensual" type="number" step="0.01" inputmode="decimal" value="${f.valor_mensual ?? ''}"><small class="pct"></small></td>
        </tr>`;
      }).join('');
    controlar();
  }

  function leerEscala() {
    return [...el('tablaEscala').querySelectorAll('tr[data-c]')].map((tr) => ({
      categoria: Number(tr.dataset.c), modalidad: tr.dataset.m,
      valor_hora: Number(tr.querySelector('[data-campo=valor_hora]').value) || 0,
      valor_mensual: Number(tr.querySelector('[data-campo=valor_mensual]').value) || 0,
    }));
  }

  // Controles automáticos + % de aumento contra la vigencia anterior
  function controlar() {
    const filas = leerEscala();
    const ant = st.anterior;
    el('tablaEscala').querySelectorAll('tr[data-c]').forEach((tr) => {
      const a = ant?.find((x) => x.categoria === Number(tr.dataset.c) && x.modalidad === tr.dataset.m);
      tr.querySelectorAll('input').forEach((inp) => {
        const small = inp.nextElementSibling;
        const v = Number(inp.value);
        if (!a || !v) { small.textContent = ''; return; }
        const pct = (v / a[inp.dataset.campo] - 1) * 100;
        small.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
        small.classList.toggle('mal', pct < 0 || pct > 30);
      });
    });
    const avisos = Liquidacion.controlarEscala(filas, ant);
    el('controlesEscala').hidden = !avisos.length;
    el('controlesEscala').innerHTML = avisos.map((a) => `<li>${escapar(a)}</li>`).join('');
    el('okEscala').textContent = avisos.length ? '' : '✓ Los controles automáticos están bien.';
    return avisos;
  }
  el('tablaEscala').addEventListener('input', controlar);

  // ---- Nueva vigencia ----
  el('btnNuevaVigencia').addEventListener('click', async () => {
    const ultima = st.vigencias[0];
    const base = await filasDeVigencia(ultima);
    st.nueva = true;
    st.anterior = base;
    el('nuevaVigencia').hidden = false;
    el('selVigencia').disabled = true;
    const [a, m] = ultima.split('-').map(Number);
    el('vigNueva').value = m === 12 ? `${a + 1}-01` : `${a}-${MESES_CORTO[m]}`;
    el('pctAumento').value = '';
    el('txtUpacp').value = '';
    el('resolEscala').value = '';
    dibujarEscala(base);
    mostrarEstado(el('estadoEscala'), `Partiendo de la vigencia ${nombreVig(ultima)}. Aplicá el % de aumento o pegá la tabla de UPACP.`);
  });

  el('btnAplicarPct').addEventListener('click', () => {
    const pct = Number(el('pctAumento').value);
    if (!pct) return;
    dibujarEscala(st.anterior.map((f) => ({ ...f, valor_hora: r2(f.valor_hora * (1 + pct / 100)), valor_mensual: r2(f.valor_mensual * (1 + pct / 100)) })));
    mostrarEstado(el('estadoEscala'), `Aplicado +${pct}%. Compará con lo publicado: a veces la Comisión redondea distinto.`);
  });

  el('btnLeerUpacp').addEventListener('click', () => {
    const r = Liquidacion.analizarTextoEscala(el('txtUpacp').value);
    if (r.problemas.length) { mostrarEstado(el('estadoEscala'), r.problemas.join(' '), true); return; }
    if (r.vigencia) el('vigNueva').value = r.vigencia.slice(0, 7);
    dibujarEscala(r.filas);
    mostrarEstado(el('estadoEscala'), `✓ Tabla leída${r.vigencia ? ` (vigente desde ${nombreVig(r.vigencia)})` : ''}. Revisá los controles.`);
  });

  // ---- Guardar ----
  el('btnGuardarEscala').addEventListener('click', async () => {
    const vig = st.nueva ? `${el('vigNueva').value}-01` : st.vig;
    if (!/^\d{4}-\d{2}-01$/.test(vig)) { mostrarEstado(el('estadoEscala'), 'Elegí el mes de vigencia.', true); return; }
    if (st.nueva && st.vigencias.includes(vig) && !confirm(`Ya existe la vigencia ${nombreVig(vig)}. ¿Reemplazarla?`)) return;
    const avisos = controlar();
    if (avisos.length && !confirm(`Hay ${avisos.length} aviso(s) de control. ¿Guardar igual?`)) return;
    const resol = el('resolEscala').value.trim() || null;
    const filas = leerEscala().map((f) => ({ ...f, vigencia_desde: vig, resolucion: resol }));
    const { error } = await db.from('escalas').upsert(filas, { onConflict: 'vigencia_desde,categoria,modalidad' });
    if (error) { mostrarEstado(el('estadoEscala'), 'No se pudo guardar (¿tenés rol de admin?).', true); console.error(error); return; }
    escalasCache.clear();
    await cargarVigencias(vig);
    mostrarEstado(el('estadoEscala'), `✓ Vigencia ${nombreVig(vig)} guardada. Ya la usan todos los usuarios.`);
  });

  // =====================================================================
  // APORTES ARCA
  // =====================================================================
  async function filasDePeriodo(p) {
    if (!p) return [];
    const { data, error } = await db.from('aportes_arca').select('*').eq('periodo_desde', p);
    if (error) throw error;
    return data;
  }

  async function cargarPeriodos(elegido) {
    const { data, error } = await db.rpc('periodos_aportes');
    if (error) { mostrarEstado(el('estadoAportes'), 'No se pudieron cargar los períodos. ¿Corriste el SQL 10?', true); console.error(error); return; }
    st.periodos = data.map((d) => (typeof d === 'string' ? d : d.periodos_aportes));
    el('selPeriodoAportes').innerHTML = st.periodos.map((p) => `<option value="${p}">${nombreVig(p)}</option>`).join('');
    if (st.periodos.length) await abrirPeriodo(elegido || st.periodos[0]);
  }

  async function abrirPeriodo(p) {
    st.nuevoPer = false;
    el('nuevoPeriodo').hidden = true;
    el('selPeriodoAportes').disabled = false;
    el('selPeriodoAportes').value = p;
    st.per = p;
    mostrarEstado(el('estadoAportes'), '');
    dibujarAportes(await filasDePeriodo(p));
  }
  el('selPeriodoAportes').addEventListener('change', (e) => abrirPeriodo(e.target.value));

  function dibujarAportes(filas) {
    const fila = (t, f) => filas.find((x) => x.tipo === t && x.franja === f) || {};
    el('tablaAportes').innerHTML = `<tr><th>Trabajador</th><th>Obra social</th><th>SIPA</th><th>ART</th></tr>` +
      TIPOS_FRANJAS.map(([t, f]) => {
        const x = fila(t, f);
        const total = r2((Number(x.aporte_os) || 0) + (Number(x.contribucion_sipa) || 0) + (Number(x.cuota_art) || 0));
        return `<tr data-t="${t}" data-f="${f}">
          <td>${NOMBRE_TIPO[t]}<small>${NOMBRE_FRANJA[f]} · total <b class="tot">${pesos(total)}</b></small></td>
          ${['aporte_os', 'contribucion_sipa', 'cuota_art'].map((c) => `<td><input data-campo="${c}" type="number" step="0.01" inputmode="decimal" value="${x[c] ?? ''}"></td>`).join('')}
        </tr>`;
      }).join('');
  }
  el('tablaAportes').addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    const total = [...tr.querySelectorAll('input')].reduce((s, i) => s + (Number(i.value) || 0), 0);
    tr.querySelector('.tot').textContent = pesos(r2(total));
  });

  function leerAportes() {
    return [...el('tablaAportes').querySelectorAll('tr[data-t]')].map((tr) => {
      const o = { tipo: tr.dataset.t, franja: tr.dataset.f };
      tr.querySelectorAll('input').forEach((i) => { o[i.dataset.campo] = Number(i.value) || 0; });
      return o;
    });
  }

  function urlPdfArca(mes) { // mes "aaaa-mm"
    const [a, m] = mes.split('-');
    return `https://www.afip.gob.ar/casasparticulares/aportes-contribuciones-ART/documentos/${a}/Casas-particulares-aportes-y-contribuciones-${m}-${a.slice(2)}.pdf`;
  }
  const actualizarLinkPdf = () => { if (el('perNuevo').value) el('linkPdfArca').href = urlPdfArca(el('perNuevo').value); };
  el('perNuevo').addEventListener('change', actualizarLinkPdf);

  el('btnNuevoPeriodo').addEventListener('click', async () => {
    const ultimo = st.periodos[0];
    st.nuevoPer = true;
    el('nuevoPeriodo').hidden = false;
    el('selPeriodoAportes').disabled = true;
    if (ultimo) {
      const [a, m] = ultimo.split('-').map(Number);
      el('perNuevo').value = m === 12 ? `${a + 1}-01` : `${a}-${MESES_CORTO[m]}`;
    }
    actualizarLinkPdf();
    el('avisoPdfAportes').textContent = '';
    dibujarAportes(await filasDePeriodo(ultimo));
    mostrarEstado(el('estadoAportes'), ultimo ? `Partiendo del período ${nombreVig(ultimo)}. Subí el PDF de ARCA para completar.` : '');
  });

  el('pdfAportes').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const aviso = el('avisoPdfAportes');
    aviso.textContent = 'Leyendo el PDF…';
    try {
      const r = Liquidacion.analizarAportesArca(await textoDePdf(archivo));
      if (r.problemas.length) { aviso.textContent = '⚠ ' + r.problemas.join(' '); return; }
      dibujarAportes(r.filas);
      if (r.periodo) el('perNuevo').value = r.periodo;
      aviso.textContent = `✓ Leí las 9 filas${r.periodo ? ` del período ${nombreVig(r.periodo + '-01')}` : ''}. Cada total coincide con obra social + SIPA + ART.`;
    } catch (err) {
      aviso.textContent = 'No pude leer el PDF. Cargá los valores a mano.';
      console.error(err);
    } finally {
      e.target.value = '';
    }
  });

  el('btnGuardarAportes').addEventListener('click', async () => {
    const per = st.nuevoPer ? `${el('perNuevo').value}-01` : st.per;
    if (!/^\d{4}-\d{2}-01$/.test(per || '')) { mostrarEstado(el('estadoAportes'), 'Elegí el período.', true); return; }
    if (st.nuevoPer && st.periodos.includes(per) && !confirm(`Ya existe el período ${nombreVig(per)}. ¿Reemplazarlo?`)) return;
    const filas = leerAportes().map((f) => ({ ...f, periodo_desde: per }));
    const { error } = await db.from('aportes_arca').upsert(filas, { onConflict: 'periodo_desde,tipo,franja' });
    if (error) { mostrarEstado(el('estadoAportes'), 'No se pudo guardar (¿tenés rol de admin?).', true); console.error(error); return; }
    await cargarPeriodos(per);
    mostrarEstado(el('estadoAportes'), `✓ Aportes de ${nombreVig(per)} guardados.`);
  });

  // =====================================================================
  // PARÁMETROS
  // =====================================================================
  const NOMBRE_PARAM = {
    zona_desfavorable_pct: 'Zona desfavorable %', antiguedad_pct_anual: 'Antigüedad % por año',
    horas_mensualizado: 'Horas para mensualizado', antiguedad_desde: 'Antigüedad desde',
    vep_dia_vencimiento: 'Día de vencimiento del VEP', periodo_prueba_meses: 'Período de prueba (meses)',
    vacaciones_divisor: 'Vacaciones: divisor',
  };

  async function cargarParametros() {
    const { data, error } = await db.from('parametros').select('*').order('clave').order('vigencia_desde', { ascending: false });
    if (error) { console.error(error); return; }
    el('tablaParametros').innerHTML = `<tr><th>Parámetro</th><th>Desde</th><th>Valor</th><th></th></tr>` +
      data.map((p) => `<tr><td>${escapar(NOMBRE_PARAM[p.clave] || p.clave)}<small>${escapar(p.descripcion || '')}</small></td>
        <td>${fechaCorta(p.vigencia_desde)}</td><td>${Number(p.valor)}</td>
        <td><button type="button" class="borrar" data-borrar="${p.id}">Borrar</button></td></tr>`).join('');
  }

  el('tablaParametros').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-borrar]');
    if (!b || !confirm('¿Borrar este valor? Afecta los cálculos de todos los usuarios.')) return;
    const { error } = await db.from('parametros').delete().eq('id', b.dataset.borrar);
    if (error) { alert('No se pudo borrar.'); console.error(error); return; }
    cargarParametros();
  });

  el('formParametro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, estado = f.querySelector('.estado');
    const p = {
      clave: f.elements.clave.value, vigencia_desde: f.elements.vigencia_desde.value,
      valor: Number(f.elements.valor.value), descripcion: f.elements.descripcion.value.trim() || null,
    };
    if (!p.vigencia_desde || f.elements.valor.value === '') { mostrarEstado(estado, 'Completá la fecha y el valor.', true); return; }
    const { error } = await db.from('parametros').upsert(p, { onConflict: 'clave,vigencia_desde' });
    if (error) { mostrarEstado(estado, 'No se pudo guardar (¿tenés rol de admin?).', true); console.error(error); return; }
    f.reset();
    mostrarEstado(estado, '✓ Guardado.');
    cargarParametros();
  });

  // =====================================================================
  // FERIADOS
  // =====================================================================
  const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  async function cargarFeriados() {
    const desde = `${new Date().getFullYear() - 1}-01-01`;
    const { data, error } = await db.from('feriados').select('*').gte('fecha', desde).order('fecha');
    if (error) { el('tablaFeriados').innerHTML = '<tr><td>No se pudieron cargar. ¿Corriste el SQL 12?</td></tr>'; console.error(error); return; }
    el('tablaFeriados').innerHTML = `<tr><th>Fecha</th><th>Motivo</th><th></th></tr>` + data.map((f) => {
      const [a, m, d] = f.fecha.split('-').map(Number);
      return `<tr><td>${DIAS_SEM[new Date(a, m - 1, d).getDay()]} ${fechaCorta(f.fecha)}</td><td>${escapar(f.descripcion)}</td>
        <td><button type="button" class="borrar" data-feriado="${f.fecha}">Borrar</button></td></tr>`;
    }).join('');
  }

  el('tablaFeriados').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-feriado]');
    if (!b || !confirm(`¿Borrar el feriado del ${fechaCorta(b.dataset.feriado)}?`)) return;
    const { error } = await db.from('feriados').delete().eq('fecha', b.dataset.feriado);
    if (error) { alert('No se pudo borrar.'); console.error(error); return; }
    cargarFeriados();
  });

  el('formFeriado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, estado = f.querySelector('.estado');
    const fila = { fecha: f.elements.fecha.value, descripcion: f.elements.descripcion.value.trim() };
    if (!fila.fecha || !fila.descripcion) { mostrarEstado(estado, 'Completá la fecha y el motivo.', true); return; }
    const { error } = await db.from('feriados').upsert(fila, { onConflict: 'fecha' });
    if (error) { mostrarEstado(estado, 'No se pudo guardar (¿tenés rol de admin?).', true); console.error(error); return; }
    f.reset();
    mostrarEstado(estado, '✓ Feriado agregado.');
    cargarFeriados();
  });
})();
