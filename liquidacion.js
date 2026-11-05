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
    let arca = null;
    if (fila) {
      arca = { tipo, franja, aporte_os: Number(fila.aporte_os), contribucion_sipa: Number(fila.contribucion_sipa), cuota_art: Number(fila.cuota_art) };
      pagoArca = r2(arca.aporte_os + arca.contribucion_sipa + arca.cuota_art);
      if (empleado.descuenta_aporte && arca.aporte_os) {
        add('Aporte obra social', 'Descuento acordado con el empleado (monto fijo ARCA)', -arca.aporte_os, 'desc');
      }
    } else {
      avisos.push('No hay montos de aportes de ARCA cargados para este período.');
    }

    const suma = (t) => r2(renglones.filter((x) => x.tipo === t).reduce((s, x) => s + x.importe, 0));
    const totalRem = suma('rem');
    const totalNoRem = suma('norem');
    const totalDesc = -suma('desc');
    const neto = r2(totalRem + totalNoRem - totalDesc);

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
      pago_arca: pagoArca,
    };
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

  const api = {
    calcular, esZonaDesfavorable, diasDeTrabajoEnMes, aniosAntiguedad, numeroALetras, franjaHoras,
    analizarReciboArca, analizarVep, claveConcepto,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Liquidacion = api;
})(typeof window !== 'undefined' ? window : globalThis);
