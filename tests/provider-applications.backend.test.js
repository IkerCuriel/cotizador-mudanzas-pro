import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const names=['alice','bob','operator','approved','suspended','unverified'];
const ids=Object.fromEntries(names.map((name,i)=>[name,`00000000-0000-4000-8070-${String(i+1).padStart(12,'0')}`]));
const complete=()=>({company:'Mudanzas de prueba',contact:'Persona de prueba',email:'contacto@example.test',phone:'+52 55 0000 0000',businessLocation:'Ciudad de México',services:'both',plan:'annual_1440',consent:true,privacy_version:'2026-10-30'});

await test('solicitudes de alta: cierre por defecto, aislamiento y transición sin aprobación ni pago', async suite=>{
  const db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,migrations),'utf8'));
  for(const name of names) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[name],`${name}@example.test`,name==='unverified'?null:new Date().toISOString()]);
  await db.query("update public.profiles set role='admin' where id=$1",[ids.operator]);
  for(const status of ['approved','suspended']) await db.query("update public.profiles set role='provider',provider_status=$1,plan_expires_at=now()+interval '1 year' where id=$2",[status,ids[status]]);
  const root=()=>db.exec('reset role');
  const as=async(name,aal='aal2')=>{await root();await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[name]||'',JSON.stringify({aal})]);await db.exec(`set role ${name?'authenticated':'anon'}`);};
  const submit=(payload=complete())=>db.query('select public.submit_provider_application($1::jsonb) result',[JSON.stringify(payload)]).then(r=>r.rows[0].result);
  const enable=()=>db.exec('update private.platform_settings set accepting_provider_applications=true');
  const denied=async(fn,pattern)=>{await db.exec('savepoint denied');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint denied; release savepoint denied');}};
  const check=async(name,fn)=>suite.test(name,async()=>{await root();await db.exec('begin');try{await fn();}finally{await db.exec('rollback');await root();}});
  try {
    await check('alta cerrada hasta activación explícita; requiere sesión verificada y versión vigente',async()=>{
      await as(null);const settings=(await db.query('select public.public_site_config() config')).rows[0].config;
      assert.equal(settings.accepting_provider_applications,false);assert.equal(settings.provider_applications_version,1);assert.equal(settings.route_destinations_version,1);
      await denied(submit,/permission denied/);
      await as('unverified');await denied(submit,/Verifica tu correo/);
      await as('alice');await denied(submit,/todavía no está habilitada/);
      await root();await enable();await as('alice');
      for(const consent of [false,'true',1,null]) await denied(()=>submit({...complete(),consent}),/aviso de privacidad/);
      await denied(()=>submit({...complete(),privacy_version:'vieja'}),/aviso de privacidad/);
    });
    await check('payload se reduce a contacto, cobertura y plan; identidad y fechas son del servidor',async()=>{
      await enable();await as('alice','aal1');
      const result=await submit({...complete(),owner_id:ids.bob,status:'approved',role:'superadmin',is_family:true,price:1,plan_expires_at:'9999-01-01',created_at:'2000-01-01',businessLocationSource:'user',businessLocationPlace:{placeId:'TEST_PLACE',label:'Ciudad de México',displayName:'Nombre de POI no persistente',latitude:19,photos:['privado']}});
      assert.equal(result.status,'pending');assert.match(result.applicationId,/^[0-9a-f-]{36}$/);
      // After the role transition, provider access continues to require MFA.
      assert.equal((await db.query('select id from public.provider_applications')).rows.length,0);
      await denied(submit,/segundo factor/);
      await as('alice');const row=(await db.query('select * from public.provider_applications')).rows[0];
      assert.equal(row.user_id,ids.alice);assert.equal(row.status,'pending');assert.equal(row.id,result.applicationId);
      assert.deepEqual(row.payload,{company:'Mudanzas de prueba',contact:'Persona de prueba',email:'contacto@example.test',phone:'+52 55 0000 0000',coverage:'',notes:'',services:'both',plan:'annual_1440',businessLocationSource:'google',businessLocationPlace:{placeId:'TEST_PLACE'}});
      assert.equal('businessLocation' in row.payload,false);
      assert.equal(JSON.stringify(row.payload).includes('Ciudad de México'),false);
      assert.equal(JSON.stringify(row.payload).includes('Nombre de POI no persistente'),false);
      assert.equal(row.privacy_version,'2026-10-30');assert.ok(new Date(row.consented_at).getFullYear()>2000);
      const profile=(await db.query('select role,provider_status,company_name,is_family,plan_expires_at from public.profiles where id=$1',[ids.alice])).rows[0];
      assert.deepEqual(profile,{role:'provider',provider_status:'pending',company_name:'Mudanzas de prueba',is_family:false,plan_expires_at:null});
      assert.equal((await db.query('select public.get_my_access_status() result')).rows[0].result.provider_access_active,false);
      await root();assert.equal((await db.query('select count(*)::int n from public.business_memberships where user_id=$1',[ids.alice])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from private.paypal_purchases')).rows[0].n,0);
    });
    await check('ubicación manual conserva texto propio; selección Google conserva solo ID y fuente del servidor',async()=>{
      await enable();await as('alice');
      const first=await submit({...complete(),businessLocationSource:'google'});
      let row=(await db.query('select payload from public.provider_applications')).rows[0];
      assert.equal(row.payload.businessLocation,'Ciudad de México');
      assert.equal(row.payload.businessLocationSource,'user');
      assert.equal('businessLocationPlace' in row.payload,false);
      await root();await db.query("update public.provider_applications set updated_at=now()-interval '2 minutes' where user_id=$1",[ids.alice]);
      await as('alice');
      const selected={...complete(),businessLocationPlace:{placeId:'TEST_PLACE',label:'Ciudad de México'}};
      assert.deepEqual(await submit(selected),first);
      row=(await db.query('select payload from public.provider_applications')).rows[0];
      assert.equal(row.payload.businessLocationSource,'google');
      assert.equal('businessLocation' in row.payload,false);
      assert.deepEqual(row.payload.businessLocationPlace,{placeId:'TEST_PLACE'});
      // A changed display label for the same place remains transient and cannot
      // create a duplicate or persist a replacement formatted address.
      assert.deepEqual(await submit({...selected,businessLocation:'Nueva etiqueta temporal',businessLocationPlace:{placeId:'TEST_PLACE',label:'Nueva etiqueta temporal'}}),first);
      assert.deepEqual((await db.query('select payload from public.provider_applications')).rows[0].payload,row.payload);
    });
    await check('solo el titular y operadores verificados con MFA leen las solicitudes; nadie las edita directamente',async()=>{
      await enable();await as('alice');const a=await submit();await as('bob');const b=await submit();
      assert.deepEqual((await db.query('select id from public.provider_applications')).rows.map(r=>r.id),[b.applicationId]);
      assert.equal((await db.query('select id from public.provider_applications where id=$1',[a.applicationId])).rows.length,0);
      await denied(()=>db.query("update public.provider_applications set status='approved'"),/permission denied/);
      await denied(()=>db.query('delete from public.provider_applications'),/permission denied/);
      await denied(()=>db.query("insert into public.provider_applications(user_id,payload,privacy_version) values($1,'{}','v')",[ids.bob]),/permission denied/);
      await as('operator','aal1');assert.equal((await db.query('select id from public.provider_applications')).rows.length,0);
      await as('operator');assert.equal((await db.query('select id from public.provider_applications')).rows.length,2);
      await as('unverified');assert.equal((await db.query('select id from public.provider_applications')).rows.length,0);
      await as(null);await denied(()=>db.query('select id from public.provider_applications'),/permission denied/);
    });
    await check('reintentos idénticos reutilizan id; cambios están limitados y no agregan filas',async()=>{
      await enable();await as('alice');const first=await submit();assert.deepEqual(await submit(),first);
      await denied(()=>submit({...complete(),plan:'monthly_149',company:'Nombre actualizado'}),/Espera un minuto/);
      await root();await db.query("update public.provider_applications set updated_at=now()-interval '2 minutes' where user_id=$1",[ids.alice]);
      await as('alice');assert.deepEqual(await submit({...complete(),plan:'monthly_149',company:'Nombre actualizado'}),first);
      const rows=(await db.query('select payload from public.provider_applications')).rows;assert.equal(rows.length,1);assert.equal(rows[0].payload.plan,'monthly_149');
      assert.equal((await db.query('select company_name from public.profiles where id=$1',[ids.alice])).rows[0].company_name,'Nombre actualizado');
      await root();await db.query("update public.provider_applications set status='withdrawn' where user_id=$1",[ids.alice]);
      await as('alice');await denied(submit,/ya fue revisada/);
    });
    await check('perfiles aprobados, suspendidos y operadores no se convierten a pendientes',async()=>{
      await enable();
      for(const who of ['approved','suspended','operator']) {await as(who);await denied(submit,/perfil ya fue revisado|no puede solicitar/);}
      await root();assert.equal((await db.query('select count(*)::int n from public.provider_applications')).rows[0].n,0);
      for(const status of ['approved','suspended']) assert.equal((await db.query('select provider_status from public.profiles where id=$1',[ids[status]])).rows[0].provider_status,status);
    });
    await check('rechaza tipos, límites, planes, contactos y selecciones de ubicación incoherentes',async()=>{
      await enable();await as('alice');
      for(const payload of [null,[],1,'texto',{...complete(),company:'x'.repeat(121)},{...complete(),notes:'x'.repeat(401)},{...complete(),email:'a@b'},{...complete(),phone:'https://evil.test'},{...complete(),services:'__proto__'},{...complete(),plan:'free'},{...complete(),businessLocation:{text:'Ciudad'}},{...complete(),businessLocationPlace:{placeId:'TEST',label:'Dirección anterior'}},{...complete(),businessLocationPlace:{placeId:'https://evil.test',label:'Ciudad de México'}},{...complete(),businessLocationPlace:null},{...complete(),unknown:'x'.repeat(12000)}]) {
        await denied(()=>submit(payload),/formato|tamaño|longitud|correo|teléfono|Selecciona|texto|ubicación/);
      }
      const fields=['company','contact','email','phone','businessLocation'];
      for(const key of fields) await denied(()=>submit({...complete(),[key]:''}),/Completa|Revisa/);
      await denied(()=>submit({...complete(),businessLocationPlace:{placeId:'A'.repeat(301),label:'Ciudad de México'}}),/ubicación/);
      await root();assert.equal((await db.query('select count(*)::int n from public.provider_applications')).rows[0].n,0);
      assert.equal((await db.query('select role from public.profiles where id=$1',[ids.alice])).rows[0].role,'applicant');
      await as('alice');await submit({...complete(),businessLocationPlace:{placeId:'A'.repeat(300),label:'Ciudad de México'}});
    });
  } finally { await db.close(); }
});
