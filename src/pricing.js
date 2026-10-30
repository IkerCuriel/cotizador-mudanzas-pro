// Los pesos y las capacidades son estimaciones operativas; confirmar la carga real.
export const INVENTORY = [
  { id: "boxes", name: "Cajas medianas", detail: "0.10 m³ c/u", icon: "□", volume: 0.1, weightKg: 12 },
  { id: "glassware", name: "Vajilla y vasos", detail: "Caja de cocina / cristalería", icon: "◫", volume: 0.12, weightKg: 15 },
  { id: "sofa", name: "Sofá", detail: "2–3 plazas", icon: "▱", volume: 1.8, weightKg: 70 },
  { id: "armchair", name: "Sillón individual", detail: "1 plaza", icon: "▰", volume: 0.75, weightKg: 30 },
  { id: "bed", name: "Cama / colchón", detail: "Individual a king", icon: "▭", volume: 1.3, weightKg: 55 },
  { id: "wardrobe", name: "Ropero / clóset", detail: "Mueble grande", icon: "▥", volume: 1.6, weightKg: 90 },
  { id: "diningTable", name: "Mesa de comedor", detail: "4–8 personas", icon: "▦", volume: 1.2, weightKg: 55 },
  { id: "diningChair", name: "Silla de comedor", detail: "Por pieza", icon: "⌑", volume: 0.25, weightKg: 8 },
  { id: "refrigerator", name: "Refrigerador", detail: "Mediano o grande", icon: "▯", volume: 1.45, weightKg: 85 },
  { id: "washer", name: "Lavadora / secadora", detail: "Línea blanca", icon: "◉", volume: 0.85, weightKg: 70 },
  { id: "tv", name: "Televisión", detail: "Pantalla plana", icon: "▣", volume: 0.2, weightKg: 15 },
  { id: "desk", name: "Escritorio", detail: "Casa u oficina", icon: "⌨", volume: 0.85, weightKg: 40 },
  { id: "bookcase", name: "Librero / estante", detail: "Mueble vertical", icon: "▤", volume: 1.05, weightKg: 45 },
  { id: "appliance", name: "Electrodoméstico", detail: "Microondas, horno, etc.", icon: "◇", volume: 0.18, weightKg: 12 },
  { id: "decor", name: "Decoración / cuadros", detail: "Lote protegido", icon: "◫", volume: 0.14, weightKg: 8 },
];

export const PRESETS = {
  mini: { boxes: 8, glassware: 1, bed: 1, tv: 1, desk: 1, decor: 2 },
  oneBedroom: { boxes: 18, glassware: 2, sofa: 1, bed: 1, diningTable: 1, diningChair: 4, refrigerator: 1, tv: 1, appliance: 3 },
  twoBedroom: { boxes: 32, glassware: 4, sofa: 1, armchair: 1, bed: 2, wardrobe: 1, diningTable: 1, diningChair: 6, refrigerator: 1, washer: 1, tv: 2, desk: 1, appliance: 5, decor: 4 },
  family: { boxes: 52, glassware: 7, sofa: 2, armchair: 2, bed: 3, wardrobe: 2, diningTable: 1, diningChair: 8, refrigerator: 1, washer: 2, tv: 3, desk: 2, bookcase: 2, appliance: 8, decor: 7 },
};

export const VEHICLES = [
  { id: "pickup", label: "Pickup", baseFare: 400, capacityM3: 4, capacityKg: 750 },
  { id: "van", label: "Van", baseFare: 600, capacityM3: 10, capacityKg: 1200 },
  { id: "truck", label: "Camión 3.5 t", baseFare: 800, capacityM3: 22, capacityKg: 3500 },
  { id: "torton", label: "Torton", baseFare: 1300, capacityM3: 50, capacityKg: 14000 },
  { id: "trailer", label: "Tráiler", baseFare: 3500, capacityM3: 90, capacityKg: 24000 },
];

