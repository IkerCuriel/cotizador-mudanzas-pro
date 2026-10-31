import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resolveProviderAccess } from '../src/cloud.js';
import { readPushConfig, mayEnablePush, getPushAvailability } from '../src/push-notifications.js';
import { isAllowedPushEndpoint, webhookSecretMatches, notificationFilter, pushResult, genericPushPayload } from '../supabase/functions/send-push/validation.js';

const id = '00000000-0000-4000-8000-000000000001';
test('push requiere activación pública explícita y una clave pública con formato correcto', () => {
  assert.equal(readPushConfig().configured, false);
  assert.equal(readPushConfig({ VITE_WEB_PUSH_ENABLED: 'true' }).configured, false);
  assert.equal(readPushConfig({ VITE_WEB_PUSH_ENABLED: 'true', VITE_WEB_PUSH_PUBLIC_KEY: 'B'.repeat(87) }).configured, true);
  assert.equal(readPushConfig({ VITE_WEB_PUSH_ENABLED: 'false', VITE_WEB_PUSH_PUBLIC_KEY: 'B'.repeat(87) }).configured, false);
  assert.equal(readPushConfig({ VITE_WEB_PUSH_ENABLED: 'true', VITE_WEB_PUSH_PUBLIC_KEY: 'sb_secret_never_accepted' }).configured, false);
  assert.equal(getPushAvailability().canEnable, false);
});
test('disponibilidad de UI exige AAL2 y acceso confirmado por servidor, sin inferirlo de una fecha', () => {
  const profile = { id, role: 'provider', provider_status: 'approved', plan_expires_at: '2030-01-01T00:00:00Z', provider_access_active: true };
  assert.equal(mayEnablePush(profile, 'aal2'), true);
  assert.equal(mayEnablePush(profile, 'aal1'), false);
  assert.equal(mayEnablePush({ ...profile, provider_status: 'suspended' }, 'aal2'), false);
  assert.equal(mayEnablePush({ ...profile, role: 'applicant' }, 'aal2'), false);
  assert.equal(mayEnablePush({ ...profile, provider_access_active: false }, 'aal2'), false);
  assert.equal(mayEnablePush({ ...profile, provider_access_active: undefined }, 'aal2'), false);
  assert.equal(mayEnablePush({ ...profile, provider_access_active: 'true' }, 'aal2'), false);
  // A valid server-confirmed courtesy works even without a future paid expiry.
  assert.equal(mayEnablePush({ ...profile, plan_expires_at: null }, 'aal2'), true);
  assert.equal(mayEnablePush({ ...profile, plan_expires_at: '2026-01-01' }, 'aal2'), true);
  assert.equal(mayEnablePush({ id, role: 'admin' }, 'aal2'), true);
  assert.equal(mayEnablePush({ id, role: 'admin' }, 'aal1'), false);
});
test('profile entitlement comes from the versioned current-user RPC and preserves the stored expiry', async () => {
  const profile = { id, role: 'provider', provider_status: 'approved', plan_expires_at: '2020-01-01', provider_access_active: false };
  const client = { async rpc(...args) {
    assert.deepEqual(args, ['get_my_access_status']);
    return { data: { access_version: 1, provider_access_active: true, reason: 'must not be copied' }, error: null };
  } };
  const resolved = await resolveProviderAccess(profile, client);
  assert.deepEqual(resolved, { ...profile, provider_access_active: true });
  assert.equal(profile.provider_access_active, false);
  assert.equal(resolved.plan_expires_at, profile.plan_expires_at);
  assert.equal(mayEnablePush(resolved, 'aal2'), true);
});
test('old backends, malformed responses and failures cannot enable access from a future date or supplied field', async () => {
  const profile = { id, role: 'provider', provider_status: 'approved', plan_expires_at: '2099-01-01', provider_access_active: true, metadata: { provider_access_active: true } };
  const replies = [
    { data: null, error: { code: 'PGRST202' } },
    { data: { access_version: 1, provider_access_active: true }, error: { message: 'failed' } },
    { data: { access_version: 1, provider_access_active: false }, error: null },
    { data: { access_version: 0, provider_access_active: true }, error: null },
    { data: { access_version: '1', provider_access_active: true }, error: null },
    { data: { access_version: 1, provider_access_active: 'true' }, error: null },
    { data: { provider_access_active: true }, error: null },
    { data: [{ access_version: 1, provider_access_active: true }], error: null },
    { data: null, error: null },
  ];
  for (const reply of replies) {
    const resolved = await resolveProviderAccess(profile, { rpc: async () => reply });
    assert.equal(resolved.provider_access_active, false);
    assert.equal(mayEnablePush(resolved, 'aal2'), false);
    assert.equal(resolved.plan_expires_at, profile.plan_expires_at);
  }
  assert.equal((await resolveProviderAccess(profile, { rpc: async () => { throw new Error('offline'); } })).provider_access_active, false);
  assert.equal((await resolveProviderAccess(profile, null)).provider_access_active, false);
});
test('unapproved providers and other roles cannot inherit provider entitlement', async () => {
  const client = { rpc() { assert.fail('Unapproved profiles must not acquire provider access'); } };
  for (const profile of [{ role: 'provider', provider_status: 'pending' }, { role: 'provider', provider_status: 'suspended' }, { role: 'applicant' }, { role: 'admin' }]) {
    assert.equal((await resolveProviderAccess({ id, ...profile, provider_access_active: true }, client)).provider_access_active, false);
  }
});
test('el envío rechaza endpoints manipulados, puertos, redirects URL y destinos internos', () => {
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']) assert.equal(isAllowedPushEndpoint(`https://${host}/send/token-A_B:1`), true);
  for (const endpoint of ['http://fcm.googleapis.com/send/one', 'https://fcm.googleapis.com.evil.test/send/one', 'https://fcm.googleapis.com@127.0.0.1/send/one', 'https://127.0.0.1/send/one', 'https://fcm.googleapis.com:443/send/one', 'https://fcm.googleapis.com/send/one?redirect=http://localhost', 'https://fcm.googleapis.com/send/one#frag', 'https://fcm.googleapis.com\\@localhost/send/one', 'https://fcm.googleapis.com/', `https://fcm.googleapis.com/${'a'.repeat(2000)}`]) assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
});
test('webhook exige un secreto dedicado y solo acepta evento o reintento conocido', () => {
  const secret = 'test-only-not-a-real-secret-'.repeat(3);
  assert.equal(webhookSecretMatches(secret, secret), true);
  for (const supplied of [undefined, '', 'anon-token', secret.slice(1), secret.replace('test', 'best')]) assert.equal(webhookSecretMatches(supplied, secret), false);
  assert.equal(webhookSecretMatches('short', 'short'), false);
  assert.equal(notificationFilter({ type: 'INSERT', schema: 'public', table: 'notifications', record: { id, endpoint: 'http://localhost', title: 'malicious text' } }), id);
  assert.equal(notificationFilter({ retry: true }), null);
  for (const body of [{}, { retry: true, endpoint: 'http://localhost' }, { type: 'INSERT', schema: 'public', table: 'profiles', record: { id } }, { type: 'INSERT', schema: 'public', table: 'notifications', record: { id: 'bad' } }]) assert.throws(() => notificationFilter(body));
  assert.deepEqual(Object.keys(JSON.parse(genericPushPayload(id))).sort(), ['body', 'notificationId', 'title', 'version']);
  assert.deepEqual([201,410,429,503,403].map(pushResult), ['accepted','gone','retry','retry','rejected']);
});
test('service worker ignora texto y enlaces del payload y no intercepta ni cachea solicitudes', async () => {
  const handlers = {}; const notifications = []; const opened = [];
  const self = { registration: { scope: 'https://moveflow.example/app/', showNotification: async (...args) => notifications.push(args) }, clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) }, addEventListener: (name, fn) => { handlers[name] = fn; } };
  vm.runInNewContext(await readFile(new URL('../public/push-sw.js', import.meta.url), 'utf8'), { self, URL });
  assert.deepEqual(Object.keys(handlers).sort(), ['notificationclick', 'push']);
  let pending;
  handlers.push({ data: { json: () => ({ notificationId: id, title: 'Cliente privado', body: 'Domicilio exacto', url: 'https://evil.example/' }) }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.equal(notifications[0][0], 'MoveFlow');
  assert.equal(notifications[0][1].body.includes('Domicilio'), false);
  assert.equal(notifications[0][1].data.panel, 'https://moveflow.example/app/panel.html');
  handlers.notificationclick({ notification: { close() {}, data: { panel: 'https://evil.example/' } }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(opened, ['https://moveflow.example/app/panel.html']);
});
