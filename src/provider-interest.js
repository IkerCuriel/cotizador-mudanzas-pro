export const PROVIDER_PLAN = Object.freeze({ code: 'monthly_149', currency: 'MXN', monthlyPrice: 149, checkoutEnabled: false });
export const PROVIDER_INBOX = 'iker.san.cu@gmail.com';
const serviceNames = { local: 'Locales', nationwide: 'Foráneas', both: 'Locales y foráneas' };
const limits = { company: 120, contact: 100, email: 254, phone: 40, coverage: 180, notes: 400 };

export function validateProviderInterest(source = {}) {
  const values = {};
  const errors = {};
  for (const [key, max] of Object.entries(limits)) {
    values[key] = typeof source[key] === 'string' ? source[key].replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (values[key].length > max) errors[key] = `Usa como máximo ${max} caracteres.`;
    if (key !== 'notes' && !values[key]) errors[key] = 'Completa este campo.';
  }
  for (const key of ['company', 'contact', 'coverage']) if (values[key] && values[key].length < 2) errors[key] = 'Escribe al menos dos caracteres.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Escribe un correo válido.';
  if (values.phone && (!/^\+?[\d\s().-]+$/.test(values.phone) || !/^\d{10,15}$/.test(values.phone.replace(/\D/g, '')))) errors.phone = 'Escribe un teléfono de 10 a 15 dígitos.';
  values.services = Object.hasOwn(serviceNames, source.services) ? source.services : '';
  if (!values.services) errors.services = 'Selecciona los servicios que ofreces.';
  values.consent = source.consent === true;
  if (!values.consent) errors.consent = 'Autoriza el contacto para gestionar tu solicitud.';
  return { values, errors, valid: !Object.keys(errors).length };
}

export function prepareProviderInterest(source) {
  const result = validateProviderInterest(source);
  if (!result.valid) throw new Error('Revisa los campos de tu solicitud.');
  const v = result.values;
  const subject = 'MoveFlow · Solicitud de perfil para negocio de mudanzas';
  const body = [
    'Hola, me interesa solicitar un perfil de negocio en MoveFlow.', '',
    `Empresa: ${v.company}`, `Persona de contacto: ${v.contact}`, `Correo: ${v.email}`,
    `WhatsApp: ${v.phone}`, `Cobertura: ${v.coverage}`, `Servicios: ${serviceNames[v.services]}`,
    ...(v.notes ? [`Comentarios: ${v.notes}`] : []), '',
    `Plan de interés: $${PROVIDER_PLAN.monthlyPrice} ${PROVIDER_PLAN.currency} al mes.`,
    'Solicito información sobre disponibilidad, condiciones y activación.',
    'Esta solicitud no autoriza un cargo ni crea automáticamente una cuenta.',
    'Autorizo que me contacten para gestionar esta solicitud de alta.',
  ].join('\n');
  return { subject, body, href: `mailto:${PROVIDER_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
