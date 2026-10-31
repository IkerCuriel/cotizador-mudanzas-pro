import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvitationArguments, prepareInvitations, provisionPilot } from '../scripts/provision-pilot.mjs';

const env = () => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_only', MOVEFLOW_SITE_URL: 'https://mudanzas.example', MOVEFLOW_TERE_EMAIL: 'tere@example.test', MOVEFLOW_MARCO_EMAIL: 'marco@example.test', MOVEFLOW_PRIVACY_READY: 'true', MOVEFLOW_TERE_EMAIL_CONFIRMED: 'true', MOVEFLOW_MARCO_EMAIL_CONFIRMED: 'true' });

test('confirmación individual requerida aunque el correo sea válido o exista la confirmación conjunta antigua', async () => {
  for (const confirmation of [undefined, 'false', 'TRUE', '1']) {
    await assert.rejects(provisionPilot({ env: { ...env(), MOVEFLOW_EMAILS_CONFIRMED: 'true', MOVEFLOW_TERE_EMAIL_CONFIRMED: confirmation }, member: 'tere', send: true,
      create: () => { assert.fail('No debe abrir conexión con correos no confirmados'); }, log: () => {} }), /correo real/);
  }
});

test('revisión de invitaciones no abre conexión ni envía correos', async () => {
  for (const args of [[], ['--dry-run'], ['--member', 'tere'], ['--member', 'marco', '--dry-run']]) {
    const result = await provisionPilot({ ...parseInvitationArguments(args), env: {}, create: () => { assert.fail('No debería conectar'); }, log: () => {} });
    assert.deepEqual(result, { sent: 0, failed: 0 });
  }
});

test('envío exige un único destinatario explícito y rechaza modos ambiguos', async () => {
  assert.deepEqual(parseInvitationArguments(['--member', 'tere', '--send']), { member: 'tere', send: true });
  assert.deepEqual(parseInvitationArguments(['--send', '--member', 'marco']), { member: 'marco', send: true });
  for (const args of [['--send'], ['--member'], ['--member', 'all', '--send'], ['--member', 'otro'], ['--member', 'tere', '--member', 'marco'], ['--send', '--dry-run'], ['--send', '--send'], ['--unknown']]) {
    assert.throws(() => parseInvitationArguments(args));
  }
  for (const member of [undefined, 'all', 'otro']) {
    await assert.rejects(provisionPilot({ env: env(), member, send: true, create: () => { assert.fail('No debe abrir conexión sin selección individual'); }, log: () => {} }), /Selecciona una sola persona/);
  }
});

test('invitaciones exigen correos individuales, aviso completo y credencial de servidor', () => {
  for (const change of [{ SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_wrong' }, { MOVEFLOW_PRIVACY_READY: 'false' }, { MOVEFLOW_TERE_EMAIL: '' }, { MOVEFLOW_MARCO_EMAIL: 'tere@example.test' }, { MOVEFLOW_SITE_URL: 'http://mudanzas.example' }, { SUPABASE_URL: 'https://key:secret@project.supabase.co' }]) {
    assert.throws(() => prepareInvitations({ ...env(), ...change }, 'tere'));
  }
});

test('invitar solo a Tere no valida ni invita a Marco provisional y no inventa permisos o consentimientos', async () => {
  const calls = []; const messages = [];
  const result = await provisionPilot({ env: { ...env(), MOVEFLOW_MARCO_EMAIL: 'correo-provisional-no-verificado', MOVEFLOW_MARCO_EMAIL_CONFIRMED: 'false' }, member: 'tere', send: true, log: (message) => messages.push(message), create: (_url, _key, options) => {
    assert.equal(options.auth.persistSession, false);
    return { auth: { admin: { inviteUserByEmail: async (...args) => { calls.push(args); return { error: null }; } } } };
  } });
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'tere@example.test');
  for (const [, options] of calls) {
    assert.equal(options.redirectTo, 'https://mudanzas.example/cuenta.html?mode=invite');
    assert.deepEqual(Object.keys(options.data).sort(), ['display_name', 'interest', 'phone']);
    assert.equal(options.password, undefined); assert.equal(options.data.role, undefined); assert.equal(options.data.privacy_accepted, undefined);
  }
  assert.ok(messages.every((message) => !message.includes(env().SUPABASE_SERVICE_ROLE_KEY)));
});

test('Marco requiere su propia confirmación y puede invitarse después sin reenviar a Tere', async () => {
  const configuration = { ...env(), MOVEFLOW_TERE_EMAIL: '', MOVEFLOW_TERE_EMAIL_CONFIRMED: 'false' };
  await assert.rejects(provisionPilot({ env: { ...configuration, MOVEFLOW_MARCO_EMAIL_CONFIRMED: 'false' }, member: 'marco', send: true,
    create: () => { assert.fail('La confirmación de Tere no autoriza enviar a Marco'); }, log: () => {} }), /MOVEFLOW_MARCO_EMAIL_CONFIRMED/);
  const calls = [];
  const result = await provisionPilot({ env: configuration, member: 'marco', send: true, log: () => {}, create: () => ({ auth: { admin: { inviteUserByEmail: async (email) => { calls.push(email); return { error: null }; } } } }) });
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.deepEqual(calls, ['marco@example.test']);
});

test('error de invitación no expone la respuesta privada ni cambia cuentas existentes', async () => {
  const messages = [];
  const result = await provisionPilot({ env: env(), member: 'tere', send: true, log: (message) => messages.push(message), create: () => ({ auth: { admin: { inviteUserByEmail: async () => ({ error: { message: 'secret-private-detail' } }) } } }) });
  assert.equal(result.failed, 1); assert.equal(result.sent, 0);
  assert.ok(messages.every((message) => !message.includes('secret-private-detail')));
});
