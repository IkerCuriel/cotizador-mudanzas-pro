import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequest } from '../src/request.js';
import { saveRequest, loadRequests, REQUESTS_KEY } from '../src/storage.js';
import { ACTIVE_DRAFT_KEY, LEGACY_DRAFT_KEY, SUBMISSION_RECEIPT_KEY, createSubmissionLifecycle, clearStoredDraft } from '../src/submission-lifecycle.js';

function storage() {
  const records = new Map();
  return { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) };
}
function request(id = 'MF-HANDOFF-A') {
  return createRequest({fields:{origin:'Origen privado',destination:'Destino privado',customerName:'Cliente de prueba',phone:'5500000000',privacyConsent:true,additionalDestinations:[{address:'Una parada',notes:'Dos cajas'}]},inventory:{'boxes-medium':2}},{id,createdAt:'2026-10-30T18:00:00.000Z'});
}
const prepared = (value, fingerprint = 'draft-A') => ({id:value.id,fingerprint});

test('WhatsApp handoff retires only the matching prepared draft and retains an immutable copy', () => {
  const local = storage(); const original = request(); saveRequest(original, local);
  local.setItem('sb-project-auth-token','preserve-auth');
  const flow = createSubmissionLifecycle({getStorage:()=>local});
  const outcome = flow.complete(original,{channel:'whatsapp',prepared:prepared(original),currentFingerprint:'draft-A'});
  assert.equal(outcome.clearDraft,true); assert.equal(outcome.detachPrepared,true);
  original.fields.origin = 'Changed outside the snapshot';
  assert.equal(flow.getRequest().fields.origin,'Origen privado');
  const copy = flow.getRequest(); copy.fields.origin = 'Changed returned copy';
  assert.equal(flow.getRequest().fields.origin,'Origen privado');
  const pointer = JSON.parse(local.getItem(SUBMISSION_RECEIPT_KEY));
  assert.deepEqual(Object.keys(pointer).sort(),['channel','completedAt','draftRetired','id']);
  assert.equal(pointer.channel,'whatsapp'); assert.equal(pointer.id,original.id);
  assert.equal(flow.wasCloudSubmitted(original.id),false);
  assert.equal(local.getItem('sb-project-auth-token'),'preserve-auth');
  assert.equal(loadRequests(local).length,1); assert.equal(outcome.receipt.persisted,true);
});

test('reopening or re-sharing a completed reference cannot clear a new draft', () => {
  const local=storage(); const previous=request(); saveRequest(previous,local);
  const flow=createSubmissionLifecycle({getStorage:()=>local});
  flow.complete(previous,{channel:'whatsapp',prepared:prepared(previous),currentFingerprint:'draft-A'});
  const next=request('MF-HANDOFF-B');
  let outcome=flow.complete(previous,{channel:'whatsapp',prepared:prepared(next,'draft-B'),currentFingerprint:'draft-B'});
  assert.equal(outcome.clearDraft,false); assert.equal(outcome.detachPrepared,false);
  outcome=flow.complete(previous,{channel:'whatsapp',prepared:prepared(previous),currentFingerprint:'draft-A'});
  assert.equal(outcome.clearDraft,false);
  assert.equal(flow.getRequest().id,previous.id);
});

test('late cloud success cannot erase an edited or replacement draft', () => {
  const local=storage(); const previous=request(); saveRequest(previous,local);
  const edited=createSubmissionLifecycle({getStorage:()=>local});
  const outcome=edited.complete(previous,{channel:'cloud',prepared:prepared(previous),currentFingerprint:'edited-draft'});
  assert.equal(outcome.clearDraft,false); assert.equal(outcome.detachPrepared,true);
  assert.equal(edited.wasCloudSubmitted(previous.id),true);
  const replacement=createSubmissionLifecycle({getStorage:()=>storage()});
  const next=request('MF-HANDOFF-B');
  const replaced=replacement.complete(previous,{channel:'cloud',prepared:prepared(next,'draft-B'),currentFingerprint:'draft-B'});
  assert.equal(replaced.clearDraft,false); assert.equal(replaced.detachPrepared,false);
});

