import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMaintenance } from '../scripts/build-maintenance.mjs';

test('maintenance removes old form assets and covers account URLs without changing source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moveflow-maintenance-'));
  try {
    await mkdir(join(root, 'public')); await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'package.json'), '{"name":"cotizador-mudanzas-pro"}');
    const html = '<html><body>En mantenimiento</body></html>';
    await writeFile(join(root, 'maintenance.html'), html);
    await writeFile(join(root, 'public/favicon.svg'), '<svg/>');
    await writeFile(join(root, 'public/_headers'), '/*\n  X-Content-Type-Options: nosniff');
    await writeFile(join(root, 'dist/old-form.js'), 'secretFormCode');
    await buildMaintenance(root);
    assert.equal(await readFile(join(root, 'dist/panel.html'), 'utf8'), html);
    assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), html);
    assert.equal(await readFile(join(root, 'maintenance.html'), 'utf8'), html);
    assert.ok(!(await readdir(join(root, 'dist'))).includes('old-form.js'));
    assert.match(await readFile(join(root, 'dist/robots.txt'), 'utf8'), /Disallow: \//);
  } finally { await rm(root, { recursive: true, force: true }); }
});
