// Optional browser-only adapter. Importing this module never loads Google or starts a search.
// The caller owns debounce, the active field, and discarding obsolete search responses.
const loaders = new WeakMap();
let callbackSequence = 0;
const cleanText = (value, max = 500) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export class GooglePlacesError extends Error {
  constructor(code) {
    const messages = {
      not_configured: 'La búsqueda de sugerencias todavía no está disponible. Puedes escribir la ubicación y revisar el mapa.',
      unavailable: 'No pudimos cargar las sugerencias de Google Maps. Puedes escribir la ubicación y continuar.',
      search_failed: 'No pudimos consultar las sugerencias. Inténtalo de nuevo o escribe la ubicación.',
      selection_failed: 'No pudimos confirmar ese resultado. Elige otra sugerencia o escribe la ubicación.',
      invalid_session: 'Vuelve a escribir la ubicación para iniciar una nueva búsqueda.',
    };
    super(messages[code] || messages.unavailable);
    this.name = 'GooglePlacesError';
    this.code = code;
  }
}

export function isGoogleMapsKey(value) {
  return typeof value === 'string' && /^AIza[A-Za-z0-9_-]{35}$/.test(value.trim());
}

/** Google response objects stay transient. Only this small selection reaches the form. */
export function selectionFromPlace(place) {
  const placeId = typeof place?.id === 'string' ? place.id : '';
  const label = cleanText(place?.formattedAddress, 501);
  if (!/^[A-Za-z0-9_-]{1,300}$/.test(placeId) || !label || label.length > 500) throw new GooglePlacesError('selection_failed');
  return { placeId, label };
}

function validLibrary(library) {
  if (typeof library?.AutocompleteSessionToken !== 'function'
    || typeof library?.AutocompleteSuggestion?.fetchAutocompleteSuggestions !== 'function') {
    throw new GooglePlacesError('unavailable');
  }
  return library;
}

/** Uses the documented direct script loader and importLibrary, without inline JavaScript. */
export function loadGooglePlaces({ apiKey, document: doc = globalThis.document, window: win = globalThis.window, timeoutMs = 12000 } = {}) {
  if (!isGoogleMapsKey(apiKey)) return Promise.reject(new GooglePlacesError('not_configured'));
  if (!win || !doc?.createElement || !doc?.head?.appendChild) return Promise.reject(new GooglePlacesError('unavailable'));
  const existing = loaders.get(win);
  if (existing) return existing;
  const pending = new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let script;
    const callbackName = `__moveflowMapsReady${++callbackSequence}`;
    const finish = (error, library) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      delete win[callbackName];
      if (error) { script?.remove(); reject(new GooglePlacesError('unavailable')); }
      else resolve(library);
    };
    const ready = () => {
      Promise.resolve().then(() => win.google?.maps?.importLibrary('places'))
        .then(validLibrary).then((library) => finish(null, library), () => finish(true));
    };
    timer = setTimeout(() => finish(true), timeoutMs);
    if (typeof win.google?.maps?.importLibrary === 'function') { ready(); return; }
    win[callbackName] = ready;
    script = doc.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    for (const [name, value] of Object.entries({ key: apiKey.trim(), libraries: 'places', v: 'quarterly', language: 'es', region: 'MX', loading: 'async', callback: callbackName })) url.searchParams.set(name, value);
    script.src = url.href;
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    const nonce = doc.querySelector?.('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.onerror = () => finish(true);
    try { doc.head.appendChild(script); } catch { finish(true); }
  });
  loaders.set(win, pending);
  pending.catch(() => { if (loaders.get(win) === pending) loaders.delete(win); });
  return pending;
}

/** A token belongs to one field's query/selection session; never persist or reuse after select. */
export function createGooglePlacesClient({ apiKey = '', document: doc = globalThis.document, window: win = globalThis.window, loadLibrary } = {}) {
  const available = isGoogleMapsKey(apiKey);
  const sessions = new WeakSet();
  const predictionSessions = new WeakMap();
  let libraryPromise;
  const library = () => {
    if (!available) return Promise.reject(new GooglePlacesError('not_configured'));
    if (!libraryPromise) {
      libraryPromise = Promise.resolve().then(() => loadLibrary ? loadLibrary() : loadGooglePlaces({ apiKey, document: doc, window: win })).then(validLibrary);
      libraryPromise.catch(() => { libraryPromise = undefined; });
    }
    return libraryPromise;
  };
  return {
    available,
    async createSession() {
      try {
        const api = await library();
        const session = new api.AutocompleteSessionToken();
        sessions.add(session);
        return session;
      } catch (error) {
        throw error instanceof GooglePlacesError ? error : new GooglePlacesError('unavailable');
      }
    },
    async fetchSuggestions(value, session) {
      const input = cleanText(value);
      if (input.length < 3) return [];
      if (!session || !sessions.has(session)) throw new GooglePlacesError('invalid_session');
      try {
        const api = await library();
        const response = await api.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: session, language: 'es', region: 'mx' });
        if (!sessions.has(session)) return [];
        return (Array.isArray(response?.suggestions) ? response.suggestions : []).slice(0, 5).flatMap((entry) => {
          const prediction = entry?.placePrediction;
          if (!prediction || typeof prediction.toPlace !== 'function') return [];
          const label = cleanText(prediction.text?.toString?.());
          if (!label) return [];
          predictionSessions.set(prediction, session);
          return [{ label, prediction }];
        });
      } catch (error) {
        throw error instanceof GooglePlacesError ? error : new GooglePlacesError('search_failed');
      }
    },
    async select(prediction) {
      const session = prediction && predictionSessions.get(prediction);
      if (!session || !sessions.has(session)) throw new GooglePlacesError('invalid_session');
      // A details attempt ends our local session even when the provider rejects it.
      sessions.delete(session);
      try {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ['id', 'formattedAddress'] });
        return selectionFromPlace(place);
      } catch (error) {
        throw error instanceof GooglePlacesError ? error : new GooglePlacesError('selection_failed');
      }
    },
    endSession(session) { if (session) sessions.delete(session); },
  };
}
