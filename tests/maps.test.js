import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLinks } from '../src/maps.js';

test('map links preserve the complete location and use only fixed Google HTTPS hosts', () => {
  const query = 'Álvaro Obregón, CDMX & calle #2';
  const result = mapLinks(`  ${query}  `);
  assert.equal(result.error, '');
  const search = new URL(result.searchUrl);
  const embed = new URL(result.embedUrl);
  for (const url of [search, embed]) { assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'www.google.com'); }
  assert.equal(search.pathname, '/maps/search/');
  assert.equal(search.searchParams.get('api'), '1');
  assert.equal(search.searchParams.get('query'), query);
  assert.equal(embed.searchParams.get('q'), query);
  assert.equal(embed.searchParams.get('output'), 'embed');
  assert.equal(embed.searchParams.get('hl'), 'es');
});

test('entered URLs and query syntax are location text, never external destinations or additional parameters', () => {
  for (const query of ['https://evil.example/?x=1&output=evil', 'javascript:alert(1)', 'Centro&key=secret#map']) {
    const result = mapLinks(query);
    const embed = new URL(result.embedUrl);
    assert.equal(embed.origin, 'https://www.google.com');
    assert.equal(embed.searchParams.size, 3);
    assert.equal(embed.searchParams.get('q'), query);
    assert.equal(embed.searchParams.get('key'), null);
    assert.equal(embed.hash, '');
  }
});

test('empty or incomplete locations have no outbound link', () => {
  for (const input of [undefined, null, {}, 42, '', ' ', 'ab', '\n\t']) {
    const result = mapLinks(input);
    assert.ok(result.error);
    assert.equal(result.embedUrl, undefined);
    assert.equal(result.searchUrl, undefined);
  }
});

test('encoded URL limit considers multibyte characters and never silently truncates a location', () => {
  const result = mapLinks('漢'.repeat(500));
  assert.match(result.error, /muy larga/);
  assert.equal(result.query, '漢'.repeat(500));
  assert.equal(result.embedUrl, undefined);
  assert.equal(result.searchUrl, undefined);
  const ordinary = mapLinks('a'.repeat(500));
  assert.equal(ordinary.error, '');
  assert.ok(ordinary.searchUrl.length <= 2048);
  assert.ok(ordinary.embedUrl.length <= 2048);
});

test('control characters become harmless search separators', () => {
  const result = mapLinks('CDMX\nCentro\u0000 México');
  assert.equal(result.query, 'CDMX Centro  México');
  assert.equal(new URL(result.searchUrl).searchParams.get('query'), result.query);
});
