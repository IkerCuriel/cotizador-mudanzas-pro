import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeDraft } from '../src/request.js';

const clientId = '00000000-0000-4000-8020-000000000001';
const providerId = '00000000-0000-4000-8020-000000000002';
const draft = () => normalizeDraft({ fields: {
  origin: 'Ciudad de México', destination: 'Centro de Puebla', customerName: 'Cliente de prueba',
  phone: '5500000000', privacyConsent: true,
}, inventory: { 'bed-queen': 1 } });

await test('otro inmueble: contrato de origen validado y conservado por PostgreSQL', async suite => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, migrations), 'utf8'));
    }
    for (const [id, name] of [[clientId, 'client'], [providerId, 'provider']]) {
      await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())`, [id, `${name}@example.test`]);
    }
    await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '30 days',is_family=true where id=$1`, [providerId]);
    await db.exec(`update private.platform_settings set accepting_requests=true`);
    const validate = (changes) => db.query(`select private.validate_request_payload($1::jsonb,'family') as payload`, [JSON.stringify({ ...draft(), fields: { ...draft().fields, ...changes } })]).then(result => result.rows[0].payload);

    await suite.test('sin opción Otro, descarta el texto oculto y conserva el payload anterior', async () => {
      const clean = await validate({});
      for (const hidden of ['Descripción anterior', { injected: true }, null]) {
        const result = await validate({ originPropertyOther: hidden });
        assert.deepEqual(result, clean);
        assert.equal(result.fields.originPropertyOther, undefined);
      }
    });
    await suite.test('requiere descripción de texto válida y no acepta Otro en destino', async () => {
      for (const value of [undefined, null, {}, 12, '', '   ', '\n\t', 'X'.repeat(121)]) {
        await assert.rejects(validate({ originProperty: 'other', originPropertyOther: value }), /inmueble de origen/);
      }
      await assert.rejects(validate({ destinationProperty: 'other', destinationPropertyOther: 'Taller' }), /acceso de destination/);
      for (const originProperty of [undefined, null, '__proto__', 'unknown']) await assert.rejects(validate({ originProperty }), /acceso de origin|originProperty/);
    });
    await suite.test('limpia controles y espacios; admite los 120 caracteres sin truncar en servidor', async () => {
      const cleaned = await validate({ originProperty: 'other', originPropertyOther: '  Taller\u0007 de\n arte  ' });
      assert.equal(cleaned.fields.originPropertyOther, 'Taller de arte');
      assert.equal((await validate({ originProperty: 'other', originPropertyOther: 'X'.repeat(120) })).fields.originPropertyOther.length, 120);
    });
    await suite.test('envío, reintento y lectura del equipo conservan Otro sin aceptar autoridad del navegador', async () => {
      const payload = { ...draft(), owner_id: providerId, business_id: 'injected', fields: { ...draft().fields, originProperty: 'other', originPropertyOther: 'Taller de restauración' } };
      await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal1"}',false)`, [clientId]);
      await db.exec('set role authenticated');
      const submit = () => db.query(`select to_jsonb(public.submit_business_request('MF-OTHER-001',$1::jsonb,'d-curiel','2026-10-30')) as request`, [JSON.stringify(payload)]).then(result => result.rows[0].request);
      const first = await submit(); const again = await submit();
      assert.equal(first.id, again.id);
      assert.equal(first.owner_id, clientId);
      assert.equal(first.payload.fields.originProperty, 'other');
      assert.equal(first.payload.fields.originPropertyOther, 'Taller de restauración');
      assert.equal(first.payload.owner_id, undefined);
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal2"}',false)`, [providerId]);
      await db.exec('set role authenticated');
      const rows = (await db.query('select payload from public.move_requests')).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].payload.fields.originPropertyOther, 'Taller de restauración');
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});
