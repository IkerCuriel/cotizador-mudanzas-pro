// Contacto público de la empresa. Las identidades del equipo no se publican.
export const BUSINESS = Object.freeze({
  slug: "d-curiel",
  name: import.meta.env?.VITE_BUSINESS_NAME || "Mudanzas D’Curiel",
  whatsapp: "525529061098",
  displayPhone: "55 2906 1098",
});

export const BUSINESS_GREETING = `Hola, ${BUSINESS.name}. Me interesa un servicio de mudanza. ¿Me pueden ayudar con disponibilidad y una propuesta?`;

/** Abre una conversación; el cliente confirma el envío dentro de WhatsApp. */
export function buildBusinessWhatsAppUrl(requestText = "") {
  const details = String(requestText ?? "").trim();
  const message = details
    ? `Hola, ${BUSINESS.name}. Preparé mi solicitud en MoveFlow y me gustaría recibir una propuesta para mi mudanza.\n\n${details}`
    : BUSINESS_GREETING;
  return buildWhatsAppUrl(message);
}

export function buildWhatsAppUrl(message, phone = BUSINESS.whatsapp) {
  const digits = String(phone).replace(/[+\s()-]/g, "");
  if (digits && !/^\d{10,15}$/.test(digits)) throw new Error("El WhatsApp del negocio debe incluir lada de país y solo dígitos.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
