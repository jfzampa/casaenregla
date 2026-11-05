// CasaEnRegla — Edge Function "mercadopago": suscripción mensual del empleador
//
// Desde la app (con la sesión del usuario):
//   { accion: 'suscribir' } → crea la suscripción (preapproval) en Mercado Pago y devuelve el link de pago (init_point)
//   { accion: 'cancelar' }  → cancela la suscripción
//   { accion: 'actualizar' } → vuelve a consultar el estado en Mercado Pago
// Desde Mercado Pago (webhook): notificación de suscripción → consulta el estado real en MP y actualiza la base.
//   (No se confía en el contenido del aviso: siempre se vuelve a preguntar a la API de MP.)
//
// Secrets: MP_ACCESS_TOKEN (credencial de Mercado Pago; primero la de PRUEBA, después la de producción).
// "Verify JWT" desactivado (la función valida sola).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const URL_APP = 'https://jfzampa.github.io/casaenregla/';
const MP = 'https://api.mercadopago.com';
const ESTADOS: Record<string, string> = { authorized: 'activa', paused: 'pausada', cancelled: 'cancelada', pending: 'pendiente' };

async function mp(ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const r = await fetch(`${MP}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${datos.message || JSON.stringify(datos)}`);
  return datos;
}

// Guarda en la base el estado real de una suscripción de Mercado Pago
async function sincronizar(db: any, preapprovalId: string) {
  const p = await mp(`/preapproval/${preapprovalId}`);
  const uid = p.external_reference;
  if (!uid) return null;
  const estado = ESTADOS[p.status] || 'pendiente';
  await db.from('suscripciones').update({
    estado, mp_preapproval_id: p.id,
    monto: p.auto_recurring ? p.auto_recurring.transaction_amount : null,
    proximo_cobro: p.next_payment_date ? String(p.next_payment_date).slice(0, 10) : null,
    actualizado: new Date().toISOString(),
  }).eq('usuario_id', uid).neq('estado', 'cortesia');
  return estado;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch { /* sin cuerpo */ }

  // ---- 1) Aviso (webhook) de Mercado Pago ----
  const tipo = cuerpo.type || cuerpo.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  if (tipo && !cuerpo.accion) {
    try {
      const id = (cuerpo.data && cuerpo.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id');
      if (tipo === 'subscription_preapproval' && id) await sincronizar(db, id);
      if (tipo === 'subscription_authorized_payment' && id) {
        const pago = await mp(`/authorized_payments/${id}`);
        if (pago.preapproval_id) await sincronizar(db, pago.preapproval_id);
      }
    } catch (e) { console.error('webhook', (e as Error).message); }
    return responder({ ok: true }); // siempre 200 para que MP no reintente sin fin
  }

  // ---- 2) Pedidos desde la app (usuario logueado) ----
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!u.user) return responder({ error: 'No autorizado' }, 401);
  const uid = u.user.id;

  // asegura que exista su registro (con la prueba gratis desde que creó la cuenta)
  let { data: sus } = await db.from('suscripciones').select('*').eq('usuario_id', uid).maybeSingle();
  if (!sus) {
    const { data: dias } = await db.rpc('parametro', { p_clave: 'dias_prueba' });
    const desde = new Date(u.user.created_at || Date.now());
    desde.setDate(desde.getDate() + (Number(dias) || 30));
    await db.from('suscripciones').upsert({ usuario_id: uid, estado: 'prueba', prueba_hasta: desde.toISOString().slice(0, 10) }, { onConflict: 'usuario_id', ignoreDuplicates: true });
    ({ data: sus } = await db.from('suscripciones').select('*').eq('usuario_id', uid).maybeSingle());
  }

  try {
    if (cuerpo.accion === 'suscribir') {
      if (sus && sus.estado === 'activa') return responder({ error: 'Ya tenés una suscripción activa.' }, 400);
      const { data: precio } = await db.rpc('parametro', { p_clave: 'precio_mensual' });
      const p = await mp('/preapproval', 'POST', {
        reason: 'CasaEnRegla — suscripción mensual',
        external_reference: uid,
        payer_email: u.user.email,
        back_url: `${URL_APP}?suscripcion=ok`,
        status: 'pending',
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: Number(precio) || 4990, currency_id: 'ARS' },
      });
      await db.from('suscripciones').update({ estado: 'pendiente', mp_preapproval_id: p.id, monto: Number(precio) || 4990, actualizado: new Date().toISOString() })
        .eq('usuario_id', uid).neq('estado', 'cortesia');
      return responder({ init_point: p.init_point });
    }

    if (cuerpo.accion === 'cancelar') {
      if (!sus || !sus.mp_preapproval_id) return responder({ error: 'No hay una suscripción para cancelar.' }, 400);
      await mp(`/preapproval/${sus.mp_preapproval_id}`, 'PUT', { status: 'cancelled' });
      const estado = await sincronizar(db, sus.mp_preapproval_id);
      return responder({ estado });
    }

    if (cuerpo.accion === 'actualizar') {
      if (!sus || !sus.mp_preapproval_id) return responder({ estado: sus ? sus.estado : 'prueba' });
      const estado = await sincronizar(db, sus.mp_preapproval_id);
      return responder({ estado });
    }
  } catch (e) {
    return responder({ error: (e as Error).message }, 502);
  }
  return responder({ error: 'Acción desconocida' }, 400);
});
