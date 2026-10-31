import { clearStoredDraft } from './submission-lifecycle.js';

/** A request draft belongs to one document visit, never to persistent storage. */
export function setupFreshVisit({ reset, view = window, getStorage = () => globalThis.localStorage }) {
  const start = () => {
    // Old releases saved drafts. Discard only those keys without reading them,
    // even when an old tab has rewritten them. History and Auth remain intact.
    try { clearStoredDraft(getStorage()); } catch { /* A clean form does not require storage access. */ }
    reset();
  };
  const onPageShow = (event) => {
    // Back/Forward Cache revives the same DOM and JS without running startup.
    // Switching apps or temporarily hiding a tab must not discard active work.
    if (event.persisted) start();
  };
  view.addEventListener('pageshow', onPageShow);
  start();
  return () => view.removeEventListener('pageshow', onPageShow);
}
