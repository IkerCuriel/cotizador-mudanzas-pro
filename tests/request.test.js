import test from "node:test";
import assert from "node:assert/strict";
import { ACCESS_TYPES, CARRY_RANGES, FURNITURE, ITEMS, PROPERTY_TYPES, ROOMS } from "../src/catalog.js";
import { addOffer, buildRequestText, createRequest, getInventoryTotals, migrateLegacyDraft, normalizeDraft, propertyLabel, restoreRequest, selectOffer } from "../src/request.js";
import { importRequest, loadRequests, REQUESTS_KEY, saveRequest, updateRequest } from "../src/storage.js";

const completeDraft = () => ({
  fields: {
    origin: "Calle Uno 12, Centro, Ciudad de México", destination: "Calle Dos 34, Puebla",
    routeType: "outOfTown", foraneoMode: "shared", moveDate: "2026-11-12", dateFlexibility: "flexible", distanceKm: 125,
    originProperty: "apartment", originFloor: 5, originAccess: "combined", originElevatorFloors: 3,
    originCarryRange: "over30", originCarryMeters: 45, originShuttle: "yes",
    destinationProperty: "residentialPlus", destinationFloor: 1, destinationAccess: "stairs",
    destinationCarryRange: "11-20", destinationShuttle: "no",
    packingType: "none", packingAcknowledged: true, hoistService: "yes", hoistUpFloors: 1, hoistDownFloors: 5,
    shuttleService: "unknown", assemblyCount: 2, storageDays: 5, extraLoaders: 1,
    customItems: "Una escultura de cerámica", specialNotes: "El piano no cabe por la escalera", notes: "Avisar antes de llegar",
    customerName: "Cliente de prueba", phone: "5512345678", email: "cliente@example.com", contactMethod: "call", contactWindow: "afternoon", privacyConsent: true,
  },
  rooms: { bedroom: 2, kitchen: 1, living: 1 },
  inventory: { "bed-queen": 2, "refrigerator-french-door": 1, "piano-upright": 1, "boxes-medium": 10 },
});
const request = (id = "MF-TEST-001") => createRequest(completeDraft(), { id, createdAt: "2026-10-30T15:00:00.000Z" });
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)) };
}

test("catalog covers the requested rooms, properties, access and furniture variants without duplicate IDs", () => {
  assert.equal(ROOMS.length, 11);
  assert.equal(Object.keys(PROPERTY_TYPES).length, 8);
  assert.equal(Object.keys(ACCESS_TYPES).length, 4);
  assert.equal(Object.keys(CARRY_RANGES).length, 5);
  assert.equal(FURNITURE.length, 20);
  assert.equal(ITEMS.length, 50);
  assert.equal(new Set(ITEMS.map((item) => item.id)).size, ITEMS.length);
  for (const item of ITEMS) {
    assert.ok(item.name && item.icon);
    assert.equal(Object.hasOwn(item, "volume"), false);
    assert.equal(Object.hasOwn(item, "weightKg"), false);
    assert.ok(item.roomIds.every((id) => ROOMS.some((room) => room.id === id)));
  }
  for (const id of ["bed-single", "bed-double", "bed-queen", "bed-king", "refrigerator-mini", "refrigerator-duplex", "refrigerator-french-door", "piano-upright", "safe-large", "shed-modular", "bar-standard"]) {
    assert.ok(ITEMS.some((item) => item.id === id), id);
  }
});

test("chairs have one general counter and an office counter; armchairs are discoverable separately", () => {
  const chairs = FURNITURE.find((group) => group.id === "chairs");
  const office = FURNITURE.find((group) => group.id === "officeChairs");
  assert.deepEqual(chairs.variants.map((item) => item.id), ["chair-dining"]);
  assert.equal(chairs.variants[0].name, "Sillas");
  assert.deepEqual(office.variants.map((item) => item.id), ["chair-office"]);
  assert.ok(office.variants[0].name.includes("escritorio"));
  assert.deepEqual(FURNITURE.find((group) => group.id === "armchairs").variants.map((item) => item.id), ["armchair-single", "armchair-recliner"]);
  assert.equal(FURNITURE.flatMap((group) => group.variants).some((item) => item.id === "chair-folding"), false);
});

