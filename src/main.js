const INVENTORY = [
  { id: "boxes", name: "Cajas medianas", detail: "0.10 m³ c/u", icon: "□", volume: 0.1, handling: 22 },
  { id: "glassware", name: "Vajilla y vasos", detail: "Caja de cocina / cristalería", icon: "◫", volume: 0.12, handling: 95 },
  { id: "sofa", name: "Sofá", detail: "2–3 plazas", icon: "▱", volume: 1.8, handling: 380 },
  { id: "armchair", name: "Sillón individual", detail: "1 plaza", icon: "▰", volume: 0.75, handling: 180 },
  { id: "bed", name: "Cama / colchón", detail: "Individual a king", icon: "▭", volume: 1.3, handling: 280 },
  { id: "wardrobe", name: "Ropero / clóset", detail: "Mueble grande", icon: "▥", volume: 1.6, handling: 360 },
  { id: "diningTable", name: "Mesa de comedor", detail: "4–8 personas", icon: "▦", volume: 1.2, handling: 260 },
  { id: "diningChair", name: "Silla de comedor", detail: "Por pieza", icon: "⌑", volume: 0.25, handling: 55 },
  { id: "refrigerator", name: "Refrigerador", detail: "Mediano o grande", icon: "▯", volume: 1.45, handling: 420 },
  { id: "washer", name: "Lavadora / secadora", detail: "Línea blanca", icon: "◉", volume: 0.85, handling: 320 },
  { id: "tv", name: "Televisión", detail: "Pantalla plana", icon: "▣", volume: 0.2, handling: 180 },
  { id: "desk", name: "Escritorio", detail: "Casa u oficina", icon: "⌨", volume: 0.85, handling: 210 },
  { id: "bookcase", name: "Librero / estante", detail: "Mueble vertical", icon: "▤", volume: 1.05, handling: 240 },
  { id: "appliance", name: "Electrodoméstico", detail: "Microondas, horno, etc.", icon: "◇", volume: 0.18, handling: 75 },
  { id: "decor", name: "Decoración / cuadros", detail: "Lote protegido", icon: "◫", volume: 0.14, handling: 70 },
];

const PRESETS = {
  mini: { boxes: 8, glassware: 1, bed: 1, tv: 1, desk: 1, decor: 2 },
  oneBedroom: { boxes: 18, glassware: 2, sofa: 1, bed: 1, diningTable: 1, diningChair: 4, refrigerator: 1, tv: 1, appliance: 3 },
  twoBedroom: { boxes: 32, glassware: 4, sofa: 1, armchair: 1, bed: 2, wardrobe: 1, diningTable: 1, diningChair: 6, refrigerator: 1, washer: 1, tv: 2, desk: 1, appliance: 5, decor: 4 },
  family: { boxes: 52, glassware: 7, sofa: 2, armchair: 2, bed: 3, wardrobe: 2, diningTable: 1, diningChair: 8, refrigerator: 1, washer: 2, tv: 3, desk: 2, bookcase: 2, appliance: 8, decor: 7 },
};

const SERVICE_LABELS = {
  packing: "Empaque profesional",
  assembly: "Desarmado y armado",
  fragile: "Manejo de frágiles",
  insurance: "Cobertura ampliada",
  longCarry: "Acarreo extendido",
  express: "Servicio prioritario",
};

// Ajusta aquí las tarifas comerciales sin tocar el flujo del formulario.
const PRICING = {
  minimumQuote: 1450,
  baseOperation: 920,
  distancePerKm: {
    local: 23,
    regional: 20,
    longDistance: 18,
  },
  volumePerM3: 145,
  accessPerFloor: {
    withoutElevator: 190,
    withElevator: 45,
  },
  services: {
    packingMinimum: 650,
    packingRate: 0.16,
    assembly: 550,
    fragile: 420,
    longCarry: 350,
    insuranceRate: 0.04,
    expressRate: 0.12,
  },
  protectionMultiplier: {
    standard: 1,
    plus: 1.055,
    premium: 1.11,
  },
  weekendRate: 0.08,
  range: {
    low: 0.94,
    high: 1.12,
    minimumSpread: 250,
  },
};

const state = {
  currentStep: 1,
  inventory: Object.fromEntries(INVENTORY.map((item) => [item.id, 0])),
  quote: null,
};

