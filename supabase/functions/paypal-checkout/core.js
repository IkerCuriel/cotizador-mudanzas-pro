// Shared pure validation and PayPal transport. Never log upstream bodies/tokens.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAYPAL_ID = /^[A-Z0-9]{10,32}$/;
export function configuration(env) {
  const mode = ['sandbox','live'].includes(env.PAYPAL_MODE) ? env.PAYPAL_MODE : null;
  let origin;
  try { const u=new URL(env.MOVEFLOW_SITE_ORIGIN); if(u.protocol==='https:' && !u.username && !u.password && u.pathname==='/' && !u.search && !u.hash) origin=u.origin; } catch {}
  const configured = Boolean(mode && origin && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && /^[A-Z0-9]{8,32}$/.test(env.PAYPAL_MERCHANT_ID||'') && env.PAYPAL_WEBHOOK_ID);
  return {
    mode, origin, configured,
    enabled: configured && env.PAYPAL_CHECKOUT_ENABLED==='true' && (mode==='sandbox' || env.PAYPAL_LIVE_APPROVED==='true'),
    api: mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com',
    approvalHost:mode==='live'?'www.paypal.com':'www.sandbox.paypal.com',
    clientId:env.PAYPAL_CLIENT_ID, secret:env.PAYPAL_CLIENT_SECRET, merchantId:env.PAYPAL_MERCHANT_ID, webhookId:env.PAYPAL_WEBHOOK_ID,
  };
}
export function minorUnits(value) {
  if(typeof value!=='string' || !/^\d{1,8}\.\d{2}$/.test(value)) throw new Error('Invalid amount');
  return Number(value.replace('.',''));
}
export function approvalUrl(order, config) {
  const raw=order?.links?.find(link=>link.rel==='payer-action'||link.rel==='approve')?.href;
  const u=new URL(raw);
  if(u.protocol!=='https:' || u.hostname!==config.approvalHost || u.port || u.username || u.password || u.searchParams.get('token')!==order.id) throw new Error('Invalid approval URL');
  return u.href;
}
export function orderPayload(p,config) {
  if(!UUID.test(p.id) || !['monthly_149','annual_1440'].includes(p.plan_code) || p.currency!=='MXN' || p.amount_minor!==(p.plan_code==='monthly_149'?14900:144000)) throw new Error('Invalid catalog');
  return {intent:'CAPTURE',purchase_units:[{reference_id:p.id,custom_id:p.id,invoice_id:`MF-${p.id}`,payee:{merchant_id:config.merchantId},description:`MoveFlow · ${p.months===12?'12 meses':'1 mes'} sin renovación automática`,amount:{currency_code:'MXN',value:(p.amount_minor/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{brand_name:'MoveFlow',locale:'es-MX',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:`${config.origin}/pago.html?purchase=${p.id}`,cancel_url:`${config.origin}/pago.html?cancelled=1&purchase=${p.id}`}}}};
}
export function verifyOrder(order,p,config) {
  const units=order?.purchase_units;
  if(!PAYPAL_ID.test(order?.id||'') || (p.order_id && order.id!==p.order_id) || order.intent!=='CAPTURE' || units?.length!==1) throw new Error('Invalid order');
  const unit=units[0];
  if(unit.reference_id!==p.id || unit.custom_id!==p.id || unit.invoice_id!==`MF-${p.id}` || unit.payee?.merchant_id!==config.merchantId || unit.amount?.currency_code!==p.currency || minorUnits(unit.amount?.value)!==p.amount_minor) throw new Error('Order mismatch');
  return unit;
}
export function verifyCapture(order,p,config,capture) {
  const unit=verifyOrder(order,p,config);
  const captures=unit.payments?.captures;
  if(captures?.length!==1 || !PAYPAL_ID.test(capture?.id||'') || captures[0].id!==capture.id || (p.capture_id && capture.id!==p.capture_id) || capture.amount?.currency_code!==p.currency || minorUnits(capture.amount?.value)!==p.amount_minor) throw new Error('Capture mismatch');
  if(capture.supplementary_data?.related_ids?.order_id && capture.supplementary_data.related_ids.order_id!==order.id) throw new Error('Capture order mismatch');
  const revoked=['REFUNDED','PARTIALLY_REFUNDED','REVERSED','DECLINED','FAILED'].includes(capture.status);
  if(!revoked && (capture.status!=='COMPLETED' || order.status!=='COMPLETED')) throw new Error('Payment pending');
  return {p_purchase_id:p.id,p_order_id:order.id,p_capture_id:capture.id,p_merchant_id:config.merchantId,p_amount_minor:p.amount_minor,p_currency:p.currency,p_revoked:revoked};
}
export function createPayPalClient(config, fetcher=fetch) {
  let tokenPromise;
  async function call(path,{method='GET',body,requestId}={}) {
    if(!path.startsWith('/v1/')&&!path.startsWith('/v2/')) throw new Error('Invalid API path');
    if(!tokenPromise) tokenPromise=(async()=>{
      const auth=await fetcher(`${config.api}/v1/oauth2/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${btoa(`${config.clientId}:${config.secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
      if(!auth.ok) throw new Error('Payment service unavailable');
      const result=await auth.json(); if(typeof result.access_token!=='string') throw new Error('Payment service unavailable'); return result.access_token;
    })().catch(error=>{tokenPromise=null;throw error;});
    const token=await tokenPromise;
    const result=await fetcher(config.api+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!result.ok) throw new Error('Payment service unavailable');
    return result.status===204?{}:result.json();
  }
  return {call};
}
export function webhookVerification(headers,event,config) {
  const certificate=headers.get('paypal-cert-url'); let url;
  try {url=new URL(certificate);} catch {throw new Error('Invalid signature headers');}
  if(url.protocol!=='https:' || !['api.paypal.com','api.sandbox.paypal.com'].includes(url.hostname) || !url.pathname.startsWith('/v1/notifications/certs/') || url.username || url.password || url.port) throw new Error('Invalid signature headers');
  const payload={auth_algo:headers.get('paypal-auth-algo'),cert_url:certificate,transmission_id:headers.get('paypal-transmission-id'),transmission_sig:headers.get('paypal-transmission-sig'),transmission_time:headers.get('paypal-transmission-time'),webhook_id:config.webhookId,webhook_event:event};
  if(Object.values(payload).some(v=>v===null||v==='')) throw new Error('Invalid signature headers');
  return payload;
}