test("historical chair IDs preserve all quantities through import, text export and re-save", () => {
  const historic = { ...request(), inventory: { "chair-dining": 99, "chair-folding": 99, "chair-office": 3, "armchair-single": 1 } };
  const restored = restoreRequest(historic);
  for (const [id, count] of Object.entries(historic.inventory)) assert.equal(restored.inventory[id], count);
  assert.equal(restored.totals.totalItems, 202);
  const exported = buildRequestText(restored);
  assert.match(exported, /99 × Sillas/);
  assert.match(exported, /99 × Silla plegable/);
  assert.match(exported, /3 × Silla de escritorio/);
  assert.deepEqual(importRequest(JSON.stringify(restored), memoryStorage()).inventory, restored.inventory);
});

test("otro inmueble de origen conserva su descripción en borrador, ficha y archivo importado", () => {
  const source = completeDraft();
  source.fields.originProperty = "other";
  source.fields.originPropertyOther = "  Taller\u0007 de arte\ncon almacén  ";
  const prepared = createRequest(source, { id: "MF-OTHER-001" });
  assert.equal(prepared.fields.originProperty, "other");
  assert.equal(prepared.fields.originPropertyOther, "Taller de arte con almacén");
  assert.equal(propertyLabel(prepared.fields, "origin"), "Otro: Taller de arte con almacén");
  assert.match(buildRequestText(prepared), /Inmueble: Otro: Taller de arte con almacén/);
  const imported = importRequest(JSON.stringify(prepared), memoryStorage());
  assert.equal(imported.fields.originPropertyOther, prepared.fields.originPropertyOther);
  assert.equal(restoreRequest(prepared).fields.originPropertyOther, prepared.fields.originPropertyOther);
});

test("otro inmueble está limitado al origen y no conserva texto oculto al cambiar de opción", () => {
  const source = completeDraft();
  source.fields.originPropertyOther = "No enviar esta descripción anterior";
  source.fields.destinationProperty = "other";
  source.fields.destinationPropertyOther = "No se ofrece en destino";
  const normalized = normalizeDraft(source);
  assert.equal(normalized.fields.originPropertyOther, undefined);
  assert.equal(normalized.fields.destinationProperty, "house");
  assert.equal(normalized.fields.destinationPropertyOther, undefined);
  assert.ok(!buildRequestText(normalized).includes("No enviar"));
  assert.equal(propertyLabel({ originProperty: "__proto__" }, "origin"), "Por definir");
  assert.equal(propertyLabel({ originProperty: { toString: null } }, "origin"), "Por definir");
  assert.equal(propertyLabel({ originProperty: "house" }, "unexpected"), "Por definir");
});

test("la descripción de otro inmueble se normaliza con máximo 120 caracteres", () => {
  const fields = { originProperty: "other", originPropertyOther: "X".repeat(150) };
  assert.equal(normalizeDraft({ fields }).fields.originPropertyOther.length, 120);
  for (const value of [undefined, null, {}, " \n\t "]) {
    const result = normalizeDraft({ fields: { ...fields, originPropertyOther: value } });
    assert.equal(result.fields.originPropertyOther, "");
    assert.equal(propertyLabel(result.fields, "origin"), "Otro: por describir");
  }
});

test("normalization allows known fields only and bounds counts without inherited values", () => {
  const normalized = normalizeDraft({
    fields: { ...completeDraft().fields, customerName: "  Ana  ", quoteTotal: 500, vehicleType: "trailer", volumeOverride: 900, originFloor: 700, extraLoaders: 999 },
    rooms: { bedroom: 99, unknown: 3 },
    inventory: Object.assign(Object.create({ "bed-single": 4 }), { "bed-king": 200, "boxes-medium": 2.9, "boxes-large": -4, missing: 10 }),
  });
  assert.equal(normalized.fields.customerName, "Ana");
  assert.equal(normalized.fields.originFloor, 50);
  assert.equal(Object.hasOwn(normalized.fields, "extraLoaders"), false);
  assert.equal(Object.hasOwn(normalized.fields, "storageDays"), false);
  assert.equal(normalized.rooms.bedroom, 20);
  assert.equal(normalized.inventory["bed-king"], 99);
  assert.equal(normalized.inventory["boxes-medium"], 2);
  assert.equal(normalized.inventory["boxes-large"], 0);
  assert.equal(normalized.inventory["bed-single"], 0);
  for (const key of ["quoteTotal", "vehicleType", "volumeOverride"]) assert.equal(Object.hasOwn(normalized.fields, key), false);
  assert.equal(Object.hasOwn(normalized.rooms, "unknown"), false);
  assert.equal(Object.hasOwn(normalized.inventory, "missing"), false);
});

