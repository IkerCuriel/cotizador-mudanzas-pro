import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS, buildWhatsAppUrl } from "../src/config.js";

test("la ficha se dirige al WhatsApp proporcionado por el usuario con lada de México", () => {
  const text = "Solicitud de prueba: PB → Piso 2; mesa & sofá #1";
  const url = new URL(buildWhatsAppUrl(text));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/525529061098");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(BUSINESS.displayPhone, "55 2906 1098");
});
test("un contacto vacío permite compartir y un contacto inválido no genera un enlace erróneo", () => {
  assert.equal(new URL(buildWhatsAppUrl("Ficha", "")).pathname, "/");
  assert.throws(() => buildWhatsAppUrl("Ficha", "https://otro-sitio"));
  assert.match(buildWhatsAppUrl("Ficha", "+52 55 2906 1098"), /wa\.me\/525529061098\?/);
});
