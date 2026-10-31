import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_PLANS, PROVIDER_INBOX, prepareProviderInterest, validateProviderInterest } from '../src/provider-interest.js';
const complete = { company: 'Mudanzas de Prueba', contact: 'Persona de prueba', email: 'ejemplo@example.com', phone: '+52 55 0000 0000', businessLocation: 'Del Valle, Ciudad de México', coverage: 'CDMX y Puebla', services: 'both', plan: 'monthly_149', notes: 'Equipo y dos unidades.', consent: true };

test('monthly inquiry opens only the owner inbox, includes a map reference and never claims payment', () => {
  const prepared = prepareProviderInterest(complete);
  const url = new URL(prepared.href);
  assert.equal(url.protocol, 'mailto:'); assert.equal(url.pathname, PROVIDER_INBOX);
  assert.equal(url.searchParams.get('body'), prepared.body);
  assert.equal(url.searchParams.get('subject'), prepared.subject);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  for (const value of [complete.company, complete.contact, complete.email, complete.phone, complete.businessLocation, complete.coverage, complete.notes, '$149 MXN al mes']) assert.ok(prepared.body.includes(value));
  assert.match(prepared.body, /no autoriza un cargo ni crea automáticamente una cuenta/);
  assert.match(prepared.body, /Google Maps \(referencia por revisar\)/);
  assert.ok(Object.values(PROVIDER_PLANS).every(plan => !plan.checkoutEnabled));
});

test('annual inquiry clearly quotes one 1,440 MXN payment for 12 months, not a monthly 120 charge', () => {
  const prepared = prepareProviderInterest({ ...complete, plan: 'annual_1440', price: 1, amount: 1, months: 1, monthlyPrice: 1 });
  assert.match(prepared.body, /Anual: \$1,440 MXN en un solo pago por 12 meses \(equivalente a \$120 al mes\)/);
  assert.match(prepared.body, /Ahorro de \$348 frente a 12 mensualidades de \$149/);
  assert.match(prepared.body, /no autoriza un cargo/);
  assert.equal(PROVIDER_PLANS.monthly_149.amount * 12 - PROVIDER_PLANS.annual_1440.amount, 348);
  assert.equal(PROVIDER_PLANS.annual_1440.amount / PROVIDER_PLANS.annual_1440.months, 120);
  for (const plan of ['annual', 'unknown', 'toString', '__proto__', '']) {
    assert.ok(validateProviderInterest({ ...complete, plan }).errors.plan);
    assert.throws(() => prepareProviderInterest({ ...complete, plan }));
  }
});

test('incomplete or unchecked requests cannot prepare a message; coverage and notes are optional', () => {
  assert.equal(validateProviderInterest({}).valid, false);
  for (const key of ['company', 'contact', 'email', 'phone', 'businessLocation', 'services', 'plan', 'consent']) {
    const values = { ...complete, [key]: key === 'consent' ? false : '' };
    assert.ok(validateProviderInterest(values).errors[key]);
    assert.throws(() => prepareProviderInterest(values));
  }
  assert.equal(validateProviderInterest({ ...complete, consent: 'true' }).valid, false);
  assert.equal(validateProviderInterest({ ...complete, coverage: '', notes: '' }).valid, true);
  assert.ok(!prepareProviderInterest({ ...complete, coverage: '' }).body.includes('Zonas de cobertura:'));
});

test('a selected place stays linked only while its label matches the business location', () => {
  const place = { placeId: 'ChIJtest_123', label: complete.businessLocation };
  const prepared = prepareProviderInterest({ ...complete, businessLocationPlace: place });
  const line = prepared.body.split('\n').find(line => line.startsWith('Google Maps'));
  assert.ok(line.startsWith('Google Maps (lugar seleccionado):'));
  const mapUrl = new URL(line.slice(line.indexOf('https://')));
  assert.equal(mapUrl.host, 'www.google.com');
  assert.equal(mapUrl.searchParams.get('query'), complete.businessLocation);
  assert.equal(mapUrl.searchParams.get('query_place_id'), place.placeId);
  for (const invalid of [{ ...place, label: 'Otro lugar' }, { ...place, placeId: 'https://evil.invalid/' }]) {
    const changed = prepareProviderInterest({ ...complete, businessLocationPlace: invalid });
    assert.ok(!changed.body.includes('query_place_id'));
    assert.match(changed.body, /referencia por revisar/);
  }
});

test('untrusted contact data cannot add mail recipients or headers, alter plan pricing or inject a subject', () => {
  const prepared = prepareProviderInterest({ ...complete, company: 'Acme\r\nBcc: otro@example.com', businessLocation: 'https://evil.invalid/?bcc=intruso@example.com', notes: '&bcc=intruso@example.com # prueba + acentos ñ', price: 1, recipient: 'otro@example.com', subject: 'inventado' });
  const url = new URL(prepared.href);
  assert.equal(url.pathname, PROVIDER_INBOX);
  assert.equal(url.searchParams.has('bcc'), false);
  assert.ok(!prepared.subject.includes('inventado'));
  assert.match(prepared.body, /\$149 MXN/);
  assert.ok(prepared.body.includes('Acme  Bcc: otro@example.com'));
  assert.ok(url.searchParams.get('body').includes('&bcc=intruso@example.com # prueba + acentos ñ'));
  const map = prepared.body.split('\n').find(line => line.startsWith('Google Maps')).split(': ').slice(1).join(': ');
  assert.equal(new URL(map).hostname, 'www.google.com');
});

test('provider input rejects malformed, overlong and unsupported details without truncating silently', () => {
  for (const [key, value] of Object.entries({company:'a'.repeat(121), contact:'a'.repeat(101), email:'a'.repeat(260), phone:'12345', businessLocation:'a'.repeat(501), coverage:'a'.repeat(181), notes:'a'.repeat(401), services:'admin'})) {
    assert.ok(validateProviderInterest({ ...complete, [key]: value }).errors[key]);
  }
  for (const phone of ['not-a-phone', '5555555555x', '1'.repeat(16)]) assert.ok(validateProviderInterest({ ...complete, phone }).errors.phone);
  assert.ok(validateProviderInterest({ ...complete, email: 'a@example.com\r\nBcc: b@example.com' }).errors.email);
  assert.ok(validateProviderInterest({ ...complete, businessLocation: 'ab' }).errors.businessLocation);
  assert.equal(validateProviderInterest({ ...complete, businessLocation: 'a'.repeat(500), coverage:'a'.repeat(180), notes:'a'.repeat(400) }).valid, true);
});
