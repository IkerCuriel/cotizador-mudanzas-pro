import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,minorUnits,orderPayload,verifyCapture,verifyOrder,approvalUrl,webhookVerification} from '../supabase/functions/paypal-checkout/core.js';
import {checkoutHandler} from '../supabase/functions/paypal-checkout/handler.js';
import {webhookHandler,captureReference} from '../supabase/functions/paypal-webhook/handler.js';
import {reconciliationHandler,authorizedReconciliation} from '../supabase/functions/paypal-reconcile/handler.js';
import {reconcilePurchase} from '../supabase/functions/paypal-checkout/reconcile.js';
const env={PAYPAL_MODE:'sandbox',MOVEFLOW_SITE_ORIGIN:'https://moveflow.example',PAYPAL_CLIENT_ID:'test-id',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_MERCHANT_ID:'MERCHANT12345',PAYPAL_WEBHOOK_ID:'TEST-HOOK',PAYPAL_CHECKOUT_ENABLED:'true'};
const config=configuration(env);
const p={id:'00000000-0000-4000-8000-000000000001',plan_code:'monthly_149',amount_minor:14900,currency:'MXN',months:1,order_id:'ORDER1234567890123'};
const capture={id:'CAPTURE12345678901',status:'COMPLETED',amount:{currency_code:'MXN',value:'149.00'},supplementary_data:{related_ids:{order_id:p.order_id}}};
const order=()=>({id:p.order_id,intent:'CAPTURE',status:'COMPLETED',purchase_units:[{...orderPayload(p,config).purchase_units[0],payments:{captures:[capture]}}],links:[{rel:'approve',href:`https://www.sandbox.paypal.com/checkoutnow?token=${p.order_id}`}]});
test('credentials and activation gates are closed by default, including live approval',()=>{
  assert.equal(configuration({}).enabled,false);assert.equal(config.enabled,true);
  assert.equal(configuration({...env,PAYPAL_MODE:'live'}).enabled,false);
  assert.equal(configuration({...env,PAYPAL_MODE:'live',PAYPAL_LIVE_APPROVED:'true'}).enabled,true);
  assert.equal(configuration({...env,MOVEFLOW_SITE_ORIGIN:'http://bad.test'}).enabled,false);
  assert.equal(configuration({...env,PAYPAL_WEBHOOK_ID:''}).enabled,false);
});
test('server prices, merchant and return URLs are fixed; annual is one1440payment',()=>{
  const payload=orderPayload({...p,plan_code:'annual_1440',amount_minor:144000,months:12},config);
  assert.equal(payload.purchase_units[0].amount.value,'1440.00');
  assert.equal(payload.purchase_units[0].payee.merchant_id,config.merchantId);
  assert.equal(payload.payment_source.paypal.experience_context.return_url,`https://moveflow.example/pago.html?purchase=${p.id}`);
  assert.throws(()=>orderPayload({...p,amount_minor:1},config));
  for(const value of [149,'149','149.0','1e2','-1.00','149.001','NaN'])assert.throws(()=>minorUnits(value));
});
test('capture verifies order, plan amount, currency, receiver and binding before entitlement',()=>{
  assert.equal(verifyCapture(order(),p,config,capture).p_revoked,false);
  assert.equal(verifyCapture(order(),p,config,{...capture,status:'REFUNDED'}).p_revoked,true);
  for(const change of [{status:'APPROVED'}, {id:'OTHER1234567890123'}, {purchase_units:[]}])assert.throws(()=>verifyCapture({...order(),...change},p,config,capture));
  for(const change of [{custom_id:'someone-else'},{payee:{merchant_id:'OTHER123456789'}},{amount:{currency_code:'USD',value:'149.00'}},{amount:{currency_code:'MXN',value:'120.00'}}]){
    const changed=order();changed.purchase_units[0]={...changed.purchase_units[0],...change};assert.throws(()=>verifyOrder(changed,p,config));
  }
  assert.throws(()=>verifyCapture(order(),p,config,{...capture,status:'PENDING'}));
  assert.throws(()=>verifyCapture(order(),p,config,{...capture,id:'OTHER1234567890123'}));
  assert.throws(()=>verifyCapture(order(),p,config,{...capture,supplementary_data:{related_ids:{order_id:'OTHER1234567890123'}}}));
});
test('approval navigation never trusts arbitrary URLs or a different order token',()=>{
  assert.match(approvalUrl(order(),config),/^https:\/\/www.sandbox.paypal.com/);
  for(const href of ['https://evil.test/','https://www.paypal.com/checkoutnow?token='+p.order_id,'https://www.sandbox.paypal.com/checkoutnow?token=OTHER','https://x@www.sandbox.paypal.com/checkoutnow?token='+p.order_id])assert.throws(()=>approvalUrl({...order(),links:[{rel:'approve',href}]},config));
});
const authClient=rpc=>({auth:{getUser:async()=>({data:{user:{email_confirmed_at:'2026-01-01'}},error:null})},rpc});
const request=body=>new Request('https://function.example',{method:'POST',headers:{Origin:config.origin,Authorization:'Bearer test.token','Content-Type':'application/json'},body:JSON.stringify(body)});
test('disabled checkout never reaches PayPal and public status stays false',async()=>{
  const handler=checkoutHandler({config:configuration({}),authenticatedClient:()=>authClient(()=>assert.fail()),service:{rpc:()=>assert.fail()},fetcher:()=>assert.fail()});
  const result=await handler(new Request('https://function.example',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'status'})}));
  assert.deepEqual(await result.json(),{enabled:false,mode:null});
});
test('capture reads stored purchase and reconciles authoritative PayPal state, ignoring client amount/order',async()=>{
  const effects=[];
  const handler=checkoutHandler({config,authenticatedClient:()=>authClient(async(name,args)=>{assert.equal(name,'get_my_paypal_purchase');assert.deepEqual(args,{p_purchase_id:p.id});return {data:{...p,status:'pending'}};}),service:{rpc:async(name,args)=>{effects.push({name,args});return {data:{status:'paid',paidUntil:'2026-12-01'}};}},fetcher:async(url)=>{
    if(url.endsWith('/oauth2/token'))return Response.json({access_token:'TESTTOKEN'});
    if(url.endsWith('/orders/'+p.order_id))return Response.json(order());
    if(url.endsWith('/captures/'+capture.id))return Response.json(capture);
    assert.fail('Unexpected URL');
  }});
  const result=await handler(request({action:'capture',purchaseId:p.id,amount:1,orderId:'BAD'}));
  assert.equal(result.status,200);assert.equal(effects[0].name,'settle_paypal_purchase');assert.equal(effects[0].args.p_amount_minor,14900);
});
test('invalid webhook signatures never settle a purchase or follow resource URLs',async()=>{
  const headers={'paypal-cert-url':'https://api.paypal.com/v1/notifications/certs/TEST','paypal-auth-algo':'SHA256withRSA','paypal-transmission-id':'TEST','paypal-transmission-sig':'TEST','paypal-transmission-time':'2026-10-30T00:00:00Z'};
  assert.throws(()=>webhookVerification(new Headers({...headers,'paypal-cert-url':'http://127.0.0.1/secret'}),{},config));
  const handler=webhookHandler({config,service:{rpc:()=>assert.fail()},fetcher:async(url)=>url.endsWith('/oauth2/token')?Response.json({access_token:'TESTTOKEN'}):Response.json({verification_status:'FAILURE'})});
  const response=await handler(new Request('https://function.example',{method:'POST',headers,body:JSON.stringify({event_type:'PAYMENT.CAPTURE.COMPLETED',resource:capture})}));
  assert.equal(response.status,401);
  assert.throws(()=>captureReference({event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{links:[{rel:'up',href:'https://evil.test/v2/payments/captures/'+capture.id}]}}));
});
const signatureHeaders={'paypal-cert-url':'https://api.paypal.com/v1/notifications/certs/TEST','paypal-auth-algo':'SHA256withRSA','paypal-transmission-id':'TEST','paypal-transmission-sig':'TEST','paypal-transmission-time':'2026-10-30T00:00:00Z'};
test('approved webhook captures only its recorded authorized business and settles the current capture',async()=>{
  let captured=false;const effects=[];
  const handler=webhookHandler({config,service:{rpc:async(name,args)=>{
    effects.push({name,args});
    if(name==='find_paypal_purchase')return {data:p};
    if(name==='paypal_purchase_capture_allowed')return {data:true};
    if(name==='settle_paypal_purchase')return {data:{status:'paid'}};
    assert.fail(name);
  }},fetcher:async(url,options)=>{
    if(url.endsWith('/oauth2/token'))return Response.json({access_token:'TESTTOKEN'});
    if(url.endsWith('/verify-webhook-signature'))return Response.json({verification_status:'SUCCESS'});
    if(url.endsWith('/orders/'+p.order_id+'/capture')){captured=true;assert.equal(options.headers['PayPal-Request-Id'],p.id+'-capture');return Response.json(order());}
    if(url.endsWith('/orders/'+p.order_id))return Response.json(captured?order():{...order(),status:'APPROVED',purchase_units:[orderPayload(p,config).purchase_units[0]]});
    if(url.endsWith('/captures/'+capture.id))return Response.json(capture);
    assert.fail('Unexpected URL');
  }});
  const result=await handler(new Request('https://function.example',{method:'POST',headers:signatureHeaders,body:JSON.stringify({event_type:'CHECKOUT.ORDER.APPROVED',resource:{id:p.order_id}})}));
  assert.equal(result.status,200);assert.equal(captured,true);assert.equal(effects.at(-1).name,'settle_paypal_purchase');
  assert.equal(effects.at(-1).args.p_revoked,false);
});
test('reversed payment keeps reconciliation working after new checkouts are disabled',async()=>{
  const effects=[];const handler=webhookHandler({config:{...config,enabled:false},service:{rpc:async(name,args)=>{effects.push({name,args});return {data:name==='find_paypal_purchase'?p:{status:'revoked'}};}},fetcher:async url=>{
    if(url.endsWith('/oauth2/token'))return Response.json({access_token:'TESTTOKEN'});
    if(url.endsWith('/verify-webhook-signature'))return Response.json({verification_status:'SUCCESS'});
    if(url.endsWith('/captures/'+capture.id))return Response.json({...capture,status:'REFUNDED'});
    if(url.endsWith('/orders/'+p.order_id))return Response.json(order());
    assert.fail('Unexpected URL');
  }});
  const result=await handler(new Request('https://function.example',{method:'POST',headers:signatureHeaders,body:JSON.stringify({event_type:'PAYMENT.CAPTURE.REVERSED',resource:{id:capture.id}})}));
  assert.equal(result.status,200);assert.equal(effects.at(-1).args.p_revoked,true);
});
test('authentication and cross-origin failures cannot create or query purchases',async()=>{
  const handler=checkoutHandler({config,authenticatedClient:()=>({auth:{getUser:async()=>({error:{message:'bad'},data:{}})}}),service:{rpc:()=>assert.fail()},fetcher:()=>assert.fail()});
  assert.equal((await handler(request({action:'create'}))).status,401);
  assert.equal((await handler(new Request('https://function.example',{method:'POST',headers:{Origin:'https://evil.test',Authorization:'Bearer token'},body:'{}'}))).status,403);
});
test('an approved webhook with transient capture failure returns503 so PayPal retries',async()=>{
  const handler=webhookHandler({config,service:{rpc:async name=>({data:name==='find_paypal_purchase'?p:true})},fetcher:async(url)=>{
    if(url.endsWith('/oauth2/token'))return Response.json({access_token:'TESTTOKEN'});
    if(url.endsWith('/verify-webhook-signature'))return Response.json({verification_status:'SUCCESS'});
    if(url.endsWith('/capture'))return Response.json({error:'temporary'},{status:503});
    if(url.endsWith('/orders/'+p.order_id))return Response.json({...order(),status:'APPROVED',purchase_units:[orderPayload(p,config).purchase_units[0]]});
    assert.fail('Unexpected URL');
  }});
  const result=await handler(new Request('https://function.example',{method:'POST',headers:signatureHeaders,body:JSON.stringify({event_type:'CHECKOUT.ORDER.APPROVED',resource:{id:p.order_id}})}));
  assert.equal(result.status,503);
});
test('canonical VOIDED closes only an uncaptured order; a404 or old CREATED cannot release the slot',async()=>{
  const effects=[];
  const rpc=async(name,args)=>{effects.push({name,args});return {status:'voided',paidUntil:null};};
  const result=await reconcilePurchase({p,config,rpc,paypal:{call:async()=>({...order(),status:'VOIDED',purchase_units:[orderPayload(p,config).purchase_units[0]]})}});
  assert.equal(result.status,'voided');assert.equal(effects[0].name,'retire_paypal_order');effects.length=0;
  await assert.rejects(reconcilePurchase({p,config,rpc,paypal:{call:async()=>{throw new Error('404');}}}));assert.equal(effects.length,0);
  assert.equal((await reconcilePurchase({p,config,rpc,paypal:{call:async()=>({...order(),status:'CREATED',purchase_units:[orderPayload(p,config).purchase_units[0]]})}})).status,'pending');assert.equal(effects.length,0);
  await assert.rejects(reconcilePurchase({p,config,rpc,paypal:{call:async()=>({...order(),status:'VOIDED'})}}));assert.equal(effects.length,0);
});
test('scheduler requires its dedicated secret and records transient errors without private payloads',async()=>{
  const secret='test-reconciliation-secret-32-characters-long';const calls=[];
  assert.equal(await authorizedReconciliation(secret,secret),true);assert.equal(await authorizedReconciliation('wrong',secret),false);assert.equal(await authorizedReconciliation('short','short'),false);
  const handler=reconciliationHandler({config,secret,service:{rpc:async(name,args)=>{
    calls.push({name,args});if(name==='claim_paypal_reconciliation')return {data:[{purchase:{...p,created_at:'2026-01-01'},leaseToken:'TESTLEASE'}]};return {data:null};
  }},fetcher:async()=>Response.json({error:'private upstream body'},{status:503})});
  const denied=await handler(new Request('https://function.example',{method:'POST'}));assert.equal(denied.status,401);assert.equal(calls.length,0);
  const result=await handler(new Request('https://function.example',{method:'POST',headers:{'x-moveflow-paypal-reconcile-secret':secret}}));
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{reviewed:1,issues:1,deferred:0});
  assert.deepEqual(calls.at(-1).args,{p_purchase_id:p.id,p_lease_token:'TESTLEASE',p_outcome:'retry',p_issue_code:'provider_retry'});
});