const form = document.querySelector("#movingQuoteForm");
const steps = [...document.querySelectorAll(".form-step")];
const stepperItems = [...document.querySelectorAll(".stepper__item")];
const inventoryGrid = document.querySelector("#inventoryGrid");
const nextButton = document.querySelector("#nextStep");
const prevButton = document.querySelector("#prevStep");
const submitButton = document.querySelector("#submitQuote");
const quoteModal = document.querySelector("#quoteModal");

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return money.format(Math.max(0, Math.round(value)));
}

function roundToFifty(value) {
  return Math.ceil(value / 50) * 50;
}

function valueOf(id, fallback = "") {
  return document.querySelector(`#${id}`)?.value ?? fallback;
}

function numberOf(id, fallback = 0) {
  const value = Number(valueOf(id));
  return Number.isFinite(value) ? value : fallback;
}

function isChecked(id) {
  return Boolean(document.querySelector(`#${id}`)?.checked);
}

function selectedServices() {
  return [...document.querySelectorAll('input[name="service"]:checked')].map((input) => input.value);
}

function renderInventory() {
  inventoryGrid.innerHTML = INVENTORY.map((item) => `
    <article class="inventory-item" data-item-id="${item.id}">
      <span class="inventory-item__icon" aria-hidden="true">${item.icon}</span>
      <div class="inventory-item__meta">
        <strong>${item.name}</strong>
        <small>${item.detail}</small>
      </div>
      <div class="quantity-control" aria-label="Cantidad de ${item.name}">
        <button type="button" data-quantity-action="decrease" data-item-id="${item.id}" aria-label="Disminuir ${item.name}">−</button>
        <output id="quantity-${item.id}" aria-live="polite">0</output>
        <button type="button" data-quantity-action="increase" data-item-id="${item.id}" aria-label="Aumentar ${item.name}">+</button>
      </div>
    </article>
  `).join("");
}

function updateInventoryUI() {
  let total = 0;
  INVENTORY.forEach((item) => {
    const quantity = state.inventory[item.id] ?? 0;
    total += quantity;
    const output = document.querySelector(`#quantity-${item.id}`);
    const card = document.querySelector(`[data-item-id="${item.id}"].inventory-item`);
    if (output) output.value = quantity;
    if (card) card.classList.toggle("has-quantity", quantity > 0);
  });

  document.querySelector("#itemCountLabel").textContent = `${total} ${total === 1 ? "artículo seleccionado" : "artículos seleccionados"}`;
  document.querySelector("#summaryItems").textContent = String(total);
}

