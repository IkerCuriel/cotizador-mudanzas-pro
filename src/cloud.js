import { createClient } from '@supabase/supabase-js';
import { BUSINESS } from './config.js';

function jwtRole(key) {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return null;
    const value = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(value)).role;
  } catch { return null; }
}

/** Never initialize a browser client with an administrative or secret key. */
export function readCloudConfig(env = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  // Validate each supplied value even when setup is incomplete: Vite embeds VITE_
  // values in the browser bundle, so a missing URL must not hide a secret key.
  const publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || jwtRole(key) === 'anon';
  if (key && (!publicKey || key.startsWith('sb_secret_'))) return { configured: false, url: '', key: '', error: 'La configuración de cuentas no es válida para una página pública.' };
  let parsed;
  if (url) {
    try { parsed = new URL(url); } catch { return { configured: false, url: '', key: '', error: 'La conexión de cuentas está pendiente de configuración.' }; }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    const validUrl = (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback)) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && /^\/?$/.test(parsed.pathname);
    if (!validUrl) return { configured: false, url: '', key: '', error: 'La configuración de cuentas no es válida para una página pública.' };
  }
  if (!url || !key) return { configured: false, url: '', key: '', error: '' };
  return { configured: true, url: parsed.origin, key, error: '' };
}

const cloudConfig = readCloudConfig({
  VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY,
});
export const isCloudConfigured = cloudConfig.configured;
export const cloudConfigurationError = cloudConfig.error;
export const supabase = isCloudConfigured ? createClient(cloudConfig.url, cloudConfig.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
}) : null;

function requireCloud() {
  if (!supabase) throw new Error('Estamos preparando las cuentas. Puedes comunicarte por WhatsApp con el negocio.');
  return supabase;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(session) {
  const activeSession = session ?? await getSession();
  if (!activeSession) return null;
  const { data, error } = await requireCloud().from('profiles').select('*').eq('id', activeSession.user.id).single();
  if (error) throw error;
  return data;
}

export async function getPublicSettings() {
  if (!supabase) return { accepting_requests: false, network_enabled: false, privacy_version: '2026-10-30' };
  const { data, error } = await supabase.rpc('public_site_config');
  if (error) throw error;
  return data;
}

/** One explicit business per request. The database resolves and authorizes its team. */
export function businessSubmissionArguments(request, businessSlug = BUSINESS.slug) {
  if (!request?.id || request?.fields?.privacyConsent !== true) throw new Error('Revisa la solicitud y autoriza el contacto antes de enviarla.');
  if (typeof businessSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(businessSlug) || businessSlug.length > 80) throw new Error('Selecciona un negocio válido para esta solicitud.');
  return { p_reference: request.id, p_payload: request, p_business_slug: businessSlug, p_privacy_version: '2026-10-30' };
}

export function needsRouteStorage(request) {
  const fields = request?.fields || {};
  return Boolean(fields.originPlace || fields.destinationPlace || fields.additionalDestinations?.length);
}

export function assertRouteStorageAvailable(request, settings) {
  if (needsRouteStorage(request) && settings?.route_destinations_version !== 1) throw new Error('El guardado de rutas está en actualización. Comparte la ficha completa por WhatsApp mientras se habilita.');
}

export async function submitBusinessRequest(request, businessSlug = BUSINESS.slug) {
  const args = businessSubmissionArguments(request, businessSlug);
  const client = requireCloud();
  if (needsRouteStorage(request)) assertRouteStorageAvailable(request, await getPublicSettings());
  const { data, error } = await client.rpc('submit_business_request', args);
  if (error) throw error;
  return data;
}

// Compatibility for older callers: a broad network broadcast is intentionally unavailable.
export async function submitCloudRequest(request, audience = 'family') {
  if (!['family', 'network'].includes(audience)) throw new Error('Selecciona a quién quieres enviar la solicitud.');
  if (!request?.id || request?.fields?.privacyConsent !== true) throw new Error('Revisa la solicitud y autoriza el contacto antes de enviarla.');
  if (audience === 'network' && request.fields.networkConsent !== true) throw new Error('Autoriza expresamente compartir la solicitud con los mudanceros de la red.');
  if (audience === 'network') throw new Error('La distribución a la red todavía no está habilitada. Selecciona un negocio.');
  return submitBusinessRequest(request);
}

/** Server policies enforce this too; this helper chooses the appropriate account screen. */
export function requiresSecondFactor(profile) {
  return ['provider', 'admin', 'superadmin'].includes(profile?.role);
}

export async function getAccountSecurity() {
  const client = requireCloud();
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorError }] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors(),
  ]);
  if (assuranceError) throw assuranceError;
  if (factorError) throw factorError;
  return { currentLevel: assurance.currentLevel, nextLevel: assurance.nextLevel,
    factors: (factors?.totp || []).filter((factor) => factor.status === 'verified') };
}

/** Return only a known page in this app, never an external or sibling destination. */
export function safeReturnUrl(value, baseHref = globalThis.location?.href || 'http://localhost/') {
  const base = new URL('./', baseHref);
  const fallback = new URL('panel.html', base).href;
  if (typeof value !== 'string' || !value || /[\\\u0000-\u0020]/.test(value)) return fallback;
  let target;
  try { target = new URL(value, base); } catch { return fallback; }
  if (target.origin !== base.origin || target.username || target.password) return fallback;
  const allowed = ['index.html', 'cuenta.html', 'panel.html'].map((page) => new URL(page, base).pathname);
  if (!allowed.includes(target.pathname)) return fallback;
  target.search = '';
  if (!/^#[A-Za-z0-9_-]*$/.test(target.hash)) target.hash = '';
  return target.href;
}

export function accountUrl(next = 'panel.html', baseHref = globalThis.location?.href || 'http://localhost/') {
  const target = new URL('cuenta.html', new URL('./', baseHref));
  const safeNext = new URL(safeReturnUrl(next, baseHref));
  target.searchParams.set('next', safeNext.href);
  return target.href;
}

export function cloudErrorMessage(error, fallback = 'No se pudo completar la operación. Vuelve a intentarlo.') {
  const message = String(error?.message || '');
  if (/mfa.*(verification|verify|challenge)|invalid.*(totp|factor|code)/i.test(message)) return 'El código no es válido o ya cambió. Usa el código actual de tu aplicación autenticadora.';
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no coinciden. Revísalos o recupera tu acceso.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de entrar. Revisa también la carpeta de correo no deseado.';
  if (/rate limit|too many requests/i.test(message)) return 'Hay demasiados intentos. Espera un momento antes de volver a intentarlo.';
  if (/failed to fetch|network|fetch failed/i.test(message)) return 'No pudimos conectar. Revisa tu conexión e inténtalo otra vez.';
  if (/new password should be different/i.test(message)) return 'Elige una contraseña distinta de la anterior.';
  if (/password.*least|weak password/i.test(message)) return 'La contraseña no cumple los requisitos. Usa al menos 12 caracteres y evita contraseñas conocidas.';
  if (/session.*missing|jwt expired|refresh token/i.test(message)) return 'Tu sesión terminó. Vuelve a entrar para continuar.';
  // The database deliberately returns actionable Spanish business errors.
  if (message && /[áéíóúñ]|solicitud|permiso|proveedor|cuenta|plan|sesión|correo|acceso|privacidad/i.test(message) && !/select |insert |relation |schema |constraint |permission denied/i.test(message)) return message.slice(0, 400);
  return fallback;
}