// Tarifas editables. PROPUESTAS PROVISIONALES por validar con operaciones:
// distancia, multiplicador foráneo, peso, artículos, acarreos, inmuebles,
// pisos sin elevador, volados y bodega. Capacidades y pesos también provisionales.
// Frágiles, prioridad y fin de semana conservan tarifas anteriores pendientes de validar.
// Desmontaje/montaje sigue siendo adicional hasta confirmar su inclusión.
// No existe cobro de seguro ni multiplicador oculto por protección.
export const PRICING = {
  provisional: true,
  volumePerM3: 380,
  volumeDiscountThreshold: 35,
  excessVolumeDiscount: 0.15,
  includedDistanceKm: 15,
  distancePerKm: 35,
  outOfTownMultiplier: 1.35,
  weightPerKg: 0.5,
  perArticle: 10,
  carry: { includedMeters: 30, volumePerMeter: 0.5, articlePerMeter: 0.15 },
  extraLoader: { fixed: 300, perM3: 2 },
  propertyPerM3: { house: 0, apartment: 4, office: 6, storage: 0 },
  floors: { withoutElevatorPerM3: 12, withElevator: 50 },
  packingPerM3: { none: 0, half: 45, full: 95 },
  boxPackages: { 10: 650, 20: 1200, 30: 1650 },
  assembly: { furniturePerBlock: 5, perBlock: 350 },
  hoistPerFloor: { up: 600, down: 450 },
  storagePerM3Day: 12,
  services: { fragile: 420, expressRate: 0.12 },
  weekendRate: 0.08,
  range: { high: 1.12, minimumSpread: 250, roundTo: 50 },
};

// Límite defensivo para datos manipulados fuera del formulario.
const MAX_INPUT = 1_000_000;
const PROPERTY_LABELS = { house: "casa", apartment: "departamento", office: "oficina", storage: "bodega" };

function number(value) {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(MAX_INPUT, Math.max(0, parsed)) : 0;
}

function integer(value) {
  return Math.floor(number(value));
}

function round(value, precision = 100) {
  return Math.round((value + Number.EPSILON) * precision) / precision;
}

function override(value, fallback, label, warnings) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return fallback;
  const entered = round(number(value), 1000);
  if (entered > 0) return entered;
  warnings.push(`El ${label} manual no es válido; se usó la estimación del inventario.`);
  return fallback;
}

