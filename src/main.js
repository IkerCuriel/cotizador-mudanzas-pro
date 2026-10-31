import { ROOMS, FURNITURE, ITEMS, ACCESS_TYPES, CARRY_RANGES } from "./catalog.js";
import { createRequest, normalizeDraft, migrateLegacyDraft, buildRequestText, propertyLabel, routeText } from "./request.js";
import { saveRequest, loadRequests } from "./storage.js";
import { buildBusinessWhatsAppUrl } from "./config.js";
import { isCloudConfigured, getSession, getPublicSettings, submitBusinessRequest, accountUrl, cloudErrorMessage } from "./cloud.js";
import { LEGAL_READY } from "./legal-config.js";
import { setupLocationMaps } from "./maps.js";
import { createSubmissionLifecycle, clearStoredDraft, ACTIVE_DRAFT_KEY, LEGACY_DRAFT_KEY } from "./submission-lifecycle.js";

const DRAFT_KEY = ACTIVE_DRAFT_KEY;
const LEGACY_KEY = LEGACY_DRAFT_KEY;
const form = document.getElementById("movingQuoteForm");
const modal = document.getElementById("quoteModal");
const locationMaps = setupLocationMaps();
const submissions = createSubmissionLifecycle();
let receiptElement;
const state = { step: 1, rooms: {}, inventory: {}, activeRoom: "all", variants: {}, request: null, prepared: null, draftWarning: "" };
const emptyCounts = (items) => Object.fromEntries(items.map((item) => [item.id, 0]));
const valueOf = (id) => document.getElementById(id)?.value ?? "";
const checked = (id) => document.getElementById(id)?.checked === true;
const packingLabels = { none: "El cliente empaca", partial: "Empaque parcial", full: "Empaque completo", boxes: "Empaque de cajas", undecided: "Empaque por definir con el equipo" };
const contactLabels = { whatsapp: "WhatsApp", call: "Llamada", either: "Llamada o WhatsApp" };
const windowLabels = { anytime: "Cualquier horario", morning: "Mañana", afternoon: "Tarde", evening: "Noche" };
const answerLabels = { yes: "Sí", no: "No", unknown: "Por confirmar" };
let modalTrigger;
let preparedShareMessage = "";
let cloudState = { session: null, settings: null, sending: false };

