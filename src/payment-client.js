export const PAYMENT_CONSENT_VERSION = 'prepaid-v1';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAYMENT_PLANS = Object.freeze({
  monthly_149: Object.freeze({ code: 'monthly_149', amount: 149, months: 1, label: '$149 MXN por 1 mes' }),
  annual_1440: Object.freeze({ code: 'annual_1440', amount: 1440, months: 12, label: '$1,440 MXN por 12 meses' }),
});
export function validPurchaseId(value) { return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null; }
export function readPaymentReturn(search = '') {
  const params = new URLSearchParams(search);
  return { purchaseId: params.getAll('purchase').length === 1 ? validPurchaseId(params.get('purchase')) : null, cancelled: params.get('cancelled') === '1' };
}
export function paypalApprovalUrl(value, mode) {
  if (typeof value !== 'string') throw new Error('No se recibió un enlace válido de PayPal.');
  let url; try { url = new URL(value); } catch { throw new Error('No se recibió un enlace válido de PayPal.'); }
  const hostname = mode === 'live' ? 'www.paypal.com' : mode === 'sandbox' ? 'www.sandbox.paypal.com' : '';
  if (!hostname || url.protocol !== 'https:' || url.hostname !== hostname || url.username || url.password || url.port || url.hash || !url.searchParams.get('token')) throw new Error('No se recibió un enlace válido de PayPal.');
  return url.href;
}
export function createPaymentArguments({ businessId, planCode, requestId, consent }) {
  if (!validPurchaseId(businessId) || !validPurchaseId(requestId) || !Object.hasOwn(PAYMENT_PLANS, planCode) || consent !== true) throw new Error('Revisa tu empresa, plan y aceptación antes de pagar.');
  return { action: 'create', businessId, planCode, requestId, consentVersion: PAYMENT_CONSENT_VERSION };
}
export function paymentResultMessage(result = {}) {
  if (result.status === 'paid' && typeof result.paidUntil === 'string' && Number.isFinite(Date.parse(result.paidUntil))) return { paid: true, terminal: true, canStartNew: false, text: `Pago verificado. Tu periodo está registrado hasta el ${new Date(result.paidUntil).toLocaleDateString('es-MX', { dateStyle: 'long', timeZone: 'America/Mexico_City' })}.` };
  if (result.status === 'voided') return { paid: false, terminal: true, canStartNew: true, text: 'La orden anterior quedó cerrada sin pago. Puedes volver a elegir tu plan.' };
  if (result.status === 'revoked') return { paid: false, terminal: true, canStartNew: false, text: 'Este pago no concede acceso. Consulta el estado de la operación con soporte.' };
  return { paid: false, terminal: false, canStartNew: false, text: 'El pago todavía no está confirmado. No vuelvas a comprar: comprueba de nuevo esta operación o contacta a soporte con su referencia.' };
}

/** A prior attempt may already be captured. Reconcile it on our server instead of starting another payment. */
export function paymentCreationTarget(result, mode, baseHref) {
  const purchaseId = validPurchaseId(result?.purchaseId);
  if (!purchaseId) throw new Error('No se recibió una referencia válida de pago.');
  if (result.approvalUrl) return paypalApprovalUrl(result.approvalUrl, mode);
  if (!['paid', 'pending', 'voided'].includes(result.status)) throw new Error('No se pudo continuar con este pago.');
  const target = new URL('pago.html', baseHref);
  target.searchParams.set('purchase', purchaseId);
  return target.href;
}

/** Check identity and MFA before requesting business data; AAL1 is not evidence of no approved business. */
export async function readBillingAccess({ getSession, getAccountSecurity, getProfile, client }) {
  const session = await getSession();
  if (!session?.user?.email_confirmed_at) return { state: 'sign_in', session, businesses: [] };
  // Applicants have no provider role yet and cannot enroll provider MFA.
  const profile = getProfile ? await getProfile(session) : null;
  if (profile?.role === 'applicant') return { state: 'approval', session, businesses: [] };
  const security = await getAccountSecurity();
  if (security?.currentLevel !== 'aal2') return { state: 'mfa', session, businesses: [] };
  const { data, error } = await client.rpc('get_my_billing_businesses');
  if (error || !Array.isArray(data)) throw new Error('No se pudo consultar el acceso a pagos.');
  const businesses = data.filter(value => validPurchaseId(value.business_id) && typeof value.name === 'string');
  return { state: businesses.length ? 'ready' : 'approval', session, businesses };
}
