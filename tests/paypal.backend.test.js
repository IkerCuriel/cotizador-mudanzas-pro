import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PayPal prepaid permissions, deduplication and business entitlements',async suite=>{
  const db=new PGlite();
  const owner='00000000-0000-4000-8000-000000000001', stranger='00000000-0000-4000-8000-000000000002';
  const request='00000000-0000-4000-8000-000000000010';
  try {
    await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
      create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    const dir=new URL('../supabase/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    for(const id of [owner,stranger])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`${id}@example.test`]);
    await db.exec(`update public.profiles set role='provider',provider_status='approved';update private.platform_settings set accepting_requests=true;`);
    const business=(await db.query("insert into public.businesses(slug,name,whatsapp,status) values('billing-test','Test Billing','525500000001','approved') returning id")).rows[0].id;
    const other=(await db.query("insert into public.businesses(slug,name,whatsapp,status) values('billing-other','Other Billing','525500000002','approved') returning id")).rows[0].id;
    await db.query("insert into public.business_memberships(business_id,user_id,member_role) values($1,$2,'owner'),($3,$2,'owner')",[business,owner,other]);
    const as=async(id=owner,aal='aal2')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({aal})]);await db.exec('set role authenticated');};
    const server=()=>db.exec('reset role;set role service_role');
    const root=()=>db.exec('reset role');
    const rpc=async(name,args,placeholders)=> (await db.query(`select public.${name}(${placeholders}) result`,args)).rows[0].result;
    const create=(plan='monthly_149',id=request)=>rpc('prepare_paypal_purchase',[business,plan,id,'prepaid-v1'],'$1,$2,$3,$4');
    const settle=p=>rpc('settle_paypal_purchase',[p.id,'ORDER1234567890123','CAPTURE12345678901','MERCHANT12345',p.amount_minor,'MXN',false],'$1,$2,$3,$4,$5,$6,$7');
    const denied=async fn=>{await db.exec('savepoint denied');try{await assert.rejects(fn);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}};
    const check=(name,fn)=>suite.test(name,async()=>{await root();await db.exec('begin');try{await fn();}finally{await db.exec('rollback');await root();}});
    await check('checkout is closed by default and cannot be activated by a customer',async()=>{
      await as();await denied(()=>create());await denied(()=>db.query('update private.subscription_plans set checkout_enabled=true'));
      await denied(()=>rpc('settle_paypal_purchase',[request,'ORDER1234567890123','CAPTURE12345678901','MERCHANT12345',14900,'MXN',false],'$1,$2,$3,$4,$5,$6,$7'));
      await server();assert.equal(await rpc('paypal_checkout_available',[],''),false);
    });
    await check('verified owner and MFA are required; browser amount and annual/month mismatch are not accepted',async()=>{
      await db.exec('update private.subscription_plans set checkout_enabled=true');
      await as(stranger);await denied(()=>create());await as(owner,'aal1');await denied(()=>create());
      await as();await denied(()=>create('annual_120'));await root();await db.query('update auth.users set email_confirmed_at=null where id=$1',[owner]);await as();await denied(()=>create());
    });
    await check('repeated creation/capture grants exactly one business period; unknown user cannot read it',async()=>{
      await db.exec('update private.subscription_plans set checkout_enabled=true');await as();
      const p=await create();assert.equal(p.amount_minor,14900);assert.equal((await create()).id,p.id);
      assert.equal((await create('monthly_149','00000000-0000-4000-8000-000000000011')).id,p.id);
      await denied(()=>create('annual_1440'));await as(stranger);await denied(()=>rpc('get_my_paypal_purchase',[p.id],'$1'));
      await server();await rpc('bind_paypal_order',[p.id,'ORDER1234567890123','MERCHANT12345'],'$1,$2,$3');
      const result=await settle(p);assert.equal(result.status,'paid');assert.deepEqual(await settle(p),result);
      await as();assert.equal((await rpc('get_my_access_status',[],'' )).provider_access_active,true);
      await root();assert.equal((await db.query('select private.provider_has_business_access($1,$2) ok',[owner,other])).rows[0].ok,false);
      await db.query("update public.businesses set status='suspended' where id=$1",[business]);await as();assert.equal((await rpc('get_my_access_status',[],'' )).provider_access_active,false);
    });
    await check('refund is monotonic and cannot be undone by a delayed completed event',async()=>{
      await db.exec('update private.subscription_plans set checkout_enabled=true');await as();const p=await create('annual_1440');assert.equal(p.amount_minor,144000);assert.equal(p.months,12);
      await server();await rpc('bind_paypal_order',[p.id,'ORDER1234567890123','MERCHANT12345'],'$1,$2,$3');
      await settle(p);
      await denied(()=>rpc('settle_paypal_purchase',[p.id,'ORDER1234567890123','CAPTURE12345678901','WRONGMERCHANT',144000,'MXN',false],'$1,$2,$3,$4,$5,$6,$7'));
      await denied(()=>rpc('settle_paypal_purchase',[p.id,'ORDER1234567890123','CAPTURE12345678901','MERCHANT12345',12000,'MXN',false],'$1,$2,$3,$4,$5,$6,$7'));
      await rpc('settle_paypal_purchase',[p.id,'ORDER1234567890123','CAPTURE12345678901','MERCHANT12345',144000,'MXN',true],'$1,$2,$3,$4,$5,$6,$7');
      assert.equal((await settle(p)).status,'revoked');await as();assert.equal((await rpc('get_my_access_status',[],'' )).provider_access_active,false);
    });
    await check('only a server-confirmed VOIDED order frees a pending purchase; a paid order never retires',async()=>{
      await db.exec('update private.subscription_plans set checkout_enabled=true');await as();const p=await create();
      await denied(()=>rpc('retire_paypal_order',[p.id,'ORDER1234567890123','VOIDED'],'$1,$2,$3'));
      await server();await rpc('bind_paypal_order',[p.id,'ORDER1234567890123','MERCHANT12345'],'$1,$2,$3');
      await denied(()=>rpc('retire_paypal_order',[p.id,'ORDER1234567890123','CREATED'],'$1,$2,$3'));
      assert.equal((await rpc('retire_paypal_order',[p.id,'ORDER1234567890123','VOIDED'],'$1,$2,$3')).status,'voided');
      await as();const second=await create('annual_1440','00000000-0000-4000-8000-000000000012');assert.notEqual(second.id,p.id);
      await server();await rpc('bind_paypal_order',[second.id,'ORDER2234567890123','MERCHANT12345'],'$1,$2,$3');
      await rpc('settle_paypal_purchase',[second.id,'ORDER2234567890123','CAPTURE22345678901','MERCHANT12345',144000,'MXN',false],'$1,$2,$3,$4,$5,$6,$7');
      await denied(()=>rpc('retire_paypal_order',[second.id,'ORDER2234567890123','VOIDED'],'$1,$2,$3'));
    });
    await check('reconciliation leases deduplicate workers and create private auditable issues without exposing purchases',async()=>{
      await db.exec('update private.subscription_plans set checkout_enabled=true');await as();const p=await create();
      await denied(()=>rpc('claim_paypal_reconciliation',[10],'$1'));
      await denied(()=>rpc('get_paypal_operational_summary',[],''));
      await server();const jobs=await rpc('claim_paypal_reconciliation',[999],'$1');assert.equal(jobs.length,1);assert.equal(jobs[0].purchase.id,p.id);
      assert.deepEqual(await rpc('claim_paypal_reconciliation',[10],'$1'),[]);
      await denied(()=>rpc('finish_paypal_reconciliation',[p.id,request,'retry','provider_retry'],'$1,$2,$3,$4'));
      await rpc('finish_paypal_reconciliation',[p.id,jobs[0].leaseToken,'retry','provider_retry'],'$1,$2,$3,$4');
      await root();assert.equal((await db.query('select count(*)::int n from private.paypal_operational_issues where resolved_at is null')).rows[0].n,1);
      const audit=(await db.query("select details from private.audit_events where action='paypal_reconciliation_issue'")).rows[0].details;
      assert.deepEqual(Object.keys(audit).sort(),['code','purchase_id']);
      await db.query("update public.profiles set role='superadmin' where id=$1",[owner]);await as();
      const overview=await rpc('get_paypal_operational_summary',[],'' );assert.equal(overview.openIssues,1);assert.equal(overview.pendingPurchases,1);
      await as(owner,'aal1');await denied(()=>rpc('get_paypal_operational_summary',[],''));
    });
  }finally{await db.close();}
});