function weekend(dateText) {
  if (typeof dateText !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

/** Motor puro: todos los importes son MXN y los totales suman partidas redondeadas. */
export function calculatePricing(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const inventory = input.inventory && typeof input.inventory === "object" ? input.inventory : {};
  const totalItems = INVENTORY.reduce((sum, item) => sum + integer(inventory[item.id]), 0);
  const estimatedVolume = round(INVENTORY.reduce((sum, item) => sum + integer(inventory[item.id]) * item.volume, 0), 1000);
  const estimatedWeight = round(INVENTORY.reduce((sum, item) => sum + integer(inventory[item.id]) * item.weightKg, 0), 1000);
  const distance = number(input.distanceKm);
  const warnings = [];
  const breakdown = [];
  const services = [];
  const empty = {
    low: 0, high: 0, total: 0, baseTotal: 0, variableTotal: 0, totalItems,
    totalVolume: 0, totalWeight: 0, distance, vehicle: "Por definir", vehicleId: null,
    vehicleTrips: 0, complexity: "Por definir", complexityScore: 0,
    breakdown, services, warnings, requiresReview: false, isEmpty: true,
  };
  if (totalItems === 0) return empty;

  const totalVolume = override(input.volumeOverride, estimatedVolume, "volumen", warnings);
  const totalWeight = override(input.weightOverride, estimatedWeight, "peso", warnings);
  const manualVehicle = VEHICLES.find((vehicle) => vehicle.id === input.vehicleType);
  const selectedVehicle = manualVehicle
    ?? VEHICLES.find((vehicle) => totalVolume <= vehicle.capacityM3 && totalWeight <= vehicle.capacityKg)
    ?? VEHICLES.at(-1);
  const vehicleTrips = Math.max(1, Math.ceil(totalVolume / selectedVehicle.capacityM3), Math.ceil(totalWeight / selectedVehicle.capacityKg));
  if (vehicleTrips > 1) {
    warnings.push(`La carga supera la capacidad de ${selectedVehicle.label}. Se estiman ${vehicleTrips} viajes; el banderazo y la distancia se cobran por viaje. Operaciones debe validar la unidad, la carga y la ruta.`);
  }
  let requiresReview = warnings.length > 0;

  function add(group, key, label, amount, detail, includeZero = false) {
    const rounded = round(amount);
    if (rounded > 0 || includeZero) breakdown.push({ group, key, label, amount: rounded, detail });
  }
  const moneySum = (group) => breakdown.filter((line) => !group || line.group === group)
    .reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;

  add("base", "vehicle", `Banderazo · ${selectedVehicle.label}`, selectedVehicle.baseFare * vehicleTrips,
    `$${selectedVehicle.baseFare} × ${vehicleTrips} ${vehicleTrips === 1 ? "viaje" : "viajes"}`);
  const regularVolume = Math.min(totalVolume, PRICING.volumeDiscountThreshold);
  const excessVolume = round(Math.max(0, totalVolume - PRICING.volumeDiscountThreshold), 1000);
  add("base", "volume", "Volumen · primeros 35 m³", regularVolume * PRICING.volumePerM3,
    `${regularVolume} m³ × $${PRICING.volumePerM3}/m³`);
  add("base", "volumeExcess", "Volumen excedente · 15% de descuento", excessVolume * PRICING.volumePerM3 * (1 - PRICING.excessVolumeDiscount),
    `${excessVolume} m³ × $${round(PRICING.volumePerM3 * (1 - PRICING.excessVolumeDiscount))}/m³; descuento solo después de 35 m³`);
  const chargeableDistance = Math.max(0, distance - PRICING.includedDistanceKm);
  const routeMultiplier = input.routeType === "outOfTown" ? PRICING.outOfTownMultiplier : 1;
  add("base", "distance", input.routeType === "outOfTown" ? "Distancia foránea" : "Distancia local",
    chargeableDistance * PRICING.distancePerKm * routeMultiplier * vehicleTrips,
    `${chargeableDistance} km facturables × $${PRICING.distancePerKm}/km${routeMultiplier !== 1 ? ` × ${routeMultiplier} foráneo` : ""} × ${vehicleTrips} viaje(s); primeros ${PRICING.includedDistanceKm} km incluidos`, true);
  add("base", "weight", "Peso estimado", totalWeight * PRICING.weightPerKg, `${totalWeight} kg × $${PRICING.weightPerKg}/kg`);
  add("base", "articles", "Cantidad de artículos", totalItems * PRICING.perArticle, `${totalItems} artículos × $${PRICING.perArticle}`);

  const floorCounts = [];
  for (const [endpoint, label] of [["origin", "Origen"], ["destination", "Destino"]]) {
    const property = Object.hasOwn(PRICING.propertyPerM3, input[`${endpoint}Property`]) ? input[`${endpoint}Property`] : "house";
    add("variable", `${endpoint}Property`, `${label} · ${PROPERTY_LABELS[property]}`, totalVolume * PRICING.propertyPerM3[property],
      `${totalVolume} m³ × $${PRICING.propertyPerM3[property]}/m³`);
    const floor = integer(input[`${endpoint}Floor`]);
    floorCounts.push(floor);
    const elevator = input[`${endpoint}Elevator`] === true;
    const floorRate = elevator ? PRICING.floors.withElevator : totalVolume * PRICING.floors.withoutElevatorPerM3;
    add("variable", `${endpoint}Floors`, `${label} · ${elevator ? "pisos con elevador" : "pisos sin elevador"}`, floor * floorRate,
      elevator ? `${floor} pisos × $${PRICING.floors.withElevator}/piso` : `${floor} pisos × ${totalVolume} m³ × $${PRICING.floors.withoutElevatorPerM3}/m³/piso`);
    const extraMeters = Math.max(0, number(input[`${endpoint}CarryMeters`]) - PRICING.carry.includedMeters);
    const carryRate = totalVolume * PRICING.carry.volumePerMeter + totalItems * PRICING.carry.articlePerMeter;
    add("variable", `${endpoint}Carry`, `${label} · acarreo excedente`, extraMeters * carryRate,
      `${extraMeters} m × (${totalVolume} m³ × $${PRICING.carry.volumePerMeter} + ${totalItems} artículos × $${PRICING.carry.articlePerMeter}); primeros ${PRICING.carry.includedMeters} m incluidos`);
  }

  const extraLoaders = integer(input.extraLoaders);
  const loaderRate = PRICING.extraLoader.fixed + totalVolume * PRICING.extraLoader.perM3;
  add("variable", "loaders", "Cargadores extra", extraLoaders * loaderRate,
    `${extraLoaders} cargadores × ($${PRICING.extraLoader.fixed} + ${totalVolume} m³ × $${PRICING.extraLoader.perM3})`);
  if (extraLoaders) services.push(`${extraLoaders} ${extraLoaders === 1 ? "cargador extra" : "cargadores extra"}`);

  const packingType = Object.hasOwn(PRICING.packingPerM3, input.packingType) ? input.packingType : "none";
  const boxPackage = Object.hasOwn(PRICING.boxPackages, input.boxPackage) ? Number(input.boxPackage) : 0;
  if (boxPackage && packingType !== "none") {
    warnings.push("El embalaje por volumen y el paquete de cajas son excluyentes. Se calculó únicamente el paquete de cajas; confirma la modalidad.");
    requiresReview = true;
  }
  if (boxPackage) {
    add("variable", "boxes", `Empaque de ${boxPackage} cajas`, PRICING.boxPackages[boxPackage], `Paquete de ${boxPackage} cajas; no se suma embalaje por m³`);
    services.push(`Empaque de ${boxPackage} cajas`);
  } else if (packingType !== "none") {
    const label = packingType === "full" ? "Embalaje completo" : "Medio embalaje";
    add("variable", "packing", label, totalVolume * PRICING.packingPerM3[packingType], `${totalVolume} m³ × $${PRICING.packingPerM3[packingType]}/m³`);
    services.push(label);
  }
  const assemblyCount = integer(input.assemblyCount);
  const assemblyBlocks = Math.ceil(assemblyCount / PRICING.assembly.furniturePerBlock);
  add("variable", "assembly", "Desmontaje / montaje", assemblyBlocks * PRICING.assembly.perBlock,
    `${assemblyCount} muebles; ${assemblyBlocks} bloques de hasta ${PRICING.assembly.furniturePerBlock} × $${PRICING.assembly.perBlock}`);
  if (assemblyCount) services.push(`Desmontaje / montaje de ${assemblyCount} muebles`);
  for (const [direction, inputKey, label] of [["up", "hoistUpFloors", "Subida"], ["down", "hoistDownFloors", "Bajada"]]) {
    const floors = integer(input[inputKey]);
    add("variable", inputKey, `${label} por fachada`, floors * PRICING.hoistPerFloor[direction], `${floors} pisos × $${PRICING.hoistPerFloor[direction]}/piso`);
    if (floors) services.push(`${label} por fachada: ${floors} pisos`);
  }
  const storageDays = integer(input.storageDays);
  // Vacío o cero significa almacenar todo el volumen de la mudanza.
  const storageVolume = number(input.storageVolume) || totalVolume;
  add("variable", "storage", "Almacenaje temporal", storageDays * storageVolume * PRICING.storagePerM3Day,
    `${storageVolume} m³ × ${storageDays} días × $${PRICING.storagePerM3Day}/m³/día`);
  if (storageDays) services.push(`Almacenaje: ${storageVolume} m³ durante ${storageDays} días`);

  const selectedServices = Array.isArray(input.services) ? input.services : [];
  if (selectedServices.includes("fragile")) {
    add("variable", "fragile", "Manejo de frágiles", PRICING.services.fragile, "Tarifa fija adicional");
    services.push("Manejo de frágiles");
  }
  // Ambos porcentajes usan el mismo subtotal, sin intereses compuestos entre ellos.
  const surchargeBase = moneySum();
  if (selectedServices.includes("express")) {
    add("variable", "express", "Servicio prioritario", surchargeBase * PRICING.services.expressRate,
      `${PRICING.services.expressRate * 100}% de $${surchargeBase.toFixed(2)} antes de recargos de fecha/prioridad`);
    services.push("Servicio prioritario");
  }
  if (weekend(input.moveDate)) {
    add("variable", "weekend", "Fin de semana", surchargeBase * PRICING.weekendRate,
      `${PRICING.weekendRate * 100}% de $${surchargeBase.toFixed(2)} antes de recargos de fecha/prioridad`);
  }

  const baseTotal = moneySum("base");
  const variableTotal = moneySum("variable");
  const total = moneySum();
  const roundRange = (value) => Math.ceil(value / PRICING.range.roundTo) * PRICING.range.roundTo;
  const low = roundRange(total);
  const high = roundRange(Math.max(low + PRICING.range.minimumSpread, total * PRICING.range.high));
  const complexityScore = Math.min(100, Math.round(12 + totalVolume * 2.2 + distance * 0.16 + floorCounts.reduce((sum, floor) => sum + floor, 0) * 3 + services.length * 5));
  const complexity = complexityScore < 32 ? "Básica" : complexityScore < 60 ? "Media" : complexityScore < 82 ? "Alta" : "Especial";
  return {
    low, high, total, baseTotal, variableTotal, totalItems, totalVolume, totalWeight, distance,
    vehicle: selectedVehicle.label, vehicleId: selectedVehicle.id, vehicleTrips,
    complexity, complexityScore, breakdown, services, warnings, requiresReview, isEmpty: false,
  };
}
