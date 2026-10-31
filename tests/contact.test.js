import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS, BUSINESS_GREETING, buildBusinessWhatsAppUrl, buildWhatsAppUrl } from "../src/config.js";

test("el contacto directo abre la línea principal de la empresa con un saludo útil", () => {
  for (const input of [undefined, null, "", "   "]) {
    const url = new URL(buildBusinessWhatsAppUrl(input));
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/525529061098");
    assert.equal(url.searchParams.get("text"), BUSINESS_GREETING);
    assert.equal(url.searchParams.size, 1);
  }
  assert.match(BUSINESS_GREETING, /Mudanzas D’Curiel/);
  assert.match(BUSINESS_GREETING, /servicio de mudanza/);
});

test("la solicitud completa llega al enlace del negocio sin perder notas, acentos ni saltos", () => {
  const details = "SOLICITUD DE MUDANZA · MF-PRUEBA\nRuta: México → Puebla\nInventario: 2 × sofá & mesa #1\nNotas: ¿Acceso por escalera?";
  const url = new URL(buildBusinessWhatsAppUrl(details));
  assert.equal(url.pathname, "/525529061098");
  assert.ok(url.searchParams.get("text").endsWith(`\n\n${details}`));
  assert.match(url.searchParams.get("text"), /Hola, Mudanzas D’Curiel/);
  assert.equal(url.searchParams.size, 1);
});

test("la ficha se dirige al WhatsApp proporcionado por el usuario con lada de México", () => {
  const text = "Solicitud de prueba: PB → Piso 2; mesa & sofá #1";
  const url = new URL(buildWhatsAppUrl(text));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/525529061098");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(BUSINESS.displayPhone, "55 2906 1098");
});

test("la identidad comercial pública solo describe a la empresa", () => {
  assert.deepEqual(Object.keys(BUSINESS).sort(), ["displayPhone", "name", "slug", "whatsapp"]);
  assert.ok(Object.isFrozen(BUSINESS));
});
test("un contacto vacío permite compartir y un contacto inválido no genera un enlace erróneo", () => {
  assert.equal(new URL(buildWhatsAppUrl("Ficha", "")).pathname, "/");
  assert.throws(() => buildWhatsAppUrl("Ficha", "https://otro-sitio"));
  assert.match(buildWhatsAppUrl("Ficha", "+52 55 2906 1098"), /wa\.me\/525529061098\?/);
});
