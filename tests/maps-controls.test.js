import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBusinessLocationMap } from '../src/maps.js';

// Minimal DOM surface, real EventTarget dispatch and explicit provider doubles.
// Browser layout and touch/focus ordering are also exercised by the local fixture.
class Element extends EventTarget {
  constructor(root, tag = 'div') { super(); this.root = root; this.tagName = tag; this.children = []; this.attributes = new Map(); this.value = ''; this.checked = true; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'href') delete this.href; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className?.split(' ').includes(selector.slice(1));
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    return attribute ? this.attributes.has(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]) : this.tagName === selector;
  }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  focus() { this.root.activeElement?.dispatchEvent(new Event('blur')); this.root.activeElement = this; this.dispatchEvent(new Event('focus')); }
  scrollIntoView() {}
}
function event(type, values = {}) { const item = new Event(type, { cancelable: true }); for (const [key, value] of Object.entries(values)) Object.defineProperty(item, key, { value }); return item; }
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const selected = { placeId: 'TEST_Business', label: 'Calle de prueba 10, Ciudad de México' };
function fixture(t, overrides = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = { defaultView: { Event }, createElement(tag) { return new Element(root, tag); } };
  const page = root.createElement('main');
  root.querySelector = (selector) => page.querySelector(selector);
  root.getElementById = (id) => { const find = (node) => node.id === id ? node : node.children.map(find).find(Boolean); return find(page); };
  const wrap = root.createElement('div'); wrap.className = 'location-search';
  const input = root.createElement('input'); input.id = 'businessLocation'; wrap.append(input);
  const card = root.createElement('div'); card.setAttribute('data-location-map', 'businessLocation');
  for (const [tag, name] of [['button', 'preview'], ['a', 'link'], ['p', 'status'], ['div', 'frame']]) {
    const node = root.createElement(tag); node.setAttribute(`data-map-${name}`, ''); card.append(node);
  }
  const preference = root.createElement('input'); preference.id = 'businessMapsEnabled';
  page.append(wrap, card, preference);
  const requests = []; const ended = [];
  const places = {
    available: true, createSession: async () => ({}),
    fetchSuggestions: async (query, token) => { requests.push({ query, token }); return [{ label: `Negocio de prueba · ${query}`, prediction: {} }]; },
    select: async () => selected, endSession: (token) => ended.push(token), ...overrides,
  };
  const control = setupBusinessLocationMap(root, { apiKey: '', places });
  t.after(() => control.dispose());
  const query = async (value) => { input.value = value; input.dispatchEvent(event('input')); t.mock.timers.tick(350); await flush(); };
  return { root, input, card, wrap, preference, requests, ended, control, query,
    results: () => wrap.querySelector('[role="listbox"]'),
    status: () => card.querySelector('[data-map-status]'),
    frame: () => card.querySelector('[data-map-frame]'),
  };
}

test('standalone business maps need no route fields and without a key never claim a Google selection', async (t) => {
  const f = fixture(t, { available: false, createSession() { assert.fail('Unconfigured Places must stay inert'); } });
  assert.equal(f.root.getElementById('origin'), undefined);
  assert.equal(f.frame().children.length, 0);
  f.input.focus();
  assert.equal(f.frame().children.length, 1);
  assert.equal(new URL(f.frame().children[0].src).searchParams.get('q'), 'México');
  f.input.value = 'Bigos Tacos, Ciudad de México'; f.input.dispatchEvent(event('input')); t.mock.timers.tick(700); await flush();
  assert.equal(new URL(f.frame().children[0].src).searchParams.get('q'), f.input.value);
  assert.equal(f.input.getAttribute('role'), null);
  assert.deepEqual(f.control.collect(), {});
  assert.match(f.status().textContent, /orientativa/);
});

