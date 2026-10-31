import test from 'node:test';
import assert from 'node:assert/strict';
import { getBusinessProfile, normalizeBusinessPhotos } from '../src/business-profile-data.js';

test('the default public profile starts without invented company photographs', () => {
  const profile = getBusinessProfile();
  assert.equal(profile.slug, 'd-curiel');
  assert.deepEqual(profile.photos, []);
  assert.equal(getBusinessProfile('__proto__'), null);
  assert.equal(getBusinessProfile('other-business'), null);
});

test('public gallery admits reviewed local images only for the selected business', () => {
  const valid = { src: '/businesses/d-curiel/unidad-01.webp', alt: 'Unidad de mudanza', caption: 'Vista de la unidad' };
  const forbidden = [
    'https://evil.example/photo.webp', '//evil.example/photo.webp', 'javascript:alert(1)', 'data:image/png;base64,AAAA',
    '/businesses/other/photo.webp', '/businesses/d-curiel/../private.webp', '/businesses/d-curiel/%2e%2e%2fphoto.webp',
    '/businesses/d-curiel/image.webp?token=secret', '/businesses/d-curiel/image.webp#secret', '/businesses/d-curiel/image.svg',
    '/businesses/d-curiel/a/b.webp', '/businesses/d-curiel/a\\b.webp', '/businesses/d-curiel/image.html',
  ];
  for (const src of forbidden) assert.deepEqual(normalizeBusinessPhotos([valid, { src, alt: 'Foto' }], 'd-curiel'), [valid]);
  assert.deepEqual(normalizeBusinessPhotos([valid], '../d-curiel'), []);
  assert.deepEqual(normalizeBusinessPhotos([valid], 'other'), []);
});

test('gallery enforces alt text, avoids duplicates, and bounds photo metadata', () => {
  const image = { src: '/businesses/d-curiel/photo.jpg', alt: '  Unidad\nprincipal  ', caption: '  Exterior  ' };
  assert.deepEqual(normalizeBusinessPhotos([image, image, { src: '/businesses/d-curiel/missing-alt.png', alt: '' }], 'd-curiel'), [
    { src: '/businesses/d-curiel/photo.jpg', alt: 'Unidad principal', caption: 'Exterior' },
  ]);
  const many = Array.from({ length: 20 }, (_, index) => ({ src: `/businesses/d-curiel/photo-${index}.avif`, alt: 'x'.repeat(250), caption: 'y'.repeat(250) }));
  const photos = normalizeBusinessPhotos(many, 'd-curiel');
  assert.equal(photos.length, 12);
  assert.ok(photos.every(({ alt, caption }) => alt.length === 180 && caption.length === 180));
  assert.deepEqual(normalizeBusinessPhotos(null, 'd-curiel'), []);
});
