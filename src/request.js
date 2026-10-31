import { ACCESS_TYPES, CARRY_RANGES, ITEMS, PROPERTY_TYPES, ROOMS } from "./catalog.js";
import { normalizeAdditionalDestinations, normalizeLocationSelection } from "./locations.js";
export { MAX_ADDITIONAL_DESTINATIONS, normalizeAdditionalDestinations, normalizeLocationSelection, routeText } from "./locations.js";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value, key) => record(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const text = (value, max = 300) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const number = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : 0;
const integer = (value, max = 99) => Math.min(max, Math.max(0, Math.floor(number(value))));
const choice = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const checked = (value) => value === true || value === "on" || value === "true";
const optionalNumber = (value, max, min = 0) => value === "" || value === null || value === undefined || (typeof value === "string" && !value.trim()) || !["number", "string"].includes(typeof value) || !Number.isFinite(Number(value)) ? "" : Math.min(max, Math.max(min, Number(value)));
const yesNo = ["yes", "no", "unknown"];
const round = (value, digits = 2) => Number(value.toFixed(digits));
const countMap = (data, catalog, max) => Object.fromEntries(catalog.map(({ id }) => [id, integer(own(data, id), max)]));
const otherPropertyText = (value) => text(value, 120).replace(/\s+/g, " ").trim();

/** Descripción de origen para fichas y resúmenes; siempre es texto, no HTML. */
export function propertyLabel(fields, endpoint) {
  if (!["origin", "destination"].includes(endpoint)) return "Por definir";
  const selected = own(fields, `${endpoint}Property`);
  if (selected === "other") return endpoint === "origin"
    ? `Otro: ${otherPropertyText(own(fields, "originPropertyOther")) || "por describir"}`
    : "Por definir";
  return typeof selected === "string" && Object.hasOwn(PROPERTY_TYPES, selected) ? PROPERTY_TYPES[selected] : "Por definir";
}

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

function timestamp(value, fallback = new Date().toISOString()) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !date(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) {
    throw new Error("La fecha del registro no es válida.");
  }
  return new Date(value).toISOString();
}

