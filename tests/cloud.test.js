import test from 'node:test';
import assert from 'node:assert/strict';
import { readCloudConfig, safeReturnUrl, accountUrl, getSession, getPublicSettings, submitCloudRequest, businessSubmissionArguments, assertRouteStorageAvailable, isCloudConfigured, supabase } from '../src/cloud.js';

const jwt = (role) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.test-signature`;
const publicEnv = { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_key' };

test('cloud config accepts publishable and legacy anon keys only', () => {
  assert.equal(readCloudConfig(publicEnv).configured, true);
  assert.equal(readCloudConfig({ ...publicEnv, VITE_SUPABASE_ANON_KEY: jwt('anon') }).configured, true);
  for (const key of ['sb_secret_forbidden', jwt('service_role'), jwt('authenticated'), 'malformed-key']) {
    const result = readCloudConfig({ ...publicEnv, VITE_SUPABASE_ANON_KEY: key });
    assert.equal(result.configured, false);
    assert.equal(result.key, '');
    assert.ok(!result.error.includes(key));
  }
});

test('cloud config does not expose partial configuration and rejects insecure remote URLs', () => {
  assert.equal(readCloudConfig({}).configured, false);
  for (const partial of [{ VITE_SUPABASE_ANON_KEY: publicEnv.VITE_SUPABASE_ANON_KEY }, { VITE_SUPABASE_URL: publicEnv.VITE_SUPABASE_URL }]) {
    assert.deepEqual(readCloudConfig(partial), { configured: false, url: '', key: '', error: '' });
  }
  for (const url of ['http://project.supabase.co', 'https://user:password@project.supabase.co', 'https://project.supabase.co/rest', 'https://project.supabase.co/?key=unsafe', 'javascript:alert(1)']) assert.equal(readCloudConfig({ ...publicEnv, VITE_SUPABASE_URL: url }).configured, false);
  assert.equal(readCloudConfig({ ...publicEnv, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).configured, true);
});

test('partial cloud configuration rejects private or invalid keys without leaking them', () => {
  for (const key of ['sb_secret_forbidden', jwt('service_role'), jwt('authenticated'), 'malformed-key']) {
    const result = readCloudConfig({ VITE_SUPABASE_ANON_KEY: key });
    assert.equal(result.configured, false);
    assert.equal(result.url, '');
    assert.equal(result.key, '');
    assert.ok(result.error);
    assert.ok(!result.error.includes(key));
  }
});

test('partial cloud configuration rejects invalid URLs even before a key is provided', () => {
  for (const url of ['not-a-url', 'http://project.supabase.co', 'https://user:password@project.supabase.co', 'https://project.supabase.co/rest', 'javascript:alert(1)']) {
    const result = readCloudConfig({ VITE_SUPABASE_URL: url });
    assert.equal(result.configured, false);
    assert.equal(result.url, '');
    assert.equal(result.key, '');
    assert.ok(result.error);
    assert.ok(!result.error.includes(url));
  }
});

test('account redirects stay within the current application and strip query parameters', () => {
  const base = 'https://example.github.io/moveflow/cuenta.html?next=evil';
  assert.equal(safeReturnUrl('index.html#solicitud', base), 'https://example.github.io/moveflow/index.html#solicitud');
  assert.equal(safeReturnUrl('./panel.html?access_token=secret', base), 'https://example.github.io/moveflow/panel.html');
  const fallback = 'https://example.github.io/moveflow/panel.html';
  for (const value of ['https://evil.example/panel.html', '//evil.example/panel.html', '../panel.html', '/panel.html', 'javascript:alert(1)', '\\evil.example\panel.html', 'https://user:pw@example.github.io/moveflow/index.html', 'index.html%2f..%2f..', 'panel.html\n']) assert.equal(safeReturnUrl(value, base), fallback);
  assert.equal(safeReturnUrl('index.html#access_token=secret', base), 'https://example.github.io/moveflow/index.html');
  const login = new URL(accountUrl('//evil.example', base));
  assert.equal(login.pathname, '/moveflow/cuenta.html');
  assert.equal(login.searchParams.get('next'), fallback);
});

test('unconfigured cloud is disabled and never claims a request was submitted', async () => {
  assert.equal(isCloudConfigured, false);
  assert.equal(supabase, null);
  assert.equal(await getSession(), null);
  assert.equal((await getPublicSettings()).accepting_requests, false);
  await assert.rejects(submitCloudRequest({ id: 'MF-test', fields: { privacyConsent: true } }), /preparando las cuentas/);
});

test('cloud submission requires explicit consent for the selected audience', async () => {
  await assert.rejects(submitCloudRequest({ id: 'MF-test', fields: {} }), /autoriza el contacto/);
  await assert.rejects(submitCloudRequest({ id: 'MF-test', fields: { privacyConsent: true } }, 'network'), /Autoriza expresamente/);
  await assert.rejects(submitCloudRequest({ id: 'MF-test', fields: { privacyConsent: true } }, 'everyone'), /Selecciona/);
  await assert.rejects(submitCloudRequest({ id: 'MF-test', fields: { privacyConsent: true, networkConsent: true } }, 'network'), /todavía no está habilitada/);
});

test('una solicitud tiene un negocio explícito, nunca una lista de destinatarios del navegador', () => {
  const request = { id: 'MF-TEST-BUSINESS', fields: { privacyConsent: true }, business_id: 'forged', recipients: ['arbitrary'] };
  const args = businessSubmissionArguments(request);
  assert.equal(args.p_business_slug, 'd-curiel');
  assert.equal(args.p_reference, request.id);
  assert.equal(args.p_privacy_version, '2026-10-30');
  assert.deepEqual(Object.keys(args).sort(), ['p_business_slug', 'p_payload', 'p_privacy_version', 'p_reference']);
  for (const slug of ['', '../d-curiel', 'd-curiel,other', ['d-curiel'], 'a'.repeat(81)]) assert.throws(() => businessSubmissionArguments(request, slug), /negocio válido/);
  assert.throws(() => businessSubmissionArguments({ ...request, fields: {} }), /autoriza el contacto/);
});

 test('extended route data cannot be silently submitted to an older backend', () => {
  assert.doesNotThrow(() => assertRouteStorageAvailable({fields:{origin:'A',destination:'B'}},{}));
  for (const fields of [{additionalDestinations:[{address:'C'}]},{originPlace:{placeId:'ID',label:'A'}},{destinationPlace:{placeId:'ID',label:'B'}}]) {
    for (const settings of [null, {}, {route_destinations_version:0}]) assert.throws(() => assertRouteStorageAvailable({fields},settings), /rutas está en actualización/);
    assert.doesNotThrow(() => assertRouteStorageAvailable({fields},{route_destinations_version:1}));
  }
});
