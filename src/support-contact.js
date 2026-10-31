export const SUPPORT_EMAIL = 'soporte.moveflow@gmail.com';

export function prepareSupportRequest(source = {}) {
  const limits = { name: 100, company: 120, email: 254, reference: 100, problem: 2500 };
  const values = {}, errors = {};
  for (const [key, max] of Object.entries(limits)) {
    values[key] = typeof source[key] === 'string' ? source[key].replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';
    if (key !== 'problem') values[key] = values[key].replace(/[\r\n]/g, ' ');
    if (values[key].length > max) errors[key] = `Usa como máximo ${max} caracteres.`;
  }
  for (const key of ['name', 'company', 'email', 'problem']) if (!values[key]) errors[key] = 'Completa este campo.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Escribe un correo válido.';
  if (values.problem && values.problem.length < 10) errors.problem = 'Describe el problema con al menos 10 caracteres.';
  if (Object.keys(errors).length) return { valid: false, errors, values };
  const subject = 'MoveFlow · Solicitud de soporte';
  const body = [`Nombre: ${values.name}`, `Empresa: ${values.company}`, `Correo de la cuenta o contacto: ${values.email}`,
    ...(values.reference ? [`Referencia: ${values.reference}`] : []), '', 'Problema:', values.problem].join('\n');
  return { valid: true, errors, values, subject, body, href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
