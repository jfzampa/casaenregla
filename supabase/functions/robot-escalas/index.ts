// CasaEnRegla — Edge Function "robot-escalas"
// Revisa UPACP (escala vigente) y ARCA (PDF mensual de aportes) y deja HALLAZGOS pendientes.
// Nunca modifica las tablas oficiales (escalas, aportes_arca): eso lo aprueba el admin desde la app.
//
// La llaman: (1) el cron diario, con el encabezado x-robot = ROBOT_SECRETO;
//            (2) el admin desde la app ("Revisar ahora"), con su sesión.
// Configuración en Supabase: Secrets → ROBOT_SECRETO. "Verify JWT" desactivado (la función valida sola).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-robot',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- Lectura de la escala de UPACP (misma lógica que liquidacion.js) ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const importeAR = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.'));

function htmlATexto(h: string) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&deg;|&#176;/g, '°')
    .replace(/&#8211;/g, '-').replace(/\s+/g, ' ');
}

function analizarTextoEscala(texto: string) {
  const t = texto.replace(/\s+/g, ' ');
  const res: { vigencia: string | null; filas: any[]; problemas: string[] } = { vigencia: null, filas: [], problemas: [] };
  const ini = t.search(/PRIMERA\s+CATEGOR/i);
  const previo = t.slice(Math.max(0, ini - 600), Math.max(0, ini));
  const mv = /PARTIR DEL\s*1\s*[°º]?\s*DE\s*([a-záéíóú]+)\s*(?:DE\s*)?(\d{4})/i.exec(previo) || /PARTIR DEL\s*1\s*[°º]?\s*DE\s*([a-záéíóú]+)\s*(?:DE\s*)?(\d{4})/i.exec(t);
  if (mv) {
    const m = MESES.indexOf(sinAcentos(mv[1]));
    if (m >= 0) res.vigencia = `${mv[2]}-${String(m + 1).padStart(2, '0')}-01`;
  }
  const tramo = (ini >= 0 ? t.slice(ini) : t).split(/El personal que efect|ADICIONAL/i)[0];
  const montos = [...tramo.matchAll(/\$\s*(\d[\d.]*(?:,\d{1,2})?)/g)].map((m) => importeAR(m[1]));
  if (montos.length === 18) montos.splice(10, 0, montos[8], montos[9]);
  if (montos.length !== 20) { res.problemas.push(`Esperaba 18 o 20 importes y encontré ${montos.length}.`); return res; }
  let i = 0;
  for (let c = 1; c <= 5; c++) for (const modalidad of ['con_retiro', 'sin_retiro']) {
    res.filas.push({ categoria: c, modalidad, valor_hora: montos[i * 2], valor_mensual: montos[i * 2 + 1] });
    i++;
  }
  const mr = /Resoluci[oó]n\s*(?:CNTCP)?\s*N?[°º]?\s*(\d+\s*\/\s*\d{2,4})/i.exec(t);
  return { ...res, resolucion: mr ? `CNTCP ${mr[1].replace(/\s/g, '')}` : null };
}

const urlPdfArca = (mes: string) => {
  const [a, m] = mes.split('-');
  return `https://www.afip.gob.ar/casasparticulares/aportes-contribuciones-ART/documentos/${a}/Casas-particulares-aportes-y-contribuciones-${m}-${a.slice(2)}.pdf`;
};
const mesMas = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // ---- ¿Quién llama? cron (secreto) o un admin logueado ----
  const secreto = Deno.env.get('ROBOT_SECRETO');
  let autorizado = !!secreto && req.headers.get('x-robot') === secreto;
  if (!autorizado) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (data.user) {
      const { data: adm } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      autorizado = !!adm;
    }
  }
  if (!autorizado) return responder({ error: 'No autorizado' }, 401);

  const informe: string[] = [];
  const nuevo = async (tipo: string, clave: string, datos: unknown) => {
    const { data } = await db.from('robot_hallazgos').upsert({ tipo, clave, datos }, { onConflict: 'clave', ignoreDuplicates: true }).select('id');
    return !!(data && data.length);
  };

  // ---- 1) Escala vigente en UPACP ----
  try {
    const html = await (await fetch('https://upacp.org.ar/sueldos/', { headers: { 'user-agent': 'Mozilla/5.0 (CasaEnRegla robot)' } })).text();
    const r = analizarTextoEscala(htmlATexto(html));
    if (r.problemas.length || !r.vigencia) {
      informe.push(`UPACP: no pude leer la escala (${r.problemas.join(' ') || 'sin fecha de vigencia'}).`);
    } else {
      const { data: actual } = await db.from('escalas').select('categoria, modalidad, valor_hora, valor_mensual').eq('vigencia_desde', r.vigencia);
      if (!actual || !actual.length) {
        const fue = await nuevo('escala', `escala:${r.vigencia}`, { vigencia: r.vigencia, filas: r.filas, resolucion: r.resolucion, fuente: 'https://upacp.org.ar/sueldos/' });
        informe.push(`UPACP: escala nueva vigente desde ${r.vigencia}${fue ? ' → hallazgo creado' : ' (ya avisada)'}.`);
      } else {
        const distintas = r.filas.filter((f: any) => {
          const a = actual.find((x: any) => x.categoria === f.categoria && x.modalidad === f.modalidad);
          return !a || Math.abs(Number(a.valor_hora) - f.valor_hora) > 0.005 || Math.abs(Number(a.valor_mensual) - f.valor_mensual) > 0.005;
        });
        if (distintas.length) {
          const huella = distintas.map((f: any) => `${f.categoria}${f.modalidad}${f.valor_hora}${f.valor_mensual}`).join('|');
          const fue = await nuevo('escala_diferente', `escala_dif:${r.vigencia}:${huella}`, { vigencia: r.vigencia, filas: r.filas, distintas, resolucion: r.resolucion, fuente: 'https://upacp.org.ar/sueldos/' });
          informe.push(`UPACP: la escala ${r.vigencia} publicada difiere de la cargada en ${distintas.length} valor(es)${fue ? ' → hallazgo creado' : ''}.`);
        } else informe.push(`UPACP: la escala vigente (${r.vigencia}) ya está cargada y coincide.`);
      }
    }
  } catch (e) { informe.push(`UPACP: error al consultar (${(e as Error).message}).`); }

  // ---- 2) PDF de aportes de ARCA (mes actual y siguiente) ----
  const hoy = new Date().toLocaleDateString('sv', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7);
  for (const mes of [hoy, mesMas(hoy, 1)]) {
    try {
      const { data: hay } = await db.from('aportes_arca').select('id').eq('periodo_desde', `${mes}-01`).limit(1);
      if (hay && hay.length) { informe.push(`ARCA ${mes}: aportes ya cargados.`); continue; }
      const resp = await fetch(urlPdfArca(mes), { headers: { 'user-agent': 'Mozilla/5.0 (CasaEnRegla robot)' } });
      const esPdf = resp.ok && (resp.headers.get('content-type') || '').includes('pdf');
      await resp.body?.cancel();
      if (esPdf) {
        const fue = await nuevo('aportes', `aportes:${mes}`, { periodo: mes, url: urlPdfArca(mes) });
        informe.push(`ARCA ${mes}: PDF de aportes publicado${fue ? ' → hallazgo creado' : ' (ya avisado)'}.`);
      } else informe.push(`ARCA ${mes}: todavía no publicado.`);
    } catch (e) { informe.push(`ARCA ${mes}: error al consultar (${(e as Error).message}).`); }
  }

  const texto = informe.join('\n');
  await db.from('robot_ejecuciones').insert({ informe: texto });
  return responder({ informe });
});
