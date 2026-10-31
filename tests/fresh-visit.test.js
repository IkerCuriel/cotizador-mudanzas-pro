import test from 'node:test';
import assert from 'node:assert/strict';
import { setupFreshVisit } from '../src/fresh-visit.js';
import { ACTIVE_DRAFT_KEY, LEGACY_DRAFT_KEY, SUBMISSION_RECEIPT_KEY } from '../src/submission-lifecycle.js';
import { REQUESTS_KEY } from '../src/storage.js';

function pageShow(view, persisted) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  view.dispatchEvent(event);
}

test('a new visit discards old drafts without reading them and preserves history, receipt and authentication', () => {
  const records = new Map([
    [ACTIVE_DRAFT_KEY, JSON.stringify({ fields: { origin: 'Una dirección anterior' } })],
    [LEGACY_DRAFT_KEY, '{invalid legacy draft'],
    [REQUESTS_KEY, 'saved requests'],
    [SUBMISSION_RECEIPT_KEY, 'last prepared receipt'],
    ['sb-project-auth-token', 'current session'],
    ['preferences', 'unchanged'],
  ]);
  let resets = 0;
  let reads = 0;
  let writes = 0;
  const local = {
    getItem() { reads++; throw new Error('Old drafts must not be read or migrated'); },
    setItem() { writes++; throw new Error('No replacement draft should be persisted'); },
    removeItem(key) { records.delete(key); },
  };
  const cleanup = setupFreshVisit({
    view: new EventTarget(), getStorage: () => local,
    reset() {
      resets++;
      assert.equal(records.has(ACTIVE_DRAFT_KEY), false);
      assert.equal(records.has(LEGACY_DRAFT_KEY), false);
    },
  });
  assert.equal(resets, 1);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.deepEqual(Object.fromEntries(records), {
    [REQUESTS_KEY]: 'saved requests',
    [SUBMISSION_RECEIPT_KEY]: 'last prepared receipt',
    'sb-project-auth-token': 'current session',
    preferences: 'unchanged',
  });
  cleanup();
});

test('Back/Forward Cache starts a clean visit but initial pageshow and temporary app switches retain current work', () => {
  const view = new EventTarget();
  const records = new Map();
  let activeDraft = 'old form';
  let resets = 0;
  const cleanup = setupFreshVisit({
    view, getStorage: () => ({ removeItem: (key) => records.delete(key) }),
    reset() { activeDraft = ''; resets++; },
  });
  assert.equal(activeDraft, '');
  activeDraft = 'New address being typed';
  pageShow(view, false);
  for (const name of ['visibilitychange', 'pagehide', 'beforeunload', 'focus']) view.dispatchEvent(new Event(name));
  assert.equal(activeDraft, 'New address being typed');
  assert.equal(resets, 1);

  // An older tab can still have written draft keys while this page was away.
  records.set(ACTIVE_DRAFT_KEY, 'stale draft from another tab');
  records.set(LEGACY_DRAFT_KEY, 'older version');
  pageShow(view, true);
  assert.equal(activeDraft, '');
  assert.equal(resets, 2);
  assert.equal(records.size, 0);

  cleanup();
  activeDraft = 'No handler after disposal';
  pageShow(view, true);
  assert.equal(activeDraft, 'No handler after disposal');
  assert.equal(resets, 2);
});

test('blocked storage access cannot prevent a clean form on startup or restored navigation', () => {
  const view = new EventTarget();
  let resets = 0;
  const cleanup = setupFreshVisit({
    view,
    getStorage() { throw new Error('Storage access denied'); },
    reset() { resets++; },
  });
  assert.equal(resets, 1);
  pageShow(view, true);
  assert.equal(resets, 2);
  cleanup();
});

test('failure to remove an old draft still resets the form without deleting other stored data', () => {
  const attempted = [];
  let resets = 0;
  const cleanup = setupFreshVisit({
    view: new EventTarget(),
    getStorage: () => ({
      removeItem(key) { attempted.push(key); throw new Error('Read-only storage'); },
      getItem() { assert.fail('A failed deletion must not fall back to restoring a draft'); },
      clear() { assert.fail('History and authentication must remain untouched'); },
    }),
    reset() { resets++; },
  });
  assert.deepEqual(new Set(attempted), new Set([ACTIVE_DRAFT_KEY, LEGACY_DRAFT_KEY]));
  assert.equal(resets, 1);
  cleanup();
});
