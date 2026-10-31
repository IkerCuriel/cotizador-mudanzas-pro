import { supabase, isCloudConfigured, getSession, getAccountSecurity, getProfile } from './cloud.js';
import { LEGAL_READY } from './legal-config.js';
import { PAYMENT_PLANS, createPaymentArguments, paymentCreationTarget, readPaymentReturn, paymentResultMessage, readBillingAccess } from './payment-client.js';

const byId = id => document.getElementById(id);
const form = byId('paymentForm'), status = byId('paymentStatus'), paymentReturn = readPaymentReturn(location.search);
let session, businesses = [], available = false, mode = null, busy = false;
const requestIds = new Map();
const preferredPlan = new URLSearchParams(location.search).get('plan');
if (Object.hasOwn(PAYMENT_PLANS, preferredPlan)) form.elements.plan.value = preferredPlan;
function notify(message) { status.textContent = message; }
function setBusy(value) { busy = value; form.setAttribute('aria-busy', String(value)); form.querySelectorAll('button,input,select').forEach(el => { el.disabled = value; }); byId('retryPayment').disabled = value; }
function describePlan() { byId('paymentTotal').textContent = PAYMENT_PLANS[form.elements.plan.value]?.label || ''; }
function renderBusiness() {
  const business = businesses.find(value => value.business_id === form.elements.business.value);
  const courtesy = business?.complimentary === true;
  byId('paymentCourtesy').hidden = !courtesy;
  byId('purchaseFields').hidden = courtesy;
  byId('payButton').disabled = courtesy || !available || busy;
}
async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('paypal-checkout', { body });
  if (error || !data || typeof data !== 'object') throw new Error('No se pudo comprobar la operación con el servidor.');
  return data;
}
async function confirmReturn() {
  if (!paymentReturn.purchaseId || busy) return;
  setBusy(true); notify('Comprobando el pago con PayPal…');
  byId('retryPayment').hidden = true;
  byId('newPayment').hidden = true;
  try {
    const result = await invoke({ action: 'capture', purchaseId: paymentReturn.purchaseId });
    const message = paymentResultMessage(result); notify(message.text);
    byId('paymentReceipt').hidden = false;
    byId('paymentReference').textContent = paymentReturn.purchaseId;
    byId('retryPayment').hidden = message.terminal;
    byId('newPayment').hidden = !message.canStartNew;
    if (message.canStartNew) form.hidden = true;
    if (message.paid) { form.hidden = true; byId('paymentPanel').hidden = false; }
  } catch { notify('No pudimos confirmar este pago. No hagas otra compra todavía. Puedes reintentar la comprobación o contactar a soporte con la referencia.'); byId('retryPayment').hidden = false; }
  finally { setBusy(false); renderBusiness(); }
}
async function initialize() {
  form.hidden = true;
  if (!isCloudConfigured || (!LEGAL_READY && !paymentReturn.purchaseId)) { notify('Las contrataciones están en preparación. Todavía no se pueden realizar pagos. Puedes conocer los planes o contactar a soporte.'); return; }
  try {
    const access = await readBillingAccess({ getSession, getAccountSecurity, getProfile, client: supabase });
    session = access.session; businesses = access.businesses;
    if (access.state === 'sign_in') { notify('Inicia sesión y confirma tu correo para consultar tu negocio y sus pagos.'); byId('paymentAccount').hidden = false; return; }
    if (access.state === 'mfa') {
      notify('Completa la verificación en dos pasos en Mi cuenta antes de consultar o pagar tu plan.');
      const securityUrl = new URL(byId('paymentAccount').href); securityUrl.searchParams.set('mode', 'security');
      byId('paymentAccount').href = securityUrl.href; byId('paymentAccount').textContent = 'Completar verificación en dos pasos'; byId('paymentAccount').hidden = false; return;
    }
    if (access.state === 'approval') { notify('No tienes un negocio aprobado disponible para contratar. Completa tu solicitud de perfil y espera su revisión; no se te cobrará antes.'); byId('paymentApplication').hidden = false; return; }
    const configuration = await invoke({ action: 'status' });
    available = configuration.enabled === true && ['sandbox', 'live'].includes(configuration.mode); mode = configuration.mode;
    byId('paymentSandbox').hidden = mode !== 'sandbox';
    if (paymentReturn.purchaseId) {
      byId('paymentReceipt').hidden = false; byId('paymentReference').textContent = paymentReturn.purchaseId;
      if (paymentReturn.cancelled) { notify('Regresaste sin completar la aprobación en PayPal. Si crees que sí se procesó un pago, comprueba su estado antes de volver a comprar.'); byId('retryPayment').hidden = false; }
      else { await confirmReturn(); return; }
    }
    if (!available) { notify('Las nuevas contrataciones todavía no están habilitadas. No se realizará ningún cargo.'); return; }
    form.elements.business.replaceChildren(...businesses.map(business => { const option = document.createElement('option'); option.value = business.business_id; option.textContent = business.name; return option; }));
    form.hidden = false; describePlan(); renderBusiness();
    if (!paymentReturn.cancelled) notify('Elige tu periodo y revisa el total. PayPal procesará el pago y MoveFlow comprobará el resultado antes de activar la vigencia.');
  } catch { notify('No pudimos consultar tus pagos. Vuelve a intentarlo o contacta a soporte.'); }
}
form.elements.plan.addEventListener('change', describePlan);
form.elements.business.addEventListener('change', renderBusiness);
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !available) return;
  const businessId = form.elements.business.value, planCode = form.elements.plan.value;
  const business = businesses.find(value => value.business_id === businessId);
  if (!business || business.complimentary || !form.elements.consent.checked) { notify('Selecciona un negocio disponible y acepta las condiciones del pago.'); return; }
  setBusy(true); notify('Preparando tu pago en PayPal…');
  try {
    const active = await getSession();
    if (!active || active.user.id !== session.user.id) throw new Error('session');
    const key = `${businessId}:${planCode}`;
    if (!requestIds.has(key)) requestIds.set(key, crypto.randomUUID());
    const result = await invoke(createPaymentArguments({ businessId, planCode, requestId: requestIds.get(key), consent: form.elements.consent.checked }));
    const target = paymentCreationTarget(result, mode, location.href);
    location.assign(target);
  } catch { notify('No pudimos abrir el pago. No se ha confirmado ningún cargo. Revisa tu conexión o contacta a soporte antes de repetir una compra que ya hayas aprobado.'); setBusy(false); renderBusiness(); }
});
byId('retryPayment').addEventListener('click', confirmReturn);
const accountUrl = new URL('cuenta.html', location.href);
accountUrl.searchParams.set('next', `${new URL('pago.html', location.href).pathname}${location.search}`); byId('paymentAccount').href = accountUrl.href;
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
initialize();
