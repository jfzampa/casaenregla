// ===== CasaEnRegla — motor de liquidación mensual =====
// Funciones puras (no tocan la pantalla ni la base): reciben datos y devuelven el detalle.
// Reglas: ver CLAUDE.md > "Reglas de liquidación".

(function (global) {
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const fmt = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const DIA_SEMANA = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };

  const ZONA_PROVINCIAS = ['La Pampa', 'Río Negro', 'Chubut', 'Neuquén', 'Santa Cruz', 'Tierra del Fuego'];

  // ¿El lugar de trabajo está en zona desfavorable?
  function esZonaDesfavorable(provincia, localidad) {
    if (ZONA_PROVINCIAS.includes(provincia)) return true;
    return provincia === 'Buenos Aires' && /patagones/i.test(localidad || '');
  }

  // Cantidad de días de trabajo (según los días de la semana elegidos) en un mes "aaaa-mm"
  function diasDeTrabajoEnMes(periodo, dias) {
    const [a, m] = periodo.split('-').map(Number);
    const elegidos = new Set((dias || []).map((d) => DIA_SEMANA[d]));
    const ultimo = new Date(a, m, 0).getDate();
    let n = 0;
    for (let d = 1; d <= ultimo; d++) if (elegidos.has(new Date(a, m - 1, d).getDay())) n++;
    return n;
  }

  // Años completos de antigüedad al último día del período, contando desde "desde" (aaaa-mm-dd)
  function aniosAntiguedad(fechaIngreso, periodo, desde) {
    if (!fechaIngreso) return 0;
    const inicio = fechaIngreso > desde ? fechaIngreso : desde;
    const [a, m] = periodo.split('-').map(Number);
    const fin = new Date(a, m, 0); // último día del mes
    const [ai, mi, di] = inicio.split('-').map(Number);
    let anios = fin.getFullYear() - ai;
    if (fin.getMonth() + 1 < mi || (fin.getMonth() + 1 === mi && fin.getDate() < di)) anios--;
    return Math.max(0, anios);
  }

  function edadAl(fechaNac, periodo) {
    if (!fechaNac) return null;
    return aniosAntiguedad(fechaNac, periodo, '0000-01-01');
  }

  const franjaHoras = (h) => (h < 12 ? 'menos_12' : h < 16 ? '12_a_16' : '16_o_mas');

  /**
   * Calcula la liquidación.
   * @param {object} p
   *   empleado:  ficha (horas_semanales, dias, fecha_ingreso, fecha_nacimiento, es_jubilado, descuenta_aporte)
   *   periodo:   "aaaa-mm"
   *   escala:    { valor_hora, valor_mensual }
   *   param:     { zona_desfavorable_pct, antiguedad_pct_anual, antiguedad_desde (aaaa-mm-dd), horas_mensualizado }
   *   zona:      boolean (lugar de trabajo en zona desfavorable)
   *   aportes:   lista de filas de aportes_arca vigentes para el período (o [])
   *   novedades: { faltas_dias, horas_extra_50, horas_extra_100, horas_feriado, otros: [{descripcion, importe, tipo:'rem'|'norem'}] }
   */
  function calcular({ empleado, periodo, escala, param, zona, aportes = [], novedades = {} }) {
    const avisos = [];
    const renglones = [];
    const add = (concepto, detalle, importe, tipo) => {
      importe = r2(importe);
      if (importe !== 0) renglones.push({ concepto, detalle, importe, tipo });
    };

    const horasSem = Number(empleado.horas_semanales) || 0;
    const valorHora = Number(escala.valor_hora);
    const valorMensual = Number(escala.valor_mensual);
    const mensualizado = horasSem >= Number(param.horas_mensualizado || 24);
    const diasSemana = (empleado.dias || []).length;
    const faltas = Number(novedades.faltas_dias) || 0;

    if (!horasSem) avisos.push('Falta cargar las horas semanales en la ficha del empleado.');

    // ---- Sueldo básico ----
    let basico = 0;
    let horasLiquidadas = null;
    if (mensualizado) {
      const h = Math.min(horasSem, 48);
      basico = valorMensual * h / 48;
      add('Sueldo básico', `Mensual $${fmt(valorMensual)} × ${h} hs ÷ 48`, basico, 'rem');
    } else if (horasSem) {
      if (!diasSemana) avisos.push('Para calcular por hora hacen falta los días de trabajo en la ficha del empleado.');
      const diasMes = diasDeTrabajoEnMes(periodo, empleado.dias);
      const horasDia = diasSemana ? horasSem / diasSemana : 0;
      const horas = r2(diasMes * horasDia);
      horasLiquidadas = horas;
      basico = horas * valorHora;
      add('Horas trabajadas', `${diasMes} días × ${fmt(horasDia)} hs = ${fmt(horas)} hs × $${fmt(valorHora)}`, basico, 'rem');
    }

    // ---- Antigüedad (1% por año) ----
    const desde = param.antiguedad_desde || '2020-09-01';
    const anios = aniosAntiguedad(empleado.fecha_ingreso, periodo, desde);
    const pctAnt = anios * Number(param.antiguedad_pct_anual || 0);
    const antiguedad = basico * pctAnt / 100;
    add('Antigüedad', `${anios} año${anios === 1 ? '' : 's'} × ${fmt(param.antiguedad_pct_anual)}% = ${fmt(pctAnt)}% s/ básico`, antiguedad, 'rem');

    // ---- Zona desfavorable ----
    const pctZona = zona ? Number(param.zona_desfavorable_pct || 0) : 0;
    const adicZona = basico * pctZona / 100;
    add('Zona desfavorable', `${fmt(pctZona)}% s/ básico`, adicZona, 'rem');

    // ---- Faltas injustificadas ----
    if (faltas) {
      if (mensualizado) {
        const base = basico + antiguedad + adicZona;
        add('Faltas injustificadas', `$${fmt(base)} ÷ 30 × ${faltas} día${faltas === 1 ? '' : 's'}`, -(base / 30 * faltas), 'rem');
      } else {
        const horasDia = diasSemana ? horasSem / diasSemana : 0;
        const horasF = r2(faltas * horasDia);
        const base = valorHora * (1 + (pctAnt + pctZona) / 100);
        add('Faltas injustificadas', `${faltas} día${faltas === 1 ? '' : 's'} × ${fmt(horasDia)} hs = ${fmt(horasF)} hs × $${fmt(base)}`, -(horasF * base), 'rem');
      }
    }

    // ---- Horas extra y feriados trabajados (sobre el valor hora de la escala) ----
    const h50 = Number(novedades.horas_extra_50) || 0;
    const h100 = Number(novedades.horas_extra_100) || 0;
    const hFer = Number(novedades.horas_feriado) || 0;
    add('Horas extra al 50%', `${fmt(h50)} hs × $${fmt(valorHora)} × 1,5`, h50 * valorHora * 1.5, 'rem');
    add('Horas extra al 100%', `${fmt(h100)} hs × $${fmt(valorHora)} × 2`, h100 * valorHora * 2, 'rem');
    add('Recargo feriado trabajado', `${fmt(hFer)} hs × $${fmt(valorHora)} (100% adicional; el día ya está pago)`, hFer * valorHora, 'rem');

    // ---- Aguinaldo (SAC), solo si se pidió (junio / diciembre) ----
    let sac = null;
    if (novedades.sac && novedades.sac.incluir && Number(novedades.sac.mejor_remuneracion) > 0) {
      sac = calcularSac({ periodo, fechaIngreso: empleado.fecha_ingreso, mejorRemuneracion: novedades.sac.mejor_remuneracion });
      add(`Aguinaldo (SAC) ${sac.semestre === 1 ? '1er' : '2do'} semestre ${periodo.slice(0, 4)}`, sac.detalle, sac.importe, 'rem');
    }

    // ---- Otros conceptos ----
    for (const o of novedades.otros || []) {
      const imp = Number(o.importe) || 0;
      if (!o.descripcion || !imp) continue;
      add(o.descripcion, o.tipo === 'norem' ? 'No remunerativo' : 'Remunerativo', imp, o.tipo === 'norem' ? 'norem' : 'rem');
    }

    // ---- Aportes ARCA ----
    const edad = edadAl(empleado.fecha_nacimiento, periodo);
    const tipo = empleado.es_jubilado ? 'jubilado' : (edad !== null && edad < 18 ? 'menor' : 'activo');
    const franja = franjaHoras(horasSem);
    const fila = aportes.find((a) => a.tipo === tipo && a.franja === franja);
    let pagoArca = 0;
    let aporteRetenido = 0;
    let arca = null;
    if (fila) {
      arca = { tipo, franja, aporte_os: Number(fila.aporte_os), contribucion_sipa: Number(fila.contribucion_sipa), cuota_art: Number(fila.cuota_art) };
      pagoArca = r2(arca.aporte_os + arca.contribucion_sipa + arca.cuota_art);
      if (empleado.descuenta_aporte && arca.aporte_os) {
        add('Aporte obra social', 'Descuento acordado con el empleado (monto fijo ARCA)', -arca.aporte_os, 'desc');
        aporteRetenido = arca.aporte_os;
      }
    } else {
      avisos.push('No hay montos de aportes de ARCA cargados para este período.');
    }

    const suma = (t) => r2(renglones.filter((x) => x.tipo === t).reduce((s, x) => s + x.importe, 0));
    const totalRem = suma('rem');
    const totalNoRem = suma('norem');
    const totalDesc = -suma('desc');
    const neto = r2(totalRem + totalNoRem - totalDesc);
    // Costo total del empleador = lo que sale de su bolsillo: neto al empleado + VEP a ARCA
    // (= asignaciones + aportes y contribuciones a su cargo; el aporte retenido al empleado no se cuenta dos veces)
    const cargasEmpleador = r2(pagoArca - aporteRetenido);
    const costoTotal = r2(totalRem + totalNoRem + cargasEmpleador);

    return {
      modalidad_liquidacion: mensualizado ? 'mensual' : 'por_hora',
      anios_antiguedad: anios,
      horas_liquidadas: horasLiquidadas,
      valor_hora: valorHora,
      renglones, avisos, arca,
      total_remunerativo: totalRem,
      total_no_remun: totalNoRem,
      total_descuentos: totalDesc,
      neto,
      neto_letras: numeroALetras(neto),
      sac,
      sac_importe: sac ? sac.importe : 0,
      pago_arca: pagoArca,
      cargas_empleador: cargasEmpleador,
      costo_total: costoTotal,
    };
  }

  // ===== Aguinaldo (SAC) — art. 26 Ley 26.844 =====
  // 50% de la mayor remuneración mensual (remunerativa) del semestre; proporcional si no trabajó todo el semestre.
  const diasEntre = (a, b) => Math.round((Date.UTC(...b.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) -
    Date.UTC(...a.split('-').map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000) + 1;

  function calcularSac({ periodo, fechaIngreso, mejorRemuneracion }) {
    const [a, m] = periodo.split('-').map(Number);
    const semestre = m <= 6 ? 1 : 2;
    const inicio = semestre === 1 ? `${a}-01-01` : `${a}-07-01`;
    const fin = semestre === 1 ? `${a}-06-30` : `${a}-12-31`;
    const desde = fechaIngreso && fechaIngreso > inicio ? fechaIngreso : inicio;
    const diasSemestre = diasEntre(inicio, fin);
    const dias = desde > fin ? 0 : diasEntre(desde, fin);
    const base = Number(mejorRemuneracion) || 0;
    const completo = dias === diasSemestre;
    const importe = r2(base / 2 * dias / diasSemestre);
    const detalle = completo
      ? `50% de la mayor remuneración del semestre ($${fmt(base)})`
      : `$${fmt(base)} ÷ 2 × ${dias} días trabajados ÷ ${diasSemestre} días del semestre`;
    return { semestre, inicio, fin, dias, diasSemestre, completo, importe, detalle };
  }

  // ===== Número a letras (pesos) — para el neto del recibo =====
  const U = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
    'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés',
    'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function cientos(n) {
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), resto = n % 100;
    let t = C[c];
    if (resto) {
      const dec = resto < 30 ? U[resto] : D[Math.floor(resto / 10)] + (resto % 10 ? ' y ' + U[resto % 10] : '');
      t = (t ? t + ' ' : '') + dec;
    }
    return t;
  }

  function enteroALetras(n) {
    if (n === 0) return 'cero';
    const partes = [];
    const millones = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    if (millones) partes.push(millones === 1 ? 'un millón' : enteroALetras(millones) + ' millones');
    if (miles) partes.push(miles === 1 ? 'mil' : cientos(miles) + ' mil');
    if (resto) partes.push(cientos(resto));
    return partes.join(' ');
  }

  function numeroALetras(monto) {
    const negativo = monto < 0;
    const total = Math.round(Math.abs(monto) * 100);
    const enteros = Math.floor(total / 100), centavos = total % 100;
    const de = enteros && enteros % 1e6 === 0 ? 'de ' : ''; // "un millón de pesos"
    let t = `${enteroALetras(enteros)} ${de}${enteros === 1 ? 'peso' : 'pesos'}`;
    t += ` con ${String(centavos).padStart(2, '0')}/100`;
    t = t.replace(/^un pesos/, 'un peso');
    return (negativo ? 'menos ' : '') + t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ===== Lectura de documentos de ARCA (a partir del texto del PDF) =====
  const importeAR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Agrupa conceptos parecidos para poder comparar el recibo de ARCA con la liquidación
  function claveConcepto(nombre) {
    const n = sinAcentos(nombre);
    if (/basico|sueldo|horas trabajadas|remuneracion/.test(n)) return 'basico';
    if (/antig/.test(n)) return 'antiguedad';
    if (/zona/.test(n)) return 'zona';
    if (/extra/.test(n) && /100/.test(n)) return 'extra100';
    if (/extra/.test(n)) return 'extra50';
    if (/feriado/.test(n)) return 'feriado';
    if (/falta|inasist|ausen/.test(n)) return 'faltas';
    if (/aguinaldo|sac/.test(n)) return 'sac';
    if (/vacacion/.test(n)) return 'vacaciones';
    return n.replace(/[^a-z0-9]/g, '');
  }

  // Recibo de sueldo de ARCA (Registro de Casas Particulares)
  function analizarReciboArca(texto) {
    const t = String(texto).replace(/\s+/g, ' ');
    const res = { periodo: null, cuiles: [], conceptos: [], total: null };

    const mp = /PER[IÍ]ODO:?\s*([A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d{4})/i.exec(t);
    if (mp) {
      const m = MESES.indexOf(sinAcentos(mp[1]));
      if (m >= 0) res.periodo = `${mp[2]}-${String(m + 1).padStart(2, '0')}`;
    }
    res.cuiles = [...new Set([...t.matchAll(/\b(\d{2})-?(\d{8})-?(\d)\b/g)].map((m) => m[1] + m[2] + m[3]))];

    const mt = /\bTotal\s*\$\s*([\d.]+,\d{2})/i.exec(t) || /neto[^0-9]{0,60}?([\d.]{1,12},\d{2})/i.exec(t);
    if (mt) res.total = importeAR(mt[1]);

    // Conceptos: entre "Detalle de la Remuneración" y el primer "Total $"
    const ini = t.search(/Detalle de la Remuneraci[oó]n/i);
    if (ini >= 0) {
      const resto = t.slice(ini).replace(/^Detalle de la Remuneraci[oó]n/i, '');
      const fin = resto.search(/\bTotal\s*\$/i);
      const tramo = fin >= 0 ? resto.slice(0, fin) : resto;
      for (const m of tramo.matchAll(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ°º%().\/ ]{3,}?)\s*\$\s*(-?[\d.]+,\d{2})/g)) {
        res.conceptos.push({ nombre: m[1].trim(), importe: importeAR(m[2]) });
      }
    }
    return res;
  }

  // Comprobante de pago de VEP (aportes, contribuciones y ART)
  function analizarVep(texto) {
    const t = String(texto).replace(/\s+/g, ' ');
    const busca = (re) => { const m = re.exec(t); return m ? m : null; };
    const nro = busca(/Nro\.?\s*(?:de\s*)?VEP:?\s*(\d+)/i);
    const per = busca(/Per[ií]odo:?\s*(\d{4})(\d{2})/i);
    const imp = busca(/IMPORTE PAGADO:?\s*\$?\s*([\d.]+,\d{2})/i) || busca(/Aportes,? Contrib\.? y ART[^$]{0,20}\$\s*([\d.]+,\d{2})/i);
    const fec = busca(/Fecha de Pago:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    const trx = busca(/Nro\.?\s*de\s*Transacci[oó]n:?\s*(\d+)/i);
    return {
      numero: nro ? nro[1] : null,
      periodo: per ? `${per[1]}-${per[2]}` : null,
      importe: imp ? importeAR(imp[1]) : null,
      fecha: fec ? `${fec[3]}-${fec[2].padStart(2, '0')}-${fec[1].padStart(2, '0')}` : null,
      transaccion: trx ? trx[1] : null,
    };
  }

  // PDF mensual de ARCA "Casas particulares - aportes y contribuciones".
  // El texto sale con las columnas mezcladas, así que se reconstruye con aritmética:
  // en cada renglón total = obra social + SIPA + ART, y cada columna crece con las horas.
  function analizarAportesArca(texto) {
    const t = String(texto).replace(/\s+/g, ' ');
    const res = { periodo: null, filas: [], problemas: [] };
    const mp = /vigentes para\s+([a-záéíóú]+)\s+(\d{4})/i.exec(t);
    if (mp) {
      const m = MESES.indexOf(sinAcentos(mp[1]));
      if (m >= 0) res.periodo = `${mp[2]}-${String(m + 1).padStart(2, '0')}`;
    }
    const cortes = [
      ['activo', t.search(/trabajador activo/i)],
      ['menor', t.search(/Menor de 18/i)],
      ['jubilado', t.search(/trabajador jubilado/i)],
    ];
    if (cortes.some(([, p]) => p < 0)) { res.problemas.push('No encontré los tres bloques (activo, menor, jubilado).'); return res; }
    const FRANJAS = ['menos_12', '12_a_16', '16_o_mas'];
    const cerca = (a, b) => Math.abs(a - b) < 0.02;
    const candidatos = {}; // tipo -> lista de soluciones [r1, r2, r3]

    cortes.forEach(([tipo, ini], k) => {
      const fin = k < 2 ? cortes[k + 1][1] : t.length;
      const vals = [...t.slice(ini, fin).matchAll(/\$\s*(-|[\d.]+,\d{2})/g)].map((m) => (m[1] === '-' ? 0 : importeAR(m[1])));
      if (vals.length !== 12) { res.problemas.push(`${tipo}: esperaba 12 importes y encontré ${vals.length}.`); return; }
      // El primer renglón (menos de 12) viene en orden: total, obra social, SIPA, ART
      const r1 = vals.slice(0, 4);
      if (!cerca(r1[0], r1[1] + r1[2] + r1[3])) { res.problemas.push(`${tipo}: el primer renglón no suma.`); return; }
      // Los otros 8 importes: probar todas las combinaciones posibles
      const resto = vals.slice(4);
      const soluciones = new Map();
      const usado = Array(8).fill(false);
      const sel = [];
      (function probar() {
        if (sel.length === 8) {
          const r2 = sel.slice(0, 4).map((i) => resto[i]), r3 = sel.slice(4).map((i) => resto[i]);
          if (!cerca(r2[0], r2[1] + r2[2] + r2[3]) || !cerca(r3[0], r3[1] + r3[2] + r3[3])) return;
          for (let c = 0; c < 4; c++) if (!(r1[c] <= r2[c] && r2[c] <= r3[c])) return;
          soluciones.set(JSON.stringify([r2, r3]), [r2, r3]);
          return;
        }
        for (let i = 0; i < 8; i++) {
          if (usado[i]) continue;
          usado[i] = true; sel.push(i); probar(); sel.pop(); usado[i] = false;
        }
      })();
      if (!soluciones.size) { res.problemas.push(`${tipo}: los importes no cierran (total ≠ obra social + SIPA + ART).`); return; }
      candidatos[tipo] = [...soluciones.values()].map(([r2, r3]) => [r1, r2, r3]);
    });
    if (res.problemas.length) return res;

    // Cruce entre bloques: la ART es igual para todos; obra social activo = menor; SIPA activo = jubilado
    const validas = [];
    for (const a of candidatos.activo) for (const m of candidatos.menor) for (const j of candidatos.jubilado) {
      let ok = true;
      for (let f = 0; f < 3 && ok; f++) {
        ok = cerca(a[f][3], m[f][3]) && cerca(a[f][3], j[f][3]) && cerca(a[f][1], m[f][1]) && cerca(a[f][2], j[f][2]);
      }
      if (ok) validas.push({ activo: a, menor: m, jubilado: j });
    }
    if (validas.length !== 1) { res.problemas.push(`No pude ordenar los importes con certeza (${validas.length} opciones): cargalos a mano.`); return res; }
    for (const tipo of ['activo', 'menor', 'jubilado']) {
      validas[0][tipo].forEach((r, i) => res.filas.push({ tipo, franja: FRANJAS[i], total: r[0], aporte_os: r[1], contribucion_sipa: r[2], cuota_art: r[3] }));
    }
    return res;
  }

  // ===== Escalas: leer una tabla copiada de UPACP y controlarla =====
  const CLAVES_ESCALA = [];
  for (let c = 1; c <= 5; c++) for (const m of ['con_retiro', 'sin_retiro']) CLAVES_ESCALA.push([c, m]);

  // Texto copiado de la página de UPACP → filas {categoria, modalidad, valor_hora, valor_mensual}
  function analizarTextoEscala(texto) {
    const t = String(texto).replace(/\s+/g, ' ');
    const res = { vigencia: null, filas: [], problemas: [] };
    const mv = /PARTIR DEL\s*1\s*[°º]?\s*DE\s*([a-záéíóú]+)\s*(?:DE\s*)?(\d{4})/i.exec(t);
    if (mv) {
      const m = MESES.indexOf(sinAcentos(mv[1]));
      if (m >= 0) res.vigencia = `${mv[2]}-${String(m + 1).padStart(2, '0')}-01`;
    }
    const ini = t.search(/PRIMERA\s+CATEGOR/i);
    const tramo = (ini >= 0 ? t.slice(ini) : t).split(/El personal que efect|ADICIONAL/i)[0];
    const montos = [...tramo.matchAll(/\$\s*(\d[\d.]*(?:,\d{1,2})?)/g)].map((m) => importeAR(m[1]));
    // Caseros (3ª) tiene un solo par (hora, mensual): 18 importes en total
    if (montos.length === 18) montos.splice(10, 0, montos[8], montos[9]);
    if (montos.length !== 20) { res.problemas.push(`Esperaba 18 o 20 importes y encontré ${montos.length}.`); return res; }
    CLAVES_ESCALA.forEach(([categoria, modalidad], i) => {
      res.filas.push({ categoria, modalidad, valor_hora: montos[i * 2], valor_mensual: montos[i * 2 + 1] });
    });
    return res;
  }

  // Controles automáticos de una vigencia (10 filas). "anterior": filas de la vigencia previa (o null)
  function controlarEscala(filas, anterior) {
    const avisos = [];
    const v = (c, m) => filas.find((f) => f.categoria === c && f.modalidad === m);
    const nom = (c, m) => `${c}ª ${m === 'con_retiro' ? 'con' : 'sin'} retiro`;
    for (const [c, m] of CLAVES_ESCALA) {
      const f = v(c, m);
      if (!f || !(f.valor_hora > 0) || !(f.valor_mensual > 0)) { avisos.push(`Falta o está en cero: ${nom(c, m)}.`); continue; }
      const ratio = f.valor_mensual / f.valor_hora;
      if (ratio < 110 || ratio > 140) avisos.push(`${nom(c, m)}: el mensual equivale a ${Math.round(ratio)} horas (lo normal es ~120-130). ¿Hora o mensual mal tipeado?`);
      if (anterior) {
        const a = anterior.find((x) => x.categoria === c && x.modalidad === m);
        if (a) {
          for (const campo of ['valor_hora', 'valor_mensual']) {
            const pct = (f[campo] / a[campo] - 1) * 100;
            if (pct < 0) avisos.push(`${nom(c, m)}: el ${campo === 'valor_hora' ? 'valor hora' : 'mensual'} BAJA ${pct.toFixed(1)}% respecto de la vigencia anterior.`);
            else if (pct > 30) avisos.push(`${nom(c, m)}: el ${campo === 'valor_hora' ? 'valor hora' : 'mensual'} sube ${pct.toFixed(1)}% (más de 30%).`);
          }
        }
      }
    }
    if (avisos.length) return avisos;
    const igual = (a, b, campo) => Math.abs(a[campo] - b[campo]) < 0.005;
    const iguales = (a, b) => igual(a, b, 'valor_hora') && igual(a, b, 'valor_mensual');
    if (!iguales(v(3, 'con_retiro'), v(3, 'sin_retiro'))) avisos.push('Caseros (3ª) debería ser igual con y sin retiro.');
    if (!iguales(v(3, 'con_retiro'), v(4, 'con_retiro'))) avisos.push('Habitualmente 4ª con retiro = 3ª (caseros). Revisá.');
    if (!iguales(v(5, 'sin_retiro'), v(3, 'con_retiro'))) avisos.push('Habitualmente 5ª sin retiro = 3ª (caseros). Revisá.');
    for (const c of [1, 2, 4, 5]) {
      if (v(c, 'sin_retiro').valor_hora <= v(c, 'con_retiro').valor_hora) avisos.push(`${c}ª: el valor sin retiro debería ser mayor que con retiro.`);
    }
    return avisos;
  }

  const api = {
    calcular, calcularSac, esZonaDesfavorable, diasDeTrabajoEnMes, aniosAntiguedad, numeroALetras, franjaHoras,
    analizarReciboArca, analizarVep, claveConcepto, analizarAportesArca,
    analizarTextoEscala, controlarEscala,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Liquidacion = api;
})(typeof window !== 'undefined' ? window : globalThis);
