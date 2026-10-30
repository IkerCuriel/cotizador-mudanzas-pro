// Contactos públicos del piloto. Son asesores de atención, no cuentas de acceso.
// Cada mensaje se envía únicamente cuando el cliente lo confirma en WhatsApp.
export const ADVISORS = Object.freeze([
  Object.freeze({ id: "tere", name: "Tere Curiel", initials: "TC", whatsapp: "525529061098", displayPhone: "55 2906 1098" }),
  Object.freeze({ id: "marco", name: "Marco Curiel", initials: "MC", whatsapp: "525614492452", displayPhone: "56 1449 2452" }),
]);

// El contacto principal se conserva para las pantallas de cuenta existentes.
export const BUSINESS = {
  name: import.meta.env?.VITE_BUSINESS_NAME || "Equipo de mudanzas familiar",
  whatsapp: ADVISORS[0].whatsapp,
  displayPhone: ADVISORS[0].displayPhone,
};

export function getAdvisor(id) {
  const advisor = ADVISORS.find((entry) => entry.id === id);
  if (!advisor) throw new Error("Elige a Tere o Marco para compartir tu solicitud.");
  return advisor;
}

export function buildAdvisorWhatsAppUrl(message, advisorId) {
  return buildWhatsAppUrl(message, getAdvisor(advisorId).whatsapp);
}

export function buildWhatsAppUrl(message, phone = BUSINESS.whatsapp) {
  const digits = String(phone).replace(/[+\s()-]/g, "");
  if (digits && !/^\d{10,15}$/.test(digits)) throw new Error("El WhatsApp del negocio debe incluir lada de país y solo dígitos.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