test("malformed field values normalize to finite defaults, valid choices and empty text", () => {
  for (const invalid of [null, [], "bad", 4]) assert.doesNotThrow(() => normalizeDraft(invalid));
  for (const invalid of [Infinity, NaN, {}, true, "bad"]) {
    const normalized = normalizeDraft({ fields: { originFloor: invalid, customerName: invalid, distanceKm: invalid, assemblyCount: invalid, originProperty: "__proto__", originAccess: "toString" }, inventory: { "bed-queen": invalid } });
    assert.equal(normalized.fields.originFloor, 0);
    assert.equal(normalized.fields.assemblyCount, 0);
    assert.equal(normalized.fields.distanceKm, "");
    assert.equal(normalized.fields.originProperty, "house");
    assert.equal(normalized.fields.originAccess, "ground");
    assert.equal(normalized.inventory["bed-queen"], 0);
  }
});

test("local routing clears foráneo choice and route defaults cannot be injected", () => {
  assert.equal(normalizeDraft({ fields: { routeType: "local", foraneoMode: "shared" } }).fields.foraneoMode, "");
  assert.equal(normalizeDraft({ fields: { routeType: "outOfTown", foraneoMode: "invalid" } }).fields.foraneoMode, "undecided");
  assert.equal(normalizeDraft({ fields: { routeType: "toString" } }).fields.routeType, "local");
});

test("floor and elevator details stay coherent and irrelevant details are cleared", () => {
  const { fields } = normalizeDraft({ fields: {
    originFloor: 3, originAccess: "combined", originElevatorFloors: 8,
    destinationFloor: 0, destinationAccess: "elevator", destinationElevatorFloors: 4,
    originCarryRange: "11-20", originCarryMeters: 60, destinationCarryRange: "over30", destinationCarryMeters: 4,
    hoistService: "no", hoistUpFloors: 5, hoistDownFloors: 3, packingType: "full", boxCount: 22, packingAcknowledged: true,
  } });
  assert.equal(fields.originElevatorFloors, 3);
  assert.equal(fields.destinationAccess, "ground");
  assert.equal(fields.destinationElevatorFloors, 0);
  assert.equal(fields.originCarryMeters, "");
  assert.equal(fields.destinationCarryMeters, 31);
  assert.equal(fields.hoistUpFloors, 0);
  assert.equal(fields.hoistDownFloors, 0);
  assert.equal(fields.boxCount, 22);
  assert.equal(fields.packingAcknowledged, false);
  assert.equal(normalizeDraft({ fields: { originFloor: 5, originAccess: "ground" } }).fields.originAccess, "stairs");
  assert.equal(normalizeDraft({ fields: { packingType: "none", boxCount: 20 } }).fields.boxCount, 0);
  assert.equal(normalizeDraft({ fields: { packingType: "undecided", boxCount: 20 } }).fields.boxCount, 0);
});

test("carry distance does not make an automatic traspaleo decision", () => {
  const { fields } = normalizeDraft({ fields: { originCarryRange: "over30", originCarryMeters: 200 } });
  assert.equal(fields.originShuttle, "unknown");
  assert.equal(fields.shuttleService, "unknown");
});

test("optional distance, carry and packing counts use the same limits as the form", () => {
  for (const packingType of ["boxes", "partial", "full"]) {
    const { fields } = normalizeDraft({ fields: { packingType, boxCount: 7000, distanceKm: 30000, originCarryRange: "over30", originCarryMeters: 2500 } });
    assert.equal(fields.boxCount, 5000);
    assert.equal(fields.distanceKm, 10000);
    assert.equal(fields.originCarryMeters, 2000);
  }
  assert.equal(normalizeDraft({ fields: { packingType: "boxes", boxCount: 3000 } }).fields.boxCount, 3000);
  assert.equal(normalizeDraft({ fields: { distanceKm: -1 } }).fields.distanceKm, 1);
  assert.equal(normalizeDraft({ fields: { distanceKm: "", originCarryRange: "over30", originCarryMeters: "" } }).fields.distanceKm, "");
});

test("invalid calendar dates are cleared and flexible dates may remain unconfirmed", () => {
  for (const invalid of ["2026-02-30", "2026-13-01", "12/11/2026", "", null]) assert.equal(normalizeDraft({ fields: { moveDate: invalid } }).fields.moveDate, "");
  assert.equal(normalizeDraft({ fields: { moveDate: "2028-02-29", dateFlexibility: "exact" } }).fields.moveDate, "2028-02-29");
  assert.equal(normalizeDraft({ fields: { dateFlexibility: "flexible" } }).fields.dateFlexibility, "flexible");
});