function text(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
function renderBusinessContact() {
  document.querySelectorAll("[data-business-whatsapp]").forEach((link) => {
    link.href = buildBusinessWhatsAppUrl();
  });
}
function updateBusinessShare() {
  const share = document.getElementById("shareWhatsApp");
  share.href = buildBusinessWhatsAppUrl(preparedShareMessage);
  text("shareFeedback", "Revisa el mensaje en WhatsApp y pulsa Enviar para que el negocio lo reciba.");
}
function collectDraft() {
  const fields = Object.fromEntries(new FormData(form));
  fields.privacyConsent = checked("privacyConsent");
  fields.packingAcknowledged = checked("packingAcknowledged");
  Object.assign(fields, locationMaps.collect());
  return { fields, rooms: state.rooms, inventory: state.inventory };
}
function setConditional(id, visible) {
  const container = document.getElementById(id);
  if (!container) return;
  container.hidden = !visible;
  container.classList.toggle("is-hidden", !visible);
  container.querySelectorAll("input, select, textarea").forEach((field) => { field.disabled = !visible; });
}
function syncConditions() {
  setConditional("foraneoFields", valueOf("routeType") === "outOfTown");
  const otherProperty = valueOf("originProperty") === "other";
  setConditional("originPropertyOtherField", otherProperty);
  const propertyDescription = document.getElementById("originPropertyOther");
  propertyDescription.required = otherProperty;
  if (!otherProperty) { propertyDescription.value = ""; setError(propertyDescription); }
  for (const side of ["origin", "destination"]) {
    const floor = Number(valueOf(`${side}Floor`));
    const access = document.getElementById(`${side}Access`);
    if (floor === 0) { access.value = "ground"; access.disabled = true; }
    else {
      access.disabled = false;
      if (access.value === "ground") access.value = "stairs";
    }
    const combined = floor > 0 && access.value === "combined";
    setConditional(`${side}CombinedFields`, combined);
    document.getElementById(`${side}ElevatorFloors`).max = String(Math.max(0, floor || 0));
    setConditional(`${side}CarryFields`, valueOf(`${side}CarryRange`) === "over30");
  }
  setConditional("boxFields", ["boxes", "partial", "full"].includes(valueOf("packingType")));
  const ownPacking = valueOf("packingType") === "none";
  setConditional("packingNotice", ownPacking);
  document.getElementById("packingAcknowledged").required = ownPacking;
  setConditional("hoistFields", valueOf("hoistService") === "yes");
}
function renderRooms() {
  document.getElementById("roomGrid").innerHTML = ROOMS.map((room) => `
    <article class="room-card" data-room-card="${room.id}">
      <button class="room-card__view" type="button" data-room-view="${room.id}" aria-label="Ver muebles de ${room.label}"><span aria-hidden="true">${room.icon}</span><strong>${room.label}</strong></button>
      <div class="quantity-control" aria-label="Número de ${room.label}">
        <button type="button" data-room-action="decrease" data-room-id="${room.id}" aria-label="Quitar ${room.label}">−</button>
        <output id="room-${room.id}" aria-live="polite">0</output>
        <button type="button" data-room-action="increase" data-room-id="${room.id}" aria-label="Agregar ${room.label}">+</button>
      </div>
    </article>`).join("");
  document.getElementById("roomTabs").innerHTML = [{ id: "all", label: "Todos los muebles" }, ...ROOMS, { id: "special", label: "Muebles especiales" }]
    .map((room) => `<button type="button" class="room-tab" data-room-view="${room.id}" aria-pressed="${state.activeRoom === room.id}">${room.label}</button>`).join("");
  updateRoomUI();
}
function updateRoomUI() {
  ROOMS.forEach((room) => {
    const count = state.rooms[room.id] || 0;
    document.getElementById(`room-${room.id}`).value = count;
    const card = document.querySelector(`[data-room-card="${room.id}"]`);
    card.classList.toggle("is-selected", count > 0);
    card.querySelector('[data-room-action="decrease"]').disabled = count === 0;
    card.querySelector('[data-room-action="increase"]').disabled = count >= 20;
  });
  document.querySelectorAll("[data-room-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.roomView === state.activeRoom)));
  const count = ROOMS.reduce((sum, room) => sum + (state.rooms[room.id] || 0), 0);
  text("roomCountLabel", `${count} ${count === 1 ? "habitación / espacio" : "habitaciones / espacios"}`);
}
function normalizedSearch(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function renderInventory() {
  const search = normalizedSearch(valueOf("inventorySearch").trim());
  const groups = FURNITURE.filter((group) => {
    const inRoom = state.activeRoom === "all" || (state.activeRoom === "special" ? group.variants.some((item) => item.special) : group.roomIds.includes(state.activeRoom));
    return inRoom && (!search || normalizedSearch([group.name, ...group.variants.map((item) => item.name)].join(" ")).includes(search));
  });
  document.getElementById("inventoryGrid").innerHTML = groups.length ? groups.map((group) => {
    const variant = group.variants.find((item) => item.id === state.variants[group.id]) ?? group.variants[0];
    state.variants[group.id] = variant.id;
    return `<article class="inventory-item" data-group-id="${group.id}">
      <span class="inventory-item__icon" aria-hidden="true">${group.icon}</span>
      <div class="inventory-item__meta"><strong>${group.name}</strong>
        <label class="variant-selector"><span class="sr-only">Tipo de ${group.name}</span><select data-variant-group="${group.id}" aria-label="Tipo de ${group.name}">${group.variants.map((item) => `<option value="${item.id}"${item.id === variant.id ? " selected" : ""}>${item.name}</option>`).join("")}</select></label>
        ${variant.special ? '<small>Requiere revisión del equipo</small>' : ""}
      </div>
      <div class="quantity-control" aria-label="Cantidad de ${variant.name}">
        <button type="button" data-quantity-action="decrease" data-item-id="${variant.id}" aria-label="Disminuir ${variant.name}">−</button>
        <output data-quantity-for="${variant.id}" aria-live="polite">0</output>
        <button type="button" data-quantity-action="increase" data-item-id="${variant.id}" aria-label="Aumentar ${variant.name}">+</button>
      </div></article>`;
  }).join("") : '<p class="empty-state">No hay coincidencias en esta categoría. Prueba en «Todos los muebles» o descríbelo en otros artículos.</p>';
  updateInventoryUI();
}
function updateInventoryUI() {
  document.querySelectorAll("[data-quantity-for]").forEach((output) => { output.value = state.inventory[output.dataset.quantityFor] || 0; });
  document.querySelectorAll("[data-quantity-action]").forEach((button) => {
    const count = state.inventory[button.dataset.itemId] || 0;
    button.disabled = button.dataset.quantityAction === "decrease" ? count === 0 : count >= 99;
  });
  document.querySelectorAll("[data-group-id]").forEach((card) => {
    const group = FURNITURE.find((entry) => entry.id === card.dataset.groupId);
    card.classList.toggle("has-quantity", group.variants.some((item) => state.inventory[item.id] > 0));
  });
  const selected = ITEMS.filter((item) => state.inventory[item.id] > 0);
  const count = selected.reduce((sum, item) => sum + state.inventory[item.id], 0);
  text("itemCountLabel", `${count} ${count === 1 ? "artículo seleccionado" : "artículos seleccionados"}`);
  document.getElementById("selectedInventory").innerHTML = selected.length ? selected.map((item) => `<div class="selected-inventory-row"><span><strong>${state.inventory[item.id]} ×</strong> ${item.name}${item.special ? ' <small>Especial</small>' : ""}</span><button type="button" class="text-button" data-remove-item="${item.id}" aria-label="Quitar todos: ${item.name}">Quitar</button></div>`).join("") : '<p class="empty-state">Tus muebles aparecerán aquí. Puedes agregar distintos tamaños del mismo tipo.</p>';
  if (count || valueOf("customItems").trim()) text("inventoryError", "");
}
function accessText(fields, side) {
  const floor = Number(fields[`${side}Floor`]) || 0;
  const access = fields[`${side}Access`] || "ground";
  const combined = access === "combined" ? ` (${fields[`${side}ElevatorFloors`] || 0} pisos por elevador, ${Math.max(0, floor - Number(fields[`${side}ElevatorFloors`] || 0))} por escaleras)` : "";
  const carry = fields[`${side}CarryRange`] === "over30" && fields[`${side}CarryMeters`] ? `${fields[`${side}CarryMeters`]} m` : CARRY_RANGES[fields[`${side}CarryRange`]] || "Por confirmar";
  return `${propertyLabel(fields, side)} · ${floor === 0 ? "PB" : `Piso ${floor}`} · ${ACCESS_TYPES[access] || "Por confirmar"}${combined}. Acarreo: ${carry}. Traspaleo: ${answerLabels[fields[`${side}Shuttle`]] || "Por confirmar"}.`;
}
function modeText(fields) {
  if (fields.routeType !== "outOfTown") return "Local";
  return `Foránea · ${{ direct: "Directa", shared: "Compartida", undecided: "Modalidad por definir" }[fields.foraneoMode] || "Modalidad por definir"}`;
}
function servicesText(fields) {
  const services = [packingLabels[fields.packingType] || packingLabels.undecided];
  if (Number(fields.boxCount)) services.push(`${fields.boxCount} cajas por empacar`);
  if (fields.hoistService === "yes") services.push(`Volados: ${fields.hoistUpFloors || 0} pisos de subida y ${fields.hoistDownFloors || 0} de bajada`);
  else if (fields.hoistService === "unknown") services.push("Volados por confirmar");
  services.push(`Traspaleo: ${answerLabels[fields.shuttleService] || "Por confirmar"}`);
  if (Number(fields.assemblyCount)) services.push(`Desmontaje / montaje: ${fields.assemblyCount} muebles`);
  if (Number(fields.storageDays)) services.push(`Bodega: ${fields.storageDays} días`);
  if (Number(fields.extraLoaders)) services.push(`${fields.extraLoaders} cargadores adicionales solicitados`);
  return services.join(" · ");
}
function summaryEntries(request) {
  const f = request.fields;
  return [
    ["Ruta", routeText(f, { origin: "Origen por definir", destination: "Destino por definir" })],
    ...(f.additionalDestinations || []).map((stop, index) => [`Destino ${index + 2}`, `${stop.address || "Por completar"}${stop.notes ? ` · ${stop.notes}` : ""}`]),
    ["Tipo de mudanza", modeText(f)],
    ["Fecha", `${f.moveDate || "Por definir"}${f.dateFlexibility === "flexible" ? " · Flexible" : " · Fecha solicitada"}`],
    ...(f.distanceKm ? [["Distancia aproximada", `${f.distanceKm} km`]] : []),
    ["Acceso en origen", accessText(f, "origin")], ["Acceso en destino", accessText(f, "destination")],
    ["Servicios", servicesText(f)],
    ["Contacto", `${f.customerName || "Nombre por completar"} · ${f.phone || "Teléfono por completar"}${f.email ? ` · ${f.email}` : ""}`],
    ["Preferencia de contacto", `${contactLabels[f.contactMethod] || "Por definir"} · ${windowLabels[f.contactWindow] || "Por definir"}`],
    ...[["Otros artículos", f.customItems], ["Muebles especiales", f.specialNotes], ["Indicaciones", f.notes]].filter(([, value]) => value),
  ];
}
function entriesHtml(entries) { return entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join(""); }
function inventoryHtml(request) {
  const rooms = ROOMS.filter((room) => request.rooms[room.id] > 0).map((room) => `${request.rooms[room.id]} × ${room.label}`).join(" · ");
  const items = ITEMS.filter((item) => request.inventory[item.id] > 0);
  return `<p><strong>Habitaciones:</strong> ${escapeHtml(rooms || "Por confirmar con el cliente")}</p><ul>${items.map((item) => `<li>${request.inventory[item.id]} × ${item.name}${item.special ? " · Revisión especial" : ""}</li>`).join("")}</ul>${!items.length ? '<p>Consulta los artículos descritos en la solicitud.</p>' : ""}`;
}
function refresh() {
  syncConditions();
  locationMaps.update();
  const draft = collectDraft();
  const request = createRequest(draft, { id: "MF-BORRADOR", createdAt: new Date().toISOString() });
  const f = request.fields;
  text("summaryRoute", routeText(f));
  text("summaryMode", modeText(f));
  text("summaryRooms", String(request.totals.totalRooms));
  text("summaryItems", String(request.totals.totalItems));
  text("summaryServices", servicesText(f));
  document.getElementById("reviewSummary").innerHTML = entriesHtml(summaryEntries(request)) + `<div><dt>Habitaciones e inventario</dt><dd>${inventoryHtml(request)}</dd></div>`;
  const warnings = [];
  if (ITEMS.some((item) => item.special && state.inventory[item.id] > 0)) warnings.push("Los muebles especiales requieren confirmar medidas, peso, maniobras y viabilidad con el equipo.");
  if (f.hoistService !== "no" || f.shuttleService !== "no" || ["origin", "destination"].some((side) => f[`${side}Shuttle`] !== "no")) warnings.push("El equipo validará los volados y el traspaleo. La distancia de acarreo por sí sola no confirma estas maniobras.");
  if (f.customItems) warnings.push("Los artículos escritos en notas se revisarán con el equipo; no están incluidos en el contador de muebles.");
  const warningElement = document.getElementById("requestWarnings");
  warningElement.hidden = !warnings.length;
  warningElement.innerHTML = warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("");
  persistDraft(draft);
}
function persistDraft(draft = collectDraft()) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, ...draft, prepared: state.prepared }));
    text("draftFeedback", state.draftWarning || "Borrador guardado en este navegador.");
  } catch { text("draftFeedback", "No se pudo guardar el borrador en este navegador. Puedes completar y descargar la ficha."); }
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const legacy = raw ? null : localStorage.getItem(LEGACY_KEY);
    if (!raw && !legacy) return;
    const source = JSON.parse(raw || legacy);
    // A prior handoff retired this draft even if a quota error prevented rewriting it.
    if (raw && submissions.retiredDraft(source.prepared?.id)) { clearStoredDraft(localStorage); return; }
    const draft = raw ? normalizeDraft(source) : migrateLegacyDraft(source);
    state.rooms = { ...emptyCounts(ROOMS), ...draft.rooms };
    state.inventory = { ...emptyCounts(ITEMS), ...draft.inventory };
    if (raw && source.prepared?.id && typeof source.prepared.fingerprint === "string") state.prepared = source.prepared;
    Object.entries(draft.fields).forEach(([name, value]) => {
      if (["privacyConsent", "packingAcknowledged"].includes(name)) return;
      const field = form.elements.namedItem(name);
      if (!field?.tagName) return;
      if (field.type === "checkbox") field.checked = value === true;
      else if (field.tagName === "SELECT") {
        if ([...field.options].some((option) => option.value === String(value))) field.value = value;
      } else field.value = value ?? "";
    });
    locationMaps.restore(draft.fields);
    if (legacy) state.draftWarning = "Recuperamos los datos del cotizador anterior. Revisa las variantes de muebles y los accesos; ahora se prepara una solicitud sin precio automático.";
  } catch { state.draftWarning = "No se pudo recuperar el borrador anterior. Puedes iniciar una nueva solicitud."; }
}
function setDefaultDate() {
  const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = new Date();
  document.getElementById("moveDate").min = dateString(today);
  // El cliente elige la fecha; no se presupone disponibilidad.
}
function setError(field, message = "") {
  if (!field.id) return;
  const container = field.closest(".field, .compact-field, .consent-field");
  let error = document.querySelector(`[data-error-for="${field.id}"]`);
  if (!error && message && container) {
    error = document.createElement("small"); error.className = "field-error"; error.dataset.errorFor = field.id; container.appendChild(error);
  }
  field.setAttribute("aria-invalid", String(Boolean(message)));
  container?.classList.toggle("has-error", Boolean(message));
  if (error) {
    error.id = `error-${field.id}`; error.textContent = message;
    field.setAttribute("aria-describedby", [...new Set(`${field.getAttribute("aria-describedby") || ""} ${error.id}`.trim().split(/\s+/))].join(" "));
  }
}
function validateStep(step) {
  const current = document.querySelector(`.form-step[data-step="${step}"]`);
  let valid = true;
  current.querySelectorAll("input, select, textarea").forEach((field) => {
    if (field.disabled) { setError(field); return; }
    let error = "";
    if (field.type === "checkbox") { if (field.required && !field.checked) error = "Confirma esta condición para continuar."; }
    else if (field.required && !field.value.trim()) error = "Completa este campo para continuar.";
    else if (field.type === "text" && field.value && field.minLength > 0 && field.value.trim().length < field.minLength) error = `Escribe al menos ${field.minLength} caracteres para ubicar la dirección.`;
    else if (field.type === "number" && field.validity.badInput) error = "Ingresa un número completo y válido.";
    else if (field.type === "number" && field.value && !field.validity.valid) error = `Usa un número entero entre ${field.min || 0} y ${field.max}.`;
    else if (field.type === "date" && field.value && !field.validity.valid) error = "Elige una fecha de hoy en adelante.";
    else if (field.id === "phone" && (field.value.replace(/\D/g, "").length < 10 || field.value.replace(/\D/g, "").length > 15)) error = "Ingresa un teléfono de 10 a 15 dígitos, incluyendo lada si corresponde.";
    else if (field.type === "email" && field.value && !field.validity.valid) error = "Ingresa un correo válido o deja este campo vacío.";
    setError(field, error); if (error) valid = false;
  });
  if (step === 2 && !ITEMS.some((item) => state.inventory[item.id] > 0) && !valueOf("customItems").trim()) {
    text("inventoryError", "Agrega al menos un artículo o describe los muebles que necesitas transportar."); valid = false;
  }
  return valid;
}
function focusError(step) {
  const field = document.querySelector(`.form-step[data-step="${step}"] [aria-invalid="true"]`);
  if (field) field.focus();
  else if (step === 2) { const error = document.getElementById("inventoryError"); error.tabIndex = -1; error.focus(); }
}
function showStep(step, scroll = true) {
  state.step = Math.max(1, Math.min(4, step));
  document.querySelectorAll(".form-step").forEach((section) => section.classList.toggle("is-active", Number(section.dataset.step) === state.step));
  document.querySelectorAll("[data-go-step]").forEach((button) => {
    const active = Number(button.dataset.goStep) === state.step;
    button.classList.toggle("is-active", active); button.classList.toggle("is-complete", Number(button.dataset.goStep) < state.step);
    if (active) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
  });
  document.getElementById("prevStep").classList.toggle("is-hidden", state.step === 1);
  document.getElementById("nextStep").classList.toggle("is-hidden", state.step === 4);
  document.getElementById("submitQuote").classList.toggle("is-hidden", state.step !== 4);
  refresh();
  if (scroll) document.querySelector(".quote-card").scrollIntoView({ block: "start", behavior: "instant" });
}
function navigateTo(target) {
  if (target > state.step) for (let step = 1; step < target; step++) {
    if (!validateStep(step)) { showStep(step); focusError(step); return; }
  }
  showStep(target);
}
function resetDraft() {
  form.reset(); state.rooms = emptyCounts(ROOMS); state.inventory = emptyCounts(ITEMS); state.prepared = null; state.request = null; state.draftWarning = ""; state.activeRoom = "all"; state.variants = {};
  locationMaps.reset();
  document.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach((field) => setError(field));
  renderRooms(); renderInventory(); setDefaultDate(); showStep(1);
}
function draftFingerprint(draft) {
  const normalized = normalizeDraft(draft);
  return JSON.stringify({ ...normalized, fields: { ...normalized.fields, privacyConsent: true, packingAcknowledged: normalized.fields.packingType === "none" } });
}
function prepareRequest() {
  const draft = collectDraft();
  // Consentimientos se validan siempre, pero no cambian la identidad de una ficha ya preparada.
  const fingerprint = draftFingerprint(draft);
  let request;
  let storageError = "";
  try {
    if (state.prepared?.fingerprint === fingerprint) {
      request = state.request?.id === state.prepared.id ? state.request : loadRequests().find((entry) => entry.id === state.prepared.id && draftFingerprint(entry) === fingerprint);
    }
  } catch (error) { storageError = error.message; }
  request ??= createRequest(draft);
  state.prepared = { id: request.id, fingerprint };
  try { saveRequest(request); }
  catch (error) { storageError = error.message; }
  persistDraft(draft);
  openPreparedRequest(request, { storageError });
}