function calculateQuote() {
  const distance = Math.max(1, numberOf("distanceKm", 10));
  const originFloor = Math.max(0, numberOf("originFloor"));
  const destinationFloor = Math.max(0, numberOf("destinationFloor"));
  const originElevator = isChecked("originElevator");
  const destinationElevator = isChecked("destinationElevator");
  const protectionLevel = valueOf("protectionLevel", "standard");
  const services = selectedServices();

  const totalItems = INVENTORY.reduce((sum, item) => sum + (state.inventory[item.id] || 0), 0);
  const totalVolume = INVENTORY.reduce((sum, item) => sum + (state.inventory[item.id] || 0) * item.volume, 0);
  const handlingCost = INVENTORY.reduce((sum, item) => sum + (state.inventory[item.id] || 0) * item.handling, 0);

  const baseCost = PRICING.baseOperation;
  const distanceRate = distance <= 30
    ? PRICING.distancePerKm.local
    : distance <= 100
      ? PRICING.distancePerKm.regional
      : PRICING.distancePerKm.longDistance;
  const distanceCost = distance * distanceRate;
  const volumeCost = totalVolume * PRICING.volumePerM3;
  const accessCost =
    (!originElevator
      ? originFloor * PRICING.accessPerFloor.withoutElevator
      : originFloor * PRICING.accessPerFloor.withElevator) +
    (!destinationElevator
      ? destinationFloor * PRICING.accessPerFloor.withoutElevator
      : destinationFloor * PRICING.accessPerFloor.withElevator);

  let serviceCost = 0;
  if (services.includes("packing")) {
    serviceCost += Math.max(
      PRICING.services.packingMinimum,
      (handlingCost + volumeCost) * PRICING.services.packingRate,
    );
  }
  if (services.includes("assembly")) serviceCost += PRICING.services.assembly;
  if (services.includes("fragile")) serviceCost += PRICING.services.fragile;
  if (services.includes("longCarry")) serviceCost += PRICING.services.longCarry;

  const protectionMultiplier = PRICING.protectionMultiplier[protectionLevel] ?? 1;
  let subtotal = (baseCost + distanceCost + handlingCost + volumeCost + accessCost + serviceCost) * protectionMultiplier;

  const selectedDate = valueOf("moveDate");
  let calendarSurcharge = 0;
  if (selectedDate) {
    const day = new Date(`${selectedDate}T12:00:00`).getDay();
    if (day === 0 || day === 6) calendarSurcharge = subtotal * PRICING.weekendRate;
  }

  if (services.includes("express")) {
    calendarSurcharge += subtotal * PRICING.services.expressRate;
  }
  subtotal += calendarSurcharge;

  const insuranceCost = services.includes("insurance")
    ? subtotal * PRICING.services.insuranceRate
    : 0;
  subtotal += insuranceCost;

  const low = roundToFifty(Math.max(PRICING.minimumQuote, subtotal * PRICING.range.low));
  const high = roundToFifty(
    Math.max(low + PRICING.range.minimumSpread, subtotal * PRICING.range.high),
  );

  let vehicle = "Van ligera";
  if (totalVolume > 5 && totalVolume <= 12) vehicle = "Camioneta 1.5 t";
  if (totalVolume > 12 && totalVolume <= 24) vehicle = "Camión 3.5 t";
  if (totalVolume > 24) vehicle = "Camión grande / 2 viajes";

  const complexityScore = Math.min(
    100,
    12 + totalVolume * 2.2 + distance * 0.16 + (originFloor + destinationFloor) * 3 + services.length * 5,
  );
  const complexity = complexityScore < 32 ? "Básica" : complexityScore < 60 ? "Media" : complexityScore < 82 ? "Alta" : "Especial";

  const breakdown = [
    { label: "Operación base", amount: baseCost },
    { label: `Traslado (${distance} km)`, amount: distanceCost },
    { label: "Volumen y maniobras", amount: handlingCost + volumeCost },
  ];

  if (accessCost > 0) breakdown.push({ label: "Accesos y pisos", amount: accessCost });
  if (serviceCost > 0) breakdown.push({ label: "Servicios adicionales", amount: serviceCost });
  if (calendarSurcharge > 0) breakdown.push({ label: "Fecha / prioridad", amount: calendarSurcharge });
  if (insuranceCost > 0) breakdown.push({ label: "Cobertura ampliada", amount: insuranceCost });

  state.quote = {
    low,
    high,
    distance,
    totalItems,
    totalVolume,
    vehicle,
    complexity,
    complexityScore,
    breakdown,
    services,
  };

  renderEstimate();
  persistDraft();
  return state.quote;
}

function renderEstimate() {
  const quote = state.quote;
  if (!quote) return;

  document.querySelector("#estimateFrom").textContent = formatMoney(quote.low);
  document.querySelector("#estimateRangeText").textContent = `Rango sugerido: ${formatMoney(quote.low)} — ${formatMoney(quote.high)} MXN`;
  document.querySelector("#summaryDistance").textContent = `${quote.distance} km`;
  document.querySelector("#summaryItems").textContent = String(quote.totalItems);
  document.querySelector("#summaryVolume").textContent = `${quote.totalVolume.toFixed(1)} m³`;
  document.querySelector("#summaryVehicle").textContent = quote.vehicle;
  document.querySelector("#complexityLabel").textContent = quote.complexity;
  document.querySelector("#complexityBar").style.width = `${Math.max(12, quote.complexityScore)}%`;
  document.querySelector("#finalRange").textContent = `${formatMoney(quote.low)} — ${formatMoney(quote.high)} MXN`;

  document.querySelector("#breakdownList").innerHTML = quote.breakdown
    .map((item) => `<div class="breakdown__row"><span>${item.label}</span><strong>${formatMoney(item.amount)}</strong></div>`)
    .join("");
}

