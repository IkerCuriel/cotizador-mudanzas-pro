import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeDraft } from '../src/request.js';

const clientId = '00000000-0000-4000-8021-000000000001';
const providerId = '00000000-0000-4000-8021-000000000002';
const draft = () => normalizeDraft({ fields: { origin: 'Ciudad de México', destination: 'Centro de Puebla', customerName: 'Cliente de prueba', phone: '5500000000', privacyConsent: true }, inventory: { 'bed-queen': 1 } });
const place = (label) => ({ placeId: 'ChIJ_test-selected-place-01', label });

await test('destinos: PostgreSQL conserva rutas completas y limita campos sin ampliar acceso', async suite => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, migrations), 'utf8'));
    for (const [id, name] of [[clientId, 'client'], [providerId, 'provider']]) await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())`, [id, `${name}@example.test`]);
    await db.query(`update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '30 days',is_family=true where id=$1`, [providerId]);
    await db.exec(`update private.platform_settings set accepting_requests=true`);
    const validate = (changes) => db.query(`select private.validate_request_payload($1::jsonb,'family') as payload`, [JSON.stringify({ ...draft(), fields: { ...draft().fields, ...changes } })]).then(result => result.rows[0].payload);

    await suite.test('un destino anterior permanece idéntico y un array vacío no altera reintentos', async () => {
      assert.deepEqual(await validate({}), draft());
      assert.deepEqual(await validate({ additionalDestinations: [] }), draft());
    });
    await suite.test('guarda selección y paradas en orden, descarta metadatos y pins de texto editado', async () => {
      const payload = await validate({
        originPlace: { ...place('Ciudad de México'), lat: 123, lng: 456, role: 'admin' },
        destinationPlace: place('Dirección que cambió'),
        additionalDestinations: [
          { address: '  Casa de Cholula  ', notes: '  Entregar\u0007 el piano  ', place: place('Casa de Cholula'), role: 'admin', photos: ['injected'] },
          { address: 'Taller de Atlixco', notes: '', place: place('Anterior') },
        ],
      });
      assert.deepEqual(payload.fields.originPlace, place('Ciudad de México'));
      assert.equal(payload.fields.destinationPlace, undefined);
      assert.deepEqual(payload.fields.additionalDestinations, [
        { address: 'Casa de Cholula', notes: 'Entregar el piano', place: place('Casa de Cholula') },
        { address: 'Taller de Atlixco' },
      ]);
    });
    await suite.test('rechaza listas, filas, indicaciones y selecciones fuera del contrato', async () => {
      const invalid = [null, {}, 'Ciudad', [null], ['Ciudad'], [{ address: null }], [{ address: {} }], [{ address: '' }], [{ address: '  ' }], [{ address: 'xx' }], [{ address: 'x'.repeat(501) }], [{ address: 'Ciudad', notes: null }], [{ address: 'Ciudad', notes: 'x'.repeat(301) }], Array.from({ length: 6 }, () => ({ address: 'Ciudad' }))];
      for (const additionalDestinations of invalid) await assert.rejects(validate({ additionalDestinations }), /destino|ubicación|indicaciones|Completa/);
      for (const originPlace of [null, {}, [], 'ChIJ_place', { ...place('Ciudad de México'), placeId: 'javascript:bad' }, { ...place('Ciudad de México'), placeId: 'x'.repeat(301) }, { ...place('Ciudad de México'), label: {} }]) await assert.rejects(validate({ originPlace }), /selección de ubicación/);
      assert.equal((await validate({ additionalDestinations: Array.from({ length: 5 }, (_, index) => ({ address: `Destino ${index}`, notes: 'x'.repeat(300) })) })).fields.additionalDestinations.length, 5);
    });
    await suite.test('los helpers son privados e invocadores, sin permisos nuevos para clientes', async () => {
      const rows = (await db.query(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as client_execute
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('normalize_request_place','normalize_request_destinations')`)).rows;
      assert.equal(rows.length, 2);
      for (const row of rows) { assert.equal(row.prosecdef, false); assert.equal(row.anon_execute, false); assert.equal(row.client_execute, false); }
    });
    await suite.test('configuración pública anuncia compatibilidad sin exponer datos ni abrir la red', async () => {
      await db.exec('set role anon');
      try {
        const configuration = (await db.query('select public.public_site_config() as config')).rows[0].config;
        assert.deepEqual(configuration, { accepting_requests: true, network_enabled: false, privacy_version: '2026-10-30', default_business_slug: 'd-curiel', business_routing_version: 1, route_destinations_version: 1 });
      } finally { await db.exec('reset role'); }
    });
    await suite.test('envío, reintento y lectura autorizada conservan toda la ruta sin duplicar avisos', async () => {
      const payload = { ...draft(), owner_id: providerId, fields: { ...draft().fields, destinationPlace: place('Centro de Puebla'), additionalDestinations: [{ address: 'Casa de Cholula', notes: 'Piano' }, { address: 'Taller de Atlixco', place: place('Taller de Atlixco') }] } };
      await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal1"}',false)`, [clientId]);
      await db.exec('set role authenticated');
      const submit = (data = payload) => db.query(`select to_jsonb(public.submit_business_request('MF-ROUTE-001',$1::jsonb,'d-curiel','2026-10-30')) as request`, [JSON.stringify(data)]).then(result => result.rows[0].request);
      const first = await submit(); const again = await submit();
      assert.equal(first.id, again.id); assert.equal(first.owner_id, clientId);
      assert.deepEqual(first.payload.fields.additionalDestinations, payload.fields.additionalDestinations);
      await assert.rejects(submit({ ...payload, fields: { ...payload.fields, additionalDestinations: payload.fields.additionalDestinations.toReversed() } }), /referencia|mism/);
      await db.exec('reset role');
      assert.equal((await db.query(`select count(*)::int as count from public.notifications where request_id=$1`, [first.id])).rows[0].count, 1);
      await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal2"}',false)`, [providerId]);
      await db.exec('set role authenticated');
      const rows = (await db.query('select payload from public.move_requests')).rows;
      assert.equal(rows.length, 1); assert.deepEqual(rows[0].payload.fields.additionalDestinations, payload.fields.additionalDestinations);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});
