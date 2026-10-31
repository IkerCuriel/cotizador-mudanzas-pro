import { normalizeLocationSelection } from './locations.js';
import { mapLinks } from './maps.js';

// Display catalog only: a future payment server must verify its own allowed plan,
// amount, currency and period. Nothing in this form grants billing or access rights.
export const PROVIDER_PLANS = Object.freeze({
  monthly_149: Object.freeze({ code: 'monthly_149', currency: 'MXN', amount: 149, months: 1, monthlyPrice: 149, checkoutEnabled: false }),
  annual_1440: Object.freeze({ code: 'annual_1440', currency: 'MXN', amount: 1440, months: 12, monthlyPrice: 120, checkoutEnabled: false }),
});
export const PROVIDER_PLAN = PROVIDER_PLANS.monthly_149;
const serviceNames = { local: 'Locales', nationwide: 'Foráneas', both: 'Locales y foráneas' };
const limits = { company: 120, contact: 100, email: 254, phone: 40, businessLocation: 500, coverage: 180, notes: 400 };
const optional = new Set(['coverage', 'notes']);

export function validateProviderInterest(source = {}) {
  const values = {};
  const errors = {};
  for (const [key, max] of Object.entries(limits)) {
    values[key] = typeof source[key] === 'string' ? source[key].replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (values[key].length > max) errors[key] = `Usa como máximo ${max} caracteres.`;
    if (!optional.has(key) && !values[key]) errors[key] = 'Completa este campo.';
  }
  for (const key of ['company', 'contact', 'coverage']) if (values[key] && values[key].length < 2) errors[key] = 'Escribe al menos dos caracteres.';
  if (values.businessLocation && values.businessLocation.length < 3) errors.businessLocation = 'Escribe al menos tres caracteres de tu ubicación.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Escribe un correo válido.';
  if (values.phone && (!/^\+?[\d\s().-]+$/.test(values.phone) || !/^\d{10,15}$/.test(values.phone.replace(/\D/g, '')))) errors.phone = 'Escribe un teléfono de 10 a 15 dígitos.';
  values.services = Object.hasOwn(serviceNames, source.services) ? source.services : '';
  if (!values.services) errors.services = 'Selecciona los servicios que ofreces.';
  values.plan = Object.hasOwn(PROVIDER_PLANS, source.plan) ? source.plan : '';
  if (!values.plan) errors.plan = 'Selecciona el plan que te interesa.';
  const place = normalizeLocationSelection(source.businessLocationPlace, values.businessLocation);
  if (place) values.businessLocationPlace = place;
  values.consent = source.consent === true;
  if (!values.consent) errors.consent = 'Autoriza el contacto para gestionar tu solicitud.';
  return { values, errors, valid: !Object.keys(errors).length };
}

export function prepareProviderInterest(source) {
  const result = validateProviderInterest(source);
  if (!result.valid) throw new Error('Revisa los campos de tu solicitud.');
  const v = result.values;
  const location = mapLinks(v.businessLocation, { placeId: v.businessLocationPlace?.placeId });
  const plan = PROVIDER_PLANS[v.plan];
  const planDescription = plan.months === 12
    ? `Anual: $${plan.amount.toLocaleString('es-MX')} ${plan.currency} en un solo pago por 12 meses (equivalente a $${plan.monthlyPrice} al mes). Ahorro de $348 frente a 12 mensualidades de $149.`
    : `Mensual: $${plan.amount} ${plan.currency} al mes.`;
  const body = [
    'SOLICITUD DE PERFIL DE NEGOCIO', '',
    `Empresa: ${v.company}`, `Persona de contacto: ${v.contact}`, `Correo: ${v.email}`,
    `WhatsApp: ${v.phone}`, `Ubicación del negocio: ${v.businessLocation}`,
    ...(location.searchUrl ? [`Google Maps${v.businessLocationPlace ? ' (lugar seleccionado)' : ' (referencia por revisar)'}: ${location.searchUrl}`] : []),
    ...(v.coverage ? [`Zonas de cobertura: ${v.coverage}`] : []), `Servicios: ${serviceNames[v.services]}`,
    ...(v.notes ? [`Comentarios: ${v.notes}`] : []), '',
    `Plan de interés: ${planDescription}`,
    'Solicito información sobre disponibilidad, condiciones y activación.',
    'Esta solicitud no autoriza un cargo ni crea automáticamente una cuenta.',
    'Autorizo que me contacten para gestionar esta solicitud de alta.',
  ].join('\n');
  return { body, values: v };
}