function showStep(stepNumber, shouldScroll = true) {
  state.currentStep = Math.min(4, Math.max(1, stepNumber));

  steps.forEach((step) => {
    step.classList.toggle("is-active", Number(step.dataset.step) === state.currentStep);
  });

  stepperItems.forEach((item, index) => {
    const step = index + 1;
    item.classList.toggle("is-active", step === state.currentStep);
    item.classList.toggle("is-complete", step < state.currentStep);
    if (step === state.currentStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  prevButton.classList.toggle("is-hidden", state.currentStep === 1);
  nextButton.classList.toggle("is-hidden", state.currentStep === 4);
  submitButton.classList.toggle("is-hidden", state.currentStep !== 4);
  calculateQuote();
  if (shouldScroll) {
    document.querySelector(".quote-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setFieldError(field, message = "") {
  const container = field.closest(".field") ?? field.closest(".consent-field")?.parentElement;
  const error = document.querySelector(`[data-error-for="${field.id}"]`);
  container?.classList.toggle("has-error", Boolean(message));
  if (error) error.textContent = message;
}

function validateStep(stepNumber) {
  const current = document.querySelector(`.form-step[data-step="${stepNumber}"]`);
  if (!current) return true;

  let valid = true;
  const requiredFields = [...current.querySelectorAll("[required]")];

  requiredFields.forEach((field) => {
    let message = "";
    if (field.type === "checkbox" && !field.checked) message = "Debes aceptar para continuar.";
    else if (!String(field.value).trim()) message = "Este campo es obligatorio.";
    else if (field.id === "distanceKm" && Number(field.value) < 1) message = "Ingresa una distancia válida.";
    else if (field.id === "phone" && field.value.replace(/\D/g, "").length < 10) message = "Ingresa un teléfono de al menos 10 dígitos.";
    else if (field.type === "email" && field.value && !field.validity.valid) message = "Ingresa un correo válido.";

    setFieldError(field, message);
    if (message) valid = false;
  });

  if (!valid) {
    current.querySelector(".has-error input, .has-error select, .has-error textarea")?.focus();
  }

  return valid;
}

function applyPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) return;

  state.inventory = Object.fromEntries(INVENTORY.map((item) => [item.id, preset[item.id] ?? 0]));
  document.querySelectorAll(".preset-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.preset === presetName);
  });
  updateInventoryUI();
  calculateQuote();
}

function clearPresetSelection() {
  document.querySelectorAll(".preset-card").forEach((card) => card.classList.remove("is-selected"));
}

function clearInventory() {
  state.inventory = Object.fromEntries(INVENTORY.map((item) => [item.id, 0]));
  clearPresetSelection();
  updateInventoryUI();
  calculateQuote();
}

function collectDraft() {
  const fields = {};
  new FormData(form).forEach((value, key) => {
    if (key !== "service") fields[key] = value;
  });

  fields.originElevator = isChecked("originElevator");
  fields.destinationElevator = isChecked("destinationElevator");
  fields.services = selectedServices();

  return {
    fields,
    inventory: state.inventory,
    currentStep: state.currentStep,
    updatedAt: new Date().toISOString(),
  };
}

function persistDraft() {
  try {
    localStorage.setItem("moveflow-quote-draft", JSON.stringify(collectDraft()));
  } catch {
    // El cotizador sigue funcionando aun si el navegador bloquea localStorage.
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem("moveflow-quote-draft");
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft?.fields) return;

    Object.entries(draft.fields).forEach(([name, value]) => {
      if (name === "services") return;
      const field = form.elements.namedItem(name);
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    });

    (draft.fields.services ?? []).forEach((service) => {
      const checkbox = form.querySelector(`input[name="service"][value="${service}"]`);
      if (checkbox) checkbox.checked = true;
    });

    if (draft.inventory) {
      state.inventory = { ...state.inventory, ...draft.inventory };
    }
    state.currentStep = Math.min(4, Math.max(1, Number(draft.currentStep) || 1));
  } catch {
    // Un borrador inválido se ignora de forma segura.
  }
}

function resetQuote() {
  form.reset();
  state.inventory = Object.fromEntries(INVENTORY.map((item) => [item.id, 0]));
  state.currentStep = 1;
  clearPresetSelection();
  setDefaultDate();
  document.querySelectorAll(".field-error").forEach((error) => (error.textContent = ""));
  document.querySelectorAll(".has-error").forEach((field) => field.classList.remove("has-error"));
  try {
    localStorage.removeItem("moveflow-quote-draft");
  } catch {
    // Sin acción necesaria.
  }
  updateInventoryUI();
  showStep(1);
}

function setDefaultDate() {
  const input = document.querySelector("#moveDate");
  const today = new Date();
  const min = today.toISOString().slice(0, 10);
  const defaultDate = new Date(today);
  defaultDate.setDate(defaultDate.getDate() + 7);
  input.min = min;
  if (!input.value) input.value = defaultDate.toISOString().slice(0, 10);
}

function buildSummaryText() {
  const quote = state.quote ?? calculateQuote();
  const name = valueOf("customerName", "Cliente");
  const route = `${valueOf("origin", "Origen pendiente")} → ${valueOf("destination", "Destino pendiente")}`;
  const services = quote.services.length ? quote.services.map((service) => SERVICE_LABELS[service]).join(", ") : "Servicio estándar";

  return [
    "COTIZACIÓN PRELIMINAR · MOVEFLOW",
    `Cliente: ${name}`,
    `Ruta: ${route}`,
    `Fecha: ${valueOf("moveDate", "Por definir")}`,
    `Distancia: ${quote.distance} km`,
    `Inventario: ${quote.totalItems} artículos · ${quote.totalVolume.toFixed(1)} m³`,
    `Unidad sugerida: ${quote.vehicle}`,
    `Servicios: ${services}`,
    `Rango estimado: ${formatMoney(quote.low)} — ${formatMoney(quote.high)} MXN`,
    "Nota: precio sujeto a validación de volumen, accesos y disponibilidad.",
  ].join("\n");
}

function openQuoteModal() {
  const quote = state.quote ?? calculateQuote();
  document.querySelector("#modalRange").textContent = `${formatMoney(quote.low)} — ${formatMoney(quote.high)} MXN`;
  document.querySelector("#modalSummary").innerHTML = `
    <div><span>Cliente</span><strong>${escapeHtml(valueOf("customerName"))}</strong></div>
    <div><span>Fecha</span><strong>${escapeHtml(valueOf("moveDate"))}</strong></div>
    <div><span>Ruta</span><strong>${escapeHtml(valueOf("origin"))} → ${escapeHtml(valueOf("destination"))}</strong></div>
    <div><span>Unidad sugerida</span><strong>${escapeHtml(quote.vehicle)}</strong></div>
    <div><span>Artículos</span><strong>${quote.totalItems}</strong></div>
    <div><span>Volumen</span><strong>${quote.totalVolume.toFixed(1)} m³</strong></div>
  `;
  quoteModal.classList.add("is-open");
  quoteModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.querySelector("#closeModal").focus();
}

function closeQuoteModal() {
  quoteModal.classList.remove("is-open");
  quoteModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

async function copySummary() {
  const feedback = document.querySelector("#copyFeedback");
  const summary = buildSummaryText();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = summary;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      if (!copied) throw new Error("No se pudo copiar");
    }
    feedback.textContent = "Resumen copiado al portapapeles.";
  } catch {
    feedback.textContent = "No se pudo copiar automáticamente. Usa Imprimir / guardar PDF.";
  }
}

inventoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity-action]");
  if (!button) return;
  const id = button.dataset.itemId;
  const delta = button.dataset.quantityAction === "increase" ? 1 : -1;
  state.inventory[id] = Math.max(0, Math.min(99, (state.inventory[id] || 0) + delta));
  clearPresetSelection();
  updateInventoryUI();
  calculateQuote();
});

document.querySelectorAll(".preset-card").forEach((card) => {
  card.addEventListener("click", () => applyPreset(card.dataset.preset));
});

document.querySelector("#clearInventory").addEventListener("click", clearInventory);
document.querySelector("#resetQuote").addEventListener("click", resetQuote);

nextButton.addEventListener("click", () => {
  if (validateStep(state.currentStep)) showStep(state.currentStep + 1);
});

prevButton.addEventListener("click", () => showStep(state.currentStep - 1));

stepperItems.forEach((item) => {
  item.addEventListener("click", () => {
    const target = Number(item.dataset.goStep);
    if (target <= state.currentStep || validateStep(state.currentStep)) showStep(target);
  });
});

form.addEventListener("input", (event) => {
  if (event.target.id) setFieldError(event.target, "");
  calculateQuote();
});

form.addEventListener("change", calculateQuote);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateStep(4)) return;
  calculateQuote();
  openQuoteModal();
});

document.querySelector("#closeModal").addEventListener("click", closeQuoteModal);
document.querySelector("#printQuote").addEventListener("click", () => window.print());
document.querySelector("#copyQuote").addEventListener("click", copySummary);
quoteModal.addEventListener("click", (event) => {
  if (event.target === quoteModal) closeQuoteModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && quoteModal.classList.contains("is-open")) closeQuoteModal();
});

renderInventory();
setDefaultDate();
restoreDraft();
setDefaultDate();
updateInventoryUI();
showStep(state.currentStep, false);
document.querySelector("#currentYear").textContent = String(new Date().getFullYear());