function openPreparedRequest(request, { storageError = "", receiptMode = false } = {}) {
  state.request = request;
  text("modalTitle", receiptMode ? "Tu ficha anterior" : "Solicitud preparada");
  text("requestReference", request.id);
  document.getElementById("modalSummary").innerHTML = entriesHtml(summaryEntries(request));
  document.getElementById("modalInventory").innerHTML = inventoryHtml(request);
  text("submissionStatus", storageError ? `Ficha preparada, pero no guardada: ${storageError}. Descárgala o cópiala. No se ha enviado al negocio.` : "Ficha guardada en este navegador. Revisa los detalles y elige cómo enviarla al equipo. Prepararla aquí no la envía.");
  if (receiptMode) text("submissionStatus", submissions.wasCloudSubmitted(request.id) ? "Esta solicitud ya se guardó en tu cuenta. Puedes consultar o volver a compartir esta misma ficha." : "Esta es la ficha que abriste para WhatsApp. Puedes volver a enviarla con la misma referencia; la web no confirma si el mensaje se envió.");
  const fullMessage = buildRequestText(request);
  const shortMessage = `SOLICITUD DE MUDANZA · ${request.id}\n${summaryEntries(request).filter(([label]) => ["Ruta", "Tipo de mudanza", "Fecha", "Contacto", "Preferencia de contacto"].includes(label)).map(([label, value]) => `${label}: ${value}`).join("\n")}\nInventario: ${request.totals.totalItems} artículos.\nMe gustaría que revisaran mi mudanza para acordar una propuesta. Compartiré la ficha completa por este chat.`;
  preparedShareMessage = fullMessage.length > 6000 ? shortMessage : fullMessage;
  updateBusinessShare();
  text("shareFeedback", "");
  document.querySelector(".prepared-details").open = false;
  if (fullMessage.length > 6000) text("submissionStatus", `${document.getElementById("submissionStatus").textContent} El mensaje se resumió por su extensión; comparte también la ficha completa con Copiar o Descargar.`);
  text("copyFeedback", "");
  text("cloudSendStatus", "");
  updateCloudControls();
  modalTrigger = document.activeElement;
  modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
  document.querySelector(".page-shell").inert = true; document.body.style.overflow = "hidden";
  document.getElementById("closeModal").focus();
}

