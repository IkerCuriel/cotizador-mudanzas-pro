import { restoreRequest } from './request.js';
import { loadRequests } from './storage.js';

export const ACTIVE_DRAFT_KEY = 'moveflow-request-draft-v1';
export const LEGACY_DRAFT_KEY = 'moveflow-quote-draft';
export const SUBMISSION_RECEIPT_KEY = 'moveflow-last-submission-v1';
const validReference = (value) => typeof value === 'string' && /^MF-[A-Za-z0-9-]{3,80}$/.test(value);
const validChannel = (value) => ['whatsapp', 'cloud'].includes(value);

function sanitizeReceipt(value) {
  if (!value || !validReference(value.id) || !validChannel(value.channel)
    || typeof value.completedAt !== 'string' || !Number.isFinite(Date.parse(value.completedAt))) return null;
  return { id: value.id, channel: value.channel, completedAt: value.completedAt, draftRetired: value.draftRetired === true };
}

/** Only the active draft keys may be removed. Never touch history or Auth storage. */
export function clearStoredDraft(storage) {
  let removed = true;
  for (const key of [ACTIVE_DRAFT_KEY, LEGACY_DRAFT_KEY]) {
    try { storage.removeItem(key); } catch { removed = false; }
  }
  return removed;
}

/** A completion records a handoff intent (WhatsApp) or acknowledged cloud write. */
export function createSubmissionLifecycle({ getStorage = () => globalThis.localStorage, readRequests = loadRequests, now = () => new Date().toISOString() } = {}) {
  let receipt = null;
  let snapshot = null;
  let persisted = true;
  const completed = new Set();
  const cloudCompleted = new Set();
  try {
    receipt = sanitizeReceipt(JSON.parse(getStorage().getItem(SUBMISSION_RECEIPT_KEY) || 'null'));
    if (receipt) {
      completed.add(receipt.id);
      if (receipt.channel === 'cloud') cloudCompleted.add(receipt.id);
      snapshot = readRequests(getStorage()).find((request) => request.id === receipt.id) || null;
    }
  } catch { /* A blocked/corrupt receipt never erases the draft or request history. */ }

  return {
    getReceipt() { return receipt ? { ...receipt, recoverable: Boolean(snapshot), persisted } : null; },
    getRequest() { return snapshot ? restoreRequest(snapshot) : null; },
    wasCloudSubmitted(id) { return cloudCompleted.has(id); },
    retiredDraft(id) { return Boolean(receipt?.draftRetired && receipt.id === id); },
    complete(request, { channel, prepared, currentFingerprint } = {}) {
      if (!validChannel(channel)) throw new Error('El canal de la solicitud no es válido.');
      const saved = restoreRequest(request);
      const ownsDraft = prepared?.id === saved.id;
      const clearDraft = !completed.has(saved.id) && ownsDraft && prepared.fingerprint === currentFingerprint;
      const previouslyRetired = receipt?.id === saved.id && receipt.draftRetired;
      if (channel === 'cloud') cloudCompleted.add(saved.id);
      receipt = {
        id: saved.id,
        channel: cloudCompleted.has(saved.id) ? 'cloud' : channel,
        completedAt: now(),
        draftRetired: clearDraft || previouslyRetired === true,
      };
      snapshot = saved; // Retain a recoverable copy even if storage/quota fails below.
      completed.add(saved.id);
      persisted = true;
      try {
        getStorage().setItem(SUBMISSION_RECEIPT_KEY, JSON.stringify(receipt));
        persisted = readRequests(getStorage()).some((existing) => existing.id === saved.id);
      }
      catch { persisted = false; }
      return { clearDraft, detachPrepared: ownsDraft, receipt: this.getReceipt() };
    },
  };
}
