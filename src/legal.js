import { LEGAL } from './legal-config.js';
for (const [id, value] of Object.entries({ legalName: LEGAL.name, legalAddress: LEGAL.address, legalEmail: LEGAL.email, privacyVersion: LEGAL.version })) {
  if (value && document.getElementById(id)) document.getElementById(id).textContent = value;
}
if (LEGAL.ready) document.getElementById('legalStatus').hidden = true;