test("inventory totals count variants once regardless of number of furnished rooms", () => {
  const inventory = { "bed-queen": 2, "boxes-medium": 10, "piano-upright": 1 };
  const totals = getInventoryTotals({ bedroom: 8, living: 2 }, inventory);
  assert.deepEqual(totals, { totalItems: 13, totalRooms: 10, specialItems: 1 });
  assert.deepEqual({ ...getInventoryTotals({ bedroom: 1 }, inventory), totalRooms: 10 }, totals);
});

test("new requests contain descriptive totals and no automatic quote or imported monetary values", () => {
  const draft = completeDraft();
  draft.fields.price = 999;
  draft.total = 999;
  draft.offers = [{ amount: 12 }];
  const result = createRequest(draft, { id: "MF-TEST-NEW", createdAt: "2026-10-30T15:00:00Z" });
  assert.equal(result.version, 1);
  assert.equal(result.status, "prepared");
  assert.equal(result.createdAt, "2026-10-30T15:00:00.000Z");
  assert.deepEqual(result.offers, []);
  assert.equal(result.selectedOfferId, null);
  assert.equal(Object.hasOwn(result, "total"), false);
  assert.equal(Object.hasOwn(result.fields, "price"), false);
  assert.equal(result.totals.totalItems, 14);
  assert.deepEqual(Object.keys(result.totals).sort(), ["specialItems", "totalItems", "totalRooms"]);
  assert.doesNotMatch(JSON.stringify(result), /totalVolume|totalWeight|weightKg|storageDays|extraLoaders/);
  assert.notEqual(createRequest(draft).id, createRequest(draft).id);
});

test("text export includes details needed for human negotiation but never offers", () => {
  const base = request();
  const withOffer = addOffer(base, { company: "Empresa privada", amount: 98765, notes: "Nota interna secreta" });
  const result = buildRequestText(withOffer);
  for (const content of ["MF-TEST-001", "Foráneo · Compartido", "2026-11-12", "Ciudad de México", "Calle Dos 34", "Residencial plus", "3 niveles con elevador y 2 por escaleras", "45 m", "Recámara: 2", "2 × Cama queen", "Refrigerador de puerta francesa", "MANEJO ESPECIAL", "Una escultura de cerámica", "El piano no cabe", "No se recogen artículos sueltos", "subida 1 pisos; bajada 5 pisos", "5512345678", "cliente@example.com", "Llamada · Tarde", "Autorización para contacto sobre esta solicitud: Sí"]) assert.ok(result.includes(content), content);
  assert.equal(/98765|Empresa privada|Nota interna secreta|\$/.test(result), false);
  assert.doesNotMatch(result, /Volumen|peso orientativo|m³|\bkg\b|Cargadores|Almacenaje:|5 días/);
  assert.equal(buildRequestText(base), result);
});

test("restoring older estimates strips operational decisions and preserves notes for the conversation", () => {
  const old = { ...request(), fields: { ...request().fields, storageDays: 12, extraLoaders: 4, notes: "Quiero consultar disponibilidad de bodega" }, totals: { totalItems: 14, totalVolume: 6.55, totalWeight: 259 } };
  const current = restoreRequest(old);
  assert.equal(current.fields.notes, old.fields.notes);
  assert.deepEqual(current.totals, { totalItems: 14, totalRooms: 4, specialItems: 1 });
  assert.doesNotMatch(JSON.stringify(current), /totalVolume|totalWeight|storageDays|extraLoaders/);
  assert.match(buildRequestText(current), /Quiero consultar disponibilidad de bodega/);
  assert.doesNotMatch(buildRequestText(old), /6[.,]55|259|Cargadores|12 días/);
});

test("legacy drafts preserve furniture and usable access/services while requesting fresh contact consent", () => {
  const migrated = migrateLegacyDraft({
    fields: { originFloor: 4, originElevator: "on", originCarryMeters: 45, packingType: "half", hoistDownFloors: 3, privacyConsent: true, quoteTotal: 9000, services: ["assembly"] },
    inventory: { boxes: 8, wardrobe: 2, bed: 1, refrigerator: 1, washer: 1, unknown: 99 },
  });
  assert.equal(migrated.inventory["boxes-medium"], 8);
  assert.equal(migrated.inventory["wardrobe-large"], 2);
  assert.equal(migrated.inventory["bed-double"], 1);
  assert.equal(migrated.inventory["refrigerator-standard"], 1);
  assert.equal(migrated.inventory["washer-standard"], 1);
  assert.equal(migrated.fields.originAccess, "elevator");
  assert.equal(migrated.fields.originCarryRange, "over30");
  assert.equal(migrated.fields.originCarryMeters, 45);
  assert.equal(migrated.fields.packingType, "partial");
  assert.equal(migrated.fields.hoistService, "yes");
  assert.equal(migrated.fields.assemblyCount, 5);
  assert.equal(migrated.fields.privacyConsent, false);
  assert.equal(Object.hasOwn(migrated.fields, "quoteTotal"), false);
});

