import test from "node:test";
import assert from "node:assert/strict";
import { ADVISORS, BUSINESS, buildWhatsAppUrl, buildAdvisorWhatsAppUrl, getAdvisor } from "../src/config.js";

test("la ficha se dirige al WhatsApp proporcionado por el usuario con lada de México", () => {
  const text = "Solicitud de prueba: PB → Piso 2; mesa & sofá #1";
  const url = new URL(buildWhatsAppUrl(text));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/525529061098");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(BUSINESS.displayPhone, "55 2906 1098");
});

test("cada asesor recibe la misma ficha únicamente en su teléfono elegido", () => {
  const message = "Mi solicitud: sofá & cama, México → Puebla\nReferencia MF-PRUEBA";
  assert.equal(ADVISORS.length, 2);
  for (const [id, name, phone] of [["tere", "Tere Curiel", "525529061098"], ["marco", "Marco Curiel", "525614492452"]]) {
    const url = new URL(buildAdvisorWhatsAppUrl(message, id));
    assert.equal(getAdvisor(id).name, name);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, `/${phone}`);
    assert.equal(url.searchParams.get("text"), message);
    assert.equal(url.searchParams.size, 1);
  }
});

test("no se elige un destinatario implícito ni se acepta un identificador manipulado", () => {
  for (const id of [undefined, null, "", "otro", "https://example.com", "525614492452", "__proto__"]) {
    assert.throws(() => buildAdvisorWhatsAppUrl("Ficha privada", id), /Elige a Tere o Marco/);
  }
  assert.ok(Object.isFrozen(ADVISORS));
  assert.ok(ADVISORS.every(Object.isFrozen));
});
test("un contacto vacío permite compartir y un contacto inválido no genera un enlace erróneo", () => {
  assert.equal(new URL(buildWhatsAppUrl("Ficha", "")).pathname, "/");
  assert.throws(() => buildWhatsAppUrl("Ficha", "https://otro-sitio"));
  assert.match(buildWhatsAppUrl("Ficha", "+52 55 2906 1098"), /wa\.me\/525529061098\?/);
});
