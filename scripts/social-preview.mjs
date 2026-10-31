import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Recurso propio y reproducible; no contiene datos personales ni fotografías ajenas.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#eef1f6"/>
  <g transform="translate(62 45)" fill="none" stroke="#3769bf" stroke-width="3"><path d="M0 12 20 0l20 12v25L20 49 0 37zM0 12l20 12 20-12M20 24v25M10 6l20 12v12"/></g>
  <text x="121" y="80" font-family="Arial,sans-serif" font-size="33" font-weight="700" fill="#17263f">MoveFlow</text>
  <text x="1134" y="77" text-anchor="end" font-family="Arial,sans-serif" font-size="16" letter-spacing="2.5" fill="#4e5a70">MUDANZAS, DE PERSONA A PERSONA</text>
  <path d="M64 119h1072" stroke="#d3d8e0"/>

  <rect x="64" y="161" width="286" height="37" rx="18.5" fill="#dfe4ec"/>
  <circle cx="84" cy="179.5" r="4" fill="#3b4a65"/>
  <text x="98" y="185" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.3" fill="#36445b">CON MUDANZAS D’CURIEL</text>
  <text x="59" y="285" font-family="Arial,sans-serif" font-size="68" font-weight="700" letter-spacing="-2.7" fill="#17263f">Cambia de casa.</text>
  <text x="59" y="364" font-family="Arial,sans-serif" font-size="68" font-weight="700" letter-spacing="-2.7" fill="#3061b6">Empieza tranquilo.</text>
  <text x="64" y="422" font-family="Arial,sans-serif" font-size="24" fill="#4e5a70">Tu plan. Tu mudanza. Tu próximo comienzo.</text>
  <rect x="64" y="463" width="294" height="62" rx="15" fill="#17263f"/>
  <text x="90" y="503" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#f5f8fe">Planea tu mudanza</text>
  <path d="M319 494h15m-6-6 6 6-6 6" stroke="#f5f8fe" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="64" y="578" font-family="Arial,sans-serif" font-size="18" fill="#4e5a70">Local · Foránea · Atención personal por WhatsApp</text>

  <g transform="translate(785 161)">
    <rect width="350" height="394" rx="28" fill="#17263f"/>
    <text x="27" y="39" font-family="Arial,sans-serif" font-size="16" fill="#dde3ec">Un nuevo comienzo</text>
    <circle cx="307" cy="32" r="15" fill="#314059"/>
    <path d="m302 37 10-10m-10 0h10v10" stroke="#a1bff3" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 64h350" stroke="#424e64"/>
    <path d="M53 274V165l91-66 91 66v109" fill="#31425e" stroke="#7d8ba4" stroke-width="2"/>
    <path d="m40 170 104-77 104 77" fill="none" stroke="#dbe2ed" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M116 274v-72h55v72" fill="#17263f"/>
    <path d="M75 177h27v31H75zM185 177h27v31h-27z" fill="#b8cae9"/>
    <path d="M277 128c0-15 22-15 22 0 0 9-11 18-11 18s-11-9-11-18Z" fill="#6998e9"/>
    <circle cx="288" cy="127" r="4" fill="#17263f"/>
    <path d="M280 163c-23 6-27 25-21 38" stroke="#9ea9bb" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round" fill="none"/>
    <rect x="201" y="239" width="80" height="71" rx="4" fill="#5986d4"/>
    <path d="M234 239h13v26h-13z" fill="#abc6f4"/>
    <rect x="149" y="274" width="45" height="36" rx="3" fill="#9daac1"/>
    <path d="M166 274h11v13h-11z" fill="#ced7e7"/>
    <path d="M28 311h294" stroke="#7786a0" stroke-width="2"/>
    <path d="M0 335h350" stroke="#424e64"/>
    <circle cx="37" cy="365" r="10" fill="#5986d4"/>
    <path d="m33 365 3 3 5-6" fill="none" stroke="#17263f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="57" y="371" font-family="Arial,sans-serif" font-size="16" fill="#dde3ec">El trato, contigo.</text>
  </g>
</svg>`;
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/social-preview.png', import.meta.url).pathname);
// App icons use the same first-party vector mark as the browser favicon.
for (const size of [192, 512]) {
  await sharp(new URL('../public/favicon.svg', import.meta.url).pathname)
    .resize(size, size).png().toFile(new URL(`../public/push-icon-${size}.png`, import.meta.url).pathname);
}
console.log('Vista previa social creada: 1200 × 630 px; iconos de la app actualizados.');
