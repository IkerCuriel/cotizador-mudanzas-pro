import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeDraft } from '../src/request.js';

const ids = Object.fromEntries(['owner','tere','marco','other','alice','bob','unverified'].map((name,index)=>[name,`00000000-0000-4000-8010-${String(index+1).padStart(12,'0')}`]));
const draft=()=>normalizeDraft({fields:{origin:'Origen de prueba',destination:'Destino de prueba',customerName:'Cliente de prueba',phone:'5500000000',privacyConsent:true},inventory:{'bed-queen':1}});

await test('negocios: aislamiento, cuotas y entrega acotada con PostgreSQL real',async suite=>{
  const db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,migrations),'utf8'));
  for(const [name,id] of Object.entries(ids)) await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)`,[id,`${name}@example.test`,name==='unverified'?null:new Date().toISOString(),{role:'superadmin',business_id:'injected',is_family:true}]);
  await db.query(`update public.profiles set role='superadmin' where id=$1`,[ids.owner]);
  await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '30 days',is_family=true where id=any($1::uuid[])`,[[ids.tere,ids.marco]]);
  await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '30 days' where id=$1`,[ids.other]);
  const family=(await db.query(`select id from public.businesses where slug='d-curiel'`)).rows[0].id;
  const other=(await db.query(`insert into public.businesses(slug,name,whatsapp,status) values('otro-negocio','Otro negocio de prueba','525500000001','approved') returning id`)).rows[0].id;
  await db.query(`insert into public.business_memberships(business_id,user_id) values($1,$2)`,[other,ids.other]);
  await db.exec(`update private.platform_settings set accepting_requests=true`);
  const root=()=>db.exec('reset role');
  const as=async(who,aal=['owner','tere','marco','other'].includes(who)?'aal2':'aal1')=>{await root();await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,[ids[who]||'',JSON.stringify({aal})]);await db.exec(`set role ${who?'authenticated':'anon'}`);};
  const submit=(reference='MF-BIZ-001',slug='d-curiel',payload=draft(),version='2026-10-30')=>db.query(`select to_jsonb(public.submit_business_request($1,$2::jsonb,$3,$4)) as request`,[reference,JSON.stringify(payload),slug,version]).then(result=>result.rows[0].request);
  const denied=async(fn,pattern)=>{await db.exec('savepoint denied');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint denied; release savepoint denied');}};
  const check=async(name,fn)=>suite.test(name,async()=>{await root();await db.exec('begin');try{await fn();}finally{await db.exec('rollback');await root();}});
  try{
    await check('metadatos y cliente no pueden crear negocios ni autoasignarse',async()=>{
      await as('alice');
      assert.deepEqual((await db.query('select * from public.get_my_businesses()')).rows,[]);
      assert.deepEqual((await db.query('select * from public.business_memberships')).rows,[]);
      await denied(()=>db.query(`insert into public.businesses(slug,name,whatsapp,status) values('fraude','Falso','525500000000','approved')`),/permission denied/);
      await denied(()=>db.query(`insert into public.business_memberships(business_id,user_id) values($1,$2)`,[family,ids.alice]),/permission denied/);
      await denied(()=>db.query(`update public.businesses set monthly_request_limit=100000`),/permission denied/);
      await as(null); await denied(()=>submit(),/permission denied/);
      await as('unverified'); await denied(()=>submit(),/Verifica tu correo/);
    });
    await check('D’Curiel recibe dos avisos; otro negocio y otro cliente no ven esa solicitud',async()=>{
      await as('alice'); const request=await submit(); assert.equal(request.business_id,family);
      await as('tere'); assert.equal((await db.query('select id from public.move_requests')).rows[0].id,request.id);
      assert.equal((await db.query('select * from public.get_my_businesses()')).rows[0].slug,'d-curiel');
      await as('marco'); assert.equal((await db.query('select id from public.notifications')).rows.length,1);
      await as('other'); assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      assert.equal((await db.query('select id from public.notifications')).rows.length,0);
      assert.equal((await db.query('select * from public.get_my_businesses()')).rows[0].id,other);
      await as('bob'); assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      await root(); assert.equal((await db.query('select count(*)::int n from public.request_recipients')).rows[0].n,2);
    });
    await check('seleccionar otro negocio entrega solo a su equipo, sin familia implícita',async()=>{
      await as('alice'); const request=await submit('MF-OTHER-001','otro-negocio'); assert.equal(request.business_id,other); assert.equal(request.audience,'business');
      await as('other'); assert.equal((await db.query('select id from public.move_requests')).rows[0].id,request.id);
      await as('tere'); assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      await root(); assert.equal((await db.query('select count(*)::int n from public.request_recipients')).rows[0].n,1);
      assert.equal((await db.query('select count(*)::int n from public.notifications')).rows[0].n,1);
    });
    await check('reintentos no duplican cuota, avisos ni destinatarios; cambio de negocio se rechaza',async()=>{
      await as('alice'); const first=await submit();const repeated=await submit();assert.equal(first.id,repeated.id);
      await denied(()=>submit('MF-BIZ-001','otro-negocio'),/otros datos o negocio/);
      await denied(()=>submit('MF-BIZ-001','d-curiel',draft(),null),/otros datos o negocio/);
      await root();
      assert.equal((await db.query('select sum(request_count)::int n from private.business_monthly_usage')).rows[0].n,1);
      assert.equal((await db.query('select count(*)::int n from public.notifications')).rows[0].n,2);
      assert.equal((await db.query('select count(*)::int n from public.move_requests')).rows[0].n,1);
    });
    await check('cuota mensual se aplica por negocio y un reintento sigue siendo idempotente al agotarla',async()=>{
      await db.query('update public.businesses set monthly_request_limit=1 where id=$1',[family]);
      await as('alice'); const first=await submit(); await submit();
      await as('bob'); await denied(()=>submit('MF-OVER-002'),/límite mensual/);
      await submit('MF-FREE-001','otro-negocio');
      await root(); assert.equal((await db.query('select request_count from private.business_monthly_usage where business_id=$1',[family])).rows[0].request_count,1);
      await as('alice'); await db.query('select public.cancel_request($1)',[first.id]);
      await denied(()=>submit('MF-OVER-003'),/límite mensual/);
    });
    await check('consumo de otro mes no impide recibir este mes y la fecha usa UTC',async()=>{
      await db.query('update public.businesses set monthly_request_limit=1 where id=$1',[family]);
      await db.query(`insert into private.business_monthly_usage(business_id,month_start,request_count) values($1,(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date,1)`,[family]);
      await as('alice');await submit();await root();
      const rows=(await db.query(`select month_start,request_count from private.business_monthly_usage where business_id=$1 order by month_start`,[family])).rows;
      assert.equal(rows.length,2);assert.ok(rows.every(row=>row.request_count===1));
    });
    await check('una falla de destinatarios revierte solicitud y consumo atómicamente',async()=>{
      await db.query('update public.business_memberships set active=false where business_id=$1',[family]);
      await as('alice'); await denied(()=>submit(),/No hay una empresa habilitada/);
      await root(); assert.equal((await db.query('select count(*)::int n from public.move_requests')).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from private.business_monthly_usage')).rows[0].n,0);
    });
    await check('red global falla cerrada aunque se active su antiguo indicador',async()=>{
      await db.exec('update private.platform_settings set network_enabled=true');
      await as('alice'); const network={...draft(),fields:{...draft().fields,networkConsent:true}};
      await denied(()=>db.query(`select public.submit_request('MF-NET-001',$1,'network','2026-10-30')`,[network]),/selecciona un negocio/);
      const settings=(await db.query('select public.public_site_config() config')).rows[0].config;
      assert.equal(settings.network_enabled,false);assert.equal(settings.business_routing_version,1);
      await root();assert.equal((await db.query('select count(*)::int n from public.move_requests')).rows[0].n,0);
    });
    await check('MFA, membresía y estado del negocio revocan datos y avisos, no solo botones',async()=>{
      await as('alice');const request=await submit();
      await as('tere');const notification=(await db.query('select id from public.notifications')).rows[0].id;
      await as('tere','aal1');assert.equal((await db.query('select id from public.move_requests')).rows.length,0);
      assert.equal((await db.query('select id from public.notifications')).rows.length,0);
      await denied(()=>db.query('select * from public.get_my_businesses()'),/segundo factor/);
      await root();await db.query('update public.business_memberships set active=false where user_id=$1',[ids.tere]);
      await as('tere');assert.equal((await db.query('select id from public.move_requests')).rows.length,0);assert.equal((await db.query('select id from public.notifications')).rows.length,0);
      await denied(()=>db.query('select public.mark_notification_read($1)',[notification]),/No se encontró/);
      await as('marco');assert.equal((await db.query('select id from public.move_requests')).rows[0].id,request.id);
      await root();await db.query(`update public.businesses set status='suspended' where id=$1`,[family]);
      await as('marco');assert.equal((await db.query('select id from public.move_requests')).rows.length,0);assert.equal((await db.query('select id from public.notifications')).rows.length,0);
      await as('alice');await denied(()=>submit('MF-SUSPENDED-001'),/negocio no está disponible/);
    });
    await check('la cola push vuelve a comprobar negocio y membresía antes de entregar',async()=>{
      await db.exec('update private.push_settings set enabled=true');
      await as('tere'); await db.query('select public.register_push_device($1,$2,$3,$4,$5)',['https://fcm.googleapis.com/send/test-business','B'+'a'.repeat(86),'b'.repeat(22),'Prueba',ids.tere]);
      await as('alice');await submit();
      await root(); assert.equal((await db.query('select count(*)::int n from private.push_outbox')).rows[0].n,1);
      await db.query('update public.business_memberships set active=false where user_id=$1',[ids.tere]);
      await db.exec('set role service_role');assert.deepEqual((await db.query('select public.claim_push_jobs() jobs')).rows[0].jobs,[]);
      await root();assert.equal((await db.query('select status from private.push_outbox')).rows[0].status,'skipped');
    });
    await check('revocar negocio después de reclamar el aviso también invalida la entrega pendiente',async()=>{
      await db.exec('update private.push_settings set enabled=true');
      await as('tere'); await db.query('select public.register_push_device($1,$2,$3,$4,$5)',['https://fcm.googleapis.com/send/claimed-business','B'+'a'.repeat(86),'b'.repeat(22),'Prueba',ids.tere]);
      await as('alice');await submit();
      await root();await db.exec('set role service_role');
      const [job]=(await db.query('select public.claim_push_jobs() jobs')).rows[0].jobs;assert.ok(job);
      assert.equal((await db.query('select public.push_job_is_current($1,$2) current',[job.id,job.lease_token])).rows[0].current,true);
      await root();await db.query(`update public.businesses set status='suspended' where id=$1`,[family]);
      await db.exec('set role service_role');
      assert.equal((await db.query('select public.push_job_is_current($1,$2) current',[job.id,job.lease_token])).rows[0].current,false);
    });
    await check('diez integrantes máximo; agregar otro falla sin truncar ni escalar privilegios',async()=>{
      for(let i=0;i<9;i++){
        const id=`00000000-0000-4000-8020-${String(i+1).padStart(12,'0')}`;
        await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())`,[id,`member${i}@example.test`]);
        await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '1 day' where id=$1`,[id]);
        await db.query('insert into public.business_memberships(business_id,user_id) values($1,$2)',[other,id]);
      }
      await denied(()=>db.query('insert into public.business_memberships(business_id,user_id) values($1,$2)',[other,ids.tere]),/máximo de diez/);
      await as('alice');await submit('MF-TEN-001','otro-negocio');await root();
      assert.equal((await db.query('select count(*)::int n from public.request_recipients')).rows[0].n,10);
      assert.equal((await db.query('select count(*)::int n from public.notifications')).rows[0].n,10);
      await db.query('update public.business_memberships set active=false where business_id=$1 and user_id=$2',[other,ids.other]);
      await db.query('insert into public.business_memberships(business_id,user_id) values($1,$2)',[other,ids.tere]);
    });
  }finally{await db.close();}
});

await test('migración de negocio conserva historial familiar sin redistribuir la antigua red',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    for(const file of ['202610300001_platform.sql','202610300002_family_team_security.sql','202610300003_push_notifications.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
    for(const who of ['alice','tere','marco']) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[who],`${who}@example.test`]);
    await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '1 day',is_family=true where id=any($1::uuid[])`,[[ids.tere,ids.marco]]);
    await db.query(`insert into public.move_requests(reference,owner_id,payload,audience,privacy_version) values('MF-OLD-FAMILY',$1,'{}','family','2026-10-30'),('MF-OLD-NETWORK',$1,'{}','network','2026-10-30')`,[ids.alice]);
    await db.query(`insert into public.request_recipients(request_id,provider_id) select id,$1 from public.move_requests`,[ids.tere]);
    await db.query(`insert into public.notifications(user_id,request_id) select $1,id from public.move_requests`,[ids.tere]);
    await db.exec(await readFile(new URL('../supabase/migrations/202610300004_business_routing.sql',import.meta.url),'utf8'));
    assert.equal((await db.query('select count(*)::int n from public.business_memberships')).rows[0].n,2);
    assert.equal((await db.query('select sum(request_count)::int n from private.business_monthly_usage')).rows[0].n,1);
    const rows=(await db.query('select reference,business_id from public.move_requests order by reference')).rows;
    assert.ok(rows[0].business_id);assert.equal(rows[1].business_id,null);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal2"}',false)`,[ids.tere]);
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select reference from public.move_requests')).rows.map(row=>row.reference),['MF-OLD-FAMILY']);
    assert.equal((await db.query('select id from public.notifications')).rows.length,1);
    await db.exec('reset role');
    const settings=(await db.query('select public.public_site_config() config')).rows[0].config;
    assert.equal(settings.accepting_requests,false);assert.equal(settings.network_enabled,false);
  }finally{await db.close();}
});
