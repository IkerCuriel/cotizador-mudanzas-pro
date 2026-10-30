import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ids = Object.fromEntries(['owner', 'provider', 'other', 'applicant', 'pending'].map((name, index) => [name, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
const requestId = '00000000-0000-4000-8000-000000000099';
const key = 'B' + 'a'.repeat(86); const auth = 'b'.repeat(22);
await test('push: autorización, privacidad, entrega y reintentos con PostgreSQL real', async (suite) => {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth, public to anon,authenticated,service_role; grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  const migrationDir = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, migrationDir), 'utf8'));
  for (const [name,id] of Object.entries(ids)) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `${name}@example.test`]);
  await db.query(`update public.profiles set role='superadmin' where id=$1`, [ids.owner]);
  await db.query(`update public.profiles set role='provider',provider_status='approved',is_family=true,plan_expires_at=now()+interval '30 days' where id=any($1::uuid[])`, [[ids.provider,ids.other]]);
  await db.query(`update public.profiles set role='provider' where id=$1`, [ids.pending]);
  await db.exec(`update private.push_settings set enabled=true`);
  await db.query(`insert into public.move_requests(id,reference,owner_id,payload,audience,privacy_version) values($1,'MF-PUSH-TEST',$2,'{}','family','2026-10-30')`, [requestId,ids.applicant]);
  await db.query(`insert into public.request_recipients(request_id,provider_id) values($1,$2),($1,$3)`, [requestId,ids.provider,ids.other]);
  const root = () => db.exec('reset role');
  let currentUser = null;
  const as = async (who, aal = 'aal2') => { currentUser = ids[who] || null; await root(); await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`, [ids[who] || '',JSON.stringify({aal})]); await db.exec(`set role ${who ? 'authenticated' : 'anon'}`); };
  const service = async () => { await root(); await db.exec('set role service_role'); };
  const register = (suffix = 'device', endpoint = `https://fcm.googleapis.com/send/${suffix}`) => db.query('select public.register_push_device($1,$2,$3,$4,$5) as id', [endpoint,key,auth,'Teléfono de prueba',currentUser]);
  const notify = async (who = 'provider') => { await root(); return (await db.query('insert into public.notifications(user_id,request_id) values($1,$2) returning id', [ids[who],requestId])).rows[0].id; };
  const claim = async () => { await service(); return (await db.query('select public.claim_push_jobs() as jobs')).rows[0].jobs; };
  const denied = async (fn, match) => { await db.exec('savepoint denied'); try { await assert.rejects(fn,match); } finally { await db.exec('rollback to savepoint denied; release savepoint denied'); } };
  const check = async (name, fn) => suite.test(name, async () => { await root(); await db.exec('begin'); try { await fn(); } finally { await db.exec('rollback'); await root(); } });
  try {
    await check('solo operadores y proveedores aprobados, vigentes y AAL2 pueden registrar', async () => {
      await as(null); await denied(() => register(), /permission denied/);
      await as('provider','aal1'); await denied(() => register(), /segundo factor/);
      await as('applicant'); await denied(() => register(), /segundo factor/);
      await as('pending'); await denied(() => register(), /segundo factor/);
      await root(); await db.query(`update public.profiles set plan_expires_at=now()-interval '1 day' where id=$1`, [ids.provider]);
      await as('provider'); await denied(() => register(), /segundo factor/);
      await as('owner'); assert.ok((await register()).rows[0].id);
    });
    await check('sin activación servidor no se registra un dispositivo aunque se manipule el cliente', async () => {
      await root(); await db.exec('update private.push_settings set enabled=false');
      await as('provider'); await denied(() => register(), /todavía no están habilitados/);
    });
    await check('SSRF y claves incorrectas se rechazan también en SQL', async () => {
      await as('provider');
      for (const endpoint of ['http://localhost/push','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:443/x','https://fcm.googleapis.com@127.0.0.1/x','https://fcm.googleapis.com/x?q=1']) await denied(() => register('bad', endpoint), /suscripción.*compatible/);
      await denied(() => db.query('select public.register_push_device($1,$2,$3,$4,$5)', ['https://fcm.googleapis.com/ok','invalid',auth,'Prueba',currentUser]), /suscripción.*compatible/);
      await register('good');
      await denied(() => db.query('select public.register_push_device($1,$2,$3,$4,$5)', ['https://fcm.googleapis.com/other',key,auth,'Prueba',ids.other]), /sesión cambió/);
    });
    await check('límite de cinco dispositivos, sin inserción directa ni apropiación ajena', async () => {
      await as('provider'); for (let n=0;n<5;n++) await register(`device-${n}`);
      await register('device-0');
      await denied(() => register('sixth'), /máximo de cinco/);
      await denied(() => db.query(`update public.push_devices set user_id=$1`, [ids.other]), /permission denied/);
      await as('other'); assert.equal((await db.query('select * from public.push_devices')).rows.length,0);
      await denied(() => register('device-0'), /otra cuenta|avisos anteriores/);
      await register('other');
      await as('provider','aal1'); assert.equal((await db.query('select * from public.push_devices')).rows.length,0);
    });
    await check('cola solo servidor, no recibe PII y no se reclama dos veces', async () => {
      await as('provider'); await register(); const notificationId=await notify();
      await as('provider'); await denied(() => db.query('select * from private.push_outbox'), /permission denied/); await denied(() => db.query('select public.claim_push_jobs()'), /permission denied/);
      const jobs = await claim(); assert.equal(jobs.length,1); assert.equal(jobs[0].notification_id,notificationId); assert.equal(jobs[0].payload,undefined); assert.equal((await claim()).length,0);
      await db.query(`select public.finish_push_job($1,$2,'accepted')`, [jobs[0].id,jobs[0].lease_token]);
      assert.equal((await claim()).length,0); await root(); assert.equal((await db.query('select status from private.push_outbox')).rows[0].status,'sent');
    });
    await check('quitar familia, vencer plan, suspender o cancelar corta avisos pendientes', async () => {
      for (const change of ['family','expired','suspended','cancelled','read']) {
        await root(); await db.exec('savepoint scenario');
        await as('provider'); await register(); await notify(); await root();
        if (change==='family') await db.query('update public.profiles set is_family=false where id=$1',[ids.provider]);
        if (change==='expired') await db.query(`update public.profiles set plan_expires_at=now()-interval '1 day' where id=$1`,[ids.provider]);
        if (change==='suspended') await db.query(`update public.profiles set provider_status='suspended' where id=$1`,[ids.provider]);
        if (change==='cancelled') await db.query(`update public.move_requests set status='cancelled' where id=$1`,[requestId]);
        if (change==='read') await db.exec('update public.notifications set read_at=now()');
        assert.equal((await claim()).length,0,change); await root(); await db.exec('rollback to savepoint scenario; release savepoint scenario');
      }
    });
    await check('revocar dispositivo propio corta cola y no permite revocar la de otro usuario', async () => {
      await as('provider'); await register(); await notify();
      await as('other'); await db.query('select public.revoke_push_device($1)',['https://fcm.googleapis.com/send/device']);
      const jobs=await claim(); assert.equal(jobs.length,1);
      await as('provider','aal1'); await db.query('select public.revoke_push_device($1)',['https://fcm.googleapis.com/send/device']);
      await service(); assert.equal((await db.query('select public.push_job_is_current($1,$2) as current',[jobs[0].id,jobs[0].lease_token])).rows[0].current,false);
    });
    await check('reintentos tienen espera, token de arrendamiento y máximo cinco intentos', async () => {
      await as('provider'); await register(); await notify();
      for (let attempt=1;attempt<=5;attempt++) {
        const [job]=await claim(); assert.ok(job);
        await db.query(`select public.finish_push_job($1,$2,'accepted')`,[job.id,'00000000-0000-4000-8000-000000000000']);
        await root(); assert.equal((await db.query('select status from private.push_outbox')).rows[0].status,'sending');
        await service(); await db.query(`select public.finish_push_job($1,$2,'retry')`,[job.id,job.lease_token]);
        assert.equal((await claim()).length,0);
        await root(); await db.exec(`update private.push_outbox set next_attempt_at=now()-interval '1 minute'`);
      }
      assert.equal((await claim()).length,0); await root(); const [row]=(await db.query('select status,attempts from private.push_outbox')).rows; assert.equal(row.status,'failed'); assert.equal(row.attempts,5);
    });
    await check('servicio que retorna 410 desactiva el dispositivo', async () => {
      await as('provider'); await register(); await notify(); const [job]=await claim();
      await db.query(`select public.finish_push_job($1,$2,'gone')`,[job.id,job.lease_token]);
      await root(); assert.equal((await db.query('select active from public.push_devices')).rows[0].active,false);
    });
  } finally { await db.close(); }
});
