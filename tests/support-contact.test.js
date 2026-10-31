import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT_EMAIL, prepareSupportRequest } from '../src/support-contact.js';
const complete = { name: 'Cliente de prueba', company: 'Mudanzas de prueba', email: 'prueba@example.com', reference: 'MF-PRUEBA', problem: 'No puedo entrar a mi panel desde mi teléfono.' };
test('support requests go only to public support with account, company and issue', () => {
  const result = prepareSupportRequest(complete);
  assert.equal(result.valid, true);
  const url = new URL(result.href);
  assert.equal(url.protocol, 'mailto:'); assert.equal(url.pathname, SUPPORT_EMAIL);
  assert.deepEqual([...url.searchParams.keys()], ['subject','body']);
  for (const value of Object.values(complete)) assert.ok(result.body.includes(value));
});
test('support rejects missing fields, malformed email and oversized messages without sending', () => {
  for (const key of ['name','company','email','problem']) assert.equal(prepareSupportRequest({ ...complete, [key]: '' }).valid, false);
  for (const bad of [{email:'no-email'}, {problem:'short'}, {problem:'x'.repeat(2501)}, {name:'x'.repeat(101)}, {reference:'x'.repeat(101)}]) assert.equal(prepareSupportRequest({...complete,...bad}).valid, false);
  assert.equal(prepareSupportRequest({...complete,reference:''}).valid,true);
});
test('support field contents cannot inject recipients or email headers', () => {
  const result = prepareSupportRequest({...complete,name:'Prueba\r\nBcc: bad@example.com',problem:'Ayuda &bcc=bad@example.com # texto\nOtra línea',recipient:'bad@example.com',subject:'otro'});
  const url = new URL(result.href);
  assert.equal(url.pathname,SUPPORT_EMAIL);assert.equal(url.searchParams.has('bcc'),false);
  assert.equal(url.searchParams.get('body'),result.body);assert.equal(url.searchParams.get('subject'),'MoveFlow · Solicitud de soporte');
  assert.ok(!result.values.name.includes('\n'));
});
