// Only these reviewed settings belong in a public browser bundle.
const publicNames = new Set([
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SITE_URL',
  'VITE_LEGAL_NAME', 'VITE_LEGAL_ADDRESS', 'VITE_PRIVACY_EMAIL',
  'VITE_PRIVACY_READY', 'VITE_BUSINESS_NAME',
]);

export function assertPublicEnvironment(env) {
  const unknown = Object.keys(env).filter((name) => name.startsWith('VITE_') && !publicNames.has(name));
  if (unknown.length) throw new Error('Hay variables públicas VITE_ no reconocidas. Usa únicamente las indicadas en .env.example; guarda las credenciales privadas en el servidor.');
}
