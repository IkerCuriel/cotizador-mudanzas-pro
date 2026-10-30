import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareInvitations, provisionPilot } from '../scripts/provision-pilot.mjs';

const env = () => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_only', MOVEFLOW_SITE_URL: 'https://mudanzas.example', MOVEFLOW_TERE_EMAIL: 'tere@example.test', MOVEFLOW_MARCO_EMAIL: 'marco@example.test', MOVEFLOW_PRIVACY_READY: 'true' });

test('revisión de invitaciones no abre conexión ni envía correos', async () => {
  const result = await provisionPilot({ create: () => { throw new Error('No debería conectar'); }, log: () => {} });
  assert.deepEqual(result, { sent: 0, failed: 0 });
});

test('invitaciones exigen correos individuales, aviso completo y credencial de servidor', () => {
  for (const change of [{ SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_wrong' }, { MOVEFLOW_PRIVACY_READY: 'false' }, { MOVEFLOW_TERE_EMAIL: '' }, { MOVEFLOW_MARCO_EMAIL: 'tere@example.test' }, { MOVEFLOW_SITE_URL: 'http://mudanzas.example' }, { SUPABASE_URL: 'https://key:secret@project.supabase.co' }]) {
    assert.throws(() => prepareInvitations({ ...env(), ...change }));
  }
});

test('las invitaciones no envían contraseña, permisos ni consentimientos inventados', async () => {
  const calls = []; const messages = [];
  const result = await provisionPilot({ env: env(), send: true, log: (message) => messages.push(message), create: (_url, _key, options) => {
    assert.equal(options.auth.persistSession, false);
    return { auth: { admin: { inviteUserByEmail: async (...args) => { calls.push(args); return { error: null }; } } } };
  } });
  assert.deepEqual(result, { sent: 2, failed: 0 });
  assert.equal(calls[0][0], 'tere@example.test'); assert.equal(calls[1][0], 'marco@example.test');
  for (const [, options] of calls) {
    assert.equal(options.redirectTo, 'https://mudanzas.example/cuenta.html?mode=invite');
    assert.deepEqual(Object.keys(options.data).sort(), ['display_name', 'interest', 'phone']);
    assert.equal(options.password, undefined); assert.equal(options.data.role, undefined); assert.equal(options.data.privacy_accepted, undefined);
  }
  assert.ok(messages.every((message) => !message.includes(env().SUPABASE_SERVICE_ROLE_KEY)));
});

test('error de invitación no expone la respuesta privada ni cambia cuentas existentes', async () => {
  const messages = [];
  const result = await provisionPilot({ env: env(), send: true, log: (message) => messages.push(message), create: () => ({ auth: { admin: { inviteUserByEmail: async () => ({ error: { message: 'secret-private-detail' } }) } } }) });
  assert.equal(result.failed, 2); assert.equal(result.sent, 0);
  assert.ok(messages.every((message) => !message.includes('secret-private-detail')));
});