function updateCloudControls() {
  const ready = isCloudConfigured && LEGAL_READY && cloudState.settings?.accepting_requests === true && cloudState.settings?.business_routing_version === 1 && cloudState.settings?.route_destinations_version === 1;
  const loggedIn = Boolean(cloudState.session);
  const authLink = document.getElementById("requestAccountLink");
  authLink.href = loggedIn ? "./panel.html" : accountUrl("index.html#retomar");
  authLink.textContent = loggedIn ? "Ver mi cuenta" : "Entrar o crear mi cuenta";
  text("requestAccountStatus", !ready ? "Estamos preparando las cuentas. Por ahora puedes compartir tu ficha con Mudanzas D’Curiel por WhatsApp; ese mensaje no se guarda en el panel." : loggedIn ? "Tu sesión está activa. Revisa la ficha y pulsa «Guardar y enviar a D’Curiel» para verla en tu cuenta y en el panel del negocio." : "La cuenta es opcional para WhatsApp. Crea una cuenta gratuita si también quieres guardar tu solicitud y consultar su seguimiento en el panel.");
  document.getElementById("networkConsentField").hidden = true;
  document.getElementById("networkConsent").checked = false;
  const button = document.getElementById("sendCloudRequest");
  button.hidden = !ready;
  button.disabled = cloudState.sending || submissions.wasCloudSubmitted(state.request?.id);
  button.textContent = cloudState.sending ? "Enviando…" : submissions.wasCloudSubmitted(state.request?.id) ? "Solicitud guardada y enviada" : loggedIn ? "Guardar y enviar a D’Curiel" : "Entrar para guardar y enviar";
  text("cloudAvailability", ready ? "Guardar y enviar registra la solicitud en tu cuenta y avisa al equipo autorizado de D’Curiel en su panel. El botón de WhatsApp abre una conversación aparte." : "La recepción en el panel todavía no está activa. La ficha solo llega al negocio si tú la compartes por WhatsApp.");
}

