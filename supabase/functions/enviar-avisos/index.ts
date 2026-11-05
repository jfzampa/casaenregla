// CasaEnRegla — Edge Function "enviar-avisos": notificaciones al celular (Web Push)
// Una vez por día (cron) arma, para cada usuario con dispositivos suscriptos, un resumen de lo urgente
// (mismo motor de avisos que la app) y se lo envía. Desde la app, el usuario puede pedir una de prueba.
//
// Secrets necesarios: ROBOT_SECRETO, VAPID_PUBLICA, VAPID_PRIVADA (y opcional VAPID_CONTACTO = mailto:...).
// "Verify JWT" desactivado (la función valida sola).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-robot',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const URL_APP = 'https://jfzampa.github.io/casaenregla/';

// El motor de avisos es el mismo archivo que usa la app (liquidacion.js, publicado en GitHub Pages)
let motor: any = null;
async function cargarMotor() {
  if (motor) return motor;
  const codigo = await (await fetch(`${URL_APP}liquidacion.js`)).text();
  new Function(codigo)();
  motor = (globalThis as any).Liquidacion;
  return motor;
}

const hoyAR = () => new Date().toLocaleDateString('sv', { timeZone: 'America/Argentina/Buenos_Aires' });
const mesMas = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Arma el mensaje del día para un usuario (o null si no hay nada importante)
async function armarMensaje(db: any, L: any, uid: string) {
  const items: string[] = [];
  const hoy = hoyAR();
  const mes = hoy.slice(0, 7);
  const ant = mesMas(mes, -1);

  // ---- Como empleador ----
  const { data: empleados } = await db.from('empleados').select('*').eq('empleador_id', uid);
  if (empleados && empleados.length) {
    const [liqs, fer, params, ult] = await Promise.all([
      db.from('liquidaciones').select('empleado_id, periodo, estado, vep_fecha, recibo_arca, detalle').eq('empleador_id', uid).gte('periodo', `${ant}-01`),
      db.from('feriados').select('fecha').gte('fecha', `${ant}-01`).lt('fecha', `${mesMas(mes, 2)}-01`),
      db.from('parametros').select('clave, valor, vigencia_desde').in('clave', ['vep_dia_vencimiento', 'periodo_prueba_meses'])
        .lte('vigencia_desde', hoy).order('vigencia_desde', { ascending: false }),
      db.from('escalas').select('vigencia_desde').order('vigencia_desde', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const param: Record<string, number> = {};
    for (const p of params.data || []) if (!(p.clave in param)) param[p.clave] = Number(p.valor);
    const avisos = L.generarAvisos({
      hoy, empleados, liquidaciones: liqs.data || [], param,
      feriados: new Set((fer.data || []).map((f: any) => f.fecha)),
      escalaUltima: ult.data ? ult.data.vigencia_desde : null,
    });
    for (const a of avisos) if (a.nivel !== 'info') items.push(a.texto);

    // novedades que cargó el empleado y faltan confirmar
    const ids = empleados.map((e: any) => e.id);
    const { count } = await db.from('novedades').select('id', { count: 'exact', head: true })
      .in('empleado_id', ids).eq('cargado_por', 'empleado').eq('confirmado_empleador', false).gte('fecha', `${ant}-01`);
    if (count) items.push(`Tenés ${count} novedad${count === 1 ? '' : 'es'} de tu personal para confirmar.`);
  }

  // ---- Como administrador ----
  const { data: adm } = await db.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
  if (adm) {
    const { count } = await db.from('robot_hallazgos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
    if (count) items.push(`🤖 El robot encontró ${count} novedad${count === 1 ? '' : 'es'} de escalas o aportes para aprobar.`);
  }

  // ---- Como empleado ----
  const { data: empleos } = await db.from('empleados').select('id').eq('usuario_id', uid);
  if (empleos && empleos.length) {
    const ids = empleos.map((e: any) => e.id);
    const [ac, nov] = await Promise.all([
      db.from('acuerdos').select('id', { count: 'exact', head: true }).in('empleado_id', ids).eq('estado', 'pendiente'),
      db.from('novedades').select('id', { count: 'exact', head: true }).in('empleado_id', ids)
        .eq('cargado_por', 'empleador').eq('confirmado_empleado', false).is('observacion_empleado', null).gte('fecha', `${ant}-01`),
    ]);
    if (ac.count) items.push(`Tenés ${ac.count} acuerdo${ac.count === 1 ? '' : 's'} o comunicación${ac.count === 1 ? '' : 'es'} para leer o firmar.`);
    if (nov.count) items.push(`Tenés ${nov.count} novedad${nov.count === 1 ? '' : 'es'} de tu empleador para responder.`);
  }

  if (!items.length) return null;
  return {
    titulo: items.length === 1 ? 'CasaEnRegla: 1 tarea pendiente' : `CasaEnRegla: ${items.length} tareas pendientes`,
    cuerpo: items[0] + (items.length > 1 ? ` (+${items.length - 1} más)` : ''),
    url: URL_APP,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch { /* sin cuerpo */ }

  // ---- ¿Quién llama? cron (secreto: todos los usuarios) o un usuario logueado (solo él) ----
  const secreto = Deno.env.get('ROBOT_SECRETO');
  const esCron = !!secreto && req.headers.get('x-robot') === secreto;
  let soloUsuario: string | null = null;
  if (!esCron) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return responder({ error: 'No autorizado' }, 401);
    soloUsuario = data.user.id;
  }

  webpush.setVapidDetails(Deno.env.get('VAPID_CONTACTO') || 'mailto:avisos@casaenregla.app',
    Deno.env.get('VAPID_PUBLICA')!, Deno.env.get('VAPID_PRIVADA')!);

  let q = db.from('suscripciones_push').select('*');
  if (soloUsuario) q = q.eq('usuario_id', soloUsuario);
  const { data: subs, error } = await q;
  if (error) return responder({ error: error.message }, 500);

  const porUsuario = new Map<string, any[]>();
  for (const s of subs || []) porUsuario.set(s.usuario_id, [...(porUsuario.get(s.usuario_id) || []), s]);

  const L = await cargarMotor();
  let enviadas = 0, borradas = 0;
  const detalle: string[] = [];
  for (const [uid, lista] of porUsuario) {
    const mensaje = cuerpo.prueba && soloUsuario
      ? { titulo: 'CasaEnRegla', cuerpo: '✓ Las notificaciones funcionan en este dispositivo.', url: URL_APP }
      : await armarMensaje(db, L, uid);
    if (!mensaje) { detalle.push(`${uid.slice(0, 8)}: nada para avisar`); continue; }
    for (const s of lista) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(mensaje));
        enviadas++;
      } catch (e: any) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { await db.from('suscripciones_push').delete().eq('id', s.id); borradas++; }
        else detalle.push(`${uid.slice(0, 8)}: error ${e && (e.statusCode || e.message)}`);
      }
    }
  }
  return responder({ enviadas, borradas, usuarios: porUsuario.size, detalle });
});
