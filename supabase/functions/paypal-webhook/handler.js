import { PAYPAL_ID, createPayPalClient, verifyCapture, webhookVerification } from '../paypal-checkout/core.js';
import { reconcilePurchase } from '../paypal-checkout/reconcile.js';

const recognized=new Set(['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.DECLINED']);
export function captureReference(event) {
  if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'].includes(event.event_type)) {
    const direct=event.resource?.supplementary_data?.related_ids?.capture_id;
    if(PAYPAL_ID.test(direct||''))return direct;
    const up=event.resource?.links?.find(link=>link.rel==='up')?.href;
    if(up || event.event_type==='PAYMENT.CAPTURE.REFUNDED') {
      const url=new URL(up);
      if(url.protocol!=='https:' || !['api.paypal.com','api.sandbox.paypal.com','api-m.paypal.com','api-m.sandbox.paypal.com'].includes(url.hostname) || url.port || url.username || url.password)throw new Error('Invalid capture link');
      const match=/^\/v2\/payments\/captures\/([A-Z0-9]{10,32})$/.exec(url.pathname);
      if(!match)throw new Error('Invalid capture link');return match[1];
    }
  }
  if(!PAYPAL_ID.test(event.resource?.id||''))throw new Error('Invalid capture reference');
  return event.resource.id;
}
export function webhookHandler({config,service,fetcher=fetch}) {
  const rpc=async(name,args)=>{const {data,error}=await service.rpc(name,args);if(error)throw new Error('Payment storage unavailable');return data;};
  return async request=>{
    const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
    // Reconciliation stays enabled when new checkouts are disabled.
    if(!config.configured)return reply(503,{error:'Payment service unavailable'});
    let event,verification;
    try {const raw=await request.text();if(raw.length>100000)throw new Error();event=JSON.parse(raw);verification=webhookVerification(request.headers,event,config);}catch{return reply(400,{error:'Invalid webhook'});}
    const paypal=createPayPalClient(config,fetcher);
    try {
      const signed=await paypal.call('/v1/notifications/verify-webhook-signature',{method:'POST',body:verification});
      if(signed.verification_status!=='SUCCESS')return reply(401,{error:'Invalid signature'});
      if(!recognized.has(event.event_type))return reply(200,{received:true});
      let order,capture,p;
      if(event.event_type==='CHECKOUT.ORDER.APPROVED') {
        if(!PAYPAL_ID.test(event.resource?.id||''))throw new Error('Invalid order');
        p=await rpc('find_paypal_purchase',{p_order_id:event.resource.id});
        if(!p)return reply(200,{received:true});
        await reconcilePurchase({p,paypal,rpc,config});
        return reply(200,{received:true});
      }else {
        const captureId=captureReference(event);
        capture=await paypal.call(`/v2/payments/captures/${captureId}`);
        const orderId=capture.supplementary_data?.related_ids?.order_id;
        if(!PAYPAL_ID.test(orderId||''))throw new Error('Missing order reference');
        p=await rpc('find_paypal_purchase',{p_order_id:orderId});
        if(!p)return reply(200,{received:true});
        order=await paypal.call(`/v2/checkout/orders/${orderId}`);
      }
      if(capture.status==='PENDING')return reply(200,{received:true});
      const verified=verifyCapture(order,p,config,capture);
      if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.DECLINED'].includes(event.event_type) && !verified.p_revoked)throw new Error('Wait for current payment state');
      await rpc('settle_paypal_purchase',verified);
      return reply(200,{received:true});
    }catch{return reply(503,{error:'Reconciliation pending'});}
  };
}