async function loadCloudState() {
  try {
    const [session, settings] = await Promise.all([getSession(), getPublicSettings()]);
    cloudState = { ...cloudState, session, settings };
  } catch { cloudState.settings = null; }
  updateCloudControls();
}

function renderSubmissionReceipt() {
  const receipt = submissions.getReceipt();
  if (!receipt) return;
  if (!receiptElement) {
    receiptElement = document.createElement("section");
    receiptElement.className = "submission-receipt";
    receiptElement.id = "submissionReceipt";
    receiptElement.tabIndex = -1;
    receiptElement.setAttribute("aria-label", "Tu ficha anterior");
    receiptElement.setAttribute("role", "status");
    document.querySelector(".quote-card__header").after(receiptElement);
  }
  const heading = document.createElement("strong");
  heading.textContent = receipt.channel === "cloud" ? "Solicitud recibida por el negocio" : "Tu ficha está lista para WhatsApp";
  const reference = document.createElement("p"); reference.className = "submission-receipt__reference";
  reference.textContent = `Referencia: ${receipt.id}`;
  const description = document.createElement("p");
  description.textContent = receipt.channel === "cloud"
    ? "Puedes empezar otra solicitud. Si vuelves a compartir esta ficha, conservará su referencia para reconocer duplicados."
    : "Confirma el envío dentro de WhatsApp. Puedes empezar otra solicitud o volver a abrir esta ficha con la misma referencia.";
  const content = document.createElement("div"); content.className = "submission-receipt__content";
  content.append(heading, reference, description);
  const reopen = document.createElement("button"); reopen.type = "button"; reopen.className = "button button--secondary";
  reopen.id = "reopenLastRequest"; reopen.textContent = "Ver ficha anterior"; reopen.disabled = !receipt.recoverable;
  reopen.addEventListener("click", () => { const previous = submissions.getRequest(); if (previous) openPreparedRequest(previous, { receiptMode: true }); });
  receiptElement.replaceChildren(content, reopen);
  if (!receipt.persisted || !receipt.recoverable) {
    const warning = document.createElement("p"); warning.className = "submission-receipt__warning";
    warning.textContent = receipt.recoverable ? "La copia recuperable sigue abierta en esta página. Descárgala antes de cerrarla si tu navegador no permite guardar datos." : "La copia local de esta ficha no está disponible. Conserva el mensaje enviado o el archivo descargado.";
    content.append(warning);
  }
}