function newId(prefix = "MF") {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12)
    ?? `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
}

function validId(value, prefix) {
  return typeof value === "string" && new RegExp(`^${prefix}-[A-Za-z0-9-]{3,80}$`).test(value);
}

/** Solo datos descriptivos: no hay tarifas, factores ni cotización automática. */
export function normalizeDraft(data = {}) {
  const source = record(data) && record(data.fields) ? data.fields : {};
  const fields = {};
  for (const name of ["origin", "destination"]) fields[name] = text(own(source, name), 500);
  for (const side of ["origin", "destination"]) {
    const selected = normalizeLocationSelection(own(source, `${side}Place`), fields[side]);
    if (selected) fields[`${side}Place`] = selected;
  }
  const additionalDestinations = normalizeAdditionalDestinations(own(source, "additionalDestinations"));
  if (additionalDestinations.length) fields.additionalDestinations = additionalDestinations;
  fields.routeType = choice(own(source, "routeType"), ["local", "outOfTown"], "local");
  fields.foraneoMode = fields.routeType === "outOfTown" ? choice(own(source, "foraneoMode"), ["direct", "shared", "undecided"], "undecided") : "";
  fields.moveDate = date(own(source, "moveDate"));
  fields.dateFlexibility = choice(own(source, "dateFlexibility"), ["exact", "flexible"], "flexible");
  fields.distanceKm = optionalNumber(own(source, "distanceKm"), 10000, 1);
  for (const endpoint of ["origin", "destination"]) {
    const floor = integer(own(source, `${endpoint}Floor`), 50);
    const selectedAccess = choice(own(source, `${endpoint}Access`), Object.keys(ACCESS_TYPES), floor ? "stairs" : "ground");
    const propertyTypes = Object.keys(PROPERTY_TYPES).filter((type) => endpoint === "origin" || type !== "other");
    fields[`${endpoint}Property`] = choice(own(source, `${endpoint}Property`), propertyTypes, "house");
    fields[`${endpoint}Floor`] = floor;
    fields[`${endpoint}Access`] = floor === 0 ? "ground" : selectedAccess === "ground" ? "stairs" : selectedAccess;
    fields[`${endpoint}ElevatorFloors`] = fields[`${endpoint}Access`] === "combined" ? integer(own(source, `${endpoint}ElevatorFloors`), floor) : 0;
    fields[`${endpoint}CarryRange`] = choice(own(source, `${endpoint}CarryRange`), Object.keys(CARRY_RANGES), "unknown");
    fields[`${endpoint}CarryMeters`] = fields[`${endpoint}CarryRange`] === "over30" ? optionalNumber(own(source, `${endpoint}CarryMeters`), 2000, 31) : "";
    fields[`${endpoint}Shuttle`] = choice(own(source, `${endpoint}Shuttle`), yesNo, "unknown");
  }
  // No conservar descripciones ocultas al cambiar a una opción del catálogo.
  // La ausencia del campo en los demás casos mantiene estables fichas anteriores.
  if (fields.originProperty === "other") fields.originPropertyOther = otherPropertyText(own(source, "originPropertyOther"));
  fields.packingType = choice(own(source, "packingType"), ["none", "partial", "full", "boxes", "undecided"], "undecided");
  fields.boxCount = ["boxes", "partial", "full"].includes(fields.packingType) ? integer(own(source, "boxCount"), 5000) : 0;
  fields.packingAcknowledged = fields.packingType === "none" && checked(own(source, "packingAcknowledged"));
  fields.hoistService = choice(own(source, "hoistService"), yesNo, "unknown");
  fields.hoistUpFloors = fields.hoistService === "yes" ? integer(own(source, "hoistUpFloors"), 50) : 0;
  fields.hoistDownFloors = fields.hoistService === "yes" ? integer(own(source, "hoistDownFloors"), 50) : 0;
  fields.shuttleService = choice(own(source, "shuttleService"), yesNo, "unknown");
  fields.assemblyCount = integer(own(source, "assemblyCount"), 99);
  fields.storageDays = integer(own(source, "storageDays"), 365);
  fields.extraLoaders = integer(own(source, "extraLoaders"), 20);
  for (const name of ["specialNotes", "customItems", "notes"]) fields[name] = text(own(source, name), 3000);
  fields.customerName = text(own(source, "customerName"), 100);
  fields.phone = text(own(source, "phone"), 40);
  fields.email = text(own(source, "email"), 254);
  fields.contactMethod = choice(own(source, "contactMethod"), ["whatsapp", "call", "either"], "either");
  fields.contactWindow = choice(own(source, "contactWindow"), ["morning", "afternoon", "evening", "anytime"], "anytime");
  fields.privacyConsent = checked(own(source, "privacyConsent"));
  return { fields, rooms: countMap(own(data, "rooms"), ROOMS, 20), inventory: countMap(own(data, "inventory"), ITEMS, 99) };
}

export function getInventoryTotals(rooms = {}, inventory = {}) {
  const normalizedRooms = countMap(rooms, ROOMS, 20);
  const normalizedInventory = countMap(inventory, ITEMS, 99);
  const totals = ITEMS.reduce((sum, item) => {
    const quantity = normalizedInventory[item.id];
    sum.totalItems += quantity;
    sum.totalVolume += quantity * item.volume;
    sum.totalWeight += quantity * item.weightKg;
    if (item.special) sum.specialItems += quantity;
    return sum;
  }, { totalItems: 0, totalRooms: Object.values(normalizedRooms).reduce((sum, value) => sum + value, 0), totalVolume: 0, totalWeight: 0, specialItems: 0 });
  return { ...totals, totalVolume: round(totals.totalVolume), totalWeight: round(totals.totalWeight) };
}

export function createRequest(data = {}, options = {}) {
  const draft = normalizeDraft(data);
  const id = options.id ?? newId();
  if (!validId(id, "MF")) throw new Error("La referencia de la solicitud no es válida.");
  return {
    version: 1, id, createdAt: timestamp(options.createdAt), status: "prepared", ...draft,
    totals: getInventoryTotals(draft.rooms, draft.inventory), offers: [], selectedOfferId: null,
  };
}

export function migrateLegacyDraft(data = {}) {
  const fields = record(data?.fields) ? { ...data.fields } : {};
  const legacyInventory = record(data?.inventory) ? data.inventory : {};
  const mapping = {
    boxes: "boxes-medium", glassware: "boxes-kitchen", sofa: "sofa-three", armchair: "armchair-single",
    bed: "bed-double", wardrobe: "wardrobe-large", diningTable: "table-six", diningChair: "chair-dining",
    refrigerator: "refrigerator-standard", washer: "washer-standard", tv: "tv-medium", desk: "desk-standard",
    bookcase: "bookcase-large", appliance: "appliance-microwave", decor: "decor-frames",
  };
  const inventory = { ...legacyInventory };
  for (const [oldId, newItemId] of Object.entries(mapping)) {
    if (Object.hasOwn(legacyInventory, oldId)) inventory[newItemId] = integer(legacyInventory[oldId]) + integer(inventory[newItemId]);
  }
  for (const endpoint of ["origin", "destination"]) {
    if (!fields[`${endpoint}Access`]) fields[`${endpoint}Access`] = checked(fields[`${endpoint}Elevator`]) ? "elevator" : "stairs";
    if (!fields[`${endpoint}CarryRange`] && fields[`${endpoint}CarryMeters`] !== undefined && fields[`${endpoint}CarryMeters`] !== "") {
      const meters = number(fields[`${endpoint}CarryMeters`]);
      fields[`${endpoint}CarryRange`] = meters <= 10 ? "0-10" : meters <= 20 ? "11-20" : meters <= 30 ? "21-30" : "over30";
    }
  }
  if (fields.packingType === "half") fields.packingType = "partial";
  if (integer(fields.boxPackage) > 0) { fields.packingType = "boxes"; fields.boxCount = fields.boxPackage; }
  if (!fields.hoistService && (number(fields.hoistUpFloors) > 0 || number(fields.hoistDownFloors) > 0)) fields.hoistService = "yes";
  if (Array.isArray(fields.services)) {
    if (fields.services.includes("packing") && (!fields.packingType || fields.packingType === "none")) fields.packingType = "full";
    if (fields.services.includes("assembly") && !number(fields.assemblyCount)) fields.assemblyCount = 5;
  }
  // La autorización anterior era para cotizar; se solicita de nuevo para compartir la ficha.
  fields.privacyConsent = false;
  return normalizeDraft({ fields, rooms: record(data?.rooms) ? data.rooms : {}, inventory });
}

const yesNoLabels = { yes: "Sí", no: "No", unknown: "Por confirmar" };
const packingLabels = { none: "Sin servicio de empaque", partial: "Empaque parcial", full: "Empaque completo", boxes: "Empaque de cajas", undecided: "Por definir con el asesor" };
const contactLabels = { whatsapp: "WhatsApp / mensaje", call: "Llamada", either: "Llamada o mensaje" };
const windowLabels = { morning: "Mañana", afternoon: "Tarde", evening: "Noche", anytime: "Cualquier horario" };
const numeric = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

/** Ficha para compartir por voluntad del cliente; excluye ofertas, precios y datos internos. */
export function buildRequestText(request) {
  const { fields, rooms, inventory } = normalizeDraft(request);
  const totals = getInventoryTotals(rooms, inventory);
  const lines = [
    "SOLICITUD DE MUDANZA", `Referencia: ${text(request?.id, 90) || "Por asignar"}`,
    "El precio y las condiciones se acuerdan directamente por llamada o mensaje.", "",
    `Tipo: ${fields.routeType === "local" ? "Local" : `Foráneo · ${{ direct: "Directo", shared: "Compartido", undecided: "Modalidad por definir" }[fields.foraneoMode]}`}`,
    `Fecha: ${fields.moveDate || "Por confirmar"} · ${fields.dateFlexibility === "exact" ? "Fecha exacta" : "Fecha flexible"}`,
  ];
  if (fields.distanceKm !== "") lines.push(`Distancia informada: ${numeric.format(fields.distanceKm)} km (por confirmar con la empresa)`);
  for (const [endpoint, label] of [["origin", "ORIGEN"], ["destination", "DESTINO"]]) {
    const floor = fields[`${endpoint}Floor`];
    const access = fields[`${endpoint}Access`];
    const carryRange = fields[`${endpoint}CarryRange`];
    lines.push("", label, fields[endpoint] || "Domicilio por confirmar",
      `Inmueble: ${propertyLabel(fields, endpoint)}`,
      `Nivel: ${floor === 0 ? "PB" : `Piso ${floor}`} · Acceso: ${ACCESS_TYPES[access]}`);
    if (access === "combined") lines.push(`Acceso combinado: ${fields[`${endpoint}ElevatorFloors`]} niveles con elevador y ${floor - fields[`${endpoint}ElevatorFloors`]} por escaleras`);
    lines.push(`Acarreo: ${CARRY_RANGES[carryRange]}${carryRange === "over30" && fields[`${endpoint}CarryMeters`] !== "" ? ` (${numeric.format(fields[`${endpoint}CarryMeters`])} m informados)` : ""}`,
      `Traspaleo en ${endpoint === "origin" ? "origen" : "destino"}: ${yesNoLabels[fields[`${endpoint}Shuttle`]]}`);
  }
  for (const [index, stop] of (fields.additionalDestinations || []).entries()) {
    lines.push("", `DESTINO ${index + 2} · DESPUÉS DEL DESTINO ANTERIOR`, stop.address || "Domicilio por confirmar");
    if (stop.notes) lines.push(`Indicaciones: ${stop.notes}`);
    lines.push("El equipo confirma el acceso y las maniobras de esta parada.");
  }
  lines.push("", `HABITACIONES AMUEBLADAS (${totals.totalRooms})`);
  const selectedRooms = ROOMS.filter((room) => rooms[room.id] > 0);
  lines.push(...(selectedRooms.length ? selectedRooms.map((room) => `• ${room.label}: ${rooms[room.id]}`) : ["Por confirmar"]));
  lines.push("", `INVENTARIO (${totals.totalItems} artículos)`);
  const selectedItems = ITEMS.filter((item) => inventory[item.id] > 0);
  lines.push(...(selectedItems.length ? selectedItems.map((item) => `• ${inventory[item.id]} × ${item.name}${item.special ? " · MANEJO ESPECIAL" : ""}`) : ["Por confirmar"]));
  lines.push(`Volumen y peso orientativos del inventario: ${numeric.format(totals.totalVolume)} m³ · ${numeric.format(totals.totalWeight)} kg.`,
    "Estas medidas no incluyen artículos descritos solo en notas y requieren revisión de la empresa.");
  if (fields.customItems) lines.push(`Otros artículos: ${fields.customItems}`);
  if (fields.specialNotes) lines.push(`Indicaciones para muebles especiales: ${fields.specialNotes}`);
  lines.push("", "SERVICIOS A REVISAR", `Empaque: ${packingLabels[fields.packingType]}`);
  if (["boxes", "partial", "full"].includes(fields.packingType)) lines.push(`Cajas por empacar: ${fields.boxCount || "Por confirmar"}`);
  if (fields.packingType === "none") lines.push("No se recogen artículos sueltos: entregar cajas cerradas y muebles preparados según la guía de empaque.", `Condición de empaque leída: ${fields.packingAcknowledged ? "Sí" : "Pendiente"}`);
  lines.push(`Volados por fachada: ${yesNoLabels[fields.hoistService]}`);
  if (fields.hoistService === "yes") lines.push(`Volados: subida ${fields.hoistUpFloors} pisos; bajada ${fields.hoistDownFloors} pisos (maniobra y viabilidad por confirmar)`);
  lines.push(`Traspaleo solicitado: ${yesNoLabels[fields.shuttleService]} (la empresa confirma si es necesario)`);
  lines.push(`Desmontaje / montaje: ${fields.assemblyCount ? `${fields.assemblyCount} muebles` : "No solicitado"}`,
    `Almacenaje: ${fields.storageDays ? `${fields.storageDays} días` : "No solicitado"}`,
    `Cargadores adicionales solicitados: ${fields.extraLoaders || "Ninguno"}`);
  if (fields.notes) lines.push(`Notas: ${fields.notes}`);
  lines.push("", "CONTACTO", `Nombre: ${fields.customerName || "Por confirmar"}`, `Teléfono: ${fields.phone || "Por confirmar"}`);
  if (fields.email) lines.push(`Correo: ${fields.email}`);
  lines.push(`Preferencia: ${contactLabels[fields.contactMethod]} · ${windowLabels[fields.contactWindow]}`,
    `Autorización para contacto sobre esta solicitud: ${fields.privacyConsent ? "Sí" : "Pendiente"}`,
    "La ficha se comparte únicamente cuando el cliente la envía. No constituye una reserva ni una cotización.");
  return lines.join("\n");
}

function normalizedOffer(data, { preserveId = false } = {}) {
  if (!record(data)) throw new Error("La oferta no tiene un formato válido.");
  const company = text(data.company, 120);
  const amount = optionalNumber(data.amount, 100000001);
  if (!company) throw new Error("Escribe el nombre de la empresa o vendedor.");
  if (amount === "" || amount < 1 || amount > 100000000) throw new Error("El importe de la oferta debe ser entre 1 y 100,000,000 MXN.");
  const id = preserveId ? data.id : newId("OF");
  if (!validId(id, "OF")) throw new Error("La referencia de la oferta no es válida.");
  if (preserveId && typeof data.createdAt !== "string") throw new Error("Falta la fecha de la propuesta importada.");
  return { id, company, amount: round(amount), contact: text(data.contact, 200), notes: text(data.notes, 2000), createdAt: timestamp(data.createdAt) };
}

/** Valida registros/importaciones y recalcula los totales; nunca confía en totales externos. */
export function restoreRequest(data) {
  if (!record(data) || data.version !== 1 || !validId(data.id, "MF") || !record(data.fields) || !record(data.rooms) || !record(data.inventory) || !Array.isArray(data.offers) || typeof data.createdAt !== "string") {
    throw new Error("El archivo no contiene una solicitud MoveFlow válida (versión 1).");
  }
  const status = choice(data.status === "reviewing" ? "negotiating" : data.status, ["prepared", "contacted", "negotiating", "agreed"], "");
  if (!status) throw new Error("El estado de la solicitud no es válido.");
  if (data.offers.length > 100) throw new Error("Una solicitud admite como máximo 100 ofertas.");
  const offers = data.offers.map((offer) => normalizedOffer(offer, { preserveId: true }));
  if (new Set(offers.map((offer) => offer.id)).size !== offers.length) throw new Error("Hay ofertas con referencias duplicadas.");
  const selectedOfferId = data.selectedOfferId ?? null;
  if (selectedOfferId !== null && !offers.some((offer) => offer.id === selectedOfferId)) throw new Error("La oferta elegida no pertenece a esta solicitud.");
  if ((status === "agreed") !== (selectedOfferId !== null)) throw new Error("La selección de oferta y el estado de la solicitud no coinciden.");
  return { ...createRequest(data, { id: data.id, createdAt: data.createdAt }), status, offers, selectedOfferId };
}

export function addOffer(request, data) {
  const current = restoreRequest(request);
  if (current.offers.length >= 100) throw new Error("Esta solicitud ya tiene el máximo de 100 ofertas.");
  const offer = normalizedOffer(data);
  return { ...current, offers: [...current.offers, offer], status: current.selectedOfferId ? "agreed" : "negotiating" };
}

export function selectOffer(request, offerId) {
  const current = restoreRequest(request);
  if (!current.offers.some((offer) => offer.id === offerId)) throw new Error("Selecciona una oferta que pertenezca a esta solicitud.");
  return { ...current, selectedOfferId: offerId, status: "agreed" };
}