test("offers are manually supplied, immutable and limited to valid positive amounts", () => {
  const base = request();
  const result = addOffer(base, { company: "  Mudanzas Familia  ", amount: "12500.50", contact: "5511122233", notes: "Incluye empaque" });
  assert.equal(base.offers.length, 0);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].company, "Mudanzas Familia");
  assert.equal(result.offers[0].amount, 12500.5);
  assert.equal(result.status, "negotiating");
  for (const amount of [0, -1, "", true, Infinity, "abc", 100000001, {}]) assert.throws(() => addOffer(base, { company: "Empresa", amount }), /importe/);
  assert.throws(() => addOffer(base, { company: " ", amount: 1000 }), /nombre/);
});

test("choosing an offer requires a known offer and records a human choice", () => {
  const withOffer = addOffer(request(), { company: "Empresa", amount: 6000 });
  assert.throws(() => selectOffer(withOffer, "OF-MISSING"), /pertenezca/);
  const selected = selectOffer(withOffer, withOffer.offers[0].id);
  assert.equal(withOffer.selectedOfferId, null);
  assert.equal(selected.selectedOfferId, withOffer.offers[0].id);
  assert.equal(selected.status, "agreed");
  assert.equal(addOffer(selected, { company: "Otra empresa", amount: 7500 }).status, "agreed");
});

test("restored records recalculate external totals and reject unsupported status and selection", () => {
  const base = request();
  assert.equal(restoreRequest({ ...base, totals: { totalItems: 99999, price: 3000 } }).totals.totalItems, 14);
  for (const patch of [{ version: 2 }, { id: "malicious" }, { status: "paid" }, { status: "agreed" }, { selectedOfferId: "OF-UNKNOWN" }, { offers: null }, { rooms: [] }, { createdAt: "bad" }]) assert.throws(() => restoreRequest({ ...base, ...patch }));
  const offered = addOffer(base, { company: "Empresa", amount: 4500 });
  assert.throws(() => restoreRequest({ ...offered, offers: [...offered.offers, ...offered.offers] }), /duplicadas/);
});

test("storage saves and updates by reference without duplicate records", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadRequests(storage), []);
  assert.equal(saveRequest(request(), storage).length, 1);
  assert.equal(saveRequest(request(), storage).length, 1);
  saveRequest(request("MF-TEST-002"), storage);
  const updated = updateRequest("MF-TEST-001", (record) => addOffer(record, { company: "Empresa", amount: 6500 }), storage);
  assert.equal(updated.offers.length, 1);
  assert.equal(loadRequests(storage).length, 2);
  assert.throws(() => updateRequest("MF-NOT-FOUND", (record) => record, storage), /No se encontró/);
  assert.throws(() => updateRequest(updated.id, (record) => ({ ...record, id: "MF-OTHER-ID" }), storage), /referencia/);
});

test("corrupt storage is reported and cannot be silently overwritten", () => {
  for (const raw of ["{broken", "{}", "null", JSON.stringify([request(), { bad: true }]), JSON.stringify([request(), request()])]) {
    const storage = memoryStorage({ [REQUESTS_KEY]: raw });
    assert.throws(() => loadRequests(storage), /No se han sobrescrito/);
    assert.throws(() => saveRequest(request("MF-TEST-002"), storage), /No se han sobrescrito/);
    assert.equal(storage.getItem(REQUESTS_KEY), raw);
  }
});

test("blocked storage reports failure while preserving the prepared request", () => {
  const base = request();
  const readingBlocked = { getItem() { throw new Error("Blocked"); }, setItem() {} };
  const writingBlocked = { getItem() { return null; }, setItem() { throw new Error("Quota"); } };
  assert.throws(() => loadRequests(readingBlocked), /leer/);
  assert.throws(() => saveRequest(base, writingBlocked), /guardar/);
  assert.throws(() => loadRequests(null), /no está disponible/);
  assert.equal(base.status, "prepared");
});