test('business autocomplete selects with keyboard, stores only matching ID/address, and clears on edits and reset', async (t) => {
  const f = fixture(t); f.input.focus(); await f.query('Bigos tacos');
  assert.equal(f.requests[0].query, 'Bigos tacos');
  assert.equal(f.input.getAttribute('aria-expanded'), 'true');
  const down = event('keydown', { key: 'ArrowDown' }); f.input.dispatchEvent(down); assert.equal(down.defaultPrevented, true);
  assert.equal(f.results().children[0].getAttribute('aria-selected'), 'true');
  const enter = event('keydown', { key: 'Enter' }); f.input.dispatchEvent(enter); await flush();
  assert.equal(enter.defaultPrevented, true);
  assert.equal(f.input.value, selected.label);
  assert.deepEqual(f.control.collect(), { businessLocationPlace: selected });
  assert.equal(new URL(f.card.querySelector('[data-map-link]').href).searchParams.get('query_place_id'), selected.placeId);
  f.input.value = 'Otra dirección'; f.input.dispatchEvent(event('input'));
  assert.deepEqual(f.control.collect(), {});
  assert.equal(f.frame().children.length, 0);
  assert.doesNotMatch(f.status().textContent, /Ubicación seleccionada/);
  f.input.value = ''; f.control.reset(); t.mock.timers.tick(1000); await flush();
  assert.equal(f.frame().children.length, 0);
  assert.equal(f.input.getAttribute('aria-expanded'), 'false');
});

test('touch pointerdown preserves focus for click, and a chosen result survives Tab while details finish', async (t) => {
  const details = deferred(); const f = fixture(t, { select: () => details.promise });
  f.input.focus(); await f.query('Restaurante');
  const option = f.results().children[0];
  const down = event('pointerdown', { button: 0, pointerType: 'touch' }); option.dispatchEvent(down);
  assert.equal(down.defaultPrevented, true);
  option.dispatchEvent(event('click'));
  f.preference.focus();
  details.resolve(selected); await flush();
  assert.equal(f.input.value, selected.label);
  assert.deepEqual(f.control.collect(), { businessLocationPlace: selected });
});

test('late suggestions cannot replace a newer query or reopen after Escape', async (t) => {
  const pending = [];
  const f = fixture(t, { fetchSuggestions(query) { const task = deferred(); pending.push({ query, ...task }); return task.promise; } });
  f.input.focus(); await f.query('Primera'); await f.query('Segunda');
  pending[1].resolve([{ label: 'Segunda respuesta', prediction: {} }]); await flush();
  pending[0].resolve([{ label: 'Respuesta vieja', prediction: {} }]); await flush();
  assert.equal(f.results().children[0].textContent, 'Segunda respuesta');
  await f.query('Tercera'); f.input.dispatchEvent(event('keydown', { key: 'Escape' }));
  pending[2].resolve([{ label: 'No reabrir', prediction: {} }]); await flush();
  assert.equal(f.input.getAttribute('aria-expanded'), 'false');
  assert.equal(f.results().children.length, 0);
  assert.ok(f.ended.length > 0);
});

test('editing a field invalidates a pending place selection', async (t) => {
  const details = deferred(); const f = fixture(t, { select: () => details.promise });
  f.input.focus(); await f.query('Ubicación'); f.results().children[0].dispatchEvent(event('click'));
  f.input.value = 'Dirección corregida'; f.input.dispatchEvent(event('input'));
  details.resolve(selected); await flush();
  assert.equal(f.input.value, 'Dirección corregida');
  assert.deepEqual(f.control.collect(), {});
});

test('reset during a pending selection cannot restore the previous business location', async (t) => {
  const details = deferred(); const f = fixture(t, { select: () => details.promise });
  f.input.focus(); await f.query('Ubicación'); f.results().children[0].dispatchEvent(event('click'));
  f.input.value = ''; f.control.reset();
  details.resolve(selected); await flush();
  assert.equal(f.input.value, '');
  assert.deepEqual(f.control.collect(), {});
  assert.equal(f.frame().children.length, 0);
});

test('disabling maps cancels pending work and disposing removes field listeners', async (t) => {
  const f = fixture(t); f.preference.checked = false; f.preference.dispatchEvent(event('change')); f.input.focus(); await f.query('Ubicación');
  assert.equal(f.frame().children.length, 0);
  assert.equal(f.requests.length, 0);
  f.preference.checked = true; f.preference.dispatchEvent(event('change'));
  f.control.dispose(); f.input.focus(); await f.query('Nueva ubicación');
  assert.equal(f.requests.length, 0);
  assert.equal(f.frame().children.length, 0);
  assert.equal(f.wrap.querySelector('.place-results'), null);
});
