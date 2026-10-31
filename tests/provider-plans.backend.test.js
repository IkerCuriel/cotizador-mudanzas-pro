import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeDraft } from '../src/request.js';

const ids=Object.fromEntries(['owner','admin','tere','marco','newMember','other','alice','unverified'].map((name,index)=>[name,`00000000-0000-4000-8030-${String(index+1).padStart(12,'0')}`]));
const draft=()=>normalizeDraft({fields:{origin:'Origen de prueba',destination:'Destino de prueba',customerName:'Cliente de prueba',phone:'5500000000',privacyConsent:true},inventory:{'bed-queen':1}});

await test('planes: cortesía privada por integrante sin cobros ni ampliación de permisos',async suite=>{
  const db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,migrations),'utf8'));
  for(const [name,id] of Object.entries(ids)) await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)`,[id,`${name}@example.test`,name==='unverified'?null:new Date().toISOString(),{role:'provider',plan_expires_at:'9999-01-01',provider_access_active:true,is_family:true,complimentary:true}]);
  await db.query(`update public.profiles set role='superadmin' where id=$1`,[ids.owner]);
  await db.query(`update public.profiles set role='admin' where id=$1`,[ids.admin]);
  await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=null,is_family=true where id=any($1::uuid[])`,[[ids.tere,ids.marco,ids.newMember]]);
  await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '1 day' where id=$1`,[ids.other]);
  const business=(await db.query(`select id from public.businesses where slug='d-curiel'`)).rows[0].id;
  const otherBusiness=(await db.query(`insert into public.businesses(slug,name,whatsapp,status) values('otro-negocio','Otro negocio','525500000001','approved') returning id`)).rows[0].id;
  await db.query('insert into public.business_memberships(business_id,user_id) values($1,$2)',[otherBusiness,ids.other]);
  await db.exec(`update private.platform_settings set accepting_requests=true; update private.push_settings set enabled=true;`);
  const root=()=>db.exec('reset role');
  const as=async(who,aal='aal2')=>{await root();await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,[ids[who]||'',JSON.stringify({aal})]);await db.exec(`set role ${who?'authenticated':'anon'}`);};
  const access=()=>db.query('select public.get_my_access_status() result').then(r=>r.rows[0].result);
  const grant=(who,enabled=true)=>db.query('select public.set_provider_complimentary_access($1,$2)',[ids[who],enabled]);
  const submit=(reference='MF-PLAN-001',slug='d-curiel')=>db.query('select to_jsonb(public.submit_business_request($1,$2::jsonb,$3)) request',[reference,JSON.stringify(draft()),slug]).then(r=>r.rows[0].request);
  const denied=async(fn,pattern)=>{await db.exec('savepoint denied');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint denied; release savepoint denied');}};
  const check=async(name,fn)=>suite.test(name,async()=>{await root();await db.exec('begin');try{await fn();}finally{await db.exec('rollback');await root();}});
  const enableTeam=async()=>{await as('owner');await grant('tere');await grant('marco');};
  const register=async(who,suffix=who)=>{await as(who);return db.query('select public.register_push_device($1,$2,$3,$4,$5)',['https://fcm.googleapis.com/send/plan-'+suffix,'B'+'a'.repeat(86),'b'.repeat(22),'Prueba',ids[who]]);};
  try{
    await check('catálogo149 cerrado, sin derechos por correo ni metadata; tablas y administración privadas',async()=>{
      assert.deepEqual((await db.query('select code,amount_minor,currency,billing_interval,checkout_enabled from private.subscription_plans')).rows,[{code:'monthly_149',amount_minor:14900,currency:'MXN',billing_interval:'month',checkout_enabled:false}]);
      assert.equal((await db.query('select count(*)::int n from private.provider_complimentary_access')).rows[0].n,0);
      await as(null);await denied(access,/permission denied/);
      await as('unverified');await denied(access,/Verifica tu correo/);
      for(const who of ['alice','tere','admin']){
        await as(who);await denied(()=>db.query('select * from private.provider_complimentary_access'),/permission denied/);
        await denied(()=>db.query('select * from private.subscription_plans'),/permission denied/);
        await denied(()=>grant('tere'),/Solo el superusuario/);
      }
      await as('alice');assert.deepEqual(await access(),{access_version:1,provider_access_active:false});
      await as('owner','aal1');await denied(()=>grant('tere'),/segundo factor/);
      await as('owner');await denied(()=>grant('other'),/integrante activo/);
      await denied(()=>grant('alice'),/integrante activo/);
    });
    await check('dos cortesías explícitas habilitan entrega y lectura sin inventar vigencia o aprobar otros integrantes',async()=>{
      await enableTeam();
      await as('alice');const request=await submit();
      for(const who of ['tere','marco']){
        await as(who);assert.deepEqual(await access(),{access_version:1,provider_access_active:true});
        assert.equal((await db.query('select plan_expires_at from public.profiles where id=$1',[ids[who]])).rows[0].plan_expires_at,null);
        assert.deepEqual((await db.query('select id from public.move_requests')).rows.map(r=>r.id),[request.id]);
        assert.equal((await db.query('select id from public.notifications')).rows.length,1);
        assert.equal((await db.query('select * from public.get_my_businesses()')).rows[0].slug,'d-curiel');
      }
      await as('newMember');assert.equal((await access()).provider_access_active,false);assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      await denied(()=>register('newMember'),/segundo factor/);
      await as('other');assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      await root();assert.equal((await db.query('select count(*)::int n from public.request_recipients')).rows[0].n,2);
      assert.equal((await db.query("select count(*)::int n from private.audit_events where action='provider_complimentary_access_changed'")).rows[0].n,2);
      await as('alice');await submit();await root();assert.equal((await db.query('select request_count from private.business_monthly_usage where business_id=$1',[business])).rows[0].request_count,1);
    });
    await check('cortesía de D’Curiel no cubre otro negocio y los planes temporales siguen venciendo',async()=>{
      await enableTeam();await root();await db.query('insert into public.business_memberships(business_id,user_id) values($1,$2)',[otherBusiness,ids.tere]);
      await as('alice');await submit('MF-OTHER-001','otro-negocio');
      await as('tere');assert.equal((await db.query('select id from public.move_requests')).rows.length,0);assert.deepEqual((await db.query('select slug from public.get_my_businesses()')).rows.map(r=>r.slug),['d-curiel']);
      await root();await db.query(`update public.profiles set plan_expires_at=now()-interval '1 day' where id=$1`,[ids.other]);
      await as('other');assert.equal((await access()).provider_access_active,false);assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      await as('alice');await denied(()=>submit('MF-OTHER-002','otro-negocio'),/No hay una empresa habilitada/);
    });
    await check('suspensión, retiro de membresía, negocio y MFA siguen revocando acceso con cortesía',async()=>{
      await enableTeam();await as('alice');const request=await submit();
      for(const change of ['provider','business','membership','team','mfa','revoked','cancelled']){
        await root();await db.exec('savepoint scenario');
        if(change==='provider') await db.query("update public.profiles set provider_status='suspended' where id=$1",[ids.tere]);
        if(change==='business') await db.query("update public.businesses set status='suspended' where id=$1",[business]);
        if(change==='membership') await db.query('update public.business_memberships set active=false where user_id=$1',[ids.tere]);
        if(change==='team') await db.query('update public.profiles set is_family=false where id=$1',[ids.tere]);
        if(change==='revoked'){await as('owner');await grant('tere',false);}
        if(change==='cancelled') await db.query("update public.move_requests set status='cancelled' where id=$1",[request.id]);
        await as('tere',change==='mfa'?'aal1':'aal2');
        if(change!=='cancelled') assert.equal((await access()).provider_access_active,false,change);
        assert.equal((await db.query('select id from public.move_requests')).rows.length,0,change);
        assert.equal((await db.query('select id from public.notifications')).rows.length,0,change);
        await root();await db.exec('rollback to savepoint scenario; release savepoint scenario');
      }
    });
    await check('reingresar al equipo no resucita una cortesía retirada; revocar tras suspensión sigue permitido',async()=>{
      await enableTeam();await root();await db.query('update public.business_memberships set active=false where user_id=$1',[ids.tere]);
      await db.query('update public.business_memberships set active=true where user_id=$1',[ids.tere]);
      await as('tere');assert.equal((await access()).provider_access_active,false);
      await as('owner');await grant('tere');await root();await db.query("update public.profiles set provider_status='suspended' where id=$1",[ids.tere]);
      await as('owner');await grant('tere',false);await denied(()=>grant('tere',true),/integrante activo/);
      await root();assert.equal((await db.query('select enabled from private.provider_complimentary_access where user_id=$1',[ids.tere])).rows[0].enabled,false);
    });
    await check('operación de propietario exige UUID explícitos y conserva el resto de permisos',async()=>{
      const template=await readFile(new URL('../supabase/operations/configure-complimentary.sql',import.meta.url),'utf8');
      // Execute the DO body inside this test transaction; leave production BEGIN/COMMIT intact.
      const body=template.slice(template.indexOf('do $$'),template.indexOf('commit;'));
      await denied(()=>db.exec(body),/Completa los dos UUID/);
      const configured=body.replace('v_tere_id uuid := null;',`v_tere_id uuid := '${ids.tere}';`).replace('v_marco_id uuid := null;',`v_marco_id uuid := '${ids.marco}';`);
      await db.exec(configured);
      assert.equal((await db.query('select count(*)::int n from private.provider_complimentary_access where enabled')).rows[0].n,2);
      assert.equal((await db.query('select count(*)::int n from public.profiles where id=any($1::uuid[]) and plan_expires_at is null',[[ids.tere,ids.marco]])).rows[0].n,2);
      await as('tere');await denied(()=>db.exec(configured),/requiere al propietario/);
    });
    await check('push entrega con cortesía y vuelve a comprobar autorización después de reclamar un aviso',async()=>{
      await enableTeam();await register('tere');await as('alice');await submit();
      await root();await db.exec('set role service_role');const [job]=(await db.query('select public.claim_push_jobs() jobs')).rows[0].jobs;assert.ok(job);
      assert.equal((await db.query('select public.push_job_is_current($1,$2) current',[job.id,job.lease_token])).rows[0].current,true);
      await as('owner');await grant('tere',false);
      await root();await db.exec('set role service_role');assert.equal((await db.query('select public.push_job_is_current($1,$2) current',[job.id,job.lease_token])).rows[0].current,false);
    });
  }finally{await db.close();}
});
