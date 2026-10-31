import { PROVIDER_INBOX, prepareProviderInterest, validateProviderInterest } from './provider-interest.js';

const form = document.getElementById('providerInterestForm');
const review = document.getElementById('interestReview');
const status = document.getElementById('interestStatus');
const emailLink = document.getElementById('interestEmail');
let prepared = null;

function hideReview() { prepared = null; review.hidden = true; emailLink.removeAttribute('href'); status.textContent = ''; }
function clearVisit() { form.reset(); hideReview(); form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid')); document.querySelectorAll('[data-interest-error]').forEach(el => { el.textContent = ''; }); }
form.addEventListener('input', hideReview);
form.addEventListener('change', hideReview);
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = { ...Object.fromEntries(new FormData(form)), consent: form.elements.consent.checked };
  const result = validateProviderInterest(data);
  for (const key of ['company', 'contact', 'email', 'phone', 'coverage', 'services', 'notes', 'consent']) {
    const error = result.errors[key] || '';
    form.elements[key].setAttribute('aria-invalid', String(Boolean(error)));
    document.querySelector(`[data-interest-error="${key}"]`).textContent = error;
  }
  if (!result.valid) { hideReview(); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  prepared = prepareProviderInterest(data);
  document.getElementById('interestMessage').textContent = prepared.body;
  emailLink.href = prepared.href;
  review.hidden = false;
  review.focus();
});
emailLink.addEventListener('click', () => { status.textContent = 'Confirma el envío en tu aplicación de correo. Si no se abre, copia la solicitud y envíala a ' + PROVIDER_INBOX + '.'; });
document.getElementById('copyInterest').addEventListener('click', async () => {
  if (!prepared) return;
  try {
    await navigator.clipboard.writeText(`Para: ${PROVIDER_INBOX}\nAsunto: ${prepared.subject}\n\n${prepared.body}`);
    status.textContent = 'Solicitud copiada. Pégala en un correo y envíala a ' + PROVIDER_INBOX + '.';
  } catch { status.textContent = 'Puedes seleccionar el texto de la solicitud y copiarlo manualmente para enviarlo a ' + PROVIDER_INBOX + '.'; }
});
document.getElementById('editInterest').addEventListener('click', () => { hideReview(); form.elements.company.focus(); });
window.addEventListener('pageshow', event => { if (event.persisted) clearVisit(); });
clearVisit();
