import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeDraft } from '../src/request.js';

// PostgreSQL real en WASM: ejecuta SQL/RLS, no simula permisos con expresiones regulares.
// Solo se reemplaza el servicio Auth externo por usuarios y auth.uid() de prueba.
const ids = Object.fromEntries(['owner','admin','alice','bob','family','other','pending','unverified'].map((name,index) => [name, `00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`]));
const draft = () => normalizeDraft({ fields: { origin:'Ciudad de México', destination:'Puebla, centro', customerName:'Cliente de prueba', phone:'5512345678', privacyConsent:true }, inventory:{'bed-queen':1} });

await test('backend: autorización real, aislamiento y transacciones en PostgreSQL', async (suite) => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const filename of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(filename, migrations), 'utf8'));
  }
  for (const [name,id] of Object.entries(ids)) await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)`,[id,`${name}@example.test`,name === 'unverified' ? null : new Date().toISOString(),{role:'superadmin',provider_status:'approved',display_name:'  Usuario de prueba  ',phone:'+52 5512345678',company_name:'Empresa de registro'}]);
  await db.query(`update public.profiles set role='superadmin' where id=$1`,[ids.owner]);
  await db.query(`update public.profiles set role='admin' where id=$1`,[ids.admin]);
  await db.query(`update public.profiles set role='provider',company_name='Empresa de prueba',provider_status='approved',plan_expires_at=now()+interval '30 days' where id=any($1::uuid[])`,[[ids.family,ids.other]]);
  await db.query(`update public.profiles set role='provider' where id=$1`,[ids.pending]);
  await db.query(`update public.profiles set is_family=true where id=$1`,[ids.family]);
  await db.query(`update private.platform_settings set accepting_requests=true`);

  const as = async (who, assurance = ['owner','admin','family','other','pending'].includes(who) ? 'aal2' : 'aal1') => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[who ? ids[who] : '']);
    await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub: who ? ids[who] : '', aal: assurance})]);
    await db.exec(`set role ${who ? 'authenticated' : 'anon'}`);
  };
  const root = () => db.exec('reset role');
  const submit = (reference='MF-TEST-001',payload=draft(),audience='family',version='2026-10-30') => db.query(`select to_jsonb(public.submit_request($1,$2::jsonb,$3,$4)) as request`,[reference,JSON.stringify(payload),audience,version]).then(result=>result.rows[0].request);
  const denied = async (fn, pattern) => {
    await db.exec('savepoint expected_denial');
    try {
      await assert.rejects(fn,pattern);
    } finally {
      await db.exec('rollback to savepoint expected_denial; release savepoint expected_denial');
    }
  };
  const check = async (name, fn) => suite.test(name,async()=>{
    await root(); await db.exec('begin');
    try { await fn(); } finally { await db.exec('rollback'); await root(); }
  });
  try {
    await check('metadata del registro no concede rol ni acceso',async()=>{
      await as('alice');
      const {rows} = await db.query(`select * from public.profiles`);
      assert.equal(rows.length,1); assert.equal(rows[0].role,'applicant'); assert.equal(rows[0].provider_status,'pending');
      assert.equal(rows[0].display_name,'Usuario de prueba'); assert.equal(rows[0].phone,'+52 5512345678'); assert.equal(rows[0].company_name,'Empresa de registro');
      await denied(()=>db.query(`update public.profiles set role='superadmin' where id=$1`,[ids.alice]),/permission denied/);
      await denied(()=>db.query(`update public.profiles set plan_expires_at=now()+interval '1 year' where id=$1`,[ids.alice]),/permission denied/);
      await db.query(`update public.profiles set display_name='Nombre editable',phone='5512345678' where id=$1`,[ids.alice]);
      assert.equal((await db.query(`select display_name from public.profiles`)).rows[0].display_name,'Nombre editable');
    });
    await check('aceptación de aviso queda auditada con versión vigente y fecha del servidor',async()=>{
      const account = '00000000-0000-4000-8000-000000000099';
      await root();
      await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'consent@example.test',now(),$2)`,[account,{privacy_accepted:true,privacy_version:'2026-10-30',privacy_accepted_at:'2001-01-01T00:00:00Z',role:'superadmin'}]);
      let events = (await db.query(`select * from private.audit_events where subject_id=$1 and action='account_privacy_accepted'`,[account])).rows;
      assert.equal(events.length,1);
      assert.equal(events[0].actor_id,account);
      assert.deepEqual(events[0].details,{privacy_version:'2026-10-30',source:'registration'});
      assert.ok(new Date(events[0].created_at).getTime() > Date.now() - 60000);
      await db.query(`update auth.users set raw_user_meta_data=$2 where id=$1`,[account,{privacy_accepted:false,privacy_version:'forged-new-version'}]);
      events = (await db.query(`select * from private.audit_events where subject_id=$1 and action='account_privacy_accepted'`,[account])).rows;
      assert.equal(events.length,1); assert.equal(events[0].details.privacy_version,'2026-10-30');
      await as('alice');
      await denied(()=>db.query(`delete from private.audit_events where subject_id=$1`,[account]),/permission denied/);
      await denied(()=>db.query(`update private.audit_events set details='{}' where subject_id=$1`,[account]),/permission denied/);
    });
    await check('registro no inventa aceptación si faltó o no coincide la versión del aviso',async()=>{
      await root();
      for (const [index,metadata] of [
        {},
        {privacy_accepted:false,privacy_version:'2026-10-30'},
        {privacy_accepted:'true',privacy_version:'2026-10-30'},
        {privacy_accepted:true,privacy_version:'2001-01-01'},
        {privacy_accepted:true},
      ].entries()) {
        const account = `00000000-0000-4000-8000-00000000008${index}`;
        await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)`,[account,`no-consent-${index}@example.test`,metadata]);
        assert.equal((await db.query(`select count(*)::int as n from private.audit_events where subject_id=$1 and action='account_privacy_accepted'`,[account])).rows[0].n,0);
      }
    });
    await check('la invitación requiere aceptación personal vigente y se audita una sola vez',async()=>{
      await as(null); await denied(()=>db.query(`select public.accept_account_privacy('2026-10-30')`),/permission denied/);
      await as('unverified'); await denied(()=>db.query(`select public.accept_account_privacy('2026-10-30')`),/Verifica tu correo/);
      await as('alice'); await denied(()=>db.query(`select public.accept_account_privacy('old')`),/aviso de privacidad cambió/);
      await db.query(`select public.accept_account_privacy('2026-10-30')`);
      await db.query(`select public.accept_account_privacy('2026-10-30')`);
      await root(); const events=(await db.query(`select * from private.audit_events where action='account_privacy_accepted' and actor_id=$1`,[ids.alice])).rows;
      assert.equal(events.length,1); assert.equal(events[0].subject_id,ids.alice);
      assert.equal(events[0].details.source,'invitation');
    });
    await check('visitantes solo leen configuración pública sin datos privados',async()=>{
      await as(null);
      assert.equal((await db.query(`select public.public_site_config() as config`)).rows[0].config.accepting_requests,true);
      await denied(()=>db.query(`select * from public.profiles`),/permission denied/);
      await denied(()=>db.query(`select * from public.move_requests`),/permission denied/);
      await denied(()=>submit(),/permission denied/);
    });
    await check('correo sin verificar no puede enviar ni pedir acceso de empresa',async()=>{
      await as('unverified');
      await denied(()=>submit(),/Verifica tu correo/);
      await denied(()=>db.query(`select public.join_provider('Mudanzas de prueba')`),/Verifica tu correo/);
    });
    await check('envío persistente, notificación y destinatario son atómicos e idempotentes',async()=>{
      await as('alice'); const request = await submit(); const retry = await submit();
      assert.equal(request.id,retry.id); assert.equal(request.owner_id,ids.alice); assert.equal(request.status,'submitted');
      await denied(()=>submit('MF-TEST-001',{...draft(),fields:{...draft().fields,origin:'Otro origen'}}),/ya existe con otros datos/);
      await root();
      assert.equal((await db.query(`select count(*)::int as n from public.move_requests`)).rows[0].n,1);
      assert.equal((await db.query(`select count(*)::int as n from public.request_recipients`)).rows[0].n,1);
      const notifications = (await db.query(`select * from public.notifications`)).rows;
      assert.equal(notifications.length,1); assert.equal(notifications[0].user_id,ids.family);
      assert.equal(notifications[0].title,'Tienes una nueva solicitud de mudanza');
    });
    await check('clientes aislados; sólo empresa asignada y aprobada puede leer el contacto',async()=>{
      await as('alice'); const request = await submit();
      await as('bob'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,0);
      await denied(()=>db.query(`select public.cancel_request($1)`,[request.id]),/No se encontró tu solicitud/);
      await as('other'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,0);
      assert.equal((await db.query(`select * from public.request_recipients`)).rows.length,0);
      await as('family'); assert.equal((await db.query(`select * from public.move_requests`)).rows[0].payload.fields.phone,'5512345678');
      await denied(()=>db.query(`select public.set_request_status($1,'contacted')`,[request.id]),/Solo la administración/);
      await as('admin'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,1);
      assert.equal((await db.query(`select * from public.profiles`)).rows.length,Object.keys(ids).length);
    });
    await check('suspensión o vencimiento retira acceso aun con asignación previa',async()=>{
      await as('alice'); await submit();
      await root(); await db.query(`update public.profiles set plan_expires_at=now()-interval '1 second' where id=$1`,[ids.family]);
      await as('family'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,0);
      await root(); await db.query(`update public.profiles set plan_expires_at=now()+interval '1 day',provider_status='suspended' where id=$1`,[ids.family]);
      await as('family'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,0);
    });
    await check('cancelación de cliente revoca contactos y no admite reapertura',async()=>{
      await as('alice'); const request = await submit();
      await db.query(`select public.cancel_request($1)`,[request.id]);
      await as('family'); assert.equal((await db.query(`select * from public.move_requests`)).rows.length,0);
      await as('admin'); await denied(()=>db.query(`select public.set_request_status($1,'contacted')`,[request.id]),/cerrada no se puede reabrir/);
    });
    await check('sin receptor habilitado todo el envío se revierte',async()=>{
      await root(); await db.exec(`update public.profiles set is_family=false`);
      await as('alice'); await denied(()=>submit(),/No hay una empresa habilitada/);
      await root(); assert.equal((await db.query(`select count(*)::int as n from public.move_requests`)).rows[0].n,0);
      assert.equal((await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n,0);
    });
    await check('recepción cerrada y aviso vencido fallan explícitamente',async()=>{
      await root(); await db.exec(`update private.platform_settings set accepting_requests=false`);
      await as('alice'); await denied(()=>submit(),/aún no está habilitado/);
      await root(); await db.exec(`update private.platform_settings set accepting_requests=true`);
      await as('alice'); await denied(()=>submit('MF-OLD-001',draft(),'family','old'),/aviso de privacidad cambió/);
    });
    await check('red requiere habilitación y consentimiento independiente',async()=>{
      await as('alice'); await denied(()=>submit('MF-NET-001',draft(),'network'),/autorización correspondiente/);
      const networkDraft = {...draft(),fields:{...draft().fields,networkConsent:true}};
      await denied(()=>submit('MF-NET-001',networkDraft,'network'),/red de empresas todavía/);
      await root(); await db.exec(`update private.platform_settings set network_enabled=true`);
      await as('alice'); const request = await submit('MF-NET-001',networkDraft,'network');
      await as('other'); assert.equal((await db.query(`select id from public.move_requests`)).rows[0].id,request.id);
      await root(); assert.equal((await db.query(`select count(*)::int as n from public.request_recipients`)).rows[0].n,2);
    });
    await check('contenido inválido se rechaza y controles enviados se descartan',async()=>{
      await as('alice');
      for (const change of [{privacyConsent:false},{origin:''},{phone:'123'},{originFloor:-1},{customerName:'x'.repeat(101)},{email:'no-es-correo'},{packingType:'none',packingAcknowledged:false}]) {
        await denied(()=>submit('MF-BAD-001',{...draft(),fields:{...draft().fields,...change}}),/./);
      }
      await denied(()=>submit('MF-BAD-001',{...draft(),inventory:{'bed-queen':-2}}),/Cantidad de artículos inválida/);
      await denied(()=>submit('MF-BAD-001',{...draft(),inventory:{'injected-item':1}}),/Artículo inválido/);
      const request = await submit('MF-SAFE-001',{...draft(),owner_id:ids.bob,status:'completed',role:'admin',fields:{...draft().fields,role:'superadmin'}});
      assert.equal(request.owner_id,ids.alice); assert.equal(request.status,'submitted'); assert.equal(request.payload.fields.role,undefined); assert.equal(request.payload.owner_id,undefined);
      await denied(()=>db.query(`insert into public.move_requests(reference,owner_id,payload,audience,privacy_version) values('MF-INJECT-001',$1,$2,'family','2026-10-30')`,[ids.bob,draft()]),/permission denied/);
    });
    await check('admisión de empresa no permite autoaprobar ni cambiar al superusuario',async()=>{
      await as('alice'); await db.query(`select public.join_provider('Empresa solicitante')`);
      let profile = (await db.query(`select * from public.profiles`)).rows[0];
      assert.equal(profile.role,'provider'); assert.equal(profile.provider_status,'pending'); assert.equal(profile.plan_expires_at,null);
      await as('alice','aal2');
      await denied(()=>db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',false)`,[ids.alice]),/Solo la administración/);
      await as('admin'); await db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',false)`,[ids.alice]);
      await denied(()=>db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',true)`,[ids.alice]),/Solo el superusuario/);
      await denied(()=>db.query(`select public.set_user_role($1,'admin')`,[ids.alice]),/Solo el superusuario/);
      await as('owner'); await denied(()=>db.query(`select public.set_user_role($1,'superadmin')`,[ids.alice]),/Cambio de rol no permitido/);
      await db.query(`select public.set_user_role($1,'admin')`,[ids.alice]);
      profile = (await db.query(`select * from public.profiles where id=$1`,[ids.alice])).rows[0];
      assert.equal(profile.role,'admin'); assert.equal(profile.provider_status,'pending'); assert.equal(profile.plan_expires_at,null);
    });
    await check('el equipo familiar recibe una notificación por asesor sin abrir solicitudes ajenas',async()=>{
      await as('owner'); await db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',true)`,[ids.other]);
      await as('alice'); const request = await submit(); await submit();
      await root();
      assert.equal((await db.query(`select count(*)::int as n from public.request_recipients where request_id=$1`,[request.id])).rows[0].n,2);
      assert.equal((await db.query(`select count(*)::int as n from public.notifications where request_id=$1`,[request.id])).rows[0].n,2);
      assert.equal((await db.query(`select count(*)::int as n from public.profiles where is_family`)).rows[0].n,2);
      await as('other'); assert.equal((await db.query(`select id from public.move_requests`)).rows[0].id,request.id);
      await as('pending'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
      await as('bob'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
      await as('owner'); await db.query(`select public.set_provider_access($1,'suspended',now()+interval '30 days',true)`,[ids.other]);
      await as('other'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
      await as('family'); assert.equal((await db.query(`select id from public.move_requests`)).rows[0].id,request.id);
    });
    await check('retirar a un asesor del equipo familiar revoca las solicitudes familiares anteriores',async()=>{
      await as('alice'); await submit();
      await as('family'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,1);
      await as('owner'); await db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',false)`,[ids.family]);
      await as('family'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
      assert.equal((await db.query(`select request_id from public.request_recipients`)).rows.length,0);
    });
    await check('agregar al equipo familiar no concede asignaciones de solicitudes anteriores',async()=>{
      await as('alice'); await submit();
      await as('owner'); await db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',true)`,[ids.other]);
      await as('other'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
    });
    await check('MFA se exige en SQL a proveedores y administradores incluso usando directamente la API',async()=>{
      await as('alice'); const request=await submit();
      for (const who of ['owner','admin','family']) {
        await as(who,'aal1');
        assert.equal((await db.query(`select id from public.move_requests`)).rows.length,0);
        assert.equal((await db.query(`select id from public.notifications`)).rows.length,0);
        assert.equal((await db.query(`select id from public.profiles`)).rows.length,1);
        assert.equal((await db.query(`update public.profiles set display_name='Sin segundo factor' where id=$1 returning id`,[ids[who]])).rows.length,0);
        await denied(()=>db.query(`select public.set_request_status($1,'contacted')`,[request.id]),/segundo factor/);
        await denied(()=>db.query(`select public.set_provider_access($1,'approved',now()+interval '30 days',true)`,[ids.other]),/segundo factor/);
      }
      await as('owner','aal1'); await denied(()=>db.query(`select public.set_user_role($1,'admin')`,[ids.bob]),/segundo factor/);
      await as('family','aal2'); assert.equal((await db.query(`select id from public.move_requests`)).rows.length,1);
      await as('admin','aal2'); await db.query(`select public.set_request_status($1,'contacted')`,[request.id]);
    });
    await check('notificaciones son privadas y sólo el dueño puede marcarlas',async()=>{
      await as('alice'); await submit();
      await as('family'); const notification = (await db.query(`select * from public.notifications`)).rows[0];
      await db.query(`select public.mark_notification_read($1)`,[notification.id]);
      assert.ok((await db.query(`select read_at from public.notifications`)).rows[0].read_at);
      await as('other'); assert.equal((await db.query(`select * from public.notifications`)).rows.length,0);
      await denied(()=>db.query(`select public.mark_notification_read($1)`,[notification.id]),/No se encontró tu notificación/);
    });
    await check('límite por cuenta evita envío repetitivo sin duplicar reintentos',async()=>{
      await as('alice');
      for (let i=0;i<5;i++) await submit(`MF-RATE-${i}00`);
      await submit('MF-RATE-000');
      await denied(()=>submit('MF-RATE-600'),/límite temporal/);
    });
    await suite.test('script SQL portable de autorización hace rollback sin modificar datos',async()=>{
      await root();
      await db.exec(await readFile(new URL('../supabase/tests/authorization.sql',import.meta.url),'utf8'));
      assert.equal((await db.query(`select count(*)::int as n from public.move_requests`)).rows[0].n,0);
    });
  } finally { await db.close(); }
});
