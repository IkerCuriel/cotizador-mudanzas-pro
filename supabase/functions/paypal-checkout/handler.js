import { UUID, approvalUrl, createPayPalClient, orderPayload, verifyOrder } from './core.js';
import { reconcilePurchase } from './reconcile.js';

export function checkoutHandler({config,authenticatedClient,service,fetcher=fetch}) {
  const rpc=async(client,name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw new Error('Account or payment unavailable');return data;};
  return async(request)=>{
    const cors={'Access-Control-Allow-Origin':config.origin||'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin','Cache-Control':'no-store'};
    const json=(body,status=200)=>Response.json(body,{status,headers:cors});
    if(request.headers.get('origin') && request.headers.get('origin')!==config.origin)return json({error:'Origen no permitido.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='POST')return json({error:'Método no permitido.'},405);
    const authorization=request.headers.get('authorization');
    if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||''))return json({error:'Inicia sesión para continuar.'},401);
    const client=authenticatedClient(authorization);
    const {data:auth,error:authError}=await client.auth.getUser();
    if(authError || !auth?.user?.email_confirmed_at)return json({error:'Verifica tu correo e inicia sesión.'},401);
    let input;
    try {const raw=await request.text();if(raw.length>8000)throw new Error();input=JSON.parse(raw);if(!input||Array.isArray(input))throw new Error();}catch{return json({error:'Solicitud inválida.'},400);}
    if(input.action==='status') {
      let available=false;
      if(config.enabled)try {available=await rpc(service,'paypal_checkout_available')===true;}catch{}
      return json({enabled:available,mode:config.configured?config.mode:null});
    }
    if(!config.configured)return json({error:'Los pagos todavía no están conectados.'},503);
    try {
      const paypal=createPayPalClient(config,fetcher);
      if(input.action==='create') {
        if(!config.enabled || await rpc(service,'paypal_checkout_available')!==true)return json({error:'Las contrataciones de pago aún no están habilitadas.'},503);
        if(!UUID.test(input.businessId||'') || !UUID.test(input.requestId||'') || !['monthly_149','annual_1440'].includes(input.planCode) || input.consentVersion!=='prepaid-v1')return json({error:'Revisa el negocio, plan y consentimiento.'},400);
        let p=await rpc(client,'prepare_paypal_purchase',{p_business_id:input.businessId,p_plan_code:input.planCode,p_request_id:input.requestId,p_consent_version:input.consentVersion});
        if(p.status!=='pending')return json({purchaseId:p.id,status:p.status,paidUntil:p.paid_until});
        let order;
        if(p.order_id)order=await paypal.call(`/v2/checkout/orders/${p.order_id}`);
        else {
          const created=await paypal.call('/v2/checkout/orders',{method:'POST',body:orderPayload(p,config),requestId:`${p.id}-create`});
          if(!/^[A-Z0-9]{10,32}$/.test(created?.id||''))throw new Error('Invalid PayPal order');
          order=await paypal.call(`/v2/checkout/orders/${created.id}`);
          verifyOrder(order,p,config);
          p=await rpc(service,'bind_paypal_order',{p_purchase_id:p.id,p_order_id:order.id,p_merchant_id:config.merchantId});
        }
        verifyOrder(order,p,config);
        if(order.status==='VOIDED')return json({purchaseId:p.id,...await reconcilePurchase({p,paypal,config,rpc:(name,args)=>rpc(service,name,args)})});
        if(order.status==='COMPLETED')return json({purchaseId:p.id,status:'pending'});
        return json({purchaseId:p.id,approvalUrl:approvalUrl(order,config)});
      }
      if(input.action==='capture') {
        if(!UUID.test(input.purchaseId||''))return json({error:'Referencia inválida.'},400);
        const p=await rpc(client,'get_my_paypal_purchase',{p_purchase_id:input.purchaseId});
        if(p.status==='revoked')return json({status:'revoked',paidUntil:p.paid_until});
        if(!p.order_id)return json({status:'pending',paidUntil:null});
        return json(await reconcilePurchase({p,paypal,config,rpc:(name,args)=>rpc(service,name,args)}));
      }
      return json({error:'Operación no reconocida.'},400);
    }catch {
      return json({error:'No pudimos confirmar la operación. Revisa tu cuenta y vuelve a consultar la misma compra; si el problema continúa, contacta a soporte.'},409);
    }
  };
}
