import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Recurso propio y reproducible; no contiene datos personales ni fotografías ajenas.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f5ee"/>
  <g transform="translate(62 45)" fill="none" stroke="#bf5937" stroke-width="3"><path d="M0 12 20 0l20 12v25L20 49 0 37zM0 12l20 12 20-12M20 24v25M10 6l20 12v12"/></g>
  <text x="121" y="80" font-family="Arial,sans-serif" font-size="33" font-weight="700" fill="#173f36">MoveFlow</text>
  <text x="1134" y="77" text-anchor="end" font-family="Arial,sans-serif" font-size="16" letter-spacing="2.5" fill="#536b61">MUDANZAS, DE PERSONA A PERSONA</text>
  <path d="M64 119h1072" stroke="#d9dfd4"/>

  <rect x="64" y="161" width="286" height="37" rx="18.5" fill="#e7ecdf"/>
  <circle cx="84" cy="179.5" r="4" fill="#3b6555"/>
  <text x="98" y="185" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.3" fill="#365b4e">CON MUDANZAS D’CURIEL</text>
  <text x="59" y="285" font-family="Arial,sans-serif" font-size="68" font-weight="700" letter-spacing="-2.7" fill="#173f36">Cambia de casa.</text>
  <text x="59" y="364" font-family="Arial,sans-serif" font-size="68" font-weight="700" letter-spacing="-2.7" fill="#b65130">Empieza tranquilo.</text>
  <text x="64" y="422" font-family="Arial,sans-serif" font-size="24" fill="#536b61">Tu plan. Tu mudanza. Tu próximo comienzo.</text>
  <rect x="64" y="463" width="294" height="62" rx="15" fill="#173f36"/>
  <text x="90" y="503" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fffdf4">Planea tu mudanza</text>
  <path d="M319 494h15m-6-6 6 6-6 6" stroke="#fffdf4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="64" y="578" font-family="Arial,sans-serif" font-size="18" fill="#536b61">Local · Foránea · Atención personal por WhatsApp</text>

  <g transform="translate(785 161)">
    <rect width="350" height="394" rx="28" fill="#173f36"/>
    <text x="27" y="39" font-family="Arial,sans-serif" font-size="16" fill="#e5ecdd">Un nuevo comienzo</text>
    <circle cx="307" cy="32" r="15" fill="#31594c"/>
    <path d="m302 37 10-10m-10 0h10v10" stroke="#f4c9a0" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 64h350" stroke="#426456"/>
    <path d="M53 274V165l91-66 91 66v109" fill="#315e4f" stroke="#80a18b" stroke-width="2"/>
    <path d="m40 170 104-77 104 77" fill="none" stroke="#e4eddb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M116 274v-72h55v72" fill="#173f36"/>
    <path d="M75 177h27v31H75zM185 177h27v31h-27z" fill="#e9d8b8"/>
    <path d="M277 128c0-15 22-15 22 0 0 9-11 18-11 18s-11-9-11-18Z" fill="#e99469"/>
    <circle cx="288" cy="127" r="4" fill="#173f36"/>
    <path d="M280 163c-23 6-27 25-21 38" stroke="#9fbaa3" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round" fill="none"/>
    <rect x="201" y="239" width="80" height="71" rx="4" fill="#d48259"/>
    <path d="M234 239h13v26h-13z" fill="#f4d3ab"/>
    <rect x="149" y="274" width="45" height="36" rx="3" fill="#b7c19d"/>
    <path d="M166 274h11v13h-11z" fill="#e3e7ce"/>
    <path d="M28 311h294" stroke="#7b9c83" stroke-width="2"/>
    <path d="M0 335h350" stroke="#426456"/>
    <circle cx="37" cy="365" r="10" fill="#d48259"/>
    <path d="m33 365 3 3 5-6" fill="none" stroke="#173f36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="57" y="371" font-family="Arial,sans-serif" font-size="16" fill="#e5ecdd">El trato, contigo.</text>
  </g>
</svg>`;
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/social-preview.png', import.meta.url).pathname);
console.log('Vista previa social creada: 1200 × 630 px.');
