// Contactos de atención del piloto. Son asesores, no cuentas de acceso.
// Cada mensaje se envía únicamente cuando el cliente lo confirma en WhatsApp.
export const ADVISORS = Object.freeze([
  Object.freeze({ id: "tere", name: "Tere Curiel", initials: "TC", whatsapp: "525529061098", displayPhone: "55 2906 1098" }),
  Object.freeze({ id: "marco", name: "Marco Curiel", initials: "MC", whatsapp: "525614492452", displayPhone: "56 1449 2452" }),
]);

// Una sola atención comercial: Tere recibe el contacto inicial de D’Curiel.
export const BUSINESS = {
  name: import.meta.env?.VITE_BUSINESS_NAME || "Mudanzas D’Curiel",
  whatsapp: ADVISORS[0].whatsapp,
  displayPhone: ADVISORS[0].displayPhone,
};

export const BUSINESS_GREETING = `Hola, ${BUSINESS.name}. Me interesa un servicio de mudanza. ¿Me pueden ayudar con disponibilidad y una propuesta?`;

/** Abre una conversación; el cliente confirma el envío dentro de WhatsApp. */
export function buildBusinessWhatsAppUrl(requestText = "") {
  const details = String(requestText ?? "").trim();
  const message = details
    ? `Hola, ${BUSINESS.name}. Preparé mi solicitud en MoveFlow y me gustaría recibir una propuesta para mi mudanza.\n\n${details}`
    : BUSINESS_GREETING;
  return buildWhatsAppUrl(message);
}

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