function completeSubmission(request, channel) {
  const modalOpen = modal.classList.contains("is-open");
  const showingThisRequest = state.request?.id === request.id && modalOpen;
  // A late response can retire draft A while the customer reviews receipt B.
  // Preserve the independently displayed snapshot and its existing share link.
  const otherDisplayedRequest = modalOpen && !showingThisRequest ? state.request : null;
  const result = submissions.complete(request, { channel, prepared: state.prepared, currentFingerprint: draftFingerprint(collectDraft()) });
  if (result.detachPrepared) state.prepared = null;
  if (result.clearDraft) {
    try { clearStoredDraft(localStorage); } catch { /* In-memory recovery remains available. */ }
    if (showingThisRequest) closeModal({ restoreFocus: false });
    resetDraft();
    if (otherDisplayedRequest) state.request = otherDisplayedRequest;
  } else {
    // An old request may finish after another draft has started. Never reset that draft.
    if (result.detachPrepared) persistDraft();
    if (showingThisRequest) closeModal();
  }
  renderSubmissionReceipt();
  if (otherDisplayedRequest && !modalTrigger?.isConnected) modalTrigger = document.getElementById("reopenLastRequest");
  if ((result.clearDraft || showingThisRequest) && !modal.classList.contains("is-open")) receiptElement?.focus({ preventScroll: true });
}

