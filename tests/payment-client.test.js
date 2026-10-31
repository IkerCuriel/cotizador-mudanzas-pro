import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentArguments, paypalApprovalUrl, readPaymentReturn, paymentResultMessage, paymentCreationTarget, readBillingAccess } from '../src/payment-client.js';
const uuid = '12345678-1234-4123-8123-123456789012';
test('payment creation sends only allowed plan, business binding, idempotency and explicit consent', () => {
  const args=createPaymentArguments({businessId:uuid,requestId:uuid,planCode:'annual_1440',consent:true,price:1,months:120,isAdmin:true});
  assert.deepEqual(args,{action:'create',businessId:uuid,planCode:'annual_1440',requestId:uuid,consentVersion:'prepaid-v1'});
  for(const bad of [{consent:false},{consent:'true'},{planCode:'__proto__'},{planCode:'annual'},{businessId:'invalid'},{requestId:''}]) assert.throws(()=>createPaymentArguments({businessId:uuid,requestId:uuid,planCode:'monthly_149',consent:true,...bad}));
});
test('approval navigation permits only exact PayPal hostname for the configured environment', () => {
  assert.equal(paypalApprovalUrl('https://www.paypal.com/checkoutnow?token=EXAMPLE','live'),'https://www.paypal.com/checkoutnow?token=EXAMPLE');
  assert.equal(paypalApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=TEST','sandbox'),'https://www.sandbox.paypal.com/checkoutnow?token=TEST');
  for(const url of ['https://evil.example/checkoutnow?token=A','https://www.paypal.com.evil.example/?token=A','http://www.paypal.com/?token=A','https://user@www.paypal.com/?token=A','https://www.paypal.com:444/?token=A','https://www.paypal.com/?token=A#x','https://www.paypal.com/','javascript:alert(1)','https://www.sandbox.paypal.com/?token=A']) assert.throws(()=>paypalApprovalUrl(url,'live'));
  assert.throws(()=>paypalApprovalUrl('https://www.paypal.com/?token=A','unknown'));
});
test('browser returns cannot establish payment success or swap purchase bindings', () => {
  assert.deepEqual(readPaymentReturn(`?purchase=${uuid}&success=true&token=FORGED`),{purchaseId:uuid,cancelled:false});
  assert.equal(readPaymentReturn('?purchase=FORGED').purchaseId,null);
  assert.equal(readPaymentReturn(`?purchase=${uuid}&purchase=${uuid}`).purchaseId,null);
  assert.deepEqual(readPaymentReturn(`?purchase=${uuid}&cancelled=1`),{purchaseId:uuid,cancelled:true});
  for(const response of [{status:'APPROVED'},{status:'paid'},{status:'paid',paidUntil:'invalid'},{status:'pending'},{status:'revoked'}]) assert.equal(paymentResultMessage(response).paid,false);
  assert.equal(paymentResultMessage({status:'paid',paidUntil:'2027-01-01T00:00:00Z'}).paid,true);
});

test('a previously paid or captured create response navigates to server reconciliation without another charge', () => {
  for (const status of ['paid','pending','voided']) {
    const target=paymentCreationTarget({purchaseId:uuid,status,paidUntil:'2099-01-01'},'live','https://example.com/pago.html?old=1');
    assert.equal(target,`https://example.com/pago.html?purchase=${uuid}`);
  }
  assert.throws(()=>paymentCreationTarget({purchaseId:uuid,status:'approved'},'live','https://example.com/pago.html'));
  assert.throws(()=>paymentCreationTarget({purchaseId:'invalid',status:'paid'},'live','https://example.com/pago.html'));
});

test('only a server-confirmed voided order can end retries and offer a new purchase', () => {
  const voided = paymentResultMessage({ status: 'voided' });
  assert.equal(voided.paid, false); assert.equal(voided.terminal, true); assert.equal(voided.canStartNew, true);
  assert.match(voided.text, /cerrada sin pago/);
  for (const status of ['cancelled', 'pending', 'unknown', 'APPROVED', 'revoked']) {
    assert.equal(paymentResultMessage({ status }).canStartNew, false);
  }
  assert.equal(paymentResultMessage({ status: 'pending' }).terminal, false);
  assert.equal(paymentResultMessage({ status: 'revoked' }).terminal, true);
});
test('unverified or AAL1 accounts are guided to account security before business RPC is queried', async () => {
  const session = { user: { id: uuid, email_confirmed_at: '2026-10-30T00:00:00Z' } };
  const client = { rpc() { assert.fail('Do not query businesses before email and MFA verification.'); } };
  const signedOut = await readBillingAccess({ getSession: async () => null, getAccountSecurity() { assert.fail('No session.'); }, client });
  assert.equal(signedOut.state, 'sign_in');
  for (const security of [{ currentLevel: 'aal1' }, { currentLevel: null }, {}]) {
    const result = await readBillingAccess({ getSession: async () => session, getAccountSecurity: async () => security, client });
    assert.equal(result.state, 'mfa');
  }
  const applicant = await readBillingAccess({ getSession: async () => session, getProfile: async () => ({role:'applicant'}), getAccountSecurity() { assert.fail('Applicant must first request provider access.'); }, client });
  assert.equal(applicant.state, 'approval');
  const base = { getSession: async () => session, getAccountSecurity: async () => ({ currentLevel: 'aal2' }) };
  assert.equal((await readBillingAccess({ ...base, client: { rpc: async () => ({ data: [], error: null }) } })).state, 'approval');
  const ready = await readBillingAccess({ ...base, client: { rpc: async name => { assert.equal(name, 'get_my_billing_businesses'); return { data: [{ business_id: uuid, name: 'Empresa de prueba' }], error: null }; } } });
  assert.equal(ready.state, 'ready'); assert.equal(ready.businesses.length, 1);
  await assert.rejects(readBillingAccess({ ...base, client: { rpc: async () => ({ data: [], error: new Error('network') }) } }));
});
