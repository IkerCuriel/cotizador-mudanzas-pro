export function readLegalConfig(env = {}) {
  const name = String(env.VITE_LEGAL_NAME || '').trim();
  const address = String(env.VITE_LEGAL_ADDRESS || '').trim();
  const email = String(env.VITE_PRIVACY_EMAIL || '').trim();
  const ready = env.VITE_PRIVACY_READY === 'true' && name.length >= 3 && address.length >= 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return Object.freeze({ name, address, email, ready, version: '2026-10-30' });
}

export const LEGAL = readLegalConfig({
  VITE_LEGAL_NAME: import.meta.env?.VITE_LEGAL_NAME,
  VITE_LEGAL_ADDRESS: import.meta.env?.VITE_LEGAL_ADDRESS,
  VITE_PRIVACY_EMAIL: import.meta.env?.VITE_PRIVACY_EMAIL,
  VITE_PRIVACY_READY: import.meta.env?.VITE_PRIVACY_READY,
});
export const LEGAL_READY = LEGAL.ready;
