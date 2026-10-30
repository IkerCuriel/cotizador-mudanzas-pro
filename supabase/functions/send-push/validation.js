import { timingSafeEqual } from 'node:crypto';

export const PUSH_HOSTS = Object.freeze(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);
export function isAllowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2000 || !/^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)\/[A-Za-z0-9_~.%:@/-]+$/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
export function webhookSecretMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 32 || provided.length > 256) return false;
  const actualBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
export function notificationFilter(body) {
  if (body?.type === 'INSERT' && body?.schema === 'public' && body?.table === 'notifications' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.record?.id || '')) return body.record.id;
  if (body && Object.keys(body).length === 1 && body.retry === true) return null;
  throw new Error('Unsupported trigger');
}
export function pushResult(status) {
  if (status >= 200 && status < 300) return 'accepted';
  if (status === 404 || status === 410) return 'gone';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'rejected';
}
// Sin ruta, nombre, teléfono, inventario, referencia ni URL proporcionada por el cliente.
export function genericPushPayload(notificationId) {
  return JSON.stringify({ version: 1, notificationId, title: 'MoveFlow', body: 'Hay una nueva solicitud disponible. Entra a tu panel para revisarla.' });
}
