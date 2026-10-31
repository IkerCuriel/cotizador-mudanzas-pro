import { prepareSupportRequest, SUPPORT_EMAIL } from './support-contact.js';
const form = document.getElementById('supportForm'), review = document.getElementById('supportReview'), status = document.getElementById('supportStatus'), link = document.getElementById('supportEmail');
function clearReview() { review.hidden = true; link.removeAttribute('href'); status.textContent = ''; }
form.addEventListener('input', clearReview);
form.addEventListener('submit', event => {
  event.preventDefault();
  const result = prepareSupportRequest(Object.fromEntries(new FormData(form)));
  for (const name of ['name','company','email','reference','problem']) {
    const message = result.errors[name] || '';
    form.elements[name].setAttribute('aria-invalid', String(Boolean(message)));
    document.querySelector(`[data-error="${name}"]`).textContent = message;
  }
  if (!result.valid) { clearReview(); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  document.getElementById('supportMessage').textContent = result.body;
  link.href = result.href; review.hidden = false; review.focus();
});
link.addEventListener('click', () => { status.textContent = `Revisa el mensaje y pulsa Enviar en tu aplicación de correo. Si no se abre, copia el texto y envíalo a ${SUPPORT_EMAIL}.`; });
document.getElementById('copySupport').addEventListener('click', async () => {
  const result = prepareSupportRequest(Object.fromEntries(new FormData(form))); if (!result.valid || review.hidden) return;
  try { await navigator.clipboard.writeText(`Para: ${SUPPORT_EMAIL}\nAsunto: ${result.subject}\n\n${result.body}`); status.textContent = `Mensaje copiado. Pégalo en un correo dirigido a ${SUPPORT_EMAIL}.`; }
  catch { status.textContent = 'Selecciona el texto del mensaje y cópialo desde tu dispositivo.'; }
});
function clearVisit() { form.reset(); clearReview(); }
window.addEventListener('pageshow', event => { if (event.persisted) clearVisit(); });
clearVisit();
