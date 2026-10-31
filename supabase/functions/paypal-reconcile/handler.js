import { createPayPalClient } from '../paypal-checkout/core.js';
import { reconcilePurchase } from '../paypal-checkout/reconcile.js';

export async function authorizedReconciliation(value,secret) {
  if(typeof secret!=='string'||secret.length<32||typeof value!=='string'||value.length>512)return false;
  const encode=new TextEncoder();
  const [a,b]=await Promise.all([value,secret].map(text=>crypto.subtle.digest('SHA-256',encode.encode(text))));
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let different=0;for(let i=0;i<aa.length;i++)different|=aa[i]^bb[i];return different===0;
}
export function reconciliationHandler({config,secret,service,fetcher=fetch}) {
  const rpc=async(name,args)=>{const {data,error}=await service.rpc(name,args);if(error)throw new Error('Reconciliation storage unavailable');return data;};
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  return async request=>{
    if(request.method!=='POST')return reply({error:'Method not allowed'},405);
    if(!await authorizedReconciliation(request.headers.get('x-moveflow-paypal-reconcile-secret'),secret))return reply({error:'Unauthorized'},401);
    // New checkout may be disabled; previously approved payments still reconcile.
    if(!config.configured)return reply({error:'Payment service unavailable'},503);
    let jobs;
    try {jobs=await rpc('claim_paypal_reconciliation',{p_limit:10});if(!Array.isArray(jobs))throw new Error();}catch{return reply({error:'Queue unavailable'},503);}
    const paypal=createPayPalClient(config,fetcher);
    let reviewed=0,issues=0,deferred=0;
    await Promise.all(jobs.map(async job=>{
      let outcome='retry',issue='provider_retry';
      try {
        const result=await reconcilePurchase({p:job.purchase,paypal,rpc,config});
        outcome=result.status;issue=null;
        if(['capture_blocked','unbound_order'].includes(result.reason))issue=result.reason;
        // Age is only an operational flag, never proof of expiration or permission
        // to create another order while the previous one may still be payable.
        if(result.reason==='awaiting_approval' && Date.now()-Date.parse(job.purchase.created_at)>86400000)issue='awaiting_approval';
      }catch{}
      try {
        await rpc('finish_paypal_reconciliation',{p_purchase_id:job.purchase.id,p_lease_token:job.leaseToken,p_outcome:outcome,p_issue_code:issue});
        reviewed++;if(issue)issues++;
      }catch{deferred++;}
    }));
    return reply({reviewed,issues,deferred},deferred?503:200);
  };
}
