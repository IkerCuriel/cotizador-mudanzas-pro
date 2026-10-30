import test from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_PAGE_SIZE, requestCursor, requestPageQuery, loadRequestPage, loadRequestDetail } from '../src/inbox.js';

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
function clientWith(result) {
  const calls = [];
  const query = Object.fromEntries(['select', 'order', 'limit', 'eq', 'or'].map((method) => [method, (...args) => { calls.push([method, ...args]); return query; }]));
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  query.maybeSingle = () => { calls.push(['maybeSingle']); return Promise.resolve(result); };
  return { calls, from(table) { calls.push(['from', table]); return query; } };
}

test('inbox pages use bounded summaries rather than downloading every private file', async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: id(100 - i), created_at: '2026-10-30T15:00:00.123456+00:00' }));
  const client = clientWith({ data: rows, error: null });
  const page = await loadRequestPage(client);
  assert.equal(page.rows.length, INBOX_PAGE_SIZE);
  assert.equal(page.hasNext, true);
  assert.deepEqual(page.nextCursor, rows[19]);
  const selected = client.calls.find(([method]) => method === 'select')[1];
  assert.ok(!selected.split(',').includes('payload'));
  assert.ok(!selected.includes('*'));
  for (const field of ['phone', 'email', 'inventory', 'notes']) assert.ok(!selected.includes(field));
  assert.ok(selected.includes('origin:payload->fields->>origin'));
  assert.deepEqual(client.calls.filter(([method]) => method === 'order'), [['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }]]);
  assert.deepEqual(client.calls.find(([method]) => method === 'limit'), ['limit', 21]);
});

test('cursor preserves submillisecond timestamps and ties use the row ID', () => {
  const cursor = { id: id(8), created_at: '2026-10-30T15:00:00.123456+00:00' };
  assert.deepEqual(requestCursor(cursor), cursor);
  const client = clientWith({ data: [], error: null });
  requestPageQuery(client, { cursor, businessId: id(55) });
  assert.deepEqual(client.calls.find(([method]) => method === 'eq'), ['eq', 'business_id', id(55)]);
  assert.deepEqual(client.calls.find(([method]) => method === 'or'), ['or', `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`]);
  assert.ok(!client.calls.some(([method]) => method === 'range'));
});

test('cursor and business filters reject malformed values instead of interpolating query expressions', () => {
  for (const cursor of [null, {}, { id: 'x),status.eq.submitted', created_at: '2026-10-30T15:00:00Z' }, { id: id(1), created_at: '2026-10-30T15:00:00Z),status.eq.submitted' }, { id: id(1), created_at: '2026-99-99T15:00:00Z' }]) {
    assert.throws(() => requestCursor(cursor));
  }
  assert.throws(() => requestPageQuery(clientWith({}), { businessId: 'any,role.eq.admin' }));
  assert.throws(() => requestPageQuery(clientWith({}), { ownerId: 'any,role.eq.admin' }));
});

test('customer inbox uses its owner index without replacing the database authorization', () => {
  const client = clientWith({ data: [], error: null });
  requestPageQuery(client, { ownerId: id(12) });
  assert.deepEqual(client.calls.filter(([method]) => method === 'eq'), [['eq', 'owner_id', id(12)]]);
  assert.ok(!client.calls.some(([method, field]) => method === 'eq' && field === 'business_id'));
});

test('last and empty pages have no forward cursor and query errors remain visible', async () => {
  for (const rows of [[], [{ id: id(2), created_at: '2026-10-30T15:00:00Z' }]]) {
    const page = await loadRequestPage(clientWith({ data: rows, error: null }));
    assert.equal(page.hasNext, false);
    assert.equal(page.nextCursor, null);
  }
  await assert.rejects(loadRequestPage(clientWith({ data: null, error: new Error('connection lost') })), /connection lost/);
});

test('full details require an explicit single request and inaccessible requests fail clearly', async () => {
  const row = { id: id(2), payload: { fields: { phone: '5500000000' } } };
  const client = clientWith({ data: row, error: null });
  assert.deepEqual(await loadRequestDetail(client, row.id), row);
  assert.deepEqual(client.calls.find(([method]) => method === 'eq'), ['eq', 'id', row.id]);
  assert.ok(client.calls.find(([method]) => method === 'select')[1].split(',').includes('payload'));
  assert.ok(client.calls.some(([method]) => method === 'maybeSingle'));
  await assert.rejects(loadRequestDetail(clientWith({ data: null, error: null }), id(3)), /ya no está disponible/);
  await assert.rejects(loadRequestDetail(client, 'untrusted'), /no es válida/);
});
