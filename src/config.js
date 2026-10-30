// Contacto del negocio familiar para el piloto. La página no envía mensajes sola.
export const BUSINESS = {
  name: import.meta.env?.VITE_BUSINESS_NAME || "Equipo de mudanzas familiar",
  whatsapp: "525529061098",
  displayPhone: "55 2906 1098",
};

export function buildWhatsAppUrl(message, phone = BUSINESS.whatsapp) {
  const digits = String(phone).replace(/[+\s()-]/g, "");
  if (digits && !/^\d{10,15}$/.test(digits)) throw new Error("El WhatsApp del negocio debe incluir lada de país y solo dígitos.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