test("imports support JSON round trips and idempotent upserts and reject invalid JSON", () => {
  const storage = memoryStorage();
  const offered = addOffer(request(), { company: "Mudanzas Familia", amount: 8000, notes: "Oferta telefónica" });
  const selected = selectOffer(offered, offered.offers[0].id);
  const first = importRequest(JSON.stringify(selected), storage);
  assert.deepEqual(first, selected);
  assert.deepEqual(importRequest(first, storage), selected);
  assert.equal(loadRequests(storage).length, 1);
  assert.throws(() => importRequest("<html>not-json</html>", storage), /JSON válido/);
  assert.throws(() => importRequest(JSON.stringify({ fields: {} }), storage), /solicitud MoveFlow válida/);
  assert.deepEqual(loadRequests(storage), [selected]);
});

test("reimporting the original preserves recorded offers, the client's choice and progress", () => {
  const storage = memoryStorage();
  const original = request();
  const offered = addOffer(original, { company: "Empresa local", amount: 4500 });
  const agreed = selectOffer(offered, offered.offers[0].id);
  saveRequest(agreed, storage);
  assert.deepEqual(importRequest(JSON.stringify(original), storage), agreed);
  assert.deepEqual(loadRequests(storage), [agreed]);
  const contactedStorage = memoryStorage();
  saveRequest({ ...original, status: "contacted" }, contactedStorage);
  assert.equal(importRequest(original, contactedStorage).status, "contacted");
});

test("imports combine independent offers with no duplication and preserve the furthest progress", () => {
  const storage = memoryStorage();
  const original = request();
  const local = addOffer(original, { company: "Primera empresa", amount: 5000 });
  const incoming = addOffer(original, { company: "Segunda empresa", amount: 6500 });
  saveRequest(local, storage);
  const combined = importRequest(incoming, storage);
  assert.deepEqual(combined.offers, [...local.offers, ...incoming.offers]);
  assert.equal(combined.status, "negotiating");
  assert.equal(importRequest(incoming, storage).offers.length, 2);
  const selected = selectOffer(incoming, incoming.offers[0].id);
  const withChoice = importRequest(selected, storage);
  assert.equal(withChoice.selectedOfferId, incoming.offers[0].id);
  assert.equal(withChoice.status, "agreed");
  assert.equal(withChoice.offers.length, 2);
});

test("same reference with changed moving details is rejected without writing", () => {
  const storage = memoryStorage();
  const original = request();
  saveRequest(original, storage);
  const before = storage.getItem(REQUESTS_KEY);
  const variants = [
    { ...original, fields: { ...original.fields, destination: "Otro domicilio" } },
    { ...original, rooms: { ...original.rooms, bedroom: 10 } },
    { ...original, inventory: { ...original.inventory, "bed-queen": 20 } },
    { ...original, createdAt: "2026-11-01T12:00:00.000Z" },
  ];
  for (const conflicting of variants) {
    assert.throws(() => importRequest(conflicting, storage), /datos distintos/);
    assert.equal(storage.getItem(REQUESTS_KEY), before);
  }
});

test("conflicting offer content or client choices cannot overwrite the local history", () => {
  const storage = memoryStorage();
  const first = addOffer(request(), { company: "Empresa uno", amount: 4500, notes: "Incluye empaque" });
  const two = addOffer(first, { company: "Empresa dos", amount: 6000 });
  const selected = selectOffer(two, two.offers[0].id);
  saveRequest(selected, storage);
  const before = storage.getItem(REQUESTS_KEY);
  const editedOffer = { ...selected, offers: selected.offers.map((offer, index) => index ? offer : { ...offer, amount: 9900 }) };
  assert.throws(() => importRequest(editedOffer, storage), /importe o condiciones distintos/);
  assert.equal(storage.getItem(REQUESTS_KEY), before);
  const differentChoice = selectOffer(two, two.offers[1].id);
  assert.throws(() => importRequest(differentChoice, storage), /elecciones de oferta diferentes/);
  assert.equal(storage.getItem(REQUESTS_KEY), before);
});

test("the 100-record limit does not silently evict an earlier customer request", () => {
  const records = Array.from({ length: 100 }, (_, index) => request(`MF-TEST-${index}`));
  const storage = memoryStorage({ [REQUESTS_KEY]: JSON.stringify(records) });
  assert.throws(() => saveRequest(request("MF-NEW-RECORD"), storage), /100 solicitudes/);
  assert.equal(loadRequests(storage).length, 100);
  assert.equal(saveRequest(records[20], storage).length, 100);
});