test('reloading restores the receipt from history but never restores a retired draft', () => {
  const local=storage(); const original=request(); saveRequest(original,local);
  const flow=createSubmissionLifecycle({getStorage:()=>local});
  flow.complete(original,{channel:'whatsapp',prepared:prepared(original),currentFingerprint:'draft-A'});
  const restored=createSubmissionLifecycle({getStorage:()=>local});
  assert.equal(restored.getReceipt().recoverable,true);
  assert.equal(restored.getRequest().id,original.id);
  assert.equal(restored.retiredDraft(original.id),true);
  assert.equal(restored.retiredDraft('MF-HANDOFF-B'),false);
  assert.equal(restored.complete(original,{channel:'whatsapp',prepared:prepared(original),currentFingerprint:'draft-A'}).clearDraft,false);
});

test('cloud confirmation is not downgraded when the same reference is later opened in WhatsApp', () => {
  const local=storage(); const original=request(); saveRequest(original,local);
  const flow=createSubmissionLifecycle({getStorage:()=>local});
  flow.complete(original,{channel:'cloud',prepared:prepared(original),currentFingerprint:'draft-A'});
  flow.complete(original,{channel:'whatsapp',prepared:null,currentFingerprint:'new'});
  assert.equal(flow.getReceipt().channel,'cloud');
  assert.equal(flow.getReceipt().draftRetired,true);
  assert.equal(createSubmissionLifecycle({getStorage:()=>local}).wasCloudSubmitted(original.id),true);
});

test('storage failures preserve an in-memory copy and do not claim durable recovery', () => {
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');},removeItem(){throw new Error('blocked');}};
  const flow=createSubmissionLifecycle({getStorage:()=>blocked});
  const original=request();
  const result=flow.complete(original,{channel:'whatsapp',prepared:prepared(original),currentFingerprint:'draft-A'});
  assert.equal(result.clearDraft,true); assert.equal(result.receipt.persisted,false); assert.equal(result.receipt.recoverable,true);
  assert.equal(flow.getRequest().id,original.id); assert.equal(clearStoredDraft(blocked),false);
  const empty=storage(); const noHistory=createSubmissionLifecycle({getStorage:()=>empty});
  assert.equal(noHistory.complete(original,{channel:'whatsapp',prepared:prepared(original),currentFingerprint:'draft-A'}).receipt.persisted,false);
});

test('clearing a draft preserves local request history, authentication and unrelated preferences', () => {
  const local=storage(); saveRequest(request(),local);
  local.setItem(ACTIVE_DRAFT_KEY,'old-draft'); local.setItem(LEGACY_DRAFT_KEY,'old-legacy');
  local.setItem('sb-project-auth-token','session'); local.setItem('preferences','keep');
  const history=local.getItem(REQUESTS_KEY);
  assert.equal(clearStoredDraft(local),true);
  assert.equal(local.getItem(ACTIVE_DRAFT_KEY),null); assert.equal(local.getItem(LEGACY_DRAFT_KEY),null);
  assert.equal(local.getItem(REQUESTS_KEY),history); assert.equal(local.getItem('sb-project-auth-token'),'session'); assert.equal(local.getItem('preferences'),'keep');
});

test('malformed receipt metadata neither restores arbitrary data nor erases stored content', () => {
  const local=storage(); local.setItem(ACTIVE_DRAFT_KEY,'keep-draft');
  for (const value of ['{bad',JSON.stringify({id:'../../private',channel:'cloud',completedAt:'2026-10-30'}),JSON.stringify({id:'MF-HANDOFF-A',channel:'delivered',completedAt:'2026-10-30'})]) {
    local.setItem(SUBMISSION_RECEIPT_KEY,value);
    const flow=createSubmissionLifecycle({getStorage:()=>local});
    assert.equal(flow.getReceipt(),null); assert.equal(flow.getRequest(),null);
    assert.equal(local.getItem(ACTIVE_DRAFT_KEY),'keep-draft');
  }
});
