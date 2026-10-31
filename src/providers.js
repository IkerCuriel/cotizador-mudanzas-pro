import { prepareProviderInterest, validateProviderInterest } from './provider-interest.js';
import { setupBusinessLocationMap } from './maps.js';
import { supabase, isCloudConfigured, getSession, getPublicSettings } from './cloud.js';
import { LEGAL_READY } from './legal-config.js';

const form = document.getElementById('providerInterestForm');
const review = document.getElementById('interestReview');
const status = document.getElementById('interestStatus');
const send = document.getElementById('sendInterest');
const account = document.getElementById('interestAccount');
const locationMap = setupBusinessLocationMap(document);
let prepared = null, currentUser = null, busy = false, applicationsEnabled = false;

function hideReview() { prepared = null; review.hidden = true; status.textContent = ''; }
function clearVisit() { form.reset(); locationMap.reset(); hideReview(); form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid')); document.querySelectorAll('[data-interest-error]').forEach(el => { el.textContent = ''; }); }
function updateActions() {
  const ready = isCloudConfigured && LEGAL_READY && applicationsEnabled && currentUser;
  send.hidden = !ready; account.hidden = Boolean(ready);
  document.getElementById('interestNextStep').textContent = ready
    ? 'Revisa la ficha y confirma el envío desde tu cuenta. Solicitar el perfil no garantiza aprobación ni genera un cobro.'
    : 'Para enviar necesitas una cuenta con correo verificado y que el alta en línea esté disponible. Al salir de esta página el borrador se pierde; inicia sesión antes de completarlo.';
}
async function loadAccount() {
  const availability = document.getElementById('providerAvailability');
  if (!isCloudConfigured || !LEGAL_READY) {
    availability.textContent = 'El alta en línea está en preparación. Puedes explorar los planes y la ficha; todavía no se reciben altas ni pagos en esta página.';
    updateActions(); return;
  }
  try {
    const settings = await getPublicSettings();
    applicationsEnabled = settings.accepting_provider_applications === true && settings.provider_applications_version === 1;
    const session = await getSession();
    currentUser = session?.user?.email_confirmed_at ? session.user : null;
    availability.textContent = !applicationsEnabled ? 'El alta en línea está en preparación. Todavía no se reciben nuevas solicitudes.' : currentUser ? 'Tu correo está verificado. Puedes enviar la ficha para su revisión.' : 'Inicia sesión y confirma tu correo para enviar una solicitud.';
  } catch { availability.textContent = 'No pudimos comprobar tu sesión. Vuelve a entrar a tu cuenta.'; }
  updateActions();
}
form.addEventListener('input', hideReview);
form.addEventListener('change', hideReview);
form.addEventListener('submit', event => {
  event.preventDefault(); if (busy) return;
  const data = { ...Object.fromEntries(new FormData(form)), ...locationMap.collect(), consent: form.elements.consent.checked };
  const result = validateProviderInterest(data);
  for (const key of ['company', 'contact', 'email', 'phone', 'businessLocation', 'coverage', 'services', 'plan', 'notes', 'consent']) {
    const error = result.errors[key] || '';
    form.elements[key].setAttribute('aria-invalid', String(Boolean(error)));
    document.querySelector(`[data-interest-error="${key}"]`).textContent = error;
  }
  if (!result.valid) { hideReview(); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  prepared = prepareProviderInterest(data);
  document.getElementById('interestReviewTitle').textContent = 'Tu solicitud está preparada.';
  document.getElementById('interestMessage').textContent = prepared.body;
  updateActions(); review.hidden = false; review.focus();
});
send.addEventListener('click', async () => {
  if (!prepared || busy || !isCloudConfigured || !LEGAL_READY || !applicationsEnabled || !currentUser) return;
  busy = true; send.disabled = true; form.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = true; });
  status.textContent = 'Enviando tu solicitud…';
  try {
    const session = await getSession();
    if (session?.user?.id !== currentUser.id || !session.user.email_confirmed_at) throw new Error('session');
    const { data, error } = await supabase.rpc('submit_provider_application', { p_payload: { ...prepared.values, privacy_version: '2026-10-30' } });
    if (error || !data || data.status !== 'pending') throw new Error('unconfirmed');
    status.textContent = 'Solicitud recibida para revisión. Podrás contratar un plan cuando tu negocio sea aprobado y los pagos estén habilitados.';
    document.getElementById('interestReviewTitle').textContent = 'Solicitud recibida.';
    prepared = null; send.hidden = true;
  } catch { status.textContent = 'No pudimos confirmar la recepción. No se ha realizado ningún cobro. Revisa tu sesión y vuelve a intentarlo; si continúa, contacta a soporte.'; }
  finally { busy = false; send.disabled = false; form.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = false; }); locationMap.update(); }
});
document.getElementById('editInterest').addEventListener('click', () => { if (!busy) { hideReview(); form.elements.company.focus(); } });
window.addEventListener('pageshow', event => { if (event.persisted) { clearVisit(); loadAccount(); } });
clearVisit(); loadAccount();
