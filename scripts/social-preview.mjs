import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Recurso propio y reproducible; no contiene datos personales.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#142536"/>
  <circle cx="1186" cy="19" r="354" fill="none" stroke="#455d70"/>
  <circle cx="1186" cy="19" r="302" fill="none" stroke="#30495e"/>
  <g transform="translate(62 50)" fill="none" stroke="#fb9a66" stroke-width="3"><path d="M0 12 20 0l20 12v25L20 49 0 37zM0 12l20 12 20-12M20 24v25M10 6l20 12v12"/></g>
  <text x="121" y="86" font-family="Arial,sans-serif" font-size="33" font-weight="700" fill="#fff8ed">MoveFlow</text>
  <text x="1127" y="80" text-anchor="end" font-family="Arial,sans-serif" font-size="17" letter-spacing="3" fill="#cfdae1">MUDANZAS</text>
  <text x="64" y="185" font-family="Arial,sans-serif" font-size="16" letter-spacing="2" fill="#d5dfe4">CON MUDANZAS D’CURIEL</text>
  <text x="59" y="275" font-family="Arial,sans-serif" font-size="66" font-weight="700" letter-spacing="-2" fill="#fff8ed">Cambia de casa.</text>
  <text x="59" y="353" font-family="Arial,sans-serif" font-size="66" font-weight="700" letter-spacing="-2" fill="#fb9a66">Empieza tranquilo.</text>
  <text x="64" y="411" font-family="Arial,sans-serif" font-size="23" fill="#cfdae1">Tu plan. Tu mudanza. Tu próximo comienzo.</text>
  <rect x="64" y="460" width="292" height="61" rx="13" fill="#fb9a66"/>
  <text x="91" y="499" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#142536">Planea tu mudanza</text>
  <path d="M318 489h15m-6-6 6 6-6 6" stroke="#142536" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="64" y="573" font-family="Arial,sans-serif" font-size="17" fill="#bdccd6">Local · Foránea · Atención personal por WhatsApp</text>
  <g transform="translate(790 194)">
    <rect x="0" y="0" width="332" height="334" rx="25" fill="#20394d" stroke="#476073"/>
    <text x="25" y="39" font-family="Arial,sans-serif" font-size="15" fill="#d3dee5">Un nuevo comienzo</text>
    <rect x="263" y="20" width="45" height="27" rx="7" fill="#344a59"/>
    <path d="M274 34h22m-7-6 7 6-7 6" stroke="#fb9a66" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M56 224V138l86-61 86 61v86" fill="#35566c" stroke="#95aab6" stroke-width="2"/>
    <path d="m44 143 98-73 99 73" fill="none" stroke="#dfebed" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M116 224v-60h49v60" fill="#142536"/>
    <path d="M77 147h24v28H77zM181 147h24v28h-24z" fill="#e6cfaa"/>
    <rect x="192" y="193" width="70" height="64" rx="3" fill="#fb9a66"/>
    <path d="M221 193h12v23h-12z" fill="#ffd4b3"/>
    <rect x="146" y="224" width="40" height="33" rx="2" fill="#d4a371"/>
    <path d="M161 224h10v12h-10z" fill="#f7d1a7"/>
    <path d="M28 258h278" stroke="#7a97a9" stroke-width="2"/>
    <circle cx="38" cy="297" r="10" fill="#fb9a66"/>
    <path d="m34 297 3 3 5-6" fill="none" stroke="#142536" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="58" y="302" font-family="Arial,sans-serif" font-size="14" fill="#d3dee5">El trato, contigo.</text>
  </g>
</svg>`;
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/social-preview.png', import.meta.url).pathname);
console.log('Vista previa social creada: 1200 × 630 px.');
