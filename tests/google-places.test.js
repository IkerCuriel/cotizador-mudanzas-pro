import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePlacesClient, GooglePlacesError, isGoogleMapsKey, loadGooglePlaces, selectionFromPlace } from '../src/google-places.js';

const apiKey = `AIza${'a'.repeat(35)}`; // Synthetic format-only value; no network is used by these tests.
function fixture({ searchError, selectionError, placeValues = {} } = {}) {
  const searches = []; const fields = [];
  const place = { id: 'ChIJ_test', formattedAddress: 'Centro, Ciudad de México, México', ...placeValues,
    fetchFields: async (args) => { fields.push(args); if (selectionError) throw selectionError; } };
  const prediction = { text: { toString: () => 'Centro, CDMX' }, toPlace: () => place };
  class AutocompleteSessionToken {}
  const api = { AutocompleteSessionToken, AutocompleteSuggestion: { fetchAutocompleteSuggestions: async (request) => {
    searches.push(request); if (searchError) throw searchError;
    return { suggestions: [{ placePrediction: prediction }, { queryPrediction: {} }] };
  } } };
  return { api, fields, searches, prediction, place };
}
function browserFixture(api = fixture().api) {
  const scripts = [];
  const win = {};
  const doc = { createElement: () => ({ remove() { this.removed = true; } }), querySelector: () => ({ nonce: 'nonce-test' }), head: { appendChild(script) { scripts.push(script); } } };
  const ready = () => {
    win.google = { maps: { importLibrary: async (name) => { assert.equal(name, 'places'); return api; } } };
    win[new URL(scripts.at(-1).src).searchParams.get('callback')]();
  };
  return { win, doc, scripts, ready };
}

test('missing or invalid key never initializes Google; normal imports and client creation are inert', async () => {
  let loads = 0;
  for (const invalid of ['', undefined, 'secret-server-key', 'AIza&callback=evil', apiKey + 'extra']) {
    assert.equal(isGoogleMapsKey(invalid), false);
    const client = createGooglePlacesClient({ apiKey: invalid, loadLibrary: () => { loads += 1; } });
    assert.equal(client.available, false);
    await assert.rejects(client.createSession(), { code: 'not_configured' });
    await assert.rejects(loadGooglePlaces({ apiKey: invalid }), { code: 'not_configured' });
  }
  assert.equal(loads, 0);
  const client = createGooglePlacesClient({ apiKey, loadLibrary: () => { loads += 1; return fixture().api; } });
  assert.equal(client.available, true);
  assert.equal(loads, 0);
});

test('a field session groups predictions and requests only the selected place ID and address', async () => {
  const f = fixture(); let loads = 0;
  const client = createGooglePlacesClient({ apiKey, loadLibrary: async () => { loads += 1; return f.api; } });
  const token = await client.createSession();
  assert.deepEqual(await client.fetchSuggestions('ab', token), []);
  const choices = await client.fetchSuggestions('  Centro\nCDMX  ', token);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].label, 'Centro, CDMX');
  assert.deepEqual(f.searches[0], { input: 'Centro CDMX', sessionToken: token, language: 'es', region: 'mx' });
  const selection = await client.select(choices[0].prediction);
  assert.deepEqual(selection, { placeId: 'ChIJ_test', label: 'Centro, Ciudad de México, México' });
  assert.deepEqual(f.fields, [{ fields: ['id', 'formattedAddress'] }]);
  await assert.rejects(client.fetchSuggestions('Centro', token), { code: 'invalid_session' });
  await assert.rejects(client.select(choices[0].prediction), { code: 'invalid_session' });
  const next = await client.createSession();
  assert.notEqual(next, token);
  assert.equal(loads, 1);
});

test('tokens cannot move between independent clients or survive an explicitly ended session', async () => {
  const f = fixture(); const create = () => createGooglePlacesClient({ apiKey, loadLibrary: async () => f.api });
  const first = create(); const second = create();
  const token = await first.createSession();
  await assert.rejects(second.fetchSuggestions('Centro', token), { code: 'invalid_session' });
  const choices = await first.fetchSuggestions('Centro', token);
  first.endSession(token);
  await assert.rejects(first.select(choices[0].prediction), { code: 'invalid_session' });
  assert.equal(f.fields.length, 0);
});

test('provider failures are translated without exposing keys, request URLs or raw provider errors', async () => {
  for (const mode of ['search', 'selection']) {
    const f = fixture({ [mode === 'search' ? 'searchError' : 'selectionError']: new Error('private-query-and-api-key') });
    const client = createGooglePlacesClient({ apiKey, loadLibrary: async () => f.api });
    const token = await client.createSession();
    const operation = mode === 'search' ? client.fetchSuggestions('Centro', token)
      : client.select((await client.fetchSuggestions('Centro', token))[0].prediction);
    await assert.rejects(operation, (error) => error instanceof GooglePlacesError && !error.message.includes('private-query') && !error.message.includes(apiKey));
    if (mode === 'selection') await assert.rejects(client.fetchSuggestions('Centro', token), { code: 'invalid_session' });
  }
});

test('invalid selected records cannot become a confirmed location or carry arbitrary metadata', () => {
  for (const place of [null, {}, { id: 'javascript:alert(1)', formattedAddress: 'Centro' }, { id: 'safe', formattedAddress: '' }, { id: 'safe', formattedAddress: 'a'.repeat(501) }]) {
    assert.throws(() => selectionFromPlace(place), { code: 'selection_failed' });
  }
  assert.deepEqual(selectionFromPlace({ id: 'safe', formattedAddress: '  Centro\nCDMX  ', location: { lat: 1, lng: 2 }, rating: 5, photos: ['secret'] }), { placeId: 'safe', label: 'Centro CDMX' });
});

test('loader shares one browser request and uses a fixed Google host, locale and quarterly channel', async () => {
  const b = browserFixture();
  const pending = loadGooglePlaces({ apiKey, document: b.doc, window: b.win });
  assert.equal(loadGooglePlaces({ apiKey, document: b.doc, window: b.win }), pending);
  assert.equal(b.scripts.length, 1);
  const script = b.scripts[0]; const url = new URL(script.src);
  assert.equal(url.origin, 'https://maps.googleapis.com');
  assert.equal(url.pathname, '/maps/api/js');
  assert.equal(url.searchParams.get('libraries'), 'places');
  assert.equal(url.searchParams.get('language'), 'es');
  assert.equal(url.searchParams.get('region'), 'MX');
  assert.equal(url.searchParams.get('v'), 'quarterly');
  assert.equal(script.nonce, 'nonce-test');
  assert.equal(script.async, true);
  b.ready(); await pending;
  assert.equal(b.win[url.searchParams.get('callback')], undefined);
});

test('network failures remove the failed script and allow an explicit later retry', async () => {
  const b = browserFixture();
  const first = loadGooglePlaces({ apiKey, document: b.doc, window: b.win });
  b.scripts[0].onerror();
  await assert.rejects(first, { code: 'unavailable' });
  assert.equal(b.scripts[0].removed, true);
  const retry = loadGooglePlaces({ apiKey, document: b.doc, window: b.win });
  assert.equal(b.scripts.length, 2);
  b.ready(); await retry;
});

test('a stalled loader times out and cleans up its callback', async () => {
  const b = browserFixture();
  const pending = loadGooglePlaces({ apiKey, document: b.doc, window: b.win, timeoutMs: 5 });
  const callback = new URL(b.scripts[0].src).searchParams.get('callback');
  await assert.rejects(pending, { code: 'unavailable' });
  assert.equal(b.win[callback], undefined);
  assert.equal(b.scripts[0].removed, true);
});
