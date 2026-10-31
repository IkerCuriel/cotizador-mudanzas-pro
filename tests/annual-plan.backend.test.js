import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Exercise the upgrade on the exact original catalog DDL without unrelated
// account fixtures. The complete migration chain is tested by provider-plans.
test('annual catalog upgrade preserves monthly pricing and never enables public billing access', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create schema private;');
    const original = await readFile(new URL('../supabase/migrations/20261031010000_provider_plans.sql', import.meta.url), 'utf8');
    await db.exec(original.slice(original.indexOf('create table private.subscription_plans'), original.indexOf('create table private.provider_complimentary_access')));
    await db.exec('alter table private.subscription_plans enable row level security; revoke all on private.subscription_plans from public,anon,authenticated;');
    await db.exec(await readFile(new URL('../supabase/migrations/20261031021000_annual_plan.sql', import.meta.url), 'utf8'));
    const rows = (await db.query('select code,amount_minor,currency,billing_interval,checkout_enabled from private.subscription_plans order by code')).rows;
    assert.deepEqual(rows, [
      { code:'annual_1440', amount_minor:144000, currency:'MXN', billing_interval:'year', checkout_enabled:false },
      { code:'monthly_149', amount_minor:14900, currency:'MXN', billing_interval:'month', checkout_enabled:false },
    ]);
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='private.subscription_plans'::regclass")).rows[0].relrowsecurity, true);
    for (const values of [[1,'MXN','week'],[-1,'MXN','year'],[144000,'USD','year']]) {
      await assert.rejects(db.query('insert into private.subscription_plans(code,amount_minor,currency,billing_interval) values(\'invalid\',$1,$2,$3)', values), /check constraint/);
    }
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from private.subscription_plans'), /permission denied/);
      await assert.rejects(db.query("update private.subscription_plans set checkout_enabled=true where code='annual_1440'"), /permission denied/);
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
