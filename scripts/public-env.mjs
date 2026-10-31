// Only these reviewed settings belong in a public browser bundle.
const publicNames = new Set([
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SITE_URL',
  'VITE_LEGAL_NAME', 'VITE_LEGAL_ADDRESS', 'VITE_LEGAL_PHONE', 'VITE_PRIVACY_EMAIL',
  'VITE_PRIVACY_READY', 'VITE_BUSINESS_NAME',
  'VITE_WEB_PUSH_PUBLIC_KEY', 'VITE_WEB_PUSH_ENABLED',
  'VITE_GOOGLE_MAPS_API_KEY',
]);

export function assertPublicEnvironment(env) {
  const unknown = Object.keys(env).filter((name) => name.startsWith('VITE_') && !publicNames.has(name));
  if (unknown.length) throw new Error('Hay variables públicas VITE_ no reconocidas. Usa únicamente las indicadas en .env.example; guarda las credenciales privadas en el servidor.');
  const googleKey = String(env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (googleKey && !/^AIza[A-Za-z0-9_-]{35}$/.test(googleKey)) throw new Error('La clave de Google Maps debe ser una clave pública de navegador restringida al dominio y a Maps/Places.');
  const pushKey = String(env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
  if ((pushKey || env.VITE_WEB_PUSH_ENABLED === 'true') && !/^[A-Za-z0-9_-]{87}$/.test(pushKey)) {
    throw new Error('Los avisos requieren una clave VAPID pública válida. La clave privada y los secretos webhook nunca van en variables VITE_.');
  }
}
