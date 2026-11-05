// Datos de conexión a Supabase (son públicos, se pueden ver en la app sin problema;
// la seguridad la dan las reglas de la tabla).
window.CONFIG = {
  SUPABASE_URL: 'https://bytrghqvrpgcuvdbfnkn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_bGGPEHnTJTwY9sfD05w0QA_06SEB8Wg',
  // Clave pública para notificaciones al celular (la privada está solo en Supabase > Edge Functions > Secrets)
  VAPID_PUBLICA: 'BH9kOyIvd_SjybvyMsqkFS6MQJ7_naVMS-y2fR9atdTB8c5WkLCa1513LO3CqamQDKUXeFIItVZfWv23B_uGk8M',
};
