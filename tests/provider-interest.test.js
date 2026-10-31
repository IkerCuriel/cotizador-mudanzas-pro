import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_PLAN, PROVIDER_INBOX, prepareProviderInterest, validateProviderInterest } from '../src/provider-interest.js';
const complete = { company: 'Mudanzas de Prueba', contact: 'Persona de prueba', email: 'ejemplo@example.com', phone: '+52 55 0000 0000', coverage: 'CDMX y Puebla', services: 'both', notes: 'Equipo y dos unidades.', consent: true };

test('provider request opens only the owner inbox with a readable 149 MXN proposal and no payment claim', () => {
  const prepared = prepareProviderInterest(complete);
  const url = new URL(prepared.href);
  assert.equal(url.protocol, 'mailto:'); assert.equal(url.pathname, PROVIDER_INBOX);
  assert.equal(url.searchParams.get('body'), prepared.body);
  assert.equal(url.searchParams.get('subject'), prepared.subject);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  for (const value of [complete.company, complete.contact, complete.email, complete.phone, complete.coverage, complete.notes, '$149 MXN al mes']) assert.ok(prepared.body.includes(value));
  assert.match(prepared.body, /no autoriza un cargo ni crea automáticamente una cuenta/);
  assert.equal(PROVIDER_PLAN.checkoutEnabled, false);
});

test('incomplete or unchecked requests cannot prepare a message', () => {
  assert.equal(validateProviderInterest({}).valid, false);
  for (const key of ['company', 'contact', 'email', 'phone', 'coverage', 'services', 'consent']) {
    const values = { ...complete, [key]: key === 'consent' ? false : '' };
    assert.ok(validateProviderInterest(values).errors[key]);
    assert.throws(() => prepareProviderInterest(values));
  }
  assert.equal(validateProviderInterest({ ...complete, consent: 'true' }).valid, false);
  assert.equal(validateProviderInterest({ ...complete, notes: '' }).valid, true);
});

test('untrusted contact data cannot add mail recipients or headers, alter the plan or inject a subject', () => {
  const prepared = prepareProviderInterest({ ...complete, company: 'Acme\r\nBcc: otro@example.com', notes: '&bcc=intruso@example.com # prueba + acentos ñ', price: 1, recipient: 'otro@example.com', subject: 'inventado' });
  const url = new URL(prepared.href);
  assert.equal(url.pathname, PROVIDER_INBOX);
  assert.equal(url.searchParams.has('bcc'), false);
  assert.ok(!prepared.subject.includes('inventado'));
  assert.match(prepared.body, /\$149 MXN/);
  assert.ok(prepared.body.includes('Acme  Bcc: otro@example.com'));
  assert.ok(url.searchParams.get('body').includes('&bcc=intruso@example.com # prueba + acentos ñ'));
});

test('provider input rejects overlong, malformed and unsupported details without truncating silently', () => {
  for (const [key, value] of Object.entries({company:'a'.repeat(121), contact:'a'.repeat(101), email:'a'.repeat(260), phone:'12345', coverage:'a'.repeat(181), notes:'a'.repeat(401), services:'admin'})) {
    assert.ok(validateProviderInterest({ ...complete, [key]: value }).errors[key]);
  }
  for (const phone of ['not-a-phone', '5555555555x', '1'.repeat(16)]) assert.ok(validateProviderInterest({ ...complete, phone }).errors.phone);
  assert.ok(validateProviderInterest({ ...complete, email: 'a@example.com\r\nBcc: b@example.com' }).errors.email);
});
