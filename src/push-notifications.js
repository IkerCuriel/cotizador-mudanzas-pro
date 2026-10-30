import { supabase, isCloudConfigured } from './cloud.js';

export function readPushConfig(env = {}) {
  const enabled = env.VITE_WEB_PUSH_ENABLED === 'true';
  const publicKey = String(env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
  return { enabled, publicKey, configured: enabled && /^[A-Za-z0-9_-]{87}$/.test(publicKey) };
}
const config = readPushConfig({ VITE_WEB_PUSH_ENABLED: import.meta.env?.VITE_WEB_PUSH_ENABLED, VITE_WEB_PUSH_PUBLIC_KEY: import.meta.env?.VITE_WEB_PUSH_PUBLIC_KEY });

export function mayEnablePush(profile, assuranceLevel, now = Date.now()) {
  if (assuranceLevel !== 'aal2' || !profile?.id) return false;
  return ['admin', 'superadmin'].includes(profile.role) || (profile.role === 'provider' && profile.provider_status === 'approved' && new Date(profile.plan_expires_at).getTime() > now);
}
export function getPushAvailability({ profile, assuranceLevel } = {}) {
  const configured = isCloudConfigured && config.configured;
  const supported = globalThis.isSecureContext === true && Boolean(globalThis.navigator?.serviceWorker) && 'PushManager' in globalThis && 'Notification' in globalThis;
  const eligible = mayEnablePush(profile, assuranceLevel);
  const permission = globalThis.Notification?.permission || 'default';
  const reason = !configured ? 'Los avisos al teléfono están pendientes de activación.' : !supported ? 'Este navegador no permite avisos. En iPhone, añade MoveFlow a tu pantalla de inicio y ábrelo desde ahí.' : !eligible ? 'Necesitas una cuenta de negocio habilitada y verificar el segundo factor.' : permission === 'denied' ? 'Los avisos están bloqueados. Puedes permitirlos desde los ajustes de tu navegador.' : '';
  return { configured, supported, eligible, permission, reason, canEnable: configured && supported && eligible && permission !== 'denied' };
}
function ownWorkerUrl() {
  return new URL('./push-sw.js', new URL('.', globalThis.location.href));
}
async function existingRegistration() {
  if (!globalThis.navigator?.serviceWorker) return null;
  const script = ownWorkerUrl();
  const registration = await navigator.serviceWorker.getRegistration(new URL('.', script).href);
  if (!registration) return null;
  const worker = registration.active || registration.waiting || registration.installing;
  return worker && new URL(worker.scriptURL).href === script.href ? registration : null;
}
function keyBytes(base64url) {
  const decoded = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
export async function getPushDeviceState() {
  const registration = await existingRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || !supabase) return { subscribed: false, active: false };
  const { data, error } = await supabase.from('push_devices').select('id,active,label').eq('endpoint', subscription.endpoint).maybeSingle();
  if (error) throw new Error('No pudimos comprobar los avisos de este dispositivo.');
  return { subscribed: true, active: data?.active === true, label: data?.label || '' };
}
export async function enablePushNotifications({ profile, assuranceLevel, deviceLabel = 'Mi dispositivo' } = {}) {
  const availability = getPushAvailability({ profile, assuranceLevel });
  if (!availability.canEnable) throw new Error(availability.reason || 'No se pueden activar los avisos.');
  // Llamar solamente desde un botón: la petición de permiso conserva el gesto del usuario.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No se activaron los avisos. Puedes seguir consultando las solicitudes en tu panel.');
  const [{ data: identity, error: identityError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (identityError || assuranceError || identity?.user?.id !== profile.id || assurance?.currentLevel !== 'aal2') throw new Error('Tu sesión cambió. Verifica tu cuenta e inicia otra vez la activación de avisos.');
  const script = ownWorkerUrl();
  const registration = await navigator.serviceWorker.register(script.href, { scope: new URL('.', script).href, updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // Al cambiar de cuenta no se reasigna silenciosamente el dispositivo de otra persona.
  if (subscription) {
    const { data, error } = await supabase.from('push_devices').select('id').eq('endpoint', subscription.endpoint).maybeSingle();
    if (error) throw new Error('No pudimos comprobar el dispositivo. Vuelve a iniciar sesión.');
    if (!data) { await subscription.unsubscribe(); subscription = null; }
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  const details = subscription.toJSON();
  // El ID esperado se comprueba también dentro de la misma transacción del RPC:
  // cubre un cambio de sesión entre la comprobación anterior y la petición HTTP.
  const { error } = await supabase.rpc('register_push_device', { p_endpoint: details.endpoint, p_p256dh: details.keys?.p256dh, p_auth: details.keys?.auth, p_label: deviceLabel.slice(0, 80), p_expected_user_id: profile.id });
  if (error) {
    await subscription.unsubscribe();
    throw new Error(error.code === '54000' ? 'Ya hay cinco dispositivos activos. Desactiva alguno antes de añadir otro.' : 'No se pudieron activar los avisos. Revisa tu acceso o inténtalo más tarde.');
  }
  return { active: true };
}
export async function disablePushNotifications() {
  const registration = await existingRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { active: false };
  // Revoca primero en servidor; aunque falle, desuscribe el navegador para cortar el canal.
  let serverError = false;
  try {
    if (supabase) {
      const { error } = await supabase.rpc('revoke_push_device', { p_endpoint: subscription.endpoint });
      serverError = Boolean(error);
    }
  } catch { serverError = true; }
  const removed = await subscription.unsubscribe();
  if (!removed) throw new Error('No pudimos desactivar el navegador. Bloquea los avisos en sus ajustes.');
  return { active: false, serverPending: serverError };
}