async function sendCloudRequest() {
  if (!state.request || cloudState.sending || submissions.wasCloudSubmitted(state.request.id)) return;
  if (!isCloudConfigured || !LEGAL_READY || !cloudState.settings?.accepting_requests || cloudState.settings?.business_routing_version !== 1 || cloudState.settings?.route_destinations_version !== 1) return;
  if (!cloudState.session) { window.location.href = accountUrl("index.html#retomar"); return; }
  const submittedRequest = state.request; // Capture before awaiting: another draft may be opened meanwhile.
  cloudState.sending = true;
  updateCloudControls();
  text("cloudSendStatus", "Enviando la solicitud…");
  try {
    const payload = { ...submittedRequest, fields: { ...submittedRequest.fields, networkConsent: false } };
    await submitBusinessRequest(payload);
    completeSubmission(submittedRequest, "cloud");
  } catch (error) {
    if (state.request?.id === submittedRequest.id) text("cloudSendStatus", cloudErrorMessage(error, "No pudimos confirmar la recepción. Tu formulario se conserva. Reintenta con esta misma ficha; no se duplicará si ya fue recibida."));
  } finally { cloudState.sending = false; updateCloudControls(); }
}
function closeModal({ restoreFocus = true } = {}) {
  modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
  document.querySelector(".page-shell").inert = false; document.body.style.overflow = "";
  if (restoreFocus && modalTrigger?.isConnected) modalTrigger.focus();
}

