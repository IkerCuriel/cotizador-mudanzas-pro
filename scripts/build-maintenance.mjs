import { readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildMaintenance(root) {
  const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (project.name !== 'cotizador-mudanzas-pro') throw new Error('Ejecuta desde el proyecto MoveFlow.');
  const html = await readFile(resolve(root, 'maintenance.html'), 'utf8');
  const output = resolve(root, 'dist');
  // Solo se sustituye la salida reproducible de compilación, nunca el código ni datos.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const page of ['index', '404', 'cuenta', 'panel', 'privacidad', 'terminos', 'piloto']) {
    await writeFile(resolve(output, page + '.html'), html);
  }
  await writeFile(resolve(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await copyFile(resolve(root, 'public/favicon.svg'), resolve(output, 'favicon.svg'));
  await copyFile(resolve(root, 'public/_headers'), resolve(output, '_headers'));
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Preparado mantenimiento en ' + await buildMaintenance(process.cwd()));
  console.log('Esto aún no cambia Internet. Publica esta carpeta con tu proveedor de alojamiento.');
}
