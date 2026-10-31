import { verifyCapture, verifyOrder } from './core.js';

/** Canonical verification shared by return, signed webhook and scheduled retry. */
export async function reconcilePurchase({p,paypal,rpc,config}) {
  if(p.status==='voided')return {status:'voided',paidUntil:null};
  if(!p.order_id)return {status:'pending',paidUntil:null,reason:'unbound_order'};
  let order=await paypal.call(`/v2/checkout/orders/${p.order_id}`);
  verifyOrder(order,p,config);
  if(order.status==='VOIDED') {
    if(order.purchase_units[0].payments?.captures?.length)throw new Error('Voided order includes a capture');
    return rpc('retire_paypal_order',{p_purchase_id:p.id,p_order_id:order.id,p_verified_status:'VOIDED'});
  }
  let attemptedCapture=false;
  if(order.status==='APPROVED' && !order.purchase_units[0].payments?.captures?.length) {
    if(await rpc('paypal_purchase_capture_allowed',{p_purchase_id:p.id})!==true)return {status:'pending',paidUntil:p.paid_until,reason:'capture_blocked'};
    attemptedCapture=true;
    try {await paypal.call(`/v2/checkout/orders/${p.order_id}/capture`,{method:'POST',body:{},requestId:`${p.id}-capture`});}catch{}
    // Lost responses do not prove failure or success. Always consult PayPal.
    order=await paypal.call(`/v2/checkout/orders/${p.order_id}`);
    verifyOrder(order,p,config);
  }
  const captures=order.purchase_units[0].payments?.captures;
  if(!captures?.length) {
    if(attemptedCapture || order.status==='COMPLETED')throw new Error('Capture is not yet verifiable');
    return {status:'pending',paidUntil:null,reason:'awaiting_approval'};
  }
  if(captures.length!==1)throw new Error('Unexpected capture count');
  const capture=await paypal.call(`/v2/payments/captures/${captures[0].id}`);
  if(capture.status==='PENDING')return {status:'pending',paidUntil:null,reason:'capture_pending'};
  return rpc('settle_paypal_purchase',verifyCapture(order,p,config,capture));
}
