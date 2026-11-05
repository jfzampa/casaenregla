// ===== CasaEnRegla — Portal del empleado (y la parte del empleador que lo conecta) =====
// El empleado solo usa funciones de la base (rpc) que le devuelven lo suyo.

(function () {
  const CLAVE_INV = 'casaenregla_invitacion';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  let misEmpleos = [];
  let empleoActual = null;

  // ---------- Invitación recibida por link (?invitacion=...) ----------
  const leerInvitacion = () => { try { return localStorage.getItem(CLAVE_INV); } catch { return null; } };
  const guardarInvitacion = (c) => { try { c ? localStorage.setItem(CLAVE_INV, c) : localStorage.removeItem(CLAVE_INV); } catch { /* sin almacenamiento */ } };
  const codigoUrl = new URLSearchParams(location.search).get('invitacion');
  if (codigoUrl) {
    guardarInvitacion(codigoUrl);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  window.invitacionPendiente = !!(codigoUrl || leerInvitacion());

  // ---------- Al entrar: ¿es empleador, empleado o ambos? ----------
  window.iniciarRol = async () => {
    const [empleos, propios] = await Promise.all([
      db.rpc('mi_empleo'),
      db.from('empleados').select('id').limit(1),
    ]);
    misEmpleos = empleos.error ? [] : empleos.data;
    const soloEmpleado = misEmpleos.length > 0 && !(propios.data || []).length;
    el('tabTrabajo').hidden = !misEmpleos.length;
    el('tabEmpleados').hidden = soloEmpleado;
    el('tabPerfil').hidden = soloEmpleado;
    if (leerInvitacion()) { irA('vistaInvitacion'); return; }
    irA(soloEmpleado ? 'vistaTrabajo' : 'vistaLista');
  };

  // ---------- Aceptar la invitación ----------
  el('formInvitacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, estado = f.querySelector('.estado');
    mostrarEstado(estado, 'Vinculando…');
    const { data, error } = await db.rpc('aceptar_invitacion', { p_codigo: leerInvitacion(), p_dni: f.elements.dni.value });
    if (error) { mostrarEstado(estado, error.message || 'No se pudo vincular.', true); return; }
    guardarInvitacion(null);
    f.reset();
    mostrarEstado(estado, `✓ Listo, ${data}. Ya podés usar "Mi trabajo".`);
    window.iniciarRol();
  });
  el('btnIgnorarInvitacion').addEventListener('click', () => { guardarInvitacion(null); window.iniciarRol(); });

  // =====================================================================
  // MI TRABAJO (lo que ve el empleado)
  // =====================================================================
  window.cargarTrabajo = async () => {
    if (!misEmpleos.length) {
      const { data } = await db.rpc('mi_empleo');
      misEmpleos = data || [];
    }
    el('envoltorioEmpleo').hidden = misEmpleos.length < 2;
    el('selEmpleo').innerHTML = misEmpleos.map((x) => `<option value="${x.empleado_id}">${escapar(x.empleador)}</option>`).join('');
    if (!empleoActual || !misEmpleos.find((x) => x.empleado_id === empleoActual.empleado_id)) empleoActual = misEmpleos[0];
    if (!empleoActual) { el('datosTrabajo').textContent = 'Todavía no estás vinculado a ningún empleo.'; return; }
    el('selEmpleo').value = empleoActual.empleado_id;
    const x = empleoActual;
    el('tituloTrabajo').textContent = `Hola, ${x.nombre}`;
    el('datosTrabajo').textContent = [
      `Empleador: ${x.empleador}`, `${x.categoria}ª categoría`, x.modalidad === 'sin_retiro' ? 'sin retiro' : 'con retiro',
      x.horas_semanales ? `${x.horas_semanales} hs semanales` : '', `ingreso ${fechaCorta(x.fecha_ingreso)}`,
      x.fecha_egreso ? `baja ${fechaCorta(x.fecha_egreso)}` : '',
    ].filter(Boolean).join(' · ');
    el('btnPresente').disabled = !!x.fecha_egreso;
    el('mesTrabajo').value = el('mesTrabajo').value || mesActual();
    el('formNovEmpleado').elements.fecha.value = hoyIso();
    actualizarFormNovEmpleado();
    await Promise.all([cargarNovTrabajo(), cargarRecibos(), cargarAcuerdosTrabajo()]);
  };
  el('selEmpleo').addEventListener('change', (e) => {
    empleoActual = misEmpleos.find((x) => x.empleado_id === e.target.value);
    window.cargarTrabajo();
  });

  // ---------- Novedades del mes (las del empleador para confirmar y las propias) ----------
  async function cargarNovTrabajo() {
    const mes = el('mesTrabajo').value || mesActual();
    const [a, m] = mes.split('-').map(Number);
    const hasta = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
    const { data, error } = await db.rpc('mis_novedades', { p_empleado: empleoActual.empleado_id, p_desde: `${mes}-01`, p_hasta: hasta });
    if (error) { el('listaNovTrabajo').innerHTML = '<li>No se pudieron cargar.</li>'; console.error(error); return; }

    // Presente de hoy
    const hoy = data.find((n) => n.tipo === 'presente' && n.fecha === hoyIso());
    if (mes === mesActual()) {
      mostrarEstado(el('estadoPresente'), hoy ? `✓ Ya marcaste presente hoy a las ${horaDe(hoy.marcado_en)}${textoDistancia(hoy.distancia_m)}.` : '');
    }

    el('listaNovTrabajo').innerHTML = data.length ? data.map((n) => {
      const delEmpleador = n.cargado_por === 'empleador';
      const pendiente = delEmpleador && !n.confirmado_empleado && !n.observacion_empleado;
      return `<li><i class="nov-${n.tipo}"></i><span class="txt">
        <b>${fechaCorta(n.fecha)}</b> · ${TIPOS_NOV[n.tipo]}${n.tipo === 'presente' ? ` ${horaDe(n.marcado_en)}` : ''}${n.horas ? ` · ${Number(n.horas)} hs` : ''}${n.descripcion ? ` — ${escapar(n.descripcion)}` : ''}
        <small>${delEmpleador
          ? `La cargó tu empleador · ${n.confirmado_empleado ? '✓ Estás conforme' : n.observacion_empleado ? `No conforme: ${escapar(n.observacion_empleado)}` : 'Falta tu respuesta'}`
          : `La cargaste vos · Empleador: ${n.confirmado_empleador ? '✓ confirmó' : 'sin confirmar'}`}</small>
        ${pendiente ? `<span class="botones-respuesta"><button type="button" class="si" data-conforme="${n.id}">✓ Estoy conforme</button><button type="button" data-noconforme="${n.id}">No estoy conforme</button></span>` : ''}
      </span></li>`;
    }).join('') : '<li class="ayuda">Sin novedades este mes.</li>';
  }
  el('mesTrabajo').addEventListener('change', cargarNovTrabajo);

  const horaDe = (ts) => (ts ? new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');
  function textoDistancia(m) {
    if (m == null) return '';
    const d = Number(m);
    return d < 1000 ? ` (a ${Math.round(d)} m del lugar de trabajo)` : ` (a ${(d / 1000).toFixed(1).replace('.', ',')} km del lugar de trabajo)`;
  }

  el('listaNovTrabajo').addEventListener('click', async (e) => {
    const si = e.target.closest('[data-conforme]'), no = e.target.closest('[data-noconforme]');
    if (!si && !no) return;
    let obs = null;
    if (no) {
      obs = prompt('¿Por qué no estás conforme? (tu empleador lo va a ver)');
      if (obs === null) return;
    }
    const { error } = await db.rpc('responder_novedad', { p_id: (si || no).dataset[si ? 'conforme' : 'noconforme'], p_conforme: !!si, p_observacion: obs });
    if (error) { alert('No se pudo guardar tu respuesta.'); console.error(error); return; }
    cargarNovTrabajo();
  });

  // ---------- Marcar presente ----------
  el('btnPresente').addEventListener('click', () => {
    const estado = el('estadoPresente');
    const marcar = async (lat, lng, precision) => {
      const { data, error } = await db.rpc('marcar_presente', { p_empleado: empleoActual.empleado_id, p_lat: lat, p_lng: lng, p_precision: precision });
      if (error) { mostrarEstado(estado, 'No se pudo marcar. Probá de nuevo.', true); console.error(error); return; }
      const r = data[0];
      mostrarEstado(estado, r.ya_estaba
        ? `Ya habías marcado presente hoy a las ${horaDe(r.marcado)}${textoDistancia(r.distancia)}.`
        : `✓ Presente registrado a las ${horaDe(r.marcado)}${textoDistancia(r.distancia)}${lat == null ? ' (sin ubicación)' : ''}.`);
      cargarNovTrabajo();
    };
    if (!navigator.geolocation) { marcar(null, null, null); return; }
    mostrarEstado(estado, 'Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (p) => marcar(p.coords.latitude, p.coords.longitude, Math.round(p.coords.accuracy)),
      () => {
        if (confirm('No se pudo obtener tu ubicación (¿le diste permiso?). ¿Marcar presente igual, sin ubicación?')) marcar(null, null, null);
        else mostrarEstado(estado, 'Para marcar con ubicación, permití el acceso a la ubicación en tu celular.', true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

  // ---------- Avisar una ausencia o novedad ----------
  function actualizarFormNovEmpleado() {
    const f = el('formNovEmpleado'), tipo = f.elements.tipo.value;
    f.querySelector('.solo-horas').hidden = !['horas_extra_50', 'horas_extra_100', 'feriado_trabajado'].includes(tipo);
    f.querySelector('.solo-archivo').hidden = !['falta_justificada', 'nota'].includes(tipo);
  }
  el('formNovEmpleado').elements.tipo.addEventListener('change', actualizarFormNovEmpleado);

  el('formNovEmpleado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, estado = f.querySelector('.estado');
    const tipo = f.elements.tipo.value;
    const conHoras = !f.querySelector('.solo-horas').hidden;
    const horas = Number(f.elements.horas.value) || null;
    if (!f.elements.fecha.value) { mostrarEstado(estado, 'Elegí la fecha.', true); return; }
    if (conHoras && !horas) { mostrarEstado(estado, 'Indicá cuántas horas.', true); return; }
    mostrarEstado(estado, 'Enviando…');
    const { data: id, error } = await db.rpc('cargar_novedad_empleado', {
      p_empleado: empleoActual.empleado_id, p_fecha: f.elements.fecha.value, p_tipo: tipo,
      p_horas: conHoras ? horas : null, p_descripcion: f.elements.descripcion.value,
    });
    if (error) { mostrarEstado(estado, 'No se pudo enviar. Probá de nuevo.', true); console.error(error); return; }
    const archivo = f.elements.archivo.files[0];
    if (archivo && !f.querySelector('.solo-archivo').hidden) {
      if (archivo.size > 10 * 1024 * 1024) mostrarEstado(estado, 'Se envió, pero el archivo supera 10 MB.', true);
      else {
        const { data: { user } } = await db.auth.getUser();
        const ruta = `${user.id}/novedades/${id}.${(archivo.name.split('.').pop() || 'pdf').toLowerCase()}`;
        const sub = await db.storage.from('comprobantes').upload(ruta, archivo, { upsert: true, contentType: archivo.type });
        if (!sub.error) await db.rpc('adjuntar_justificativo', { p_id: id, p_ruta: ruta });
        else console.error(sub.error);
      }
    }
    const fecha = f.elements.fecha.value;
    f.reset();
    f.elements.fecha.value = hoyIso();
    actualizarFormNovEmpleado();
    mostrarEstado(estado, `✓ Enviado. Tu empleador lo va a ver en tu ficha (${fechaCorta(fecha)}).`);
    cargarNovTrabajo();
  });

  // ---------- Mis recibos ----------
  async function cargarRecibos() {
    const { data, error } = await db.rpc('mis_liquidaciones', { p_empleado: empleoActual.empleado_id });
    if (error) { el('listaRecibos').innerHTML = '<p class="ayuda">No se pudieron cargar.</p>'; console.error(error); return; }
    const estados = { borrador: 'En preparación', confirmada: 'Recibo emitido', pagada: 'Pagada ✓' };
    el('listaRecibos').innerHTML = data.length ? data.map((l) => `
      <details class="recibo">
        <summary><span>${nombrePeriodo(l.periodo.slice(0, 7))}</span><span><b>${pesos(l.neto)}</b> · ${estados[l.estado] || l.estado}</span></summary>
        <table class="tabla-liq">
          ${(l.renglones || []).map((x) => `<tr><td>${escapar(x.concepto)}<small>${escapar(x.detalle || '')}</small></td><td class="monto${x.importe < 0 ? ' negativo' : ''}">${pesos(x.importe)}</td></tr>`).join('')}
          <tr class="subtotal"><td>Neto a cobrar</td><td class="monto">${pesos(l.neto)}</td></tr>
        </table>
        ${l.neto_letras ? `<p class="ayuda">${escapar(l.neto_letras)}</p>` : ''}
        ${l.pago_fecha ? `<p class="ayuda">Pagado el ${fechaCorta(l.pago_fecha)}${l.pago_medio ? ` por ${l.pago_medio}` : ''}.</p>` : ''}
      </details>`).join('') : '<p class="ayuda">Todavía no hay liquidaciones.</p>';
  }

  // =====================================================================
  // ACUERDOS Y COMUNICACIONES (firma electrónica)
  // =====================================================================
  const ESTADO_AC = { pendiente: 'Pendiente', aceptado: '✓ Firmado', rechazado: '✗ No aceptado', leido: 'Leído' };
  const fechaHora = (ts) => (ts ? new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  function constancia(a, nombre) {
    const lineas = [`Enviado el ${fechaHora(a.creado)}.`];
    if (a.leido_en) lineas.push(`Leído el ${fechaHora(a.leido_en)}.`);
    if (a.estado === 'aceptado') lineas.push(`Firmado electrónicamente por ${nombre} el ${fechaHora(a.respondido_en)}, con su cuenta y confirmación de DNI.`);
    if (a.estado === 'rechazado') lineas.push(`No aceptado el ${fechaHora(a.respondido_en)}${a.observacion ? `. Motivo: "${a.observacion}"` : ''}.`);
    if (a.firma_ip) lineas.push(`IP: ${a.firma_ip}.`);
    if (a.firma_dispositivo) lineas.push(`Dispositivo: ${a.firma_dispositivo}.`);
    lineas.push(`Huella del texto (SHA-256): ${a.huella}`);
    return lineas.map(escapar).join('<br>');
  }

  function plantilla(tipo, e, p) {
    const nombre = `${e.nombre} ${e.apellido}`;
    const dni = e.dni ? `DNI ${e.dni}` : 'DNI [completar]';
    const empleador = p && p.apellido ? `${p.nombre} ${p.apellido}${p.cuil ? ` (CUIL/CUIT ${formatearCuil(p.cuil)})` : ''}` : '[nombre del empleador]';
    const domicilio = p ? (p.trabajo_mismo_domicilio !== false
      ? [p.calle, p.numero, p.piso_depto, p.localidad, p.provincia].filter(Boolean).join(' ')
      : [p.trabajo_calle, p.trabajo_numero, p.trabajo_piso_depto, p.trabajo_localidad, p.trabajo_provincia].filter(Boolean).join(' ')) : '';
    const anio = new Date().getMonth() >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const vac = Liquidacion.diasVacaciones(e.fecha_ingreso, String(anio));
    const NDIAS = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábados', dom: 'domingos' };
    const t = {
      medio_pago: ['Medio de pago del sueldo',
        `Entre ${empleador} (empleador/a) y ${nombre}, ${dni} (trabajador/a), se acuerda que el sueldo y demás pagos se abonarán ` +
        (e.pago_medio_acordado === 'efectivo' ? 'en efectivo, contra la firma del recibo por duplicado'
          : e.pago_medio_acordado === 'transferencia' ? `por transferencia bancaria${e.pago_alias ? ` a la cuenta con alias/CBU ${e.pago_alias}` : ' a la cuenta que indique el/la trabajador/a [completar alias o CBU]'}`
          : 'mediante [completar medio de pago]') +
        `, dentro de los plazos del art. 19 de la Ley 26.844 (personal mensualizado: hasta el cuarto día hábil del mes siguiente). ` +
        'La constancia bancaria será prueba suficiente del pago (art. 20 de la Ley 26.844).'],
      descuento_aporte: ['Descuento del aporte de obra social',
        `${nombre}, ${dni}, presta conformidad para que ${empleador} descuente mensualmente de su remuneración el aporte con destino a su obra social ` +
        'que corresponde al trabajador según el régimen de casas particulares, por el monto fijo que establezca ARCA para su franja horaria. ' +
        'El descuento figurará en cada liquidación y podrá dejarse sin efecto por acuerdo de ambas partes.'],
      vacaciones: [`Vacaciones ${anio}`,
        `Se comunica a ${nombre}, ${dni}, que gozará de sus vacaciones anuales correspondientes al año ${anio} desde el [dd/mm/aaaa] hasta el [dd/mm/aaaa], ` +
        `${vac && vac.dias ? `${vac.dias} días corridos` : '[cantidad] días corridos'} según su antigüedad (art. 29 de la Ley 26.844). ` +
        'La remuneración correspondiente se abonará antes del inicio de las vacaciones (art. 32).'],
      horario: ['Horario de trabajo',
        `Se acuerda que ${nombre}, ${dni}, prestará tareas los días ${(e.dias || []).map((d) => NDIAS[d]).join(', ') || '[completar días]'}` +
        `${e.horas_semanales ? `, ${e.horas_semanales} horas semanales` : ''}, en el horario de [completar] a [completar]` +
        `${domicilio ? `, en el domicilio ${domicilio}` : ''}. Las horas que excedan la jornada pactada se abonarán como horas extra (art. 25 de la Ley 26.844).`],
      preaviso: ['Comunicación de preaviso',
        `Por medio de la presente se comunica a ${nombre}, ${dni}, que la relación laboral finalizará el día [dd/mm/aaaa], ` +
        'otorgándose el preaviso de ley (art. 43 de la Ley 26.844: 10 días si la antigüedad es menor a un año; 30 días si es mayor). ' +
        'La liquidación final se abonará en los plazos legales. La firma de esta comunicación acredita su recepción.'],
      comunicacion: ['', ''],
      otro: ['', `Entre ${empleador} (empleador/a) y ${nombre}, ${dni} (trabajador/a), se acuerda: [completar].`],
    }[tipo];
    return { titulo: t[0], texto: t[1], requiere_firma: tipo !== 'comunicacion' };
  }

  // ---------- Lado del empleador (ficha) ----------
  let perfilEmpleador = null;
  window.cargarAcuerdosFicha = async (e) => {
    el('formAcuerdo').hidden = true;
    el('ayudaAcuerdos').textContent = e.usuario_id
      ? 'Se los envías a su app: los firma con su cuenta y su DNI.'
      : 'Todavía no usa la app: invitalo para que pueda leer y firmar desde su celular.';
    const { data, error } = await db.from('acuerdos').select('*').eq('empleado_id', e.id).order('creado', { ascending: false });
    if (fichaActual !== e) return;
    if (error) { el('listaAcuerdos').innerHTML = '<p class="ayuda">No se pudieron cargar. ¿Corriste el SQL 18?</p>'; console.error(error); return; }
    el('listaAcuerdos').innerHTML = data.length ? data.map((a) => `
      <details class="acuerdo">
        <summary><span>${escapar(a.titulo)}<small>${fechaCorta(a.creado.slice(0, 10))}${a.requiere_firma ? '' : ' · comunicación'}</small></span>
          <span class="chip-acuerdo ${a.estado}">${ESTADO_AC[a.estado]}</span></summary>
        <p class="texto-acuerdo">${escapar(a.texto)}</p>
        <div class="constancia">${constancia(a, `${e.nombre} ${e.apellido}`)}</div>
        <div class="acciones">
          ${a.estado === 'pendiente' ? `<button type="button" class="boton boton-secundario borde" data-avisar-acuerdo="${a.id}">Avisar por WhatsApp</button>` : ''}
          ${a.estado === 'pendiente' && !a.leido_en ? `<button type="button" class="boton boton-secundario borde" data-anular-acuerdo="${a.id}">Anular</button>` : ''}
        </div>
      </details>`).join('') : '<p class="ayuda">Todavía no hay acuerdos ni comunicaciones.</p>';
    el('listaAcuerdos').dataset.titulos = JSON.stringify(Object.fromEntries(data.map((a) => [a.id, a.titulo])));
  };

  el('btnNuevoAcuerdo').addEventListener('click', async () => {
    const f = el('formAcuerdo');
    f.reset();
    limpiarMarcas(f);
    if (!perfilEmpleador) perfilEmpleador = (await db.from('empleadores').select('*').maybeSingle()).data;
    aplicarPlantilla();
    f.hidden = false;
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  function aplicarPlantilla() {
    const f = el('formAcuerdo');
    const p = plantilla(f.elements.tipo.value, fichaActual, perfilEmpleador);
    f.elements.titulo.value = p.titulo;
    f.elements.texto.value = p.texto;
    f.elements.requiere_firma.checked = p.requiere_firma;
  }
  el('formAcuerdo').elements.tipo.addEventListener('change', aplicarPlantilla);
  el('btnCancelarAcuerdo').addEventListener('click', () => { el('formAcuerdo').hidden = true; });

  el('formAcuerdo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target, estado = f.querySelector('.estado');
    const fila = {
      empleado_id: fichaActual.id, tipo: f.elements.tipo.value,
      titulo: f.elements.titulo.value.trim(), texto: f.elements.texto.value.trim(),
      requiere_firma: f.elements.requiere_firma.checked,
    };
    if (!fila.titulo || !fila.texto) { mostrarEstado(estado, 'Completá el título y el texto.', true); return; }
    if (/\[(completar|dd\/mm\/aaaa|cantidad|nombre del empleador)[^\]]*\]/i.test(fila.texto + fila.titulo) &&
        !confirm('El texto todavía tiene partes entre corchetes sin completar. ¿Enviar igual?')) return;
    if (!confirm('Una vez enviado no se puede modificar. ¿Enviar?')) return;
    const { error } = await db.from('acuerdos').insert(fila);
    if (error) { mostrarEstado(estado, 'No se pudo enviar. ¿Corriste el SQL 18?', true); console.error(error); return; }
    f.hidden = true;
    window.cargarAcuerdosFicha(fichaActual);
  });

  el('listaAcuerdos').addEventListener('click', async (ev) => {
    const anular = ev.target.closest('[data-anular-acuerdo]');
    if (anular) {
      if (!confirm('¿Anular este acuerdo? Se borra porque todavía no lo leyó.')) return;
      const { error } = await db.from('acuerdos').delete().eq('id', anular.dataset.anularAcuerdo);
      if (error) { alert('No se pudo anular (quizás ya lo leyó).'); console.error(error); }
      window.cargarAcuerdosFicha(fichaActual);
      return;
    }
    const avisar = ev.target.closest('[data-avisar-acuerdo]');
    if (avisar) {
      const titulos = JSON.parse(el('listaAcuerdos').dataset.titulos || '{}');
      const e = fichaActual;
      const texto = `Hola ${e.nombre}! Te envié "${titulos[avisar.dataset.avisarAcuerdo] || 'un acuerdo'}" para que lo leas y lo firmes en CasaEnRegla, en "Mi trabajo": ${URL_APP}`;
      const tel = (e.telefono || '').replace(/\D/g, '');
      window.open(`https://wa.me/${tel.length === 10 ? '549' + tel : ''}?text=${encodeURIComponent(texto)}`, '_blank');
    }
  });

  // ---------- Lado del empleado (Mi trabajo) ----------
  let acuerdosTrabajo = [];
  async function cargarAcuerdosTrabajo() {
    const { data, error } = await db.rpc('mis_acuerdos', { p_empleado: empleoActual.empleado_id });
    if (error) { el('cajaAcuerdosTrabajo').hidden = true; return; }
    acuerdosTrabajo = data;
    const pendientes = data.filter((a) => a.estado === 'pendiente').length;
    el('cajaAcuerdosTrabajo').hidden = !data.length;
    el('tituloAcuerdosTrabajo').textContent = `Acuerdos y comunicaciones${pendientes ? ` (${pendientes} pendiente${pendientes === 1 ? '' : 's'})` : ''}`;
    const nombre = `${empleoActual.nombre} ${empleoActual.apellido}`;
    el('listaAcuerdosTrabajo').innerHTML = data.map((a) => {
      const firmar = a.estado === 'pendiente' && a.requiere_firma;
      return `<details class="acuerdo${firmar ? ' pendiente-firma' : ''}" data-acuerdo="${a.id}"${firmar ? ' open' : ''}>
        <summary><span>${escapar(a.titulo)}<small>${fechaCorta(a.creado.slice(0, 10))}${a.requiere_firma ? '' : ' · comunicación'}</small></span>
          <span class="chip-acuerdo ${a.estado}">${a.estado === 'pendiente' ? (a.requiere_firma ? 'Para firmar' : 'Nuevo') : ESTADO_AC[a.estado]}</span></summary>
        <p class="texto-acuerdo">${escapar(a.texto)}</p>
        ${firmar ? `<form class="firma" data-firmar="${a.id}" novalidate>
            <label class="opcion"><input type="checkbox" name="leido"> Leí el texto completo</label>
            <label>Tu DNI, para firmar <input name="dni" inputmode="numeric" maxlength="8" autocomplete="off"></label>
            <div class="acciones">
              <button type="submit" class="boton boton-principal">Firmar y aceptar</button>
              <button type="button" class="boton boton-secundario borde" data-rechazar="${a.id}">No acepto</button>
            </div>
            <p class="estado" role="status"></p>
          </form>` : `<div class="constancia">${constancia(a, nombre)}</div>`}
      </details>`;
    }).join('');
    // las comunicaciones abiertas cuentan como leídas
    data.filter((a) => !a.leido_en && a.estado === 'pendiente').forEach((a) => {
      const d = el('listaAcuerdosTrabajo').querySelector(`[data-acuerdo="${a.id}"]`);
      const marcar = () => db.rpc('leer_acuerdo', { p_id: a.id }).then(() => { if (!a.requiere_firma) cargarAcuerdosTrabajo(); });
      if (d.open) marcar(); else d.addEventListener('toggle', () => { if (d.open) marcar(); }, { once: true });
    });
  }

  el('listaAcuerdosTrabajo').addEventListener('submit', async (ev) => {
    const f = ev.target.closest('[data-firmar]');
    if (!f) return;
    ev.preventDefault();
    const estado = f.querySelector('.estado');
    if (!f.elements.leido.checked) { mostrarEstado(estado, 'Tildá "Leí el texto completo".', true); return; }
    if (!/^\d{7,8}$/.test(f.elements.dni.value.trim())) { mostrarEstado(estado, 'Escribí tu DNI (7 u 8 números).', true); return; }
    mostrarEstado(estado, 'Firmando…');
    const { error } = await db.rpc('responder_acuerdo', { p_id: f.dataset.firmar, p_acepta: true, p_dni: f.elements.dni.value.trim() });
    if (error) { mostrarEstado(estado, error.message || 'No se pudo firmar.', true); return; }
    cargarAcuerdosTrabajo();
  });

  el('listaAcuerdosTrabajo').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-rechazar]');
    if (!b) return;
    const motivo = prompt('¿Por qué no lo aceptás? (tu empleador lo va a ver)');
    if (motivo === null) return;
    const { error } = await db.rpc('responder_acuerdo', { p_id: b.dataset.rechazar, p_acepta: false, p_observacion: motivo });
    if (error) { alert(error.message || 'No se pudo guardar.'); return; }
    cargarAcuerdosTrabajo();
  });

  // =====================================================================
  // LADO DEL EMPLEADOR: invitar y ubicación del lugar de trabajo
  // =====================================================================
  window.dibujarVinculo = (e) => {
    const caja = el('vinculoFicha');
    if (e.fecha_egreso) { caja.innerHTML = ''; return; }
    caja.innerHTML = e.usuario_id
      ? '📲 Usa la app: puede marcar su presente, avisar ausencias y ver sus recibos.'
      : `<button type="button" id="btnInvitar" class="boton boton-secundario borde">📲 Invitar a ${escapar(e.nombre)} a la app por WhatsApp</button>`;
  };

  document.addEventListener('click', async (ev) => {
    if (!ev.target.closest('#btnInvitar') || !fichaActual) return;
    const e = fichaActual;
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const codigo = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { error } = await db.from('invitaciones').insert({ codigo, empleado_id: e.id });
    if (error) { alert('No se pudo crear la invitación. ¿Corriste el SQL 17?'); console.error(error); return; }
    const link = `${URL_APP}?invitacion=${codigo}`;
    const texto = `Hola ${e.nombre}! Te invito a CasaEnRegla para que veas tus recibos, marques tu presentismo y me avises tus ausencias.\n\n` +
      `1. Entrá a este link: ${link}\n2. Creá tu cuenta con tu email.\n3. Confirmá con tu DNI.\n\nEl link vence en 14 días.`;
    const tel = (e.telefono || '').replace(/\D/g, '');
    window.open(`https://wa.me/${tel.length === 10 ? '549' + tel : ''}?text=${encodeURIComponent(texto)}`, '_blank');
  });

  el('btnUbicacionTrabajo').addEventListener('click', () => {
    const estado = el('estadoUbicacion');
    if (!navigator.geolocation) { estado.textContent = 'Este dispositivo no permite obtener la ubicación.'; return; }
    estado.textContent = 'Obteniendo tu ubicación…';
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { data: { user } } = await db.auth.getUser();
      const { error } = await db.from('empleadores').upsert({ id: user.id, trabajo_lat: p.coords.latitude, trabajo_lng: p.coords.longitude });
      estado.textContent = error ? 'No se pudo guardar. ¿Corriste el SQL 17?' : `✓ Ubicación guardada (precisión ±${Math.round(p.coords.accuracy)} m).`;
      if (error) console.error(error);
    }, () => { estado.textContent = 'No se pudo obtener la ubicación: permití el acceso en tu celular o navegador.'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
})();
