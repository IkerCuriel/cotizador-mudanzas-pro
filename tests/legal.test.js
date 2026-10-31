import test from 'node:test';
import assert from 'node:assert/strict';
import { readLegalConfig } from '../src/legal-config.js';
test('la recepción no se habilita por una bandera sin identidad y contacto', () => {
  assert.equal(readLegalConfig({ VITE_PRIVACY_READY: 'true' }).ready, false);
  const fields = { VITE_LEGAL_NAME: 'Negocio de prueba', VITE_LEGAL_ADDRESS: 'Domicilio ficticio de prueba 123', VITE_LEGAL_PHONE: '5500000000', VITE_PRIVACY_EMAIL: 'prueba@example.com' };
  assert.equal(readLegalConfig(fields).ready, false);
  assert.equal(readLegalConfig({ ...fields, VITE_PRIVACY_READY: 'true' }).ready, true);
  assert.equal(readLegalConfig({ ...fields, VITE_PRIVACY_READY: 'true', VITE_PRIVACY_EMAIL: 'inválido' }).ready, false);
  assert.equal(readLegalConfig({ ...fields, VITE_PRIVACY_READY: 'true', VITE_LEGAL_PHONE: '' }).ready, false);
  assert.equal(readLegalConfig({}).email, 'soporte.moveflow@gmail.com');
});
