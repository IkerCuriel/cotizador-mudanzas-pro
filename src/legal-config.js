import { SUPPORT_EMAIL } from './support-contact.js';

export function readLegalConfig(env = {}) {
  const name = String(env.VITE_LEGAL_NAME || '').trim();
  const address = String(env.VITE_LEGAL_ADDRESS || '').trim();
  const phone = String(env.VITE_LEGAL_PHONE || '').trim();
  const email = String(env.VITE_PRIVACY_EMAIL || SUPPORT_EMAIL).trim();
  const ready = env.VITE_PRIVACY_READY === 'true' && name.length >= 3 && address.length >= 10 && /^\+?[\d ().-]+$/.test(phone) && /^\d{10,15}$/.test(phone.replace(/\D/g, '')) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return Object.freeze({ name, address, phone, email, ready, version: '2026-10-30' });
}

export const LEGAL = readLegalConfig({
  VITE_LEGAL_NAME: import.meta.env?.VITE_LEGAL_NAME,
  VITE_LEGAL_ADDRESS: import.meta.env?.VITE_LEGAL_ADDRESS,
  VITE_LEGAL_PHONE: import.meta.env?.VITE_LEGAL_PHONE,
  VITE_PRIVACY_EMAIL: import.meta.env?.VITE_PRIVACY_EMAIL,
  VITE_PRIVACY_READY: import.meta.env?.VITE_PRIVACY_READY,
});
export const LEGAL_READY = LEGAL.ready;
