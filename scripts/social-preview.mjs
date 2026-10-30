import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#142536"/><rect x="32" y="32" width="1136" height="566" rx="28" fill="none" stroke="#355064"/>
<g transform="translate(74 68)" fill="none" stroke="#fd8b54" stroke-width="3"><path d="M0 12 20 0l20 12v25L20 49 0 37zM0 12l20 12 20-12M20 24v25M10 6l20 12v12"/></g>
<text x="134" y="103" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff8ed">MoveFlow</text>
<text x="74" y="214" font-family="Arial,sans-serif" font-size="16" letter-spacing="3" fill="#c1d0d9">MUDANZAS, DE PERSONA A PERSONA</text>
<text x="70" y="302" font-family="Georgia,serif" font-size="68" fill="#fff8ed">Tu próxima mudanza.</text>
<text x="70" y="382" font-family="Georgia,serif" font-size="68" font-style="italic" fill="#fd8b54">El trato, contigo.</text>
<text x="74" y="447" font-family="Arial,sans-serif" font-size="23" fill="#c1d0d9">Tú nos cuentas el plan. Lo acordamos contigo.</text>
<rect x="74" y="496" width="282" height="54" rx="27" fill="#fd8b54"/><text x="101" y="531" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#142536">Prepara tu solicitud →</text>
<g transform="translate(838 188)"><path d="M0 149V66L91 0l91 66v153H0Z" fill="#2c485d" stroke="#7b94a5" stroke-width="3"/><path d="M-14 72 91-4l105 76" fill="none" stroke="#d9e4e8" stroke-width="5" stroke-linecap="round"/><path d="M68 219v-72h48v72M29 82h33v33H29zM120 82h33v33h-33z" fill="#e2c9a6"/><rect x="134" y="168" width="88" height="80" rx="3" fill="#fd8b54"/><path d="M172 168h13v28h-13z" fill="#ffd5a9"/><rect x="79" y="207" width="48" height="41" rx="2" fill="#d4a472"/><path d="M99 207h9v15h-9z" fill="#f9ce9d"/><path d="M-20 249h262" stroke="#7b94a5" stroke-width="2"/></g>
</svg>`;
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/social-preview.png', import.meta.url).pathname);
console.log('Vista previa social creada: 1200 × 630 px.');