async function copyRequest() {
  if (!state.request) return;
  try {
    const message = buildRequestText(state.request);
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message);
    else {
      const input = document.createElement("textarea"); input.value = message; input.style.position = "fixed"; input.style.opacity = "0"; modal.appendChild(input); input.select();
      const copied = document.execCommand("copy"); input.remove(); if (!copied) throw new Error("No se pudo copiar");
    }
    text("copyFeedback", "Ficha copiada. Pégala en el mensaje que enviarás al negocio.");
  } catch { text("copyFeedback", "No se pudo copiar. Puedes descargar o imprimir la ficha."); }
}
function downloadRequest() {
  if (!state.request) return;
  const blob = new Blob([JSON.stringify(state.request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `solicitud-${state.request.id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  text("copyFeedback", "Archivo preparado para descargar. Se puede importar en el panel de pruebas del negocio.");
}

form.addEventListener("click", (event) => {
  const roomView = event.target.closest("[data-room-view]");
  if (roomView) { state.activeRoom = roomView.dataset.roomView; document.getElementById("inventorySearch").value = ""; updateRoomUI(); renderInventory(); return; }
  const roomAction = event.target.closest("[data-room-action]");
  if (roomAction) {
    const id = roomAction.dataset.roomId; const delta = roomAction.dataset.roomAction === "increase" ? 1 : -1;
    state.rooms[id] = Math.max(0, Math.min(20, (state.rooms[id] || 0) + delta));
    if (delta > 0) { state.activeRoom = id; renderInventory(); }
    updateRoomUI(); refresh(); return;
  }
  const quantity = event.target.closest("[data-quantity-action]");
  if (quantity) {
    const id = quantity.dataset.itemId; const delta = quantity.dataset.quantityAction === "increase" ? 1 : -1;
    state.inventory[id] = Math.max(0, Math.min(99, (state.inventory[id] || 0) + delta)); updateInventoryUI(); refresh(); return;
  }
  const remove = event.target.closest("[data-remove-item]");
  if (remove) { state.inventory[remove.dataset.removeItem] = 0; updateInventoryUI(); refresh(); }
});
form.addEventListener("input", (event) => {
  if (event.target.id === "inventorySearch") { renderInventory(); return; }
  setError(event.target); refresh();
});
form.addEventListener("change", (event) => {
  if (event.target.dataset.variantGroup) {
    state.variants[event.target.dataset.variantGroup] = event.target.value; renderInventory();
    document.querySelector(`[data-variant-group="${event.target.dataset.variantGroup}"]`)?.focus(); return;
  }
  setError(event.target); refresh();
});
document.getElementById("clearInventory").addEventListener("click", () => { state.inventory = emptyCounts(ITEMS); updateInventoryUI(); refresh(); });
document.getElementById("resetQuote").addEventListener("click", resetDraft);
document.getElementById("nextStep").addEventListener("click", () => navigateTo(state.step + 1));
document.getElementById("prevStep").addEventListener("click", () => navigateTo(state.step - 1));
document.querySelectorAll("[data-go-step]").forEach((button) => button.addEventListener("click", () => navigateTo(Number(button.dataset.goStep))));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  for (let step = 1; step <= 4; step++) if (!validateStep(step)) { showStep(step); focusError(step); return; }
  prepareRequest();
});
document.getElementById("closeModal").addEventListener("click", closeModal);
function handoffWhatsApp(event) {
  if (event.defaultPrevented || (event.type === "auxclick" && event.button !== 1) || !state.request) return;
  // Do not change the anchor href or prevent its native navigation. This is a handoff,
  // not proof of delivery; the customer still presses Send inside WhatsApp.
  completeSubmission(state.request, "whatsapp");
}
document.getElementById("shareWhatsApp").addEventListener("click", handoffWhatsApp);
document.getElementById("shareWhatsApp").addEventListener("auxclick", handoffWhatsApp);
document.getElementById("sendCloudRequest").addEventListener("click", sendCloudRequest);
document.getElementById("copyQuote").addEventListener("click", copyRequest);
document.getElementById("downloadRequest").addEventListener("click", downloadRequest);
document.getElementById("printQuote").addEventListener("click", () => {
  // Una ficha cerrada en <details> no se imprime en todos los navegadores.
  const details = document.querySelector(".prepared-details");
  const wasOpen = details.open; details.open = true;
  window.print(); details.open = wasOpen;
});
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (!modal.classList.contains("is-open")) return;
  if (event.key === "Escape") closeModal();
  if (event.key === "Tab") {
    const controls = [...modal.querySelectorAll("button, a[href], input, summary")].filter((control) => !control.disabled && control.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
});
state.rooms = emptyCounts(ROOMS); state.inventory = emptyCounts(ITEMS);
renderBusinessContact();
restoreDraft(); setDefaultDate(); renderRooms(); renderInventory(); showStep(1, false); renderSubmissionReceipt();
text("currentYear", String(new Date().getFullYear()));
if (location.hash === "#retomar") showStep(4);
loadCloudState();
