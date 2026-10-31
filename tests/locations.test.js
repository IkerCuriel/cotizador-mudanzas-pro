import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestText, createRequest, normalizeDraft, restoreRequest } from '../src/request.js';
import { normalizeAdditionalDestinations, normalizeLocationSelection, routeText } from '../src/locations.js';
import { importRequest } from '../src/storage.js';

const selection = (label = 'Centro de Puebla') => ({ placeId: 'ChIJ_test-selected-location-01', label });

test('selected place is retained only while its label matches the saved address', () => {
  const place = selection();
  assert.deepEqual(normalizeLocationSelection({ ...place, lat: 12, role: 'admin', photos: ['private'] }, place.label), place);
  assert.equal(normalizeLocationSelection(place, 'Otro domicilio'), undefined);
  for (const value of [null, [], {}, { ...place, placeId: 'https://example.test' }, { ...place, placeId: 'x'.repeat(301) }, { ...place, label: {} }]) {
    assert.equal(normalizeLocationSelection(value, place.label), undefined);
  }
  assert.equal(normalizeLocationSelection(Object.create(place), place.label), undefined);
});

test('legacy requests and removed stops do not gain optional location fields', () => {
  const previous = normalizeDraft({ fields: { origin: 'CDMX Centro', destination: 'Puebla Centro' } });
  const withEmpty = normalizeDraft({ fields: { ...previous.fields, additionalDestinations: [], originPlace: {}, destinationPlace: {} } });
  assert.deepEqual(withEmpty, previous);
  assert.equal(Object.hasOwn(previous.fields, 'additionalDestinations'), false);
  assert.equal(Object.hasOwn(previous.fields, 'originPlace'), false);
});

test('additional stops preserve order, clear stale selections and retain incomplete draft rows', () => {
  const normalized = normalizeAdditionalDestinations([
    { address: '  Centro de Puebla  ', place: selection(), notes: '  Dejar las cajas\u0007  ', owner_id: 'injected' },
    { address: 'Taller de Cholula', place: selection() },
    { address: '' },
  ]);
  assert.deepEqual(normalized, [
    { address: 'Centro de Puebla', place: selection(), notes: 'Dejar las cajas' },
    { address: 'Taller de Cholula' },
    { address: '' },
  ]);
  assert.equal(routeText({ origin: 'CDMX', destination: 'Puebla', additionalDestinations: normalized }), 'CDMX → Puebla → Centro de Puebla → Taller de Cholula → Destino 4 por definir');
  for (const value of [null, {}, 'Ciudad', [null], [42], new Array(2), Array.from({ length: 6 }, () => ({ address: 'Puebla' }))]) assert.throws(() => normalizeAdditionalDestinations(value));
});

test('the complete ordered route survives request export, restore and import', () => {
  const fields = {
    origin: 'Centro de Puebla', originPlace: selection(), destination: 'Bodega principal',
    additionalDestinations: [
      { address: 'Casa de Cholula', place: selection('Casa de Cholula'), notes: 'Descargar el piano' },
      { address: 'Taller de Atlixco', notes: 'Recoger las cajas' },
    ],
  };
  const request = createRequest({ fields });
  const restored = restoreRequest(JSON.parse(JSON.stringify(request)));
  const stored = new Map();
  const imported = importRequest(JSON.stringify(request), { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  for (const result of [restored, imported]) {
    assert.deepEqual(result.fields.additionalDestinations, fields.additionalDestinations);
    assert.deepEqual(result.fields.originPlace, fields.originPlace);
  }
  const text = buildRequestText(request);
  assert.ok(text.indexOf('Bodega principal') < text.indexOf('Casa de Cholula'));
  assert.ok(text.indexOf('Casa de Cholula') < text.indexOf('Taller de Atlixco'));
  assert.match(text, /DESTINO 2 · DESPUÉS DEL DESTINO ANTERIOR/);
  assert.match(text, /DESTINO 3 · DESPUÉS DEL DESTINO ANTERIOR/);
  assert.match(text, /Indicaciones: Descargar el piano/);
  assert.ok(!text.includes('ChIJ_'));
});
